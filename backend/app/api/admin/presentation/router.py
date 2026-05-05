"""Presentation layer for the admin bounded context.

Route handlers declare HTTP contracts and immediately delegate to the
application-layer use cases. No business logic occurs here.
"""
import uuid
from typing import Optional

import csv
import io
from datetime import datetime

from fastapi import APIRouter, BackgroundTasks, Depends, File, Form, HTTPException, Request, UploadFile, status
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session

from app.api.admin.infrastructure.dependencies import require_role
from app.api.admin.application import service
from app.core.database import get_db
from app.db.models.user import User
from app.schemas.admin import (
    AdminDashboardResponse,
    AdminUserCreateRequest,
    AdminUserCreateResponse,
    AdminUserListResponse,
    AdminUserResponse,
    AdminUserUpdateRequest,
    AssignInstructorRequest,
    BulkEnrollmentResponse,
    BulkImportResponse,
    BulkUserIdsRequest,
    CurriculumDocDetailResponse,
    CurriculumDocListResponse,
    EnrollmentBulkCreateRequest,
    EnrollmentCreateRequest,
    EnrollmentListResponse,
    EnrollmentResponse,
    GradeCreateRequest,
    GradeNamespaceGroup,
    GradeResponse,
    GradeUpdateRequest,
    AdminSettingsResponse,
    AdminSettingsUpdateRequest,
    IntegrationTestRequest,
    IntegrationTestResponse,
    ApiKeyRegenerateResponse,
    AuditLogListResponse,
    DeviceStatusUpdateRequest,
    IngestionJobListResponse,
    IngestionJobResponse,
    IntegrityAuditResponse,
    IoTDeviceCreateRequest,
    IoTDeviceCreateResponse,
    IoTDeviceDetailResponse,
    IoTDeviceListResponse,
    IoTDeviceResponse,
    IoTAlertTimelineResponse,
    IoTDeviceUpdateRequest,
    IoTHealthResponse,
    NamespaceCreateRequest,
    ReindexRequest,
    RoleChangeRequest,
    SecurityOverviewResponse,
    SubjectCreateRequest,
    SubjectResponse,
    SubjectUpdateRequest,
    VectorStoreStatsResponse,
)
from app.schemas.common import PaginatedResponse
from app.schemas.notification import NotificationResponse, UnreadCountResponse
from app.schemas.user import MessageResponse
from app.shared.source_enum import UserRole

router = APIRouter(prefix="/api/admin", tags=["Admin"])


def _ip(request: Request) -> str | None:
    """Extract the client IP address from the request."""
    forwarded = request.headers.get("X-Forwarded-For")
    return forwarded.split(",")[0].strip() if forwarded else request.client.host


@router.get("/dashboard", response_model=AdminDashboardResponse)
def get_dashboard(
    current_user: User = Depends(require_role([UserRole.ADMIN])),
    db: Session = Depends(get_db),
):
    """Return the aggregated admin control panel overview."""
    return service.get_dashboard(db)


@router.get("/users", response_model=AdminUserListResponse)
def list_users(
    role: Optional[UserRole] = None,
    is_active: Optional[bool] = None,
    search: Optional[str] = None,
    grade_id: Optional[int] = None,
    page: int = 1,
    per_page: int = 20,
    current_user: User = Depends(require_role([UserRole.ADMIN])),
    db: Session = Depends(get_db),
):
    """Return a paginated, filtered list of all platform users."""
    return service.list_users(db, role, is_active, search, grade_id, page, per_page)


@router.get("/users/pending-enrollments", response_model=list[EnrollmentResponse])
def get_pending_enrollments(
    current_user: User = Depends(require_role([UserRole.ADMIN])),
    db: Session = Depends(get_db),
):
    """Return all enrollments awaiting admin approval."""
    return service.get_pending_enrollments(db)


@router.patch("/users/enrollments/{enrollment_id}/approve", response_model=EnrollmentResponse)
def approve_enrollment(
    enrollment_id: uuid.UUID,
    request: Request,
    current_user: User = Depends(require_role([UserRole.ADMIN])),
    db: Session = Depends(get_db),
):
    """Approve a pending enrollment by activating it."""
    return service.approve_enrollment(db, enrollment_id, current_user.user_id, _ip(request))


@router.post("/users", response_model=AdminUserCreateResponse, status_code=status.HTTP_201_CREATED)
def create_user(
    body: AdminUserCreateRequest,
    background_tasks: BackgroundTasks,
    request: Request,
    current_user: User = Depends(require_role([UserRole.ADMIN])),
    db: Session = Depends(get_db),
):
    """Create a new platform user and return the one-time generated password."""
    return service.create_user(
        db,
        email=body.email,
        full_name=body.full_name,
        role=body.role,
        raw_password=body.password,
        actor_id=current_user.user_id,
        ip_address=_ip(request),
        grade_id=body.grade_id,
        background_tasks=background_tasks,
    )


@router.post("/users/bulk-import", response_model=BulkImportResponse)
def bulk_import_users(
    role: UserRole,
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    request: Request = None,
    current_user: User = Depends(require_role([UserRole.ADMIN])),
    db: Session = Depends(get_db),
):
    """Accept a CSV file (columns: full_name, email) and create users in bulk."""
    raw = file.file.read().decode("utf-8", errors="replace")
    reader = csv.DictReader(io.StringIO(raw))
    missing = {c for c in ("full_name", "email") if c not in (reader.fieldnames or [])}
    if missing:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
            detail=f"CSV missing required columns: {', '.join(sorted(missing))}",
        )
    rows = list(reader)
    if not rows:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="CSV file has no data rows")
    return service.bulk_import_users(db, rows, role, current_user.user_id, _ip(request), background_tasks)


@router.post("/users/bulk-suspend")
def bulk_suspend(
    body: BulkUserIdsRequest,
    current_user: User = Depends(require_role([UserRole.ADMIN])),
    db: Session = Depends(get_db),
):
    """Suspend multiple user accounts in a single operation."""
    return service.bulk_suspend_users(db, body.user_ids, current_user.user_id)


@router.post("/users/bulk-delete")
def bulk_delete(
    body: BulkUserIdsRequest,
    current_user: User = Depends(require_role([UserRole.ADMIN])),
    db: Session = Depends(get_db),
):
    """Soft-delete multiple user accounts in a single operation."""
    return service.bulk_delete_users(db, body.user_ids, current_user.user_id)


@router.get("/users/{user_id}", response_model=AdminUserResponse)
def get_user(
    user_id: uuid.UUID,
    current_user: User = Depends(require_role([UserRole.ADMIN])),
    db: Session = Depends(get_db),
):
    """Return full profile detail for a single user."""
    return service.get_user(db, user_id)


@router.patch("/users/{user_id}", response_model=AdminUserResponse)
def update_user(
    user_id: uuid.UUID,
    body: AdminUserUpdateRequest,
    request: Request,
    current_user: User = Depends(require_role([UserRole.ADMIN])),
    db: Session = Depends(get_db),
):
    """Partially update a user's profile fields."""
    return service.update_user(
        db,
        user_id=user_id,
        full_name=body.full_name,
        is_active=body.is_active,
        profile_image_url=body.profile_image_url,
        grade_id=body.grade_id,
        actor_id=current_user.user_id,
        ip_address=_ip(request),
    )


@router.patch("/users/{user_id}/suspend", response_model=AdminUserResponse)
def suspend_user(
    user_id: uuid.UUID,
    request: Request,
    current_user: User = Depends(require_role([UserRole.ADMIN])),
    db: Session = Depends(get_db),
):
    """Suspend a user account."""
    return service.suspend_user(db, user_id, current_user.user_id, _ip(request))


@router.patch("/users/{user_id}/reactivate", response_model=AdminUserResponse)
def reactivate_user(
    user_id: uuid.UUID,
    request: Request,
    current_user: User = Depends(require_role([UserRole.ADMIN])),
    db: Session = Depends(get_db),
):
    """Reactivate a suspended user account."""
    return service.reactivate_user(db, user_id, current_user.user_id, _ip(request))


@router.delete("/users/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_user(
    user_id: uuid.UUID,
    request: Request,
    current_user: User = Depends(require_role([UserRole.ADMIN])),
    db: Session = Depends(get_db),
):
    """Soft-delete a user account."""
    service.delete_user(db, user_id, current_user.user_id, _ip(request))


@router.post("/users/{user_id}/reset-password")
def reset_password(
    user_id: uuid.UUID,
    background_tasks: BackgroundTasks,
    request: Request,
    current_user: User = Depends(require_role([UserRole.ADMIN])),
    db: Session = Depends(get_db),
):
    """Force-reset a user's password and email the new credentials."""
    return service.force_reset_password(db, user_id, current_user.user_id, _ip(request), background_tasks)


@router.patch("/users/{user_id}/role", response_model=AdminUserResponse)
def change_role(
    user_id: uuid.UUID,
    body: RoleChangeRequest,
    request: Request,
    current_user: User = Depends(require_role([UserRole.ADMIN])),
    db: Session = Depends(get_db),
):
    """Change a user's platform role with optional instructor subject assignment."""
    return service.change_role(
        db,
        user_id=user_id,
        new_role=body.role,
        subject_ids=body.subject_ids,
        actor_id=current_user.user_id,
        ip_address=_ip(request),
    )


@router.get("/grades", response_model=list[GradeResponse])
def list_grades(
    current_user: User = Depends(require_role([UserRole.ADMIN])),
    db: Session = Depends(get_db),
):
    """Return all grades sorted by level with subject and student counts."""
    return service.list_grades(db)


@router.post("/grades", response_model=GradeResponse, status_code=status.HTTP_201_CREATED)
def create_grade(
    body: GradeCreateRequest,
    request: Request,
    current_user: User = Depends(require_role([UserRole.ADMIN])),
    db: Session = Depends(get_db),
):
    """Create a new academic grade."""
    return service.create_grade(db, body.grade_name, body.grade_level, body.description, current_user.user_id, _ip(request))


@router.patch("/grades/{grade_id}", response_model=GradeResponse)
def update_grade(
    grade_id: int,
    body: GradeUpdateRequest,
    request: Request,
    current_user: User = Depends(require_role([UserRole.ADMIN])),
    db: Session = Depends(get_db),
):
    """Update a grade's name or description."""
    return service.update_grade(db, grade_id, body.grade_name, body.description, current_user.user_id, _ip(request))


@router.delete("/grades/{grade_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_grade(
    grade_id: int,
    request: Request,
    current_user: User = Depends(require_role([UserRole.ADMIN])),
    db: Session = Depends(get_db),
):
    """Delete a grade only when no subjects or enrollments are linked."""
    service.delete_grade(db, grade_id, current_user.user_id, _ip(request))


@router.get("/subjects", response_model=list[SubjectResponse])
def list_subjects(
    grade_id: Optional[int] = None,
    search: Optional[str] = None,
    current_user: User = Depends(require_role([UserRole.ADMIN])),
    db: Session = Depends(get_db),
):
    """Return subjects optionally filtered by grade or name search."""
    return service.list_subjects(db, grade_id, search)


@router.post("/subjects", response_model=SubjectResponse, status_code=status.HTTP_201_CREATED)
def create_subject(
    body: SubjectCreateRequest,
    request: Request,
    current_user: User = Depends(require_role([UserRole.ADMIN])),
    db: Session = Depends(get_db),
):
    """Create a new subject with an auto-generated ChromaDB namespace."""
    return service.create_subject(
        db, body.name, body.subject_code, body.description, body.grade_id,
        body.instructor_id, current_user.user_id, _ip(request),
    )


@router.patch("/subjects/{subject_id}", response_model=SubjectResponse)
def update_subject(
    subject_id: int,
    body: SubjectUpdateRequest,
    request: Request,
    current_user: User = Depends(require_role([UserRole.ADMIN])),
    db: Session = Depends(get_db),
):
    """Update a subject's name or description."""
    return service.update_subject(db, subject_id, body.name, body.description, current_user.user_id, _ip(request))


@router.delete("/subjects/{subject_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_subject(
    subject_id: int,
    request: Request,
    current_user: User = Depends(require_role([UserRole.ADMIN])),
    db: Session = Depends(get_db),
):
    """Delete a subject only when no active enrollments exist."""
    service.delete_subject(db, subject_id, current_user.user_id, _ip(request))


@router.post("/subjects/{subject_id}/assign-instructor", response_model=SubjectResponse)
def assign_instructor(
    subject_id: int,
    body: AssignInstructorRequest,
    request: Request,
    current_user: User = Depends(require_role([UserRole.ADMIN])),
    db: Session = Depends(get_db),
):
    """Assign an instructor to a subject."""
    return service.assign_instructor(db, subject_id, body.instructor_id, current_user.user_id, _ip(request))


@router.get("/enrollments", response_model=EnrollmentListResponse)
def list_enrollments(
    student_id: Optional[uuid.UUID] = None,
    subject_id: Optional[int] = None,
    grade_id: Optional[int] = None,
    enrollment_status: Optional[str] = None,
    page: int = 1,
    per_page: int = 20,
    current_user: User = Depends(require_role([UserRole.ADMIN])),
    db: Session = Depends(get_db),
):
    """Return a paginated, filtered enrollment list."""
    return service.list_enrollments(db, student_id, subject_id, grade_id, enrollment_status, page, per_page)


@router.post("/enrollments/bulk", response_model=BulkEnrollmentResponse)
def bulk_enroll(
    body: EnrollmentBulkCreateRequest,
    request: Request,
    current_user: User = Depends(require_role([UserRole.ADMIN])),
    db: Session = Depends(get_db),
):
    """Bulk-enroll multiple students into one subject."""
    return service.bulk_enroll(db, body.student_ids, body.subject_id, current_user.user_id, _ip(request))


@router.post("/enrollments", response_model=EnrollmentResponse, status_code=status.HTTP_201_CREATED)
def create_enrollment(
    body: EnrollmentCreateRequest,
    request: Request,
    current_user: User = Depends(require_role([UserRole.ADMIN])),
    db: Session = Depends(get_db),
):
    """Create a single student enrollment."""
    return service.create_enrollment(db, body.student_id, body.subject_id, current_user.user_id, _ip(request))


@router.delete("/enrollments/{enrollment_id}", status_code=status.HTTP_204_NO_CONTENT)
def remove_enrollment(
    enrollment_id: uuid.UUID,
    request: Request,
    current_user: User = Depends(require_role([UserRole.ADMIN])),
    db: Session = Depends(get_db),
):
    """Soft-delete an enrollment when no submissions exist."""
    service.remove_enrollment(db, enrollment_id, current_user.user_id, _ip(request))


@router.post("/ingestion/upload", response_model=IngestionJobResponse, status_code=status.HTTP_201_CREATED)
async def upload_curriculum(
    request: Request,
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    subject_id: int = Form(...),
    chunk_size: int | None = Form(None),
    doc_type: str = Form(default="curriculum_pdf"),
    current_user: User = Depends(require_role([UserRole.ADMIN])),
    db: Session = Depends(get_db),
):
    """Upload a curriculum PDF or DOCX and queue it for RAG indexing."""
    file_bytes = await file.read()
    return service.upload_curriculum(
        db,
        background_tasks,
        file_bytes,
        file.filename,
        subject_id,
        current_user.user_id,
        doc_type,
        _ip(request),
        chunk_size=chunk_size,
    )


@router.get("/ingestion/jobs", response_model=IngestionJobListResponse)
def list_ingestion_jobs(
    job_status: Optional[str] = None,
    grade_id: Optional[int] = None,
    subject_id: Optional[int] = None,
    page: int = 1,
    per_page: int = 20,
    current_user: User = Depends(require_role([UserRole.ADMIN])),
    db: Session = Depends(get_db),
):
    """Return a paginated list of curriculum ingestion jobs."""
    return service.list_ingestion_jobs(db, job_status, grade_id, subject_id, page, per_page)


@router.get("/ingestion/jobs/{job_id}", response_model=IngestionJobResponse)
def get_ingestion_job(
    job_id: uuid.UUID,
    current_user: User = Depends(require_role([UserRole.ADMIN])),
    db: Session = Depends(get_db),
):
    """Return a single ingestion job by ID."""
    return service.get_ingestion_job(db, job_id)


@router.delete("/ingestion/jobs/{job_id}", status_code=status.HTTP_204_NO_CONTENT)
def cancel_ingestion_job(
    job_id: uuid.UUID,
    request: Request,
    current_user: User = Depends(require_role([UserRole.ADMIN])),
    db: Session = Depends(get_db),
):
    """Cancel a queued ingestion job or remove a completed one."""
    service.cancel_ingestion_job(db, job_id, current_user.user_id, _ip(request))


@router.get("/vector-store/namespaces", response_model=list[GradeNamespaceGroup])
def get_vector_namespaces(
    current_user: User = Depends(require_role([UserRole.ADMIN])),
    db: Session = Depends(get_db),
):
    """Return ChromaDB namespaces grouped by grade."""
    return service.get_vector_namespaces(db)


@router.get("/vector-store/stats", response_model=VectorStoreStatsResponse)
def get_vector_stats(
    current_user: User = Depends(require_role([UserRole.ADMIN])),
    db: Session = Depends(get_db),
):
    """Return overall vector store statistics."""
    return service.get_vector_stats(db)


@router.post("/vector-store/namespaces", status_code=status.HTTP_201_CREATED)
def create_namespace(
    body: NamespaceCreateRequest,
    request: Request,
    current_user: User = Depends(require_role([UserRole.ADMIN])),
    db: Session = Depends(get_db),
):
    """Register a ChromaDB namespace for a subject."""
    return service.create_namespace(db, body.grade_id, body.subject_id, current_user.user_id, _ip(request))


@router.post("/vector-store/reindex")
def reindex_namespace(
    body: ReindexRequest,
    request: Request,
    current_user: User = Depends(require_role([UserRole.ADMIN])),
    db: Session = Depends(get_db),
):
    """Re-queue documents for re-embedding."""
    return service.reindex_documents(db, body.grade_id, body.subject_id, current_user.user_id, _ip(request))


@router.get("/vector-store/export-snapshot")
def export_snapshot(
    current_user: User = Depends(require_role([UserRole.ADMIN])),
    db: Session = Depends(get_db),
):
    """Return a JSON metadata snapshot of all namespaces and document counts."""
    return service.get_export_snapshot(db)


@router.get("/curriculum", response_model=CurriculumDocListResponse)
def list_curriculum_docs(
    grade_id: Optional[int] = None,
    subject_id: Optional[int] = None,
    doc_type: Optional[str] = None,
    doc_status: Optional[str] = None,
    search: Optional[str] = None,
    page: int = 1,
    per_page: int = 20,
    current_user: User = Depends(require_role([UserRole.ADMIN])),
    db: Session = Depends(get_db),
):
    """Return a paginated curriculum document library."""
    return service.list_curriculum_docs(db, grade_id, subject_id, doc_type, doc_status, search, page, per_page)


@router.get("/curriculum/{doc_id}", response_model=CurriculumDocDetailResponse)
def get_curriculum_doc(
    doc_id: uuid.UUID,
    current_user: User = Depends(require_role([UserRole.ADMIN])),
    db: Session = Depends(get_db),
):
    """Return full detail for a single curriculum document."""
    return service.get_curriculum_doc(db, doc_id)


@router.delete("/curriculum/{doc_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_curriculum_doc(
    doc_id: uuid.UUID,
    request: Request,
    current_user: User = Depends(require_role([UserRole.ADMIN])),
    db: Session = Depends(get_db),
):
    """Delete a curriculum document from disk and database."""
    service.delete_curriculum_doc(db, doc_id, current_user.user_id, _ip(request))


@router.post("/curriculum/{doc_id}/requeue", response_model=IngestionJobResponse)
def requeue_curriculum_doc(
    doc_id: uuid.UUID,
    request: Request,
    background_tasks: BackgroundTasks,
    current_user: User = Depends(require_role([UserRole.ADMIN])),
    db: Session = Depends(get_db),
):
    """Re-queue a failed or completed document for re-embedding."""
    return service.requeue_curriculum_doc(db, background_tasks, doc_id, current_user.user_id, _ip(request))


@router.get("/iot/devices", response_model=IoTDeviceListResponse)
def list_iot_devices(
    status: Optional[str] = None,
    device_type: Optional[str] = None,
    node_id: Optional[str] = None,
    location: Optional[str] = None,
    page: int = 1,
    per_page: int = 20,
    current_user: User = Depends(require_role([UserRole.ADMIN])),
    db: Session = Depends(get_db),
):
    """List all IoT devices with optional filters and a network summary."""
    return service.list_iot_devices(db, status, device_type, node_id, location, page, per_page)


@router.post("/iot/devices", response_model=IoTDeviceCreateResponse, status_code=status.HTTP_201_CREATED)
def register_device(
    body: IoTDeviceCreateRequest,
    request: Request,
    current_user: User = Depends(require_role([UserRole.ADMIN])),
    db: Session = Depends(get_db),
):
    """Register a new device. The plain API key is shown only once in the response."""
    return service.register_iot_device(
        db, body.node_id, body.device_type, body.location, body.description,
        current_user.user_id, _ip(request),
    )


@router.get("/iot/health", response_model=IoTHealthResponse)
def get_iot_health(
    current_user: User = Depends(require_role([UserRole.ADMIN])),
    db: Session = Depends(get_db),
):
    """Return overall IoT network health KPIs."""
    return service.get_iot_health(db)


@router.get("/iot/devices/{device_id}", response_model=IoTDeviceDetailResponse)
def get_iot_device(
    device_id: uuid.UUID,
    current_user: User = Depends(require_role([UserRole.ADMIN])),
    db: Session = Depends(get_db),
):
    """Return device detail with the last 10 telemetry entries."""
    return service.get_iot_device(db, device_id)


@router.patch("/iot/devices/{device_id}", response_model=IoTDeviceResponse)
def update_iot_device(
    device_id: uuid.UUID,
    body: IoTDeviceUpdateRequest,
    current_user: User = Depends(require_role([UserRole.ADMIN])),
    db: Session = Depends(get_db),
):
    """Update a device's location, description, or assigned student."""
    return service.update_iot_device(db, device_id, body.location, body.description, body.assigned_student_id)


@router.delete("/iot/devices/{device_id}", status_code=status.HTTP_204_NO_CONTENT)
def decommission_device(
    device_id: uuid.UUID,
    request: Request,
    current_user: User = Depends(require_role([UserRole.ADMIN])),
    db: Session = Depends(get_db),
):
    """Soft-delete a device by setting its status to decommissioned."""
    service.decommission_iot_device(db, device_id, current_user.user_id, _ip(request))


@router.post("/iot/devices/{device_id}/regenerate-key", response_model=ApiKeyRegenerateResponse)
def regenerate_api_key(
    device_id: uuid.UUID,
    request: Request,
    current_user: User = Depends(require_role([UserRole.ADMIN])),
    db: Session = Depends(get_db),
):
    """Invalidate the old API key and return the new plain-text key (shown once)."""
    return service.regenerate_device_api_key(db, device_id, current_user.user_id, _ip(request))


@router.get("/iot/devices/{device_id}/telemetry")
def get_device_telemetry(
    device_id: uuid.UUID,
    limit: int = 50,
    current_user: User = Depends(require_role([UserRole.ADMIN])),
    db: Session = Depends(get_db),
):
    """Return the last N telemetry entries for a specific device."""
    return service.get_device_telemetry(db, device_id, limit)


@router.get("/iot/alerts", response_model=IoTAlertTimelineResponse)
def get_iot_alerts(
    device_id: Optional[uuid.UUID] = None,
    severity: Optional[str] = "all",
    hours: int = 24,
    limit: int = 50,
    current_user: User = Depends(require_role([UserRole.ADMIN])),
    db: Session = Depends(get_db),
):
    """Return filtered IoT alert timeline across devices."""
    return service.get_iot_alert_timeline(db, device_id, severity, hours, limit)


@router.patch("/iot/devices/{device_id}/status", response_model=IoTDeviceResponse)
def update_device_status(
    device_id: uuid.UUID,
    body: DeviceStatusUpdateRequest,
    request: Request,
    current_user: User = Depends(require_role([UserRole.ADMIN])),
    db: Session = Depends(get_db),
):
    """Manually override a device's operational status."""
    return service.override_device_status(db, device_id, body.status, current_user.user_id, _ip(request))


@router.get("/audit-logs", response_model=AuditLogListResponse)
def get_audit_logs(
    event_type: Optional[str] = None,
    user_search: Optional[str] = None,
    date_from: Optional[datetime] = None,
    date_to: Optional[datetime] = None,
    page: int = 1,
    per_page: int = 20,
    current_user: User = Depends(require_role([UserRole.ADMIN])),
    db: Session = Depends(get_db),
):
    """Return paginated audit log entries with optional filters."""
    return service.get_audit_logs(db, event_type, user_search, date_from, date_to, page, per_page)


@router.get("/audit-logs/system-changes")
def get_system_changes(
    current_user: User = Depends(require_role([UserRole.ADMIN])),
    db: Session = Depends(get_db),
):
    """Return the last 5 major system-level events for summary cards."""
    return service.get_system_changes(db)


@router.get("/audit-logs/export")
def export_audit_logs(
    event_type: Optional[str] = None,
    user_search: Optional[str] = None,
    date_from: Optional[datetime] = None,
    date_to: Optional[datetime] = None,
    request: Request = None,
    current_user: User = Depends(require_role([UserRole.ADMIN])),
    db: Session = Depends(get_db),
):
    """Stream all matching audit logs as a CSV download."""
    rows = service.get_audit_logs_for_export(
        db, event_type, user_search, date_from, date_to, current_user.user_id, _ip(request)
    )
    output = io.StringIO()
    writer = csv.DictWriter(
        output,
        fieldnames=["log_id", "timestamp", "user_email", "event_type", "description", "ip_address", "status"],
    )
    writer.writeheader()
    for row in rows:
        writer.writerow({k: row.get(k, "") for k in writer.fieldnames})
    output.seek(0)
    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=audit_logs.csv"},
    )


@router.get("/security/overview", response_model=SecurityOverviewResponse)
def get_security_overview(
    current_user: User = Depends(require_role([UserRole.ADMIN])),
    db: Session = Depends(get_db),
):
    """Return full security dashboard data including JWT/RBAC roles, 2FA, and score."""
    return service.get_security_overview(db)


@router.get("/security/events")
def get_security_events(
    current_user: User = Depends(require_role([UserRole.ADMIN])),
    db: Session = Depends(get_db),
):
    """Return recent 20 security-related events."""
    return service.get_security_events(db)


@router.post("/security/run-audit", response_model=IntegrityAuditResponse)
def run_integrity_audit(
    request: Request,
    current_user: User = Depends(require_role([UserRole.ADMIN])),
    db: Session = Depends(get_db),
):
    """Compute SHA-256 hash over all curriculum metadata and store the result."""
    return service.run_integrity_audit(db, current_user.user_id, _ip(request))


@router.get("/settings", response_model=AdminSettingsResponse)
def get_settings(
    current_user: User = Depends(require_role([UserRole.ADMIN])),
    db: Session = Depends(get_db),
):
    """Retrieve current admin system settings."""
    return service.get_settings(db)


@router.patch("/settings", response_model=AdminSettingsResponse)
def update_settings(
    body: AdminSettingsUpdateRequest,
    request: Request,
    current_user: User = Depends(require_role([UserRole.ADMIN])),
    db: Session = Depends(get_db),
):
    """Update admin system settings."""
    return service.update_settings(db, body, current_user.user_id, _ip(request))


@router.post("/settings/test-connection", response_model=IntegrationTestResponse)
def test_settings_connection(
    body: IntegrationTestRequest,
    current_user: User = Depends(require_role([UserRole.ADMIN])),
    db: Session = Depends(get_db),
):
    """Test external integration connectivity from admin settings."""
    return service.test_integration_connection(db, body)


@router.post("/settings/backup/trigger", response_model=MessageResponse)
def trigger_backup(
    request: Request,
    current_user: User = Depends(require_role([UserRole.ADMIN])),
    db: Session = Depends(get_db),
):
    """Trigger a manual backup snapshot."""
    return service.trigger_manual_backup(db, current_user.user_id, _ip(request))


@router.get("/notifications", response_model=PaginatedResponse[NotificationResponse])
def list_notifications(
    type: Optional[str] = None,
    read: Optional[bool] = None,
    page: int = 1,
    per_page: int = 20,
    current_user: User = Depends(require_role([UserRole.ADMIN])),
    db: Session = Depends(get_db),
):
    """Return paginated notifications for the current admin."""
    return service.list_notifications(
        db,
        current_user.user_id,
        type_filter=type,
        is_read=read,
        page=page,
        per_page=per_page,
    )


@router.get("/notifications/unread-count", response_model=UnreadCountResponse)
def get_unread_notification_count(
    current_user: User = Depends(require_role([UserRole.ADMIN])),
    db: Session = Depends(get_db),
):
    """Return unread notification count for the current admin."""
    return service.get_unread_notification_count(db, current_user.user_id)


@router.patch("/notifications/{notification_id}/read", response_model=NotificationResponse)
def mark_notification_read(
    notification_id: uuid.UUID,
    current_user: User = Depends(require_role([UserRole.ADMIN])),
    db: Session = Depends(get_db),
):
    """Mark a single admin notification as read."""
    return service.mark_notification_read(db, current_user.user_id, notification_id)


@router.patch("/notifications/read-all", response_model=MessageResponse)
def mark_all_notifications_read(
    current_user: User = Depends(require_role([UserRole.ADMIN])),
    db: Session = Depends(get_db),
):
    """Mark all admin notifications as read."""
    return service.mark_all_notifications_read(db, current_user.user_id)
