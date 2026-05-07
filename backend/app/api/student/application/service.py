"""Application-layer use cases for the student bounded context.

Use cases coordinate service calls, paginate results, build response objects,
and map domain exceptions to HTTPExceptions. No HTTP-specific concerns from
FastAPI bleed into this layer beyond the HTTPException type itself.
"""
import uuid

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.db.models.grade import Grade
from app.db.models.subject import Subject
from app.db.models.user import User
from app.schemas.assignment import AssignmentDetailResponse, AssignmentListItem
from app.schemas.common import PaginatedResponse
from app.schemas.library import CurriculumDocumentResponse
from app.schemas.notification import NotificationResponse, UnreadCountResponse
from app.schemas.progress import (
    DashboardResponse,
    KnowledgeGapResponse,
    KnowledgeGapSummary,
    KnowledgeGapSummary,
    StudentProgressResponse,
)
from app.schemas.quiz import MicroQuizSchema, QuizQuestionSchema
from app.schemas.submission import (
    SubmissionDetailResponse,
    SubmissionFeedbackResponse,
    SubmissionListItem,
)
from app.schemas.subject import EnrollmentResponse, SubjectResponse
from app.schemas.user import MessageResponse, UserResponse
from app.services import (
    library_service,
    notification_service,
    student_service,
    submission_service,
    quiz_service,
)


def _calculate_total_pages(total: int, per_page: int) -> int:
    """Return the number of pages required to hold all records at the given page size."""
    return (total + per_page - 1) // per_page if total else 0


def _slice_page(items: list, page: int, per_page: int) -> tuple[list, int]:
    """Slice a pre-fetched list to the requested page window and return (slice, total)."""
    total = len(items)
    start = (page - 1) * per_page
    return items[start : start + per_page], total


def _build_subject_response(
    subject: Subject, grade: "Grade | None"
) -> SubjectResponse:
    """Construct a SubjectResponse from ORM instances."""
    return SubjectResponse(
        subject_id=subject.subject_id,
        subject_name=subject.subject_name,
        subject_code=subject.subject_code,
        description=subject.description,
        grade_id=subject.grade_id,
        grade_name=grade.grade_name if grade else None,
        is_active=subject.is_active,
    )


def _build_enrollment_response(
    enrollment: object,
    subject: Subject,
    grade: Grade,
    completion: float,
) -> EnrollmentResponse:
    """Construct an EnrollmentResponse from ORM instances and computed completion."""
    return EnrollmentResponse(
        enrollment_id=enrollment.enrollment_id,
        student_id=enrollment.student_id,
        subject_id=subject.subject_id,
        subject_name=subject.subject_name,
        subject_code=subject.subject_code,
        grade_id=grade.grade_id,
        grade_name=grade.grade_name,
        enrolled_at=enrollment.enrolled_at,
        is_active=enrollment.is_active,
        completion_percentage=completion,
    )


def _fetch_subject_or_404(db: Session, subject_id: int) -> Subject:
    """Load a Subject by primary key or raise HTTP 404."""
    subject = db.query(Subject).filter(Subject.subject_id == subject_id).first()
    if not subject:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Subject not found",
        )
    return subject


def _build_paginated(
    schema_class: type,
    raw_items: list,
    total: int,
    page: int,
    per_page: int,
) -> PaginatedResponse:
    """Wrap a list of raw dicts into a typed PaginatedResponse."""
    return PaginatedResponse(
        items=[schema_class(**item) for item in raw_items],
        total=total,
        page=page,
        per_page=per_page,
        total_pages=_calculate_total_pages(total, per_page),
    )


def get_enrolled_subjects(
    db: Session, student_id: uuid.UUID
) -> list[SubjectResponse]:
    """Return all subjects the student is currently enrolled in."""
    enrollments = student_service.get_student_enrollments(db, student_id)
    return [
        _build_subject_response(subject, grade)
        for _, subject, grade in enrollments
    ]


def get_subject_detail(
    db: Session, student_id: uuid.UUID, subject_id: int
) -> SubjectResponse:
    """Return subject detail after verifying the student holds an active enrollment."""
    student_service.verify_student_enrollment(db, student_id, subject_id)
    subject = _fetch_subject_or_404(db, subject_id)
    grade = db.query(Grade).filter(Grade.grade_id == subject.grade_id).first()
    return _build_subject_response(subject, grade)


def list_enrollments(
    db: Session, student_id: uuid.UUID, page: int, per_page: int
) -> PaginatedResponse[EnrollmentResponse]:
    """Return a paginated list of enrollment records with computed completion percentages."""
    all_enrollments = student_service.get_student_enrollments(db, student_id)
    page_slice, total = _slice_page(all_enrollments, page, per_page)
    items = [
        _build_enrollment_response(
            enrollment,
            subject,
            grade,
            student_service.get_enrollment_completion(
                db, student_id, subject.subject_id
            ),
        )
        for enrollment, subject, grade in page_slice
    ]
    return PaginatedResponse(
        items=items,
        total=total,
        page=page,
        per_page=per_page,
        total_pages=_calculate_total_pages(total, per_page),
    )


def get_dashboard(
    db: Session, student_id: uuid.UUID
) -> DashboardResponse:
    """Return aggregated dashboard statistics for the student."""
    return DashboardResponse(
        **student_service.get_student_dashboard_data(db, student_id)
    )


def list_assignments(
    db: Session,
    student_id: uuid.UUID,
    subject_id: "int | None",
    status_filter: "str | None",
    page: int,
    per_page: int,
) -> PaginatedResponse[AssignmentListItem]:
    """Return paginated published assignments for subjects the student is enrolled in."""
    items, total = submission_service.get_assignments_for_student(
        db,
        student_id,
        subject_id=subject_id,
        status_filter=status_filter,
        page=page,
        per_page=per_page,
    )
    return _build_paginated(AssignmentListItem, items, total, page, per_page)


def get_assignment(
    db: Session, student_id: uuid.UUID, assignment_id: uuid.UUID
) -> AssignmentDetailResponse:
    """Return full assignment detail for the authenticated student."""
    return AssignmentDetailResponse(
        **submission_service.get_assignment_detail(db, student_id, assignment_id)
    )


async def create_submission(
    db: Session,
    student_id: uuid.UUID,
    assignment_id: uuid.UUID,
    files: list,
) -> SubmissionListItem:
    """Upload handwritten work images and return a submission list-item view."""
    sub = await submission_service.create_submission(
        db, student_id, assignment_id, files
    )
    return SubmissionListItem(
        submission_id=sub.submission_id,
        assignment_id=sub.assignment_id,
        submitted_at=sub.submitted_at,
        processing_status=sub.processing_status,
        grade_classification=sub.grade_classification,
        score_percentage=sub.score_percentage,
    )


def list_submissions(
    db: Session,
    student_id: uuid.UUID,
    subject_id: "int | None",
    status_filter: "str | None",
    page: int,
    per_page: int,
) -> PaginatedResponse[SubmissionListItem]:
    """Return paginated submission records for the student with optional filters."""
    items, total = submission_service.get_submissions_for_student(
        db,
        student_id,
        subject_id=subject_id,
        status_filter=status_filter,
        page=page,
        per_page=per_page,
    )
    return _build_paginated(SubmissionListItem, items, total, page, per_page)


def get_submission(
    db: Session, student_id: uuid.UUID, submission_id: uuid.UUID
) -> SubmissionDetailResponse:
    """Return full submission detail including feedback and knowledge gap data."""
    return SubmissionDetailResponse(
        **submission_service.get_submission_detail(db, student_id, submission_id)
    )


def get_submission_feedback(
    db: Session, student_id: uuid.UUID, submission_id: uuid.UUID
) -> SubmissionFeedbackResponse:
    """Return the AI-generated feedback for a submission, raising HTTP 404 when absent."""
    detail = submission_service.get_submission_detail(db, student_id, submission_id)
    _assert_feedback_present(detail)
    return SubmissionFeedbackResponse(**detail["feedback"])


def _assert_feedback_present(detail: dict) -> None:
    """Raise HTTP 404 when the submission's feedback field is absent or empty."""
    if not detail.get("feedback"):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=(
                "Feedback not available yet. "
                "Submission may still be processing."
            ),
        )


def list_knowledge_gaps(
    db: Session,
    student_id: uuid.UUID,
    subject_id: "int | None",
    resolved: "bool | None",
    page: int,
    per_page: int,
) -> PaginatedResponse[KnowledgeGapResponse]:
    """Return paginated knowledge-gap records detected for the student."""
    items, total = student_service.get_knowledge_gaps(
        db,
        student_id,
        subject_id=subject_id,
        is_resolved=resolved,
        page=page,
        per_page=per_page,
    )
    return _build_paginated(KnowledgeGapResponse, items, total, page, per_page)


def get_knowledge_gap_summary(
    db: Session, student_id: uuid.UUID
) -> KnowledgeGapSummary:
    """Return aggregated counts for resolved and pending knowledge gaps."""
    return KnowledgeGapSummary(
        **student_service.get_knowledge_gap_summary(db, student_id)
    )


def get_progress(
    db: Session, student_id: uuid.UUID, period: str
) -> StudentProgressResponse:
    """Return student progress data for the specified time period."""
    return StudentProgressResponse(
        **student_service.get_student_progress(db, student_id, period=period)
    )


def list_notifications(
    db: Session,
    student_id: uuid.UUID,
    type_filter: "str | None",
    is_read: "bool | None",
    page: int,
    per_page: int,
) -> PaginatedResponse[NotificationResponse]:
    """Return paginated notifications for the student with optional type and read filters."""
    items, total, _ = notification_service.get_notifications(
        db,
        student_id,
        type_filter=type_filter,
        is_read=is_read,
        page=page,
        per_page=per_page,
    )
    return PaginatedResponse(
        items=[NotificationResponse.model_validate(n) for n in items],
        total=total,
        page=page,
        per_page=per_page,
        total_pages=_calculate_total_pages(total, per_page),
    )


def get_unread_notification_count(
    db: Session, student_id: uuid.UUID
) -> UnreadCountResponse:
    """Return the count of unread notifications for the student."""
    return UnreadCountResponse(
        count=notification_service.get_unread_count(db, student_id)
    )


def mark_notification_read(
    db: Session, student_id: uuid.UUID, notification_id: uuid.UUID
) -> NotificationResponse:
    """Mark a single notification as read and return the updated record."""
    notification = notification_service.mark_as_read(
        db, student_id, notification_id
    )
    if not notification:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Notification not found",
        )
    return NotificationResponse.model_validate(notification)


def mark_all_notifications_read(
    db: Session, student_id: uuid.UUID
) -> MessageResponse:
    """Mark all unread notifications as read and return the count in a message."""
    count = notification_service.mark_all_as_read(db, student_id)
    return MessageResponse(message=f"Marked {count} notifications as read")


def get_profile(user: User) -> UserResponse:
    """Return the student's own profile as a UserResponse."""
    return UserResponse.model_validate(user)


def update_profile(
    db: Session,
    user: User,
    full_name: "str | None",
    profile_image_url: "str | None",
) -> UserResponse:
    """Apply non-None field updates to the student's profile and persist the changes."""
    _apply_profile_updates(user, full_name, profile_image_url)
    _persist_user(db, user)
    return UserResponse.model_validate(user)


def _apply_profile_updates(
    user: User,
    full_name: "str | None",
    profile_image_url: "str | None",
) -> None:
    """Mutate the user entity for each provided non-None field."""
    if full_name is not None:
        user.full_name = full_name
    if profile_image_url is not None:
        user.profile_image_url = profile_image_url


def _persist_user(db: Session, user: User) -> None:
    """Commit and refresh the user record within the current database session."""
    db.commit()
    db.refresh(user)


def list_library_documents(
    db: Session,
    student_id: uuid.UUID,
    subject_id: "int | None",
    doc_type: "str | None",
    search: "str | None",
    page: int,
    per_page: int,
) -> PaginatedResponse[CurriculumDocumentResponse]:
    """Return paginated curriculum documents for subjects the student is enrolled in."""
    items, total = library_service.get_library_documents(
        db,
        student_id,
        subject_id=subject_id,
        doc_type=doc_type,
        search=search,
        page=page,
        per_page=per_page,
    )
    return _build_paginated(
        CurriculumDocumentResponse, items, total, page, per_page
    )


def get_library_document(
    db: Session, student_id: uuid.UUID, doc_id: uuid.UUID
) -> CurriculumDocumentResponse:
    """Return detail for a single curriculum document accessible to the student."""
    return CurriculumDocumentResponse(
        **library_service.get_document_detail(db, student_id, doc_id)
    )


async def generate_quiz(
    db: Session, student_id: uuid.UUID, subject_id: int, concept: str, num_questions: int = 5
) -> MicroQuizSchema:
    """Trigger AI quiz generation and save to DB."""
    quiz = await quiz_service.generate_and_save_quiz(
        db, student_id, subject_id, concept, num_questions
    )
    return MicroQuizSchema.from_orm(quiz)


def list_quizzes(
    db: Session,
    student_id: uuid.UUID,
    subject_id: int | None,
    page: int,
    per_page: int,
) -> PaginatedResponse[MicroQuizSchema]:
    """Return paginated micro-quizzes for the student."""
    items, total = quiz_service.get_quizzes_for_student(
        db, student_id, subject_id=subject_id, page=page, per_page=per_page
    )
    return PaginatedResponse(
        items=[MicroQuizSchema.from_orm(q) for q in items],
        total=total,
        page=page,
        per_page=per_page,
        total_pages=_calculate_total_pages(total, per_page),
    )


def get_quiz_detail(
    db: Session, student_id: uuid.UUID, quiz_id: uuid.UUID
) -> MicroQuizSchema:
    """Return full detail for a specific quiz, including questions."""
    quiz = quiz_service.get_quiz_detail(db, student_id, quiz_id)
    if not quiz:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Quiz not found",
        )
    return MicroQuizSchema.from_orm(quiz)
