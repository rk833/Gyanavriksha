"""API shapes for the student AI tutor (persisted chat + history)."""

import uuid
from typing import Any

from pydantic import BaseModel, Field


class AiTutorChatRequest(BaseModel):
    query: str = Field(..., min_length=1)
    subject_id: int | None = None
    history_id: uuid.UUID | None = None


class AiTutorChatResponse(BaseModel):
    answer: str
    sources: list[str] = Field(default_factory=list)
    history_id: str | None = None
    persisted: bool = False


class AiTutorSessionItem(BaseModel):
    history_id: str
    subject_id: int
    subject_name: str
    preview: str = ""
    updated_at: str | None = None


class AiTutorSessionDetailResponse(BaseModel):
    history_id: str
    subject_id: int
    subject_name: str
    messages: list[dict[str, Any]] = Field(default_factory=list)
    summary: dict[str, Any] | None = None
