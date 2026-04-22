"""
Sprint 5 — Admin Bulk CSV Import Integration Tests
10 tests covering role guard, CSV validation, created/skipped/failed rows,
mixed-role batches, and the returned summary counters.
"""
import io
import uuid
from unittest.mock import patch

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.core.config import settings
from app.core.database import get_db
from app.core.security import hash_password
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


def _create_user_db(suffix: str, role: str = "admin") -> User:
    db = TestSession()
    user = User(
        email=f"bi_{RUN_ID}_{suffix}@example.com",
        password_hash=hash_password(TEST_PASSWORD),
        full_name=f"BI {suffix}",
        role=UserRole(role),
        is_active=True,
        is_email_verified=True,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    db.close()
    return user


def _login(email: str) -> str:
    resp = client.post("/api/auth/login", json={"email": email, "password": TEST_PASSWORD})
    assert resp.status_code == 200, resp.json()
    return resp.json()["access_token"]


def _auth(token: str) -> dict:
    return {"Authorization": f"Bearer {token}"}


def _csv_file(content: str) -> dict:
    return {"file": ("import.csv", io.BytesIO(content.encode()), "text/csv")}


def _admin_token() -> str:
    admin = _create_user_db(f"adm_{uuid.uuid4().hex[:4]}")
    return _login(admin.email)


@patch("app.api.admin.application.service.send_welcome_email")
class TestBulkImportGuard:
    def test_requires_admin_role(self, _mock_email):
        student = _create_user_db(f"guard_{uuid.uuid4().hex[:4]}", "student")
        token = _login(student.email)
        csv_content = "full_name,email\nAlice,alice@x.com"
        resp = client.post(
            "/api/admin/users/bulk-import?role=student",
            headers=_auth(token),
            files=_csv_file(csv_content),
        )
        assert resp.status_code == 403

    def test_instructor_cannot_import(self, _mock_email):
        inst = _create_user_db(f"inst_{uuid.uuid4().hex[:4]}", "instructor")
        token = _login(inst.email)
        csv_content = "full_name,email\nBob,bob@x.com"
        resp = client.post(
            "/api/admin/users/bulk-import?role=student",
            headers=_auth(token),
            files=_csv_file(csv_content),
        )
        assert resp.status_code == 403


@patch("app.api.admin.application.service.send_welcome_email")
class TestBulkImportValidation:
    def test_missing_email_column_returns_422(self, _mock_email):
        token = _admin_token()
        csv_content = "full_name,phone\nAlice,123"
        resp = client.post(
            "/api/admin/users/bulk-import?role=student",
            headers=_auth(token),
            files=_csv_file(csv_content),
        )
        assert resp.status_code == 422
        assert "email" in resp.json()["detail"]

    def test_missing_full_name_column_returns_422(self, _mock_email):
        token = _admin_token()
        csv_content = "email,phone\nalice@x.com,123"
        resp = client.post(
            "/api/admin/users/bulk-import?role=student",
            headers=_auth(token),
            files=_csv_file(csv_content),
        )
        assert resp.status_code == 422
        assert "full_name" in resp.json()["detail"]

    def test_empty_data_rows_returns_400(self, _mock_email):
        token = _admin_token()
        csv_content = "full_name,email\n"
        resp = client.post(
            "/api/admin/users/bulk-import?role=student",
            headers=_auth(token),
            files=_csv_file(csv_content),
        )
        assert resp.status_code == 400


@patch("app.api.admin.application.service.send_welcome_email")
class TestBulkImportCreation:
    def test_creates_students_and_returns_summary(self, mock_email):
        token = _admin_token()
        uid = uuid.uuid4().hex[:6]
        csv_content = (
            "full_name,email\n"
            f"Student One,s1_{uid}@example.com\n"
            f"Student Two,s2_{uid}@example.com\n"
        )
        resp = client.post(
            "/api/admin/users/bulk-import?role=student",
            headers=_auth(token),
            files=_csv_file(csv_content),
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data["total_rows"] == 2
        assert data["created"] == 2
        assert data["skipped"] == 0
        assert data["failed"] == 0
        assert mock_email.call_count >= 2

    def test_creates_instructors(self, mock_email):
        token = _admin_token()
        uid = uuid.uuid4().hex[:6]
        csv_content = f"full_name,email\nInstructor A,ia_{uid}@example.com\n"
        resp = client.post(
            "/api/admin/users/bulk-import?role=instructor",
            headers=_auth(token),
            files=_csv_file(csv_content),
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data["created"] == 1
        assert data["results"][0]["status"] == "created"
        assert data["results"][0]["generated_password"] is not None

    def test_skips_duplicate_emails(self, mock_email):
        token = _admin_token()
        uid = uuid.uuid4().hex[:6]
        existing = _create_user_db(f"dup_{uid}", "student")
        csv_content = (
            "full_name,email\n"
            f"New User,new_{uid}@example.com\n"
            f"Existing,{existing.email}\n"
        )
        resp = client.post(
            "/api/admin/users/bulk-import?role=student",
            headers=_auth(token),
            files=_csv_file(csv_content),
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data["created"] == 1
        assert data["skipped"] == 1
        skipped = next(r for r in data["results"] if r["status"] == "skipped")
        assert skipped["email"] == existing.email
        assert "already registered" in skipped["reason"]

    def test_fails_row_with_empty_email(self, mock_email):
        token = _admin_token()
        uid = uuid.uuid4().hex[:6]
        csv_content = (
            "full_name,email\n"
            f"Valid User,valid_{uid}@example.com\n"
            "No Email,\n"
        )
        resp = client.post(
            "/api/admin/users/bulk-import?role=student",
            headers=_auth(token),
            files=_csv_file(csv_content),
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data["created"] == 1
        assert data["failed"] == 1
        failed = next(r for r in data["results"] if r["status"] == "failed")
        assert "required" in failed["reason"]

    def test_result_rows_contain_correct_fields(self, mock_email):
        token = _admin_token()
        uid = uuid.uuid4().hex[:6]
        csv_content = f"full_name,email\nField Test,ft_{uid}@example.com\n"
        resp = client.post(
            "/api/admin/users/bulk-import?role=instructor",
            headers=_auth(token),
            files=_csv_file(csv_content),
        )
        assert resp.status_code == 200
        row = resp.json()["results"][0]
        assert "row" in row
        assert "email" in row
        assert "full_name" in row
        assert "status" in row
        assert "generated_password" in row
