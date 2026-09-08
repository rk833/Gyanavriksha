import uuid

from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy import Column, Enum as SAEnum, ForeignKey, SmallInteger, String, Text

from app.db.base import Base
from app.shared.source_enum import QuestionDifficulty, QuestionType


class QuizQuestion(Base):
    __tablename__ = "quiz_questions"

    question_id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, nullable=False)
    quiz_id = Column(UUID(as_uuid=True), ForeignKey("micro_quizzes.quiz_id"), nullable=False)
    question_text = Column(Text, nullable=False)
    question_type = Column(SAEnum(QuestionType, name="question_type"), nullable=False)
    options = Column(JSONB, nullable=True)
    correct_answer = Column(Text, nullable=False)
    explanation = Column(Text, nullable=True)
    difficulty = Column(
        SAEnum(QuestionDifficulty, name="question_difficulty"),
        nullable=False,
        default=QuestionDifficulty.MEDIUM,
        server_default=QuestionDifficulty.MEDIUM.value,
    )
    order_num = Column(SmallInteger, nullable=False)
