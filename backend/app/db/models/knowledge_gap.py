import uuid
from datetime import datetime, timezone

from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy import Boolean, Column, DateTime, ForeignKey, Integer, SmallInteger, String, UniqueConstraint

from app.db.base import Base


class KnowledgeGap(Base):
    """Weak concepts per student, keyed by (student_id, topic_tag).

    Rows are created when:
    - AI scans the tutor chat log (`quiz_service.detect_gaps_for_quiz` → AI `/quiz/detect-gaps`), or
    - Submission grading marks `knowledge_gap_detected` (`quiz_service.upsert_gap_from_grading`).

    ``micro_quizzes.gap_id`` links an auto-generated practice quiz when the backend runs
    ``generate_quiz_if_eligible`` after detection (grading or chat); rows persist until deleted.
    """

    __tablename__ = "knowledge_gaps"

    gap_id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, nullable=False)
    student_id = Column(UUID(as_uuid=True), ForeignKey("users.user_id"), nullable=False)
    subject_id = Column(Integer, ForeignKey("subjects.subject_id"), nullable=False)
    submission_id = Column(UUID(as_uuid=True), ForeignKey("submissions.submission_id"), nullable=True)
    history_id = Column(UUID(as_uuid=True), ForeignKey("chat_history.history_id"), nullable=True)
    concept_name = Column(String(255), nullable=False)
    topic_tag = Column(String(100), nullable=False)
    recurrence_count = Column(SmallInteger, nullable=False, default=1, server_default="1")
    is_resolved = Column(Boolean, nullable=False, default=False, server_default="false")
    detected_at = Column(
        DateTime(timezone=True),
        nullable=False,
        default=lambda: datetime.now(timezone.utc),
        server_default="now()",
    )

    __table_args__ = (
        UniqueConstraint("student_id", "topic_tag", name="uq_knowledge_gap_student_topic"),
    )
