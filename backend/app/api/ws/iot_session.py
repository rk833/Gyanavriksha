"""WebSocket manager for per-student IoT event push.

Mirrors the structure of ``student_performance.py`` but serves real-time
IoT events (auto_pause, auto_forfeit) to the student browser during an
active exam session.

The MQTT / exam service calls ``manager.send_to_student(student_id, payload)``
from a sync thread; we schedule the coroutine on the event loop that runs the
ASGI server.
"""
from __future__ import annotations

import asyncio
import logging
import uuid
from typing import Any

from fastapi import APIRouter, WebSocket, WebSocketDisconnect, status

from app.core.database import SessionLocal
from app.core.security import decode_token
from app.db.models.user import User
from app.shared.source_enum import UserRole

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/students", tags=["student-websocket"])


class _IotSessionManager:
    """In-process registry of active IoT WebSocket connections keyed by student_id."""

    def __init__(self) -> None:
        self._sockets: dict[uuid.UUID, list[WebSocket]] = {}
        self._loop: asyncio.AbstractEventLoop | None = None

    def set_loop(self, loop: asyncio.AbstractEventLoop) -> None:
        self._loop = loop

    def connect(self, student_id: uuid.UUID, ws: WebSocket) -> None:
        self._sockets.setdefault(student_id, []).append(ws)

    def disconnect(self, student_id: uuid.UUID, ws: WebSocket) -> None:
        lst = self._sockets.get(student_id, [])
        if ws in lst:
            lst.remove(ws)
        if not lst:
            self._sockets.pop(student_id, None)

    async def send_to_student(self, student_id: uuid.UUID, payload: dict[str, Any]) -> None:
        """Send a JSON payload to all open sockets for this student."""
        sockets = list(self._sockets.get(student_id, []))
        dead: list[WebSocket] = []
        for ws in sockets:
            try:
                await ws.send_json(payload)
            except Exception:
                dead.append(ws)
        for ws in dead:
            self.disconnect(student_id, ws)

    def send_to_student_sync(self, student_id: uuid.UUID, payload: dict[str, Any]) -> None:
        """Thread-safe wrapper — schedules ``send_to_student`` on the ASGI event loop."""
        loop = self._loop
        if loop is None or loop.is_closed():
            logger.debug("IoT WS: no event loop available to push to student %s", student_id)
            return
        try:
            asyncio.run_coroutine_threadsafe(
                self.send_to_student(student_id, payload),
                loop,
            )
        except Exception:
            logger.exception("IoT WS: failed to schedule push to student %s", student_id)


manager = _IotSessionManager()


@router.websocket("/ws/iot-session")
async def iot_session_ws(websocket: WebSocket, token: str | None = None) -> None:
    """Authenticated student-only socket; relays IoT exam events in real time."""
    if not token:
        await websocket.close(code=status.WS_1008_POLICY_VIOLATION)
        return

    payload = decode_token(token)
    if not payload or payload.get("type") != "access":
        await websocket.close(code=status.WS_1008_POLICY_VIOLATION)
        return

    raw_sub = payload.get("sub")
    try:
        uid = uuid.UUID(str(raw_sub))
    except (ValueError, TypeError):
        await websocket.close(code=status.WS_1008_POLICY_VIOLATION)
        return

    db = SessionLocal()
    try:
        user = db.query(User).filter(User.user_id == uid).first()
        if not user or not user.is_active or user.role != UserRole.STUDENT:
            await websocket.close(code=status.WS_1008_POLICY_VIOLATION)
            return
        token_tv = payload.get("tv", 0)
        if token_tv != (user.token_version or 0):
            await websocket.close(code=status.WS_1008_POLICY_VIOLATION)
            return
    finally:
        db.close()

    # Capture the running event loop so sync callers can schedule onto it
    manager.set_loop(asyncio.get_event_loop())

    await websocket.accept()
    manager.connect(uid, websocket)
    await websocket.send_json({"type": "connected", "channel": "iot_session"})

    try:
        while True:
            msg = await websocket.receive_text()
            if msg.strip().lower() == "ping":
                await websocket.send_json({"type": "pong"})
    except WebSocketDisconnect:
        logger.debug("iot_session_ws: student %s disconnected", uid)
    finally:
        manager.disconnect(uid, websocket)
