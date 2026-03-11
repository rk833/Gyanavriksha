from datetime import datetime

from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy import BigInteger, Boolean, Column, DateTime, Enum as SAEnum, Float, ForeignKey, String

from app.db.base import Base
from app.shared.source_enum import AlertTriggered


class SensorLog(Base):
    __tablename__ = "sensor_logs"

    log_id = Column(BigInteger, primary_key=True, autoincrement=True)
    device_id = Column(UUID(as_uuid=True), ForeignKey("iot_devices.device_id"), nullable=False)
    student_id = Column(UUID(as_uuid=True), ForeignKey("users.user_id"), nullable=True)
    sensor_type = Column(String(20), nullable=False)
    ldr_value = Column(Float, nullable=True)
    distance_cm = Column(Float, nullable=True)
    led_activated = Column(Boolean, nullable=True)
    alert_triggered = Column(SAEnum(AlertTriggered, name="alert_triggered"), nullable=True)
    recorded_at = Column(
        DateTime(timezone=True),
        nullable=False,
        default=datetime.utcnow,
        server_default="now()",
    )
