"""RAG relay service.

Forwards backend RAG requests to the AI microservice and surfaces errors as
FastAPI HTTPExceptions so callers receive consistent error responses.
"""
import logging
from typing import Any

import httpx
from fastapi import HTTPException, UploadFile, status

from app.core.config import settings
from app.core.ai_client import ai_post

logger = logging.getLogger(__name__)


def _build_query_payload(
    user_type: str,
    query: str,
    grade: int | None,
    subject: str | None,
    instructor_id: str | None,
    class_id: str | None,
    student_id: str | None,
) -> dict[str, Any]:
    """Assemble the JSON payload for the AI service /rag/query endpoint."""
    payload: dict[str, Any] = {"user_type": user_type, "query": query}
    if grade is not None:
        payload["grade"] = grade
    if subject:
        payload["subject"] = subject
    if instructor_id:
        payload["instructor_id"] = instructor_id
    if class_id:
        payload["class_id"] = class_id
    if student_id:
        payload["student_id"] = student_id
    return payload


def _build_upload_form(
    user_type: str,
    submitted_by: str,
    grade: int | None,
    subject: str | None,
    instructor_id: str | None,
    class_id: str | None,
    student_id: str | None,
    chunk_size: int | None = None,
) -> dict[str, str]:
    """Assemble the multipart form fields for the AI service /rag/upload endpoint."""
    form: dict[str, str] = {"user_type": user_type, "submitted_by": submitted_by}
    if grade is not None:
        form["grade"] = str(grade)
    if subject:
        form["subject"] = subject
    if instructor_id:
        form["instructor_id"] = instructor_id
    if class_id:
        form["class_id"] = class_id
    if student_id:
        form["student_id"] = student_id
    if chunk_size is not None:
        form["chunk_size"] = str(chunk_size)
    return form


def _map_upload_error(response: httpx.Response) -> None:
    """Raise an appropriate HTTPException for a non-success upload response."""
    if response.status_code == status.HTTP_422_UNPROCESSABLE_ENTITY:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Invalid upload request to AI service: {response.text}",
        )
    logger.error("AI service upload failed (%s): %s", response.status_code, response.text)
    raise HTTPException(
        status_code=status.HTTP_502_BAD_GATEWAY,
        detail="AI service failed to process the uploaded document.",
    )


async def query_rag(
    user_type: str,
    query: str,
    *,
    grade: int | None = None,
    subject: str | None = None,
    instructor_id: str | None = None,
    class_id: str | None = None,
    student_id: str | None = None,
) -> dict[str, Any]:
    """Forward a RAG query to the AI service and return the answer with sources."""
    payload = _build_query_payload(user_type, query, grade, subject, instructor_id, class_id, student_id)
    return await ai_post("/rag/query", payload)


async def upload_document_to_rag(
    file: UploadFile,
    user_type: str,
    submitted_by: str,
    *,
    grade: int | None = None,
    subject: str | None = None,
    instructor_id: str | None = None,
    class_id: str | None = None,
    student_id: str | None = None,
    chunk_size: int | None = None,
) -> dict[str, Any]:
    """Relay a document upload to the AI service RAG vector store."""
    form_data = _build_upload_form(
        user_type,
        submitted_by,
        grade,
        subject,
        instructor_id,
        class_id,
        student_id,
        chunk_size,
    )
    file_bytes = await file.read()
    url = f"{settings.AI_SERVICE_URL}/rag/upload"
    try:
        async with httpx.AsyncClient(timeout=settings.AI_SERVICE_LONG_TIMEOUT) as client:
            response = await client.post(
                url,
                data=form_data,
                files={"file": (file.filename, file_bytes, file.content_type)},
            )
        if not response.is_success:
            _map_upload_error(response)
        return response.json()
    except httpx.TimeoutException as exc:
        raise HTTPException(
            status_code=status.HTTP_504_GATEWAY_TIMEOUT,
            detail="AI service timed out while processing the document.",
        ) from exc
    except httpx.ConnectError as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="AI service is unavailable. Please try again later.",
        ) from exc


async def upload_document_bytes_to_rag(
    *,
    file_name: str,
    file_bytes: bytes,
    content_type: str | None,
    user_type: str,
    submitted_by: str,
    grade: int | None = None,
    subject: str | None = None,
    instructor_id: str | None = None,
    class_id: str | None = None,
    student_id: str | None = None,
    chunk_size: int | None = None,
) -> dict[str, Any]:
    """Relay in-memory file bytes to AI service /rag/upload for indexing."""
    form_data = _build_upload_form(
        user_type,
        submitted_by,
        grade,
        subject,
        instructor_id,
        class_id,
        student_id,
        chunk_size,
    )
    url = f"{settings.AI_SERVICE_URL}/rag/upload"
    try:
        async with httpx.AsyncClient(timeout=settings.AI_SERVICE_LONG_TIMEOUT) as client:
            response = await client.post(
                url,
                data=form_data,
                files={"file": (file_name, file_bytes, content_type or "application/pdf")},
            )
        if not response.is_success:
            _map_upload_error(response)
        return response.json()
    except httpx.TimeoutException as exc:
        raise HTTPException(
            status_code=status.HTTP_504_GATEWAY_TIMEOUT,
            detail="AI service timed out while processing the document.",
        ) from exc
    except httpx.ConnectError as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="AI service is unavailable. Please try again later.",
        ) from exc
