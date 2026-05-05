"""IoT exam service: auto-pause / forfeit based on ultrasonic \"away\" readings.

Called by the MQTT subscriber thread each time a distance reading arrives.
Uses an in-memory per-device consecutive-far counter (thread-safe via a Lock)
to implement the "3 consecutive far readings = pause / forfeit" rule.

Too-close (near) posture notifications are intentionally not emitted —
only desk-absence flows surface to students and instructors.
"""
from __future__ import annotations

import logging
import threading
import uuid
from datetime import datetime, timezone
from typing import Any

from sqlalchemy.orm import Session

from app.db.models.assignment import Assignment
from app.db.models.exam_session import ExamSession
from app.db.models.iot_device import IotDevice
from app.db.models.notification import Notification
from app.db.models.user import User
from app.shared.source_enum import (
    ExamSessionStatus,
    NotificationChannel,
    NotificationType,
)

logger = logging.getLogger(__name__)

# ──────────────────────────────────────────────────────────────────────────────
# Per-device state (in-memory; survives process lifetime)
# ──────────────────────────────────────────────────────────────────────────────
_lock = threading.Lock()
_far_counters: dict[uuid.UUID, int] = {}  # device_id → consecutive far count
_pause_timestamps: dict[uuid.UUID, datetime] = {}  # device_id → last pause start

_TOO_FAR_CM = 80.0
_TOO_CLOSE_CM = 30.0  # resets far counter only; does not emit near-posture alerts
_CONSECUTIVE_FAR_THRESHOLD = 3


def _reset_far_counter(device_id: uuid.UUID) -> None:
    with _lock:
        _far_counters[device_id] = 0


def _increment_far_counter(device_id: uuid.UUID) -> int:
    with _lock:
        count = _far_counters.get(device_id, 0) + 1
        _far_counters[device_id] = count
        return count


def handle_distance_reading(device_id: uuid.UUID, cm: float, db: Session) -> None:
    """Process a single distance sensor reading for a device.

    - If cm > TOO_FAR for 3 consecutive reads → pause or forfeit active exam.
    - Near readings (below TOO_CLOSE) reset the far counter without alerts.
    - Otherwise reset the far counter when in normal range.
    """
    if cm < 0:
        return  # invalid reading

    if cm < _TOO_CLOSE_CM:
        _reset_far_counter(device_id)
        return

    if cm <= _TOO_FAR_CM:
        _reset_far_counter(device_id)
        return

    consecutive = _increment_far_counter(device_id)
    if consecutive < _CONSECUTIVE_FAR_THRESHOLD:
        return

    _reset_far_counter(device_id)
    _handle_absence(device_id, db)


def _student_display_name(db: Session, student_id: uuid.UUID) -> str:
    u = db.query(User).filter(User.user_id == student_id).first()
    return (u.full_name or "Student") if u else "Student"


def _notify_instructor_desk_absence(
    db: Session,
    instructor_id: uuid.UUID | None,
    student_id: uuid.UUID,
    title: str,
    body: str,
) -> None:
    if instructor_id is None:
        return
    now = datetime.now(timezone.utc)
    db.add(
        Notification(
            recipient_id=instructor_id,
            type=NotificationType.IOT_DESK_ABSENCE,
            title=title,
            body=body,
            channel=NotificationChannel.IN_APP,
            is_read=False,
            related_resource_id=str(student_id),
            sent_at=now,
        )
    )
    db.commit()


def _handle_absence(device_id: uuid.UUID, db: Session) -> None:
    """Pause or forfeit the active exam session linked to this device."""
    session = (
        db.query(ExamSession)
        .filter(
            ExamSession.device_id == device_id,
            ExamSession.status == ExamSessionStatus.ACTIVE.value,
            ExamSession.ended_at.is_(None),
        )
        .order_by(ExamSession.started_at.desc())
        .first()
    )

    # Sessions created before desk binding omitted device_id — match ACTIVE exam by desk owner.
    if not session:
        device_row = db.query(IotDevice).filter(IotDevice.device_id == device_id).first()
        owner_id = device_row.assigned_student_id if device_row else None
        if owner_id:
            session = (
                db.query(ExamSession)
                .filter(
                    ExamSession.student_id == owner_id,
                    ExamSession.status == ExamSessionStatus.ACTIVE.value,
                    ExamSession.ended_at.is_(None),
                )
                .order_by(ExamSession.started_at.desc())
                .first()
            )
        if session and session.device_id is None:
            session.device_id = device_id

    if not session:
        logger.debug("IoT absence: no active session for device %s", device_id)
        return

    assignment = (
        db.query(Assignment)
        .filter(Assignment.assignment_id == session.assignment_id)
        .first()
    )
    max_pauses: int | None = assignment.exam_max_pauses if assignment else None
    now = datetime.now(timezone.utc)
    stu_name = _student_display_name(db, session.student_id)
    instructor_id = assignment.instructor_id if assignment else None

    if max_pauses is not None and session.pause_count >= max_pauses:
        # ── Forfeit ───────────────────────────────────────────────────────────
        session.status = ExamSessionStatus.TERMINATED.value
        session.ended_at = now
        session.ended_reason = (
            "All pauses for this assignment were already used up; the desk stayed "
            "unoccupied again so this exam attempt had to stop."
        )
        db.add(session)
        db.commit()
        logger.info(
            "IoT: exam session %s FORFEITED (pauses exhausted: %s/%s)",
            session.session_id,
            session.pause_count,
            max_pauses,
        )
        _push_ws_event(
            session.student_id,
            {
                "type": "auto_forfeit",
                "session_id": str(session.session_id),
                "message": "Exam forfeited: you left your desk too many times.",
            },
        )
        _notify_instructor_desk_absence(
            db,
            instructor_id,
            session.student_id,
            "Desk absence — exam attempt ended",
            f"{stu_name} was away again with no pauses left, so their attempt stopped.",
        )
    else:
        # ── Auto-pause ────────────────────────────────────────────────────────
        session.status = ExamSessionStatus.PAUSED.value
        session.pause_count = (session.pause_count or 0) + 1
        session.absence_alert_count = (session.absence_alert_count or 0) + 1
        _pause_timestamps[device_id] = now
        db.add(session)
        db.commit()
        pauses_max = max_pauses if max_pauses is not None else "∞"
        logger.info(
            "IoT: exam session %s AUTO-PAUSED (%s/%s pauses used)",
            session.session_id,
            session.pause_count,
            pauses_max,
        )
        _push_ws_event(
            session.student_id,
            {
                "type": "auto_pause",
                "session_id": str(session.session_id),
                "pauses_used": session.pause_count,
                "pauses_max": max_pauses,
                "message": "You moved away from your desk — exam auto-paused.",
            },
        )
        cap_msg = (
            str(max_pauses)
            if max_pauses is not None
            else "no pause cap configured"
        )
        _notify_instructor_desk_absence(
            db,
            instructor_id,
            session.student_id,
            "Desk absence — exam paused",
            f"{stu_name} left the workstation; auto-pause {session.pause_count} "
            f"({cap_msg}).",
        )


def handle_resume(session_id: uuid.UUID, student_id: uuid.UUID, db: Session) -> dict[str, Any]:
    """Resume a paused exam session (student pressed Resume after IoT auto-pause)."""
    session = (
        db.query(ExamSession)
        .filter(
            ExamSession.session_id == session_id,
            ExamSession.student_id == student_id,
        )
        .first()
    )
    if not session:
        from fastapi import HTTPException, status as http_status

        raise HTTPException(
            status_code=http_status.HTTP_404_NOT_FOUND,
            detail="Exam session not found",
        )
    if session.status != ExamSessionStatus.PAUSED.value:
        from fastapi import HTTPException, status as http_status

        raise HTTPException(
            status_code=http_status.HTTP_400_BAD_REQUEST,
            detail=f"Session is not paused (current status: {session.status})",
        )

    now = datetime.now(timezone.utc)

    # Accumulate paused seconds
    pause_start = _pause_timestamps.pop(session.device_id, None) if session.device_id else None
    if pause_start:
        elapsed = int((now - pause_start).total_seconds())
        session.total_paused_seconds = (session.total_paused_seconds or 0) + max(0, elapsed)

    session.status = ExamSessionStatus.ACTIVE.value
    db.add(session)
    db.commit()
    db.refresh(session)

    assignment = (
        db.query(Assignment)
        .filter(Assignment.assignment_id == session.assignment_id)
        .first()
    )
    return {
        "session_id": session.session_id,
        "assignment_id": session.assignment_id,
        "started_at": session.started_at,
        "ended_at": session.ended_at,
        "status": session.status,
        "exam_duration_minutes": assignment.exam_duration_minutes if assignment else None,
        "exam_duration_seconds": int(assignment.exam_duration_minutes * 60)
        if assignment and assignment.exam_duration_minutes
        else None,
        "pause_count": session.pause_count,
        "total_paused_seconds": session.total_paused_seconds,
    }


def _push_ws_event(student_id: uuid.UUID, payload: dict[str, Any]) -> None:
    """Fire-and-forget: push event to open IoT WebSocket for this student."""
    try:
        from app.api.ws.iot_session import manager

        manager.send_to_student_sync(student_id, payload)
    except Exception:
        logger.debug("IoT WS push failed for student %s", student_id, exc_info=True)
