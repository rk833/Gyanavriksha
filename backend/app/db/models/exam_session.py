import uuid
from datetime import datetime

from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy import Column, DateTime, ForeignKey, Integer, SmallInteger, String, Text

from app.db.base import Base


class ExamSession(Base):
    __tablename__ = "exam_sessions"

    session_id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, nullable=False)
    student_id = Column(UUID(as_uuid=True), ForeignKey("users.user_id"), nullable=False)
    assignment_id = Column(UUID(as_uuid=True), ForeignKey("assignments.assignment_id"), nullable=False)
    device_id = Column(UUID(as_uuid=True), ForeignKey("iot_devices.device_id"), nullable=True)
    started_at = Column(DateTime(timezone=True), nullable=False)
    ended_at = Column(DateTime(timezone=True), nullable=True)
    status = Column(String(20), nullable=False, default="active", server_default="active")
    pause_count = Column(SmallInteger, nullable=False, default=0, server_default="0")
    total_paused_seconds = Column(Integer, nullable=False, default=0, server_default="0")
    absence_alert_count = Column(SmallInteger, nullable=False, default=0, server_default="0")
    ended_reason = Column(Text, nullable=True)
