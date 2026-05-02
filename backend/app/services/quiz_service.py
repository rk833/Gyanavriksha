import uuid
import httpx
import os
from sqlalchemy.orm import Session
from app.db.models.micro_quiz import MicroQuiz
from app.db.models.quiz_question import QuizQuestion
from app.db.models.user import User
from app.shared.source_enum import MicroQuizStatus, QuestionType, QuestionDifficulty

from app.db.models.knowledge_gap import KnowledgeGap
from app.db.models.chat_history import ChatHistory
from app.db.models.subject import Subject
from datetime import datetime

AI_SERVICE_URL = os.environ.get("AI_SERVICE_URL", "http://localhost:8000")

async def detect_gaps_for_quiz(db: Session, history_id: uuid.UUID):
    """
    1. Fetch chat history record.
    2. Read chat log from file.
    3. Call AI Service to detect knowledge gaps.
    4. Save gaps to KnowledgeGap table for future quiz targeting.
    """
    # 1. Fetch record
    chat = db.query(ChatHistory).filter(ChatHistory.history_id == history_id).first()
    if not chat:
        raise ValueError(f"Chat history {history_id} not found")

    # 2. Read chat log
    if not os.path.exists(chat.file_path):
        raise FileNotFoundError(f"Chat log file not found: {chat.file_path}")
    
    with open(chat.file_path, "r", encoding="utf-8") as f:
        chat_log = f.read()

    # Get subject name
    subject = db.query(Subject).filter(Subject.subject_id == chat.subject_id).first()
    subject_name = subject.subject_name if subject else "Unknown"

    # 3. Call AI Service
    async with httpx.AsyncClient() as client:
        response = await client.post(
            f"{AI_SERVICE_URL}/quiz/detect-gaps",
            json={
                "student_id": str(chat.student_id),
                "subject": subject_name,
                "chat_log": chat_log
            },
            timeout=60.0
        )
        
        if response.status_code != 200:
            raise Exception(f"AI Service failed: {response.text}")
        
        gaps_result = response.json()

    # 4. Save gaps to DB
    for gap in gaps_result.get("gaps", []):
        topic_tag = gap["topic_tag"]
        
        existing_gap = db.query(KnowledgeGap).filter(
            KnowledgeGap.student_id == chat.student_id,
            KnowledgeGap.topic_tag == topic_tag
        ).first()
        
        if existing_gap:
            existing_gap.recurrence_count += 1
            existing_gap.history_id = chat.history_id
            existing_gap.detected_at = datetime.utcnow()
            existing_gap.is_resolved = False 
        else:
            new_gap = KnowledgeGap(
                student_id=chat.student_id,
                subject_id=chat.subject_id,
                history_id=chat.history_id,
                concept_name=gap["concept_name"],
                topic_tag=topic_tag,
                recurrence_count=1,
                is_resolved=False
            )
            db.add(new_gap)

    db.commit()
    return gaps_result

async def generate_and_save_quiz(
    db: Session,
    student_id: uuid.UUID,
    subject_id: int,
    concept: str,
    num_questions: int = 5,
    gap_id: uuid.UUID = None
) -> MicroQuiz:
    """
    1. Call AI Service to generate a quiz based on a concept.
    2. Save the quiz header to micro_quizzes table.
    3. Save the questions to quiz_questions table.
    """
    # 1. Fetch student info for context
    student = db.query(User).filter(User.user_id == student_id).first()
    if not student:
        raise ValueError(f"Student {student_id} not found")
    
    # We use the student's grade to fetch relevant RAG data
    grade_id = student.grade_id if hasattr(student, 'grade_id') else None
    
    # 2. Call AI Service
    async with httpx.AsyncClient() as client:
        try:
            response = await client.post(
                f"{AI_SERVICE_URL}/quiz/generate",
                json={
                    "concept": concept,
                    "num_questions": num_questions,
                    "user_type": "student",
                    "student_id": str(student_id),
                    "grade": grade_id
                },
                timeout=120.0
            )
            
            if response.status_code != 200:
                raise Exception(f"AI Service failed: {response.text}")
            
            quiz_data = response.json()
        except Exception as e:
            # Handle connection errors or timeouts
            raise Exception(f"Failed to connect to AI Service: {str(e)}")

    # 3. Create MicroQuiz header
    new_quiz = MicroQuiz(
        student_id=student_id,
        subject_id=subject_id,
        gap_id=gap_id,
        concept_targeted=concept,
        total_questions=len(quiz_data["questions"]),
        status=MicroQuizStatus.ASSIGNED
    )
    db.add(new_quiz)
    db.flush() # Populate new_quiz.quiz_id

    # 4. Create QuizQuestion records
    for i, q in enumerate(quiz_data["questions"]):
        # Map AI difficulty/type to enum if necessary, though they should match
        # We use a try-except block to handle potential enum mismatch gracefully
        try:
            q_type = QuestionType(q["question_type"].lower())
            q_diff = QuestionDifficulty(q["difficulty"].upper())
        except ValueError:
            q_type = QuestionType.MCQ
            q_diff = QuestionDifficulty.MEDIUM

        question = QuizQuestion(
            quiz_id=new_quiz.quiz_id,
            question_text=q["question_text"],
            question_type=q_type,
            options=q.get("options"),
            correct_answer=q["correct_answer"],
            explanation=q.get("explanation"),
            difficulty=q_diff,
            order_num=i + 1
        )
        db.add(question)
    
    db.commit()
    db.refresh(new_quiz)
    return new_quiz

def get_quizzes_for_student(
    db: Session,
    student_id: uuid.UUID,
    subject_id: int = None,
    page: int = 1,
    per_page: int = 20
) -> tuple[list[MicroQuiz], int]:
    query = db.query(MicroQuiz).filter(MicroQuiz.student_id == student_id)
    if subject_id:
        query = query.filter(MicroQuiz.subject_id == subject_id)
    
    total = query.count()
    quizzes = query.order_by(MicroQuiz.created_at.desc()).offset((page - 1) * per_page).limit(per_page).all()
    return quizzes, total

def get_quiz_detail(db: Session, student_id: uuid.UUID, quiz_id: uuid.UUID) -> MicroQuiz:
    quiz = db.query(MicroQuiz).filter(
        MicroQuiz.quiz_id == quiz_id,
        MicroQuiz.student_id == student_id
    ).first()
    
    if not quiz:
        return None
    return quiz
