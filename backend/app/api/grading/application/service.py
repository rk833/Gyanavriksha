"""Application-layer use cases for the grading bounded context.

Each function orchestrates one grading operation: delegates to the service
layer, maps errors to HTTPExceptions, and keeps the presentation layer clean.
"""
import uuid

from fastapi import BackgroundTasks, HTTPException, status
from sqlalchemy.orm import Session

from app.api.grading.domain.schemas import GradingFeedback, GradingResultResponse
from app.db.models.submission import Submission
from app.db.models.submission_feedback import SubmissionFeedback
from app.services import ocr_service
from app.shared.source_enum import SubmissionProcessingStatus


def _get_submission_or_404(db: Session, submission_id: uuid.UUID) -> Submission:
    """Return the submission row or raise 404 if it does not exist."""
    sub = db.query(Submission).filter(Submission.submission_id == submission_id).first()
    if not sub:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Submission not found")
    return sub


def _assert_gradeable(sub: Submission) -> None:
    """Raise 409 when the submission is already past the gradeable state."""
    gradeable = {SubmissionProcessingStatus.QUEUED, SubmissionProcessingStatus.OCR}
    if sub.processing_status not in gradeable:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Submission is already in status '{sub.processing_status.value}'.",
        )


def _build_feedback(feedback: SubmissionFeedback | None) -> GradingFeedback | None:
    """Convert a SubmissionFeedback ORM row to the domain response schema."""
    if not feedback:
        return None
    return GradingFeedback(
        overall_feedback=feedback.overall_feedback,
        step_by_step_corrections=feedback.step_by_step_corrections or [],
        strengths=feedback.strengths,
        improvements=feedback.improvements,
        knowledge_gap_detected=feedback.knowledge_gap_detected,
        failed_at_step=feedback.failed_at_step,
    )


def trigger_grading(
    db: Session,
    background_tasks: BackgroundTasks,
    submission_id: uuid.UUID,
) -> dict:
    """Enqueue OCR and LLM grading for a queued submission as a background task."""
    sub = _get_submission_or_404(db, submission_id)
    _assert_gradeable(sub)
    background_tasks.add_task(ocr_service.process_submission_ocr, db, submission_id)
    return {"message": "Grading started in background", "submission_id": str(submission_id)}


def fetch_grading_result(db: Session, submission_id: uuid.UUID) -> GradingResultResponse:
    """Return the current grading status and feedback for a submission."""
    sub = _get_submission_or_404(db, submission_id)
    feedback = db.query(SubmissionFeedback).filter(
        SubmissionFeedback.submission_id == submission_id
    ).first()
    return GradingResultResponse(
        submission_id=submission_id,
        processing_status=sub.processing_status.value,
        grade_classification=sub.grade_classification.value if sub.grade_classification else None,
        score_percentage=sub.score_percentage,
        feedback=_build_feedback(feedback),
    )
