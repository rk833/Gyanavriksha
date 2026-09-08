"""
Sprint 5 Phase 6 — Admin Audit Logs, Security & Dashboard Integration Tests
(GD-123, GD-124, GD-125)
14 tests covering audit log pagination/filters/CSV export, system changes,
security overview/events/integrity audit, admin settings CRUD, and the real dashboard.
"""
import uuid

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.core.config import settings
from app.core.database import get_db
from app.core.security import hash_password
from app.db.models.audit_log import AuditLog
from app.db.models.user import User
from app.main import app
from app.shared.source_enum import ActorRole, UserRole

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


def _create_user(suffix: str, role: str = "admin") -> User:
    email = f"dash_{RUN_ID}_{suffix}@example.com"
    db = TestSession()
    user = User(
        email=email,
        password_hash=hash_password(TEST_PASSWORD),
        full_name=f"Dash {suffix}",
        role=UserRole(role),
        is_active=True,
        is_email_verified=True,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    db.close()
    return user


def _create_audit_log(actor_id, action: str, description: str = "test event") -> None:
    db = TestSession()
    db.add(AuditLog(
        actor_id=actor_id,
        actor_role=ActorRole.ADMIN,
        action=action,
        extra_metadata={"description": description},
    ))
    db.commit()
    db.close()


def _login(email: str) -> str:
    resp = client.post("/api/auth/login", json={"email": email, "password": TEST_PASSWORD})
    assert resp.status_code == 200, resp.json()
    return resp.json()["access_token"]


def _auth(token: str) -> dict:
    return {"Authorization": f"Bearer {token}"}


def test_dashboard_requires_admin():
    student = _create_user("stu_dash", role="student")
    token = _login(student.email)
    resp = client.get("/api/admin/dashboard", headers=_auth(token))
    assert resp.status_code == 403


def test_dashboard_returns_all_fields():
    admin = _create_user("adm_dash")
    token = _login(admin.email)
    resp = client.get("/api/admin/dashboard", headers=_auth(token))
    assert resp.status_code == 200
    data = resp.json()
    assert "iot_nodes_active" in data
    assert "two_fa_compliance_pct" in data
    assert "integrity_status" in data
    assert "system_health" in data
    assert "quick_user_access" in data


def test_audit_logs_list_requires_admin():
    student = _create_user("stu_audit", role="student")
    token = _login(student.email)
    resp = client.get("/api/admin/audit-logs", headers=_auth(token))
    assert resp.status_code == 403


def test_audit_logs_event_type_filter():
    admin = _create_user("adm_aud_evt")
    admin_id = admin.user_id
    action = f"TEST_EVENT_{RUN_ID}"
    _create_audit_log(admin_id, action, "filter test event")
    token = _login(admin.email)
    resp = client.get(f"/api/admin/audit-logs?event_type={action}", headers=_auth(token))
    assert resp.status_code == 200
    data = resp.json()
    assert data["total_count"] >= 1
    assert all(action in entry["event_type"] for entry in data["logs"])


def test_audit_logs_date_range_filter():
    admin = _create_user("adm_aud_date")
    admin_id = admin.user_id
    _create_audit_log(admin_id, f"DATE_EVT_{RUN_ID}", "date range test")
    token = _login(admin.email)
    resp = client.get(
        "/api/admin/audit-logs?date_from=2020-01-01T00:00:00&date_to=2099-12-31T23:59:59",
        headers=_auth(token),
    )
    assert resp.status_code == 200
    assert resp.json()["total_count"] >= 1


def test_audit_logs_user_search_filter():
    admin = _create_user("adm_aud_search")
    admin_id = admin.user_id
    _create_audit_log(admin_id, f"SEARCH_EVT_{RUN_ID}", "user search test")
    token = _login(admin.email)
    resp = client.get(
        f"/api/admin/audit-logs?user_search=dash_{RUN_ID}_adm_aud_search",
        headers=_auth(token),
    )
    assert resp.status_code == 200
    assert resp.json()["total_count"] >= 1


def test_audit_logs_csv_export():
    admin = _create_user("adm_csv")
    admin_id = admin.user_id
    _create_audit_log(admin_id, f"CSV_EVT_{RUN_ID}", "csv export test")
    token = _login(admin.email)
    resp = client.get("/api/admin/audit-logs/export", headers=_auth(token))
    assert resp.status_code == 200
    assert "text/csv" in resp.headers["content-type"]
    assert "log_id" in resp.text


def test_system_changes_endpoint():
    admin = _create_user("adm_sys_chg")
    admin_id = admin.user_id
    _create_audit_log(admin_id, "IOT_DEVICE_REGISTERED", "system change test")
    token = _login(admin.email)
    resp = client.get("/api/admin/audit-logs/system-changes", headers=_auth(token))
    assert resp.status_code == 200
    data = resp.json()
    assert isinstance(data, list)
    assert len(data) <= 5


def test_security_overview_returns_all_fields():
    admin = _create_user("adm_sec_ov")
    token = _login(admin.email)
    resp = client.get("/api/admin/security/overview", headers=_auth(token))
    assert resp.status_code == 200
    data = resp.json()
    assert "jwt_rbac_status" in data
    assert "two_fa_compliance" in data
    assert "overall_security_score" in data
    assert "integrity_status" in data
    assert "device_auth" in data


def test_security_events_returns_list():
    admin = _create_user("adm_sec_evt")
    admin_id = admin.user_id
    _create_audit_log(admin_id, "ROLE_CHANGE", "role changed for test")
    token = _login(admin.email)
    resp = client.get("/api/admin/security/events", headers=_auth(token))
    assert resp.status_code == 200
    data = resp.json()
    assert isinstance(data, list)
    assert len(data) <= 20


def test_run_integrity_audit():
    admin = _create_user("adm_audit_run")
    token = _login(admin.email)
    resp = client.post("/api/admin/security/run-audit", headers=_auth(token))
    assert resp.status_code == 200
    data = resp.json()
    assert data["hash_check_status"] == "Valid & Synchronized"
    assert "hash_value" in data
    assert "verified_documents" in data
    assert "audit_time" in data


def test_get_settings_returns_defaults():
    admin = _create_user("adm_get_set")
    token = _login(admin.email)
    resp = client.get("/api/admin/settings", headers=_auth(token))
    assert resp.status_code == 200
    data = resp.json()
    assert "ocr_engine" in data
    assert "rag_chunk_size" in data
    assert "maintenance_mode" in data


def test_update_settings_ocr_engine():
    admin = _create_user("adm_upd_set")
    token = _login(admin.email)
    resp = client.patch(
        "/api/admin/settings",
        json={"ocr_engine": "google_vision"},
        headers=_auth(token),
    )
    assert resp.status_code == 200
    assert resp.json()["ocr_engine"] == "google_vision"


def test_enable_maintenance_mode_creates_audit_log():
    admin = _create_user("adm_maint")
    token = _login(admin.email)
    resp = client.patch(
        "/api/admin/settings",
        json={"maintenance_mode": True},
        headers=_auth(token),
    )
    assert resp.status_code == 200
    assert resp.json()["maintenance_mode"] is True
    db = TestSession()
    log = (
        db.query(AuditLog)
        .filter(AuditLog.action == "MAINTENANCE_MODE_ENABLED")
        .order_by(AuditLog.log_id.desc())
        .first()
    )
    db.close()
    assert log is not None
