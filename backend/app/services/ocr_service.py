"""OCR and grading dispatch service.

Picks up a QUEUED submission, sends the image to the AI service for OCR and
LLM grading, then writes the results back to ``submissions`` and
``submission_feedback``.
"""
import logging
import mimetypes
import os
import uuid
from datetime import datetime, timezone
from typing import Any

import httpx
from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.core.config import settings
from app.db.models.assignment import Assignment
from app.db.models.submission import Submission
from app.db.models.submission_feedback import SubmissionFeedback
from app.db.models.subject import Subject
from app.shared.source_enum import GradeClassification, SubmissionProcessingStatus

logger = logging.getLogger(__name__)

_CLASSIFICATION_MAP: dict[str, GradeClassification] = {
    "correct": GradeClassification.CORRECT,
    "partial": GradeClassification.PARTIAL,
    "incorrect": GradeClassification.INCORRECT,
}


# Private helpers

def _get_submission_or_404(db: Session, submission_id: uuid.UUID) -> Submission:
    """Return the Submission row or raise 404."""
    sub = db.query(Submission).filter(Submission.submission_id == submission_id).first()
    if not sub:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Submission not found")
    return sub


def _assert_gradeable_state(sub: Submission) -> None:
    """Raise 409 when the submission is not in a state that allows grading."""
    gradeable = {SubmissionProcessingStatus.QUEUED, SubmissionProcessingStatus.OCR}
    if sub.processing_status not in gradeable:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Submission is already in status '{sub.processing_status.value}'.",
        )


def _read_submission_context(db: Session, sub: Submission) -> tuple[str, str, str]:
    """Return (subject_name, question_text, expected_answer) for the submission."""
    assignment = db.query(Assignment).filter(Assignment.assignment_id == sub.assignment_id).first()
    subject = db.query(Subject).filter(Subject.subject_id == sub.subject_id).first()
    subject_name = subject.subject_name if subject else "Unknown"
    question_text = assignment.title if assignment else "Assignment"
    expected_answer = (assignment.instructions if assignment and assignment.instructions else "N/A")
    return subject_name, question_text, expected_answer


def _read_image_file(image_path: str) -> tuple[bytes, str, str]:
    """Read the image file and return (bytes, content_type, filename).

    Raises FileNotFoundError when the file does not exist on disk.
    """
    if not os.path.exists(image_path):
        raise FileNotFoundError(f"Submission image not found at {image_path}")
    with open(image_path, "rb") as fh:
        image_bytes = fh.read()
    content_type, _ = mimetypes.guess_type(image_path)
    return image_bytes, (content_type or "image/jpeg"), os.path.basename(image_path)


async def _call_grading_endpoint(
    image_bytes: bytes,
    filename: str,
    content_type: str,
    submission_id: str,
    subject: str,
    question: str,
    expected_answer: str,
) -> dict[str, Any]:
    """POST the image and grading context to the AI service grading endpoint."""
    url = f"{settings.AI_SERVICE_URL}/grading/process"
    try:
        async with httpx.AsyncClient(timeout=settings.AI_SERVICE_LONG_TIMEOUT) as client:
            response = await client.post(
                url,
                data={
                    "submission_id": submission_id,
                    "subject": subject,
                    "question": question,
                    "expected_answer": expected_answer,
                },
                files={"file": (filename, image_bytes, content_type)},
            )
        if response.status_code == status.HTTP_422_UNPROCESSABLE_ENTITY:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail=f"AI grading rejected the payload: {response.text}",
            )
        if not response.is_success:
            logger.error("Grading endpoint %s returned %s", url, response.status_code)
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail="AI grading service returned an error. Please retry.",
            )
        return response.json()
    except httpx.TimeoutException as exc:
        raise HTTPException(
            status_code=status.HTTP_504_GATEWAY_TIMEOUT,
            detail="AI grading timed out.",
        ) from exc
    except httpx.ConnectError as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="AI service is unavailable.",
        ) from exc


def _write_grading_result(db: Session, sub: Submission, result: dict[str, Any]) -> None:
    """Persist the AI grading result to Submission and SubmissionFeedback rows."""
    raw_class = result.get("grade_classification", "incorrect")
    sub.grade_classification = _CLASSIFICATION_MAP.get(raw_class, GradeClassification.INCORRECT)
    sub.score_percentage = result.get("score_percentage")
    sub.processing_status = SubmissionProcessingStatus.DONE
    sub.processing_completed_at = datetime.now(timezone.utc)
    existing = db.query(SubmissionFeedback).filter(
        SubmissionFeedback.submission_id == sub.submission_id
    ).first()
    if existing:
        existing.overall_feedback = result.get("overall_feedback", "")
        existing.step_by_step_corrections = result.get("step_by_step_corrections", [])
        existing.failed_at_step = result.get("failed_at_step")
        existing.score_percentage = result.get("score_percentage")
        existing.strengths = result.get("strengths")
        existing.improvements = result.get("improvements")
        existing.knowledge_gap_detected = result.get("knowledge_gap_detected", False)
    else:
        db.add(SubmissionFeedback(
            submission_id=sub.submission_id,
            overall_feedback=result.get("overall_feedback", ""),
            step_by_step_corrections=result.get("step_by_step_corrections", []),
            failed_at_step=result.get("failed_at_step"),
            score_percentage=result.get("score_percentage"),
            strengths=result.get("strengths"),
            improvements=result.get("improvements"),
            knowledge_gap_detected=result.get("knowledge_gap_detected", False),
            llm_model_used="gemini-2.5-flash",
        ))
    db.commit()


# Public API

async def process_submission_ocr(db: Session, submission_id: uuid.UUID) -> dict[str, Any]:
    """Run the full OCR and grading pipeline for one submission.

    Transitions the submission through QUEUED → OCR → GRADING → DONE,
    writing the grade and feedback back to the database on success.
    """
    sub = _get_submission_or_404(db, submission_id)
    _assert_gradeable_state(sub)
    sub.processing_status = SubmissionProcessingStatus.OCR
    sub.processing_started_at = datetime.now(timezone.utc)
    db.commit()
    subject_name, question_text, expected_answer = _read_submission_context(db, sub)
    try:
        image_bytes, content_type, filename = _read_image_file(sub.image_path)
        sub.processing_status = SubmissionProcessingStatus.GRADING
        db.commit()
        result = await _call_grading_endpoint(
            image_bytes=image_bytes,
            filename=filename,
            content_type=content_type,
            submission_id=str(submission_id),
            subject=subject_name,
            question=question_text,
            expected_answer=expected_answer,
        )
    except HTTPException:
        sub.processing_status = SubmissionProcessingStatus.QUEUED
        db.commit()
        raise
    except FileNotFoundError as exc:
        sub.processing_status = SubmissionProcessingStatus.REJECTED
        sub.quality_rejection_reason = str(exc)
        db.commit()
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=str(exc),
        ) from exc
    _write_grading_result(db, sub, result)
    logger.info(
        "Submission %s graded: %s (%.1f%%)",
        submission_id,
        sub.grade_classification.value,
        sub.score_percentage or 0,
    )
    return result
