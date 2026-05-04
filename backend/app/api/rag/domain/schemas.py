"""Domain schemas for the RAG bounded context.

Value objects and internal input contracts for the RAG use cases.
API-level request/response shapes (for OpenAPI docs) live in ``app/schemas/``.
"""
from typing import Any

from pydantic import BaseModel, Field


class RagQueryInput(BaseModel):
    """Value object carrying a validated RAG query request."""

    user_type: str = Field(..., description="'admin' | 'instructor' | 'student'")
    query: str = Field(..., min_length=1)
    grade: int | None = None
    instructor_id: str | None = None
    class_id: str | None = None
    student_id: str | None = None


class RagUploadInput(BaseModel):
    """Value object carrying validated metadata for a RAG document upload."""

    user_type: str
    submitted_by: str
    grade: int | None = None
    subject: str | None = None
    instructor_id: str | None = None
    class_id: str | None = None
    student_id: str | None = None
