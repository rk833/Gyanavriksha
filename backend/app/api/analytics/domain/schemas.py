"""Domain schemas for the analytics bounded context.

Value objects and response contracts for heatmap and chat-processing use cases.
"""
import uuid
from datetime import datetime

from pydantic import BaseModel


class HeatmapEntry(BaseModel):
    """Represents one concept heatmap data point for a student."""

    subject_id: int
    concept_name: str
    topic_tag: str
    occurrence_count: int
    proficiency_score: float | None
    last_updated_at: datetime
