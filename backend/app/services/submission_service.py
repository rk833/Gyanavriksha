"""
Submission service — handles assignment queries, submission CRUD, and file storage.
Sprint 3 Phase 3: GD-53, GD-54, GD-55
"""
import os
import uuid
from datetime import datetime, timezone

from fastapi import HTTPException, UploadFile, status
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.db.models.assignment import Assignment
from app.db.models.grade import Grade
from app.db.models.knowledge_gap import KnowledgeGap
from app.db.models.student_enrollment import StudentEnrollment
from app.db.models.submission import Submission
from app.db.models.submission_feedback import SubmissionFeedback
from app.db.models.subject import Subject
from app.db.models.user import User
from app.shared.source_enum import SubmissionProcessingStatus

UPLOAD_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), "uploads")
ALLOWED_EXTENSIONS = {".jpg", ".jpeg", ".png"}
MAX_FILE_SIZE = 10 * 1024 * 1024  # 10MB
MAX_FILES_PER_SUBMISSION = 5


def get_assignments_for_student(
    db: Session,
    user_id: uuid.UUID,
    subject_id: int | None = None,
    status_filter: str | None = None,
    page: int = 1,
    per_page: int = 20,
) -> tuple[list, int]:
    """Get published assignments for subjects the student is enrolled in."""
    # Get enrolled subject IDs
    enrolled = (
        db.query(StudentEnrollment.subject_id)
        .filter(
            StudentEnrollment.student_id == user_id,
            StudentEnrollment.is_active == True,
        )
        .all()
    )
    enrolled_ids = [r[0] for r in enrolled]

    if not enrolled_ids:
        return [], 0

    query = (
        db.query(Assignment, Subject, Grade, User)
        .join(Subject, Assignment.subject_id == Subject.subject_id)
        .join(Grade, Subject.grade_id == Grade.grade_id)
        .join(User, Assignment.instructor_id == User.user_id)
        .filter(
            Assignment.subject_id.in_(enrolled_ids),
            Assignment.is_published == True,
        )
    )

    if subject_id is not None:
        if subject_id not in enrolled_ids:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You are not enrolled in this subject",
            )
        query = query.filter(Assignment.subject_id == subject_id)

    now = datetime.now(timezone.utc)
    if status_filter == "open":
        query = query.filter((Assignment.due_date > now) | (Assignment.due_date.is_(None)))
    elif status_filter == "closed":
        query = query.filter(Assignment.due_date <= now)

    total = query.count()
    query = query.order_by(Assignment.due_date.asc().nullslast())
    assignments = query.offset((page - 1) * per_page).limit(per_page).all()

    # Check which assignments the student has submitted
    assignment_ids = [a.assignment_id for a, s, g, u in assignments]
    submitted_set = set()
    if assignment_ids:
        submitted = (
            db.query(Submission.assignment_id)
            .filter(
                Submission.student_id == user_id,
                Submission.assignment_id.in_(assignment_ids),
            )
            .all()
        )
        submitted_set = {r[0] for r in submitted}

    results = []
    for assignment, subject, grade, instructor in assignments:
        results.append({
            "assignment_id": assignment.assignment_id,
            "title": assignment.title,
            "description": assignment.description,
            "subject_id": subject.subject_id,
            "subject_name": subject.subject_name,
            "grade_name": grade.grade_name,
            "instructor_name": instructor.full_name,
            "topic_tags": assignment.topic_tags,
            "is_exam_mode": assignment.is_exam_mode,
            "due_date": assignment.due_date,
            "is_published": assignment.is_published,
            "has_submitted": assignment.assignment_id in submitted_set,
            "created_at": assignment.created_at,
        })

    return results, total


def get_assignment_detail(
    db: Session, user_id: uuid.UUID, assignment_id: uuid.UUID
) -> dict:
    """Get a single assignment with full details."""
    row = (
        db.query(Assignment, Subject, Grade, User)
        .join(Subject, Assignment.subject_id == Subject.subject_id)
        .join(Grade, Subject.grade_id == Grade.grade_id)
        .join(User, Assignment.instructor_id == User.user_id)
        .filter(Assignment.assignment_id == assignment_id)
        .first()
    )

    if not row:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Assignment not found",
        )

    assignment, subject, grade, instructor = row

    # Verify enrollment
    enrolled = (
        db.query(StudentEnrollment)
        .filter(
            StudentEnrollment.student_id == user_id,
            StudentEnrollment.subject_id == subject.subject_id,
            StudentEnrollment.is_active == True,
        )
        .first()
    )
    if not enrolled:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You are not enrolled in this subject",
        )

    # Check submission count for this student
    sub_count = (
        db.query(func.count(Submission.submission_id))
        .filter(
            Submission.student_id == user_id,
            Submission.assignment_id == assignment_id,
        )
        .scalar()
    )

    has_submitted = sub_count > 0

    return {
        "assignment_id": assignment.assignment_id,
        "title": assignment.title,
        "description": assignment.description,
        "subject_id": subject.subject_id,
        "subject_name": subject.subject_name,
        "grade_name": grade.grade_name,
        "instructor_name": instructor.full_name,
        "topic_tags": assignment.topic_tags,
        "is_exam_mode": assignment.is_exam_mode,
        "due_date": assignment.due_date,
        "is_published": assignment.is_published,
        "has_submitted": has_submitted,
        "created_at": assignment.created_at,
        "submission_count": sub_count,
    }


async def create_submission(
    db: Session,
    user_id: uuid.UUID,
    assignment_id: uuid.UUID,
    files: list[UploadFile],
) -> Submission:
    """Create a submission with uploaded image files."""
    # Validate file count
    if not files or len(files) == 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="At least one image file is required",
        )
    if len(files) > MAX_FILES_PER_SUBMISSION:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Maximum {MAX_FILES_PER_SUBMISSION} files per submission",
        )

    # Get assignment and verify it exists and is published
    assignment = (
        db.query(Assignment)
        .filter(Assignment.assignment_id == assignment_id)
        .first()
    )
    if not assignment:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Assignment not found",
        )
    if not assignment.is_published:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Assignment is not published",
        )

    # Verify enrollment
    enrolled = (
        db.query(StudentEnrollment)
        .filter(
            StudentEnrollment.student_id == user_id,
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

    # Validate files
    for f in files:
        ext = os.path.splitext(f.filename or "")[1].lower()
        if ext not in ALLOWED_EXTENSIONS:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"File '{f.filename}' is not a supported image format. Allowed: JPG, JPEG, PNG",
            )

    submission_id = uuid.uuid4()
    user_dir = os.path.join(UPLOAD_DIR, "submissions", str(user_id), str(submission_id))
    os.makedirs(user_dir, exist_ok=True)

    saved_paths = []
    for idx, f in enumerate(files, 1):
        # Read and check file size
        content = await f.read()
        if len(content) > MAX_FILE_SIZE:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"File '{f.filename}' exceeds maximum size of 10MB",
            )

        ext = os.path.splitext(f.filename or "")[1].lower()
        filename = f"img_{idx:03d}{ext}"
        filepath = os.path.join(user_dir, filename)

        with open(filepath, "wb") as out:
            out.write(content)

        # Store relative path
        rel_path = os.path.join("submissions", str(user_id), str(submission_id), filename)
        saved_paths.append(rel_path)

    # Create submission record (store all paths as comma-separated in image_path)
    submission = Submission(
        submission_id=submission_id,
        student_id=user_id,
        assignment_id=assignment_id,
        subject_id=assignment.subject_id,
        image_path=",".join(saved_paths),
        processing_status=SubmissionProcessingStatus.QUEUED,
        is_exam_submission=assignment.is_exam_mode,
    )
    db.add(submission)
    db.commit()
    db.refresh(submission)

    return submission


def get_submissions_for_student(
    db: Session,
    user_id: uuid.UUID,
    subject_id: int | None = None,
    status_filter: str | None = None,
    page: int = 1,
    per_page: int = 10,
) -> tuple[list, int]:
    """Get paginated submissions for a student."""
    query = (
        db.query(Submission, Assignment, Subject)
        .join(Assignment, Submission.assignment_id == Assignment.assignment_id)
        .join(Subject, Submission.subject_id == Subject.subject_id)
        .filter(Submission.student_id == user_id)
    )

    if subject_id is not None:
        query = query.filter(Submission.subject_id == subject_id)

    if status_filter:
        try:
            ps = SubmissionProcessingStatus(status_filter)
            query = query.filter(Submission.processing_status == ps)
        except ValueError:
            pass

    total = query.count()
    query = query.order_by(Submission.submitted_at.desc())
    rows = query.offset((page - 1) * per_page).limit(per_page).all()

    results = []
    for sub, assignment, subject in rows:
        results.append({
            "submission_id": sub.submission_id,
            "assignment_id": sub.assignment_id,
            "assignment_title": assignment.title,
            "subject_name": subject.subject_name,
            "submitted_at": sub.submitted_at,
            "processing_status": sub.processing_status,
            "grade_classification": sub.grade_classification,
            "score_percentage": sub.score_percentage,
        })

    return results, total


def get_submission_detail(
    db: Session, user_id: uuid.UUID, submission_id: uuid.UUID
) -> dict:
    """Get full submission detail with feedback and knowledge gaps."""
    row = (
        db.query(Submission, Assignment, Subject)
        .join(Assignment, Submission.assignment_id == Assignment.assignment_id)
        .join(Subject, Submission.subject_id == Subject.subject_id)
        .filter(Submission.submission_id == submission_id)
        .first()
    )

    if not row:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Submission not found",
        )

    sub, assignment, subject = row

    if sub.student_id != user_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You do not have access to this submission",
        )

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
            "failed_at_step": feedback.failed_at_step,
            "rag_chunks_used": feedback.rag_chunks_used,
            "llm_model_used": feedback.llm_model_used,
            "knowledge_gap_detected": feedback.knowledge_gap_detected,
            "created_at": feedback.created_at,
        }

    # Get knowledge gaps linked to this submission
    gaps = (
        db.query(KnowledgeGap)
        .filter(KnowledgeGap.submission_id == submission_id)
        .all()
    )
    gaps_data = [
        {
            "gap_id": g.gap_id,
            "concept_name": g.concept_name,
            "topic_tag": g.topic_tag,
        }
        for g in gaps
    ]

    return {
        "submission_id": sub.submission_id,
        "assignment_id": sub.assignment_id,
        "assignment_title": assignment.title,
        "subject_name": subject.subject_name,
        "submitted_at": sub.submitted_at,
        "processing_status": sub.processing_status,
        "grade_classification": sub.grade_classification,
        "score_percentage": sub.score_percentage,
        "image_path": sub.image_path,
        "image_quality_score": sub.image_quality_score,
        "is_exam_submission": sub.is_exam_submission,
        "feedback": feedback_data,
        "knowledge_gaps": gaps_data if gaps_data else None,
    }
