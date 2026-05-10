"""WebSocket channel for student performance: auth + periodic refresh hints.

Clients pass the same JWT access token as a query parameter (browsers do not
send custom headers on WebSocket handshakes). The server pushes ``ping`` /
``refresh_performance`` messages so the UI can refetch when scores or gaps
change (e.g. after new grading) without manual polling.
"""
import asyncio
import logging
import uuid

from fastapi import APIRouter, WebSocket, WebSocketDisconnect, status
from sqlalchemy.orm import Session

from app.core.database import SessionLocal
from app.core.security import decode_token
from app.db.models.user import User
from app.shared.source_enum import UserRole

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/students", tags=["student-websocket"])


@router.websocket("/ws/performance")
async def performance_live(websocket: WebSocket, token: str | None = None) -> None:
    """Authenticated student-only socket; emits periodic refresh hints."""
    if not token:
        await websocket.close(code=status.WS_1008_POLICY_VIOLATION)
        return

    payload = decode_token(token)
    if not payload or payload.get("type") != "access":
        await websocket.close(code=status.WS_1008_POLICY_VIOLATION)
        return

    raw_sub = payload.get("sub")
    if not raw_sub:
        await websocket.close(code=status.WS_1008_POLICY_VIOLATION)
        return

    try:
        uid = uuid.UUID(str(raw_sub))
    except (ValueError, TypeError):
        await websocket.close(code=status.WS_1008_POLICY_VIOLATION)
        return

    db: Session = SessionLocal()
    try:
        user = db.query(User).filter(User.user_id == uid).first()
        if not user or not user.is_active:
            await websocket.close(code=status.WS_1008_POLICY_VIOLATION)
            return
        if user.role != UserRole.STUDENT:
            await websocket.close(code=status.WS_1008_POLICY_VIOLATION)
            return
        token_tv = payload.get("tv", 0)
        if token_tv != (user.token_version or 0):
            await websocket.close(code=status.WS_1008_POLICY_VIOLATION)
            return
    finally:
        db.close()

    await websocket.accept()
    await websocket.send_json({"type": "connected", "channel": "performance"})

    async def periodic_refresh() -> None:
        try:
            while True:
                await asyncio.sleep(45)
                await websocket.send_json({"type": "refresh_performance"})
        except Exception:
            logger.debug("performance_live periodic task ended", exc_info=True)

    refresh_task = asyncio.create_task(periodic_refresh())
    try:
        while True:
            msg = await websocket.receive_text()
            if msg.strip().lower() == "ping":
                await websocket.send_json({"type": "pong"})
    except WebSocketDisconnect:
        logger.debug("performance_live client disconnected")
    finally:
        refresh_task.cancel()
        try:
            await refresh_task
        except asyncio.CancelledError:
            pass
