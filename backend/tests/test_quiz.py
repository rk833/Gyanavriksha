"""
Phase 2 — Quiz Integration Tests (GD-155)

Tests gap detection, quiz generation, listing, and detail retrieval routes.
The AI microservice calls inside the quiz service are mocked so no real
ai-service instance is required.
"""
import uuid
from unittest.mock import AsyncMock, patch

from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.core.config import settings
from app.core.database import get_db
from app.core.security import hash_password
from app.db.models.knowledge_gap import KnowledgeGap
from app.db.models.micro_quiz import MicroQuiz
from app.db.models.quiz_question import QuizQuestion
from app.db.models.user import User
from app.main import app
from app.shared.source_enum import MicroQuizStatus, QuestionDifficulty, QuestionType, UserRole

engine = create_engine(settings.SYNC_DATABASE_URL)
TestSession = sessionmaker(bind=engine, autocommit=False, autoflush=False)


def override_get_db():
    db = TestSession()
    try:
        yield db
    finally:
        db.close()


app.dependency_overrides[get_db] = override_get_db
client = TestClient(app)

RUN_ID = uuid.uuid4().hex[:6]

_GAP_RESULT = {
    "gaps": [
        {"concept_name": "Fractions", "topic_tag": "fractions"},
        {"concept_name": "Division", "topic_tag": "division"},
    ]
}
_QUIZ_AI_RESULT = {
    "questions": [
        {
            "question_text": "What is 1/2 + 1/3?",
            "question_type": "mcq",
            "options": ["5/6", "2/5", "1/6", "3/5"],
            "correct_answer": "5/6",
            "explanation": "Find common denominator.",
            "difficulty": "MEDIUM",
        },
        {
            "question_text": "Simplify 4/8.",
            "question_type": "mcq",
            "options": ["1/2", "2/4", "4/8", "1/4"],
            "correct_answer": "1/2",
            "explanation": "Divide both by 4.",
            "difficulty": "EASY",
        },
    ]
}


def _create_student(suffix: str = "") -> User:
    """Create and persist a test student user."""
    db = TestSession()
    user = User(
        email=f"quiz_{RUN_ID}_{suffix or uuid.uuid4().hex[:4]}@test.com",
        password_hash=hash_password("Pass@1234"),
        full_name="Quiz Student",
        role=UserRole.STUDENT,
        is_active=True,
        is_email_verified=True,
        grade_id=1,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    db.close()
    return user


def _create_quiz(student_id: uuid.UUID, subject_id: int = 1, concept: str = "Fractions") -> MicroQuiz:
    """Create and persist a MicroQuiz with two dummy questions."""
    db = TestSession()
    quiz = MicroQuiz(
        student_id=student_id,
        subject_id=subject_id,
        concept_targeted=concept,
        total_questions=2,
        status=MicroQuizStatus.ASSIGNED,
    )
    db.add(quiz)
    db.flush()
    db.add(QuizQuestion(
        quiz_id=quiz.quiz_id,
        question_text="What is 1/2 + 1/3?",
        question_type=QuestionType.MCQ,
        options=["5/6", "2/5"],
        correct_answer="5/6",
        difficulty=QuestionDifficulty.MEDIUM,
        order_num=1,
    ))
    db.add(QuizQuestion(
        quiz_id=quiz.quiz_id,
        question_text="Simplify 4/8.",
        question_type=QuestionType.MCQ,
        options=["1/2", "2/4"],
        correct_answer="1/2",
        difficulty=QuestionDifficulty.EASY,
        order_num=2,
    ))
    db.commit()
    db.refresh(quiz)
    db.close()
    return quiz


def _create_quiz_for_gap(student_id, gap_id, subject_id: int = 1, concept: str = "Fractions") -> MicroQuiz:
    """Create a MicroQuiz linked to a knowledge gap (two MCQ questions)."""
    db = TestSession()
    quiz = MicroQuiz(
        student_id=student_id,
        subject_id=subject_id,
        gap_id=gap_id,
        concept_targeted=concept,
        total_questions=2,
        status=MicroQuizStatus.ASSIGNED,
    )
    db.add(quiz)
    db.flush()
    db.add(QuizQuestion(
        quiz_id=quiz.quiz_id,
        question_text="What is 1/2 + 1/3?",
        question_type=QuestionType.MCQ,
        options=["5/6", "2/5"],
        correct_answer="5/6",
        difficulty=QuestionDifficulty.MEDIUM,
        order_num=1,
    ))
    db.add(QuizQuestion(
        quiz_id=quiz.quiz_id,
        question_text="Simplify 4/8.",
        question_type=QuestionType.MCQ,
        options=["1/2", "2/4"],
        correct_answer="1/2",
        difficulty=QuestionDifficulty.EASY,
        order_num=2,
    ))
    db.commit()
    db.refresh(quiz)
    db.close()
    return quiz


def _create_gap(student_id: uuid.UUID, subject_id: int = 1) -> uuid.UUID:
    db = TestSession()
    gap = KnowledgeGap(
        student_id=student_id,
        subject_id=subject_id,
        concept_name="Flowchart control flow",
        topic_tag=f"gap_{uuid.uuid4().hex[:10]}",
        is_resolved=False,
    )
    db.add(gap)
    db.commit()
    gid = gap.gap_id
    db.close()
    return gid


def _login_student(email: str) -> str:
    resp = client.post("/api/auth/login", json={"email": email, "password": "Pass@1234"})
    assert resp.status_code == 200
    return resp.json()["access_token"]


def _auth_headers(token: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {token}"}


def _mock_ai_post(return_value: dict):
    """Patch ai_post to return a fixed dict without hitting the AI service."""
    return patch("app.services.quiz_service.ai_post", new=AsyncMock(return_value=return_value))


def _mock_detect_gaps():
    """Patch detect_gaps_for_quiz so background task never hits the DB."""
    return patch("app.services.quiz_service.detect_gaps_for_quiz", new=AsyncMock(return_value=_GAP_RESULT))


class TestDetectGaps:
    def test_trigger_gap_detection_returns_202(self):
        with _mock_detect_gaps():
            resp = client.post("/api/quiz/detect-gaps", json={
                "history_id": str(uuid.uuid4()),
            })
        assert resp.status_code == 202
        assert "started" in resp.json()["message"].lower()

    def test_trigger_missing_history_id_returns_422(self):
        resp = client.post("/api/quiz/detect-gaps", json={})
        assert resp.status_code == 422

    def test_trigger_invalid_uuid_returns_422(self):
        resp = client.post("/api/quiz/detect-gaps", json={"history_id": "not-a-uuid"})
        assert resp.status_code == 422


class TestGenerateQuiz:
    def test_generate_quiz_returns_201(self):
        student = _create_student("gen_ok")
        with _mock_ai_post(_QUIZ_AI_RESULT):
            resp = client.post("/api/quiz/generate", json={
                "student_id": str(student.user_id),
                "subject_id": 1,
                "concept": "Fractions",
                "num_questions": 2,
            })
        assert resp.status_code == 201

    def test_generate_quiz_missing_fields_returns_422(self):
        resp = client.post("/api/quiz/generate", json={"concept": "Fractions"})
        assert resp.status_code == 422

    def test_generate_quiz_num_questions_too_large_returns_422(self):
        student = _create_student("gen_too_large")
        resp = client.post("/api/quiz/generate", json={
            "student_id": str(student.user_id),
            "subject_id": 1,
            "concept": "Fractions",
            "num_questions": 99,
        })
        assert resp.status_code == 422

    def test_generate_quiz_empty_concept_returns_422(self):
        student = _create_student("gen_empty_concept")
        resp = client.post("/api/quiz/generate", json={
            "student_id": str(student.user_id),
            "subject_id": 1,
            "concept": "",
        })
        assert resp.status_code == 422


class TestListQuizzes:
    def test_list_returns_quizzes_for_student(self):
        student = _create_student("list_ok")
        _create_quiz(student.user_id, concept="Fractions")
        _create_quiz(student.user_id, concept="Algebra")
        resp = client.get(f"/api/quiz/students/{student.user_id}")
        assert resp.status_code == 200
        data = resp.json()
        assert data["total"] >= 2
        assert isinstance(data["results"], list)

    def test_list_returns_empty_for_unknown_student(self):
        resp = client.get(f"/api/quiz/students/{uuid.uuid4()}")
        assert resp.status_code == 200
        assert resp.json()["total"] == 0

    def test_list_subject_filter(self):
        student = _create_student("list_filter")
        _create_quiz(student.user_id, subject_id=1, concept="Fractions")
        _create_quiz(student.user_id, subject_id=2, concept="History")
        resp = client.get(f"/api/quiz/students/{student.user_id}?subject_id=1")
        assert resp.status_code == 200
        results = resp.json()["results"]
        assert all(q["subject_id"] == 1 for q in results)

    def test_list_pagination(self):
        student = _create_student("list_page")
        for i in range(5):
            _create_quiz(student.user_id, concept=f"Topic {i}")
        resp = client.get(f"/api/quiz/students/{student.user_id}?page=1&per_page=2")
        assert resp.status_code == 200
        data = resp.json()
        assert len(data["results"]) <= 2
        assert data["per_page"] == 2


class TestGetQuiz:
    def test_get_existing_quiz(self):
        student = _create_student("get_ok")
        quiz = _create_quiz(student.user_id)
        resp = client.get(f"/api/quiz/students/{student.user_id}/{quiz.quiz_id}")
        assert resp.status_code == 200
        assert resp.json()["concept_targeted"] == "Fractions"

    def test_get_nonexistent_quiz_returns_404(self):
        student = _create_student("get_404")
        resp = client.get(f"/api/quiz/students/{student.user_id}/{uuid.uuid4()}")
        assert resp.status_code == 404

    def test_get_quiz_wrong_student_returns_404(self):
        student_a = _create_student("get_wrong_a")
        student_b = _create_student("get_wrong_b")
        quiz = _create_quiz(student_a.user_id)
        resp = client.get(f"/api/quiz/students/{student_b.user_id}/{quiz.quiz_id}")
        assert resp.status_code == 404


class TestGenerateQuizStream:
    def test_generate_stream_ndjson_has_question_and_complete(self):
        student = _create_student("stream_ndjson")
        # Return a distinct question per AI call so duplicate detection doesn't fire
        side_effects = [
            {"questions": [_QUIZ_AI_RESULT["questions"][0]]},
            {"questions": [_QUIZ_AI_RESULT["questions"][1]]},
        ]
        with patch("app.services.quiz_service.ai_post", new=AsyncMock(side_effect=side_effects)):
            resp = client.post(
                "/api/quiz/generate-stream",
                json={
                    "student_id": str(student.user_id),
                    "subject_id": 1,
                    "concept": "Fractions",
                    "num_questions": 2,
                },
            )
        assert resp.status_code == 200
        assert "application/x-ndjson" in (resp.headers.get("content-type") or "")
        body = resp.text
        assert "question" in body
        assert "complete" in body
        assert "quiz" in body


class TestSubmitMicroQuiz:
    def test_submit_completes_quiz_and_scores(self):
        student = _create_student("submit_scores")
        quiz = _create_quiz(student.user_id)
        token = _login_student(student.email)
        resp = client.post(
            f"/api/students/quizzes/{quiz.quiz_id}/submit",
            json={"answers": [0, 0]},
            headers=_auth_headers(token),
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data["correct_count"] == 2
        assert data["total_questions"] == 2
        assert data["quiz"]["status"] == "COMPLETED"
        assert data["knowledge_gap_resolved"] is False

    def test_submit_resolves_linked_gap_at_60_percent(self):
        student = _create_student("submit_gap")
        gap_id = _create_gap(student.user_id)
        quiz = _create_quiz_for_gap(student.user_id, gap_id)
        token = _login_student(student.email)
        resp = client.post(
            f"/api/students/quizzes/{quiz.quiz_id}/submit",
            json={"answers": [0, 0]},
            headers=_auth_headers(token),
        )
        assert resp.status_code == 200
        assert resp.json()["knowledge_gap_resolved"] is True
        db = TestSession()
        gap = db.query(KnowledgeGap).filter(KnowledgeGap.gap_id == gap_id).first()
        db.close()
        assert gap is not None
        assert gap.is_resolved is True
