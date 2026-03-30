"""
Sprint 4 Phase 2 & 3 — Instructor API Integration Tests
Tests dashboard, subjects, subject detail, and assignment CRUD endpoints.
"""
import uuid

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.core.config import settings
from app.core.database import get_db
from app.core.security import hash_password
from app.db.models.assignment import Assignment
from app.db.models.grade import Grade
from app.db.models.instructor_subject import InstructorSubject
from app.db.models.student_enrollment import StudentEnrollment
from app.db.models.subject import Subject
from app.db.models.submission import Submission
from app.db.models.user import User
from app.main import app
from app.shared.source_enum import SubmissionProcessingStatus, UserRole

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


def _create_user(suffix, role="instructor"):
    email = f"ins_{RUN_ID}_{suffix}@example.com"
    db = TestSession()
    user = User(
        email=email,
        password_hash=hash_password(TEST_PASSWORD),
        full_name=f"Test Instructor {suffix}",
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
    grade_name = f"Grade I{RUN_ID}_{suffix}"
    grade = db.query(Grade).filter(Grade.grade_name == grade_name).first()
    if not grade:
        grade = Grade(grade_name=grade_name, grade_level=99, description="Test grade")
        db.add(grade)
        db.flush()

    code = f"INS{RUN_ID}{suffix}"[:20]
    subject = db.query(Subject).filter(Subject.subject_code == code).first()
    if not subject:
        subject = Subject(
            grade_id=grade.grade_id,
            subject_name=f"Instructor Test Subject {suffix}",
            subject_code=code,
            chroma_namespace=f"ins_test_{RUN_ID}_{suffix}",
            description="Test subject for instructor tests",
        )
        db.add(subject)
        db.flush()

    db.commit()
    grade_id = grade.grade_id
    subject_id = subject.subject_id
    db.close()
    return grade_id, subject_id


def _assign_instructor(instructor_id, subject_id):
    db = TestSession()
    existing = (
        db.query(InstructorSubject)
        .filter(
            InstructorSubject.instructor_id == instructor_id,
            InstructorSubject.subject_id == subject_id,
        )
        .first()
    )
    if not existing:
        link = InstructorSubject(
            instructor_id=instructor_id,
            subject_id=subject_id,
            assigned_by=instructor_id,
        )
        db.add(link)
        db.commit()
    db.close()


def _enroll_student(student_id, grade_id, subject_id):
    db = TestSession()
    existing = (
        db.query(StudentEnrollment)
        .filter(
            StudentEnrollment.student_id == student_id,
            StudentEnrollment.subject_id == subject_id,
        )
        .first()
    )
    if not existing:
        enrollment = StudentEnrollment(
            student_id=student_id,
            grade_id=grade_id,
            subject_id=subject_id,
        )
        db.add(enrollment)
        db.commit()
    db.close()


def _create_assignment(instructor_id, subject_id, title="Test Assignment", published=True):
    db = TestSession()
    assignment = Assignment(
        subject_id=subject_id,
        instructor_id=instructor_id,
        title=title,
        description="Test assignment description",
        is_published=published,
    )
    db.add(assignment)
    db.commit()
    assignment_id = assignment.assignment_id
    db.close()
    return assignment_id


def _create_submission(student_id, assignment_id, subject_id, score=None, status_val=SubmissionProcessingStatus.QUEUED):
    db = TestSession()
    submission = Submission(
        student_id=student_id,
        assignment_id=assignment_id,
        subject_id=subject_id,
        image_path="/test/path.jpg",
        processing_status=status_val,
        score_percentage=score,
    )
    db.add(submission)
    db.commit()
    submission_id = submission.submission_id
    db.close()
    return submission_id


# -- Tests --


class TestInstructorDashboard:
    """GD-84: GET /api/instructors/dashboard"""

    def test_dashboard_requires_auth(self):
        resp = client.get("/api/instructors/dashboard")
        assert resp.status_code == 401

    def test_dashboard_requires_instructor_role(self):
        email, _ = _create_user("dash_student", role="student")
        token = _login(email)
        resp = client.get("/api/instructors/dashboard", headers=_auth_header(token))
        assert resp.status_code == 403

    def test_dashboard_empty_instructor(self):
        email, user_id = _create_user("dash_empty")
        token = _login(email)
        resp = client.get("/api/instructors/dashboard", headers=_auth_header(token))
        assert resp.status_code == 200
        data = resp.json()
        assert data["class_completion"] == 0.0
        assert data["class_avg_score"] is None
        assert data["total_assignments"] == 0
        assert data["total_submissions"] == 0
        assert data["recent_submissions"] == []
        assert data["heatmap_preview"] == []
        assert data["velocity_table"] == []

    def test_dashboard_with_data(self):
        email, instructor_id = _create_user("dash_data")
        grade_id, subject_id = _create_grade_and_subject("dash")
        _assign_instructor(instructor_id, subject_id)

        # Create student and enroll
        stu_email, stu_id = _create_user("dash_stu", role="student")
        _enroll_student(stu_id, grade_id, subject_id)

        # Create assignment and submission
        assignment_id = _create_assignment(instructor_id, subject_id)
        _create_submission(stu_id, assignment_id, subject_id, score=85.0, status_val=SubmissionProcessingStatus.DONE)

        token = _login(email)
        resp = client.get("/api/instructors/dashboard", headers=_auth_header(token))
        assert resp.status_code == 200
        data = resp.json()
        assert data["total_assignments"] == 1
        assert data["total_submissions"] == 1
        assert data["class_avg_score"] == 85.0


class TestInstructorSubjects:
    """GD-85: GET /api/instructors/subjects"""

    def test_list_subjects_requires_auth(self):
        resp = client.get("/api/instructors/subjects")
        assert resp.status_code == 401

    def test_list_subjects_requires_instructor_role(self):
        email, _ = _create_user("subj_student", role="student")
        token = _login(email)
        resp = client.get("/api/instructors/subjects", headers=_auth_header(token))
        assert resp.status_code == 403

    def test_list_subjects_empty(self):
        email, _ = _create_user("subj_empty")
        token = _login(email)
        resp = client.get("/api/instructors/subjects", headers=_auth_header(token))
        assert resp.status_code == 200
        assert resp.json() == []

    def test_list_subjects_with_assignments(self):
        email, instructor_id = _create_user("subj_data")
        grade_id, subject_id = _create_grade_and_subject("subj1")
        _assign_instructor(instructor_id, subject_id)

        # Enroll a student
        stu_email, stu_id = _create_user("subj_stu", role="student")
        _enroll_student(stu_id, grade_id, subject_id)

        # Create an assignment
        _create_assignment(instructor_id, subject_id, title="Subj Test Assignment")

        token = _login(email)
        resp = client.get("/api/instructors/subjects", headers=_auth_header(token))
        assert resp.status_code == 200
        data = resp.json()
        assert len(data) == 1
        assert data[0]["student_count"] == 1
        assert data[0]["assignment_count"] == 1


class TestInstructorSubjectDetail:
    """GD-86: GET /api/instructors/subjects/{subject_id}"""

    def test_subject_detail_requires_auth(self):
        resp = client.get("/api/instructors/subjects/1")
        assert resp.status_code == 401

    def test_subject_detail_forbidden_if_not_assigned(self):
        email, instructor_id = _create_user("detail_noassign")
        _, subject_id = _create_grade_and_subject("detail_no")
        token = _login(email)
        resp = client.get(f"/api/instructors/subjects/{subject_id}", headers=_auth_header(token))
        assert resp.status_code == 403

    def test_subject_detail_not_found(self):
        email, instructor_id = _create_user("detail_nf")
        grade_id, subject_id = _create_grade_and_subject("detail_nf")
        _assign_instructor(instructor_id, subject_id)
        token = _login(email)
        resp = client.get("/api/instructors/subjects/99999", headers=_auth_header(token))
        # 403 because instructor is not assigned to subject 99999
        assert resp.status_code == 403

    def test_subject_detail_success(self):
        email, instructor_id = _create_user("detail_ok")
        grade_id, subject_id = _create_grade_and_subject("detail_ok")
        _assign_instructor(instructor_id, subject_id)

        # Enroll student
        stu_email, stu_id = _create_user("detail_stu", role="student")
        _enroll_student(stu_id, grade_id, subject_id)

        # Create assignment + submission
        assignment_id = _create_assignment(instructor_id, subject_id)
        _create_submission(stu_id, assignment_id, subject_id, score=72.0, status_val=SubmissionProcessingStatus.DONE)

        token = _login(email)
        resp = client.get(f"/api/instructors/subjects/{subject_id}", headers=_auth_header(token))
        assert resp.status_code == 200
        data = resp.json()
        assert data["subject_id"] == subject_id
        assert data["student_count"] == 1
        assert data["assignment_count"] == 1
        assert data["total_submissions"] == 1
        assert data["class_avg_score"] == 72.0
        assert len(data["students"]) == 1
        assert data["students"][0]["full_name"] == "Test Instructor detail_stu"
        assert data["students"][0]["total_submissions"] == 1
        assert data["students"][0]["avg_score"] == 72.0

    def test_subject_detail_sort_by_score(self):
        email, instructor_id = _create_user("detail_sort")
        grade_id, subject_id = _create_grade_and_subject("detail_sort")
        _assign_instructor(instructor_id, subject_id)

        # Enroll 2 students
        _, stu1_id = _create_user("sort_stu1", role="student")
        _, stu2_id = _create_user("sort_stu2", role="student")
        _enroll_student(stu1_id, grade_id, subject_id)
        _enroll_student(stu2_id, grade_id, subject_id)

        assignment_id = _create_assignment(instructor_id, subject_id)
        _create_submission(stu1_id, assignment_id, subject_id, score=60.0, status_val=SubmissionProcessingStatus.DONE)
        _create_submission(stu2_id, assignment_id, subject_id, score=95.0, status_val=SubmissionProcessingStatus.DONE)

        token = _login(email)
        resp = client.get(
            f"/api/instructors/subjects/{subject_id}?sort_by=score",
            headers=_auth_header(token),
        )
        assert resp.status_code == 200
        students = resp.json()["students"]
        assert len(students) == 2
        # Sorted by score descending — highest first
        assert students[0]["avg_score"] >= students[1]["avg_score"]

    def test_subject_detail_pagination(self):
        email, instructor_id = _create_user("detail_page")
        grade_id, subject_id = _create_grade_and_subject("detail_page")
        _assign_instructor(instructor_id, subject_id)

        # Enroll 3 students
        for i in range(3):
            _, stu_id = _create_user(f"page_stu{i}", role="student")
            _enroll_student(stu_id, grade_id, subject_id)

        token = _login(email)
        resp = client.get(
            f"/api/instructors/subjects/{subject_id}?page=1&per_page=2",
            headers=_auth_header(token),
        )
        assert resp.status_code == 200
        data = resp.json()
        assert len(data["students"]) == 2
        assert data["students_total"] == 3
        assert data["students_total_pages"] == 2


# Phase 3: Assignment CRUD tests


class TestAssignmentList:
    """GD-87: GET /api/instructors/assignments"""

    def test_list_assignments_requires_auth(self):
        resp = client.get("/api/instructors/assignments")
        assert resp.status_code == 401

    def test_list_assignments_empty(self):
        email, _ = _create_user("asgn_empty")
        token = _login(email)
        resp = client.get("/api/instructors/assignments", headers=_auth_header(token))
        assert resp.status_code == 200
        data = resp.json()
        assert data["items"] == []
        assert data["total"] == 0

    def test_list_assignments_with_data(self):
        email, instructor_id = _create_user("asgn_list")
        grade_id, subject_id = _create_grade_and_subject("asgn_list")
        _assign_instructor(instructor_id, subject_id)
        _create_assignment(instructor_id, subject_id, title="List Test 1")
        _create_assignment(instructor_id, subject_id, title="List Test 2")

        token = _login(email)
        resp = client.get("/api/instructors/assignments", headers=_auth_header(token))
        assert resp.status_code == 200
        data = resp.json()
        assert data["total"] == 2
        assert len(data["items"]) == 2

    def test_list_assignments_filter_by_status(self):
        email, instructor_id = _create_user("asgn_filter")
        grade_id, subject_id = _create_grade_and_subject("asgn_filter")
        _assign_instructor(instructor_id, subject_id)
        _create_assignment(instructor_id, subject_id, title="Draft One", published=False)
        _create_assignment(instructor_id, subject_id, title="Pub One", published=True)

        token = _login(email)
        # Draft only
        resp = client.get("/api/instructors/assignments?status=draft", headers=_auth_header(token))
        assert resp.status_code == 200
        assert resp.json()["total"] == 1
        assert resp.json()["items"][0]["is_published"] is False

        # Published only
        resp = client.get("/api/instructors/assignments?status=published", headers=_auth_header(token))
        assert resp.status_code == 200
        assert resp.json()["total"] == 1
        assert resp.json()["items"][0]["is_published"] is True


class TestAssignmentDetail:
    """GD-87: GET /api/instructors/assignments/{id}"""

    def test_get_assignment_not_found(self):
        email, _ = _create_user("asgn_nf")
        token = _login(email)
        fake_id = str(uuid.uuid4())
        resp = client.get(f"/api/instructors/assignments/{fake_id}", headers=_auth_header(token))
        assert resp.status_code == 404

    def test_get_assignment_success(self):
        email, instructor_id = _create_user("asgn_detail")
        grade_id, subject_id = _create_grade_and_subject("asgn_detail")
        _assign_instructor(instructor_id, subject_id)
        assignment_id = _create_assignment(instructor_id, subject_id, title="Detail Test")

        token = _login(email)
        resp = client.get(f"/api/instructors/assignments/{assignment_id}", headers=_auth_header(token))
        assert resp.status_code == 200
        data = resp.json()
        assert data["title"] == "Detail Test"
        assert data["submission_count"] == 0
        assert "recent_submissions" in data


class TestAssignmentCreate:
    """GD-88: POST /api/instructors/assignments"""

    def test_create_assignment_requires_auth(self):
        resp = client.post("/api/instructors/assignments", json={"title": "Test", "subject_id": 1})
        assert resp.status_code == 401

    def test_create_assignment_forbidden_subject(self):
        email, instructor_id = _create_user("asgn_forbid")
        _, subject_id = _create_grade_and_subject("asgn_forbid")
        # Not assigned to subject
        token = _login(email)
        resp = client.post(
            "/api/instructors/assignments",
            json={"title": "Forbidden Assignment", "subject_id": subject_id},
            headers=_auth_header(token),
        )
        assert resp.status_code == 403

    def test_create_assignment_success(self):
        email, instructor_id = _create_user("asgn_create")
        grade_id, subject_id = _create_grade_and_subject("asgn_create")
        _assign_instructor(instructor_id, subject_id)

        token = _login(email)
        resp = client.post(
            "/api/instructors/assignments",
            json={
                "title": "New Assignment",
                "description": "Solve all problems",
                "subject_id": subject_id,
                "max_score": 50.0,
                "topic_tags": ["algebra", "equations"],
            },
            headers=_auth_header(token),
        )
        assert resp.status_code == 201
        data = resp.json()
        assert data["title"] == "New Assignment"
        assert data["is_published"] is False
        assert data["max_score"] == 50.0
        assert data["topic_tags"] == ["algebra", "equations"]

    def test_create_assignment_validation(self):
        email, instructor_id = _create_user("asgn_valid")
        grade_id, subject_id = _create_grade_and_subject("asgn_valid")
        _assign_instructor(instructor_id, subject_id)

        token = _login(email)
        # Missing title
        resp = client.post(
            "/api/instructors/assignments",
            json={"subject_id": subject_id},
            headers=_auth_header(token),
        )
        assert resp.status_code == 422


class TestAssignmentUpdate:
    """GD-88: PATCH /api/instructors/assignments/{id}"""

    def test_update_assignment_success(self):
        email, instructor_id = _create_user("asgn_update")
        grade_id, subject_id = _create_grade_and_subject("asgn_update")
        _assign_instructor(instructor_id, subject_id)
        assignment_id = _create_assignment(instructor_id, subject_id, title="Original")

        token = _login(email)
        resp = client.patch(
            f"/api/instructors/assignments/{assignment_id}",
            json={"title": "Updated Title", "max_score": 75.0},
            headers=_auth_header(token),
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data["title"] == "Updated Title"
        assert data["max_score"] == 75.0

    def test_update_assignment_not_found(self):
        email, _ = _create_user("asgn_upd_nf")
        token = _login(email)
        fake_id = str(uuid.uuid4())
        resp = client.patch(
            f"/api/instructors/assignments/{fake_id}",
            json={"title": "Does Not Exist"},
            headers=_auth_header(token),
        )
        assert resp.status_code == 404


class TestAssignmentPublish:
    """GD-88: PATCH /api/instructors/assignments/{id}/publish"""

    def test_publish_assignment_success(self):
        email, instructor_id = _create_user("asgn_pub")
        grade_id, subject_id = _create_grade_and_subject("asgn_pub")
        _assign_instructor(instructor_id, subject_id)
        assignment_id = _create_assignment(instructor_id, subject_id, title="To Publish", published=False)

        token = _login(email)
        resp = client.patch(
            f"/api/instructors/assignments/{assignment_id}/publish",
            headers=_auth_header(token),
        )
        assert resp.status_code == 200
        assert resp.json()["is_published"] is True

    def test_publish_already_published(self):
        email, instructor_id = _create_user("asgn_repub")
        grade_id, subject_id = _create_grade_and_subject("asgn_repub")
        _assign_instructor(instructor_id, subject_id)
        assignment_id = _create_assignment(instructor_id, subject_id, title="Already Pub", published=True)

        token = _login(email)
        resp = client.patch(
            f"/api/instructors/assignments/{assignment_id}/publish",
            headers=_auth_header(token),
        )
        assert resp.status_code == 400
        assert "already published" in resp.json()["detail"]


class TestAssignmentDelete:
    """GD-89: DELETE /api/instructors/assignments/{id}"""

    def test_delete_draft_assignment(self):
        email, instructor_id = _create_user("asgn_del")
        grade_id, subject_id = _create_grade_and_subject("asgn_del")
        _assign_instructor(instructor_id, subject_id)
        assignment_id = _create_assignment(instructor_id, subject_id, title="To Delete", published=False)

        token = _login(email)
        resp = client.delete(
            f"/api/instructors/assignments/{assignment_id}",
            headers=_auth_header(token),
        )
        assert resp.status_code == 204

        # Verify it's gone
        resp = client.get(
            f"/api/instructors/assignments/{assignment_id}",
            headers=_auth_header(token),
        )
        assert resp.status_code == 404

    def test_delete_published_assignment_fails(self):
        email, instructor_id = _create_user("asgn_del_pub")
        grade_id, subject_id = _create_grade_and_subject("asgn_del_pub")
        _assign_instructor(instructor_id, subject_id)
        assignment_id = _create_assignment(instructor_id, subject_id, title="Pub Delete", published=True)

        token = _login(email)
        resp = client.delete(
            f"/api/instructors/assignments/{assignment_id}",
            headers=_auth_header(token),
        )
        assert resp.status_code == 400
        assert "Cannot delete published assignment" in resp.json()["detail"]

    def test_delete_assignment_with_submissions_fails(self):
        email, instructor_id = _create_user("asgn_del_sub")
        grade_id, subject_id = _create_grade_and_subject("asgn_del_sub")
        _assign_instructor(instructor_id, subject_id)
        assignment_id = _create_assignment(instructor_id, subject_id, title="Has Subs", published=False)

        # Create a student and submission
        _, stu_id = _create_user("del_sub_stu", role="student")
        _enroll_student(stu_id, grade_id, subject_id)
        _create_submission(stu_id, assignment_id, subject_id)

        token = _login(email)
        resp = client.delete(
            f"/api/instructors/assignments/{assignment_id}",
            headers=_auth_header(token),
        )
        assert resp.status_code == 400
        assert "Cannot delete assignment with submissions" in resp.json()["detail"]

    def test_delete_not_found(self):
        email, _ = _create_user("asgn_del_nf")
        token = _login(email)
        fake_id = str(uuid.uuid4())
        resp = client.delete(
            f"/api/instructors/assignments/{fake_id}",
            headers=_auth_header(token),
        )
        assert resp.status_code == 404
