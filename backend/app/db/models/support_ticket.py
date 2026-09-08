import uuid
from datetime import datetime, timezone

from sqlalchemy import Column, DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.dialects.postgresql import UUID

from app.db.base import Base


class SupportTicket(Base):
    __tablename__ = "support_tickets"

    ticket_id = Column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
        nullable=False,
    )
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.user_id", ondelete="SET NULL"), nullable=True)
    full_name = Column(String(150), nullable=False)
    email = Column(String(255), nullable=False, index=True)
    role = Column(String(50), nullable=False)
    category = Column(String(80), nullable=False)
    priority = Column(String(20), nullable=False, default="Medium", server_default="Medium")
    subject = Column(String(200), nullable=False)
    description = Column(Text, nullable=False)
    attachment_name = Column(String(255), nullable=True)
    attachment_path = Column(Text, nullable=True)
    attachment_content_type = Column(String(120), nullable=True)
    attachment_size_bytes = Column(Integer, nullable=True)
    status = Column(String(20), nullable=False, default="open", server_default="open")
    created_at = Column(
        DateTime(timezone=True),
        nullable=False,
        default=lambda: datetime.now(timezone.utc),
        server_default="now()",
    )
    updated_at = Column(
        DateTime(timezone=True),
        nullable=False,
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
        server_default="now()",
    )
