"""Admin service — data access helpers for admin API use cases."""
import uuid

from sqlalchemy.orm import Session
from sqlalchemy import func

from app.db.models.audit_log import AuditLog
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
