"""Presentation layer for the quiz bounded context.

Route handlers declare HTTP contracts and immediately delegate to the
application-layer use cases. No business logic occurs here.
"""
import json
import uuid

from fastapi import APIRouter, BackgroundTasks, Depends, status
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session

from app.api.quiz.application import service
from app.api.quiz.domain.schemas import DetectGapsInput, GenerateQuizInput
from app.core.database import get_db

router = APIRouter(prefix="/api/quiz", tags=["Quiz"])


@router.post("/detect-gaps", status_code=status.HTTP_202_ACCEPTED)
async def trigger_gap_detection(
    payload: DetectGapsInput,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
):
    """Enqueue knowledge-gap detection for a completed chat session."""
    return await service.trigger_gap_detection(db, background_tasks, payload)


@router.post("/generate", status_code=status.HTTP_201_CREATED)
async def generate_quiz(
    payload: GenerateQuizInput,
    db: Session = Depends(get_db),
):
    """Generate an AI micro-quiz for a concept and return the saved quiz."""
    return await service.generate_quiz(db, payload)


@router.post("/generate-stream")
async def generate_quiz_stream(
    payload: GenerateQuizInput,
    db: Session = Depends(get_db),
):
    """Stream quiz generation as NDJSON: ``question`` events, then ``complete`` with saved quiz."""

    async def ndjson():
        try:
            async for ev in service.stream_generate_quiz(db, payload):
                yield (json.dumps(ev, default=str) + "\n").encode("utf-8")
        except Exception as exc:
            yield (json.dumps({"type": "error", "detail": str(exc)}) + "\n").encode("utf-8")

    return StreamingResponse(ndjson(), media_type="application/x-ndjson")


@router.get("/students/{student_id}")
async def list_quizzes(
    student_id: uuid.UUID,
    subject_id: int | None = None,
    page: int = 1,
    per_page: int = 20,
    db: Session = Depends(get_db),
):
    """Return a paginated list of micro-quizzes for a student."""
    return service.list_quizzes(db, student_id, subject_id, page, per_page)


@router.get("/students/{student_id}/{quiz_id}")
async def get_quiz(
    student_id: uuid.UUID,
    quiz_id: uuid.UUID,
    db: Session = Depends(get_db),
):
    """Return a specific micro-quiz for a student."""
    return service.get_quiz(db, student_id, quiz_id)
