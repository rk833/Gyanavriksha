import uuid
from datetime import datetime

from pydantic import BaseModel

from app.shared.source_enum import GradeClassification, SubmissionProcessingStatus


class SubmissionCreateRequest(BaseModel):
    assignment_id: uuid.UUID


class SubmissionListItem(BaseModel):
    submission_id: uuid.UUID
    assignment_id: uuid.UUID
    assignment_title: str | None = None
    subject_name: str | None = None
    submitted_at: datetime
    processing_status: SubmissionProcessingStatus
    grade_classification: GradeClassification | None = None
    score_percentage: float | None = None

    model_config = {"from_attributes": True}


class SubmissionDetailResponse(SubmissionListItem):
    image_path: str
    image_quality_score: float | None = None
    is_exam_submission: bool = False
    assignment_description: str | None = None
    assignment_max_score: float = 100.0
    uploaded_files: list[dict] = []
    feedback: "SubmissionFeedbackResponse | None" = None
    knowledge_gaps: list["KnowledgeGapBrief"] | None = None


class SubmissionFeedbackResponse(BaseModel):
    feedback_id: uuid.UUID
    overall_feedback: str
    step_by_step_corrections: list | dict
    failed_at_step: str | None = None
    rag_chunks_used: list[str] | None = None
    llm_model_used: str | None = None
    knowledge_gap_detected: bool = False
    score_percentage: float | None = None
    strengths: str | None = None
    improvements: str | None = None
    graded_by: uuid.UUID | None = None
    ai_snapshot: dict | None = None
    created_at: datetime

    model_config = {"from_attributes": True}


class KnowledgeGapBrief(BaseModel):
    gap_id: uuid.UUID
    concept_name: str
    topic_tag: str

    model_config = {"from_attributes": True}
