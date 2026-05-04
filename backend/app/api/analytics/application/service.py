"""Application-layer use cases for the analytics bounded context.

Each function orchestrates one analytics operation: delegates to the service
layer, maps errors to HTTPExceptions, and keeps the presentation layer clean.
"""
import uuid

from fastapi import BackgroundTasks
from sqlalchemy.orm import Session

from app.api.analytics.domain.schemas import HeatmapEntry
from app.db.models.concept_heatmap_entry import ConceptHeatmapEntry
from app.services import heatmap_service


def trigger_chat_processing(
    db: Session,
    background_tasks: BackgroundTasks,
    history_id: uuid.UUID,
) -> dict:
    """Enqueue heatmap generation for a completed chat session as a background task."""
    background_tasks.add_task(heatmap_service.process_chat_heatmap, db, history_id)
    return {"message": "Chat processing started in background"}


def get_student_heatmap(db: Session, student_id: uuid.UUID) -> list[HeatmapEntry]:
    """Return all concept heatmap entries for a student."""
    entries = db.query(ConceptHeatmapEntry).filter(
        ConceptHeatmapEntry.student_id == student_id
    ).all()
    return [
        HeatmapEntry(
            subject_id=e.subject_id,
            concept_name=e.concept_name,
            topic_tag=e.topic_tag,
            occurrence_count=e.occurrence_count,
            proficiency_score=e.proficiency_score,
            last_updated_at=e.last_updated_at,
        )
        for e in entries
    ]
