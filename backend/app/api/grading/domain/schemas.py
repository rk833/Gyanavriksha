"""Domain schemas for the grading bounded context.

Value objects and internal result contracts for the grading use cases.
"""
import uuid
from typing import Any

from pydantic import BaseModel


class StepCorrection(BaseModel):
    """Represents the AI evaluation result for one marked step."""

    step: str
    status: str
    comment: str


class GradingFeedback(BaseModel):
    """Structured feedback returned after AI grading completes."""

    overall_feedback: str
    step_by_step_corrections: list[StepCorrection]
    strengths: str | None
    improvements: str | None
    knowledge_gap_detected: bool
    failed_at_step: str | None


class GradingResultResponse(BaseModel):
    """Response schema for the grading result polling endpoint."""

    submission_id: uuid.UUID
    processing_status: str
    grade_classification: str | None
    score_percentage: float | None
    feedback: GradingFeedback | None
