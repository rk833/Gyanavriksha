import uuid
from datetime import datetime

from sqlalchemy import Boolean, Column, DateTime, Enum as SAEnum, ForeignKey, String, Text
from sqlalchemy.dialects.postgresql import UUID, INET

from app.db.base import Base
from app.shared.source_enum import (
    EmailVerificationType,
    QrSessionStatus,
)


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
        default=datetime.utcnow,
        server_default="now()",
    )


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
    created_at = Column(
        DateTime(timezone=True),
        nullable=False,
        default=datetime.utcnow,
        server_default="now()",
    )


class EmailVerification(Base):
    __tablename__ = "email_verifications"

    verification_id = Column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
        nullable=False,
    )
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.user_id"), nullable=False)
    token_hash = Column(String(255), nullable=False)
    type = Column(SAEnum(EmailVerificationType, name="email_verification_type"), nullable=False)
    expires_at = Column(DateTime(timezone=True), nullable=False)
    used_at = Column(DateTime(timezone=True), nullable=True)

