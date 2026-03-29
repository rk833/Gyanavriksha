import uuid
from datetime import datetime

from pydantic import BaseModel


class AssignmentListItem(BaseModel):
    assignment_id: uuid.UUID
    title: str
    description: str | None = None
    subject_id: int
    subject_name: str | None = None
    grade_name: str | None = None
    instructor_name: str | None = None
    topic_tags: list[str] | None = None
    is_exam_mode: bool = False
    due_date: datetime | None = None
    is_published: bool = False
    has_submitted: bool = False
    created_at: datetime

    model_config = {"from_attributes": True}


class AssignmentDetailResponse(AssignmentListItem):
    submission_count: int = 0
