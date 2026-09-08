import uuid
from datetime import datetime, timezone

from sqlalchemy.dialects.postgresql import UUID, INET
from sqlalchemy import Column, DateTime, ForeignKey, String, Text

from app.db.base import Base


class RefreshToken(Base):
    __tablename__ = "refresh_tokens"

    token_id = Column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
        nullable=False,
    )
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.user_id"), nullable=False)
    token_hash = Column(String(255), unique=True, nullable=False)
    device_info = Column(Text, nullable=True)
    ip_address = Column(INET, nullable=True)
    expires_at = Column(DateTime(timezone=True), nullable=False)
    created_at = Column(
        DateTime(timezone=True),
        nullable=False,
        default=lambda: datetime.now(timezone.utc),
        server_default="now()",
    )

