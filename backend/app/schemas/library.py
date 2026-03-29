import uuid
from datetime import datetime

from pydantic import BaseModel

from app.shared.source_enum import DocumentType, EmbeddingStatus


class CurriculumDocumentResponse(BaseModel):
    doc_id: uuid.UUID
    file_name: str
    file_path: str
    file_size_bytes: int | None = None
    doc_type: DocumentType
    embedding_status: EmbeddingStatus
    subject_id: int
    subject_name: str | None = None
    grade_name: str | None = None
    uploaded_by_name: str | None = None
    created_at: datetime

    model_config = {"from_attributes": True}
