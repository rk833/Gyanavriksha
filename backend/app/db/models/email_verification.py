import uuid
from datetime import datetime

from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy import Column, DateTime, Enum as SAEnum, ForeignKey, String

from app.db.base import Base
from app.shared.source_enum import EmailVerificationType


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
    type = Column(
        SAEnum(EmailVerificationType, name="email_verification_type"), nullable=False
    )
    expires_at = Column(DateTime(timezone=True), nullable=False)
    used_at = Column(DateTime(timezone=True), nullable=True)

