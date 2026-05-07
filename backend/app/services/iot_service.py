import re
import ipaddress
from datetime import datetime, timezone

from sqlalchemy.orm import Session

from app.core.security import verify_password
from app.db.models.audit_log import AuditLog
from app.db.models.iot_device import IotDevice
from app.db.models.notification import Notification
from app.db.models.sensor_log import SensorLog
from app.db.models.system_setting import SystemSetting
from app.db.models.user import User
from app.shared.source_enum import AlertTriggered, NotificationChannel, NotificationType, UserRole

_TOPIC_PATTERN = re.compile(
    r"^gyanavriksha/devices/(?P<node_id>[^/]+)/(?P<channel>sensors/light|sensors/distance|status)$"
)


def _get_int_setting(db: Session, key: str) -> int:
    row = db.query(SystemSetting).filter(SystemSetting.key == key).first()
    if not row or row.value is None:
        return 0
    try:
        return int(row.value)
    except ValueError:
        return 0


def _set_int_setting(db: Session, key: str, value: int) -> None:
    row = db.query(SystemSetting).filter(SystemSetting.key == key).first()
    now = datetime.now(timezone.utc)
    if row:
        row.value = str(value)
        row.updated_at = now
        db.flush()
        return
    db.add(SystemSetting(key=key, value=str(value), updated_at=now))
    db.flush()


def _increment_counter(db: Session, key: str) -> None:
    _set_int_setting(db, key, _get_int_setting(db, key) + 1)


def _log_integrity_violation(db: Session, reason: str, topic: str, ip_address: str | None) -> None:
    sanitized_ip = _sanitize_ip(ip_address)
    db.add(
        AuditLog(
            actor_id=None,
            actor_role=None,
            action="IOT_INTEGRITY_VIOLATION",
            resource_type="iot_telemetry",
            resource_id=topic,
            ip_address=sanitized_ip,
            extra_metadata={"description": reason, "status": "failed"},
        )
    )
    _increment_counter(db, "iot_integrity_violations")
    admins = (
        db.query(User)
        .filter(User.role == UserRole.ADMIN, User.is_active == True)
        .all()
    )
    for admin in admins:
        db.add(
            Notification(
                recipient_id=admin.user_id,
                type=NotificationType.AT_RISK_FLAG,
                title="IoT integrity violation detected",
                body=reason,
                channel=NotificationChannel.IN_APP,
                is_read=False,
                related_resource_id=topic,
                sent_at=datetime.now(timezone.utc),
            )
        )


def _parse_topic(topic: str) -> tuple[str, str] | None:
    match = _TOPIC_PATTERN.match(topic or "")
    if not match:
        return None
    return match.group("node_id"), match.group("channel")


def _sanitize_ip(ip: str | None) -> str | None:
    if not ip:
        return None
    try:
        ipaddress.ip_address(ip)
        return ip
    except ValueError:
        return None


def _resolve_alert(distance_state: str | None) -> AlertTriggered | None:
    if distance_state == "too_close":
        return AlertTriggered.POSTURE
    if distance_state == "away":
        return AlertTriggered.ABSENCE
    return None


def ingest_telemetry(
    db: Session,
    topic: str,
    payload: dict,
    api_key: str,
    ip_address: str | None,
) -> dict:
    parsed = _parse_topic(topic)
    if not parsed:
        _increment_counter(db, "iot_ingest_rejected")
        _log_integrity_violation(db, "Invalid topic format", topic, ip_address)
        db.commit()
        return {"accepted": False, "reason": "invalid_topic"}

    node_id, channel = parsed
    device = (
        db.query(IotDevice)
        .filter(IotDevice.node_id == node_id)
        .first()
    )
    if not device:
        _increment_counter(db, "iot_ingest_rejected")
        _log_integrity_violation(db, "Unknown device", topic, ip_address)
        db.commit()
        return {"accepted": False, "reason": "unknown_device"}

    if device.status == "decommissioned" or not device.is_active:
        _increment_counter(db, "iot_ingest_rejected")
        _log_integrity_violation(db, "Decommissioned or inactive device", topic, ip_address)
        db.commit()
        return {"accepted": False, "reason": "device_inactive"}

    if not verify_password(api_key, device.api_key_hash):
        _increment_counter(db, "iot_ingest_rejected")
        _log_integrity_violation(db, "Invalid device API key", topic, ip_address)
        db.commit()
        return {"accepted": False, "reason": "invalid_api_key"}

    payload_device_id = payload.get("device_id")
    if payload_device_id != node_id:
        _increment_counter(db, "iot_ingest_rejected")
        _log_integrity_violation(db, "Payload device_id does not match topic node_id", topic, ip_address)
        db.commit()
        return {"accepted": False, "reason": "topic_payload_mismatch"}

    now = datetime.now(timezone.utc)
    device.last_seen_at = now
    device.last_ip_address = _sanitize_ip(ip_address)
    if channel == "status":
        device.status = "online"
        _increment_counter(db, "iot_ingest_accepted")
        db.commit()
        return {"accepted": True, "reason": "status_updated"}

    if channel == "sensors/light":
        log = SensorLog(
            device_id=device.device_id,
            sensor_type="ldr",
            ldr_value=float(payload.get("raw_light") if payload.get("raw_light") is not None else payload.get("value", 0)),
            led_activated=(payload.get("led_state") == "on") if payload.get("led_state") is not None else bool(payload.get("led_active")),
            alert_triggered=None,
            recorded_at=now,
        )
        db.add(log)
        _increment_counter(db, "iot_ingest_accepted")
        db.commit()
        return {"accepted": True, "reason": "light_ingested"}

    if channel == "sensors/distance":
        log = SensorLog(
            device_id=device.device_id,
            sensor_type="ultrasonic",
            distance_cm=float(payload.get("distance_cm", -1)),
            alert_triggered=_resolve_alert(payload.get("state")),
            recorded_at=now,
        )
        db.add(log)
        _increment_counter(db, "iot_ingest_accepted")
        db.commit()
        return {"accepted": True, "reason": "distance_ingested"}

    _increment_counter(db, "iot_ingest_rejected")
    _log_integrity_violation(db, "Unsupported channel", topic, ip_address)
    db.commit()
    return {"accepted": False, "reason": "unsupported_channel"}
