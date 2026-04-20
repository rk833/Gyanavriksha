"""Admin service — data access helpers for admin API use cases."""
import secrets
import string
import uuid

from sqlalchemy.orm import Session
from sqlalchemy import func, or_

from app.core.security import hash_password
from app.db.models.audit_log import AuditLog
from app.db.models.grade import Grade
from app.db.models.instructor_subject import InstructorSubject
from app.db.models.student_enrollment import StudentEnrollment
from app.db.models.subject import Subject
from app.db.models.user import User
from app.shared.source_enum import ActorRole, UserRole


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
        ip_address=ip_address,
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
