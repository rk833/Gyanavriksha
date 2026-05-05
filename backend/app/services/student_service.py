import uuid
from datetime import datetime, timezone

from fastapi import HTTPException, status
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.db.models.assignment import Assignment
from app.db.models.grade import Grade
from app.db.models.knowledge_gap import KnowledgeGap
from app.db.models.micro_quiz import MicroQuiz
from app.db.models.notification import Notification
from app.db.models.student_enrollment import StudentEnrollment
from app.db.models.student_progress import StudentProgress
from app.db.models.submission import Submission
from app.db.models.subject import Subject
from app.db.models.user import User
from app.shared.source_enum import MicroQuizStatus, PeriodType


def get_student_enrollments(db: Session, user_id: uuid.UUID):
    """Get all active enrollments for a student with subject and grade info."""
    enrollments = (
        db.query(StudentEnrollment, Subject, Grade)
        .join(Subject, StudentEnrollment.subject_id == Subject.subject_id)
        .join(Grade, StudentEnrollment.grade_id == Grade.grade_id)
        .filter(
            StudentEnrollment.student_id == user_id,
            StudentEnrollment.is_active == True,
        )
        .all()
    )
    return enrollments


def verify_student_enrollment(
    db: Session, user_id: uuid.UUID, subject_id: int
) -> StudentEnrollment:
    """Verify student is enrolled in a subject. Raises 403 if not."""
    enrollment = (
        db.query(StudentEnrollment)
        .filter(
            StudentEnrollment.student_id == user_id,
            StudentEnrollment.subject_id == subject_id,
            StudentEnrollment.is_active == True,
        )
        .first()
    )
    if not enrollment:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You are not enrolled in this subject",
        )
    return enrollment


def get_enrolled_subject_ids(db: Session, user_id: uuid.UUID) -> list[int]:
    """Get list of subject IDs the student is enrolled in."""
    rows = (
        db.query(StudentEnrollment.subject_id)
        .filter(
            StudentEnrollment.student_id == user_id,
            StudentEnrollment.is_active == True,
        )
        .all()
    )
    return [r[0] for r in rows]


def get_enrollment_completion(
    db: Session, user_id: uuid.UUID, subject_id: int
) -> float:
    """Calculate completion percentage for a subject enrollment."""
    total_assignments = (
        db.query(func.count(Assignment.assignment_id))
        .filter(
            Assignment.subject_id == subject_id,
            Assignment.is_published == True,
        )
        .scalar()
    )
    if not total_assignments:
        return 0.0

    graded_submissions = (
        db.query(func.count(Submission.submission_id))
        .filter(
            Submission.student_id == user_id,
            Submission.subject_id == subject_id,
            Submission.processing_status == "done",
        )
        .scalar()
    )
    return round((graded_submissions / total_assignments) * 100, 1)


def get_student_dashboard_data(db: Session, user_id: uuid.UUID) -> dict:
    """Aggregate all dashboard data for a student."""
    user = db.query(User).filter(User.user_id == user_id).first()

    enrollments = get_student_enrollments(db, user_id)

    enrolled_subjects = []
    for enrollment, subject, grade in enrollments:
        completion = get_enrollment_completion(db, user_id, subject.subject_id)
        enrolled_subjects.append({
            "subject_id": subject.subject_id,
            "subject_name": subject.subject_name,
            "grade_name": grade.grade_name,
            "completion_percentage": completion,
        })

    # Current subject (most recently enrolled or first)
    current_subject = enrolled_subjects[0] if enrolled_subjects else None

    enrolled_subject_ids = [s["subject_id"] for s in enrolled_subjects]

    # Total submissions
    total_submissions = (
        db.query(func.count(Submission.submission_id))
        .filter(Submission.student_id == user_id)
        .scalar()
    )

    # Average score
    average_score = (
        db.query(func.avg(Submission.score_percentage))
        .filter(
            Submission.student_id == user_id,
            Submission.score_percentage.isnot(None),
        )
        .scalar()
    )

    # Recent submissions (last 5)
    recent_subs = (
        db.query(Submission, Assignment)
        .join(Assignment, Submission.assignment_id == Assignment.assignment_id)
        .filter(Submission.student_id == user_id)
        .order_by(Submission.submitted_at.desc())
        .limit(5)
        .all()
    )
    recent_submissions = [
        {
            "submission_id": str(sub.submission_id),
            "assignment_title": assignment.title,
            "processing_status": sub.processing_status.value if sub.processing_status else None,
            "score_percentage": sub.score_percentage,
            "submitted_at": sub.submitted_at.isoformat() if sub.submitted_at else None,
        }
        for sub, assignment in recent_subs
    ]

    # Knowledge gaps count (unresolved)
    knowledge_gaps_count = (
        db.query(func.count(KnowledgeGap.gap_id))
        .filter(
            KnowledgeGap.student_id == user_id,
            KnowledgeGap.is_resolved == False,
        )
        .scalar()
    )

    # Upcoming assignments
    now = datetime.now(timezone.utc)
    upcoming = (
        db.query(Assignment, Subject)
        .join(Subject, Assignment.subject_id == Subject.subject_id)
        .filter(
            Assignment.subject_id.in_(enrolled_subject_ids) if enrolled_subject_ids else False,
            Assignment.is_published == True,
            Assignment.due_date > now,
        )
        .order_by(Assignment.due_date.asc())
        .limit(5)
        .all()
    )
    upcoming_assignments = [
        {
            "assignment_id": str(a.assignment_id),
            "title": a.title,
            "subject_name": s.subject_name,
            "due_date": a.due_date.isoformat() if a.due_date else None,
        }
        for a, s in upcoming
    ]

    # Unread notifications
    notifications_unread = (
        db.query(func.count(Notification.notification_id))
        .filter(
            Notification.recipient_id == user_id,
            Notification.is_read == False,
        )
        .scalar()
    )

    return {
        "student_name": user.full_name if user else "Student",
        "current_subject": current_subject,
        "enrolled_subjects": enrolled_subjects,
        "recent_submissions": recent_submissions,
        "total_submissions": total_submissions or 0,
        "average_score": round(average_score, 1) if average_score else None,
        "knowledge_gaps_count": knowledge_gaps_count or 0,
        "upcoming_assignments": upcoming_assignments,
        "notifications_unread_count": notifications_unread or 0,
    }


def count_unread_notifications(db: Session, user_id: uuid.UUID) -> int:
    """Count unread notifications for a user."""
    return (
        db.query(func.count(Notification.notification_id))
        .filter(
            Notification.recipient_id == user_id,
            Notification.is_read == False,
        )
        .scalar()
    ) or 0


# GD-57: Knowledge gap queries

def get_knowledge_gaps(
    db: Session,
    user_id: uuid.UUID,
    subject_id: int | None = None,
    is_resolved: bool | None = None,
    page: int = 1,
    per_page: int = 20,
) -> tuple[list, int]:
    """Get knowledge gaps for a student with optional filters."""
    query = (
        db.query(KnowledgeGap, Subject)
        .join(Subject, KnowledgeGap.subject_id == Subject.subject_id)
        .filter(KnowledgeGap.student_id == user_id)
    )

    if subject_id is not None:
        query = query.filter(KnowledgeGap.subject_id == subject_id)
    if is_resolved is not None:
        query = query.filter(KnowledgeGap.is_resolved == is_resolved)

    total = query.count()
    query = query.order_by(KnowledgeGap.detected_at.desc())
    rows = query.offset((page - 1) * per_page).limit(per_page).all()

    results = []
    for gap, subject in rows:
        mq = (
            db.query(MicroQuiz)
            .filter(
                MicroQuiz.gap_id == gap.gap_id,
                MicroQuiz.student_id == user_id,
            )
            .order_by(MicroQuiz.created_at.desc())
            .first()
        )
        results.append({
            "gap_id": gap.gap_id,
            "concept_name": gap.concept_name,
            "topic_tag": gap.topic_tag,
            "recurrence_count": gap.recurrence_count,
            "is_resolved": gap.is_resolved,
            "detected_at": gap.detected_at,
            "subject_id": subject.subject_id,
            "subject_name": subject.subject_name,
            "quiz_id": mq.quiz_id if mq else None,
            "quiz_status": mq.status.value if mq else None,
        })

    return results, total


def get_knowledge_gap_summary(db: Session, user_id: uuid.UUID) -> dict:
    """Get summary counts for knowledge gaps."""
    total = (
        db.query(func.count(KnowledgeGap.gap_id))
        .filter(KnowledgeGap.student_id == user_id)
        .scalar()
    ) or 0

    resolved = (
        db.query(func.count(KnowledgeGap.gap_id))
        .filter(
            KnowledgeGap.student_id == user_id,
            KnowledgeGap.is_resolved == True,
        )
        .scalar()
    ) or 0

    return {
        "total_gaps": total,
        "gaps_resolved": resolved,
        "gaps_pending": total - resolved,
    }


# GD-58: Progress queries

def get_student_progress(
    db: Session,
    user_id: uuid.UUID,
    period: str = "weekly",
) -> dict:
    """Get student progress data for charts and analytics."""
    # Determine period type
    period_type = PeriodType.WEEKLY if period == "weekly" else PeriodType.MONTHLY

    # Overall average score
    avg_score = (
        db.query(func.avg(Submission.score_percentage))
        .filter(
            Submission.student_id == user_id,
            Submission.score_percentage.isnot(None),
        )
        .scalar()
    )

    # Score progression from student_progress table
    progress_rows = (
        db.query(StudentProgress, Subject)
        .join(Subject, StudentProgress.subject_id == Subject.subject_id)
        .filter(
            StudentProgress.student_id == user_id,
            StudentProgress.period_type == period_type,
        )
        .order_by(StudentProgress.period_start.asc())
        .all()
    )

    score_progression = []
    for prog, subject in progress_rows:
        label = prog.period_start.strftime("%b W%U") if period == "weekly" else prog.period_start.strftime("%b %Y")
        score_progression.append({
            "period": label,
            "score": round(prog.avg_score, 1) if prog.avg_score else 0.0,
            "subject": subject.subject_name,
        })

    # Topic difficulty from knowledge gaps (higher recurrence = harder)
    topic_rows = (
        db.query(
            KnowledgeGap.topic_tag,
            func.avg(KnowledgeGap.recurrence_count).label("avg_recurrence"),
        )
        .filter(KnowledgeGap.student_id == user_id)
        .group_by(KnowledgeGap.topic_tag)
        .order_by(func.avg(KnowledgeGap.recurrence_count).desc())
        .limit(10)
        .all()
    )

    topic_difficulty = [
        {"topic": row.topic_tag, "difficulty_score": round(float(row.avg_recurrence) / 5.0, 2)}
        for row in topic_rows
    ]

    # Quizzes completed
    quizzes_completed = (
        db.query(func.count(MicroQuiz.quiz_id))
        .filter(
            MicroQuiz.student_id == user_id,
            MicroQuiz.status == MicroQuizStatus.COMPLETED,
        )
        .scalar()
    ) or 0

    # At-risk flag (check latest progress records)
    at_risk = (
        db.query(StudentProgress)
        .filter(
            StudentProgress.student_id == user_id,
            StudentProgress.is_at_risk == True,
        )
        .first()
    )

    # Trend: compare last two periods
    trend_percentage = None
    if len(score_progression) >= 2:
        recent = score_progression[-1]["score"]
        previous = score_progression[-2]["score"]
        if previous > 0:
            trend_percentage = round(((recent - previous) / previous) * 100, 1)

    recent_gap_rows = (
        db.query(KnowledgeGap, Subject)
        .join(Subject, KnowledgeGap.subject_id == Subject.subject_id)
        .filter(KnowledgeGap.student_id == user_id)
        .order_by(KnowledgeGap.detected_at.desc())
        .limit(10)
        .all()
    )

    recent_knowledge_gaps: list[dict] = []
    for gap, subject in recent_gap_rows:
        mq = (
            db.query(MicroQuiz)
            .filter(
                MicroQuiz.gap_id == gap.gap_id,
                MicroQuiz.student_id == user_id,
            )
            .order_by(MicroQuiz.created_at.desc())
            .first()
        )
        recent_knowledge_gaps.append({
            "gap_id": gap.gap_id,
            "concept_name": gap.concept_name,
            "topic_tag": gap.topic_tag,
            "subject_id": gap.subject_id,
            "subject_name": subject.subject_name,
            "is_resolved": gap.is_resolved,
            "recurrence_count": gap.recurrence_count,
            "detected_at": gap.detected_at,
            "quiz_id": mq.quiz_id if mq else None,
            "quiz_status": mq.status.value if mq else None,
        })

    improvement_tips: list[str] = []
    for gap, subject in recent_gap_rows:
        if gap.is_resolved:
            continue
        if len(improvement_tips) >= 5:
            break
        improvement_tips.append(
            f'Strengthen "{gap.concept_name}" in {subject.subject_name}. '
            "Use Micro Quiz for targeted practice when a quiz is linked to this gap."
        )

    return {
        "average_score": round(avg_score, 1) if avg_score else None,
        "trend_percentage": trend_percentage,
        "quizzes_completed": quizzes_completed,
        "active_streak": 0,  # calculated from daily login tracking (future)
        "score_progression": score_progression,
        "topic_difficulty": topic_difficulty,
        "at_risk_flag": at_risk is not None,
        "improvement_tips": improvement_tips,
        "recent_knowledge_gaps": recent_knowledge_gaps,
    }
