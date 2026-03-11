import uuid
from datetime import datetime

from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy import Boolean, Column, DateTime, ForeignKey, Integer, SmallInteger, String, UniqueConstraint

from app.db.base import Base


class KnowledgeGap(Base):
    __tablename__ = "knowledge_gaps"

    gap_id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, nullable=False)
    student_id = Column(UUID(as_uuid=True), ForeignKey("users.user_id"), nullable=False)
    subject_id = Column(Integer, ForeignKey("subjects.subject_id"), nullable=False)
    submission_id = Column(UUID(as_uuid=True), ForeignKey("submissions.submission_id"), nullable=False)
    concept_name = Column(String(255), nullable=False)
    topic_tag = Column(String(100), nullable=False)
    recurrence_count = Column(SmallInteger, nullable=False, default=1, server_default="1")
    is_resolved = Column(Boolean, nullable=False, default=False, server_default="false")
    detected_at = Column(
        DateTime(timezone=True),
        nullable=False,
        default=datetime.utcnow,
        server_default="now()",
    )

    __table_args__ = (
        UniqueConstraint("student_id", "topic_tag", name="uq_knowledge_gap_student_topic"),
    )
