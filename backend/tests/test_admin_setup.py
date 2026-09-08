"""
Sprint 5 Phase 1 — Admin Setup Integration Tests (GD-110, GD-111, GD-112)
Verifies the admin router scaffolding: dashboard endpoint and RBAC guard.
"""
import uuid

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


def _create_user(suffix: str, role: str = "student") -> str:
    """Insert a user directly into the DB and return their email."""
    email = f"setup_{RUN_ID}_{suffix}@example.com"
    db = TestSession()
    user = User(
        email=email,
        password_hash=hash_password(TEST_PASSWORD),
        full_name=f"Setup {suffix}",
        role=UserRole(role),
        is_active=True,
        is_email_verified=True,
    )
    db.add(user)
    db.commit()
    db.close()
    return email


def _token(email: str) -> str:
    resp = client.post("/api/auth/login", json={"email": email, "password": TEST_PASSWORD})
    assert resp.status_code == 200, resp.json()
    return resp.json()["access_token"]


def _auth(email: str) -> dict:
    return {"Authorization": f"Bearer {_token(email)}"}


class TestAdminDashboardRbac:
    """Dashboard endpoint enforces admin-only access (GD-111)."""

    def test_dashboard_accessible_as_admin(self):
        email = _create_user("dash_admin", "admin")
        resp = client.get("/api/admin/dashboard", headers=_auth(email))
        assert resp.status_code == 200

    def test_dashboard_blocked_for_student(self):
        email = _create_user("dash_student", "student")
        resp = client.get("/api/admin/dashboard", headers=_auth(email))
        assert resp.status_code == 403

    def test_dashboard_blocked_for_instructor(self):
        email = _create_user("dash_instructor", "instructor")
        resp = client.get("/api/admin/dashboard", headers=_auth(email))
        assert resp.status_code == 403

    def test_dashboard_requires_authentication(self):
        resp = client.get("/api/admin/dashboard")
        assert resp.status_code == 401


class TestAdminDashboardPayload:
    """Dashboard response contains expected top-level keys (GD-111)."""

    def test_dashboard_returns_expected_shape(self):
        email = _create_user("dash_shape", "admin")
        resp = client.get("/api/admin/dashboard", headers=_auth(email))
        assert resp.status_code == 200
        data = resp.json()
        assert "two_fa_compliance_pct" in data
        assert "integrity_status" in data


class TestAdminSchemaImports:
    """All admin Pydantic schemas import without errors (GD-110)."""

    def test_schema_imports(self):
        from app.schemas.admin import (
            AdminDashboardResponse,
            AdminSettingsUpdateRequest,
            AdminUserCreateRequest,
            AdminUserListResponse,
            AdminUserResponse,
            AuditLogResponse,
            GradeCreateRequest,
            GradeResponse,
            IngestionJobResponse,
            IoTDeviceCreateRequest,
            SubjectCreateRequest,
            SubjectResponse,
        )
        assert AdminDashboardResponse is not None
        assert AdminUserCreateRequest is not None
        assert GradeCreateRequest is not None
        assert IngestionJobResponse is not None
