"""Domain schemas for the instructor bounded context.

These Pydantic models represent value objects and domain-layer input contracts
internal to the instructor context. API-level request/response shapes live in
``app/schemas/instructor.py``; these models encode domain invariants that exist
independently of any HTTP transport.
"""
from pydantic import BaseModel, Field


class AssignmentInput(BaseModel):
    """Value object carrying validated data for creating a new assignment."""

    title: str = Field(..., min_length=1, max_length=255)
    description: str | None = None
    subject_id: int
    due_date: str | None = None
    topic_tags: list[str] | None = None
    max_score: float = Field(100.0, gt=0)
    is_exam_mode: bool = False


class AssignmentUpdateInput(BaseModel):
    """Value object carrying validated data for partially updating an assignment."""

    title: str | None = Field(None, min_length=1, max_length=255)
    description: str | None = None
    due_date: str | None = None
    topic_tags: list[str] | None = None
    max_score: float | None = Field(None, gt=0)
    is_exam_mode: bool | None = None


class FeedbackOverrideInput(BaseModel):
    """Value object for instructor feedback and score overrides on a submission."""

    score_percentage: float = Field(..., ge=0, le=100)
    overall_feedback: str | None = None
    strengths: str | None = None
    improvements: str | None = None
    instructor_comments: str | None = None


class InstructorProfileUpdateInput(BaseModel):
    """Value object carrying validated data for updating the instructor's own profile."""

    full_name: str | None = Field(None, min_length=1, max_length=255)
    profile_image_url: str | None = None
