import uuid
from datetime import datetime

from pydantic import BaseModel


class KnowledgeGapResponse(BaseModel):
    gap_id: uuid.UUID
    concept_name: str
    topic_tag: str
    recurrence_count: int
    is_resolved: bool
    detected_at: datetime
    subject_id: int
    subject_name: str | None = None

    model_config = {"from_attributes": True}


class KnowledgeGapSummary(BaseModel):
    total_gaps: int
    gaps_resolved: int
    gaps_pending: int


class ScoreDataPoint(BaseModel):
    period: str
    score: float
    subject: str


class TopicDifficulty(BaseModel):
    topic: str
    difficulty_score: float


class StudentProgressResponse(BaseModel):
    average_score: float | None = None
    trend_percentage: float | None = None
    quizzes_completed: int = 0
    active_streak: int = 0
    score_progression: list[ScoreDataPoint] = []
    topic_difficulty: list[TopicDifficulty] = []
    at_risk_flag: bool = False
    improvement_tips: list[str] = []


class DashboardResponse(BaseModel):
    student_name: str
    current_subject: dict | None = None
    enrolled_subjects: list[dict] = []
    recent_submissions: list[dict] = []
    total_submissions: int = 0
    average_score: float | None = None
    knowledge_gaps_count: int = 0
    upcoming_assignments: list[dict] = []
    notifications_unread_count: int = 0
