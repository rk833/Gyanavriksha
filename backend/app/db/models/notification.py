import uuid
from datetime import datetime, timezone

from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy import Boolean, Column, DateTime, Enum as SAEnum, ForeignKey, String, Text

from app.db.base import Base
from app.shared.source_enum import NotificationChannel, NotificationType


class Notification(Base):
    __tablename__ = "notifications"

    notification_id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, nullable=False)
    recipient_id = Column(UUID(as_uuid=True), ForeignKey("users.user_id"), nullable=False)
    type = Column(SAEnum(NotificationType, name="notification_type"), nullable=False)
    title = Column(String(255), nullable=False)
    body = Column(Text, nullable=False)
    channel = Column(SAEnum(NotificationChannel, name="notification_channel"), nullable=False)
    is_read = Column(Boolean, nullable=False, default=False, server_default="false")
    related_resource_id = Column(Text, nullable=True)
    sent_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(
        DateTime(timezone=True),
        nullable=False,
        default=lambda: datetime.now(timezone.utc),
        server_default="now()",
    )
