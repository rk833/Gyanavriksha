"""
Sprint 2 — Auth Integration Tests
Tests the full authentication flow against a real database.
Admin creates users via seed script; no public registration.
"""
import time
import uuid

import pytest
from fastapi.testclient import TestClient  # type: ignore
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.core.config import settings
from app.core.database import get_db
from app.core.security import hash_password
from app.db import Base
from app.db.models.user import User
from app.main import app
from app.shared.source_enum import UserRole

# Use the real database for integration tests
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
    """Create a user directly in the DB (simulates admin-created accounts)."""
    email = f"test_{RUN_ID}_{suffix}@example.com"
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
    db.close()
    return email


def _login(email):
    resp = client.post("/api/auth/login", json={"email": email, "password": TEST_PASSWORD})
    assert resp.status_code == 200, f"Login failed: {resp.json()}"
    return resp.json()


# Login

class TestLogin:
    def test_login_success(self):
        email = _create_user("login_ok")
        data = _login(email)
        assert data["access_token"] is not None
        assert data["refresh_token"] is not None
        assert data["token_type"] == "bearer"
        assert data["requires_2fa"] is False

    def test_login_wrong_password(self):
        email = _create_user("login_wrong")
        resp = client.post("/api/auth/login", json={
            "email": email,
            "password": "WrongPassword@99",
        })
        assert resp.status_code == 401

    def test_login_nonexistent_user(self):
        resp = client.post("/api/auth/login", json={
            "email": "nobody@nowhere.com",
            "password": TEST_PASSWORD,
        })
        assert resp.status_code == 401


# Token management

class TestGetMe:
    def test_get_me_success(self):
        email = _create_user("me_ok")
        tokens = _login(email)
        resp = client.get("/api/auth/me", headers={
            "Authorization": f"Bearer {tokens['access_token']}",
        })
        assert resp.status_code == 200
        assert resp.json()["email"] == email

    def test_get_me_unauthorized(self):
        resp = client.get("/api/auth/me")
        assert resp.status_code == 401

    def test_get_me_invalid_token(self):
        resp = client.get("/api/auth/me", headers={
            "Authorization": "Bearer invalid.token.here",
        })
        assert resp.status_code == 401


class TestRefreshToken:
    def test_refresh_token_success(self):
        email = _create_user("refresh_ok")
        tokens = _login(email)
        time.sleep(1)
        resp = client.post("/api/auth/refresh", json={
            "refresh_token": tokens["refresh_token"],
        })
        assert resp.status_code == 200
        data = resp.json()
        assert data["access_token"] is not None
        assert data["refresh_token"] is not None

    def test_refresh_token_invalid(self):
        resp = client.post("/api/auth/refresh", json={
            "refresh_token": "invalid.refresh.token",
        })
        assert resp.status_code == 401


class TestLogout:
    def test_logout_success(self):
        email = _create_user("logout_ok")
        tokens = _login(email)
        resp = client.post("/api/auth/logout", headers={
            "Authorization": f"Bearer {tokens['access_token']}",
        })
        assert resp.status_code == 200
        assert "logged out" in resp.json()["message"].lower()


# Password reset

class TestPasswordReset:
    def test_forgot_password_success(self):
        email = _create_user("forgot_ok")
        resp = client.post("/api/auth/forgot-password", json={"email": email})
        assert resp.status_code == 200

    def test_forgot_password_unknown_email(self):
        resp = client.post("/api/auth/forgot-password", json={
            "email": "unknown@nowhere.com",
        })
        assert resp.status_code == 200

    def test_reset_password_invalid_token(self):
        resp = client.post("/api/auth/reset-password", json={
            "token": "invalid-reset-token",
            "new_password": "NewPassword@456",
        })
        assert resp.status_code == 400


# Account lockout

class TestAccountLockout:
    def test_login_account_lockout(self):
        email = _create_user("lockout")
        for _ in range(5):
            client.post("/api/auth/login", json={
                "email": email,
                "password": "WrongPassword@99",
            })
        resp = client.post("/api/auth/login", json={
            "email": email,
            "password": "WrongPassword@99",
        })
        assert resp.status_code == 423
        assert "locked" in resp.json()["detail"].lower()


# Health check

class TestHealth:
    def test_health_check(self):
        resp = client.get("/health")
        assert resp.status_code == 200
        assert resp.json()["status"] == "healthy"

    def test_app_imports(self):
        from app.main import app as test_app
        assert test_app.title == "Gyanavriksha API"
