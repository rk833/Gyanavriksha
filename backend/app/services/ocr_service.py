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
from app.db.models.knowledge_gap import KnowledgeGap
from app.db.models.submission import Submission
from app.db.models.submission_feedback import SubmissionFeedback
from app.db.models.subject import Subject
from app.shared.source_enum import GradeClassification, NotificationType, SubmissionProcessingStatus

logger = logging.getLogger(__name__)

# Same root as submission_service: backend/uploads
UPLOAD_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), "uploads")

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
    expected_answer = (
        (assignment.description or "").strip() or "N/A"
        if assignment
        else "N/A"
    )
    return subject_name, question_text, expected_answer


def _all_submission_file_paths(image_path: str) -> list[str]:
    """Return every stored path from a comma-separated image_path field."""
    if not image_path:
        return []
    return [p.strip() for p in image_path.split(",") if p.strip()]


def _resolve_absolute_path(stored: str) -> str:
    """Resolve a single DB-relative path to an absolute filesystem path."""
    rel = (stored or "").strip().replace("\\", os.sep)
    if not rel:
        return ""
    if os.path.isabs(rel):
        return rel
    parts = rel.split(os.sep)
    if parts and parts[0].lower() == "uploads":
        rel = os.path.join(*parts[1:]) if len(parts) > 1 else ""
    return os.path.normpath(os.path.join(UPLOAD_DIR, rel))


def _read_one_file(stored_path: str) -> tuple[bytes, str, str]:
    """Read one file from disk → (bytes, content_type, filename)."""
    abs_path = _resolve_absolute_path(stored_path)
    if not abs_path or not os.path.isfile(abs_path):
        raise FileNotFoundError(
            f"Submission file not found at {abs_path!r} (stored: {stored_path!r})"
        )
    with open(abs_path, "rb") as fh:
        data = fh.read()
    content_type, _ = mimetypes.guess_type(abs_path)
    if abs_path.lower().endswith(".pdf"):
        content_type = "application/pdf"
    return data, (content_type or "image/jpeg"), os.path.basename(abs_path)


def _read_all_files(image_path: str) -> list[tuple[bytes, str, str]]:
    """Read every stored file → list of (bytes, content_type, filename)."""
    return [_read_one_file(p) for p in _all_submission_file_paths(image_path)]


async def _ocr_extract(
    image_bytes: bytes,
    filename: str,
    content_type: str,
) -> str:
    """Call the AI service OCR-only endpoint and return the extracted text."""
    url = f"{settings.AI_SERVICE_URL}/grading/extract-text"
    try:
        async with httpx.AsyncClient(timeout=settings.AI_SERVICE_LONG_TIMEOUT) as client:
            response = await client.post(
                url,
                files={"file": (filename, image_bytes, content_type)},
            )
        if not response.is_success:
            logger.warning("OCR extract returned %s for %s", response.status_code, filename)
            return ""
        return (response.json() or {}).get("extracted_text", "")
    except (httpx.TimeoutException, httpx.ConnectError) as exc:
        logger.warning("OCR extract request failed for %s: %s", filename, exc)
        return ""


async def _call_grading_endpoint(
    image_bytes: bytes,
    filename: str,
    content_type: str,
    submission_id: str,
    subject: str,
    question: str,
    expected_answer: str,
    pre_extracted_text: str | None = None,
) -> dict[str, Any]:
    """POST to the AI service grading endpoint.

    When *pre_extracted_text* is provided (multi-page flow) the AI service skips
    OCR and grades the supplied text directly, saving one Vision API call.
    """
    url = f"{settings.AI_SERVICE_URL}/grading/process"
    form_data: dict[str, str] = {
        "submission_id": submission_id,
        "subject": subject,
        "question": question,
        "expected_answer": expected_answer,
    }
    if pre_extracted_text and pre_extracted_text.strip():
        form_data["extracted_text"] = pre_extracted_text

    try:
        async with httpx.AsyncClient(timeout=settings.AI_SERVICE_LONG_TIMEOUT) as client:
            response = await client.post(
                url,
                data=form_data,
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


def _write_grading_result(db: Session, sub: Submission, result: dict[str, Any]) -> KnowledgeGap | None:
    """Persist the AI grading result to Submission and SubmissionFeedback rows.

    When ``knowledge_gap_detected`` is true (and the row is not instructor-overridden),
    upserts a ``KnowledgeGap`` row before commit and returns it so callers can enqueue a micro-quiz.
    """
    existing = db.query(SubmissionFeedback).filter(
        SubmissionFeedback.submission_id == sub.submission_id
    ).first()
    if existing and existing.graded_by is not None:
        # Instructor has published a grade — keep official feedback/score; store latest AI run separately.
        existing.ai_snapshot = {
            "score_percentage": result.get("score_percentage"),
            "overall_feedback": result.get("overall_feedback", ""),
            "step_by_step_corrections": result.get("step_by_step_corrections", []),
            "strengths": result.get("strengths"),
            "improvements": result.get("improvements"),
        }
        db.commit()
        return None

    raw_class = result.get("grade_classification", "incorrect")
    sub.grade_classification = _CLASSIFICATION_MAP.get(raw_class, GradeClassification.INCORRECT)
    sub.score_percentage = result.get("score_percentage")
    sub.processing_status = SubmissionProcessingStatus.DONE
    sub.processing_completed_at = datetime.now(timezone.utc)
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
    gap_row: KnowledgeGap | None = None
    if result.get("knowledge_gap_detected"):
        from app.services import quiz_service

        gap_row = quiz_service.upsert_gap_from_grading(db, sub, result)
    db.commit()
    return gap_row


# Public API

async def process_submission_ocr(db: Session, submission_id: uuid.UUID) -> dict[str, Any]:
    """Run the full OCR and grading pipeline for one submission.

    Multi-file flow (e.g. 3 pages of handwriting):
      1. Read all stored files.
      2. OCR each file individually via /grading/extract-text (parallel).
      3. Combine the page texts into one document.
      4. Call /grading/process once with the combined text → single grade.

    Single-file flow falls through to the same path with no extra round-trips.

    Status transitions: QUEUED → OCR → GRADING → DONE (or REJECTED on error).
    """
    sub = _get_submission_or_404(db, submission_id)
    _assert_gradeable_state(sub)
    sub.processing_status = SubmissionProcessingStatus.OCR
    sub.processing_started_at = datetime.now(timezone.utc)
    db.commit()

    subject_name, question_text, expected_answer = _read_submission_context(db, sub)

    try:
        all_files = _read_all_files(sub.image_path)
        if not all_files:
            raise FileNotFoundError(f"No files found for submission {submission_id}")

        # ── OCR every file, combine text ──────────────────────────────────────
        if len(all_files) == 1:
            # Single file: let the grading endpoint do OCR+grade in one shot.
            combined_text: str | None = None
        else:
            # Multiple files: OCR each page, concatenate, then grade once.
            import asyncio
            page_texts = await asyncio.gather(*[
                _ocr_extract(img, fname, ct)
                for img, ct, fname in all_files
            ])
            combined_text = "\n\n---\n\n".join(
                f"[Page {i + 1}]\n{t}" for i, t in enumerate(page_texts) if t.strip()
            )
            logger.info(
                "Submission %s — OCR'd %d/%d pages (%d chars total)",
                submission_id, sum(1 for t in page_texts if t.strip()),
                len(all_files), len(combined_text),
            )

        # ── Grade with the first file as the "anchor" file ───────────────────
        # (The grading endpoint still needs one file for content_type detection
        #  even when pre_extracted_text is supplied.)
        first_bytes, first_ct, first_name = all_files[0]

        sub.processing_status = SubmissionProcessingStatus.GRADING
        db.commit()

        result = await _call_grading_endpoint(
            image_bytes=first_bytes,
            filename=first_name,
            content_type=first_ct or "image/jpeg",
            submission_id=str(submission_id),
            subject=subject_name,
            question=question_text,
            expected_answer=expected_answer,
            pre_extracted_text=combined_text,
        )

    except HTTPException as exc:
        sub.processing_status = SubmissionProcessingStatus.QUEUED
        db.commit()
        logger.warning("Grading HTTP error for %s: %s", submission_id, str(exc.detail))
        return {"error": exc.detail, "status_code": exc.status_code}
    except FileNotFoundError as exc:
        sub.processing_status = SubmissionProcessingStatus.REJECTED
        sub.quality_rejection_reason = str(exc)
        db.commit()
        logger.error("Submission file missing for %s: %s", submission_id, exc)
        return {"error": str(exc)}
    gap = _write_grading_result(db, sub, result)
    if gap:
        from app.services import quiz_service

        db.refresh(gap)
        await quiz_service.generate_quiz_if_eligible(db, gap)

    # ── Notify student that their submission has been graded ─────────────────
    try:
        from app.services import notification_service

        assignment = db.query(Assignment).filter(Assignment.assignment_id == sub.assignment_id).first()
        assignment_title = assignment.title if assignment else "your assignment"
        score = sub.score_percentage
        classification = sub.grade_classification.value if sub.grade_classification else "graded"
        score_text = f"{score:.0f}%" if score is not None else classification

        notification_service.create_notification(
            db=db,
            recipient_id=sub.student_id,
            notification_type=NotificationType.GRADING_DONE,
            title="Assignment Graded",
            body=f'"{assignment_title}" has been graded — you scored {score_text}.',
            related_resource_id=str(sub.submission_id),
        )
        db.commit()
    except Exception as exc:
        logger.warning("Failed to create grading notification: %s", exc)

    logger.info(
        "Submission %s graded: %s (%.1f%%)",
        submission_id,
        sub.grade_classification.value,
        sub.score_percentage or 0,
    )
    return result
