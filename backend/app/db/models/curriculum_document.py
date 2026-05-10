import uuid
from datetime import datetime, timezone

from sqlalchemy.dialects.postgresql import UUID, BIGINT
from sqlalchemy import Column, DateTime, Enum as SAEnum, ForeignKey, Integer, String, Text

from app.db.base import Base
from app.shared.source_enum import DocumentType, EmbeddingStatus


class CurriculumDocument(Base):
    __tablename__ = "curriculum_documents"

    doc_id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, nullable=False)
    subject_id = Column(Integer, ForeignKey("subjects.subject_id"), nullable=False)
    uploaded_by = Column(UUID(as_uuid=True), ForeignKey("users.user_id"), nullable=False)
    file_name = Column(String(255), nullable=False)
    file_path = Column(Text, nullable=False)
    file_size_bytes = Column(BIGINT, nullable=True)
    doc_type = Column(SAEnum(DocumentType, name="document_type"), nullable=False)
    embedding_status = Column(
        SAEnum(EmbeddingStatus, name="embedding_status"),
        nullable=False,
        default=EmbeddingStatus.PENDING,
        server_default=EmbeddingStatus.PENDING.value,
    )
    chroma_collection_id = Column(String(100), nullable=True)
    embedded_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(
        DateTime(timezone=True),
        nullable=False,
        default=lambda: datetime.now(timezone.utc),
        server_default="now()",
    )
