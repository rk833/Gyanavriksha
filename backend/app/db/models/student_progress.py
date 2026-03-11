import uuid
from datetime import datetime

from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy import Boolean, Column, Date, DateTime, Enum as SAEnum, Float, ForeignKey, Integer, SmallInteger, UniqueConstraint

from app.db.base import Base
from app.shared.source_enum import PeriodType


class StudentProgress(Base):
    __tablename__ = "student_progress"

    progress_id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, nullable=False)
    student_id = Column(UUID(as_uuid=True), ForeignKey("users.user_id"), nullable=False)
    subject_id = Column(Integer, ForeignKey("subjects.subject_id"), nullable=False)
    period_type = Column(SAEnum(PeriodType, name="period_type"), nullable=False)
    period_start = Column(Date, nullable=False)
    period_end = Column(Date, nullable=False)
    avg_score = Column(Float, nullable=True)
    submission_count = Column(SmallInteger, nullable=False, default=0, server_default="0")
    gap_count = Column(SmallInteger, nullable=False, default=0, server_default="0")
    is_at_risk = Column(Boolean, nullable=False, default=False, server_default="false")
    computed_at = Column(
        DateTime(timezone=True),
        nullable=False,
        default=datetime.utcnow,
        server_default="now()",
    )

    __table_args__ = (
        UniqueConstraint("student_id", "subject_id", "period_type", "period_start", name="uq_student_progress"),
    )
