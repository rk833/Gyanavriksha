"""MQTT subscriber for IoT sensor data.

Subscribes to:
  gyanavriksha/devices/+/sensors/distance
  gyanavriksha/devices/+/sensors/light

On each distance reading, delegates exam pause / forfeit / posture logic
to ``iot_exam_service``.  Light readings are stored as ``SensorLog`` rows only.

The broker host is read from the ``mqtt_broker_host`` system setting row
(falling back to ``localhost:1883`` if unset).  The subscriber is started as a
background daemon thread on FastAPI startup so it never blocks the ASGI server.
"""
from __future__ import annotations

import json
import logging
import re
import threading
import time
import uuid
from datetime import datetime, timezone

import paho.mqtt.client as mqtt

from app.core.database import SessionLocal
from app.db.models.iot_device import IotDevice
from app.db.models.sensor_log import SensorLog
from app.db.models.system_setting import SystemSetting
from app.db.models.user import User

logger = logging.getLogger(__name__)

_DISTANCE_RE = re.compile(
    r"^gyanavriksha/devices/(?P<node_id>[^/]+)/sensors/distance$"
)
_LIGHT_RE = re.compile(
    r"^gyanavriksha/devices/(?P<node_id>[^/]+)/sensors/light$"
)

_TOPIC_DISTANCE = "gyanavriksha/devices/+/sensors/distance"
_TOPIC_LIGHT = "gyanavriksha/devices/+/sensors/light"
_TOPIC_STATUS = "gyanavriksha/devices/+/status"

_STATUS_RE = re.compile(
    r"^gyanavriksha/devices/(?P<node_id>[^/]+)/status$"
)

_mqtt_client: mqtt.Client | None = None

# Per-student monotonic cooldown for posture_alert WebSocket pushes (too-close readings).
_last_posture_alert_monotonic: dict[uuid.UUID, float] = {}
_POSTURE_ALERT_COOLDOWN_SEC = 45.0
_TOO_CLOSE_CM_POSTURE = 30.0


def _maybe_push_posture_alert(db, student_id: uuid.UUID, distance_cm: float) -> None:
    """When the student opted in, push a WS posture_alert for ultrasonic too-close (MQTT path)."""
    if distance_cm < 0 or distance_cm >= _TOO_CLOSE_CM_POSTURE:
        return
    user = db.query(User).filter(User.user_id == student_id).first()
    if user is None:
        return
    prefs = user.notification_preferences or {}
    if prefs.get("posture_connection") is not True:
        return
    now_m = time.monotonic()
    last = _last_posture_alert_monotonic.get(student_id, 0.0)
    if now_m - last < _POSTURE_ALERT_COOLDOWN_SEC:
        return
    _last_posture_alert_monotonic[student_id] = now_m
    try:
        from app.api.ws.iot_session import manager

        manager.send_to_student_sync(
            student_id,
            {
                "type": "posture_alert",
                "distance_cm": distance_cm,
                "message": (
                    "You are sitting too close to your screen. "
                    "Move back for better posture and eye comfort."
                ),
            },
        )
    except Exception:
        logger.debug("MQTT: posture_alert WS push failed", exc_info=True)


def _send_iot_telemetry(student_id: uuid.UUID, fields: dict) -> None:
    """Best-effort: push sparse sensor deltas to student's browser (IoT Status page uses WS)."""
    try:
        from app.api.ws.iot_session import manager
        payload = {"type": "iot_telemetry", **fields}
        manager.send_to_student_sync(student_id, payload)
    except Exception:
        logger.debug("MQTT: iot_telemetry WS broadcast failed", exc_info=True)


def _read_broker_config() -> tuple[str, int]:
    """Read mqtt_broker_host from system settings; fallback to localhost:1883."""
    db = SessionLocal()
    try:
        row = db.query(SystemSetting).filter(SystemSetting.key == "mqtt_broker_host").first()
        raw = str(row.value).strip() if row and row.value else ""
    finally:
        db.close()

    if not raw:
        return "localhost", 1883
    if "://" not in raw:
        raw = f"mqtt://{raw}"
    try:
        import urllib.parse
        parsed = urllib.parse.urlparse(raw)
        host = parsed.hostname or "localhost"
        port = parsed.port or 1883
        return host, int(port)
    except Exception:
        return "localhost", 1883


def _device_for_node(db, node_id: str) -> "IotDevice | None":
    return db.query(IotDevice).filter(IotDevice.node_id == node_id).first()


def _on_connect(client: mqtt.Client, userdata, flags, rc: int) -> None:
    if rc == 0:
        logger.info("MQTT client connected; subscribing to sensor topics")
        client.subscribe(_TOPIC_DISTANCE, qos=1)
        client.subscribe(_TOPIC_LIGHT, qos=1)
        client.subscribe(_TOPIC_STATUS, qos=1)
    else:
        logger.warning("MQTT connection failed with rc=%s", rc)


def _on_disconnect(client: mqtt.Client, userdata, rc: int) -> None:
    if rc != 0:
        logger.warning("MQTT disconnected unexpectedly (rc=%s); will auto-reconnect", rc)


def _on_message(client: mqtt.Client, userdata, msg: mqtt.MQTTMessage) -> None:
    topic = msg.topic
    try:
        payload = json.loads(msg.payload.decode("utf-8", errors="replace"))
    except Exception:
        logger.debug("MQTT: non-JSON payload on topic %s – skipped", topic)
        return

    dist_match = _DISTANCE_RE.match(topic)
    if dist_match:
        node_id = dist_match.group("node_id")
        try:
            cm = float(payload.get("distance_cm", -1))
        except (TypeError, ValueError):
            cm = -1.0
        _handle_distance(node_id, cm)
        return

    light_match = _LIGHT_RE.match(topic)
    if light_match:
        node_id = light_match.group("node_id")
        try:
            ldr_val = float(
                payload.get("raw_light") if payload.get("raw_light") is not None
                else payload.get("value", 0)
            )
        except (TypeError, ValueError):
            ldr_val = 0.0
        led_on = payload.get("led_state") == "on" if payload.get("led_state") is not None else bool(payload.get("led_active"))
        _handle_light(node_id, ldr_val, led_on)
        return

    status_match = _STATUS_RE.match(topic)
    if status_match:
        node_id = status_match.group("node_id")
        status = payload.get("status", "online")
        _handle_status(node_id, status)


def _mark_device_online(device: "IotDevice", db) -> None:
    """Set device status to online and update last_seen_at."""
    device.last_seen_at = datetime.now(timezone.utc)
    if device.status != "online":
        device.status = "online"


def _handle_distance(node_id: str, cm: float) -> None:
    """Persist distance log and trigger exam service logic."""
    from app.services import iot_exam_service  # avoid circular import at module load

    db = SessionLocal()
    try:
        device = _device_for_node(db, node_id)
        if device is None:
            logger.debug("MQTT distance: unknown node_id=%s – skipped", node_id)
            return

        _mark_device_online(device, db)

        now = datetime.now(timezone.utc)
        db.add(SensorLog(
            device_id=device.device_id,
            sensor_type="ultrasonic",
            distance_cm=cm,
            recorded_at=now,
        ))
        db.commit()

        sid = device.assigned_student_id
        if sid is not None:
            _send_iot_telemetry(sid, {
                "latest_distance_cm": cm,
                "latest_distance_at": now.isoformat(),
                "device_id": str(device.device_id),
                "node_status": device.status or "online",
                "last_seen_at": (
                    device.last_seen_at.isoformat()
                    if device.last_seen_at
                    else now.isoformat()
                ),
            })

        iot_exam_service.handle_distance_reading(device.device_id, cm, db)

        if sid is not None:
            _maybe_push_posture_alert(db, sid, cm)
    except Exception:
        logger.exception("Error handling MQTT distance message for node=%s", node_id)
        db.rollback()
    finally:
        db.close()


def _handle_light(node_id: str, ldr_value: float, led_on: bool) -> None:
    """Persist LDR sensor reading; no exam action needed."""
    db = SessionLocal()
    try:
        device = _device_for_node(db, node_id)
        if device is None:
            logger.debug("MQTT light: unknown node_id=%s – skipped", node_id)
            return

        _mark_device_online(device, db)

        now = datetime.now(timezone.utc)
        db.add(SensorLog(
            device_id=device.device_id,
            sensor_type="ldr",
            ldr_value=ldr_value,
            led_activated=led_on,
            recorded_at=now,
        ))
        db.commit()

        sid = device.assigned_student_id
        if sid is not None:
            _send_iot_telemetry(sid, {
                "latest_ldr_value": ldr_value,
                "latest_ldr_at": now.isoformat(),
                "latest_led_activated": bool(led_on),
                "device_id": str(device.device_id),
                "node_status": device.status or "online",
                "last_seen_at": (
                    device.last_seen_at.isoformat()
                    if device.last_seen_at
                    else now.isoformat()
                ),
            })
    except Exception:
        logger.exception("Error handling MQTT light message for node=%s", node_id)
        db.rollback()
    finally:
        db.close()


def _handle_status(node_id: str, status: str) -> None:
    """Update device online/offline status from the heartbeat topic."""
    db = SessionLocal()
    try:
        device = _device_for_node(db, node_id)
        if device is None:
            logger.debug("MQTT status: unknown node_id=%s – skipped", node_id)
            return

        now = datetime.now(timezone.utc)
        device.last_seen_at = now
        # Map firmware status strings to DB values
        device.status = "online" if status in ("online", "connected", "ready") else "offline"
        db.commit()
        logger.debug("Device %s status -> %s", node_id, device.status)

        sid = device.assigned_student_id
        if sid is not None:
            _send_iot_telemetry(sid, {
                "device_id": str(device.device_id),
                "node_status": device.status,
                "last_seen_at": (
                    device.last_seen_at.isoformat()
                    if device.last_seen_at
                    else now.isoformat()
                ),
            })
    except Exception:
        logger.exception("Error handling MQTT status message for node=%s", node_id)
        db.rollback()
    finally:
        db.close()


def start_mqtt_subscriber() -> None:
    """Create and launch the paho subscriber in a daemon thread.

    Safe to call multiple times – only one client is ever started.
    """
    global _mqtt_client
    if _mqtt_client is not None:
        return

    host, port = _read_broker_config()

    client = mqtt.Client(client_id="gyanavriksha-backend", clean_session=True)
    client.on_connect = _on_connect
    client.on_disconnect = _on_disconnect
    client.on_message = _on_message
    client.reconnect_delay_set(min_delay=2, max_delay=30)

    def _run() -> None:
        try:
            logger.info("Connecting to MQTT broker at %s:%s", host, port)
            client.connect(host, port, keepalive=60)
            client.loop_forever(retry_first_connection=True)
        except Exception:
            logger.exception("MQTT subscriber thread terminated unexpectedly")

    thread = threading.Thread(target=_run, name="mqtt-subscriber", daemon=True)
    thread.start()
    _mqtt_client = client
    logger.info("MQTT subscriber daemon thread started")


def stop_mqtt_subscriber() -> None:
    """Gracefully disconnect the paho client (called on shutdown)."""
    global _mqtt_client
    if _mqtt_client is not None:
        try:
            _mqtt_client.disconnect()
        except Exception:
            pass
        _mqtt_client = None
