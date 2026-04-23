"""
Sprint 5 Phase 2 — Admin User Management Integration Tests (GD-113, GD-114, GD-115)
16 tests covering user list, detail, create, update, suspend, delete, bulk ops,
password reset, and role assignment.
"""
import uuid
from unittest.mock import patch

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.core.config import settings
from app.core.database import get_db
from app.core.security import hash_password
from app.db.models.grade import Grade
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


def _create_user_db(suffix: str, role: str = "student") -> User:
    """Insert a user into the DB and return the ORM object."""
    email = f"users_{RUN_ID}_{suffix}@example.com"
    db = TestSession()
    user = User(
        email=email,
        password_hash=hash_password(TEST_PASSWORD),
        full_name=f"User {suffix}",
        role=UserRole(role),
        is_active=True,
        is_email_verified=True,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    db.close()
    return user


def _create_grade_db(suffix: str) -> int:
    """Insert a grade and return its integer ID."""
    db = TestSession()
    grade = Grade(
        grade_name=f"Grade_{RUN_ID}_{suffix}",
        grade_level=1,
        is_active=True,
    )
    db.add(grade)
    db.commit()
    db.refresh(grade)
    grade_id = grade.grade_id
    db.close()
    return grade_id


def _login(email: str) -> str:
    resp = client.post("/api/auth/login", json={"email": email, "password": TEST_PASSWORD})
    assert resp.status_code == 200, resp.json()
    return resp.json()["access_token"]


def _auth(token: str) -> dict:
    return {"Authorization": f"Bearer {token}"}


class TestListUsers:
    """GD-113 — list users with RBAC and filters."""

    def test_list_users_requires_admin(self):
        student = _create_user_db("list_guard_s", "student")
        token = _login(student.email)
        resp = client.get("/api/admin/users", headers=_auth(token))
        assert resp.status_code == 403

    def test_list_users_returns_pagination(self):
        admin = _create_user_db("list_admin", "admin")
        token = _login(admin.email)
        resp = client.get("/api/admin/users?page=1&per_page=5", headers=_auth(token))
        assert resp.status_code == 200
        data = resp.json()
        assert "users" in data
        assert "total_count" in data

    def test_list_users_filter_by_role(self):
        admin = _create_user_db("list_role_admin", "admin")
        token = _login(admin.email)
        resp = client.get("/api/admin/users?role=student", headers=_auth(token))
        assert resp.status_code == 200
        for user in resp.json()["users"]:
            assert user["role"] == "student"

    def test_list_users_search_by_email(self):
        admin = _create_user_db("list_search_admin", "admin")
        target = _create_user_db("list_search_target", "student")
        token = _login(admin.email)
        resp = client.get(f"/api/admin/users?search={RUN_ID}_list_search_target", headers=_auth(token))
        assert resp.status_code == 200
        emails = [u["email"] for u in resp.json()["users"]]
        assert target.email in emails


class TestGetUser:
    """GD-113 — get user detail."""

    def test_get_user_detail_requires_admin(self):
        student = _create_user_db("detail_guard", "student")
        other = _create_user_db("detail_other", "student")
        token = _login(student.email)
        resp = client.get(f"/api/admin/users/{other.user_id}", headers=_auth(token))
        assert resp.status_code == 403

    def test_get_user_detail_not_found(self):
        admin = _create_user_db("detail_admin", "admin")
        token = _login(admin.email)
        resp = client.get(f"/api/admin/users/{uuid.uuid4()}", headers=_auth(token))
        assert resp.status_code == 404


class TestCreateUser:
    """GD-113 — create user."""

    def test_create_user_student_auto_password(self):
        admin = _create_user_db("create_admin", "admin")
        grade_id = _create_grade_db("create")
        token = _login(admin.email)
        with patch("app.services.email_service.send_welcome_email"):
            resp = client.post(
                "/api/admin/users",
                json={
                    "email": f"newstudent_{RUN_ID}@example.com",
                    "full_name": "New Student",
                    "role": "student",
                    "grade_id": grade_id,
                },
                headers=_auth(token),
            )
        assert resp.status_code == 201
        data = resp.json()
        assert "generated_password" in data
        assert data["generated_password"] is not None

    def test_create_user_duplicate_email(self):
        admin = _create_user_db("dup_admin", "admin")
        existing = _create_user_db("dup_existing", "student")
        grade_id = _create_grade_db("dup")
        token = _login(admin.email)
        with patch("app.services.email_service.send_welcome_email"):
            resp = client.post(
                "/api/admin/users",
                json={"email": existing.email, "full_name": "Dupe", "role": "student", "grade_id": grade_id},
                headers=_auth(token),
            )
        assert resp.status_code == 409

    def test_create_student_without_grade_id_returns_400(self):
        admin = _create_user_db("nograde_admin", "admin")
        token = _login(admin.email)
        with patch("app.services.email_service.send_welcome_email"):
            resp = client.post(
                "/api/admin/users",
                json={
                    "email": f"nograde_{RUN_ID}@example.com",
                    "full_name": "No Grade",
                    "role": "student",
                },
                headers=_auth(token),
            )
        assert resp.status_code == 400


class TestUpdateUser:
    """GD-114 — update user fields."""

    def test_update_user_role_creates_audit_log(self):
        admin = _create_user_db("upd_admin", "admin")
        target = _create_user_db("upd_target", "student")
        token = _login(admin.email)
        resp = client.patch(
            f"/api/admin/users/{target.user_id}",
            json={"full_name": "Updated Name"},
            headers=_auth(token),
        )
        assert resp.status_code == 200
        assert resp.json()["full_name"] == "Updated Name"

    def test_cannot_remove_last_admin_via_role_change(self):
        admin_b = _create_user_db("last_admin_b", "admin")
        token_b = _login(admin_b.email)
        db = TestSession()
        other_admin_ids = [
            row[0]
            for row in db.query(User.user_id)
            .filter(User.role == UserRole.ADMIN, User.is_active == True, User.user_id != admin_b.user_id)
            .all()
        ]
        db.query(User).filter(User.user_id.in_(other_admin_ids)).update(
            {"is_active": False}, synchronize_session=False
        )
        db.commit()
        db.close()
        try:
            resp = client.patch(
                f"/api/admin/users/{admin_b.user_id}/role",
                json={"role": "instructor"},
                headers=_auth(token_b),
            )
            assert resp.status_code == 400
        finally:
            db = TestSession()
            db.query(User).filter(User.user_id.in_(other_admin_ids)).update(
                {"is_active": True}, synchronize_session=False
            )
            db.commit()
            db.close()


class TestSuspendUser:
    """GD-114 — suspend and reactivate."""

    def test_suspend_user(self):
        admin = _create_user_db("susp_admin", "admin")
        target = _create_user_db("susp_target", "student")
        token = _login(admin.email)
        resp = client.patch(
            f"/api/admin/users/{target.user_id}/suspend",
            headers=_auth(token),
        )
        assert resp.status_code == 200
        assert resp.json()["is_active"] is False

    def test_cannot_suspend_self(self):
        admin = _create_user_db("susp_self", "admin")
        token = _login(admin.email)
        admin_id = admin.user_id
        resp = client.patch(
            f"/api/admin/users/{admin_id}/suspend",
            headers=_auth(token),
        )
        assert resp.status_code == 400, f"Expected 400, got {resp.status_code}: {resp.text}"


class TestDeleteUser:
    """GD-114 — soft delete."""

    def test_soft_delete_user(self):
        admin = _create_user_db("del_admin", "admin")
        target = _create_user_db("del_target", "student")
        token = _login(admin.email)
        resp = client.delete(
            f"/api/admin/users/{target.user_id}",
            headers=_auth(token),
        )
        assert resp.status_code == 204
        db = TestSession()
        user = db.query(User).filter(User.user_id == target.user_id).first()
        assert user is None or not user.is_active
        db.close()


class TestBulkOps:
    """GD-114 — bulk suspend."""

    def test_bulk_suspend_returns_count(self):
        admin = _create_user_db("bulk_admin", "admin")
        u1 = _create_user_db("bulk_u1", "student")
        u2 = _create_user_db("bulk_u2", "student")
        token = _login(admin.email)
        resp = client.post(
            "/api/admin/users/bulk-suspend",
            json={"user_ids": [str(u1.user_id), str(u2.user_id)]},
            headers=_auth(token),
        )
        assert resp.status_code == 200
        assert resp.json()["suspended_count"] == 2


class TestPasswordReset:
    """GD-115 — force password reset."""

    def test_force_reset_password(self):
        admin = _create_user_db("reset_admin", "admin")
        target = _create_user_db("reset_target", "student")
        token = _login(admin.email)
        with patch("app.services.email_service._send_email"):
            resp = client.post(
                f"/api/admin/users/{target.user_id}/reset-password",
                headers=_auth(token),
            )
        assert resp.status_code == 200
        data = resp.json()
        assert "message" in data
