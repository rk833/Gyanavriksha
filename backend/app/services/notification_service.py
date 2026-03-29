"""
Notification service — query, read, and manage notifications.
Sprint 3 Phase 5: GD-59
"""
import uuid
from datetime import datetime, timezone

from sqlalchemy import func
from sqlalchemy.orm import Session

from app.db.models.notification import Notification
from app.shared.source_enum import NotificationType


def get_notifications(
    db: Session,
    user_id: uuid.UUID,
    type_filter: str | None = None,
    is_read: bool | None = None,
    page: int = 1,
    per_page: int = 20,
) -> tuple[list[Notification], int, int]:
    """Get paginated notifications for a user. Returns (items, total, unread_count)."""
    query = db.query(Notification).filter(Notification.recipient_id == user_id)

    if type_filter and type_filter != "all":
        try:
            nt = NotificationType(type_filter)
            query = query.filter(Notification.type == nt)
        except ValueError:
            pass

    if is_read is not None:
        query = query.filter(Notification.is_read == is_read)

    total = query.count()
    items = (
        query.order_by(Notification.created_at.desc())
        .offset((page - 1) * per_page)
        .limit(per_page)
        .all()
    )

    unread_count = (
        db.query(func.count(Notification.notification_id))
        .filter(
            Notification.recipient_id == user_id,
            Notification.is_read == False,
        )
        .scalar()
    ) or 0

    return items, total, unread_count


def get_unread_count(db: Session, user_id: uuid.UUID) -> int:
    """Get count of unread notifications."""
    return (
        db.query(func.count(Notification.notification_id))
        .filter(
            Notification.recipient_id == user_id,
            Notification.is_read == False,
        )
        .scalar()
    ) or 0


def mark_as_read(
    db: Session, user_id: uuid.UUID, notification_id: uuid.UUID
) -> Notification | None:
    """Mark a single notification as read."""
    notification = (
        db.query(Notification)
        .filter(
            Notification.notification_id == notification_id,
            Notification.recipient_id == user_id,
        )
        .first()
    )
    if notification:
        notification.is_read = True
        db.commit()
        db.refresh(notification)
    return notification


def mark_all_as_read(db: Session, user_id: uuid.UUID) -> int:
    """Mark all unread notifications as read. Returns count updated."""
    count = (
        db.query(Notification)
        .filter(
            Notification.recipient_id == user_id,
            Notification.is_read == False,
        )
        .update({"is_read": True})
    )
    db.commit()
    return count
