"""Curriculum ingestion service.

Sends a saved curriculum file to the AI service RAG pipeline and updates the
CurriculumDocument embedding status in the database.

This module is intended to be called as a FastAPI BackgroundTask — the HTTP
response is already sent before this work begins.
"""
import logging
import mimetypes
import uuid
from datetime import datetime, timezone

from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.database import SessionLocal
from app.db.models.curriculum_document import CurriculumDocument
from app.db.models.grade import Grade
from app.db.models.subject import Subject
from app.services import admin_service
from app.services import rag_service
from app.shared.source_enum import NotificationType
from app.shared.source_enum import EmbeddingStatus

logger = logging.getLogger(__name__)

# Map file extensions to user_type passed to the RAG service
_CONTENT_TYPE_FALLBACK = "application/octet-stream"


def _get_doc(db: Session, doc_id: uuid.UUID) -> CurriculumDocument | None:
    """Return a fresh CurriculumDocument row or None."""
    return db.query(CurriculumDocument).filter(CurriculumDocument.doc_id == doc_id).first()


def _mark_processing(db: Session, doc: CurriculumDocument) -> None:
    """Set embedding_status to PROCESSING and commit."""
    doc.embedding_status = EmbeddingStatus.PROCESSING
    admin_service.notify_admins(
        db,
        NotificationType.HEATMAP_UPDATED,
        "Curriculum ingestion started",
        f"{doc.file_name} is now processing for vector embedding.",
        str(doc.doc_id),
    )
    db.commit()


def _mark_done(db: Session, doc: CurriculumDocument, collection_name: str) -> None:
    """Set embedding_status to DONE, stamp embedded_at, and commit."""
    doc.embedding_status = EmbeddingStatus.DONE
    doc.embedded_at = datetime.now(timezone.utc)
    doc.chroma_collection_id = collection_name
    admin_service.notify_admins(
        db,
        NotificationType.HEATMAP_UPDATED,
        "Curriculum ingestion completed",
        f"{doc.file_name} finished embedding successfully.",
        str(doc.doc_id),
    )
    db.commit()


def _mark_failed(db: Session, doc: CurriculumDocument, reason: str) -> None:
    """Set embedding_status to FAILED and commit."""
    doc.embedding_status = EmbeddingStatus.FAILED
    admin_service.notify_admins(
        db,
        NotificationType.AT_RISK_FLAG,
        "Curriculum ingestion failed",
        f"{doc.file_name} failed to embed: {reason[:180]}",
        str(doc.doc_id),
    )
    db.commit()
    logger.error("Curriculum ingestion failed for doc %s: %s", doc.doc_id, reason)


async def _send_to_rag(doc: CurriculumDocument, db: Session, chunk_size: int | None = None) -> None:
    """Read the saved file and forward it to the AI RAG upload endpoint."""
    import io
    with open(doc.file_path, "rb") as fh:
        file_bytes = fh.read()
    content_type, _ = mimetypes.guess_type(doc.file_path)
    content_type = content_type or _CONTENT_TYPE_FALLBACK
    from fastapi import UploadFile
    from starlette.datastructures import UploadFile as StarletteUploadFile
    upload = UploadFile(
        filename=doc.file_path.split("/")[-1].split("\\")[-1],
        file=io.BytesIO(file_bytes),
        headers={"content-type": content_type},
    )
    subject = db.query(Subject).filter(Subject.subject_id == doc.subject_id).first()
    grade_level = None
    if subject:
        grade = db.query(Grade).filter(Grade.grade_id == subject.grade_id).first()
        grade_level = grade.grade_level if grade else None
    subject_name = subject.subject_name if subject else None

    result = await rag_service.upload_document_to_rag(
        file=upload,
        user_type="admin",
        submitted_by=str(doc.uploaded_by),
        grade=grade_level,
        subject=subject_name,
        chunk_size=chunk_size,
    )
    collection = result.get("collection", "")
    _mark_done(db, doc, collection)
    logger.info(
        "Curriculum doc %s indexed: %s chunk(s) in collection '%s'",
        doc.doc_id,
        result.get("chunks_added", "?"),
        collection,
    )


async def ingest_curriculum_document(doc_id: uuid.UUID, chunk_size: int | None = None) -> None:
    """Background task: send a PENDING curriculum document to the RAG pipeline.

    Opens its own DB session so it runs safely outside the request session.
    Sets status → PROCESSING before sending, then DONE or FAILED on result.
    """
    db: Session = SessionLocal()
    try:
        doc = _get_doc(db, doc_id)
        if not doc:
            logger.warning("Curriculum doc %s not found — skipping ingestion.", doc_id)
            return
        if doc.embedding_status == EmbeddingStatus.PROCESSING:
            logger.warning("Curriculum doc %s is already PROCESSING — skipping.", doc_id)
            return
        _mark_processing(db, doc)
        await _send_to_rag(doc, db, chunk_size)
    except FileNotFoundError as exc:
        doc = _get_doc(db, doc_id)
        if doc:
            _mark_failed(db, doc, str(exc))
    except Exception as exc:
        doc = _get_doc(db, doc_id)
        if doc:
            _mark_failed(db, doc, str(exc))
        logger.exception("Unexpected error ingesting curriculum doc %s", doc_id)
    finally:
        db.close()
