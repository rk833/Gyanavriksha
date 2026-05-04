"""Presentation layer for the grading bounded context.

Route handlers declare HTTP contracts and immediately delegate to the
application-layer use cases. No business logic occurs here.
"""
import uuid

from fastapi import APIRouter, BackgroundTasks, Depends, status
from sqlalchemy.orm import Session

from app.api.grading.application import service
from app.api.grading.domain.schemas import GradingResultResponse
from app.core.database import get_db

router = APIRouter(prefix="/api/grading", tags=["Grading"])


@router.post("/submissions/{submission_id}/process", status_code=status.HTTP_202_ACCEPTED)
async def trigger_grading(
    submission_id: uuid.UUID,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
):
    """Enqueue OCR and LLM grading for a queued submission."""
    return service.trigger_grading(db, background_tasks, submission_id)


@router.get("/submissions/{submission_id}/result", response_model=GradingResultResponse)
async def get_grading_result(
    submission_id: uuid.UUID,
    db: Session = Depends(get_db),
):
    """Return the current grading status and feedback for a submission."""
    return service.fetch_grading_result(db, submission_id)
