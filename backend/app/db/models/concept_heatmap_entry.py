import uuid
from datetime import datetime

from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy import Column, DateTime, Float, ForeignKey, Integer, String, UniqueConstraint

from app.db.base import Base


class ConceptHeatmapEntry(Base):
    __tablename__ = "concept_heatmap_entries"

    heatmap_id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, nullable=False)
    subject_id = Column(Integer, ForeignKey("subjects.subject_id"), nullable=False)
    grade_id = Column(Integer, ForeignKey("grades.grade_id"), nullable=False)
    concept_name = Column(String(255), nullable=False)
    topic_tag = Column(String(100), nullable=False)
    occurrence_count = Column(Integer, nullable=False, default=1, server_default="1")
    affected_student_count = Column(Integer, nullable=False, default=1, server_default="1")
    severity_score = Column(Float, nullable=True)
    last_updated_at = Column(
        DateTime(timezone=True),
        nullable=False,
        default=datetime.utcnow,
        server_default="now()",
    )

    __table_args__ = (
        UniqueConstraint("subject_id", "topic_tag", name="uq_heatmap_subject_topic"),
    )
