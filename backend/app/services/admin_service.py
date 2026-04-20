"""Admin service — data access helpers for admin API use cases."""
import ipaddress
import os
import secrets
import string
import uuid
from pathlib import Path

from sqlalchemy import func, or_
from sqlalchemy.orm import Session

from app.core.security import hash_password
from app.db.models.assignment import Assignment
from app.db.models.audit_log import AuditLog
from app.db.models.curriculum_document import CurriculumDocument
from app.db.models.grade import Grade
from app.db.models.instructor_subject import InstructorSubject
from app.db.models.student_enrollment import StudentEnrollment
from app.db.models.subject import Subject
from app.db.models.submission import Submission
from app.db.models.user import User
from app.shared.source_enum import ActorRole, DocumentType, EmbeddingStatus, UserRole


def _sanitize_ip(ip: str | None) -> str | None:
    """Return the IP string only if it is a valid IPv4/IPv6 address, else None."""
    if not ip:
        return None
    try:
        ipaddress.ip_address(ip)
        return ip
    except ValueError:
        return None


def log_audit_event(
    db: Session,
    actor_id: uuid.UUID,
    action: str,
    description: str,
    resource_type: str | None = None,
    resource_id: str | None = None,
    ip_address: str | None = None,
) -> None:
    """Write a single audit log entry for any admin operation."""
    entry = AuditLog(
        actor_id=actor_id,
        actor_role=ActorRole.ADMIN,
        action=action,
        resource_type=resource_type,
        resource_id=resource_id,
        ip_address=_sanitize_ip(ip_address),
        extra_metadata={"description": description},
    )
    db.add(entry)
    db.flush()


def _count_users_by_role(db: Session, role: UserRole) -> int:
    """Return the number of active users with a given role."""
    return (
        db.query(func.count(User.user_id))
        .filter(User.role == role, User.is_active == True)
        .scalar()
        or 0
    )


def get_user_role_distribution(db: Session) -> dict:
    """Return counts of active users grouped by role."""
    return {
        "students": _count_users_by_role(db, UserRole.STUDENT),
        "instructors": _count_users_by_role(db, UserRole.INSTRUCTOR),
        "admins": _count_users_by_role(db, UserRole.ADMIN),
    }


def get_two_fa_compliance(db: Session) -> dict:
    """Return 2FA adoption stats across all active users."""
    total = (
        db.query(func.count(User.user_id))
        .filter(User.is_active == True)
        .scalar()
        or 0
    )
    protected = (
        db.query(func.count(User.user_id))
        .filter(User.is_active == True, User.totp_enabled == True)
        .scalar()
        or 0
    )
    compliance_pct = round((protected / total) * 100, 1) if total > 0 else 0.0
    return {
        "protected_users": protected,
        "total_users": total,
        "compliance_pct": compliance_pct,
    }


def get_platform_stats(db: Session) -> dict:
    """Return top-level platform stats used by the admin dashboard."""
    role_dist = get_user_role_distribution(db)
    two_fa = get_two_fa_compliance(db)
    return {
        "role_distribution": role_dist,
        "two_fa_compliance": two_fa,
        "total_active_users": sum(role_dist.values()),
    }


def count_active_admins(db: Session) -> int:
    """Return the number of currently active admin users."""
    return _count_users_by_role(db, UserRole.ADMIN)


def _generate_password(length: int = 12) -> str:
    """Return a cryptographically random password from letters, digits, and symbols."""
    alphabet = string.ascii_letters + string.digits + "!@#$"
    return "".join(secrets.choice(alphabet) for _ in range(length))


def _apply_user_filters(
    query,
    role: UserRole | None,
    is_active: bool | None,
    search: str | None,
    grade_id: int | None,
) -> object:
    """Apply optional role, active-state, search, and grade filters to a user query."""
    if role is not None:
        query = query.filter(User.role == role)
    if is_active is not None:
        query = query.filter(User.is_active == is_active)
    if search:
        query = query.filter(
            or_(
                User.email.ilike(f"%{search}%"),
                User.full_name.ilike(f"%{search}%"),
            )
        )
    if grade_id is not None:
        query = (
            query.join(StudentEnrollment, StudentEnrollment.student_id == User.user_id)
            .filter(StudentEnrollment.grade_id == grade_id)
            .distinct()
        )
    return query


def list_users(
    db: Session,
    role: UserRole | None = None,
    is_active: bool | None = None,
    search: str | None = None,
    grade_id: int | None = None,
    page: int = 1,
    per_page: int = 20,
) -> tuple[list[User], int]:
    """Return a paginated list of users with optional filters."""
    query = _apply_user_filters(db.query(User), role, is_active, search, grade_id)
    total = query.count()
    users = (
        query.order_by(User.created_at.desc())
        .offset((page - 1) * per_page)
        .limit(per_page)
        .all()
    )
    return users, total


def get_user_by_id(db: Session, user_id: uuid.UUID) -> User | None:
    """Return a single user record by primary key."""
    return db.query(User).filter(User.user_id == user_id).first()


def email_exists(db: Session, email: str) -> bool:
    """Return True when the email is already registered."""
    return db.query(User).filter(User.email == email).first() is not None


def create_user(
    db: Session,
    email: str,
    full_name: str,
    role: UserRole,
    raw_password: str | None = None,
) -> tuple[User, str]:
    """Create a new user and return the record plus the plain-text password."""
    password = raw_password or _generate_password()
    user = User(
        email=email,
        full_name=full_name,
        role=role,
        password_hash=hash_password(password),
        is_email_verified=True,
    )
    db.add(user)
    db.flush()
    return user, password


def update_user_fields(
    db: Session,
    user: User,
    full_name: str | None,
    is_active: bool | None,
    profile_image_url: str | None,
) -> User:
    """Apply partial field updates to a user record."""
    if full_name is not None:
        user.full_name = full_name
    if is_active is not None:
        user.is_active = is_active
    if profile_image_url is not None:
        user.profile_image_url = profile_image_url
    db.flush()
    return user


def set_active(db: Session, user: User, active: bool) -> User:
    """Set the is_active flag on a user and flush the session."""
    user.is_active = active
    db.flush()
    return user


def reset_password(db: Session, user: User) -> str:
    """Generate a new secure password, hash it, increment token_version, and return the plain-text value.

    Incrementing token_version invalidates all existing JWTs for this user.
    """
    password = _generate_password()
    user.password_hash = hash_password(password)
    user.token_version = (user.token_version or 0) + 1
    db.flush()
    return password


def _deactivate_instructor_subjects(db: Session, instructor_id: uuid.UUID) -> None:
    """Mark all subject assignments for an instructor as inactive."""
    db.query(InstructorSubject).filter(
        InstructorSubject.instructor_id == instructor_id
    ).update({"is_active": False})


def _upsert_instructor_subject(
    db: Session,
    instructor_id: uuid.UUID,
    subject_id: int,
    assigned_by: uuid.UUID,
) -> None:
    """Create or reactivate a single instructor-subject assignment."""
    existing = (
        db.query(InstructorSubject)
        .filter(
            InstructorSubject.instructor_id == instructor_id,
            InstructorSubject.subject_id == subject_id,
        )
        .first()
    )
    if existing:
        existing.is_active = True
        existing.assigned_by = assigned_by
    else:
        db.add(
            InstructorSubject(
                instructor_id=instructor_id,
                subject_id=subject_id,
                assigned_by=assigned_by,
            )
        )


def assign_instructor_subjects(
    db: Session,
    instructor_id: uuid.UUID,
    subject_ids: list[int],
    assigned_by: uuid.UUID,
) -> None:
    """Replace all active subject assignments for an instructor."""
    _deactivate_instructor_subjects(db, instructor_id)
    for sid in subject_ids:
        _upsert_instructor_subject(db, instructor_id, sid, assigned_by)
    db.flush()


def change_user_role(
    db: Session,
    user: User,
    new_role: UserRole,
    subject_ids: list[int] | None,
    assigned_by: uuid.UUID,
) -> User:
    """Change a user's role and manage related subject assignments."""
    if user.role == UserRole.INSTRUCTOR:
        _deactivate_instructor_subjects(db, user.user_id)
    user.role = new_role
    if new_role == UserRole.INSTRUCTOR and subject_ids:
        assign_instructor_subjects(db, user.user_id, subject_ids, assigned_by)
    db.flush()
    return user


def bulk_suspend(
    db: Session,
    user_ids: list[uuid.UUID],
    actor_id: uuid.UUID,
) -> tuple[int, list[uuid.UUID]]:
    """Suspend multiple users, skipping self and already-inactive accounts."""
    suspended, skipped = 0, []
    for uid in user_ids:
        user = get_user_by_id(db, uid)
        if not user or not user.is_active or uid == actor_id:
            skipped.append(uid)
            continue
        user.is_active = False
        log_audit_event(db, actor_id, "ACCOUNT_SUSPENDED", f"Bulk suspended {user.email}", "user", str(uid))
        suspended += 1
    db.flush()
    return suspended, skipped


def bulk_delete(
    db: Session,
    user_ids: list[uuid.UUID],
    actor_id: uuid.UUID,
) -> tuple[int, list[uuid.UUID]]:
    """Soft-delete multiple users, skipping self."""
    deleted, skipped = 0, []
    for uid in user_ids:
        user = get_user_by_id(db, uid)
        if not user or uid == actor_id:
            skipped.append(uid)
            continue
        user.is_active = False
        log_audit_event(db, actor_id, "ACCOUNT_DELETED", f"Bulk deleted {user.email}", "user", str(uid))
        deleted += 1
    db.flush()
    return deleted, skipped


def list_pending_enrollments(db: Session) -> list[dict]:
    """Return all enrollments with is_active=False, treated as pending approval."""
    rows = (
        db.query(
            StudentEnrollment.enrollment_id,
            StudentEnrollment.enrolled_at,
            User.full_name.label("student_name"),
            User.email.label("student_email"),
            Subject.subject_name,
            Grade.grade_name,
        )
        .join(User, User.user_id == StudentEnrollment.student_id)
        .join(Subject, Subject.subject_id == StudentEnrollment.subject_id)
        .join(Grade, Grade.grade_id == StudentEnrollment.grade_id)
        .filter(StudentEnrollment.is_active == False)
        .order_by(StudentEnrollment.enrolled_at.desc())
        .all()
    )
    return [
        {
            "enrollment_id": r.enrollment_id,
            "student_name": r.student_name,
            "student_email": r.student_email,
            "subject_name": r.subject_name,
            "grade_name": r.grade_name,
            "enrolled_at": r.enrolled_at,
            "status": "pending",
        }
        for r in rows
    ]


def get_enrollment_by_id(db: Session, enrollment_id: uuid.UUID) -> StudentEnrollment | None:
    """Return a single enrollment record by primary key."""
    return db.query(StudentEnrollment).filter(StudentEnrollment.enrollment_id == enrollment_id).first()


def get_enrollment_detail(db: Session, enrollment_id: uuid.UUID) -> dict | None:
    """Return a single enrollment with joined user, subject, and grade info."""
    row = (
        db.query(
            StudentEnrollment.enrollment_id,
            StudentEnrollment.enrolled_at,
            StudentEnrollment.is_active,
            User.full_name.label("student_name"),
            User.email.label("student_email"),
            Subject.subject_name,
            Grade.grade_name,
        )
        .join(User, User.user_id == StudentEnrollment.student_id)
        .join(Subject, Subject.subject_id == StudentEnrollment.subject_id)
        .join(Grade, Grade.grade_id == StudentEnrollment.grade_id)
        .filter(StudentEnrollment.enrollment_id == enrollment_id)
        .first()
    )
    if not row:
        return None
    return {
        "enrollment_id": row.enrollment_id,
        "student_name": row.student_name,
        "student_email": row.student_email,
        "subject_name": row.subject_name,
        "grade_name": row.grade_name,
        "enrolled_at": row.enrolled_at,
        "status": "active" if row.is_active else "pending",
    }


def approve_enrollment(db: Session, enrollment: StudentEnrollment) -> StudentEnrollment:
    """Activate an enrollment to mark it as approved."""
    enrollment.is_active = True
    db.flush()
    return enrollment


def _grade_counts(db: Session, grade_id: int) -> tuple[int, int]:
    """Return (subject_count, student_count) for a grade."""
    subject_count = (
        db.query(func.count(Subject.subject_id))
        .filter(Subject.grade_id == grade_id, Subject.is_active == True)
        .scalar()
        or 0
    )
    student_count = (
        db.query(func.count(func.distinct(StudentEnrollment.student_id)))
        .filter(StudentEnrollment.grade_id == grade_id, StudentEnrollment.is_active == True)
        .scalar()
        or 0
    )
    return subject_count, student_count


def list_grades(db: Session) -> list[dict]:
    """Return all active grades sorted by level, annotated with counts."""
    grades = (
        db.query(Grade)
        .filter(Grade.is_active == True)
        .order_by(Grade.grade_level)
        .all()
    )
    result = []
    for g in grades:
        subject_count, student_count = _grade_counts(db, g.grade_id)
        result.append({
            "grade_id": g.grade_id,
            "grade_name": g.grade_name,
            "grade_level": g.grade_level,
            "description": g.description,
            "subject_count": subject_count,
            "student_count": student_count,
        })
    return result


def get_grade_by_id(db: Session, grade_id: int) -> Grade | None:
    """Return a single grade record by primary key."""
    return db.query(Grade).filter(Grade.grade_id == grade_id).first()


def grade_name_exists(db: Session, grade_name: str) -> bool:
    """Return True when the grade name is already registered."""
    return db.query(Grade).filter(Grade.grade_name == grade_name).first() is not None


def create_grade(db: Session, grade_name: str, grade_level: int, description: str | None) -> Grade:
    """Create a new academic grade."""
    grade = Grade(grade_name=grade_name, grade_level=grade_level, description=description)
    db.add(grade)
    db.flush()
    return grade


def update_grade_fields(
    db: Session,
    grade: Grade,
    grade_name: str | None,
    description: str | None,
) -> Grade:
    """Apply partial updates to a grade record."""
    if grade_name is not None:
        grade.grade_name = grade_name
    if description is not None:
        grade.description = description
    db.flush()
    return grade


def delete_grade_safe(db: Session, grade_id: int) -> str | None:
    """Delete a grade only when no subjects or enrollments are linked.

    Returns an error string or None on success.
    """
    grade = get_grade_by_id(db, grade_id)
    if not grade:
        return "NOT_FOUND"
    subject_count = (
        db.query(func.count(Subject.subject_id))
        .filter(Subject.grade_id == grade_id)
        .scalar()
        or 0
    )
    if subject_count > 0:
        return "Cannot delete grade with linked subjects"
    enrollment_count = (
        db.query(func.count(StudentEnrollment.enrollment_id))
        .filter(StudentEnrollment.grade_id == grade_id)
        .scalar()
        or 0
    )
    if enrollment_count > 0:
        return "Cannot delete grade with active enrollments"
    db.delete(grade)
    db.flush()
    return None


def _subject_detail(db: Session, subject: Subject) -> dict:
    """Build a subject detail dict with instructor name and counts."""
    instructor_name = None
    assignment = (
        db.query(InstructorSubject)
        .filter(InstructorSubject.subject_id == subject.subject_id, InstructorSubject.is_active == True)
        .first()
    )
    if assignment:
        user = db.query(User).filter(User.user_id == assignment.instructor_id).first()
        instructor_name = user.full_name if user else None

    grade = get_grade_by_id(db, subject.grade_id)
    student_count = (
        db.query(func.count(StudentEnrollment.enrollment_id))
        .filter(StudentEnrollment.subject_id == subject.subject_id, StudentEnrollment.is_active == True)
        .scalar()
        or 0
    )
    assignment_count = (
        db.query(func.count(Assignment.assignment_id))
        .filter(Assignment.subject_id == subject.subject_id)
        .scalar()
        or 0
    )
    return {
        "subject_id": subject.subject_id,
        "name": subject.subject_name,
        "subject_code": subject.subject_code,
        "description": subject.description,
        "grade_id": subject.grade_id,
        "grade_name": grade.grade_name if grade else None,
        "instructor_name": instructor_name,
        "student_count": student_count,
        "assignment_count": assignment_count,
    }


def list_subjects(
    db: Session,
    grade_id: int | None = None,
    search: str | None = None,
) -> list[dict]:
    """Return subjects with instructor info and counts, optionally filtered."""
    query = db.query(Subject).filter(Subject.is_active == True)
    if grade_id is not None:
        query = query.filter(Subject.grade_id == grade_id)
    if search:
        query = query.filter(Subject.subject_name.ilike(f"%{search}%"))
    subjects = query.order_by(Subject.subject_name).all()
    return [_subject_detail(db, s) for s in subjects]


def get_subject_by_id(db: Session, subject_id: int) -> Subject | None:
    """Return a single subject record by primary key."""
    return db.query(Subject).filter(Subject.subject_id == subject_id).first()


def subject_code_exists(db: Session, subject_code: str) -> bool:
    """Return True when the subject code is already registered."""
    return db.query(Subject).filter(Subject.subject_code == subject_code).first() is not None


def create_subject(
    db: Session,
    name: str,
    subject_code: str,
    description: str | None,
    grade_id: int,
) -> Subject:
    """Create a new subject with an auto-generated ChromaDB namespace."""
    namespace = f"grade_{grade_id}_{subject_code.lower().replace(' ', '_')}"
    subject = Subject(
        subject_name=name,
        subject_code=subject_code,
        description=description,
        grade_id=grade_id,
        chroma_namespace=namespace,
    )
    db.add(subject)
    db.flush()
    return subject


def update_subject_fields(
    db: Session,
    subject: Subject,
    name: str | None,
    description: str | None,
) -> Subject:
    """Apply partial updates to a subject record."""
    if name is not None:
        subject.subject_name = name
    if description is not None:
        subject.description = description
    db.flush()
    return subject


def delete_subject_safe(db: Session, subject_id: int) -> str | None:
    """Delete a subject only when no active enrollments exist.

    Returns an error string or None on success.
    """
    subject = get_subject_by_id(db, subject_id)
    if not subject:
        return "NOT_FOUND"
    enrollment_count = (
        db.query(func.count(StudentEnrollment.enrollment_id))
        .filter(StudentEnrollment.subject_id == subject_id, StudentEnrollment.is_active == True)
        .scalar()
        or 0
    )
    if enrollment_count > 0:
        return "Cannot delete subject with active enrollments"
    db.delete(subject)
    db.flush()
    return None


def assign_instructor_to_subject(
    db: Session,
    subject_id: int,
    instructor_id: uuid.UUID,
    assigned_by: uuid.UUID,
) -> None:
    """Upsert the instructor assignment for a subject."""
    _upsert_instructor_subject(db, instructor_id, subject_id, assigned_by)
    db.flush()


def _enrollment_detail_row(db: Session, enrollment: StudentEnrollment) -> dict:
    """Build an enrollment detail dict with joined names."""
    student = db.query(User).filter(User.user_id == enrollment.student_id).first()
    subject = get_subject_by_id(db, enrollment.subject_id)
    grade = get_grade_by_id(db, enrollment.grade_id)
    return {
        "enrollment_id": enrollment.enrollment_id,
        "student_name": student.full_name if student else "",
        "student_email": student.email if student else "",
        "subject_name": subject.subject_name if subject else "",
        "grade_name": grade.grade_name if grade else "",
        "enrolled_at": enrollment.enrolled_at,
        "status": "active" if enrollment.is_active else "pending",
    }


def _apply_enrollment_filters(
    query,
    student_id: uuid.UUID | None,
    subject_id: int | None,
    grade_id: int | None,
    status: str | None,
) -> object:
    """Apply optional filters to an enrollment query."""
    if student_id is not None:
        query = query.filter(StudentEnrollment.student_id == student_id)
    if subject_id is not None:
        query = query.filter(StudentEnrollment.subject_id == subject_id)
    if grade_id is not None:
        query = query.filter(StudentEnrollment.grade_id == grade_id)
    if status == "active":
        query = query.filter(StudentEnrollment.is_active == True)
    elif status == "pending":
        query = query.filter(StudentEnrollment.is_active == False)
    return query


def list_enrollments(
    db: Session,
    student_id: uuid.UUID | None = None,
    subject_id: int | None = None,
    grade_id: int | None = None,
    status: str | None = None,
    page: int = 1,
    per_page: int = 20,
) -> tuple[list[dict], int]:
    """Return a paginated, filtered list of enrollments."""
    query = _apply_enrollment_filters(
        db.query(StudentEnrollment), student_id, subject_id, grade_id, status
    )
    total = query.count()
    rows = (
        query.order_by(StudentEnrollment.enrolled_at.desc())
        .offset((page - 1) * per_page)
        .limit(per_page)
        .all()
    )
    return [_enrollment_detail_row(db, e) for e in rows], total


def enrollment_exists(db: Session, student_id: uuid.UUID, subject_id: int) -> bool:
    """Return True when an active enrollment already exists."""
    return (
        db.query(StudentEnrollment)
        .filter(
            StudentEnrollment.student_id == student_id,
            StudentEnrollment.subject_id == subject_id,
            StudentEnrollment.is_active == True,
        )
        .first()
        is not None
    )


def _get_grade_id_for_subject(db: Session, subject_id: int) -> int | None:
    """Return the grade_id linked to a subject."""
    subject = get_subject_by_id(db, subject_id)
    return subject.grade_id if subject else None


def create_enrollment(
    db: Session,
    student_id: uuid.UUID,
    subject_id: int,
) -> StudentEnrollment:
    """Create a new active enrollment for a student in a subject."""
    grade_id = _get_grade_id_for_subject(db, subject_id)
    enrollment = StudentEnrollment(
        student_id=student_id,
        subject_id=subject_id,
        grade_id=grade_id,
        is_active=True,
    )
    db.add(enrollment)
    db.flush()
    return enrollment


def bulk_enroll(
    db: Session,
    student_ids: list[uuid.UUID],
    subject_id: int,
) -> tuple[int, list[uuid.UUID]]:
    """Enroll multiple students, skipping those already enrolled."""
    enrolled, skipped = 0, []
    for sid in student_ids:
        if enrollment_exists(db, sid, subject_id):
            skipped.append(sid)
            continue
        create_enrollment(db, sid, subject_id)
        enrolled += 1
    db.flush()
    return enrolled, skipped


def _has_submissions(db: Session, student_id: uuid.UUID, subject_id: int) -> bool:
    """Return True when the student has any submission in this subject."""
    return (
        db.query(Submission)
        .join(Assignment, Assignment.assignment_id == Submission.assignment_id)
        .filter(
            Submission.student_id == student_id,
            Assignment.subject_id == subject_id,
        )
        .first()
        is not None
    )


def remove_enrollment_safe(db: Session, enrollment_id: uuid.UUID) -> str | None:
    """Soft-delete an enrollment unless the student has active submissions.

    Returns an error string or None on success.
    """
    enrollment = get_enrollment_by_id(db, enrollment_id)
    if not enrollment:
        return "NOT_FOUND"
    if _has_submissions(db, enrollment.student_id, enrollment.subject_id):
        return "Cannot remove enrollment with existing submissions"
    enrollment.is_active = False
    db.flush()
    return None


CURRICULUM_UPLOAD_ROOT = Path("uploads/curriculum")

_ALLOWED_EXTENSIONS = {".pdf", ".docx"}
_MAX_FILE_BYTES = 50 * 1024 * 1024


def _validate_upload(filename: str, size: int) -> str | None:
    """Return an error string for invalid file type or size, else None."""
    ext = Path(filename).suffix.lower()
    if ext not in _ALLOWED_EXTENSIONS:
        return "Only PDF and DOCX files are supported"
    if size > _MAX_FILE_BYTES:
        return "File size exceeds 50 MB limit"
    return None


def _status_to_progress(status: EmbeddingStatus) -> float:
    """Map an EmbeddingStatus to a percentage value."""
    return {
        EmbeddingStatus.PENDING: 0.0,
        EmbeddingStatus.PROCESSING: 50.0,
        EmbeddingStatus.DONE: 100.0,
        EmbeddingStatus.FAILED: 0.0,
    }.get(status, 0.0)


def _doc_to_job_dict(db: Session, doc: CurriculumDocument) -> dict:
    """Build an IngestionJobResponse-compatible dict from a CurriculumDocument."""
    subject = get_subject_by_id(db, doc.subject_id)
    grade = get_grade_by_id(db, subject.grade_id) if subject else None
    grade_subject = (
        f"{grade.grade_name} / {subject.subject_name}"
        if grade and subject
        else ""
    )
    return {
        "job_id": doc.doc_id,
        "filename": doc.file_name,
        "grade_subject": grade_subject,
        "status": doc.embedding_status.value,
        "progress_pct": _status_to_progress(doc.embedding_status),
        "created_at": doc.created_at,
        "completed_at": doc.embedded_at,
    }


def _doc_to_detail_dict(db: Session, doc: CurriculumDocument) -> dict:
    """Build a CurriculumDocDetailResponse-compatible dict."""
    subject = get_subject_by_id(db, doc.subject_id)
    grade = get_grade_by_id(db, subject.grade_id) if subject else None
    uploader = get_user_by_id(db, doc.uploaded_by)
    return {
        "doc_id": doc.doc_id,
        "file_name": doc.file_name,
        "grade_name": grade.grade_name if grade else None,
        "subject_name": subject.subject_name if subject else None,
        "doc_type": doc.doc_type.value,
        "file_size_bytes": doc.file_size_bytes,
        "embedding_status": doc.embedding_status.value,
        "uploaded_by_email": uploader.email if uploader else None,
        "created_at": doc.created_at,
        "embedded_at": doc.embedded_at,
    }


def upload_curriculum_file(
    db: Session,
    file_bytes: bytes,
    filename: str,
    subject_id: int,
    uploaded_by: uuid.UUID,
    doc_type_str: str,
) -> CurriculumDocument:
    """Validate and save an uploaded curriculum file, then create a DB record."""
    error = _validate_upload(filename, len(file_bytes))
    if error:
        raise ValueError(error)

    subject = get_subject_by_id(db, subject_id)
    grade_id = subject.grade_id if subject else 0

    doc_id = uuid.uuid4()
    save_dir = CURRICULUM_UPLOAD_ROOT / str(grade_id) / str(subject_id) / str(doc_id)
    save_dir.mkdir(parents=True, exist_ok=True)
    (save_dir / filename).write_bytes(file_bytes)

    doc_type = DocumentType.CURRICULUM_PDF
    if doc_type_str == "instructor_note":
        doc_type = DocumentType.INSTRUCTOR_NOTE

    doc = CurriculumDocument(
        doc_id=doc_id,
        subject_id=subject_id,
        uploaded_by=uploaded_by,
        file_name=filename,
        file_path=str(save_dir / filename),
        file_size_bytes=len(file_bytes),
        doc_type=doc_type,
        embedding_status=EmbeddingStatus.PENDING,
    )
    db.add(doc)
    db.flush()
    return doc


def _apply_doc_filters(query, grade_id, subject_id, doc_type_str, status_str, search):
    """Apply optional filters to a CurriculumDocument query."""
    if subject_id is not None:
        query = query.filter(CurriculumDocument.subject_id == subject_id)
    if doc_type_str is not None:
        try:
            query = query.filter(CurriculumDocument.doc_type == DocumentType(doc_type_str))
        except ValueError:
            pass
    if status_str is not None:
        try:
            query = query.filter(CurriculumDocument.embedding_status == EmbeddingStatus(status_str.upper()))
        except ValueError:
            pass
    if search:
        query = query.filter(CurriculumDocument.file_name.ilike(f"%{search}%"))
    if grade_id is not None:
        query = (
            query.join(Subject, Subject.subject_id == CurriculumDocument.subject_id)
            .filter(Subject.grade_id == grade_id)
        )
    return query


def list_ingestion_jobs(
    db: Session,
    status: str | None = None,
    grade_id: int | None = None,
    subject_id: int | None = None,
    page: int = 1,
    per_page: int = 20,
) -> tuple[list[dict], int]:
    """Return a paginated list of curriculum documents as ingestion jobs."""
    query = _apply_doc_filters(
        db.query(CurriculumDocument), grade_id, subject_id, None, status, None
    )
    total = query.count()
    docs = (
        query.order_by(CurriculumDocument.created_at.desc())
        .offset((page - 1) * per_page)
        .limit(per_page)
        .all()
    )
    return [_doc_to_job_dict(db, d) for d in docs], total


def get_curriculum_doc_by_id(db: Session, doc_id: uuid.UUID) -> CurriculumDocument | None:
    """Return a single CurriculumDocument by primary key."""
    return db.query(CurriculumDocument).filter(CurriculumDocument.doc_id == doc_id).first()


def cancel_or_remove_job(db: Session, doc_id: uuid.UUID) -> str | None:
    """Cancel a queued job or delete a completed one.

    Returns an error string or None on success.
    """
    doc = get_curriculum_doc_by_id(db, doc_id)
    if not doc:
        return "NOT_FOUND"
    if doc.embedding_status == EmbeddingStatus.PROCESSING:
        return "Cannot cancel a job that is currently processing"
    if doc.embedding_status == EmbeddingStatus.PENDING:
        doc.embedding_status = EmbeddingStatus.FAILED
    else:
        _delete_doc_file(doc.file_path)
        db.delete(doc)
    db.flush()
    return None


def _delete_doc_file(file_path: str) -> None:
    """Remove a document file and its parent directory if empty."""
    try:
        path = Path(file_path)
        if path.exists():
            path.unlink()
        parent = path.parent
        if parent.exists() and not any(parent.iterdir()):
            parent.rmdir()
    except OSError:
        pass


def list_curriculum_docs(
    db: Session,
    grade_id: int | None = None,
    subject_id: int | None = None,
    doc_type: str | None = None,
    status: str | None = None,
    search: str | None = None,
    page: int = 1,
    per_page: int = 20,
) -> tuple[list[dict], int]:
    """Return a paginated curriculum document library list."""
    query = _apply_doc_filters(
        db.query(CurriculumDocument), grade_id, subject_id, doc_type, status, search
    )
    total = query.count()
    docs = (
        query.order_by(CurriculumDocument.created_at.desc())
        .offset((page - 1) * per_page)
        .limit(per_page)
        .all()
    )
    return [_doc_to_detail_dict(db, d) for d in docs], total


def delete_curriculum_doc(db: Session, doc_id: uuid.UUID) -> str | None:
    """Delete a curriculum document file from disk and remove the DB record.

    Returns an error string or None on success.
    """
    doc = get_curriculum_doc_by_id(db, doc_id)
    if not doc:
        return "NOT_FOUND"
    _delete_doc_file(doc.file_path)
    db.delete(doc)
    db.flush()
    return None


def requeue_curriculum_doc(db: Session, doc_id: uuid.UUID) -> str | None:
    """Reset a document's embedding status to PENDING for re-processing.

    Returns an error string or None on success.
    """
    doc = get_curriculum_doc_by_id(db, doc_id)
    if not doc:
        return "NOT_FOUND"
    if doc.embedding_status == EmbeddingStatus.PROCESSING:
        return "Cannot requeue a document that is currently processing"
    doc.embedding_status = EmbeddingStatus.PENDING
    doc.embedded_at = None
    db.flush()
    return None


def get_namespaces_from_db(db: Session) -> list[dict]:
    """Build a grade-grouped namespace tree from curriculum documents."""
    grades = (
        db.query(Grade).filter(Grade.is_active == True).order_by(Grade.grade_level).all()
    )
    result = []
    for grade in grades:
        subjects = (
            db.query(Subject)
            .filter(Subject.grade_id == grade.grade_id, Subject.is_active == True)
            .all()
        )
        namespaces = []
        for subj in subjects:
            done_docs = (
                db.query(CurriculumDocument)
                .filter(
                    CurriculumDocument.subject_id == subj.subject_id,
                    CurriculumDocument.embedding_status == EmbeddingStatus.DONE,
                )
                .all()
            )
            if not done_docs:
                continue
            last_updated = max((d.embedded_at for d in done_docs if d.embedded_at), default=None)
            namespaces.append({
                "name": subj.chroma_namespace,
                "subject_name": subj.subject_name,
                "chunk_count": 0,
                "doc_count": len(done_docs),
                "last_updated": last_updated,
            })
        result.append({
            "grade_name": grade.grade_name,
            "grade_level": grade.grade_level,
            "namespaces": namespaces,
        })
    return result


def get_vector_store_stats(db: Session) -> dict:
    """Return DB-derived vector store statistics."""
    total = db.query(func.count(CurriculumDocument.doc_id)).scalar() or 0
    done = (
        db.query(func.count(CurriculumDocument.doc_id))
        .filter(CurriculumDocument.embedding_status == EmbeddingStatus.DONE)
        .scalar()
        or 0
    )
    pending = (
        db.query(func.count(CurriculumDocument.doc_id))
        .filter(CurriculumDocument.embedding_status == EmbeddingStatus.PENDING)
        .scalar()
        or 0
    )
    failed = (
        db.query(func.count(CurriculumDocument.doc_id))
        .filter(CurriculumDocument.embedding_status == EmbeddingStatus.FAILED)
        .scalar()
        or 0
    )
    return {
        "total_documents": total,
        "total_done": done,
        "total_pending": pending,
        "total_failed": failed,
        "ai_service_status": "stub",
    }


def reindex_documents(
    db: Session,
    grade_id: int | None,
    subject_id: int | None,
) -> int:
    """Reset matching documents to PENDING for re-embedding. Returns count updated."""
    query = db.query(CurriculumDocument).filter(
        CurriculumDocument.embedding_status != EmbeddingStatus.PROCESSING
    )
    if subject_id is not None:
        query = query.filter(CurriculumDocument.subject_id == subject_id)
    elif grade_id is not None:
        query = (
            query.join(Subject, Subject.subject_id == CurriculumDocument.subject_id)
            .filter(Subject.grade_id == grade_id)
        )
    docs = query.all()
    for doc in docs:
        doc.embedding_status = EmbeddingStatus.PENDING
        doc.embedded_at = None
    db.flush()
    return len(docs)


def get_export_snapshot(db: Session) -> dict:
    """Return a JSON-serialisable metadata snapshot of all namespaces and doc counts."""
    namespaces = get_namespaces_from_db(db)
    stats = get_vector_store_stats(db)
    return {"namespaces": namespaces, "stats": stats}
