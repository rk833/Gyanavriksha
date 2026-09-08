import uuid
from datetime import datetime, timezone

from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy import Column, DateTime, Float, ForeignKey, Integer, String, UniqueConstraint

from app.db.base import Base


class ConceptHeatmapEntry(Base):
    __tablename__ = "concept_heatmap_entries"

    heatmap_id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, nullable=False)
    student_id = Column(UUID(as_uuid=True), ForeignKey("users.user_id", ondelete="CASCADE"), nullable=False, index=True)
    subject_id = Column(Integer, ForeignKey("subjects.subject_id"), nullable=False)
    grade_id = Column(Integer, ForeignKey("grades.grade_id"), nullable=False)
    concept_name = Column(String(255), nullable=False)
    topic_tag = Column(String(100), nullable=False)
    occurrence_count = Column(Integer, nullable=False, default=1, server_default="1")
    proficiency_score = Column(Float, nullable=True, doc="Proficiency score from -10 to 10")
    last_updated_at = Column(
        DateTime(timezone=True),
        nullable=False,
        default=lambda: datetime.now(timezone.utc),
        server_default="now()",
    )

    __table_args__ = (
        UniqueConstraint("student_id", "subject_id", "topic_tag", name="uq_heatmap_student_subject_topic"),
    )
