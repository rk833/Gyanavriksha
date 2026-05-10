"""Domain schemas for the quiz bounded context.

Value objects and internal request contracts for quiz use cases.
API-level response shapes live in ``app/schemas/quiz.py``.
"""
import uuid

from pydantic import BaseModel, Field


class GenerateQuizInput(BaseModel):
    """Value object for validated data when generating a micro-quiz."""

    student_id: uuid.UUID
    subject_id: int
    concept: str = Field(..., min_length=1)
    num_questions: int = Field(5, ge=1, le=20)
    gap_id: uuid.UUID | None = None


class DetectGapsInput(BaseModel):
    """Value object for validated data when triggering gap detection from chat."""

    history_id: uuid.UUID
