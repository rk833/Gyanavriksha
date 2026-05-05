"""Persist AI tutor turns to ``chat_history`` + JSON transcripts; list/load sessions for students."""

from __future__ import annotations

import uuid
from datetime import datetime, timezone
from typing import Any

from sqlalchemy import or_
from sqlalchemy.orm import Session

from app.db.models.chat_history import ChatHistory
from app.db.models.instructor_subject import InstructorSubject
from app.db.models.subject import Subject
from app.services import chat_log_io
from app.services import rag_service
from app.services import student_service


def _update_summary_preview(chat: ChatHistory, answer_preview: str, turn_pairs: int) -> None:
    """Merge UI metadata into ``summary`` JSONB without wiping heatmap AI payload."""
    prev = chat.summary if isinstance(chat.summary, dict) else {}
    tutor_session = {
        "preview": (answer_preview or "")[:400],
        "turn_pairs": turn_pairs,
        "updated_at": datetime.now(timezone.utc).isoformat(),
        "subject_id": chat.subject_id,
    }
    chat.summary = {**prev, "tutor_session": tutor_session}


async def tutor_chat_turn(
    db: Session,
    student_id: uuid.UUID,
    query: str,
    *,
    subject_id: int | None,
    history_id: uuid.UUID | None,
    grade: int | None,
) -> dict[str, Any]:
    """Run RAG for the student, optionally persist to ``ChatHistory`` and transcript file."""
    enrollment = None
    if subject_id is not None:
        enrollment = student_service.verify_student_enrollment(db, student_id, subject_id)

    subject_name: str | None = None
    instructor_id_for_subject: str | None = None
    if subject_id is not None:
        sub = db.query(Subject).filter(Subject.subject_id == subject_id).first()
        subject_name = sub.subject_name if sub else None
        inst_row = (
            db.query(InstructorSubject.instructor_id)
            .filter(
                InstructorSubject.subject_id == subject_id,
                InstructorSubject.is_active == True,
            )
            .order_by(InstructorSubject.assigned_at.asc())
            .first()
        )
        instructor_id_for_subject = str(inst_row.instructor_id) if inst_row else None

    rag = await rag_service.query_rag(
        user_type="student",
        query=query,
        grade=grade,
        subject=subject_name,
        instructor_id=instructor_id_for_subject,
        class_id=str(subject_id) if subject_id is not None else None,
        student_id=str(student_id),
    )
    answer = rag.get("answer") if isinstance(rag, dict) else str(rag)
    sources = rag.get("sources") if isinstance(rag, dict) else []
    if not isinstance(sources, list):
        sources = []
    src_strings = [str(s) for s in sources if s]

    if subject_id is None or enrollment is None:
        return {
            "answer": answer,
            "sources": src_strings,
            "history_id": None,
            "persisted": False,
        }

    rel_path: str
    chat: ChatHistory

    if history_id is not None:
        chat = (
            db.query(ChatHistory)
            .filter(
                ChatHistory.history_id == history_id,
                ChatHistory.student_id == student_id,
            )
            .first()
        )
        if not chat:
            raise ValueError("Chat session not found")
        if chat.subject_id != subject_id:
            raise ValueError("Subject does not match this chat session")
        rel_path = chat.file_path
        chat_log_io.append_exchange(rel_path, query, answer, src_strings)
        data = chat_log_io.load_transcript(rel_path)
        n_pairs = len([t for t in data.get("turns", []) if t.get("role") == "user"])
        _update_summary_preview(chat, answer, n_pairs)
        chat.updated_at = datetime.now(timezone.utc)
    else:
        hid = uuid.uuid4()
        rel_path = chat_log_io.chat_transcript_path(hid)
        chat_log_io.append_exchange(rel_path, query, answer, src_strings)
        chat = ChatHistory(
            history_id=hid,
            student_id=student_id,
            subject_id=subject_id,
            file_path=rel_path,
            summary=None,
        )
        data = chat_log_io.load_transcript(rel_path)
        n_pairs = len([t for t in data.get("turns", []) if t.get("role") == "user"])
        _update_summary_preview(chat, answer, n_pairs)
        db.add(chat)

    db.commit()
    db.refresh(chat)

    return {
        "answer": answer,
        "sources": src_strings,
        "history_id": str(chat.history_id),
        "persisted": True,
    }


def list_tutor_sessions(
    db: Session,
    student_id: uuid.UUID,
    page: int,
    per_page: int,
    subject_id: int | None = None,
    search: str | None = None,
) -> tuple[list[dict[str, Any]], int]:
    """Paginated chat sessions for the student (newest first)."""
    q = (
        db.query(ChatHistory, Subject.subject_name)
        .join(Subject, Subject.subject_id == ChatHistory.subject_id)
        .filter(ChatHistory.student_id == student_id)
        .order_by(ChatHistory.updated_at.desc())
    )
    if subject_id is not None:
        q = q.filter(ChatHistory.subject_id == subject_id)
    if search:
        term = f"%{search.strip()}%"
        q = q.filter(
            or_(
                Subject.subject_name.ilike(term),
                ChatHistory.summary["tutor_session"]["preview"].astext.ilike(term),
            )
        )
    total = q.count()
    rows = q.offset((page - 1) * per_page).limit(per_page).all()

    items = []
    for chat, subject_name in rows:
        preview = ""
        if isinstance(chat.summary, dict):
            ts = chat.summary.get("tutor_session") or {}
            preview = ts.get("preview") or ""
        items.append({
            "history_id": str(chat.history_id),
            "subject_id": chat.subject_id,
            "subject_name": subject_name or "",
            "preview": preview,
            "updated_at": chat.updated_at.isoformat() if chat.updated_at else None,
        })
    return items, total


def get_tutor_session_detail(
    db: Session,
    student_id: uuid.UUID,
    history_id: uuid.UUID,
) -> dict[str, Any]:
    """Return transcript messages for replay in the UI."""
    chat = (
        db.query(ChatHistory)
        .filter(
            ChatHistory.history_id == history_id,
            ChatHistory.student_id == student_id,
        )
        .first()
    )
    if not chat:
        raise ValueError("Chat session not found")

    data = chat_log_io.load_transcript(chat.file_path)
    turns = data.get("turns", [])
    messages = []
    for t in turns:
        role = t.get("role")
        if role not in ("user", "assistant"):
            continue
        entry = {
            "role": role,
            "text": t.get("content") or "",
            "timestamp": t.get("ts"),
        }
        if role == "assistant" and t.get("sources"):
            entry["citation"] = t["sources"][0] if t["sources"] else None
        messages.append(entry)

    sub = db.query(Subject).filter(Subject.subject_id == chat.subject_id).first()
    return {
        "history_id": str(chat.history_id),
        "subject_id": chat.subject_id,
        "subject_name": sub.subject_name if sub else "",
        "messages": messages,
        "summary": chat.summary,
    }
