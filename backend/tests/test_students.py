"""
Sprint 3 Phase 2 — Student API Integration Tests
Tests subject, enrollment, and dashboard endpoints.
"""
import uuid

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.core.config import settings
from app.core.database import get_db
from app.core.security import hash_password
from app.db.models.grade import Grade
from app.db.models.student_enrollment import StudentEnrollment
from app.db.models.subject import Subject
from app.db.models.user import User
from app.main import app
from app.shared.source_enum import UserRole

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
TEST_PASSWORD = "StrongPass@123"


def _create_user(suffix, role="student"):
    email = f"stu_{RUN_ID}_{suffix}@example.com"
    db = TestSession()
    user = User(
        email=email,
        password_hash=hash_password(TEST_PASSWORD),
        full_name=f"Test {suffix}",
        role=UserRole(role),
        is_active=True,
        is_email_verified=True,
    )
    db.add(user)
    db.commit()
    user_id = user.user_id
    db.close()
    return email, user_id


def _login(email):
    resp = client.post("/api/auth/login", json={"email": email, "password": TEST_PASSWORD})
    assert resp.status_code == 200
    return resp.json()["access_token"]


def _auth_header(token):
    return {"Authorization": f"Bearer {token}"}


def _create_grade_and_subject(suffix):
    db = TestSession()
    grade_name = f"Grade T{RUN_ID}_{suffix}"
    grade = db.query(Grade).filter(Grade.grade_name == grade_name).first()
    if not grade:
        grade = Grade(grade_name=grade_name, grade_level=99, description="Test grade")
        db.add(grade)
        db.flush()

    code = f"TST{RUN_ID}{suffix}"[:20]
    subject = db.query(Subject).filter(Subject.subject_code == code).first()
    if not subject:
        subject = Subject(
            grade_id=grade.grade_id,
            subject_name=f"Test Subject {suffix}",
            subject_code=code,
            chroma_namespace=f"test_{RUN_ID}_{suffix}",
            description="Test subject for integration tests",
        )
        db.add(subject)
        db.flush()

    db.commit()
    grade_id = grade.grade_id
    subject_id = subject.subject_id
    db.close()
    return grade_id, subject_id


def _enroll_student(user_id, grade_id, subject_id):
    db = TestSession()
    existing = (
        db.query(StudentEnrollment)
        .filter(
            StudentEnrollment.student_id == user_id,
            StudentEnrollment.subject_id == subject_id,
        )
        .first()
    )
    if not existing:
        enrollment = StudentEnrollment(
            student_id=user_id,
            grade_id=grade_id,
            subject_id=subject_id,
        )
        db.add(enrollment)
        db.commit()
    db.close()


# Subject endpoints

class TestSubjects:
    def test_list_subjects_requires_auth(self):
        resp = client.get("/api/students/subjects")
        assert resp.status_code == 401

    def test_list_subjects_requires_student_role(self):
        email, _ = _create_user("sub_role", role="instructor")
        token = _login(email)
        resp = client.get("/api/students/subjects", headers=_auth_header(token))
        assert resp.status_code == 403

    def test_list_subjects_empty(self):
        email, _ = _create_user("sub_empty")
        token = _login(email)
        resp = client.get("/api/students/subjects", headers=_auth_header(token))
        assert resp.status_code == 200
        assert resp.json() == []

    def test_list_subjects_with_enrollment(self):
        email, user_id = _create_user("sub_enrolled")
        grade_id, subject_id = _create_grade_and_subject("s1")
        _enroll_student(user_id, grade_id, subject_id)

        token = _login(email)
        resp = client.get("/api/students/subjects", headers=_auth_header(token))
        assert resp.status_code == 200
        data = resp.json()
        assert len(data) >= 1
        assert data[0]["subject_id"] == subject_id

    def test_get_subject_detail(self):
        email, user_id = _create_user("sub_detail")
        grade_id, subject_id = _create_grade_and_subject("s2")
        _enroll_student(user_id, grade_id, subject_id)

        token = _login(email)
        resp = client.get(f"/api/students/subjects/{subject_id}", headers=_auth_header(token))
        assert resp.status_code == 200
        assert resp.json()["subject_id"] == subject_id

    def test_get_subject_detail_not_enrolled(self):
        email, _ = _create_user("sub_no_enroll")
        _, subject_id = _create_grade_and_subject("s3")

        token = _login(email)
        resp = client.get(f"/api/students/subjects/{subject_id}", headers=_auth_header(token))
        assert resp.status_code == 403


# Enrollment endpoints

class TestEnrollments:
    def test_list_enrollments_empty(self):
        email, _ = _create_user("enroll_empty")
        token = _login(email)
        resp = client.get("/api/students/enrollments", headers=_auth_header(token))
        assert resp.status_code == 200
        data = resp.json()
        assert data["total"] == 0
        assert data["items"] == []

    def test_list_enrollments_with_data(self):
        email, user_id = _create_user("enroll_data")
        grade_id, subject_id = _create_grade_and_subject("e1")
        _enroll_student(user_id, grade_id, subject_id)

        token = _login(email)
        resp = client.get("/api/students/enrollments", headers=_auth_header(token))
        assert resp.status_code == 200
        data = resp.json()
        assert data["total"] >= 1
        assert data["items"][0]["subject_id"] == subject_id
        assert "completion_percentage" in data["items"][0]

    def test_list_enrollments_pagination(self):
        email, user_id = _create_user("enroll_page")
        grade_id, subject_id = _create_grade_and_subject("ep1")
        _enroll_student(user_id, grade_id, subject_id)

        token = _login(email)
        resp = client.get("/api/students/enrollments?page=1&per_page=1", headers=_auth_header(token))
        assert resp.status_code == 200
        data = resp.json()
        assert data["page"] == 1
        assert data["per_page"] == 1


# Dashboard endpoint

class TestDashboard:
    def test_dashboard_requires_auth(self):
        resp = client.get("/api/students/dashboard")
        assert resp.status_code == 401

    def test_dashboard_success(self):
        email, user_id = _create_user("dash_ok")
        grade_id, subject_id = _create_grade_and_subject("d1")
        _enroll_student(user_id, grade_id, subject_id)

        token = _login(email)
        resp = client.get("/api/students/dashboard", headers=_auth_header(token))
        assert resp.status_code == 200
        data = resp.json()
        assert "student_name" in data
        assert "enrolled_subjects" in data
        assert "total_submissions" in data
        assert "knowledge_gaps_count" in data
        assert "notifications_unread_count" in data
        assert len(data["enrolled_subjects"]) >= 1

    def test_dashboard_empty_student(self):
        email, _ = _create_user("dash_empty")
        token = _login(email)
        resp = client.get("/api/students/dashboard", headers=_auth_header(token))
        assert resp.status_code == 200
        data = resp.json()
        assert data["enrolled_subjects"] == []
        assert data["total_submissions"] == 0
