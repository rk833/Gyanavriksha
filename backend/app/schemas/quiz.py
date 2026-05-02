from datetime import datetime
from uuid import UUID
from typing import List, Optional
from pydantic import BaseModel
from app.shared.source_enum import MicroQuizStatus, QuestionType, QuestionDifficulty

class QuizQuestionSchema(BaseModel):
    question_id: UUID
    question_text: str
    question_type: QuestionType
    options: Optional[List[str]] = None
    correct_answer: str
    explanation: Optional[str] = None
    difficulty: QuestionDifficulty
    order_num: int

    class Config:
        from_attributes = True

class MicroQuizSchema(BaseModel):
    quiz_id: UUID
    student_id: UUID
    subject_id: int
    concept_targeted: str
    total_questions: int
    status: MicroQuizStatus
    score_percentage: Optional[float] = None
    completed_at: Optional[datetime] = None
    created_at: datetime
    questions: Optional[List[QuizQuestionSchema]] = None

    class Config:
        from_attributes = True

class QuizGenerateRequest(BaseModel):
    subject_id: int
    concept: str
    num_questions: int = 5
