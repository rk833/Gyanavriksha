"""
Grading router for the AI microservice.

POST /grading/extract-text — OCR only (no LLM), for multi-page batching
POST /grading/process      — OCR + LLM grade a submitted image/pdf
"""
from typing import Optional

from fastapi import APIRouter, File, Form, HTTPException, UploadFile, status

from app.grading.evaluator import GradingEvaluator

router = APIRouter(prefix="/grading", tags=["Grading"])

_evaluator: GradingEvaluator | None = None
_ALLOWED = {"image/jpeg", "image/png", "image/webp", "application/pdf"}
_MAX_BYTES = 10 * 1024 * 1024  # 10 MB


def _get_evaluator() -> GradingEvaluator:
    global _evaluator
    if _evaluator is None:
        _evaluator = GradingEvaluator()
    return _evaluator


def _validate_file(file: UploadFile, image_bytes: bytes) -> None:
    if file.content_type not in _ALLOWED:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Unsupported file type: {file.content_type}. Allowed: jpeg, png, webp, pdf.",
        )
    if len(image_bytes) > _MAX_BYTES:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="File too large. Maximum allowed size is 10 MB.",
        )


@router.post("/extract-text")
async def extract_text(
    file: UploadFile = File(..., description="Image or PDF page to OCR"),
):
    """
    OCR a single file and return its extracted text.
    No LLM grading — used by the backend to OCR each page before combining them.
    """
    image_bytes = await file.read()
    _validate_file(file, image_bytes)
    evaluator = _get_evaluator()
    return await evaluator.extract_text(
        image_bytes=image_bytes,
        content_type=file.content_type or "image/jpeg",
    )


@router.post("/process")
async def process_submission(
    file: UploadFile = File(..., description="Student's handwritten submission image"),
    submission_id: str = Form(...),
    subject: str = Form(...),
    question: str = Form(...),
    expected_answer: str = Form(...),
    extracted_text: Optional[str] = Form(
        None,
        description="Pre-extracted OCR text (all pages combined). If provided, OCR is skipped.",
    ),
):
    """
    Grade a submission against the expected answer.

    When ``extracted_text`` is supplied (multi-page flow), OCR is skipped and
    the LLM grades the pre-combined text directly.  Otherwise the uploaded file
    is OCR'd first.
    """
    image_bytes = await file.read()
    _validate_file(file, image_bytes)

    evaluator = _get_evaluator()
    result = await evaluator.grade(
        image_bytes=image_bytes,
        subject=subject,
        question=question,
        expected_answer=expected_answer,
        content_type=file.content_type or "image/jpeg",
        pre_extracted_text=extracted_text if extracted_text and extracted_text.strip() else None,
    )
    result["submission_id"] = submission_id
    return result
