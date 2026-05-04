"""Presentation layer for the RAG bounded context.

Route handlers declare HTTP contracts and immediately delegate to the
application-layer use cases. No business logic occurs here.
"""
from fastapi import APIRouter, Depends, File, Form, UploadFile, status
from sqlalchemy.orm import Session

from app.api.rag.application import service
from app.api.rag.domain.schemas import RagQueryInput, RagUploadInput
from app.core.database import get_db

router = APIRouter(prefix="/api/rag", tags=["RAG"])


@router.post("/query")
async def rag_query(
    payload: RagQueryInput,
    db: Session = Depends(get_db),
):
    """Execute a RAG knowledge-base query and return an AI-generated answer."""
    return await service.execute_rag_query(payload)


@router.post("/upload", status_code=status.HTTP_201_CREATED)
async def rag_upload(
    file: UploadFile = File(...),
    user_type: str = Form(...),
    submitted_by: str = Form(...),
    grade: int | None = Form(None),
    subject: str | None = Form(None),
    instructor_id: str | None = Form(None),
    class_id: str | None = Form(None),
    student_id: str | None = Form(None),
    db: Session = Depends(get_db),
):
    """Upload a document to the RAG vector store for indexing."""
    metadata = RagUploadInput(
        user_type=user_type,
        submitted_by=submitted_by,
        grade=grade,
        subject=subject,
        instructor_id=instructor_id,
        class_id=class_id,
        student_id=student_id,
    )
    return await service.process_rag_upload(file, metadata)
