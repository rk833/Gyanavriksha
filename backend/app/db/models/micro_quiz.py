import uuid
from datetime import datetime

from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy import Column, DateTime, Enum as SAEnum, Float, ForeignKey, Integer, SmallInteger, String

from app.db.base import Base
from app.shared.source_enum import MicroQuizStatus


class MicroQuiz(Base):
    __tablename__ = "micro_quizzes"

    quiz_id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, nullable=False)
    student_id = Column(UUID(as_uuid=True), ForeignKey("users.user_id"), nullable=False)
    subject_id = Column(Integer, ForeignKey("subjects.subject_id"), nullable=False)
    gap_id = Column(UUID(as_uuid=True), ForeignKey("knowledge_gaps.gap_id"), nullable=True)
    concept_targeted = Column(String(255), nullable=False)
    total_questions = Column(SmallInteger, nullable=False)
    status = Column(
        SAEnum(MicroQuizStatus, name="micro_quiz_status"),
        nullable=False,
        default=MicroQuizStatus.ASSIGNED,
        server_default=MicroQuizStatus.ASSIGNED.value,
    )
    score_percentage = Column(Float, nullable=True)
    completed_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(
        DateTime(timezone=True),
        nullable=False,
        default=datetime.utcnow,
        server_default="now()",
    )
