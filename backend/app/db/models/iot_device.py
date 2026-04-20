import uuid
from datetime import datetime

from sqlalchemy.dialects.postgresql import UUID, INET, MACADDR
from sqlalchemy import Boolean, Column, DateTime, ForeignKey, String, Text

from app.db.base import Base


class IotDevice(Base):
    __tablename__ = "iot_devices"

    device_id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, nullable=False)
    assigned_student_id = Column(UUID(as_uuid=True), ForeignKey("users.user_id"), nullable=True)
    device_mac = Column(MACADDR, unique=True, nullable=False)
    device_label = Column(String(100), nullable=True)
    api_key_hash = Column(String(255), unique=True, nullable=False)
    mqtt_topic_prefix = Column(String(150), unique=True, nullable=False)
    firmware_version = Column(String(20), nullable=True)
    is_active = Column(Boolean, nullable=False, default=True, server_default="true")
    last_seen_at = Column(DateTime(timezone=True), nullable=True)
    last_ip_address = Column(INET, nullable=True)
    registered_by = Column(UUID(as_uuid=True), ForeignKey("users.user_id"), nullable=False)
    registered_at = Column(
        DateTime(timezone=True),
        nullable=False,
        default=datetime.utcnow,
        server_default="now()",
    )
    node_id = Column(String(100), unique=True, nullable=True)
    device_type = Column(String(50), nullable=True)
    location = Column(String(150), nullable=True)
    status = Column(String(30), nullable=False, default="offline", server_default="offline")
    description = Column(Text, nullable=True)
