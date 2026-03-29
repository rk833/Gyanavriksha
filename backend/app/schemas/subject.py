import uuid
from datetime import datetime

from pydantic import BaseModel


class GradeResponse(BaseModel):
    grade_id: int
    grade_name: str
    grade_level: int
    description: str | None = None

    model_config = {"from_attributes": True}


class SubjectResponse(BaseModel):
    subject_id: int
    subject_name: str
    subject_code: str
    description: str | None = None
    grade_id: int
    grade_name: str | None = None
    is_active: bool

    model_config = {"from_attributes": True}


class EnrollmentResponse(BaseModel):
    enrollment_id: uuid.UUID
    student_id: uuid.UUID
    subject_id: int
    subject_name: str
    subject_code: str
    grade_id: int
    grade_name: str
    enrolled_at: datetime
    is_active: bool
    completion_percentage: float = 0.0

    model_config = {"from_attributes": True}
