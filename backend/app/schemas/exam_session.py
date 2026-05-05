import uuid
from datetime import datetime

from pydantic import BaseModel


class ExamSessionResponse(BaseModel):
    session_id: uuid.UUID
    assignment_id: uuid.UUID
    started_at: datetime
    ended_at: datetime | None = None
    status: str
    exam_duration_minutes: int | None = None
    exam_duration_seconds: int | None = None
    pause_count: int = 0
    total_paused_seconds: int = 0

    model_config = {"from_attributes": True}
