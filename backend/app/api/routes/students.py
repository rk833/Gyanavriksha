"""
Student API routes — full student workspace.
Sprint 3 Phases 2-5: GD-50 to GD-61
"""
import uuid

from fastapi import APIRouter, Body, Depends, HTTPException, Query, Request, UploadFile, File, status
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.api.middleware.auth_middleware import get_current_user, require_role
from app.api.middleware.rate_limiter import limiter
from app.core.database import get_db
from app.db.models.grade import Grade
from app.db.models.student_enrollment import StudentEnrollment
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
    StudentProgressResponse,
)
from app.schemas.submission import SubmissionDetailResponse, SubmissionFeedbackResponse, SubmissionListItem
from app.schemas.subject import EnrollmentResponse, SubjectResponse
from app.schemas.user import MessageResponse, UserResponse
from app.services import student_service, submission_service, notification_service, library_service
from app.shared.source_enum import UserRole

router = APIRouter(prefix="/api/students", tags=["Student"])


# GD-50: Subject list & detail endpoints

@router.get("/subjects", response_model=list[SubjectResponse])
def list_enrolled_subjects(
    current_user: User = Depends(require_role([UserRole.STUDENT])),
    db: Session = Depends(get_db),
):
    """List all subjects the current student is enrolled in."""
    enrollments = student_service.get_student_enrollments(db, current_user.user_id)

    subjects = []
    for enrollment, subject, grade in enrollments:
        subjects.append(
            SubjectResponse(
                subject_id=subject.subject_id,
                subject_name=subject.subject_name,
                subject_code=subject.subject_code,
                description=subject.description,
                grade_id=subject.grade_id,
                grade_name=grade.grade_name,
                is_active=subject.is_active,
            )
        )
    return subjects


@router.get("/subjects/{subject_id}", response_model=SubjectResponse)
def get_subject_detail(
    subject_id: int,
    current_user: User = Depends(require_role([UserRole.STUDENT])),
    db: Session = Depends(get_db),
):
    """Get detail of a specific subject the student is enrolled in."""
    # Verify student is enrolled
    student_service.verify_student_enrollment(db, current_user.user_id, subject_id)

    subject = db.query(Subject).filter(Subject.subject_id == subject_id).first()
    if not subject:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Subject not found",
        )

    grade = db.query(Grade).filter(Grade.grade_id == subject.grade_id).first()

    return SubjectResponse(
        subject_id=subject.subject_id,
        subject_name=subject.subject_name,
        subject_code=subject.subject_code,
        description=subject.description,
        grade_id=subject.grade_id,
        grade_name=grade.grade_name if grade else None,
        is_active=subject.is_active,
    )


# GD-51: Enrollment info endpoint

@router.get("/enrollments", response_model=PaginatedResponse[EnrollmentResponse])
def list_enrollments(
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=100),
    current_user: User = Depends(require_role([UserRole.STUDENT])),
    db: Session = Depends(get_db),
):
    """List all enrollments for the current student with completion percentage."""
    enrollments = student_service.get_student_enrollments(db, current_user.user_id)

    total = len(enrollments)
    start = (page - 1) * per_page
    end = start + per_page
    page_slice = enrollments[start:end]

    items = []
    for enrollment, subject, grade in page_slice:
        completion = student_service.get_enrollment_completion(
            db, current_user.user_id, subject.subject_id
        )
        items.append(
            EnrollmentResponse(
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
        )

    total_pages = (total + per_page - 1) // per_page if total else 0

    return PaginatedResponse(
        items=items,
        total=total,
        page=page,
        per_page=per_page,
        total_pages=total_pages,
    )


# GD-52: Student dashboard stats endpoint

@router.get("/dashboard", response_model=DashboardResponse)
def get_dashboard(
    current_user: User = Depends(require_role([UserRole.STUDENT])),
    db: Session = Depends(get_db),
):
    """Aggregate all dashboard data for the current student."""
    data = student_service.get_student_dashboard_data(db, current_user.user_id)
    return DashboardResponse(**data)


# GD-53: Assignment list & detail endpoints

@router.get("/assignments", response_model=PaginatedResponse[AssignmentListItem])
def list_assignments(
    subject_id: int | None = Query(None),
    status: str | None = Query(None, pattern="^(open|closed|all)$"),
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=100),
    current_user: User = Depends(require_role([UserRole.STUDENT])),
    db: Session = Depends(get_db),
):
    """List published assignments for subjects the student is enrolled in."""
    items, total = submission_service.get_assignments_for_student(
        db, current_user.user_id,
        subject_id=subject_id,
        status_filter=status if status != "all" else None,
        page=page,
        per_page=per_page,
    )
    total_pages = (total + per_page - 1) // per_page if total else 0
    return PaginatedResponse(
        items=[AssignmentListItem(**a) for a in items],
        total=total,
        page=page,
        per_page=per_page,
        total_pages=total_pages,
    )


@router.get("/assignments/{assignment_id}", response_model=AssignmentDetailResponse)
def get_assignment(
    assignment_id: uuid.UUID,
    current_user: User = Depends(require_role([UserRole.STUDENT])),
    db: Session = Depends(get_db),
):
    """Get a single assignment with full details."""
    data = submission_service.get_assignment_detail(db, current_user.user_id, assignment_id)
    return AssignmentDetailResponse(**data)


# GD-54: Submission upload endpoint

@router.post("/submissions", response_model=SubmissionListItem, status_code=201)
@limiter.limit("3/minute")
async def upload_submission(
    request: Request,
    assignment_id: uuid.UUID = Query(...),
    files: list[UploadFile] = File(...),
    current_user: User = Depends(require_role([UserRole.STUDENT])),
    db: Session = Depends(get_db),
):
    """Upload a new submission with handwritten work images."""
    sub = await submission_service.create_submission(
        db, current_user.user_id, assignment_id, files
    )
    return SubmissionListItem(
        submission_id=sub.submission_id,
        assignment_id=sub.assignment_id,
        submitted_at=sub.submitted_at,
        processing_status=sub.processing_status,
        grade_classification=sub.grade_classification,
        score_percentage=sub.score_percentage,
    )


# GD-55: Submission list & detail endpoints

@router.get("/submissions", response_model=PaginatedResponse[SubmissionListItem])
def list_submissions(
    subject_id: int | None = Query(None),
    status: str | None = Query(None),
    page: int = Query(1, ge=1),
    per_page: int = Query(10, ge=1, le=100),
    current_user: User = Depends(require_role([UserRole.STUDENT])),
    db: Session = Depends(get_db),
):
    """List the current student's submissions with pagination and filters."""
    items, total = submission_service.get_submissions_for_student(
        db, current_user.user_id,
        subject_id=subject_id,
        status_filter=status,
        page=page,
        per_page=per_page,
    )
    total_pages = (total + per_page - 1) // per_page if total else 0
    return PaginatedResponse(
        items=[SubmissionListItem(**s) for s in items],
        total=total,
        page=page,
        per_page=per_page,
        total_pages=total_pages,
    )


@router.get("/submissions/{submission_id}", response_model=SubmissionDetailResponse)
def get_submission(
    submission_id: uuid.UUID,
    current_user: User = Depends(require_role([UserRole.STUDENT])),
    db: Session = Depends(get_db),
):
    """Get full submission detail with feedback and knowledge gaps."""
    data = submission_service.get_submission_detail(db, current_user.user_id, submission_id)
    return SubmissionDetailResponse(**data)


# GD-56: Submission feedback endpoint

@router.get(
    "/submissions/{submission_id}/feedback",
    response_model=SubmissionFeedbackResponse,
)
def get_submission_feedback(
    submission_id: uuid.UUID,
    current_user: User = Depends(require_role([UserRole.STUDENT])),
    db: Session = Depends(get_db),
):
    """Get AI-generated grading feedback for a submission."""
    detail = submission_service.get_submission_detail(db, current_user.user_id, submission_id)
    if not detail.get("feedback"):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Feedback not available yet. Submission may still be processing.",
        )
    return SubmissionFeedbackResponse(**detail["feedback"])


# GD-57: Knowledge gap endpoints

@router.get("/knowledge-gaps", response_model=PaginatedResponse[KnowledgeGapResponse])
def list_knowledge_gaps(
    subject_id: int | None = Query(None),
    resolved: bool | None = Query(None),
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=100),
    current_user: User = Depends(require_role([UserRole.STUDENT])),
    db: Session = Depends(get_db),
):
    """List knowledge gaps for the current student."""
    items, total = student_service.get_knowledge_gaps(
        db, current_user.user_id,
        subject_id=subject_id,
        is_resolved=resolved,
        page=page,
        per_page=per_page,
    )
    total_pages = (total + per_page - 1) // per_page if total else 0
    return PaginatedResponse(
        items=[KnowledgeGapResponse(**g) for g in items],
        total=total,
        page=page,
        per_page=per_page,
        total_pages=total_pages,
    )


@router.get("/knowledge-gaps/summary", response_model=KnowledgeGapSummary)
def get_knowledge_gap_summary(
    current_user: User = Depends(require_role([UserRole.STUDENT])),
    db: Session = Depends(get_db),
):
    """Get summary counts for knowledge gaps."""
    data = student_service.get_knowledge_gap_summary(db, current_user.user_id)
    return KnowledgeGapSummary(**data)


# GD-58: Student progress endpoints

@router.get("/progress", response_model=StudentProgressResponse)
def get_progress(
    period: str = Query("weekly", pattern="^(weekly|monthly)$"),
    current_user: User = Depends(require_role([UserRole.STUDENT])),
    db: Session = Depends(get_db),
):
    """Get student progress data for charts and analytics."""
    data = student_service.get_student_progress(db, current_user.user_id, period=period)
    return StudentProgressResponse(**data)


# GD-59: Notification endpoints

@router.get("/notifications", response_model=PaginatedResponse[NotificationResponse])
def list_notifications(
    type: str | None = Query(None),
    read: bool | None = Query(None),
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=100),
    current_user: User = Depends(require_role([UserRole.STUDENT])),
    db: Session = Depends(get_db),
):
    """List notifications for the current student."""
    items, total, unread = notification_service.get_notifications(
        db, current_user.user_id,
        type_filter=type,
        is_read=read,
        page=page,
        per_page=per_page,
    )
    total_pages = (total + per_page - 1) // per_page if total else 0
    return PaginatedResponse(
        items=[NotificationResponse.model_validate(n) for n in items],
        total=total,
        page=page,
        per_page=per_page,
        total_pages=total_pages,
    )


@router.get("/notifications/unread-count", response_model=UnreadCountResponse)
def get_unread_notification_count(
    current_user: User = Depends(require_role([UserRole.STUDENT])),
    db: Session = Depends(get_db),
):
    """Get count of unread notifications."""
    count = notification_service.get_unread_count(db, current_user.user_id)
    return UnreadCountResponse(count=count)


@router.patch(
    "/notifications/{notification_id}/read",
    response_model=NotificationResponse,
)
def mark_notification_read(
    notification_id: uuid.UUID,
    current_user: User = Depends(require_role([UserRole.STUDENT])),
    db: Session = Depends(get_db),
):
    """Mark a single notification as read."""
    notification = notification_service.mark_as_read(
        db, current_user.user_id, notification_id
    )
    if not notification:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Notification not found",
        )
    return NotificationResponse.model_validate(notification)


@router.patch("/notifications/read-all", response_model=MessageResponse)
def mark_all_notifications_read(
    current_user: User = Depends(require_role([UserRole.STUDENT])),
    db: Session = Depends(get_db),
):
    """Mark all unread notifications as read."""
    count = notification_service.mark_all_as_read(db, current_user.user_id)
    return MessageResponse(message=f"Marked {count} notifications as read")


# GD-60: Student profile endpoints

class ProfileUpdateRequest(BaseModel):
    full_name: str | None = None
    profile_image_url: str | None = None


@router.get("/profile", response_model=UserResponse)
def get_profile(
    current_user: User = Depends(require_role([UserRole.STUDENT])),
):
    """Get the current student's profile."""
    return UserResponse.model_validate(current_user)


@router.patch("/profile", response_model=UserResponse)
def update_profile(
    data: ProfileUpdateRequest,
    current_user: User = Depends(require_role([UserRole.STUDENT])),
    db: Session = Depends(get_db),
):
    """Update the current student's profile (name and image only)."""
    if data.full_name is not None:
        current_user.full_name = data.full_name
    if data.profile_image_url is not None:
        current_user.profile_image_url = data.profile_image_url
    db.commit()
    db.refresh(current_user)
    return UserResponse.model_validate(current_user)


# GD-61: Curriculum library endpoints

@router.get("/library", response_model=PaginatedResponse[CurriculumDocumentResponse])
def list_library_documents(
    subject_id: int | None = Query(None),
    doc_type: str | None = Query(None),
    search: str | None = Query(None),
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=100),
    current_user: User = Depends(require_role([UserRole.STUDENT])),
    db: Session = Depends(get_db),
):
    """List curriculum documents for subjects the student is enrolled in."""
    items, total = library_service.get_library_documents(
        db, current_user.user_id,
        subject_id=subject_id,
        doc_type=doc_type,
        search=search,
        page=page,
        per_page=per_page,
    )
    total_pages = (total + per_page - 1) // per_page if total else 0
    return PaginatedResponse(
        items=[CurriculumDocumentResponse(**d) for d in items],
        total=total,
        page=page,
        per_page=per_page,
        total_pages=total_pages,
    )


@router.get("/library/{doc_id}", response_model=CurriculumDocumentResponse)
def get_library_document(
    doc_id: uuid.UUID,
    current_user: User = Depends(require_role([UserRole.STUDENT])),
    db: Session = Depends(get_db),
):
    """Get a single curriculum document detail."""
    data = library_service.get_document_detail(db, current_user.user_id, doc_id)
    return CurriculumDocumentResponse(**data)
