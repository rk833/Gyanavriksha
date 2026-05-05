import logging
from functools import lru_cache

from fastapi import APIRouter, HTTPException, Depends
from app.quiz_generator.service import QuizGeneratorService, GeneratedQuiz
from app.quiz_generator.gap_detector import QuizGapDetector, GapAnalysisResult
from pydantic import BaseModel, Field
from typing import Optional

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/quiz", tags=["Quiz Generator"])

class QuizGenerateRequest(BaseModel):
    concept: str
    num_questions: int = 5
    user_type: str = "admin"
    grade: Optional[int] = None
    instructor_id: Optional[str] = None
    class_id: Optional[str] = None
    student_id: Optional[str] = None
    avoid_question_texts: list[str] = Field(default_factory=list)

class GapDetectRequest(BaseModel):
    student_id: str
    subject: str
    chat_log: str

@lru_cache(maxsize=1)
def get_quiz_service() -> QuizGeneratorService:
    """Reuse one generator + one RAG/embeddings stack across requests (avoid reloading BERT each call)."""
    return QuizGeneratorService()


def get_gap_detector():
    return QuizGapDetector()

@router.post("/generate", response_model=GeneratedQuiz)
async def generate_quiz_endpoint(
    request: QuizGenerateRequest,
    service: QuizGeneratorService = Depends(get_quiz_service)
):
    """
    Generate a quiz based on a concept and retrieved context.
    """
    try:
        quiz = await service.generate_quiz(
            concept=request.concept,
            num_questions=request.num_questions,
            user_type=request.user_type,
            grade=request.grade,
            instructor_id=request.instructor_id,
            class_id=request.class_id,
            student_id=request.student_id,
            avoid_question_texts=request.avoid_question_texts or [],
        )
        return quiz
    except Exception as e:
        logger.exception("Quiz /generate failed")
        raise HTTPException(status_code=500, detail=f"Failed to generate quiz: {str(e)}")

@router.post("/detect-gaps", response_model=GapAnalysisResult)
async def detect_gaps_endpoint(
    request: GapDetectRequest,
    detector: QuizGapDetector = Depends(get_gap_detector)
):
    """
    Detect knowledge gaps from chat history to identify quiz targets.
    """
    try:
        gaps = await detector.detect_gaps(
            student_id=request.student_id,
            subject=request.subject,
            chat_log=request.chat_log
        )
        return gaps
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to detect gaps: {str(e)}")
