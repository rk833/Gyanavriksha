import uuid
from datetime import datetime

from sqlalchemy.dialects.postgresql import UUID, ARRAY
from sqlalchemy import Boolean, Column, DateTime, Float, ForeignKey, String, Text

from app.db.base import Base


class OcrLog(Base):
    __tablename__ = "ocr_logs"

    ocr_log_id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, nullable=False)
    submission_id = Column(UUID(as_uuid=True), ForeignKey("submissions.submission_id"), nullable=False)
    engine_used = Column(String(50), nullable=False)
    raw_extracted_text = Column(Text, nullable=False)
    confidence_score = Column(Float, nullable=True)
    preprocessing_steps = Column(ARRAY(String), nullable=True)
    used_fallback = Column(Boolean, nullable=False, default=False, server_default="false")
    error_message = Column(Text, nullable=True)
    created_at = Column(
        DateTime(timezone=True),
        nullable=False,
        default=datetime.utcnow,
        server_default="now()",
    )
