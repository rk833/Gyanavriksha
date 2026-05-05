"""Heatmap processing service.

Fetches a chat history record, calls the AI service to generate a concept
summary, persists the summary, and upserts ConceptHeatmapEntry rows.
"""
import uuid
from datetime import datetime
from typing import Any

from sqlalchemy.orm import Session

from app.core.ai_client import ai_post
from app.services import chat_log_io
from app.db.models.chat_history import ChatHistory
from app.db.models.concept_heatmap_entry import ConceptHeatmapEntry
from app.db.models.subject import Subject
from app.db.models.user import User


# Private helpers

def _read_chat_log(file_path: str) -> str:
    """Read chat log as plain text (JSON transcripts are converted)."""
    return chat_log_io.read_as_plain_text(file_path)


def _get_subject_name(db: Session, subject_id: int) -> str:
    """Return the subject name for the given subject ID, or 'Unknown'."""
    subject = db.query(Subject).filter(Subject.subject_id == subject_id).first()
    return subject.subject_name if subject else "Unknown"


def _get_grade_id(db: Session, student_id: uuid.UUID) -> int:
    """Return the grade ID for the given student, defaulting to 1."""
    student = db.query(User).filter(User.user_id == student_id).first()
    return student.grade_id if student else 1


def _upsert_heatmap_entry(
    db: Session,
    student_id: uuid.UUID,
    subject_id: int,
    grade_id: int,
    concept: dict[str, Any],
) -> None:
    """Insert or update one ConceptHeatmapEntry row for the given concept."""
    topic_tag = concept["topic_tag"]
    proficiency = concept["proficiency"]
    entry = db.query(ConceptHeatmapEntry).filter(
        ConceptHeatmapEntry.student_id == student_id,
        ConceptHeatmapEntry.subject_id == subject_id,
        ConceptHeatmapEntry.topic_tag == topic_tag,
    ).first()
    if entry:
        new_count = entry.occurrence_count + 1
        prev_score = entry.proficiency_score or 0.0
        entry.occurrence_count = new_count
        entry.proficiency_score = (prev_score * (new_count - 1) + proficiency) / new_count
        entry.last_updated_at = datetime.utcnow()
    else:
        db.add(ConceptHeatmapEntry(
            student_id=student_id,
            subject_id=subject_id,
            grade_id=grade_id,
            concept_name=concept["concept_name"],
            topic_tag=topic_tag,
            occurrence_count=1,
            proficiency_score=proficiency,
        ))


# Public API

async def process_chat_heatmap(db: Session, history_id: uuid.UUID) -> dict[str, Any]:
    """Process one chat session: generate a concept summary and update heatmap entries.

    Steps:
    1. Fetch the ChatHistory record.
    2. Read the chat log from disk.
    3. Call the AI service to produce a concept summary.
    4. Save the summary back to ChatHistory.
    5. Upsert ConceptHeatmapEntry rows for each returned concept.
    """
    chat = db.query(ChatHistory).filter(ChatHistory.history_id == history_id).first()
    if not chat:
        raise ValueError(f"Chat history {history_id} not found")
    chat_log = _read_chat_log(chat.file_path)
    subject_name = _get_subject_name(db, chat.subject_id)
    summary_data = await ai_post(
        "/heatmap/process",
        {
            "student_id": str(chat.student_id),
            "chat_id": str(chat.history_id),
            "subject": subject_name,
            "chat_log": chat_log,
        },
    )
    tutor_meta = None
    if isinstance(chat.summary, dict):
        tutor_meta = chat.summary.get("tutor_session")
    if tutor_meta and isinstance(summary_data, dict):
        summary_data = {**summary_data, "tutor_session": tutor_meta}
    chat.summary = summary_data
    db.commit()
    grade_id = _get_grade_id(db, chat.student_id)
    for concept in summary_data.get("concepts", []):
        _upsert_heatmap_entry(db, chat.student_id, chat.subject_id, grade_id, concept)
    db.commit()
    return summary_data
