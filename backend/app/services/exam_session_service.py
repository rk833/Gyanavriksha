"""Persisted exam sessions: start, abandon (terminate), complete on submit."""
from __future__ import annotations

import uuid
from datetime import datetime, timezone
from typing import Any

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.db.models.assignment import Assignment
from app.db.models.exam_session import ExamSession
from app.db.models.student_enrollment import StudentEnrollment
from app.shared.source_enum import ExamSessionStatus


def _assert_enrolled_for_assignment(db: Session, student_id: uuid.UUID, assignment: Assignment) -> None:
    enrolled = (
        db.query(StudentEnrollment)
        .filter(
            StudentEnrollment.student_id == student_id,
            StudentEnrollment.subject_id == assignment.subject_id,
            StudentEnrollment.is_active == True,
        )
        .first()
    )
    if not enrolled:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You are not enrolled in this subject",
        )


def exam_flags_for_assignments(
    db: Session,
    student_id: uuid.UUID,
    assignment_ids: list[uuid.UUID],
) -> dict[uuid.UUID, dict[str, Any]]:
    """Per assignment_id: closed_without_active, active_session_id, session_started_at."""
    active_states = (ExamSessionStatus.ACTIVE.value, ExamSessionStatus.PAUSED.value)
    closed_states = (ExamSessionStatus.COMPLETED.value, ExamSessionStatus.TERMINATED.value)

    out: dict[uuid.UUID, dict[str, Any]] = {
        aid: {
            "exam_closed_without_active": False,
            "exam_active_session_id": None,
            "exam_session_started_at": None,
        }
        for aid in assignment_ids
    }
    if not assignment_ids:
        return out

    rows = (
        db.query(ExamSession)
        .filter(
            ExamSession.student_id == student_id,
            ExamSession.assignment_id.in_(assignment_ids),
        )
        .all()
    )
    by_aid: dict[uuid.UUID, list[ExamSession]] = {}
    for r in rows:
        by_aid.setdefault(r.assignment_id, []).append(r)

    for aid, lst in by_aid.items():
        if aid not in out:
            continue
        active = next((x for x in lst if x.ended_at is None and x.status in active_states), None)
        closed_any = any(
            x.ended_at is not None or x.status in closed_states for x in lst
        )
        if active:
            out[aid]["exam_active_session_id"] = active.session_id
            out[aid]["exam_session_started_at"] = active.started_at
        if closed_any and not active:
            out[aid]["exam_closed_without_active"] = True

    return out


def start_exam_session(db: Session, student_id: uuid.UUID, assignment_id: uuid.UUID) -> dict[str, Any]:
    """Create a new exam session or return an existing active one."""
    assignment = db.query(Assignment).filter(Assignment.assignment_id == assignment_id).first()
    if not assignment:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Assignment not found")
    if not assignment.is_published:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Assignment is not published")
    if not assignment.is_exam_mode:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="This assignment is not in exam mode")

    _assert_enrolled_for_assignment(db, student_id, assignment)

    active_states = (ExamSessionStatus.ACTIVE.value, ExamSessionStatus.PAUSED.value)
    closed_states = (ExamSessionStatus.COMPLETED.value, ExamSessionStatus.TERMINATED.value)

    active = (
        db.query(ExamSession)
        .filter(
            ExamSession.student_id == student_id,
            ExamSession.assignment_id == assignment_id,
            ExamSession.ended_at.is_(None),
            ExamSession.status.in_(active_states),
        )
        .order_by(ExamSession.started_at.desc())
        .first()
    )
    if active:
        return _session_payload(active, assignment)

    closed = (
        db.query(ExamSession)
        .filter(
            ExamSession.student_id == student_id,
            ExamSession.assignment_id == assignment_id,
        )
        .filter(
            (ExamSession.ended_at.isnot(None)) | (ExamSession.status.in_(closed_states)),
        )
        .first()
    )
    if closed:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Exam attempt already used for this assignment. Contact your instructor if you need help.",
        )

    now = datetime.now(timezone.utc)
    sess = ExamSession(
        student_id=student_id,
        assignment_id=assignment_id,
        started_at=now,
        ended_at=None,
        status=ExamSessionStatus.ACTIVE.value,
        pause_count=0,
        total_paused_seconds=0,
        absence_alert_count=0,
    )
    db.add(sess)
    db.commit()
    db.refresh(sess)
    return _session_payload(sess, assignment)


def terminate_exam_session(db: Session, student_id: uuid.UUID, session_id: uuid.UUID) -> dict[str, Any]:
    """Mark an in-progress exam as abandoned (counts as attempt used)."""
    sess = db.query(ExamSession).filter(ExamSession.session_id == session_id).first()
    if not sess or sess.student_id != student_id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Exam session not found")
    if sess.ended_at is not None:
        return _session_payload(sess, _assignment_or_none(db, sess.assignment_id))

    now = datetime.now(timezone.utc)
    sess.ended_at = now
    sess.status = ExamSessionStatus.TERMINATED.value
    db.add(sess)
    db.commit()
    db.refresh(sess)
    return _session_payload(sess, _assignment_or_none(db, sess.assignment_id))


def complete_active_session(db: Session, student_id: uuid.UUID, assignment_id: uuid.UUID) -> None:
    """Close the active exam session after a successful submission."""
    active_states = (ExamSessionStatus.ACTIVE.value, ExamSessionStatus.PAUSED.value)
    sess = (
        db.query(ExamSession)
        .filter(
            ExamSession.student_id == student_id,
            ExamSession.assignment_id == assignment_id,
            ExamSession.ended_at.is_(None),
            ExamSession.status.in_(active_states),
        )
        .order_by(ExamSession.started_at.desc())
        .first()
    )
    if not sess:
        return
    now = datetime.now(timezone.utc)
    sess.ended_at = now
    sess.status = ExamSessionStatus.COMPLETED.value
    db.add(sess)
    db.commit()


def _assignment_or_none(db: Session, assignment_id: uuid.UUID) -> Assignment | None:
    return db.query(Assignment).filter(Assignment.assignment_id == assignment_id).first()


def _session_payload(sess: ExamSession, assignment: Assignment | None) -> dict[str, Any]:
    duration_min = assignment.exam_duration_minutes if assignment else None
    duration_sec = int(duration_min * 60) if duration_min else None
    return {
        "session_id": sess.session_id,
        "assignment_id": sess.assignment_id,
        "started_at": sess.started_at,
        "ended_at": sess.ended_at,
        "status": sess.status,
        "exam_duration_minutes": duration_min,
        "exam_duration_seconds": duration_sec,
        "pause_count": sess.pause_count,
        "total_paused_seconds": sess.total_paused_seconds,
    }
