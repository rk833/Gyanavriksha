import uuid
from datetime import datetime

from sqlalchemy import (
    Boolean,
    Column,
    DateTime,
    Enum as SAEnum,
    ForeignKey,
    String,
    Text,
)
from sqlalchemy.dialects.postgresql import UUID, BIGINT, ARRAY

from app.db.base import Base
from app.shared.source_enum import DocumentType, EmbeddingStatus


class CurriculumDocument(Base):
    __tablename__ = "curriculum_documents"

    doc_id = Column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, nullable=False
    )
    subject_id = Column(
        Integer,
        ForeignKey("subjects.subject_id"),
        nullable=False,
    )
    uploaded_by = Column(
        UUID(as_uuid=True),
        ForeignKey("users.user_id"),
        nullable=False,
    )
    file_name = Column(String(255), nullable=False)
    file_path = Column(Text, nullable=False)
    file_size_bytes = Column(BIGINT, nullable=True)
    doc_type = Column(
        SAEnum(DocumentType, name="document_type"),
        nullable=False,
    )
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
        default=datetime.utcnow,
        server_default="now()",
    )


class Assignment(Base):
    __tablename__ = "assignments"

    assignment_id = Column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, nullable=False
    )
    subject_id = Column(
        Integer,
        ForeignKey("subjects.subject_id"),
        nullable=False,
    )
    instructor_id = Column(
        UUID(as_uuid=True),
        ForeignKey("users.user_id"),
        nullable=False,
    )
    title = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    topic_tags = Column(ARRAY(String), nullable=True)
    is_exam_mode = Column(
        Boolean,
        nullable=False,
        default=False,
        server_default="false",
    )
    due_date = Column(DateTime(timezone=True), nullable=True)
    is_published = Column(
        Boolean,
        nullable=False,
        default=False,
        server_default="false",
    )
    created_at = Column(
        DateTime(timezone=True),
        nullable=False,
        default=datetime.utcnow,
        server_default="now()",
    )


class StudentPersonalNote(Base):
    __tablename__ = "student_personal_notes"

    note_id = Column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, nullable=False
    )
    student_id = Column(
        UUID(as_uuid=True),
        ForeignKey("users.user_id"),
        nullable=False,
    )
    subject_id = Column(
        Integer,
        ForeignKey("subjects.subject_id"),
        nullable=False,
    )
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

