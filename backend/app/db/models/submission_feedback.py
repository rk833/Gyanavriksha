import uuid
from datetime import datetime

from sqlalchemy.dialects.postgresql import UUID, JSONB, ARRAY
from sqlalchemy import Boolean, Column, DateTime, Float, ForeignKey, Integer, String, Text

from app.db.base import Base


class SubmissionFeedback(Base):
    __tablename__ = "submission_feedback"

    feedback_id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, nullable=False)
    submission_id = Column(UUID(as_uuid=True), ForeignKey("submissions.submission_id"), unique=True, nullable=False)
    overall_feedback = Column(Text, nullable=False)
    step_by_step_corrections = Column(JSONB, nullable=False)
    failed_at_step = Column(String(255), nullable=True)
    rag_chunks_used = Column(ARRAY(String), nullable=True)
    llm_model_used = Column(String(100), nullable=True)
    llm_tokens_used = Column(Integer, nullable=True)
    knowledge_gap_detected = Column(Boolean, nullable=False, default=False, server_default="false")
    ai_snapshot = Column(JSONB, nullable=True)
    score_percentage = Column(Float, nullable=True)
    strengths = Column(Text, nullable=True)
    improvements = Column(Text, nullable=True)
    instructor_comments = Column(Text, nullable=True)
    graded_by = Column(UUID(as_uuid=True), ForeignKey("users.user_id"), nullable=True)
    created_at = Column(
        DateTime(timezone=True),
        nullable=False,
        default=datetime.utcnow,
        server_default="now()",
    )
