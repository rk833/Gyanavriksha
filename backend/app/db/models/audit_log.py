from datetime import datetime

from sqlalchemy.dialects.postgresql import UUID, JSONB, INET
from sqlalchemy import BigInteger, Column, DateTime, Enum as SAEnum, ForeignKey, String, Text

from app.db.base import Base
from app.shared.source_enum import ActorRole


class AuditLog(Base):
    __tablename__ = "audit_logs"

    log_id = Column(BigInteger, primary_key=True, autoincrement=True)
    actor_id = Column(UUID(as_uuid=True), ForeignKey("users.user_id"), nullable=True)
    actor_role = Column(SAEnum(ActorRole, name="actor_role"), nullable=True)
    action = Column(String(100), nullable=False)
    resource_type = Column(String(100), nullable=True)
    resource_id = Column(Text, nullable=True)
    ip_address = Column(INET, nullable=True)
    extra_metadata = Column("metadata", JSONB, nullable=True)
    created_at = Column(
        DateTime(timezone=True),
        nullable=False,
        default=datetime.utcnow,
        server_default="now()",
    )
