"""
Phase 2 — Grading Integration Tests (GD-155)

Tests the grading trigger and result polling routes. The AI microservice and
file-system calls are mocked so no real ai-service or disk images are required.
"""
import uuid
from unittest.mock import AsyncMock, MagicMock, patch

from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.core.config import settings
from app.core.database import get_db
from app.core.security import hash_password
from app.db.models.assignment import Assignment
from app.db.models.submission import Submission
from app.db.models.submission_feedback import SubmissionFeedback
from app.db.models.user import User
from app.main import app
from app.shared.source_enum import (
    GradeClassification,
    SubmissionProcessingStatus,
    UserRole,
)

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

_GRADE_RESULT = {
    "grade_classification": "partial",
    "score_percentage": 65.0,
    "overall_feedback": "Good attempt, a few steps were missed.",
    "step_by_step_corrections": [
        {"step": "Step 1", "status": "correct", "comment": "Correct setup."},
        {"step": "Step 2", "status": "incorrect", "comment": "Wrong formula used."},
    ],
    "strengths": "Clear presentation.",
    "improvements": "Revise the formula.",
    "knowledge_gap_detected": True,
    "failed_at_step": "Step 2",
}


def _create_student() -> User:
    """Create and persist a test student user."""
    db = TestSession()
    user = User(
        email=f"grading_{RUN_ID}_{uuid.uuid4().hex[:4]}@test.com",
        password_hash=hash_password("Pass@1234"),
        full_name="Grading Student",
        role=UserRole.STUDENT,
        is_active=True,
        is_email_verified=True,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    db.close()
    return user


def _create_instructor() -> User:
    """Create and persist a test instructor user."""
    db = TestSession()
    user = User(
        email=f"instr_{RUN_ID}_{uuid.uuid4().hex[:4]}@test.com",
        password_hash=hash_password("Pass@1234"),
        full_name="Test Instructor",
        role=UserRole.INSTRUCTOR,
        is_active=True,
        is_email_verified=True,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    db.close()
    return user


def _create_assignment(instructor_id: uuid.UUID, subject_id: int = 1) -> Assignment:
    """Create and persist a test assignment."""
    db = TestSession()
    assignment = Assignment(
        subject_id=subject_id,
        instructor_id=instructor_id,
        title="Test Assignment",
        description="Solve the equation.",
        is_published=True,
    )
    db.add(assignment)
    db.commit()
    db.refresh(assignment)
    db.close()
    return assignment


def _create_submission(
    student_id: uuid.UUID,
    assignment_id: uuid.UUID,
    status: SubmissionProcessingStatus = SubmissionProcessingStatus.QUEUED,
    subject_id: int = 1,
) -> Submission:
    """Create and persist a test submission row."""
    db = TestSession()
    sub = Submission(
        student_id=student_id,
        assignment_id=assignment_id,
        subject_id=subject_id,
        image_path=f"/tmp/test_image_{uuid.uuid4().hex}.jpg",
        processing_status=status,
    )
    db.add(sub)
    db.commit()
    db.refresh(sub)
    db.close()
    return sub


def _mock_ocr_service(return_value: dict = None):
    """Patch process_submission_ocr to avoid real AI and disk calls."""
    return patch(
        "app.services.ocr_service.process_submission_ocr",
        new=AsyncMock(return_value=return_value or _GRADE_RESULT),
    )


class TestTriggerGrading:
    def test_trigger_queued_submission_returns_202(self):
        student = _create_student()
        instructor = _create_instructor()
        assignment = _create_assignment(instructor.user_id)
        sub = _create_submission(student.user_id, assignment.assignment_id)
        with _mock_ocr_service():
            resp = client.post(f"/api/grading/submissions/{sub.submission_id}/process")
        assert resp.status_code == 202
        assert str(sub.submission_id) in resp.json()["submission_id"]

    def test_trigger_nonexistent_submission_returns_404(self):
        resp = client.post(f"/api/grading/submissions/{uuid.uuid4()}/process")
        assert resp.status_code == 404

    def test_trigger_already_done_submission_returns_409(self):
        student = _create_student()
        instructor = _create_instructor()
        assignment = _create_assignment(instructor.user_id)
        sub = _create_submission(
            student.user_id,
            assignment.assignment_id,
            status=SubmissionProcessingStatus.DONE,
        )
        resp = client.post(f"/api/grading/submissions/{sub.submission_id}/process")
        assert resp.status_code == 409

    def test_trigger_rejected_submission_returns_409(self):
        student = _create_student()
        instructor = _create_instructor()
        assignment = _create_assignment(instructor.user_id)
        sub = _create_submission(
            student.user_id,
            assignment.assignment_id,
            status=SubmissionProcessingStatus.REJECTED,
        )
        resp = client.post(f"/api/grading/submissions/{sub.submission_id}/process")
        assert resp.status_code == 409


class TestGradingResult:
    def test_result_queued_submission_returns_status(self):
        student = _create_student()
        instructor = _create_instructor()
        assignment = _create_assignment(instructor.user_id)
        sub = _create_submission(student.user_id, assignment.assignment_id)
        resp = client.get(f"/api/grading/submissions/{sub.submission_id}/result")
        assert resp.status_code == 200
        data = resp.json()
        assert data["processing_status"] == "queued"
        assert data["feedback"] is None

    def test_result_done_submission_returns_feedback(self):
        student = _create_student()
        instructor = _create_instructor()
        assignment = _create_assignment(instructor.user_id)
        sub = _create_submission(
            student.user_id,
            assignment.assignment_id,
            status=SubmissionProcessingStatus.DONE,
        )
        db = TestSession()
        db.add(SubmissionFeedback(
            submission_id=sub.submission_id,
            overall_feedback="Good attempt.",
            step_by_step_corrections=[],
            knowledge_gap_detected=False,
            llm_model_used="gemini-2.5-flash",
        ))
        sub_row = db.query(Submission).filter(Submission.submission_id == sub.submission_id).first()
        sub_row.grade_classification = GradeClassification.PARTIAL
        sub_row.score_percentage = 65.0
        db.commit()
        db.close()
        resp = client.get(f"/api/grading/submissions/{sub.submission_id}/result")
        assert resp.status_code == 200
        data = resp.json()
        assert data["processing_status"] == "done"
        assert data["score_percentage"] == 65.0
        assert data["feedback"]["overall_feedback"] == "Good attempt."

    def test_result_nonexistent_submission_returns_404(self):
        resp = client.get(f"/api/grading/submissions/{uuid.uuid4()}/result")
        assert resp.status_code == 404
