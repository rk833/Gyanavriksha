"""Presentation layer for the analytics bounded context.

Route handlers declare HTTP contracts and immediately delegate to the
application-layer use cases. No business logic occurs here.
"""
import uuid

from fastapi import APIRouter, BackgroundTasks, Depends
from sqlalchemy.orm import Session

from app.api.analytics.application import service
from app.api.analytics.domain.schemas import HeatmapEntry
from app.core.database import get_db

router = APIRouter(prefix="/analytics", tags=["Analytics"])


@router.post("/process-chat/{history_id}")
async def trigger_chat_processing(
    history_id: uuid.UUID,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
):
    """Enqueue heatmap generation for a completed chat session."""
    return service.trigger_chat_processing(db, background_tasks, history_id)


@router.get("/heatmap/{student_id}", response_model=list[HeatmapEntry])
async def get_student_heatmap(
    student_id: uuid.UUID,
    db: Session = Depends(get_db),
):
    """Return all concept heatmap entries for a student."""
    return service.get_student_heatmap(db, student_id)
