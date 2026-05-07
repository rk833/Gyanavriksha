"""Application-layer use cases for the admin bounded context.

Each function orchestrates one admin-facing operation: calls the underlying
service layer, maps results and errors to response schemas or HTTPExceptions,
and keeps the presentation layer free of business logic.
"""
import uuid

from fastapi import BackgroundTasks, HTTPException, status
from app.services import curriculum_ingestion_service
from sqlalchemy.orm import Session

from app.db.models.user import User
from app.schemas.common import PaginatedResponse
from app.schemas.notification import NotificationResponse, UnreadCountResponse
from app.schemas.user import MessageResponse
from app.schemas.admin import (
    AdminDashboardResponse,
    AdminSettingsResponse,
    AdminSettingsUpdateRequest,
    IntegrationTestResponse,
    IntegrationTestRequest,
    AdminUserCreateResponse,
    AdminUserListResponse,
    AdminUserResponse,
    ApiKeyRegenerateResponse,
    AuditLogListResponse,
    AuditLogResponse,
    BulkEnrollmentResponse,
    BulkImportResponse,
    BulkImportRow,
    CurriculumDocDetailResponse,
    CurriculumDocListResponse,
    EnrollmentListResponse,
    EnrollmentResponse,
    GradeNamespaceGroup,
    GradeResponse,
    IngestionJobListResponse,
    IngestionJobResponse,
    IntegrityAuditResponse,
    IoTDeviceCreateResponse,
    IoTAlertTimelineResponse,
    IoTAlertEntry,
    IoTDeviceDetailResponse,
    IoTDeviceListResponse,
    IoTDeviceResponse,
    IoTHealthResponse,
    RoleDistribution,
    SecurityOverviewResponse,
    SubjectResponse,
    SystemChangeEntry,
    SystemHealthSummary,
    VectorStoreStatsResponse,
)
from app.services import notification_service
from app.services import admin_service
from app.services.email_service import send_welcome_email
from app.shared.source_enum import UserRole


def get_dashboard(db: Session) -> AdminDashboardResponse:
    """Return the aggregated admin control panel overview with real live data."""
    data = admin_service.get_full_dashboard(db)
    return AdminDashboardResponse(
        iot_nodes_active=data["iot_nodes_active"],
        chromadb_accuracy_pct=data["chromadb_accuracy_pct"],
        two_fa_compliance_pct=data["two_fa_compliance_pct"],
        iot_registry_preview=data["iot_registry_preview"],
        integrity_status=data["integrity_status"],
        integrity_verified_count=data["integrity_verified_count"],
        quick_user_access=data["quick_user_access"],
        system_health=SystemHealthSummary(**data["system_health"]),
    )


def _raise_if_not_found(obj: object, detail: str) -> None:
    """Raise HTTP 404 when a required resource is missing."""
    if obj is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=detail)


def _raise_if_last_admin(db: Session) -> None:
    """Raise HTTP 400 when an operation would remove the last active admin."""
    if admin_service.count_active_admins(db) <= 1:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot perform this action on the last active admin",
        )


def _raise_if_self(actor_id: uuid.UUID, target_id: uuid.UUID) -> None:
    """Raise HTTP 400 when an admin targets their own account."""
    if actor_id == target_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot perform this action on your own account",
        )


def _user_to_schema(user: User, db: Session) -> AdminUserResponse:
    """Convert a User ORM object to an AdminUserResponse schema."""
    grade_name = None
    if user.grade_id is not None:
        grade = admin_service.get_grade_by_id(db, user.grade_id)
        grade_name = grade.grade_name if grade else None
    return AdminUserResponse(
        user_id=user.user_id,
        email=user.email,
        full_name=user.full_name,
        role=user.role,
        grade_name=grade_name,
        is_active=user.is_active,
        is_email_verified=user.is_email_verified,
        totp_enabled=user.totp_enabled,
        created_at=user.created_at,
        last_login_at=user.last_login_at,
    )


def _build_role_distribution(db: Session) -> RoleDistribution:
    """Return current role distribution schema from live counts."""
    dist = admin_service.get_user_role_distribution(db)
    return RoleDistribution(**dist)


def list_users(
    db: Session,
    role: UserRole | None,
    is_active: bool | None,
    search: str | None,
    grade_id: int | None,
    page: int,
    per_page: int,
) -> AdminUserListResponse:
    """Return a paginated, filtered user list with platform summary stats."""
    users, total = admin_service.list_users(db, role, is_active, search, grade_id, page, per_page)
    two_fa = admin_service.get_two_fa_compliance(db)
    pending_count = admin_service.count_pending_enrollments(db)
    return AdminUserListResponse(
        users=[_user_to_schema(u, db) for u in users],
        total_count=total,
        page=page,
        per_page=per_page,
        role_distribution=_build_role_distribution(db),
        security_health_pct=two_fa["compliance_percentage"],
        pending_approvals_count=pending_count,
    )


def get_user(db: Session, user_id: uuid.UUID) -> AdminUserResponse:
    """Return full detail for a single user, raising 404 when absent."""
    user = admin_service.get_user_by_id(db, user_id)
    _raise_if_not_found(user, "User not found")
    return _user_to_schema(user, db)


def create_user(
    db: Session,
    email: str,
    full_name: str,
    role: UserRole,
    raw_password: str | None,
    actor_id: uuid.UUID,
    ip_address: str | None,
    grade_id: int | None = None,
    background_tasks: BackgroundTasks | None = None,
) -> AdminUserCreateResponse:
    """Create a new user, queue a welcome email in the background, and write an audit entry."""
    if role == UserRole.STUDENT and grade_id is None:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="grade_id is required when creating a student")
    if admin_service.email_exists(db, email):
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Email already registered")
    user, password = admin_service.create_user(db, email, full_name, role, raw_password)
    if grade_id is not None:
        user.grade_id = grade_id
    admin_service.log_audit_event(
        db, actor_id, "USER_CREATED", f"Created user {email} (role: {role.value})", "user", str(user.user_id), ip_address,
    )
    db.commit()
    if background_tasks:
        background_tasks.add_task(send_welcome_email, email, full_name, password)
    else:
        send_welcome_email(email, full_name, password)
    return AdminUserCreateResponse(**_user_to_schema(user, db).model_dump(), generated_password=password)


def bulk_import_users(
    db: Session,
    rows: list[dict],
    role: UserRole,
    actor_id: uuid.UUID,
    ip_address: str | None,
    background_tasks: BackgroundTasks | None = None,
) -> BulkImportResponse:
    """Parse pre-validated CSV rows, create users, queue welcome emails in background, and audit."""
    raw_results = admin_service.bulk_import_users(db, rows, role)
    db.commit()
    for r in raw_results:
        if r["status"] == "created":
            if background_tasks:
                background_tasks.add_task(send_welcome_email, r["email"], r["full_name"], r["generated_password"])
            else:
                send_welcome_email(r["email"], r["full_name"], r["generated_password"])
    admin_service.log_audit_event(
        db,
        actor_id,
        "BULK_IMPORT",
        f"Bulk import: {sum(1 for r in raw_results if r['status'] == 'created')} created, "
        f"{sum(1 for r in raw_results if r['status'] == 'skipped')} skipped, "
        f"{sum(1 for r in raw_results if r['status'] == 'failed')} failed",
        "user",
        None,
        ip_address,
    )
    db.commit()
    return BulkImportResponse(
        total_rows=len(raw_results),
        created=sum(1 for r in raw_results if r["status"] == "created"),
        skipped=sum(1 for r in raw_results if r["status"] == "skipped"),
        failed=sum(1 for r in raw_results if r["status"] == "failed"),
        results=[BulkImportRow(**r) for r in raw_results],
    )


def update_user(
    db: Session,
    user_id: uuid.UUID,
    full_name: str | None,
    is_active: bool | None,
    profile_image_url: str | None,
    actor_id: uuid.UUID,
    ip_address: str | None,
    grade_id: int | None = None,
) -> AdminUserResponse:
    """Apply partial field updates to a user and write an audit entry."""
    user = admin_service.get_user_by_id(db, user_id)
    _raise_if_not_found(user, "User not found")
    user = admin_service.update_user_fields(db, user, full_name, is_active, profile_image_url, grade_id)
    admin_service.log_audit_event(
        db, actor_id, "USER_UPDATED", f"Updated user {user.email}", "user", str(user_id), ip_address,
    )
    db.commit()
    return _user_to_schema(user, db)


def suspend_user(
    db: Session,
    user_id: uuid.UUID,
    actor_id: uuid.UUID,
    ip_address: str | None,
) -> AdminUserResponse:
    """Suspend a user account, guarding against self-suspension and last-admin removal."""
    _raise_if_self(actor_id, user_id)
    user = admin_service.get_user_by_id(db, user_id)
    _raise_if_not_found(user, "User not found")
    if user.role == UserRole.ADMIN:
        _raise_if_last_admin(db)
    user = admin_service.set_active(db, user, False)
    admin_service.log_audit_event(
        db, actor_id, "ACCOUNT_SUSPENDED", f"Suspended {user.email}", "user", str(user_id), ip_address,
    )
    db.commit()
    return _user_to_schema(user, db)


def reactivate_user(
    db: Session,
    user_id: uuid.UUID,
    actor_id: uuid.UUID,
    ip_address: str | None,
) -> AdminUserResponse:
    """Reactivate a suspended user account."""
    user = admin_service.get_user_by_id(db, user_id)
    _raise_if_not_found(user, "User not found")
    user = admin_service.set_active(db, user, True)
    admin_service.log_audit_event(
        db, actor_id, "ACCOUNT_REACTIVATED", f"Reactivated {user.email}", "user", str(user_id), ip_address,
    )
    db.commit()
    return _user_to_schema(user, db)


def delete_user(
    db: Session,
    user_id: uuid.UUID,
    actor_id: uuid.UUID,
    ip_address: str | None,
) -> None:
    """Soft-delete a user by deactivating the account, guarding against self-deletion."""
    _raise_if_self(actor_id, user_id)
    user = admin_service.get_user_by_id(db, user_id)
    _raise_if_not_found(user, "User not found")
    if user.role == UserRole.ADMIN:
        _raise_if_last_admin(db)
    admin_service.set_active(db, user, False)
    admin_service.log_audit_event(
        db, actor_id, "ACCOUNT_DELETED", f"Deleted {user.email}", "user", str(user_id), ip_address,
    )
    db.commit()


def bulk_suspend_users(
    db: Session,
    user_ids: list[uuid.UUID],
    actor_id: uuid.UUID,
) -> dict:
    """Suspend multiple users and return operation counts."""
    count, skipped = admin_service.bulk_suspend(db, user_ids, actor_id)
    db.commit()
    return {"suspended_count": count, "skipped": skipped}


def bulk_delete_users(
    db: Session,
    user_ids: list[uuid.UUID],
    actor_id: uuid.UUID,
) -> dict:
    """Soft-delete multiple users and return operation counts."""
    count, skipped = admin_service.bulk_delete(db, user_ids, actor_id)
    db.commit()
    return {"deleted_count": count, "skipped": skipped}


def force_reset_password(
    db: Session,
    user_id: uuid.UUID,
    actor_id: uuid.UUID,
    ip_address: str | None,
    background_tasks: BackgroundTasks | None = None,
) -> dict:
    """Generate and set a new password, then queue the email in the background."""
    user = admin_service.get_user_by_id(db, user_id)
    _raise_if_not_found(user, "User not found")
    new_password = admin_service.reset_password(db, user)
    admin_service.log_audit_event(
        db, actor_id, "PASSWORD_RESET", f"Force reset password for {user.email}", "user", str(user_id), ip_address,
    )
    db.commit()
    if background_tasks:
        background_tasks.add_task(send_welcome_email, user.email, user.full_name, new_password)
    else:
        send_welcome_email(user.email, user.full_name, new_password)
    return {"message": "Password reset and emailed to user"}


def change_role(
    db: Session,
    user_id: uuid.UUID,
    new_role: UserRole,
    subject_ids: list[int] | None,
    actor_id: uuid.UUID,
    ip_address: str | None,
) -> AdminUserResponse:
    """Change a user's role with optional instructor subject assignment."""
    user = admin_service.get_user_by_id(db, user_id)
    _raise_if_not_found(user, "User not found")
    if user.role == UserRole.ADMIN and new_role != UserRole.ADMIN:
        _raise_if_last_admin(db)
    user = admin_service.change_user_role(db, user, new_role, subject_ids, actor_id)
    admin_service.log_audit_event(
        db, actor_id, "ROLE_CHANGE", f"Changed {user.email} role to {new_role.value}", "user", str(user_id), ip_address,
    )
    db.commit()
    return _user_to_schema(user, db)


def list_grades(db: Session) -> list[GradeResponse]:
    """Return all grades sorted by level with subject and student counts."""
    return [GradeResponse(**g) for g in admin_service.list_grades(db)]


def create_grade(
    db: Session,
    grade_name: str,
    grade_level: int,
    description: str | None,
    actor_id: uuid.UUID,
    ip_address: str | None,
) -> GradeResponse:
    """Create a new academic grade and write an audit entry."""
    if admin_service.grade_name_exists(db, grade_name):
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Grade name already exists")
    grade = admin_service.create_grade(db, grade_name, grade_level, description)
    admin_service.log_audit_event(db, actor_id, "GRADE_CREATED", f"Created grade {grade_name}", "grade", str(grade.grade_id), ip_address)
    db.commit()
    subject_count, student_count = admin_service._grade_counts(db, grade.grade_id)
    return GradeResponse(
        grade_id=grade.grade_id,
        grade_name=grade.grade_name,
        grade_level=grade.grade_level,
        description=grade.description,
        subject_count=subject_count,
        student_count=student_count,
    )


def update_grade(
    db: Session,
    grade_id: int,
    grade_name: str | None,
    description: str | None,
    actor_id: uuid.UUID,
    ip_address: str | None,
) -> GradeResponse:
    """Apply partial updates to a grade and write an audit entry."""
    grade = admin_service.get_grade_by_id(db, grade_id)
    _raise_if_not_found(grade, "Grade not found")
    grade = admin_service.update_grade_fields(db, grade, grade_name, description)
    admin_service.log_audit_event(db, actor_id, "GRADE_UPDATED", f"Updated grade {grade.grade_name}", "grade", str(grade_id), ip_address)
    db.commit()
    subject_count, student_count = admin_service._grade_counts(db, grade.grade_id)
    return GradeResponse(
        grade_id=grade.grade_id,
        grade_name=grade.grade_name,
        grade_level=grade.grade_level,
        description=grade.description,
        subject_count=subject_count,
        student_count=student_count,
    )


def delete_grade(
    db: Session,
    grade_id: int,
    actor_id: uuid.UUID,
    ip_address: str | None,
) -> None:
    """Delete a grade, raising 400 when linked subjects or enrollments exist."""
    error = admin_service.delete_grade_safe(db, grade_id)
    if error == "NOT_FOUND":
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Grade not found")
    if error:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=error)
    admin_service.log_audit_event(db, actor_id, "GRADE_DELETED", f"Deleted grade {grade_id}", "grade", str(grade_id), ip_address)
    db.commit()


def list_subjects(
    db: Session,
    grade_id: int | None,
    search: str | None,
) -> list[SubjectResponse]:
    """Return subjects with instructor info and counts."""
    return [SubjectResponse(**s) for s in admin_service.list_subjects(db, grade_id, search)]


def create_subject(
    db: Session,
    name: str,
    subject_code: str,
    description: str | None,
    grade_id: int,
    instructor_id: uuid.UUID | None,
    actor_id: uuid.UUID,
    ip_address: str | None,
) -> SubjectResponse:
    """Create a new subject and optionally assign an instructor."""
    if admin_service.subject_code_exists(db, subject_code):
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Subject code already exists")
    subject = admin_service.create_subject(db, name, subject_code, description, grade_id)
    if instructor_id:
        admin_service.assign_instructor_to_subject(db, subject.subject_id, instructor_id, actor_id)
    admin_service.log_audit_event(db, actor_id, "SUBJECT_CREATED", f"Created subject {name}", "subject", str(subject.subject_id), ip_address)
    db.commit()
    return SubjectResponse(**admin_service._subject_detail(db, subject))


def update_subject(
    db: Session,
    subject_id: int,
    name: str | None,
    description: str | None,
    actor_id: uuid.UUID,
    ip_address: str | None,
) -> SubjectResponse:
    """Apply partial updates to a subject."""
    subject = admin_service.get_subject_by_id(db, subject_id)
    _raise_if_not_found(subject, "Subject not found")
    subject = admin_service.update_subject_fields(db, subject, name, description)
    admin_service.log_audit_event(db, actor_id, "SUBJECT_UPDATED", f"Updated subject {subject.subject_name}", "subject", str(subject_id), ip_address)
    db.commit()
    return SubjectResponse(**admin_service._subject_detail(db, subject))


def delete_subject(
    db: Session,
    subject_id: int,
    actor_id: uuid.UUID,
    ip_address: str | None,
) -> None:
    """Delete a subject, raising 400 when active enrollments exist."""
    error = admin_service.delete_subject_safe(db, subject_id)
    if error == "NOT_FOUND":
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Subject not found")
    if error:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=error)
    admin_service.log_audit_event(db, actor_id, "SUBJECT_DELETED", f"Deleted subject {subject_id}", "subject", str(subject_id), ip_address)
    db.commit()


def assign_instructor(
    db: Session,
    subject_id: int,
    instructor_id: uuid.UUID,
    actor_id: uuid.UUID,
    ip_address: str | None,
) -> SubjectResponse:
    """Assign an instructor to a subject and write an audit entry."""
    subject = admin_service.get_subject_by_id(db, subject_id)
    _raise_if_not_found(subject, "Subject not found")
    admin_service.assign_instructor_to_subject(db, subject_id, instructor_id, actor_id)
    admin_service.log_audit_event(db, actor_id, "INSTRUCTOR_ASSIGNED", f"Assigned instructor to subject {subject_id}", "subject", str(subject_id), ip_address)
    db.commit()
    return SubjectResponse(**admin_service._subject_detail(db, subject))


def list_enrollments(
    db: Session,
    student_id: uuid.UUID | None,
    subject_id: int | None,
    grade_id: int | None,
    enrollment_status: str | None,
    page: int,
    per_page: int,
) -> EnrollmentListResponse:
    """Return a paginated, filtered enrollment list."""
    rows, total = admin_service.list_enrollments(db, student_id, subject_id, grade_id, enrollment_status, page, per_page)
    return EnrollmentListResponse(
        enrollments=[EnrollmentResponse(**r) for r in rows],
        total_count=total,
        page=page,
        per_page=per_page,
    )


def create_enrollment(
    db: Session,
    student_id: uuid.UUID,
    subject_id: int,
    actor_id: uuid.UUID,
    ip_address: str | None,
) -> EnrollmentResponse:
    """Create a single enrollment, raising 400 on duplicate."""
    if admin_service.enrollment_exists(db, student_id, subject_id):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Student already enrolled in this subject")
    enrollment = admin_service.create_enrollment(db, student_id, subject_id)
    admin_service.log_audit_event(db, actor_id, "ENROLLMENT_CREATED", f"Enrolled student {student_id} in subject {subject_id}", "enrollment", str(enrollment.enrollment_id), ip_address)
    db.commit()
    return EnrollmentResponse(**admin_service._enrollment_detail_row(db, enrollment))


def bulk_enroll(
    db: Session,
    student_ids: list[uuid.UUID],
    subject_id: int,
    actor_id: uuid.UUID,
    ip_address: str | None,
) -> BulkEnrollmentResponse:
    """Bulk-enroll students, skipping duplicates."""
    enrolled_count, skipped = admin_service.bulk_enroll(db, student_ids, subject_id)
    admin_service.log_audit_event(db, actor_id, "ENROLLMENT_BULK", f"Bulk enrolled {enrolled_count} students in subject {subject_id}", "enrollment", str(subject_id), ip_address)
    db.commit()
    return BulkEnrollmentResponse(enrolled_count=enrolled_count, skipped_student_ids=skipped)


def remove_enrollment(
    db: Session,
    enrollment_id: uuid.UUID,
    actor_id: uuid.UUID,
    ip_address: str | None,
) -> None:
    """Soft-delete an enrollment, raising 400 when submissions exist."""
    error = admin_service.remove_enrollment_safe(db, enrollment_id)
    if error == "NOT_FOUND":
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Enrollment not found")
    if error:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=error)
    admin_service.log_audit_event(db, actor_id, "ENROLLMENT_REMOVED", f"Removed enrollment {enrollment_id}", "enrollment", str(enrollment_id), ip_address)
    db.commit()


def upload_curriculum(
    db: Session,
    background_tasks: BackgroundTasks,
    file_bytes: bytes,
    filename: str,
    subject_id: int,
    actor_id: uuid.UUID,
    doc_type_str: str,
    ip_address: str | None,
    chunk_size: int | None = None,
) -> IngestionJobResponse:
    """Validate, save, and queue a curriculum file for RAG indexing."""
    try:
        doc = admin_service.upload_curriculum_file(db, file_bytes, filename, subject_id, actor_id, doc_type_str)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc))
    admin_service.log_audit_event(
        db, actor_id, "CURRICULUM_UPLOAD", f"Uploaded '{filename}' for subject {subject_id}", "curriculum_document", str(doc.doc_id), ip_address,
    )
    db.commit()
    background_tasks.add_task(
        curriculum_ingestion_service.ingest_curriculum_document,
        doc.doc_id,
        chunk_size,
    )
    return IngestionJobResponse(**admin_service._doc_to_job_dict(db, doc))


def list_ingestion_jobs(
    db: Session,
    job_status: str | None,
    grade_id: int | None,
    subject_id: int | None,
    page: int,
    per_page: int,
) -> IngestionJobListResponse:
    """Return a paginated list of ingestion jobs."""
    rows, total = admin_service.list_ingestion_jobs(db, job_status, grade_id, subject_id, page, per_page)
    return IngestionJobListResponse(
        jobs=[IngestionJobResponse(**r) for r in rows],
        total_count=total,
        page=page,
        per_page=per_page,
    )


def get_ingestion_job(db: Session, doc_id: uuid.UUID) -> IngestionJobResponse:
    """Return a single ingestion job by document ID."""
    doc = admin_service.get_curriculum_doc_by_id(db, doc_id)
    _raise_if_not_found(doc, "Ingestion job not found")
    return IngestionJobResponse(**admin_service._doc_to_job_dict(db, doc))


def cancel_ingestion_job(
    db: Session,
    doc_id: uuid.UUID,
    actor_id: uuid.UUID,
    ip_address: str | None,
) -> None:
    """Cancel or remove an ingestion job."""
    error = admin_service.cancel_or_remove_job(db, doc_id)
    if error == "NOT_FOUND":
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Job not found")
    if error:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=error)
    admin_service.log_audit_event(db, actor_id, "JOB_CANCELLED", f"Cancelled job {doc_id}", "curriculum_document", str(doc_id), ip_address)
    db.commit()


def get_vector_namespaces(db: Session) -> list[GradeNamespaceGroup]:
    """Return ChromaDB namespaces grouped by grade."""
    groups = admin_service.get_namespaces_from_db(db)
    return [GradeNamespaceGroup(**g) for g in groups]


def get_vector_stats(db: Session) -> VectorStoreStatsResponse:
    """Return vector store statistics."""
    return VectorStoreStatsResponse(**admin_service.get_vector_store_stats(db))


def create_namespace(
    db: Session,
    grade_id: int,
    subject_id: int,
    actor_id: uuid.UUID,
    ip_address: str | None,
) -> dict:
    """Register a namespace for a subject and create it in live Chroma when available."""
    subject = admin_service.get_subject_by_id(db, subject_id)
    _raise_if_not_found(subject, "Subject not found")
    live = admin_service.create_live_collection(subject.chroma_namespace or f"subject_{subject_id}")
    admin_service.log_audit_event(db, actor_id, "NAMESPACE_CREATED", f"Namespace registered for subject {subject_id}", "subject", str(subject_id), ip_address)
    db.commit()
    return {
        "namespace": subject.chroma_namespace,
        "subject_id": subject_id,
        "grade_id": grade_id,
        "live_collection_created": bool(live),
    }


def reindex_documents(
    db: Session,
    grade_id: int | None,
    subject_id: int | None,
    actor_id: uuid.UUID,
    ip_address: str | None,
) -> dict:
    """Reset documents to PENDING for re-embedding."""
    count = admin_service.reindex_documents(db, grade_id, subject_id)
    admin_service.log_audit_event(db, actor_id, "REINDEX_TRIGGERED", f"Reindex triggered for {count} documents", "curriculum_document", None, ip_address)
    db.commit()
    return {"requeued_count": count}


def get_export_snapshot(db: Session) -> dict:
    """Return a JSON metadata snapshot of all namespaces and document counts."""
    return admin_service.get_export_snapshot(db)


def list_curriculum_docs(
    db: Session,
    grade_id: int | None,
    subject_id: int | None,
    doc_type: str | None,
    doc_status: str | None,
    search: str | None,
    page: int,
    per_page: int,
) -> CurriculumDocListResponse:
    """Return a paginated curriculum document library list."""
    rows, total = admin_service.list_curriculum_docs(db, grade_id, subject_id, doc_type, doc_status, search, page, per_page)
    return CurriculumDocListResponse(
        documents=[CurriculumDocDetailResponse(**r) for r in rows],
        total_count=total,
        page=page,
        per_page=per_page,
    )


def get_curriculum_doc(db: Session, doc_id: uuid.UUID) -> CurriculumDocDetailResponse:
    """Return full detail for a single curriculum document."""
    doc = admin_service.get_curriculum_doc_by_id(db, doc_id)
    _raise_if_not_found(doc, "Document not found")
    return CurriculumDocDetailResponse(**admin_service._doc_to_detail_dict(db, doc))


def delete_curriculum_doc(
    db: Session,
    doc_id: uuid.UUID,
    actor_id: uuid.UUID,
    ip_address: str | None,
) -> None:
    """Delete a curriculum document from disk and database."""
    error = admin_service.delete_curriculum_doc(db, doc_id)
    if error == "NOT_FOUND":
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Document not found")
    if error:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=error)
    admin_service.log_audit_event(db, actor_id, "CURRICULUM_DELETED", f"Deleted curriculum document {doc_id}", "curriculum_document", str(doc_id), ip_address)
    db.commit()


def requeue_curriculum_doc(
    db: Session,
    background_tasks: BackgroundTasks,
    doc_id: uuid.UUID,
    actor_id: uuid.UUID,
    ip_address: str | None,
) -> IngestionJobResponse:
    """Re-queue a document for re-embedding and restart the RAG ingestion pipeline."""
    error = admin_service.requeue_curriculum_doc(db, doc_id)
    if error == "NOT_FOUND":
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Document not found")
    if error:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=error)
    admin_service.log_audit_event(db, actor_id, "CURRICULUM_REQUEUED", f"Requeued document {doc_id}", "curriculum_document", str(doc_id), ip_address)
    db.commit()
    background_tasks.add_task(curriculum_ingestion_service.ingest_curriculum_document, doc_id)
    doc = admin_service.get_curriculum_doc_by_id(db, doc_id)
    return IngestionJobResponse(**admin_service._doc_to_job_dict(db, doc))


def get_pending_enrollments(db: Session) -> list[EnrollmentResponse]:
    """Return all enrollments awaiting admin approval (is_active=False)."""
    rows = admin_service.list_pending_enrollments(db)
    return [EnrollmentResponse(**r) for r in rows]


def approve_enrollment(
    db: Session,
    enrollment_id: uuid.UUID,
    actor_id: uuid.UUID,
    ip_address: str | None,
) -> EnrollmentResponse:
    """Approve a pending enrollment by activating it."""
    enrollment = admin_service.get_enrollment_by_id(db, enrollment_id)
    _raise_if_not_found(enrollment, "Enrollment not found")
    admin_service.approve_enrollment(db, enrollment)
    admin_service.log_audit_event(
        db, actor_id, "ENROLLMENT_APPROVED", f"Approved enrollment {enrollment_id}", "enrollment", str(enrollment_id), ip_address,
    )
    db.commit()
    detail = admin_service.get_enrollment_detail(db, enrollment_id)
    return EnrollmentResponse(**detail)


_VALID_STATUSES = {"online", "offline", "syncing", "decommissioned"}


def list_iot_devices(
    db: Session,
    status: str | None,
    device_type: str | None,
    node_id: str | None,
    location: str | None,
    page: int,
    per_page: int,
) -> IoTDeviceListResponse:
    """Return a paginated IoT device list with summary counts."""
    result = admin_service.list_iot_devices(db, status, device_type, node_id, location, page, per_page)
    return IoTDeviceListResponse(**result)


def register_iot_device(
    db: Session,
    node_id: str,
    device_type: str,
    location: str,
    description: str | None,
    actor_id: uuid.UUID,
    ip_address: str | None,
) -> IoTDeviceCreateResponse:
    """Register a new IoT device and return its one-time plain-text API key."""
    if admin_service.node_id_exists(db, node_id):
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="A device with this node_id already exists")
    device, plain_key = admin_service.register_iot_device(db, node_id, device_type, location, description, actor_id, ip_address)
    db.commit()
    return IoTDeviceCreateResponse(**admin_service._device_to_response_dict(device), api_key=plain_key)


def get_iot_device(db: Session, device_id: uuid.UUID) -> IoTDeviceDetailResponse:
    """Return device detail with the last 10 telemetry entries."""
    device = admin_service.get_iot_device_by_id(db, device_id)
    _raise_if_not_found(device, "Device not found")
    telemetry = admin_service.get_device_telemetry(db, device_id, 10)
    return IoTDeviceDetailResponse(
        **admin_service._device_to_response_dict(device),
        recent_telemetry=telemetry,
    )


def update_iot_device(
    db: Session,
    device_id: uuid.UUID,
    location: str | None,
    description: str | None,
    assigned_student_id: str | None = None,
) -> IoTDeviceResponse:
    """Update a device's location, description, and/or assigned student."""
    device = admin_service.get_iot_device_by_id(db, device_id)
    _raise_if_not_found(device, "Device not found")
    if device.status == "decommissioned":
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Cannot update a decommissioned device")
    admin_service.update_iot_device_fields(db, device, location, description, assigned_student_id)
    db.commit()
    db.refresh(device)
    student_name: str | None = None
    if device.assigned_student_id:
        student = db.query(User).filter(User.user_id == device.assigned_student_id).first()
        student_name = student.full_name if student else None
    return IoTDeviceResponse(**admin_service._device_to_response_dict(device, student_name))


def decommission_iot_device(
    db: Session,
    device_id: uuid.UUID,
    actor_id: uuid.UUID,
    ip_address: str | None,
) -> None:
    """Soft-delete a device by marking it as decommissioned."""
    device = admin_service.get_iot_device_by_id(db, device_id)
    _raise_if_not_found(device, "Device not found")
    admin_service.decommission_device(db, device, actor_id, ip_address)
    db.commit()


def regenerate_device_api_key(
    db: Session,
    device_id: uuid.UUID,
    actor_id: uuid.UUID,
    ip_address: str | None,
) -> ApiKeyRegenerateResponse:
    """Invalidate the current API key and issue a new one."""
    device = admin_service.get_iot_device_by_id(db, device_id)
    _raise_if_not_found(device, "Device not found")
    if device.status == "decommissioned":
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Cannot regenerate key for a decommissioned device")
    plain_key = admin_service.regenerate_device_key(db, device, actor_id, ip_address)
    db.commit()
    return ApiKeyRegenerateResponse(
        device_id=device.device_id,
        node_id=device.node_id or str(device.device_id)[:8],
        api_key=plain_key,
    )


def get_iot_health(db: Session) -> IoTHealthResponse:
    """Return overall IoT network health KPIs."""
    data = admin_service.get_iot_network_health(db)
    return IoTHealthResponse(**data)


def get_device_telemetry(db: Session, device_id: uuid.UUID, limit: int) -> list[dict]:
    """Return recent telemetry entries for a specific device."""
    device = admin_service.get_iot_device_by_id(db, device_id)
    _raise_if_not_found(device, "Device not found")
    return admin_service.get_device_telemetry(db, device_id, limit)


def get_iot_alert_timeline(
    db: Session,
    device_id: uuid.UUID | None,
    severity: str | None,
    hours: int,
    limit: int,
) -> IoTAlertTimelineResponse:
    """Return filtered timeline for IoT alerts and auto-light transitions."""
    rows, total = admin_service.get_iot_alert_timeline(db, device_id, severity, hours, limit)
    return IoTAlertTimelineResponse(
        alerts=[IoTAlertEntry(**row) for row in rows],
        total_count=total,
    )


def override_device_status(
    db: Session,
    device_id: uuid.UUID,
    new_status: str,
    actor_id: uuid.UUID,
    ip_address: str | None,
) -> IoTDeviceResponse:
    """Manually override a device's operational status."""
    if new_status not in _VALID_STATUSES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"status must be one of {sorted(_VALID_STATUSES)}",
        )
    device = admin_service.get_iot_device_by_id(db, device_id)
    _raise_if_not_found(device, "Device not found")
    admin_service.update_iot_device_status(db, device, new_status, actor_id, ip_address)
    db.commit()
    return IoTDeviceResponse(**admin_service._device_to_response_dict(device))


def get_audit_logs(
    db: Session,
    event_type: str | None,
    user_search: str | None,
    date_from,
    date_to,
    page: int,
    per_page: int,
) -> AuditLogListResponse:
    """Return a paginated, filtered audit log list."""
    logs, total = admin_service.get_audit_logs_filtered(
        db, event_type, user_search, date_from, date_to, page, per_page
    )
    return AuditLogListResponse(
        logs=[AuditLogResponse(**entry) for entry in logs],
        total_count=total,
        page=page,
        per_page=per_page,
    )


def get_system_changes(db: Session) -> list[SystemChangeEntry]:
    """Return the last 5 major system-level change events."""
    entries = admin_service.get_system_level_changes(db)
    return [SystemChangeEntry(**e) for e in entries]


def get_audit_logs_for_export(
    db: Session,
    event_type: str | None,
    user_search: str | None,
    date_from,
    date_to,
    actor_id: uuid.UUID,
    ip_address: str | None,
) -> list[dict]:
    """Return all matching audit log rows for CSV export and write an export audit entry."""
    rows = admin_service.get_all_audit_logs_for_export(
        db, event_type, user_search, date_from, date_to
    )
    admin_service.log_audit_event(
        db, actor_id, "AUDIT_LOG_EXPORTED",
        f"Admin exported audit logs ({len(rows)} records)",
        ip_address=ip_address,
    )
    db.commit()
    return rows


def get_security_overview(db: Session) -> SecurityOverviewResponse:
    """Return the full security dashboard payload."""
    data = admin_service.get_security_overview(db)
    return SecurityOverviewResponse(**data)


def get_security_events(db: Session) -> list[dict]:
    """Return recent security-related audit events."""
    return admin_service.get_security_events(db)


def run_integrity_audit(
    db: Session,
    actor_id: uuid.UUID,
    ip_address: str | None,
) -> IntegrityAuditResponse:
    """Compute SHA-256 hash over all curriculum metadata and persist the result."""
    result = admin_service.run_integrity_audit(db, actor_id, ip_address)
    db.commit()
    return IntegrityAuditResponse(**result)


def get_settings(db: Session) -> AdminSettingsResponse:
    """Return current admin system settings."""
    data = admin_service.get_admin_settings(db)
    return AdminSettingsResponse(**data)


def update_settings(
    db: Session,
    body: AdminSettingsUpdateRequest,
    actor_id: uuid.UUID,
    ip_address: str | None,
) -> AdminSettingsResponse:
    """Persist updated settings and return the new state."""
    updates = body.model_dump(exclude_none=True)
    data = admin_service.update_admin_settings(db, updates, actor_id, ip_address)
    db.commit()
    return AdminSettingsResponse(**data)


def list_notifications(
    db: Session,
    admin_id: uuid.UUID,
    type_filter: str | None,
    is_read: bool | None,
    page: int,
    per_page: int,
) -> PaginatedResponse[NotificationResponse]:
    """Return paginated notifications for the admin with optional filters."""
    prefs = admin_service.get_notification_prefs(db)
    if not prefs.get("push_all", True):
        return PaginatedResponse(
            items=[],
            total=0,
            page=page,
            per_page=per_page,
            total_pages=0,
        )
    items, total, _ = notification_service.get_notifications(
        db,
        admin_id,
        type_filter=type_filter,
        is_read=is_read,
        page=page,
        per_page=per_page,
    )
    total_pages = (total + per_page - 1) // per_page if per_page > 0 else 0
    return PaginatedResponse(
        items=[NotificationResponse.model_validate(n) for n in items],
        total=total,
        page=page,
        per_page=per_page,
        total_pages=total_pages,
    )


def get_unread_notification_count(
    db: Session,
    admin_id: uuid.UUID,
) -> UnreadCountResponse:
    """Return unread notification count for the current admin."""
    prefs = admin_service.get_notification_prefs(db)
    if not prefs.get("push_all", True):
        return UnreadCountResponse(count=0)
    return UnreadCountResponse(count=notification_service.get_unread_count(db, admin_id))


def mark_notification_read(
    db: Session,
    admin_id: uuid.UUID,
    notification_id: uuid.UUID,
) -> NotificationResponse:
    """Mark one admin notification as read."""
    notification = notification_service.mark_as_read(db, admin_id, notification_id)
    if not notification:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Notification not found",
        )
    return NotificationResponse.model_validate(notification)


def mark_all_notifications_read(
    db: Session,
    admin_id: uuid.UUID,
) -> MessageResponse:
    """Mark all admin notifications as read."""
    count = notification_service.mark_all_as_read(db, admin_id)
    return MessageResponse(message=f"Marked {count} notifications as read")


def trigger_manual_backup(
    db: Session,
    actor_id: uuid.UUID,
    ip_address: str | None,
) -> MessageResponse:
    """Trigger backup snapshot generation and persist backup metadata."""
    result = admin_service.trigger_manual_backup(db, actor_id, ip_address)
    db.commit()
    return MessageResponse(
        message=f"Manual backup completed at {result['timestamp']} ({result['file']})"
    )


def test_integration_connection(
    db: Session,
    body: IntegrationTestRequest,
) -> IntegrationTestResponse:
    """Run connectivity test for requested integration target."""
    result = admin_service.test_integration_connection(
        db,
        target=body.target,
        overrides=body.model_dump(exclude_none=True),
    )
    return IntegrationTestResponse(**result)
