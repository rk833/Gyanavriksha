"""Quiz and knowledge-gap service.

Detects knowledge gaps from a chat session and generates AI-powered micro-quizzes
targeting those gaps. Also provides read helpers for the student quiz feed.
"""
import os
import uuid
from datetime import datetime
from typing import Any

from sqlalchemy.orm import Session

from app.core.ai_client import ai_post
from app.db.models.chat_history import ChatHistory
from app.db.models.knowledge_gap import KnowledgeGap
from app.db.models.micro_quiz import MicroQuiz
from app.db.models.quiz_question import QuizQuestion
from app.db.models.subject import Subject
from app.db.models.user import User
from app.shared.source_enum import MicroQuizStatus, QuestionDifficulty, QuestionType


# Private helpers

def _read_chat_log(file_path: str) -> str:
    """Read and return the raw chat log text from disk."""
    if not os.path.exists(file_path):
        raise FileNotFoundError(f"Chat log file not found: {file_path}")
    with open(file_path, "r", encoding="utf-8") as fh:
        return fh.read()


def _get_subject_name(db: Session, subject_id: int) -> str:
    """Return the subject name for the given subject ID, or 'Unknown'."""
    subject = db.query(Subject).filter(Subject.subject_id == subject_id).first()
    return subject.subject_name if subject else "Unknown"


def _upsert_knowledge_gap(
    db: Session,
    student_id: uuid.UUID,
    subject_id: int,
    history_id: uuid.UUID,
    gap: dict[str, Any],
) -> None:
    """Insert a new KnowledgeGap or increment its recurrence counter."""
    existing = db.query(KnowledgeGap).filter(
        KnowledgeGap.student_id == student_id,
        KnowledgeGap.topic_tag == gap["topic_tag"],
    ).first()
    if existing:
        existing.recurrence_count += 1
        existing.history_id = history_id
        existing.detected_at = datetime.utcnow()
        existing.is_resolved = False
    else:
        db.add(KnowledgeGap(
            student_id=student_id,
            subject_id=subject_id,
            history_id=history_id,
            concept_name=gap["concept_name"],
            topic_tag=gap["topic_tag"],
            recurrence_count=1,
            is_resolved=False,
        ))


def _parse_question_type(raw: str) -> QuestionType:
    """Return a QuestionType enum from the AI response string, defaulting to MCQ."""
    try:
        return QuestionType(raw.lower())
    except ValueError:
        return QuestionType.MCQ


def _parse_difficulty(raw: str) -> QuestionDifficulty:
    """Return a QuestionDifficulty enum from the AI response string, defaulting to MEDIUM."""
    try:
        return QuestionDifficulty(raw.upper())
    except ValueError:
        return QuestionDifficulty.MEDIUM


def _create_quiz_questions(db: Session, quiz_id: uuid.UUID, questions: list[dict]) -> None:
    """Persist QuizQuestion rows for all questions in the AI response."""
    for i, q in enumerate(questions):
        db.add(QuizQuestion(
            quiz_id=quiz_id,
            question_text=q["question_text"],
            question_type=_parse_question_type(q["question_type"]),
            options=q.get("options"),
            correct_answer=q["correct_answer"],
            explanation=q.get("explanation"),
            difficulty=_parse_difficulty(q["difficulty"]),
            order_num=i + 1,
        ))


# Public API

async def detect_gaps_for_quiz(db: Session, history_id: uuid.UUID) -> dict[str, Any]:
    """Detect knowledge gaps from a chat session and persist them for quiz targeting.

    Steps:
    1. Fetch the ChatHistory record and read the log from disk.
    2. Call the AI service to detect gaps.
    3. Upsert KnowledgeGap rows for each returned gap.
    """
    chat = db.query(ChatHistory).filter(ChatHistory.history_id == history_id).first()
    if not chat:
        raise ValueError(f"Chat history {history_id} not found")
    chat_log = _read_chat_log(chat.file_path)
    subject_name = _get_subject_name(db, chat.subject_id)
    gaps_result = await ai_post(
        "/quiz/detect-gaps",
        {
            "student_id": str(chat.student_id),
            "subject": subject_name,
            "chat_log": chat_log,
        },
    )
    for gap in gaps_result.get("gaps", []):
        _upsert_knowledge_gap(db, chat.student_id, chat.subject_id, chat.history_id, gap)
    db.commit()
    return gaps_result


async def generate_and_save_quiz(
    db: Session,
    student_id: uuid.UUID,
    subject_id: int,
    concept: str,
    num_questions: int = 5,
    gap_id: uuid.UUID | None = None,
) -> MicroQuiz:
    """Generate an AI micro-quiz for a concept and persist it with its questions.

    Steps:
    1. Fetch the student record for grade context.
    2. Call the AI service to generate the quiz (long timeout).
    3. Persist the MicroQuiz header and QuizQuestion rows.
    """
    student = db.query(User).filter(User.user_id == student_id).first()
    if not student:
        raise ValueError(f"Student {student_id} not found")
    grade_id = student.grade_id if hasattr(student, "grade_id") else None
    quiz_data = await ai_post(
        "/quiz/generate",
        {
            "concept": concept,
            "num_questions": num_questions,
            "user_type": "student",
            "student_id": str(student_id),
            "grade": grade_id,
        },
        long=True,
    )
    new_quiz = MicroQuiz(
        student_id=student_id,
        subject_id=subject_id,
        gap_id=gap_id,
        concept_targeted=concept,
        total_questions=len(quiz_data["questions"]),
        status=MicroQuizStatus.ASSIGNED,
    )
    db.add(new_quiz)
    db.flush()
    _create_quiz_questions(db, new_quiz.quiz_id, quiz_data["questions"])
    db.commit()
    db.refresh(new_quiz)
    return new_quiz


def get_quizzes_for_student(
    db: Session,
    student_id: uuid.UUID,
    subject_id: int | None = None,
    page: int = 1,
    per_page: int = 20,
) -> tuple[list[MicroQuiz], int]:
    """Return a paginated list of micro-quizzes for a student."""
    query = db.query(MicroQuiz).filter(MicroQuiz.student_id == student_id)
    if subject_id:
        query = query.filter(MicroQuiz.subject_id == subject_id)
    total = query.count()
    quizzes = query.order_by(MicroQuiz.created_at.desc()).offset((page - 1) * per_page).limit(per_page).all()
    return quizzes, total


def get_quiz_detail(db: Session, student_id: uuid.UUID, quiz_id: uuid.UUID) -> MicroQuiz | None:
    """Return the MicroQuiz row for a specific student and quiz ID, or None."""
    return db.query(MicroQuiz).filter(
        MicroQuiz.quiz_id == quiz_id,
        MicroQuiz.student_id == student_id,
    ).first()
