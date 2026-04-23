"""
Sprint 5 Phase 3 — Admin Academic Management Integration Tests (GD-116, GD-117)
14 tests covering grade CRUD, subject CRUD with instructor assignment,
and enrollment create/bulk/remove with submission guard.
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


def _create_user(suffix: str, role: str = "student") -> User:
    email = f"acad_{RUN_ID}_{suffix}@example.com"
    db = TestSession()
    user = User(
        email=email,
        password_hash=hash_password(TEST_PASSWORD),
        full_name=f"Acad {suffix}",
        role=UserRole(role),
        is_active=True,
        is_email_verified=True,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    db.close()
    return user


def _create_grade(suffix: str, level: int = 5) -> Grade:
    db = TestSession()
    grade = Grade(grade_name=f"Grade_{RUN_ID}_{suffix}", grade_level=level, is_active=True)
    db.add(grade)
    db.commit()
    db.refresh(grade)
    db.close()
    return grade


def _create_subject(suffix: str, grade_id: int) -> Subject:
    db = TestSession()
    unique = uuid.uuid4().hex[:6]
    subject = Subject(
        grade_id=grade_id,
        subject_name=f"Subject_{RUN_ID}_{suffix}",
        subject_code=f"S{unique}",
        chroma_namespace=f"ns_{unique}_{suffix}",
        is_active=True,
    )
    db.add(subject)
    db.commit()
    db.refresh(subject)
    db.close()
    return subject


def _create_enrollment(student_id, grade_id, subject_id) -> StudentEnrollment:
    db = TestSession()
    enroll = StudentEnrollment(
        student_id=student_id,
        grade_id=grade_id,
        subject_id=subject_id,
        is_active=True,
    )
    db.add(enroll)
    db.commit()
    db.refresh(enroll)
    db.close()
    return enroll


def _login(email: str) -> str:
    resp = client.post("/api/auth/login", json={"email": email, "password": TEST_PASSWORD})
    assert resp.status_code == 200, resp.json()
    return resp.json()["access_token"]


def _auth(token: str) -> dict:
    return {"Authorization": f"Bearer {token}"}


class TestGrades:
    """GD-116 — grade CRUD."""

    def test_list_grades_returns_all_with_counts(self):
        admin = _create_user("g_list_admin", "admin")
        _create_grade("g_list")
        token = _login(admin.email)
        resp = client.get("/api/admin/grades", headers=_auth(token))
        assert resp.status_code == 200
        grades = resp.json()
        assert isinstance(grades, list)
        if grades:
            assert "grade_id" in grades[0]
            assert "subject_count" in grades[0]
            assert "student_count" in grades[0]

    def test_create_grade_success(self):
        admin = _create_user("g_create_admin", "admin")
        token = _login(admin.email)
        resp = client.post(
            "/api/admin/grades",
            json={"grade_name": f"NewGrade_{RUN_ID}", "grade_level": 7},
            headers=_auth(token),
        )
        assert resp.status_code == 201
        assert resp.json()["grade_name"] == f"NewGrade_{RUN_ID}"

    def test_delete_grade_with_subjects_returns_400(self):
        admin = _create_user("g_del_admin", "admin")
        grade = _create_grade("g_del")
        _create_subject("g_del_subj", grade.grade_id)
        token = _login(admin.email)
        resp = client.delete(f"/api/admin/grades/{grade.grade_id}", headers=_auth(token))
        assert resp.status_code == 400


class TestSubjects:
    """GD-116 — subject CRUD and instructor assignment."""

    def test_list_subjects_with_grade_id_filter(self):
        admin = _create_user("s_list_admin", "admin")
        grade = _create_grade("s_list")
        _create_subject("s_list_s1", grade.grade_id)
        token = _login(admin.email)
        resp = client.get(
            f"/api/admin/subjects?grade_id={grade.grade_id}",
            headers=_auth(token),
        )
        assert resp.status_code == 200
        for subj in resp.json():
            assert subj["grade_id"] == grade.grade_id

    def test_list_subjects_with_search(self):
        admin = _create_user("s_search_admin", "admin")
        grade = _create_grade("s_search")
        _create_subject("s_search_target", grade.grade_id)
        token = _login(admin.email)
        resp = client.get(
            f"/api/admin/subjects?search=s_search_target",
            headers=_auth(token),
        )
        assert resp.status_code == 200
        names = [s["name"] for s in resp.json()]
        assert any("s_search_target" in n for n in names)

    def test_create_subject_success(self):
        admin = _create_user("s_create_admin", "admin")
        grade = _create_grade("s_create")
        token = _login(admin.email)
        resp = client.post(
            "/api/admin/subjects",
            json={
                "name": f"Math_{RUN_ID}",
                "subject_code": f"M{uuid.uuid4().hex[:6]}",
                "grade_id": grade.grade_id,
            },
            headers=_auth(token),
        )
        assert resp.status_code == 201

    def test_create_subject_duplicate_code_returns_409(self):
        admin = _create_user("s_dup_admin", "admin")
        grade = _create_grade("s_dup")
        existing = _create_subject("s_dup_existing", grade.grade_id)
        token = _login(admin.email)
        resp = client.post(
            "/api/admin/subjects",
            json={
                "name": f"Other_{RUN_ID}",
                "subject_code": existing.subject_code,
                "grade_id": grade.grade_id,
            },
            headers=_auth(token),
        )
        assert resp.status_code == 409

    def test_assign_instructor_to_subject(self):
        admin = _create_user("s_instr_admin", "admin")
        instructor = _create_user("s_instr_inst", "instructor")
        grade = _create_grade("s_instr")
        subject = _create_subject("s_instr_subj", grade.grade_id)
        token = _login(admin.email)
        resp = client.post(
            f"/api/admin/subjects/{subject.subject_id}/assign-instructor",
            json={"instructor_id": str(instructor.user_id)},
            headers=_auth(token),
        )
        assert resp.status_code == 200


class TestEnrollments:
    """GD-117 — enrollment CRUD with guard checks."""

    def test_list_enrollments_with_filters(self):
        admin = _create_user("e_list_admin", "admin")
        grade = _create_grade("e_list")
        subject = _create_subject("e_list_subj", grade.grade_id)
        student = _create_user("e_list_student", "student")
        _create_enrollment(student.user_id, grade.grade_id, subject.subject_id)
        token = _login(admin.email)
        resp = client.get(
            f"/api/admin/enrollments?subject_id={subject.subject_id}",
            headers=_auth(token),
        )
        assert resp.status_code == 200
        data = resp.json()
        assert "enrollments" in data

    def test_create_enrollment_success(self):
        admin = _create_user("e_create_admin", "admin")
        grade = _create_grade("e_create")
        subject = _create_subject("e_create_subj", grade.grade_id)
        student = _create_user("e_create_student", "student")
        token = _login(admin.email)
        resp = client.post(
            "/api/admin/enrollments",
            json={"student_id": str(student.user_id), "subject_id": subject.subject_id},
            headers=_auth(token),
        )
        assert resp.status_code == 201

    def test_create_enrollment_duplicate_returns_400(self):
        admin = _create_user("e_dup_admin", "admin")
        grade = _create_grade("e_dup")
        subject = _create_subject("e_dup_subj", grade.grade_id)
        student = _create_user("e_dup_student", "student")
        _create_enrollment(student.user_id, grade.grade_id, subject.subject_id)
        token = _login(admin.email)
        resp = client.post(
            "/api/admin/enrollments",
            json={"student_id": str(student.user_id), "subject_id": subject.subject_id},
            headers=_auth(token),
        )
        assert resp.status_code == 400

    def test_bulk_enroll_skips_already_enrolled(self):
        admin = _create_user("e_bulk_admin", "admin")
        grade = _create_grade("e_bulk")
        subject = _create_subject("e_bulk_subj", grade.grade_id)
        s1 = _create_user("e_bulk_s1", "student")
        s2 = _create_user("e_bulk_s2", "student")
        _create_enrollment(s1.user_id, grade.grade_id, subject.subject_id)
        token = _login(admin.email)
        resp = client.post(
            "/api/admin/enrollments/bulk",
            json={
                "student_ids": [str(s1.user_id), str(s2.user_id)],
                "subject_id": subject.subject_id,
            },
            headers=_auth(token),
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data["enrolled_count"] == 1
        assert str(s1.user_id) in data["skipped_student_ids"]

    def test_remove_enrollment_no_submissions(self):
        admin = _create_user("e_rem_admin", "admin")
        grade = _create_grade("e_rem")
        subject = _create_subject("e_rem_subj", grade.grade_id)
        student = _create_user("e_rem_student", "student")
        enroll = _create_enrollment(student.user_id, grade.grade_id, subject.subject_id)
        token = _login(admin.email)
        resp = client.delete(
            f"/api/admin/enrollments/{enroll.enrollment_id}",
            headers=_auth(token),
        )
        assert resp.status_code == 204

    def test_remove_enrollment_with_submissions_returns_400(self):
        admin = _create_user("e_sub_admin", "admin")
        grade = _create_grade("e_sub")
        subject = _create_subject("e_sub_subj", grade.grade_id)
        student = _create_user("e_sub_student", "student")
        enroll = _create_enrollment(student.user_id, grade.grade_id, subject.subject_id)
        db = TestSession()
        assignment = Assignment(
            subject_id=subject.subject_id,
            instructor_id=admin.user_id,
            title=f"Assign_{RUN_ID}",
            max_score=100,
        )
        db.add(assignment)
        db.flush()
        submission = Submission(
            student_id=student.user_id,
            assignment_id=assignment.assignment_id,
            subject_id=subject.subject_id,
            image_path=f"/tmp/test_{RUN_ID}.jpg",
            processing_status=SubmissionProcessingStatus.QUEUED,
        )
        db.add(submission)
        db.commit()
        db.close()
        token = _login(admin.email)
        resp = client.delete(
            f"/api/admin/enrollments/{enroll.enrollment_id}",
            headers=_auth(token),
        )
        assert resp.status_code == 400
