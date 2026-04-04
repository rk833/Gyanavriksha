"""Presentation layer for the student bounded context.

All route handlers are intentionally thin: they declare HTTP contracts
(prefix, response model, status code) and delegate immediately to the
application-layer use cases. Business logic, response construction, and error
mapping all live in the application layer.
"""
import uuid

from fastapi import APIRouter, Depends, File, Query, UploadFile, status
from sqlalchemy.orm import Session

from app.api.auth.infrastructure.dependencies import require_role
from app.api.student.application import service
from app.api.student.domain.schemas import StudentProfileUpdateInput
from app.core.database import get_db
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
from app.schemas.submission import (
    SubmissionDetailResponse,
    SubmissionFeedbackResponse,
    SubmissionListItem,
)
from app.schemas.subject import EnrollmentResponse, SubjectResponse
from app.schemas.user import MessageResponse, UserResponse
from app.shared.source_enum import UserRole

router = APIRouter(prefix="/api/students", tags=["Student"])


@router.get("/subjects", response_model=list[SubjectResponse])
def list_enrolled_subjects(
    current_user: User = Depends(require_role([UserRole.STUDENT])),
    db: Session = Depends(get_db),
):
    """Return all subjects the current student is enrolled in."""
    return service.get_enrolled_subjects(db, current_user.user_id)


@router.get("/subjects/{subject_id}", response_model=SubjectResponse)
def get_subject_detail(
    subject_id: int,
    current_user: User = Depends(require_role([UserRole.STUDENT])),
    db: Session = Depends(get_db),
):
    """Return detail for a specific subject the student is enrolled in."""
    return service.get_subject_detail(db, current_user.user_id, subject_id)


@router.get("/enrollments", response_model=PaginatedResponse[EnrollmentResponse])
def list_enrollments(
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=100),
    current_user: User = Depends(require_role([UserRole.STUDENT])),
    db: Session = Depends(get_db),
):
    """Return paginated enrollments with completion percentages for the current student."""
    return service.list_enrollments(db, current_user.user_id, page, per_page)


@router.get("/dashboard", response_model=DashboardResponse)
def get_dashboard(
    current_user: User = Depends(require_role([UserRole.STUDENT])),
    db: Session = Depends(get_db),
):
    """Return aggregated dashboard statistics for the current student."""
    return service.get_dashboard(db, current_user.user_id)


@router.get("/assignments", response_model=PaginatedResponse[AssignmentListItem])
def list_assignments(
    subject_id: int | None = Query(None),
    status: str | None = Query(None, pattern="^(open|closed|all)$"),
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=100),
    current_user: User = Depends(require_role([UserRole.STUDENT])),
    db: Session = Depends(get_db),
):
    """Return paginated published assignments for subjects the student is enrolled in."""
    return service.list_assignments(
        db,
        current_user.user_id,
        subject_id=subject_id,
        status_filter=status if status != "all" else None,
        page=page,
        per_page=per_page,
    )


@router.get("/assignments/{assignment_id}", response_model=AssignmentDetailResponse)
def get_assignment(
    assignment_id: uuid.UUID,
    current_user: User = Depends(require_role([UserRole.STUDENT])),
    db: Session = Depends(get_db),
):
    """Return full assignment detail for the authenticated student."""
    return service.get_assignment(db, current_user.user_id, assignment_id)


@router.post("/submissions", response_model=SubmissionListItem, status_code=201)
async def upload_submission(
    assignment_id: uuid.UUID = Query(...),
    files: list[UploadFile] = File(...),
    current_user: User = Depends(require_role([UserRole.STUDENT])),
    db: Session = Depends(get_db),
):
    """Upload handwritten work images as a new submission for the given assignment."""
    return await service.create_submission(
        db, current_user.user_id, assignment_id, files
    )


@router.get("/submissions", response_model=PaginatedResponse[SubmissionListItem])
def list_submissions(
    subject_id: int | None = Query(None),
    status: str | None = Query(None),
    page: int = Query(1, ge=1),
    per_page: int = Query(10, ge=1, le=100),
    current_user: User = Depends(require_role([UserRole.STUDENT])),
    db: Session = Depends(get_db),
):
    """Return paginated submission records for the current student."""
    return service.list_submissions(
        db,
        current_user.user_id,
        subject_id=subject_id,
        status_filter=status,
        page=page,
        per_page=per_page,
    )


@router.get("/submissions/{submission_id}", response_model=SubmissionDetailResponse)
def get_submission(
    submission_id: uuid.UUID,
    current_user: User = Depends(require_role([UserRole.STUDENT])),
    db: Session = Depends(get_db),
):
    """Return full submission detail including feedback and knowledge gap data."""
    return service.get_submission(db, current_user.user_id, submission_id)


@router.get(
    "/submissions/{submission_id}/feedback",
    response_model=SubmissionFeedbackResponse,
)
def get_submission_feedback(
    submission_id: uuid.UUID,
    current_user: User = Depends(require_role([UserRole.STUDENT])),
    db: Session = Depends(get_db),
):
    """Return AI-generated grading feedback for a specific submission."""
    return service.get_submission_feedback(
        db, current_user.user_id, submission_id
    )


@router.get(
    "/knowledge-gaps", response_model=PaginatedResponse[KnowledgeGapResponse]
)
def list_knowledge_gaps(
    subject_id: int | None = Query(None),
    resolved: bool | None = Query(None),
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=100),
    current_user: User = Depends(require_role([UserRole.STUDENT])),
    db: Session = Depends(get_db),
):
    """Return paginated knowledge gaps detected for the current student."""
    return service.list_knowledge_gaps(
        db,
        current_user.user_id,
        subject_id=subject_id,
        resolved=resolved,
        page=page,
        per_page=per_page,
    )


@router.get("/knowledge-gaps/summary", response_model=KnowledgeGapSummary)
def get_knowledge_gap_summary(
    current_user: User = Depends(require_role([UserRole.STUDENT])),
    db: Session = Depends(get_db),
):
    """Return aggregated knowledge gap summary counts for the current student."""
    return service.get_knowledge_gap_summary(db, current_user.user_id)


@router.get("/progress", response_model=StudentProgressResponse)
def get_progress(
    period: str = Query("weekly", pattern="^(weekly|monthly)$"),
    current_user: User = Depends(require_role([UserRole.STUDENT])),
    db: Session = Depends(get_db),
):
    """Return student progress analytics for the specified time period."""
    return service.get_progress(db, current_user.user_id, period)


@router.get(
    "/notifications", response_model=PaginatedResponse[NotificationResponse]
)
def list_notifications(
    type: str | None = Query(None),
    read: bool | None = Query(None),
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=100),
    current_user: User = Depends(require_role([UserRole.STUDENT])),
    db: Session = Depends(get_db),
):
    """Return paginated notifications for the current student."""
    return service.list_notifications(
        db,
        current_user.user_id,
        type_filter=type,
        is_read=read,
        page=page,
        per_page=per_page,
    )


@router.get("/notifications/unread-count", response_model=UnreadCountResponse)
def get_unread_notification_count(
    current_user: User = Depends(require_role([UserRole.STUDENT])),
    db: Session = Depends(get_db),
):
    """Return the count of unread notifications for the current student."""
    return service.get_unread_notification_count(db, current_user.user_id)


@router.patch(
    "/notifications/{notification_id}/read",
    response_model=NotificationResponse,
)
def mark_notification_read(
    notification_id: uuid.UUID,
    current_user: User = Depends(require_role([UserRole.STUDENT])),
    db: Session = Depends(get_db),
):
    """Mark a single notification as read and return the updated record."""
    return service.mark_notification_read(
        db, current_user.user_id, notification_id
    )


@router.patch("/notifications/read-all", response_model=MessageResponse)
def mark_all_notifications_read(
    current_user: User = Depends(require_role([UserRole.STUDENT])),
    db: Session = Depends(get_db),
):
    """Mark all unread notifications as read for the current student."""
    return service.mark_all_notifications_read(db, current_user.user_id)


@router.get("/profile", response_model=UserResponse)
def get_profile(
    current_user: User = Depends(require_role([UserRole.STUDENT])),
):
    """Return the current student's profile."""
    return service.get_profile(current_user)


@router.patch("/profile", response_model=UserResponse)
def update_profile(
    data: StudentProfileUpdateInput,
    current_user: User = Depends(require_role([UserRole.STUDENT])),
    db: Session = Depends(get_db),
):
    """Update the current student's profile name and/or profile image URL."""
    return service.update_profile(
        db, current_user, data.full_name, data.profile_image_url
    )


@router.get(
    "/library", response_model=PaginatedResponse[CurriculumDocumentResponse]
)
def list_library_documents(
    subject_id: int | None = Query(None),
    doc_type: str | None = Query(None),
    search: str | None = Query(None),
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=100),
    current_user: User = Depends(require_role([UserRole.STUDENT])),
    db: Session = Depends(get_db),
):
    """Return paginated curriculum documents for subjects the student is enrolled in."""
    return service.list_library_documents(
        db,
        current_user.user_id,
        subject_id=subject_id,
        doc_type=doc_type,
        search=search,
        page=page,
        per_page=per_page,
    )


@router.get("/library/{doc_id}", response_model=CurriculumDocumentResponse)
def get_library_document(
    doc_id: uuid.UUID,
    current_user: User = Depends(require_role([UserRole.STUDENT])),
    db: Session = Depends(get_db),
):
    """Return detail for a single curriculum document accessible to the student."""
    return service.get_library_document(db, current_user.user_id, doc_id)
