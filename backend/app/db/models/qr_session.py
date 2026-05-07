import uuid
from datetime import datetime

from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy import Column, DateTime, Enum as SAEnum, ForeignKey, String, Text

from app.db.base import Base
from app.shared.source_enum import QrSessionStatus


class QrSession(Base):
    __tablename__ = "qr_sessions"

    qr_session_id = Column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
        nullable=False,
    )
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.user_id"), nullable=True)
    qr_code_hash = Column(String(128), unique=True, nullable=False)
    status = Column(SAEnum(QrSessionStatus, name="qr_session_status"), nullable=False)
    scanned_at = Column(DateTime(timezone=True), nullable=True)
    expires_at = Column(DateTime(timezone=True), nullable=False)
    web_access_token = Column(Text, nullable=True)
    web_refresh_token = Column(Text, nullable=True)
    created_at = Column(
        DateTime(timezone=True),
        nullable=False,
        default=datetime.utcnow,
        server_default="now()",
    )

