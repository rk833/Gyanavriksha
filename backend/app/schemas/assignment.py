import uuid
from datetime import datetime

from pydantic import BaseModel, Field


class SubjectInstructorBrief(BaseModel):
    user_id: uuid.UUID
    full_name: str
    email: str


class AssignmentListItem(BaseModel):
    assignment_id: uuid.UUID
    title: str
    description: str | None = None
    subject_id: int
    subject_name: str | None = None
    grade_name: str | None = None
    instructor_name: str | None = None
    subject_instructors: list[SubjectInstructorBrief] = Field(default_factory=list)
    topic_tags: list[str] | None = None
    is_exam_mode: bool = False
    exam_duration_minutes: int | None = None
    exam_max_pauses: int | None = None
    exam_strict_proctor: bool = False
    max_score: float = 100.0
    due_date: datetime | None = None
    is_published: bool = False
    has_submitted: bool = False
    created_at: datetime
    # Exam mode: server-backed `exam_sessions` (see POST …/exam-session/start)
    exam_slot_blocked: bool = False
    exam_active_session_id: uuid.UUID | None = None
    exam_session_started_at: datetime | None = None

    model_config = {"from_attributes": True}


class AssignmentDetailResponse(AssignmentListItem):
    submission_count: int = 0
