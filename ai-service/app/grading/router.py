"""
Grading router for the AI microservice.

POST /grading/process — OCR + LLM grade a submitted image
"""
from fastapi import APIRouter, File, Form, HTTPException, UploadFile, status

from app.grading.evaluator import GradingEvaluator

router = APIRouter(prefix="/grading", tags=["Grading"])

_evaluator: GradingEvaluator | None = None


def _get_evaluator() -> GradingEvaluator:
    global _evaluator
    if _evaluator is None:
        _evaluator = GradingEvaluator()
    return _evaluator


@router.post("/process")
async def process_submission(
    file: UploadFile = File(..., description="Student's handwritten submission image"),
    submission_id: str = Form(...),
    subject: str = Form(...),
    question: str = Form(...),
    expected_answer: str = Form(...),
):
    """
    OCR the image and grade it against the expected answer.

    Returns structured grading feedback including score, grade classification,
    per-step corrections, and knowledge-gap detection.
    """
    allowed_types = {"image/jpeg", "image/png", "image/webp", "application/pdf"}
    if file.content_type not in allowed_types:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Unsupported file type: {file.content_type}. Allowed: jpeg, png, webp, pdf.",
        )

    image_bytes = await file.read()
    if len(image_bytes) > 10 * 1024 * 1024:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="File too large. Maximum allowed size is 10 MB.",
        )

    evaluator = _get_evaluator()
    result = await evaluator.grade(
        image_bytes=image_bytes,
        subject=subject,
        question=question,
        expected_answer=expected_answer,
        content_type=file.content_type or "image/jpeg",
    )
    result["submission_id"] = submission_id
    return result
