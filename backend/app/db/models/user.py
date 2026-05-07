import uuid
from datetime import datetime

from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy import Boolean, Column, DateTime, Enum as SAEnum, ForeignKey, Integer, String, Text

from sqlalchemy.dialects.postgresql import JSONB

from app.db.base import Base
from app.shared.source_enum import UserRole


class User(Base):
    __tablename__ = "users"

    user_id = Column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
        nullable=False,
    )
    email = Column(String(255), unique=True, nullable=False, index=True)
    password_hash = Column(String(255), nullable=False)
    full_name = Column(String(150), nullable=False)
    role = Column(SAEnum(UserRole, name="user_role"), nullable=False)
    is_active = Column(Boolean, nullable=False, default=True, server_default="true")
    is_email_verified = Column(
        Boolean, nullable=False, default=False, server_default="false"
    )
    totp_secret = Column(String(64), nullable=True)
    totp_enabled = Column(
        Boolean, nullable=False, default=False, server_default="false"
    )
    email_2fa_enabled = Column(
        Boolean, nullable=False, default=False, server_default="false"
    )
    profile_image_url = Column(Text, nullable=True)
    notification_preferences = Column(JSONB, nullable=True)
    last_login_at = Column(DateTime(timezone=True), nullable=True)
    grade_id = Column(Integer, ForeignKey("grades.grade_id", ondelete="SET NULL"), nullable=True)
    must_change_password = Column(
        Boolean, nullable=False, default=False, server_default="false"
    )
    token_version = Column(Integer, nullable=False, default=0, server_default="0")
    failed_login_attempts = Column(Integer, nullable=False, default=0, server_default="0")
    locked_until = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(
        DateTime(timezone=True),
        nullable=False,
        default=datetime.utcnow,
        server_default="now()",
    )
    updated_at = Column(
        DateTime(timezone=True),
        nullable=False,
        default=datetime.utcnow,
        onupdate=datetime.utcnow,
        server_default="now()",
    )

