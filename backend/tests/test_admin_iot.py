"""
Sprint 5 Phase 5 — Admin IoT Device Management Integration Tests (GD-121, GD-122)
12 tests covering device registry CRUD, API key regeneration, health stats,
telemetry retrieval, and manual status override.
"""
import uuid

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.core.config import settings
from app.core.database import get_db
from app.core.security import hash_password
from app.db.models.iot_device import IotDevice
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


def _create_user(suffix: str, role: str = "admin") -> User:
    email = f"iot_{RUN_ID}_{suffix}@example.com"
    db = TestSession()
    user = User(
        email=email,
        password_hash=hash_password(TEST_PASSWORD),
        full_name=f"IoT {suffix}",
        role=UserRole(role),
        is_active=True,
        is_email_verified=True,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    db.close()
    return user


def _create_device(node_id: str, admin_id, status: str = "offline") -> IotDevice:
    """Insert a device row directly for test setup."""
    db = TestSession()
    device = IotDevice(
        node_id=node_id,
        device_type="ESP32",
        location="Room 101",
        api_key_hash=hash_password("testkey"),
        mqtt_topic_prefix=f"iot/{node_id}",
        device_mac=":".join(uuid.uuid4().hex[:12][i : i + 2] for i in range(0, 12, 2)),
        status=status,
        registered_by=admin_id,
    )
    db.add(device)
    db.commit()
    db.refresh(device)
    db.close()
    return device


def _login(email: str) -> str:
    resp = client.post("/api/auth/login", json={"email": email, "password": TEST_PASSWORD})
    assert resp.status_code == 200, resp.json()
    return resp.json()["access_token"]


def _auth(token: str) -> dict:
    return {"Authorization": f"Bearer {token}"}


# ---------------------------------------------------------------------------
# GD-121 — Device registry CRUD
# ---------------------------------------------------------------------------

def test_list_devices_requires_admin():
    student = _create_user("stu1", role="student")
    token = _login(student.email)
    resp = client.get("/api/admin/iot/devices", headers=_auth(token))
    assert resp.status_code == 403


def test_list_devices_returns_summary():
    admin = _create_user("adm_list")
    admin_id = admin.user_id
    node = f"N_{RUN_ID}_list"
    _create_device(node, admin_id, status="online")
    token = _login(admin.email)
    resp = client.get("/api/admin/iot/devices", headers=_auth(token))
    assert resp.status_code == 200
    data = resp.json()
    assert "devices" in data
    assert "total_count" in data
    assert "active_nodes" in data
    assert "alerts_count" in data
    assert data["active_nodes"] >= 1


def test_filter_devices_by_status():
    admin = _create_user("adm_filt")
    admin_id = admin.user_id
    node_on = f"N_{RUN_ID}_on"
    node_off = f"N_{RUN_ID}_off"
    _create_device(node_on, admin_id, status="online")
    _create_device(node_off, admin_id, status="offline")
    token = _login(admin.email)
    resp = client.get("/api/admin/iot/devices?status=online", headers=_auth(token))
    assert resp.status_code == 200
    data = resp.json()
    statuses = [d["status"] for d in data["devices"]]
    assert all(s == "online" for s in statuses)


def test_register_device_returns_api_key():
    admin = _create_user("adm_reg")
    token = _login(admin.email)
    node_id = f"ESP_{RUN_ID}_reg"
    resp = client.post(
        "/api/admin/iot/devices",
        json={"node_id": node_id, "device_type": "ESP32", "location": "Lab 1"},
        headers=_auth(token),
    )
    assert resp.status_code == 201
    data = resp.json()
    assert "api_key" in data
    assert len(data["api_key"]) > 10
    assert data["node_id"] == node_id
    assert data["status"] == "offline"


def test_register_duplicate_node_id_returns_409():
    admin = _create_user("adm_dup")
    admin_id = admin.user_id
    node_id = f"ESP_{RUN_ID}_dup"
    _create_device(node_id, admin_id)
    token = _login(admin.email)
    resp = client.post(
        "/api/admin/iot/devices",
        json={"node_id": node_id, "device_type": "Arduino", "location": "Lab 2"},
        headers=_auth(token),
    )
    assert resp.status_code == 409


def test_get_device_detail():
    admin = _create_user("adm_det")
    admin_id = admin.user_id
    node_id = f"N_{RUN_ID}_det"
    device = _create_device(node_id, admin_id)
    token = _login(admin.email)
    resp = client.get(f"/api/admin/iot/devices/{device.device_id}", headers=_auth(token))
    assert resp.status_code == 200
    data = resp.json()
    assert data["node_id"] == node_id
    assert "recent_telemetry" in data
    assert isinstance(data["recent_telemetry"], list)


def test_update_device_location():
    admin = _create_user("adm_upd")
    admin_id = admin.user_id
    node_id = f"N_{RUN_ID}_upd"
    device = _create_device(node_id, admin_id)
    token = _login(admin.email)
    resp = client.patch(
        f"/api/admin/iot/devices/{device.device_id}",
        json={"location": "Updated Room 999"},
        headers=_auth(token),
    )
    assert resp.status_code == 200
    assert resp.json()["location"] == "Updated Room 999"


def test_decommission_device():
    admin = _create_user("adm_dec")
    admin_id = admin.user_id
    node_id = f"N_{RUN_ID}_dec"
    device = _create_device(node_id, admin_id)
    token = _login(admin.email)
    resp = client.delete(f"/api/admin/iot/devices/{device.device_id}", headers=_auth(token))
    assert resp.status_code == 204
    detail = client.get(f"/api/admin/iot/devices/{device.device_id}", headers=_auth(token))
    assert detail.json()["status"] == "decommissioned"


def test_regenerate_api_key():
    admin = _create_user("adm_regen")
    admin_id = admin.user_id
    node_id = f"N_{RUN_ID}_regen"
    device = _create_device(node_id, admin_id)
    token = _login(admin.email)
    resp = client.post(
        f"/api/admin/iot/devices/{device.device_id}/regenerate-key",
        headers=_auth(token),
    )
    assert resp.status_code == 200
    data = resp.json()
    assert "api_key" in data
    assert len(data["api_key"]) > 10
    assert str(data["device_id"]) == str(device.device_id)


# ---------------------------------------------------------------------------
# GD-122 — Health & telemetry
# ---------------------------------------------------------------------------

def test_get_iot_health():
    admin = _create_user("adm_health")
    token = _login(admin.email)
    resp = client.get("/api/admin/iot/health", headers=_auth(token))
    assert resp.status_code == 200
    data = resp.json()
    assert "health_check_pct" in data
    assert "active_device_count" in data
    assert "offline_device_count" in data
    assert "alert_count" in data
    assert data["network_security_protocol"] == "TLS 1.3"


def test_update_device_status_manually():
    admin = _create_user("adm_stat")
    admin_id = admin.user_id
    node_id = f"N_{RUN_ID}_stat"
    device = _create_device(node_id, admin_id, status="offline")
    token = _login(admin.email)
    resp = client.patch(
        f"/api/admin/iot/devices/{device.device_id}/status",
        json={"status": "online"},
        headers=_auth(token),
    )
    assert resp.status_code == 200
    assert resp.json()["status"] == "online"


def test_get_telemetry_empty():
    admin = _create_user("adm_telem")
    admin_id = admin.user_id
    node_id = f"N_{RUN_ID}_telem"
    device = _create_device(node_id, admin_id)
    token = _login(admin.email)
    resp = client.get(
        f"/api/admin/iot/devices/{device.device_id}/telemetry",
        headers=_auth(token),
    )
    assert resp.status_code == 200
    assert resp.json() == []
