import uuid
from datetime import datetime, timezone

from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy import Boolean, Column, DateTime, ForeignKey, Index, SmallInteger, Text

from app.db.base import Base


class QuizAttempt(Base):
    __tablename__ = "quiz_attempts"

    attempt_id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, nullable=False)
    quiz_id = Column(UUID(as_uuid=True), ForeignKey("micro_quizzes.quiz_id"), nullable=False)
    student_id = Column(UUID(as_uuid=True), ForeignKey("users.user_id"), nullable=False)
    question_id = Column(UUID(as_uuid=True), ForeignKey("quiz_questions.question_id"), nullable=False)
    attempt_number = Column(SmallInteger, nullable=False, default=1, server_default="1")
    student_answer = Column(Text, nullable=False)
    is_correct = Column(Boolean, nullable=True)
    ai_feedback = Column(Text, nullable=True)
    answered_at = Column(
        DateTime(timezone=True),
        nullable=False,
        default=lambda: datetime.now(timezone.utc),
        server_default="now()",
    )

    __table_args__ = (
        Index("ix_quiz_attempts_lookup", "quiz_id", "student_id", "question_id", "attempt_number"),
    )
