"""Application-layer use cases for the quiz bounded context.

Each function orchestrates one quiz operation: delegates to the service layer,
maps errors to HTTPExceptions, and keeps the presentation layer clean.
"""
import uuid
from collections.abc import AsyncIterator
from typing import Any

from fastapi import BackgroundTasks, HTTPException, status
from sqlalchemy.orm import Session

from app.api.quiz.domain.schemas import DetectGapsInput, GenerateQuizInput
from app.db.models.micro_quiz import MicroQuiz
from app.services import quiz_service


def _raise_if_not_found(obj: object, detail: str) -> None:
    """Raise 404 when the given object is None."""
    if obj is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=detail)


async def trigger_gap_detection(
    db: Session,
    background_tasks: BackgroundTasks,
    payload: DetectGapsInput,
) -> dict:
    """Enqueue knowledge-gap detection for a completed chat session."""
    background_tasks.add_task(quiz_service.detect_gaps_for_quiz, db, payload.history_id)
    return {"message": "Gap detection started in background", "history_id": str(payload.history_id)}


async def generate_quiz(db: Session, payload: GenerateQuizInput) -> MicroQuiz:
    """Generate an AI micro-quiz for a concept and return the saved quiz record."""
    quiz = await quiz_service.generate_and_save_quiz(
        db=db,
        student_id=payload.student_id,
        subject_id=payload.subject_id,
        concept=payload.concept,
        num_questions=payload.num_questions,
        gap_id=payload.gap_id,
    )
    return quiz


async def stream_generate_quiz(
    db: Session, payload: GenerateQuizInput
) -> AsyncIterator[dict[str, Any]]:
    """Yield NDJSON events: one per generated question, then a complete quiz payload."""
    async for event in quiz_service.stream_generate_quiz_events(
        db,
        student_id=payload.student_id,
        subject_id=payload.subject_id,
        concept=payload.concept,
        num_questions=payload.num_questions,
        gap_id=payload.gap_id,
    ):
        yield event


def list_quizzes(
    db: Session,
    student_id: uuid.UUID,
    subject_id: int | None,
    page: int,
    per_page: int,
) -> dict:
    """Return a paginated list of micro-quizzes for a student."""
    quizzes, total = quiz_service.get_quizzes_for_student(
        db, student_id, subject_id=subject_id, page=page, per_page=per_page
    )
    return {"total": total, "page": page, "per_page": per_page, "results": quizzes}


def get_quiz(db: Session, student_id: uuid.UUID, quiz_id: uuid.UUID) -> MicroQuiz:
    """Return a specific micro-quiz for a student or raise 404."""
    quiz = quiz_service.get_quiz_detail(db, student_id, quiz_id)
    _raise_if_not_found(quiz, "Quiz not found")
    return quiz
