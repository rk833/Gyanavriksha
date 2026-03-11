import uuid
from datetime import datetime

from sqlalchemy.dialects.postgresql import UUID, BIGINT
from sqlalchemy import Column, DateTime, Enum as SAEnum, ForeignKey, Integer, String, Text

from app.db.base import Base
from app.shared.source_enum import EmbeddingStatus


class StudentPersonalNote(Base):
    __tablename__ = "student_personal_notes"

    note_id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, nullable=False)
    student_id = Column(UUID(as_uuid=True), ForeignKey("users.user_id"), nullable=False)
    subject_id = Column(Integer, ForeignKey("subjects.subject_id"), nullable=False)
    file_name = Column(String(255), nullable=False)
    file_path = Column(Text, nullable=False)
    file_size_bytes = Column(BIGINT, nullable=True)
    chroma_collection_id = Column(String(100), nullable=True)
    embedding_status = Column(
        SAEnum(EmbeddingStatus, name="student_note_embedding_status"),
        nullable=False,
        default=EmbeddingStatus.PENDING,
        server_default=EmbeddingStatus.PENDING.value,
    )
    embedded_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(
        DateTime(timezone=True),
        nullable=False,
        default=datetime.utcnow,
        server_default="now()",
    )
