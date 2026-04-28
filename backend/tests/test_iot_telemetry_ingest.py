import uuid

from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.core.config import settings
from app.core.database import get_db
from app.core.security import hash_password
from app.db.models.iot_device import IotDevice
from app.db.models.sensor_log import SensorLog
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
API_KEY = "iot_test_key_123"


def _create_admin() -> User:
    db = TestSession()
    user = User(
        email=f"iot_ingest_admin_{RUN_ID}@example.com",
        password_hash=hash_password("StrongPass@123"),
        full_name="IoT Ingest Admin",
        role=UserRole.ADMIN,
        is_active=True,
        is_email_verified=True,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    db.close()
    return user


def _create_device(node_id: str, registered_by, status: str = "offline") -> IotDevice:
    db = TestSession()
    device = IotDevice(
        node_id=node_id,
        device_type="ESP32",
        location="Lab 1",
        api_key_hash=hash_password(API_KEY),
        mqtt_topic_prefix=f"gyanavriksha/devices/{node_id}",
        device_mac=":".join(uuid.uuid4().hex[:12][i : i + 2] for i in range(0, 12, 2)),
        status=status,
        is_active=status != "decommissioned",
        registered_by=registered_by,
    )
    db.add(device)
    db.commit()
    db.refresh(device)
    db.close()
    return device


def test_ingest_light_telemetry_success():
    admin = _create_admin()
    node_id = f"smartdesk_{RUN_ID}_ok"
    device = _create_device(node_id, admin.user_id, status="online")
    payload = {
        "topic": f"gyanavriksha/devices/{node_id}/sensors/light",
        "payload": {"device_id": node_id, "raw_light": 1234, "bucket": "normal", "led_state": "off"},
    }
    resp = client.post("/api/iot/telemetry", json=payload, headers={"x-device-api-key": API_KEY})
    assert resp.status_code == 200
    db = TestSession()
    count = db.query(SensorLog).filter(SensorLog.device_id == device.device_id).count()
    db.close()
    assert count >= 1


def test_ingest_rejects_invalid_api_key():
    admin = _create_admin()
    node_id = f"smartdesk_{RUN_ID}_badkey"
    _create_device(node_id, admin.user_id, status="online")
    payload = {
        "topic": f"gyanavriksha/devices/{node_id}/status",
        "payload": {"device_id": node_id, "status": "online"},
    }
    resp = client.post("/api/iot/telemetry", json=payload, headers={"x-device-api-key": "wrong_key"})
    assert resp.status_code == 403
    assert resp.json()["detail"] == "invalid_api_key"


def test_ingest_rejects_topic_payload_mismatch():
    admin = _create_admin()
    node_id = f"smartdesk_{RUN_ID}_spoof"
    _create_device(node_id, admin.user_id, status="online")
    payload = {
        "topic": f"gyanavriksha/devices/{node_id}/sensors/distance",
        "payload": {"device_id": "other_node", "distance_cm": 20.0, "state": "too_close"},
    }
    resp = client.post("/api/iot/telemetry", json=payload, headers={"x-device-api-key": API_KEY})
    assert resp.status_code == 403
    assert resp.json()["detail"] == "topic_payload_mismatch"


def test_ingest_rejects_decommissioned_device():
    admin = _create_admin()
    node_id = f"smartdesk_{RUN_ID}_dec"
    _create_device(node_id, admin.user_id, status="decommissioned")
    payload = {
        "topic": f"gyanavriksha/devices/{node_id}/status",
        "payload": {"device_id": node_id, "status": "online"},
    }
    resp = client.post("/api/iot/telemetry", json=payload, headers={"x-device-api-key": API_KEY})
    assert resp.status_code == 403
    assert resp.json()["detail"] == "device_inactive"
