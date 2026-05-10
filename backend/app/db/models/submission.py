import uuid
from datetime import datetime, timezone

from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy import Boolean, Column, DateTime, Enum as SAEnum, Float, ForeignKey, Index, Integer, Text

from app.db.base import Base
from app.shared.source_enum import GradeClassification, SubmissionProcessingStatus


class Submission(Base):
    __tablename__ = "submissions"

    submission_id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, nullable=False)
    student_id = Column(UUID(as_uuid=True), ForeignKey("users.user_id"), nullable=False)
    assignment_id = Column(UUID(as_uuid=True), ForeignKey("assignments.assignment_id"), nullable=False)
    subject_id = Column(Integer, ForeignKey("subjects.subject_id"), nullable=False)
    image_path = Column(Text, nullable=False)
    image_quality_score = Column(Float, nullable=True)
    quality_rejection_reason = Column(Text, nullable=True)
    processing_status = Column(
        SAEnum(SubmissionProcessingStatus, name="submission_processing_status"),
        nullable=False,
    )
    grade_classification = Column(
        SAEnum(GradeClassification, name="grade_classification"),
        nullable=True,
    )
    score_percentage = Column(Float, nullable=True)
    processing_started_at = Column(DateTime(timezone=True), nullable=True)
    processing_completed_at = Column(DateTime(timezone=True), nullable=True)
    is_exam_submission = Column(Boolean, nullable=False, default=False, server_default="false")
    submitted_at = Column(
        DateTime(timezone=True),
        nullable=False,
        default=lambda: datetime.now(timezone.utc),
        server_default="now()",
    )

    __table_args__ = (
        Index("ix_submissions_student_submitted", "student_id", "submitted_at"),
    )
