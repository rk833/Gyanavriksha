import uuid
from datetime import datetime, timezone

from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy import Boolean, Column, DateTime, ForeignKey, Integer, UniqueConstraint

from app.db.base import Base


class InstructorSubject(Base):
    __tablename__ = "instructor_subjects"

    assignment_id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, nullable=False)
    instructor_id = Column(UUID(as_uuid=True), ForeignKey("users.user_id"), nullable=False)
    subject_id = Column(Integer, ForeignKey("subjects.subject_id"), nullable=False)
    assigned_by = Column(UUID(as_uuid=True), ForeignKey("users.user_id"), nullable=False)
    assigned_at = Column(
        DateTime(timezone=True),
        nullable=False,
        default=lambda: datetime.now(timezone.utc),
        server_default="now()",
    )
    is_active = Column(Boolean, nullable=False, default=True, server_default="true")

    __table_args__ = (
        UniqueConstraint("instructor_id", "subject_id", name="uq_instructor_subject"),
    )
