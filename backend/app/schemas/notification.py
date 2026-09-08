import uuid
from datetime import datetime

from pydantic import BaseModel

from app.shared.source_enum import NotificationChannel, NotificationType


class NotificationResponse(BaseModel):
    notification_id: uuid.UUID
    title: str
    body: str
    type: NotificationType
    channel: NotificationChannel
    is_read: bool
    related_resource_id: str | None = None
    created_at: datetime

    model_config = {"from_attributes": True}


class NotificationListResponse(BaseModel):
    notifications: list[NotificationResponse]
    unread_count: int
    total: int


class UnreadCountResponse(BaseModel):
    count: int
