"""
Instructor service — helper functions for instructor API endpoints.
Sprint 4 Phases 1-5: GD-82 to GD-96
"""
import os
import uuid
from datetime import datetime, timedelta, timezone
from pathlib import Path

from sqlalchemy.orm import Session, aliased
from sqlalchemy import func, desc, extract, case, or_

from app.db.models.assignment import Assignment
from app.db.models.chat_history import ChatHistory
from app.db.models.concept_heatmap_entry import ConceptHeatmapEntry
from app.db.models.curriculum_document import CurriculumDocument
from app.db.models.grade import Grade
from app.db.models.instructor_subject import InstructorSubject
from app.db.models.knowledge_gap import KnowledgeGap
from app.db.models.student_enrollment import StudentEnrollment
from app.db.models.subject import Subject
from app.db.models.submission import Submission
from app.db.models.submission_feedback import SubmissionFeedback
from app.db.models.user import User
from app.shared.source_enum import DocumentType, EmbeddingStatus, SubmissionProcessingStatus


def get_instructor_subjects(db: Session, instructor_id: str) -> list[dict]:
    """Get all subjects assigned to this instructor with counts. Sorted by grade then name."""
    rows = (
        db.query(
            Subject.subject_id,
            Subject.subject_name,
            Subject.subject_code,
            Subject.grade_id,
            Grade.grade_name,
            Grade.grade_level,
        )
        .join(InstructorSubject, InstructorSubject.subject_id == Subject.subject_id)
        .join(Grade, Grade.grade_id == Subject.grade_id)
        .filter(
            InstructorSubject.instructor_id == instructor_id,
            InstructorSubject.is_active == True,
        )
        .order_by(Grade.grade_level, Subject.subject_name)
        .all()
    )

    results = []
    for row in rows:
        student_count = (
            db.query(func.count(StudentEnrollment.enrollment_id))
            .filter(
                StudentEnrollment.subject_id == row.subject_id,
                StudentEnrollment.is_active == True,
            )
            .scalar()
            or 0
        )
        assignment_count = (
            db.query(func.count(Assignment.assignment_id))
            .filter(
                Assignment.subject_id == row.subject_id,
                Assignment.instructor_id == instructor_id,
            )
            .scalar()
            or 0
        )
        results.append(
            {
                "subject_id": row.subject_id,
                "subject_name": row.subject_name,
                "subject_code": row.subject_code,
                "grade_id": row.grade_id,
                "grade_name": row.grade_name,
                "student_count": student_count,
                "assignment_count": assignment_count,
            }
        )

    return results


def verify_instructor_subject(db: Session, instructor_id: str, subject_id: int) -> bool:
    """Check that the instructor is assigned to the given subject."""
    exists = (
        db.query(InstructorSubject)
        .filter(
            InstructorSubject.instructor_id == instructor_id,
            InstructorSubject.subject_id == subject_id,
            InstructorSubject.is_active == True,
        )
        .first()
    )
    return exists is not None


def get_instructor_subject_ids(db: Session, instructor_id: str) -> list[int]:
    """Get list of subject IDs assigned to this instructor."""
    rows = (
        db.query(InstructorSubject.subject_id)
        .filter(
            InstructorSubject.instructor_id == instructor_id,
            InstructorSubject.is_active == True,
        )
        .all()
    )
    return [r.subject_id for r in rows]


def _assignment_scope_for_instructor(db: Session, instructor_id: str):
    """Assignments this instructor may manage: owned OR linked via InstructorSubject."""
    subject_ids = get_instructor_subject_ids(db, instructor_id)
    owns = Assignment.instructor_id == instructor_id
    if subject_ids:
        return or_(owns, Assignment.subject_id.in_(subject_ids))
    return owns


def _uploaded_file_entries(image_path: str | None) -> list[dict]:
    if not image_path or not str(image_path).strip():
        return []
    out: list[dict] = []
    for part in (p.strip() for p in str(image_path).split(",")):
        if not part:
            continue
        name = os.path.basename(part.replace("\\", os.sep))
        out.append({"index": len(out), "name": name})
    return out


# Phase 2: GD-84 — Dashboard aggregation

def get_instructor_dashboard(db: Session, instructor_id: str) -> dict:
    """Aggregate all dashboard data for the instructor intelligence dashboard."""
    subject_ids = get_instructor_subject_ids(db, instructor_id)
    if not subject_ids:
        return {
            "class_completion": 0.0,
            "class_avg_score": None,
            "total_assignments": 0,
            "total_submissions": 0,
            "recent_submissions": [],
            "heatmap_preview": [],
            "velocity_table": [],
        }

    # Total assignments created by this instructor
    total_assignments = (
        db.query(func.count(Assignment.assignment_id))
        .filter(Assignment.instructor_id == instructor_id)
        .scalar()
        or 0
    )

    # Total submissions for instructor's assignments
    total_submissions = (
        db.query(func.count(Submission.submission_id))
        .join(Assignment, Assignment.assignment_id == Submission.assignment_id)
        .filter(Assignment.instructor_id == instructor_id)
        .scalar()
        or 0
    )

    # Class average score (from graded submissions only)
    class_avg_score = (
        db.query(func.avg(Submission.score_percentage))
        .join(Assignment, Assignment.assignment_id == Submission.assignment_id)
        .filter(
            Assignment.instructor_id == instructor_id,
            Submission.processing_status == SubmissionProcessingStatus.DONE,
            Submission.score_percentage.isnot(None),
        )
        .scalar()
    )
    if class_avg_score is not None:
        class_avg_score = round(float(class_avg_score), 1)

    # Class completion: graded submissions / (total published assignments * enrolled students)
    published_assignments = (
        db.query(func.count(Assignment.assignment_id))
        .filter(
            Assignment.instructor_id == instructor_id,
            Assignment.is_published == True,
        )
        .scalar()
        or 0
    )
    total_enrolled = (
        db.query(func.count(StudentEnrollment.enrollment_id))
        .filter(
            StudentEnrollment.subject_id.in_(subject_ids),
            StudentEnrollment.is_active == True,
        )
        .scalar()
        or 0
    )
    graded_submissions = (
        db.query(func.count(Submission.submission_id))
        .join(Assignment, Assignment.assignment_id == Submission.assignment_id)
        .filter(
            Assignment.instructor_id == instructor_id,
            Submission.processing_status == SubmissionProcessingStatus.DONE,
        )
        .scalar()
        or 0
    )
    expected_total = published_assignments * total_enrolled
    class_completion = round((graded_submissions / expected_total) * 100, 1) if expected_total > 0 else 0.0

    # Recent submissions (last 5)
    recent_rows = (
        db.query(
            Submission.submission_id,
            User.full_name.label("student_name"),
            Assignment.title.label("assignment_title"),
            Subject.subject_name,
            Submission.processing_status.label("status"),
            Submission.score_percentage,
            Submission.submitted_at,
        )
        .join(Assignment, Assignment.assignment_id == Submission.assignment_id)
        .join(User, User.user_id == Submission.student_id)
        .join(Subject, Subject.subject_id == Submission.subject_id)
        .filter(Assignment.instructor_id == instructor_id)
        .order_by(desc(Submission.submitted_at))
        .limit(5)
        .all()
    )
    recent_submissions = [
        {
            "submission_id": r.submission_id,
            "student_name": r.student_name,
            "assignment_title": r.assignment_title,
            "subject_name": r.subject_name,
            "status": r.status,
            "score_percentage": r.score_percentage,
            "submitted_at": r.submitted_at,
        }
        for r in recent_rows
    ]

    # Heatmap preview: top 4 topic tags with lowest avg scores (struggle areas)
    heatmap_rows = (
        db.query(
            KnowledgeGap.topic_tag,
            Subject.subject_name,
            func.count(func.distinct(KnowledgeGap.student_id)).label("affected_student_count"),
        )
        .join(Subject, Subject.subject_id == KnowledgeGap.subject_id)
        .filter(
            KnowledgeGap.subject_id.in_(subject_ids),
            KnowledgeGap.is_resolved == False,
        )
        .group_by(KnowledgeGap.topic_tag, Subject.subject_name)
        .order_by(desc(func.count(func.distinct(KnowledgeGap.student_id))))
        .limit(4)
        .all()
    )
    # Calculate struggle percentage: affected students / total enrolled * 100
    heatmap_preview = []
    for h in heatmap_rows:
        struggle_pct = round((h.affected_student_count / total_enrolled) * 100, 1) if total_enrolled > 0 else 0.0
        heatmap_preview.append(
            {
                "topic_tag": h.topic_tag,
                "subject_name": h.subject_name,
                "struggle_percentage": struggle_pct,
                "affected_student_count": h.affected_student_count,
            }
        )

    # Velocity table: top 5 students by activity (submission count * avg score)
    velocity_rows = (
        db.query(
            Submission.student_id,
            User.full_name.label("student_name"),
            func.count(Submission.submission_id).label("submission_count"),
            func.avg(Submission.score_percentage).label("avg_score"),
        )
        .join(Assignment, Assignment.assignment_id == Submission.assignment_id)
        .join(User, User.user_id == Submission.student_id)
        .filter(
            Assignment.instructor_id == instructor_id,
            Submission.processing_status == SubmissionProcessingStatus.DONE,
            Submission.score_percentage.isnot(None),
        )
        .group_by(Submission.student_id, User.full_name)
        .order_by(desc(func.count(Submission.submission_id)))
        .limit(5)
        .all()
    )
    velocity_table = []
    for v in velocity_rows:
        avg = float(v.avg_score) if v.avg_score is not None else 0.0
        count = v.submission_count or 0
        # Velocity score: normalized combo of count and avg score
        velocity_score = round((count * 0.4) + (avg * 0.04) + (min(count / max(total_assignments, 1), 1.0) * 2.0), 1)
        velocity_table.append(
            {
                "student_id": v.student_id,
                "student_name": v.student_name,
                "submission_count": count,
                "avg_score": round(avg, 1),
                "velocity_score": velocity_score,
                "trend": "stable",
            }
        )

    return {
        "class_completion": class_completion,
        "class_avg_score": class_avg_score,
        "total_assignments": total_assignments,
        "total_submissions": total_submissions,
        "recent_submissions": recent_submissions,
        "heatmap_preview": heatmap_preview,
        "velocity_table": velocity_table,
    }


# Phase 2: GD-86 — Subject detail with students

def get_instructor_subject_detail(
    db: Session,
    instructor_id: str,
    subject_id: int,
    page: int = 1,
    per_page: int = 20,
    sort_by: str = "name",
) -> dict:
    """Get detailed info about a subject, including enrolled students with progress."""
    # Subject info
    subject_row = (
        db.query(
            Subject.subject_id,
            Subject.subject_name,
            Subject.subject_code,
            Subject.description,
            Subject.grade_id,
            Grade.grade_name,
        )
        .join(Grade, Grade.grade_id == Subject.grade_id)
        .filter(Subject.subject_id == subject_id)
        .first()
    )
    if not subject_row:
        return None

    # Counts
    student_count = (
        db.query(func.count(StudentEnrollment.enrollment_id))
        .filter(
            StudentEnrollment.subject_id == subject_id,
            StudentEnrollment.is_active == True,
        )
        .scalar()
        or 0
    )
    assignment_count = (
        db.query(func.count(Assignment.assignment_id))
        .filter(
            Assignment.subject_id == subject_id,
            Assignment.instructor_id == instructor_id,
        )
        .scalar()
        or 0
    )
    total_submissions = (
        db.query(func.count(Submission.submission_id))
        .join(Assignment, Assignment.assignment_id == Submission.assignment_id)
        .filter(
            Assignment.subject_id == subject_id,
            Assignment.instructor_id == instructor_id,
        )
        .scalar()
        or 0
    )
    class_avg_score = (
        db.query(func.avg(Submission.score_percentage))
        .join(Assignment, Assignment.assignment_id == Submission.assignment_id)
        .filter(
            Assignment.subject_id == subject_id,
            Assignment.instructor_id == instructor_id,
            Submission.processing_status == SubmissionProcessingStatus.DONE,
            Submission.score_percentage.isnot(None),
        )
        .scalar()
    )
    if class_avg_score is not None:
        class_avg_score = round(float(class_avg_score), 1)

    # Published assignment count for completion calculation
    published_count = (
        db.query(func.count(Assignment.assignment_id))
        .filter(
            Assignment.subject_id == subject_id,
            Assignment.instructor_id == instructor_id,
            Assignment.is_published == True,
        )
        .scalar()
        or 0
    )

    # Enrolled students with their stats
    enrolled_students = (
        db.query(
            User.user_id.label("student_id"),
            User.full_name,
            User.email,
        )
        .join(StudentEnrollment, StudentEnrollment.student_id == User.user_id)
        .filter(
            StudentEnrollment.subject_id == subject_id,
            StudentEnrollment.is_active == True,
        )
        .all()
    )

    students = []
    for s in enrolled_students:
        # Per-student submission stats in this subject
        student_submissions = (
            db.query(
                func.count(Submission.submission_id).label("total"),
                func.avg(Submission.score_percentage).label("avg_score"),
                func.max(Submission.submitted_at).label("last_active"),
            )
            .join(Assignment, Assignment.assignment_id == Submission.assignment_id)
            .filter(
                Submission.student_id == s.student_id,
                Assignment.subject_id == subject_id,
                Assignment.instructor_id == instructor_id,
            )
            .first()
        )

        total_subs = student_submissions.total or 0
        avg_score = round(float(student_submissions.avg_score), 1) if student_submissions.avg_score else None
        last_active = student_submissions.last_active

        # Graded submissions for completion
        graded = (
            db.query(func.count(Submission.submission_id))
            .join(Assignment, Assignment.assignment_id == Submission.assignment_id)
            .filter(
                Submission.student_id == s.student_id,
                Assignment.subject_id == subject_id,
                Assignment.instructor_id == instructor_id,
                Submission.processing_status == SubmissionProcessingStatus.DONE,
            )
            .scalar()
            or 0
        )
        completion = round((graded / published_count) * 100, 1) if published_count > 0 else 0.0

        students.append(
            {
                "student_id": s.student_id,
                "full_name": s.full_name,
                "email": s.email,
                "total_submissions": total_subs,
                "avg_score": avg_score,
                "completion_percentage": completion,
                "last_active": last_active,
            }
        )

    # Sort students
    if sort_by == "score":
        students.sort(key=lambda x: x["avg_score"] or 0, reverse=True)
    elif sort_by == "submissions":
        students.sort(key=lambda x: x["total_submissions"], reverse=True)
    else:
        students.sort(key=lambda x: x["full_name"].lower())

    # Paginate students
    students_total = len(students)
    start = (page - 1) * per_page
    end = start + per_page
    paginated_students = students[start:end]
    students_total_pages = (students_total + per_page - 1) // per_page if students_total else 0

    return {
        "subject_id": subject_row.subject_id,
        "subject_name": subject_row.subject_name,
        "subject_code": subject_row.subject_code,
        "description": subject_row.description,
        "grade_id": subject_row.grade_id,
        "grade_name": subject_row.grade_name,
        "student_count": student_count,
        "assignment_count": assignment_count,
        "total_submissions": total_submissions,
        "class_avg_score": class_avg_score,
        "students": paginated_students,
        "students_total": students_total,
        "students_page": page,
        "students_per_page": per_page,
        "students_total_pages": students_total_pages,
    }


# Phase 3: GD-87 — Assignment list & detail

def get_instructor_assignments(
    db: Session,
    instructor_id: str,
    subject_id: int | None = None,
    status_filter: str | None = None,
    is_exam_mode: bool | None = None,
    page: int = 1,
    per_page: int = 20,
) -> tuple[list[dict], int]:
    """List assignments created by this instructor with filters and pagination."""
    query = (
        db.query(
            Assignment,
            Subject.subject_name,
            Grade.grade_name,
        )
        .join(Subject, Subject.subject_id == Assignment.subject_id)
        .join(Grade, Grade.grade_id == Subject.grade_id)
        .filter(Assignment.instructor_id == instructor_id)
    )

    if subject_id is not None:
        query = query.filter(Assignment.subject_id == subject_id)
    if is_exam_mode is not None:
        query = query.filter(Assignment.is_exam_mode == is_exam_mode)
    if status_filter == "draft":
        query = query.filter(Assignment.is_published == False)
    elif status_filter == "published":
        query = query.filter(Assignment.is_published == True)

    total = query.count()
    rows = (
        query.order_by(desc(Assignment.created_at))
        .offset((page - 1) * per_page)
        .limit(per_page)
        .all()
    )

    items = []
    for assignment, subject_name, grade_name in rows:
        submission_count = (
            db.query(func.count(Submission.submission_id))
            .filter(Submission.assignment_id == assignment.assignment_id)
            .scalar()
            or 0
        )
        avg_score = (
            db.query(func.avg(Submission.score_percentage))
            .filter(
                Submission.assignment_id == assignment.assignment_id,
                Submission.processing_status == SubmissionProcessingStatus.DONE,
                Submission.score_percentage.isnot(None),
            )
            .scalar()
        )
        if avg_score is not None:
            avg_score = round(float(avg_score), 1)

        items.append({
            "assignment_id": assignment.assignment_id,
            "title": assignment.title,
            "description": assignment.description,
            "subject_id": assignment.subject_id,
            "subject_name": subject_name,
            "grade_name": grade_name,
            "topic_tags": assignment.topic_tags,
            "is_exam_mode": assignment.is_exam_mode,
            "exam_duration_minutes": assignment.exam_duration_minutes,
            "exam_max_pauses": assignment.exam_max_pauses,
            "exam_strict_proctor": assignment.exam_strict_proctor,
            "due_date": assignment.due_date,
            "is_published": assignment.is_published,
            "max_score": assignment.max_score,
            "submission_count": submission_count,
            "avg_score": avg_score,
            "created_at": assignment.created_at,
        })

    return items, total


def get_assignment_detail(
    db: Session,
    instructor_id: str,
    assignment_id: uuid.UUID,
) -> dict | None:
    """Get detailed assignment info including submission stats."""
    row = (
        db.query(
            Assignment,
            Subject.subject_name,
            Grade.grade_name,
        )
        .join(Subject, Subject.subject_id == Assignment.subject_id)
        .join(Grade, Grade.grade_id == Subject.grade_id)
        .filter(
            Assignment.assignment_id == assignment_id,
            Assignment.instructor_id == instructor_id,
        )
        .first()
    )
    if not row:
        return None

    assignment, subject_name, grade_name = row

    submission_count = (
        db.query(func.count(Submission.submission_id))
        .filter(Submission.assignment_id == assignment_id)
        .scalar()
        or 0
    )
    graded_count = (
        db.query(func.count(Submission.submission_id))
        .filter(
            Submission.assignment_id == assignment_id,
            Submission.processing_status == SubmissionProcessingStatus.DONE,
        )
        .scalar()
        or 0
    )
    pending_count = submission_count - graded_count
    avg_score = (
        db.query(func.avg(Submission.score_percentage))
        .filter(
            Submission.assignment_id == assignment_id,
            Submission.processing_status == SubmissionProcessingStatus.DONE,
            Submission.score_percentage.isnot(None),
        )
        .scalar()
    )
    if avg_score is not None:
        avg_score = round(float(avg_score), 1)

    # Recent 10 submissions
    recent_subs = (
        db.query(
            Submission.submission_id,
            User.full_name.label("student_name"),
            Submission.processing_status.label("status"),
            Submission.score_percentage,
            Submission.submitted_at,
        )
        .join(User, User.user_id == Submission.student_id)
        .filter(Submission.assignment_id == assignment_id)
        .order_by(desc(Submission.submitted_at))
        .limit(10)
        .all()
    )

    return {
        "assignment_id": assignment.assignment_id,
        "title": assignment.title,
        "description": assignment.description,
        "subject_id": assignment.subject_id,
        "subject_name": subject_name,
        "grade_name": grade_name,
        "topic_tags": assignment.topic_tags,
        "is_exam_mode": assignment.is_exam_mode,
        "exam_duration_minutes": assignment.exam_duration_minutes,
        "exam_max_pauses": assignment.exam_max_pauses,
        "exam_strict_proctor": assignment.exam_strict_proctor,
        "due_date": assignment.due_date,
        "is_published": assignment.is_published,
        "max_score": assignment.max_score,
        "submission_count": submission_count,
        "graded_count": graded_count,
        "pending_count": pending_count,
        "avg_score": avg_score,
        "created_at": assignment.created_at,
        "recent_submissions": [
            {
                "submission_id": s.submission_id,
                "student_name": s.student_name,
                "status": s.status,
                "score_percentage": s.score_percentage,
                "submitted_at": s.submitted_at,
            }
            for s in recent_subs
        ],
    }


# Phase 3: GD-88 — Assignment create, update, publish

def create_assignment(db: Session, instructor_id: str, data: dict) -> Assignment:
    """Create a new draft assignment."""
    exam_on = bool(data.get("is_exam_mode", False))
    assignment = Assignment(
        subject_id=data["subject_id"],
        instructor_id=instructor_id,
        title=data["title"],
        description=data.get("description"),
        topic_tags=data.get("topic_tags"),
        max_score=data.get("max_score", 100.0),
        is_exam_mode=exam_on,
        exam_duration_minutes=data.get("exam_duration_minutes") if exam_on else None,
        exam_max_pauses=data.get("exam_max_pauses") if exam_on else None,
        exam_strict_proctor=bool(data.get("exam_strict_proctor", False)) if exam_on else False,
        due_date=data.get("due_date"),
        is_published=False,
    )
    db.add(assignment)
    db.commit()
    db.refresh(assignment)
    return assignment


def update_assignment(
    db: Session,
    instructor_id: str,
    assignment_id: uuid.UUID,
    data: dict,
) -> Assignment | None:
    """Update assignment fields. Published assignments can still be updated (except subject_id)."""
    assignment = (
        db.query(Assignment)
        .filter(
            Assignment.assignment_id == assignment_id,
            Assignment.instructor_id == instructor_id,
        )
        .first()
    )
    if not assignment:
        return None

    for field in [
        "title",
        "description",
        "due_date",
        "max_score",
        "topic_tags",
        "is_exam_mode",
        "exam_duration_minutes",
        "exam_max_pauses",
        "exam_strict_proctor",
    ]:
        if field in data:
            setattr(assignment, field, data[field])

    if "is_exam_mode" in data and data["is_exam_mode"] is False:
        assignment.exam_duration_minutes = None
        assignment.exam_max_pauses = None
        assignment.exam_strict_proctor = False

    db.commit()
    db.refresh(assignment)
    return assignment


def publish_assignment(
    db: Session,
    instructor_id: str,
    assignment_id: uuid.UUID,
) -> Assignment | None:
    """Publish a draft assignment. Returns None if not found, raises ValueError if already published."""
    assignment = (
        db.query(Assignment)
        .filter(
            Assignment.assignment_id == assignment_id,
            Assignment.instructor_id == instructor_id,
        )
        .first()
    )
    if not assignment:
        return None
    if assignment.is_published:
        raise ValueError("Assignment is already published")

    assignment.is_published = True
    db.commit()
    db.refresh(assignment)
    return assignment


# Phase 3: GD-89 — Assignment delete

def delete_assignment(
    db: Session,
    instructor_id: str,
    assignment_id: uuid.UUID,
) -> str | None:
    """Delete a draft assignment with no submissions. Returns error message or None on success."""
    assignment = (
        db.query(Assignment)
        .filter(
            Assignment.assignment_id == assignment_id,
            Assignment.instructor_id == instructor_id,
        )
        .first()
    )
    if not assignment:
        return "NOT_FOUND"
    if assignment.is_published:
        return "Cannot delete published assignment"

    submission_count = (
        db.query(func.count(Submission.submission_id))
        .filter(Submission.assignment_id == assignment_id)
        .scalar()
        or 0
    )
    if submission_count > 0:
        return "Cannot delete assignment with submissions"

    db.delete(assignment)
    db.commit()
    return None


# Phase 4: GD-90 — Submissions list & detail

def get_instructor_submissions(
    db: Session,
    instructor_id: str,
    assignment_id: uuid.UUID | None = None,
    student_id: uuid.UUID | None = None,
    subject_id: int | None = None,
    status_filter: str | None = None,
    page: int = 1,
    per_page: int = 20,
) -> tuple[list[dict], int]:
    """List submissions for instructor's assignments with filters."""
    Inst = aliased(User)
    query = (
        db.query(
            Submission,
            User.full_name.label("student_name"),
            User.email.label("student_email"),
            Assignment.title.label("assignment_title"),
            Subject.subject_name,
            Inst.full_name.label("assignment_instructor_name"),
        )
        .join(Assignment, Assignment.assignment_id == Submission.assignment_id)
        .join(User, User.user_id == Submission.student_id)
        .join(Subject, Subject.subject_id == Submission.subject_id)
        .join(Inst, Inst.user_id == Assignment.instructor_id)
        .filter(_assignment_scope_for_instructor(db, instructor_id))
    )

    if assignment_id is not None:
        query = query.filter(Submission.assignment_id == assignment_id)
    if student_id is not None:
        query = query.filter(Submission.student_id == student_id)
    if subject_id is not None:
        query = query.filter(Submission.subject_id == subject_id)
    if status_filter:
        try:
            query = query.filter(
                Submission.processing_status == SubmissionProcessingStatus(status_filter)
            )
        except ValueError:
            pass

    total = query.count()
    rows = (
        query.order_by(desc(Submission.submitted_at))
        .offset((page - 1) * per_page)
        .limit(per_page)
        .all()
    )

    items = []
    for sub, student_name, student_email, assignment_title, subject_name, assignment_instructor_name in rows:
        items.append({
            "submission_id": sub.submission_id,
            "student_id": sub.student_id,
            "student_name": student_name,
            "student_email": student_email,
            "assignment_id": sub.assignment_id,
            "assignment_title": assignment_title,
            "subject_name": subject_name,
            "assignment_instructor_name": assignment_instructor_name,
            "submitted_at": sub.submitted_at,
            "processing_status": sub.processing_status,
            "score_percentage": sub.score_percentage,
            "file_count": len(sub.image_path.split(",")) if sub.image_path else 0,
        })

    return items, total


def get_submission_detail(
    db: Session,
    instructor_id: str,
    submission_id: uuid.UUID,
) -> dict | None:
    """Get detailed submission view with feedback."""
    Inst = aliased(User)
    row = (
        db.query(
            Submission,
            User.full_name.label("student_name"),
            User.email.label("student_email"),
            Assignment.title.label("assignment_title"),
            Subject.subject_name,
            Inst.full_name.label("assignment_instructor_name"),
        )
        .join(Assignment, Assignment.assignment_id == Submission.assignment_id)
        .join(User, User.user_id == Submission.student_id)
        .join(Subject, Subject.subject_id == Submission.subject_id)
        .join(Inst, Inst.user_id == Assignment.instructor_id)
        .filter(
            Submission.submission_id == submission_id,
            _assignment_scope_for_instructor(db, instructor_id),
        )
        .first()
    )
    if not row:
        return None

    sub, student_name, student_email, assignment_title, subject_name, assignment_instructor_name = row

    # Get feedback if exists
    feedback = (
        db.query(SubmissionFeedback)
        .filter(SubmissionFeedback.submission_id == submission_id)
        .first()
    )
    feedback_data = None
    if feedback:
        feedback_data = {
            "feedback_id": feedback.feedback_id,
            "overall_feedback": feedback.overall_feedback,
            "step_by_step_corrections": feedback.step_by_step_corrections,
            "score_percentage": feedback.score_percentage,
            "strengths": feedback.strengths,
            "improvements": feedback.improvements,
            "instructor_comments": feedback.instructor_comments,
            "graded_by": feedback.graded_by,
            "created_at": feedback.created_at,
            "ai_snapshot": getattr(feedback, "ai_snapshot", None),
        }

    return {
        "submission_id": sub.submission_id,
        "student_id": sub.student_id,
        "student_name": student_name,
        "student_email": student_email,
        "assignment_id": sub.assignment_id,
        "assignment_title": assignment_title,
        "subject_name": subject_name,
        "assignment_instructor_name": assignment_instructor_name,
        "submitted_at": sub.submitted_at,
        "processing_status": sub.processing_status,
        "score_percentage": sub.score_percentage,
        "image_path": sub.image_path,
        "uploaded_files": _uploaded_file_entries(sub.image_path),
        "file_count": len(sub.image_path.split(",")) if sub.image_path else 0,
        "feedback": feedback_data,
    }


# Phase 4: GD-91 — Manual feedback/score override

def override_submission_feedback(
    db: Session,
    instructor_id: str,
    submission_id: uuid.UUID,
    data: dict,
) -> dict | None:
    """Create or update instructor feedback on a submission."""
    # Verify submission belongs to instructor's assignments
    sub = (
        db.query(Submission)
        .join(Assignment, Assignment.assignment_id == Submission.assignment_id)
        .filter(
            Submission.submission_id == submission_id,
            _assignment_scope_for_instructor(db, instructor_id),
        )
        .first()
    )
    if not sub:
        return None

    # Update submission score
    sub.score_percentage = data["score_percentage"]
    if sub.processing_status != SubmissionProcessingStatus.DONE:
        sub.processing_status = SubmissionProcessingStatus.DONE
        sub.processing_completed_at = datetime.now(timezone.utc)

    # Find or create feedback
    feedback = (
        db.query(SubmissionFeedback)
        .filter(SubmissionFeedback.submission_id == submission_id)
        .first()
    )
    if feedback:
        snap = getattr(feedback, "ai_snapshot", None)
        if snap is None and feedback.graded_by is None:
            feedback.ai_snapshot = {
                "score_percentage": feedback.score_percentage,
                "overall_feedback": feedback.overall_feedback,
                "step_by_step_corrections": list(feedback.step_by_step_corrections or []),
                "strengths": feedback.strengths,
                "improvements": feedback.improvements,
            }
        feedback.score_percentage = data["score_percentage"]
        if data.get("overall_feedback") is not None:
            feedback.overall_feedback = data["overall_feedback"]
        if data.get("strengths") is not None:
            feedback.strengths = data["strengths"]
        if data.get("improvements") is not None:
            feedback.improvements = data["improvements"]
        if data.get("instructor_comments") is not None:
            feedback.instructor_comments = data["instructor_comments"]
        feedback.graded_by = instructor_id
    else:
        feedback = SubmissionFeedback(
            submission_id=submission_id,
            overall_feedback=data.get("overall_feedback") or "Instructor graded submission.",
            step_by_step_corrections=data.get("step_by_step_corrections", []),
            score_percentage=data["score_percentage"],
            strengths=data.get("strengths"),
            improvements=data.get("improvements"),
            instructor_comments=data.get("instructor_comments"),
            graded_by=instructor_id,
        )
        db.add(feedback)

    db.commit()
    return get_submission_detail(db, instructor_id, submission_id)


# Phase 4: GD-92 — Velocity analytics

def get_velocity_analytics(
    db: Session,
    instructor_id: str,
    subject_id: int | None = None,
) -> dict:
    """Velocity analytics for instructor's subjects."""
    subject_ids = get_instructor_subject_ids(db, instructor_id)
    if subject_id is not None:
        subject_ids = [sid for sid in subject_ids if sid == subject_id]
    if not subject_ids:
        return {
            "class_avg_velocity": 0.0,
            "velocity_trend": [],
            "completion_distribution": [],
            "student_velocities": [],
        }

    # Total enrolled students and published assignments
    total_enrolled = (
        db.query(func.count(func.distinct(StudentEnrollment.student_id)))
        .filter(
            StudentEnrollment.subject_id.in_(subject_ids),
            StudentEnrollment.is_active == True,
        )
        .scalar()
        or 0
    )
    published_assignments = (
        db.query(Assignment)
        .filter(
            Assignment.instructor_id == instructor_id,
            Assignment.subject_id.in_(subject_ids),
            Assignment.is_published == True,
        )
        .all()
    )
    total_published = len(published_assignments)

    # Completion distribution: per assignment
    completion_distribution = []
    for a in published_assignments:
        submitted = (
            db.query(func.count(func.distinct(Submission.student_id)))
            .filter(Submission.assignment_id == a.assignment_id)
            .scalar()
            or 0
        )
        pct = round((submitted / total_enrolled) * 100, 1) if total_enrolled > 0 else 0.0
        completion_distribution.append({
            "assignment_title": a.title,
            "completion_percentage": pct,
            "submitted": submitted,
            "total": total_enrolled,
        })

    # Per-student velocity
    student_rows = (
        db.query(
            Submission.student_id,
            User.full_name.label("student_name"),
            func.count(Submission.submission_id).label("submission_count"),
            func.avg(
                case(
                    (Submission.score_percentage.isnot(None), Submission.score_percentage),
                    else_=None,
                )
            ).label("avg_score"),
        )
        .join(Assignment, Assignment.assignment_id == Submission.assignment_id)
        .join(User, User.user_id == Submission.student_id)
        .filter(
            Assignment.instructor_id == instructor_id,
            Assignment.subject_id.in_(subject_ids),
        )
        .group_by(Submission.student_id, User.full_name)
        .all()
    )

    student_velocities = []
    velocity_sum = 0.0
    for s in student_rows:
        count = s.submission_count or 0
        avg = round(float(s.avg_score), 1) if s.avg_score else 0.0
        completion_rate = round((count / total_published) * 100, 1) if total_published > 0 else 0.0
        # Velocity formula: normalized to 0-10
        velocity_score = round(
            (min(count, 10) * 0.4) + (avg / 100 * 10 * 0.4) + (min(completion_rate, 100) / 100 * 10 * 0.2),
            1,
        )
        velocity_sum += velocity_score
        student_velocities.append({
            "student_id": s.student_id,
            "student_name": s.student_name,
            "submission_count": count,
            "avg_score": avg,
            "velocity_score": velocity_score,
            "trend": "stable",
        })

    student_velocities.sort(key=lambda x: x["velocity_score"], reverse=True)
    class_avg_velocity = round(velocity_sum / len(student_velocities), 1) if student_velocities else 0.0

    return {
        "class_avg_velocity": class_avg_velocity,
        "velocity_trend": [],
        "completion_distribution": completion_distribution,
        "student_velocities": student_velocities,
    }


# Phase 4: GD-93 — At-risk students

def get_at_risk_students(
    db: Session,
    instructor_id: str,
    subject_id: int | None = None,
    page: int = 1,
    per_page: int = 20,
) -> tuple[list[dict], int]:
    """Identify at-risk students based on scores, missed assignments, inactivity."""
    subject_ids = get_instructor_subject_ids(db, instructor_id)
    if subject_id is not None:
        subject_ids = [sid for sid in subject_ids if sid == subject_id]
    if not subject_ids:
        return [], 0

    # Published assignment count
    published_count = (
        db.query(func.count(Assignment.assignment_id))
        .filter(
            Assignment.instructor_id == instructor_id,
            Assignment.subject_id.in_(subject_ids),
            Assignment.is_published == True,
        )
        .scalar()
        or 0
    )

    # Get all enrolled students
    enrolled = (
        db.query(
            User.user_id.label("student_id"),
            User.full_name,
            User.email,
        )
        .join(StudentEnrollment, StudentEnrollment.student_id == User.user_id)
        .filter(
            StudentEnrollment.subject_id.in_(subject_ids),
            StudentEnrollment.is_active == True,
        )
        .distinct()
        .all()
    )

    now = datetime.now(timezone.utc)
    at_risk = []

    for student in enrolled:
        # Stats for this student
        stats = (
            db.query(
                func.count(Submission.submission_id).label("total_submissions"),
                func.avg(
                    case(
                        (Submission.score_percentage.isnot(None), Submission.score_percentage),
                        else_=None,
                    )
                ).label("avg_score"),
                func.max(Submission.submitted_at).label("last_submission"),
            )
            .join(Assignment, Assignment.assignment_id == Submission.assignment_id)
            .filter(
                Submission.student_id == student.student_id,
                Assignment.instructor_id == instructor_id,
                Assignment.subject_id.in_(subject_ids),
            )
            .first()
        )

        total_subs = stats.total_submissions or 0
        avg_score = round(float(stats.avg_score), 1) if stats.avg_score else None
        last_sub = stats.last_submission
        missed = max(published_count - total_subs, 0)

        # Calculate risk score (0-100)
        risk_score = 0.0
        risk_factors = []

        # Factor 1: Low average score (<50% = high risk)
        if avg_score is not None and avg_score < 50:
            risk_score += 35
            risk_factors.append(f"Low avg score: {avg_score}%")
        elif avg_score is not None and avg_score < 70:
            risk_score += 15
            risk_factors.append(f"Below-average score: {avg_score}%")

        # Factor 2: Missed assignments
        if missed > 0 and published_count > 0:
            miss_ratio = missed / published_count
            risk_score += min(miss_ratio * 40, 40)
            risk_factors.append(f"{missed} missed assignment{'s' if missed > 1 else ''}")

        # Factor 3: Inactivity
        if last_sub:
            days_inactive = (now - last_sub).days
            if days_inactive > 14:
                risk_score += 25
                risk_factors.append(f"No submissions in {days_inactive} days")
            elif days_inactive > 7:
                risk_score += 10
                risk_factors.append(f"No submissions in {days_inactive} days")
        elif total_subs == 0 and published_count > 0:
            risk_score += 30
            risk_factors.append("No submissions at all")

        risk_score = min(round(risk_score, 1), 100.0)

        # Only include students with risk_score > 30%
        if risk_score > 30:
            # Subjects at risk
            subjects_at_risk = []
            for sid in subject_ids:
                sub_avg = (
                    db.query(func.avg(Submission.score_percentage))
                    .join(Assignment, Assignment.assignment_id == Submission.assignment_id)
                    .filter(
                        Submission.student_id == student.student_id,
                        Assignment.subject_id == sid,
                        Submission.score_percentage.isnot(None),
                    )
                    .scalar()
                )
                if sub_avg is not None and float(sub_avg) < 60:
                    subj = db.query(Subject.subject_name).filter(Subject.subject_id == sid).scalar()
                    if subj:
                        subjects_at_risk.append(subj)

            at_risk.append({
                "student_id": student.student_id,
                "full_name": student.full_name,
                "email": student.email,
                "risk_score": risk_score,
                "risk_factors": risk_factors,
                "subjects_at_risk": subjects_at_risk,
                "avg_score": avg_score,
                "total_submissions": total_subs,
                "missed_assignments": missed,
            })

    at_risk.sort(key=lambda x: x["risk_score"], reverse=True)
    total = len(at_risk)
    start = (page - 1) * per_page
    end = start + per_page

    return at_risk[start:end], total


# Phase 5: GD-94 — Concept heatmap

def get_concept_heatmap(
    db: Session,
    instructor_id: str,
    subject_id: int | None = None,
    timeframe: str = "all",
) -> dict:
    """Get concept heatmap from knowledge gaps (submissions and AI tutor chat) and heatmap entries.

    Chat-originated gaps use ``knowledge_gaps.history_id`` → :class:`ChatHistory` and may have
    no ``submission_id``; those rows are included via ``outerjoin`` on ``Submission``.
    :class:`ConceptHeatmapEntry` rows are updated from tutor chat via ``heatmap_service``.
    """
    subject_ids = get_instructor_subject_ids(db, instructor_id)
    if subject_id is not None:
        subject_ids = [sid for sid in subject_ids if sid == subject_id]
    if not subject_ids:
        return {"heatmap_entries": [], "emerging_friction": [], "teaching_insight": None}

    total_enrolled = (
        db.query(func.count(func.distinct(StudentEnrollment.student_id)))
        .filter(
            StudentEnrollment.subject_id.in_(subject_ids),
            StudentEnrollment.is_active == True,
        )
        .scalar()
        or 0
    )

    # Knowledge gaps from graded work (submission_id) and from AI tutor chat (history_id → chat_history)
    gap_query = (
        db.query(
            KnowledgeGap.topic_tag,
            KnowledgeGap.concept_name,
            Subject.subject_name,
            func.count(func.distinct(KnowledgeGap.student_id)).label("affected_count"),
            func.avg(
                case(
                    (Submission.score_percentage.isnot(None), Submission.score_percentage),
                    else_=None,
                )
            ).label("avg_score"),
        )
        .join(Subject, Subject.subject_id == KnowledgeGap.subject_id)
        .outerjoin(Submission, Submission.submission_id == KnowledgeGap.submission_id)
        .outerjoin(ChatHistory, ChatHistory.history_id == KnowledgeGap.history_id)
        .filter(KnowledgeGap.subject_id.in_(subject_ids))
    )

    if timeframe == "7d":
        cutoff = datetime.now(timezone.utc) - timedelta(days=7)
        gap_query = gap_query.filter(KnowledgeGap.detected_at >= cutoff)
    elif timeframe == "30d":
        cutoff = datetime.now(timezone.utc) - timedelta(days=30)
        gap_query = gap_query.filter(KnowledgeGap.detected_at >= cutoff)

    rows = (
        gap_query.group_by(
            KnowledgeGap.topic_tag,
            KnowledgeGap.concept_name,
            Subject.subject_name,
        )
        .order_by(desc(func.count(func.distinct(KnowledgeGap.student_id))))
        .all()
    )

    heatmap_entries = []
    for r in rows:
        struggle_pct = round((r.affected_count / total_enrolled) * 100, 1) if total_enrolled > 0 else 0.0
        avg = round(float(r.avg_score), 1) if r.avg_score else None
        heatmap_entries.append({
            "topic_tag": r.topic_tag,
            "concept_name": r.concept_name,
            "subject_name": r.subject_name,
            "struggle_percentage": struggle_pct,
            "affected_student_count": r.affected_count,
            "avg_score": avg,
            "severity_score": struggle_pct,
        })

    # Merge rows from concept_heatmap_entries (per-student rows; aggregate by topic/concept)
    ch_query = (
        db.query(
            ConceptHeatmapEntry.topic_tag,
            ConceptHeatmapEntry.concept_name,
            Subject.subject_name,
            func.count(func.distinct(ConceptHeatmapEntry.student_id)).label(
                "ch_affected_count"
            ),
        )
        .join(Subject, Subject.subject_id == ConceptHeatmapEntry.subject_id)
        .filter(
            ConceptHeatmapEntry.subject_id.in_(subject_ids),
            ConceptHeatmapEntry.student_id.isnot(None),
        )
    )
    if timeframe == "7d":
        cutoff_ch = datetime.now(timezone.utc) - timedelta(days=7)
        ch_query = ch_query.filter(ConceptHeatmapEntry.last_updated_at >= cutoff_ch)
    elif timeframe == "30d":
        cutoff_ch = datetime.now(timezone.utc) - timedelta(days=30)
        ch_query = ch_query.filter(ConceptHeatmapEntry.last_updated_at >= cutoff_ch)

    heatmap_agg_rows = (
        ch_query.group_by(
            ConceptHeatmapEntry.topic_tag,
            ConceptHeatmapEntry.concept_name,
            Subject.subject_name,
        )
        .order_by(desc(func.count(func.distinct(ConceptHeatmapEntry.student_id))))
        .all()
    )

    existing_tags = {e["topic_tag"] for e in heatmap_entries}
    for r in heatmap_agg_rows:
        if r.topic_tag not in existing_tags:
            affected = r.ch_affected_count or 0
            struggle_pct = round((affected / total_enrolled) * 100, 1) if total_enrolled > 0 else 0.0
            heatmap_entries.append({
                "topic_tag": r.topic_tag,
                "concept_name": r.concept_name,
                "subject_name": r.subject_name,
                "struggle_percentage": struggle_pct,
                "affected_student_count": affected,
                "avg_score": None,
                "severity_score": struggle_pct,
            })

    heatmap_entries.sort(key=lambda x: x["struggle_percentage"], reverse=True)

    # Emerging friction: top 3
    emerging_friction = [
        {"topic": e["topic_tag"], "subject": e["subject_name"], "percentage": e["struggle_percentage"]}
        for e in heatmap_entries[:3]
    ]

    # Teaching insight
    teaching_insight = None
    if heatmap_entries:
        top = heatmap_entries[0]
        teaching_insight = f"{top['struggle_percentage']}% of students struggle with {top['topic_tag']} in {top['subject_name']}"

    return {
        "heatmap_entries": heatmap_entries,
        "emerging_friction": emerging_friction,
        "teaching_insight": teaching_insight,
    }


# Phase 5: GD-95 — Knowledge base

UPLOAD_DIR = Path("uploads/documents")


def upload_document(
    db: Session,
    instructor_id: str,
    subject_id: int,
    file_name: str,
    file_bytes: bytes,
    doc_type: str,
) -> dict:
    """Upload a document to the knowledge base."""
    doc_id = uuid.uuid4()
    dir_path = UPLOAD_DIR / instructor_id / str(doc_id)
    dir_path.mkdir(parents=True, exist_ok=True)
    file_path = dir_path / file_name
    file_path.write_bytes(file_bytes)

    # Get grade_id from subject
    subject = db.query(Subject).filter(Subject.subject_id == subject_id).first()

    doc = CurriculumDocument(
        doc_id=doc_id,
        subject_id=subject_id,
        uploaded_by=instructor_id,
        file_name=file_name,
        file_path=str(file_path),
        file_size_bytes=len(file_bytes),
        doc_type=DocumentType(doc_type),
        embedding_status=EmbeddingStatus.PENDING,
    )
    db.add(doc)
    db.commit()
    db.refresh(doc)

    grade = db.query(Grade).filter(Grade.grade_id == subject.grade_id).first() if subject else None

    return {
        "doc_id": doc.doc_id,
        "subject_id": doc.subject_id,
        "subject_name": subject.subject_name if subject else None,
        "grade_name": grade.grade_name if grade else None,
        "file_name": doc.file_name,
        "file_size_bytes": doc.file_size_bytes,
        "doc_type": doc.doc_type.value,
        "created_at": doc.created_at,
    }


def set_document_embedding_status(
    db: Session,
    doc_id: uuid.UUID,
    status_value: EmbeddingStatus,
    chroma_collection_id: str | None = None,
) -> None:
    """Update embedding status metadata for a curriculum document."""
    doc = db.query(CurriculumDocument).filter(CurriculumDocument.doc_id == doc_id).first()
    if not doc:
        return

    doc.embedding_status = status_value
    if chroma_collection_id:
        doc.chroma_collection_id = chroma_collection_id
    if status_value == EmbeddingStatus.DONE:
        doc.embedded_at = datetime.now(timezone.utc)
    db.commit()


def get_knowledge_base_documents(
    db: Session,
    instructor_id: str,
    subject_id: int | None = None,
    doc_type: str | None = None,
    search: str | None = None,
    page: int = 1,
    per_page: int = 20,
) -> tuple[list[dict], int]:
    """List knowledge base documents uploaded by this instructor."""
    query = (
        db.query(CurriculumDocument, Subject.subject_name, Grade.grade_name)
        .join(Subject, Subject.subject_id == CurriculumDocument.subject_id)
        .join(Grade, Grade.grade_id == Subject.grade_id)
        .filter(CurriculumDocument.uploaded_by == instructor_id)
    )

    if subject_id is not None:
        query = query.filter(CurriculumDocument.subject_id == subject_id)
    if doc_type is not None:
        query = query.filter(CurriculumDocument.doc_type == doc_type)
    if search:
        query = query.filter(CurriculumDocument.file_name.ilike(f"%{search}%"))

    total = query.count()
    rows = (
        query.order_by(desc(CurriculumDocument.created_at))
        .offset((page - 1) * per_page)
        .limit(per_page)
        .all()
    )

    items = []
    for doc, subject_name, grade_name in rows:
        items.append({
            "doc_id": doc.doc_id,
            "subject_id": doc.subject_id,
            "subject_name": subject_name,
            "grade_name": grade_name,
            "file_name": doc.file_name,
            "file_size_bytes": doc.file_size_bytes,
            "doc_type": doc.doc_type.value,
            "created_at": doc.created_at,
        })

    return items, total


def delete_document(
    db: Session,
    instructor_id: str,
    doc_id: uuid.UUID,
) -> str | None:
    """Delete a document. Returns error string or None on success."""
    doc = (
        db.query(CurriculumDocument)
        .filter(
            CurriculumDocument.doc_id == doc_id,
            CurriculumDocument.uploaded_by == instructor_id,
        )
        .first()
    )
    if not doc:
        return "NOT_FOUND"

    # Remove file from disk
    try:
        file_path = Path(doc.file_path)
        if file_path.exists():
            file_path.unlink()
            # Remove parent dir if empty
            parent = file_path.parent
            if parent.exists() and not any(parent.iterdir()):
                parent.rmdir()
    except OSError:
        pass

    db.delete(doc)
    db.commit()
    return None


# Phase 5: GD-96 — Instructor profile

def get_instructor_profile(db: Session, instructor_id: str) -> dict:
    """Get instructor profile with assigned subjects."""
    user = db.query(User).filter(User.user_id == instructor_id).first()
    if not user:
        return None

    subjects = get_instructor_subjects(db, instructor_id)

    return {
        "user_id": user.user_id,
        "email": user.email,
        "full_name": user.full_name,
        "role": user.role.value,
        "is_active": user.is_active,
        "totp_enabled": user.totp_enabled,
        "profile_image_url": user.profile_image_url,
        "created_at": user.created_at,
        "subjects": subjects,
    }


def update_instructor_profile(db: Session, instructor_id: str, data: dict) -> dict:
    """Update instructor profile fields."""
    user = db.query(User).filter(User.user_id == instructor_id).first()
    if not user:
        return None

    if data.get("full_name") is not None:
        user.full_name = data["full_name"]
    if data.get("profile_image_url") is not None:
        user.profile_image_url = data["profile_image_url"]

    db.commit()
    db.refresh(user)
    return get_instructor_profile(db, instructor_id)
