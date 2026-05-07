import uuid
from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field

from app.shared.source_enum import SubmissionProcessingStatus


# Instructor subject / dashboard schemas

class InstructorSubjectResponse(BaseModel):
    subject_id: int
    subject_name: str
    subject_code: str
    grade_id: int
    grade_name: str | None = None
    student_count: int = 0
    assignment_count: int = 0

    model_config = {"from_attributes": True}


class RecentSubmissionBrief(BaseModel):
    submission_id: uuid.UUID
    student_name: str
    assignment_title: str
    subject_name: str
    status: SubmissionProcessingStatus
    score_percentage: float | None = None
    submitted_at: datetime

    model_config = {"from_attributes": True}


class HeatmapPreviewItem(BaseModel):
    topic_tag: str
    subject_name: str
    struggle_percentage: float
    affected_student_count: int = 0

    model_config = {"from_attributes": True}


class VelocityTableRow(BaseModel):
    student_id: uuid.UUID
    student_name: str
    submission_count: int = 0
    avg_score: float | None = None
    velocity_score: float = 0.0
    trend: str = "stable"

    model_config = {"from_attributes": True}


class InstructorDashboardResponse(BaseModel):
    class_completion: float = 0.0
    class_avg_score: float | None = None
    total_assignments: int = 0
    total_submissions: int = 0
    recent_submissions: list[RecentSubmissionBrief] = []
    heatmap_preview: list[HeatmapPreviewItem] = []
    velocity_table: list[VelocityTableRow] = []

    model_config = {"from_attributes": True}


# Assignment CRUD schemas

class AssignmentCreateRequest(BaseModel):
    title: str = Field(..., min_length=1, max_length=255)
    description: str | None = None
    subject_id: int
    due_date: datetime | None = None
    topic_tags: list[str] | None = None
    max_score: float = Field(100.0, gt=0)
    is_exam_mode: bool = False
    exam_duration_minutes: int | None = Field(None, ge=1, le=600)
    exam_max_pauses: int | None = Field(None, ge=0, le=30)
    exam_strict_proctor: bool = False


class AssignmentUpdateRequest(BaseModel):
    title: str | None = Field(None, min_length=1, max_length=255)
    description: str | None = None
    due_date: datetime | None = None
    topic_tags: list[str] | None = None
    max_score: float | None = Field(None, gt=0)
    is_exam_mode: bool | None = None
    exam_duration_minutes: int | None = Field(None, ge=1, le=600)
    exam_max_pauses: int | None = Field(None, ge=0, le=30)
    exam_strict_proctor: bool | None = None


class InstructorAssignmentResponse(BaseModel):
    assignment_id: uuid.UUID
    title: str
    description: str | None = None
    subject_id: int
    subject_name: str | None = None
    grade_name: str | None = None
    topic_tags: list[str] | None = None
    is_exam_mode: bool = False
    exam_duration_minutes: int | None = None
    exam_max_pauses: int | None = None
    exam_strict_proctor: bool = False
    due_date: datetime | None = None
    is_published: bool = False
    max_score: float = 100.0
    submission_count: int = 0
    avg_score: float | None = None
    created_at: datetime

    model_config = {"from_attributes": True}


class AssignmentRecentSubmission(BaseModel):
    submission_id: uuid.UUID
    student_name: str
    status: SubmissionProcessingStatus
    score_percentage: float | None = None
    submitted_at: datetime

    model_config = {"from_attributes": True}


class InstructorAssignmentDetailResponse(InstructorAssignmentResponse):
    graded_count: int = 0
    pending_count: int = 0
    recent_submissions: list[AssignmentRecentSubmission] = []


# Submission review schemas

class InstructorSubmissionListItem(BaseModel):
    submission_id: uuid.UUID
    student_id: uuid.UUID
    student_name: str | None = None
    student_email: str | None = None
    assignment_id: uuid.UUID
    assignment_title: str | None = None
    subject_name: str | None = None
    assignment_instructor_name: str | None = None
    submitted_at: datetime
    processing_status: SubmissionProcessingStatus
    score_percentage: float | None = None
    file_count: int = 0

    model_config = {"from_attributes": True}


class InstructorSubmissionDetailResponse(InstructorSubmissionListItem):
    image_path: str
    student_email: str | None = None
    uploaded_files: list[dict] = []
    feedback: "InstructorFeedbackResponse | None" = None


class InstructorFeedbackResponse(BaseModel):
    feedback_id: uuid.UUID
    overall_feedback: str
    step_by_step_corrections: list | dict
    score_percentage: float | None = None
    strengths: str | None = None
    improvements: str | None = None
    instructor_comments: str | None = None
    graded_by: uuid.UUID | None = None
    ai_snapshot: dict | None = None
    created_at: datetime

    model_config = {"from_attributes": True}


class FeedbackOverrideRequest(BaseModel):
    score_percentage: float = Field(..., ge=0, le=100)
    overall_feedback: str | None = None
    strengths: str | None = None
    improvements: str | None = None
    instructor_comments: str | None = None


# Analytics schemas

class VelocityAnalyticsResponse(BaseModel):
    class_avg_velocity: float = 0.0
    velocity_trend: list[dict] = []
    completion_distribution: list[dict] = []
    student_velocities: list[VelocityTableRow] = []

    model_config = {"from_attributes": True}


class AtRiskStudentResponse(BaseModel):
    student_id: uuid.UUID
    full_name: str
    email: str
    risk_score: float = 0.0
    risk_factors: list[str] = []
    subjects_at_risk: list[str] = []
    avg_score: float | None = None
    total_submissions: int = 0
    missed_assignments: int = 0

    model_config = {"from_attributes": True}


class ConceptHeatmapEntryResponse(BaseModel):
    topic_tag: str
    concept_name: str
    subject_name: str
    struggle_percentage: float = 0.0
    affected_student_count: int = 0
    avg_score: float | None = None
    severity_score: float | None = None

    model_config = {"from_attributes": True}


class ConceptHeatmapResponse(BaseModel):
    heatmap_entries: list[ConceptHeatmapEntryResponse] = []
    emerging_friction: list[dict] = []
    teaching_insight: str | None = None

    model_config = {"from_attributes": True}


# Knowledge base schemas

class KnowledgeBaseDocumentResponse(BaseModel):
    doc_id: uuid.UUID
    subject_id: int
    subject_name: str | None = None
    grade_name: str | None = None
    file_name: str
    file_size_bytes: int | None = None
    doc_type: str
    created_at: datetime

    model_config = {"from_attributes": True}


# Instructor profile schemas

class InstructorProfileResponse(BaseModel):
    user_id: uuid.UUID
    email: str
    full_name: str
    role: str
    is_active: bool
    is_email_verified: bool = False
    totp_enabled: bool = False
    email_2fa_enabled: bool = False
    profile_image_url: str | None = None
    created_at: datetime
    subjects: list[InstructorSubjectResponse] = []

    model_config = {"from_attributes": True}


class InstructorProfileUpdateRequest(BaseModel):
    full_name: str | None = Field(None, min_length=1, max_length=255)
    profile_image_url: str | None = None


# Phase 2: Subject detail schemas (GD-86)

class StudentInSubjectResponse(BaseModel):
    student_id: uuid.UUID
    full_name: str
    email: str
    total_submissions: int = 0
    avg_score: float | None = None
    completion_percentage: float = 0.0
    last_active: datetime | None = None

    model_config = {"from_attributes": True}


class InstructorSubjectDetailResponse(BaseModel):
    subject_id: int
    subject_name: str
    subject_code: str
    description: str | None = None
    grade_id: int
    grade_name: str | None = None
    student_count: int = 0
    assignment_count: int = 0
    total_submissions: int = 0
    class_avg_score: float | None = None
    students: list[StudentInSubjectResponse] = []
    students_total: int = 0
    students_page: int = 1
    students_per_page: int = 20
    students_total_pages: int = 0

    model_config = {"from_attributes": True}


# ── Live exam monitor (IoT + sessions) ──────────────────────────────────────


class ExamMonitorAssignmentOption(BaseModel):
    assignment_id: uuid.UUID
    title: str
    subject_name: str
    grade_name: str | None = None
    due_date: datetime | None = None


class ExamMonitorStudentRow(BaseModel):
    student_id: uuid.UUID
    full_name: str
    session_id: uuid.UUID | None = None
    session_status: str
    progress_pct: int
    seconds_remaining: int | None = None
    presence_label: str
    posture_label: str
    light_raw: float | None = None
    device_online: bool
    pause_count: int | None = None
    absence_alerts: int | None = None
    session_end_reason: str | None = None


class ExamMonitorEventRow(BaseModel):
    sent_at: datetime
    student_id: uuid.UUID
    student_name: str
    category: str
    description: str
    status_label: str
    event_kind: Literal["auto_pause", "exam_ended"] = "auto_pause"


class ExamMonitorResponse(BaseModel):
    assignments: list[ExamMonitorAssignmentOption]
    selected_assignment_id: uuid.UUID | None = None
    assignment_title: str | None = None
    subject_name: str | None = None
    grade_name: str | None = None
    due_date: datetime | None = None
    exam_duration_minutes: int | None = None
    enrolled_total: int = 0
    active_count: int = 0
    paused_count: int = 0
    submitted_count: int = 0
    avg_seconds_remaining: float | None = None
    students: list[ExamMonitorStudentRow] = []
    events: list[ExamMonitorEventRow] = []
