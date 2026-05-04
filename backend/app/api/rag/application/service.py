"""Application-layer use cases for the RAG bounded context.

Each function orchestrates one RAG operation: delegates to the service layer,
maps errors to HTTPExceptions, and keeps the presentation layer free of logic.
"""
from typing import Any

from fastapi import HTTPException, UploadFile, status
from sqlalchemy.orm import Session

from app.api.rag.domain.schemas import RagQueryInput, RagUploadInput
from app.services import rag_service

_ALLOWED_UPLOAD_TYPES = frozenset({
    "application/pdf",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "text/plain",
    "image/jpeg",
    "image/png",
})


def _validate_upload_type(content_type: str | None) -> None:
    """Raise 422 when the uploaded file MIME type is not supported."""
    if content_type not in _ALLOWED_UPLOAD_TYPES:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=(
                f"Unsupported file type '{content_type}'. "
                "Allowed: PDF, DOCX, TXT, JPEG, PNG."
            ),
        )


async def execute_rag_query(payload: RagQueryInput) -> dict[str, Any]:
    """Execute a RAG question-answer request and return the AI response."""
    return await rag_service.query_rag(
        user_type=payload.user_type,
        query=payload.query,
        grade=payload.grade,
        instructor_id=payload.instructor_id,
        class_id=payload.class_id,
        student_id=payload.student_id,
    )


async def process_rag_upload(file: UploadFile, metadata: RagUploadInput) -> dict[str, Any]:
    """Validate and relay a document upload to the RAG vector store."""
    _validate_upload_type(file.content_type)
    return await rag_service.upload_document_to_rag(
        file=file,
        user_type=metadata.user_type,
        submitted_by=metadata.submitted_by,
        grade=metadata.grade,
        subject=metadata.subject,
        instructor_id=metadata.instructor_id,
        class_id=metadata.class_id,
        student_id=metadata.student_id,
    )
