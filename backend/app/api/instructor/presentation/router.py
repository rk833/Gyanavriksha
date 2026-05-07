"""Presentation layer for the instructor bounded context.

Route handlers declare HTTP contracts and immediately delegate to the
application-layer use cases. No business logic, error mapping, or response
construction occurs in this layer.
"""
import mimetypes
import uuid

from fastapi import APIRouter, Depends, File, Form, Query, UploadFile, status
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session

from app.services import submission_service as submission_service_mod

from app.api.auth.infrastructure.dependencies import require_role
from app.api.instructor.application import service
from app.core.database import get_db
from app.db.models.user import User
from app.schemas.common import PaginatedResponse
from app.schemas.notification import NotificationResponse, UnreadCountResponse
from app.schemas.user import MessageResponse
from app.services import notification_service
from app.schemas.instructor import (
    AssignmentCreateRequest,
    AssignmentUpdateRequest,
    AtRiskStudentResponse,
    ConceptHeatmapResponse,
    ExamMonitorResponse,
    FeedbackOverrideRequest,
    InstructorAssignmentDetailResponse,
    InstructorAssignmentResponse,
    InstructorDashboardResponse,
    InstructorProfileResponse,
    InstructorProfileUpdateRequest,
    InstructorSubmissionDetailResponse,
    InstructorSubmissionListItem,
    InstructorSubjectDetailResponse,
    InstructorSubjectResponse,
    KnowledgeBaseDocumentResponse,
    VelocityAnalyticsResponse,
)
from app.shared.source_enum import UserRole

router = APIRouter(prefix="/api/instructors", tags=["Instructor"])


@router.get("/exam-monitor", response_model=ExamMonitorResponse)
def get_exam_monitor(
    assignment_id: uuid.UUID | None = Query(None, description="Published exam assignment to monitor"),
    current_user: User = Depends(require_role([UserRole.INSTRUCTOR])),
    db: Session = Depends(get_db),
):
    """Live exam cockpit: enrolled students, IoT telemetry, posture alerts timeline."""
    return service.get_exam_monitor(db, str(current_user.user_id), assignment_id)


@router.get("/dashboard", response_model=InstructorDashboardResponse)
def get_dashboard(
    current_user: User = Depends(require_role([UserRole.INSTRUCTOR])),
    db: Session = Depends(get_db),
):
    """Return aggregated dashboard data for the instructor intelligence view."""
    return service.get_dashboard(db, str(current_user.user_id))


@router.get("/subjects", response_model=list[InstructorSubjectResponse])
def list_subjects(
    current_user: User = Depends(require_role([UserRole.INSTRUCTOR])),
    db: Session = Depends(get_db),
):
    """Return all subjects assigned to this instructor, sorted by grade then name."""
    return service.list_subjects(db, str(current_user.user_id))


@router.get("/subjects/{subject_id}", response_model=InstructorSubjectDetailResponse)
def get_subject_detail(
    subject_id: int,
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=100),
    sort_by: str = Query("name", pattern="^(name|score|submissions)$"),
    current_user: User = Depends(require_role([UserRole.INSTRUCTOR])),
    db: Session = Depends(get_db),
):
    """Return subject detail with paginated enrolled-student progress data."""
    return service.get_subject_detail(
        db,
        str(current_user.user_id),
        subject_id,
        page=page,
        per_page=per_page,
        sort_by=sort_by,
    )


@router.get(
    "/assignments",
    response_model=PaginatedResponse[InstructorAssignmentResponse],
)
def list_assignments(
    subject_id: int | None = Query(None),
    status_filter: str | None = Query(
        None, alias="status", pattern="^(draft|published)$"
    ),
    is_exam_mode: bool | None = Query(None),
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=100),
    current_user: User = Depends(require_role([UserRole.INSTRUCTOR])),
    db: Session = Depends(get_db),
):
    """Return paginated assignments created by this instructor with optional filters."""
    return service.list_assignments(
        db,
        str(current_user.user_id),
        subject_id=subject_id,
        status_filter=status_filter,
        is_exam_mode=is_exam_mode,
        page=page,
        per_page=per_page,
    )


@router.get(
    "/assignments/{assignment_id}",
    response_model=InstructorAssignmentDetailResponse,
)
def get_assignment(
    assignment_id: uuid.UUID,
    current_user: User = Depends(require_role([UserRole.INSTRUCTOR])),
    db: Session = Depends(get_db),
):
    """Return detailed assignment information with submission statistics."""
    return service.get_assignment(
        db, str(current_user.user_id), assignment_id
    )


@router.post(
    "/assignments",
    response_model=InstructorAssignmentResponse,
    status_code=201,
)
def create_assignment(
    data: AssignmentCreateRequest,
    current_user: User = Depends(require_role([UserRole.INSTRUCTOR])),
    db: Session = Depends(get_db),
):
    """Create a new draft assignment for one of the instructor's subjects."""
    return service.create_assignment(
        db, str(current_user.user_id), data.model_dump()
    )


@router.patch(
    "/assignments/{assignment_id}",
    response_model=InstructorAssignmentResponse,
)
def update_assignment(
    assignment_id: uuid.UUID,
    data: AssignmentUpdateRequest,
    current_user: User = Depends(require_role([UserRole.INSTRUCTOR])),
    db: Session = Depends(get_db),
):
    """Update assignment fields; only the original creator may modify."""
    return service.update_assignment(
        db,
        str(current_user.user_id),
        assignment_id,
        data.model_dump(exclude_unset=True),
    )


@router.patch(
    "/assignments/{assignment_id}/publish",
    response_model=InstructorAssignmentResponse,
)
def publish_assignment(
    assignment_id: uuid.UUID,
    current_user: User = Depends(require_role([UserRole.INSTRUCTOR])),
    db: Session = Depends(get_db),
):
    """Publish a draft assignment; cannot re-publish an already-published assignment."""
    return service.publish_assignment(
        db, str(current_user.user_id), assignment_id
    )


@router.delete("/assignments/{assignment_id}", status_code=204)
def delete_assignment(
    assignment_id: uuid.UUID,
    current_user: User = Depends(require_role([UserRole.INSTRUCTOR])),
    db: Session = Depends(get_db),
):
    """Delete a draft assignment that has no associated submissions."""
    service.delete_assignment(
        db, str(current_user.user_id), assignment_id
    )
    return None


@router.get(
    "/submissions",
    response_model=PaginatedResponse[InstructorSubmissionListItem],
)
def list_submissions(
    assignment_id: uuid.UUID | None = Query(None),
    student_id: uuid.UUID | None = Query(None),
    subject_id: int | None = Query(None),
    status_filter: str | None = Query(
        None,
        alias="status",
        pattern="^(queued|ocr|grading|done|rejected)$",
    ),
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=100),
    current_user: User = Depends(require_role([UserRole.INSTRUCTOR])),
    db: Session = Depends(get_db),
):
    """Return paginated submissions for the instructor's assignments with optional filters."""
    return service.list_submissions(
        db,
        str(current_user.user_id),
        assignment_id=assignment_id,
        student_id=student_id,
        subject_id=subject_id,
        status_filter=status_filter,
        page=page,
        per_page=per_page,
    )


@router.get(
    "/submissions/{submission_id}",
    response_model=InstructorSubmissionDetailResponse,
)
def get_submission_detail(
    submission_id: uuid.UUID,
    current_user: User = Depends(require_role([UserRole.INSTRUCTOR])),
    db: Session = Depends(get_db),
):
    """Return full submission detail including AI-generated and instructor feedback."""
    return service.get_submission_detail(
        db, str(current_user.user_id), submission_id
    )


@router.get("/submissions/{submission_id}/files/{file_index}")
def download_submission_file(
    submission_id: uuid.UUID,
    file_index: int,
    current_user: User = Depends(require_role([UserRole.INSTRUCTOR])),
    db: Session = Depends(get_db),
):
    """Download one uploaded file for a submission the instructor may access."""
    service.get_submission_detail(db, str(current_user.user_id), submission_id)
    abs_path, fname = submission_service_mod.get_submission_file_for_download(
        db, submission_id, file_index
    )
    media, _ = mimetypes.guess_type(fname)
    return FileResponse(
        abs_path,
        filename=fname,
        media_type=media or "application/octet-stream",
    )


@router.patch(
    "/submissions/{submission_id}/feedback",
    response_model=InstructorSubmissionDetailResponse,
)
def override_feedback(
    submission_id: uuid.UUID,
    data: FeedbackOverrideRequest,
    current_user: User = Depends(require_role([UserRole.INSTRUCTOR])),
    db: Session = Depends(get_db),
):
    """Create or override instructor feedback and score on a submission."""
    return service.override_feedback(
        db,
        str(current_user.user_id),
        submission_id,
        data.model_dump(exclude_unset=True),
    )


@router.get("/analytics/velocity", response_model=VelocityAnalyticsResponse)
def get_velocity_analytics(
    subject_id: int | None = Query(None),
    current_user: User = Depends(require_role([UserRole.INSTRUCTOR])),
    db: Session = Depends(get_db),
):
    """Return submission velocity analytics for the instructor's subjects."""
    return service.get_velocity_analytics(
        db, str(current_user.user_id), subject_id
    )


@router.get(
    "/analytics/at-risk",
    response_model=PaginatedResponse[AtRiskStudentResponse],
)
def get_at_risk_students(
    subject_id: int | None = Query(None),
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=100),
    current_user: User = Depends(require_role([UserRole.INSTRUCTOR])),
    db: Session = Depends(get_db),
):
    """Return paginated at-risk students based on scores, activity, and missed work."""
    return service.get_at_risk_students(
        db,
        str(current_user.user_id),
        subject_id=subject_id,
        page=page,
        per_page=per_page,
    )


@router.get("/analytics/concept-heatmap", response_model=ConceptHeatmapResponse)
def get_concept_heatmap(
    subject_id: int | None = Query(None),
    timeframe: str = Query("all", pattern="^(7d|30d|all)$"),
    current_user: User = Depends(require_role([UserRole.INSTRUCTOR])),
    db: Session = Depends(get_db),
):
    """Return concept heatmap data showing topic-level knowledge struggle areas."""
    return service.get_concept_heatmap(
        db, str(current_user.user_id), subject_id, timeframe
    )


@router.get(
    "/knowledge-base",
    response_model=PaginatedResponse[KnowledgeBaseDocumentResponse],
)
def list_knowledge_base(
    subject_id: int | None = Query(None),
    doc_type: str | None = Query(
        None, pattern="^(curriculum_pdf|instructor_note)$"
    ),
    search: str | None = Query(None),
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=100),
    current_user: User = Depends(require_role([UserRole.INSTRUCTOR])),
    db: Session = Depends(get_db),
):
    """Return paginated knowledge-base documents uploaded by this instructor."""
    return service.list_knowledge_base(
        db,
        str(current_user.user_id),
        subject_id=subject_id,
        doc_type=doc_type,
        search=search,
        page=page,
        per_page=per_page,
    )


@router.post(
    "/knowledge-base/upload",
    response_model=KnowledgeBaseDocumentResponse,
    status_code=201,
)
async def upload_document(
    file: UploadFile = File(...),
    subject_id: int = Form(...),
    doc_type: str = Form(..., pattern="^(curriculum_pdf|instructor_note)$"),
    current_user: User = Depends(require_role([UserRole.INSTRUCTOR])),
    db: Session = Depends(get_db),
):
    """Upload a PDF document to the knowledge base for one of the instructor's subjects."""
    return await service.upload_document(
        db, str(current_user.user_id), subject_id, file, doc_type
    )


@router.delete("/knowledge-base/{doc_id}", status_code=204)
def delete_document(
    doc_id: uuid.UUID,
    current_user: User = Depends(require_role([UserRole.INSTRUCTOR])),
    db: Session = Depends(get_db),
):
    """Delete a knowledge-base document owned by this instructor."""
    service.delete_document(db, str(current_user.user_id), doc_id)
    return None


@router.get("/profile", response_model=InstructorProfileResponse)
def get_profile(
    current_user: User = Depends(require_role([UserRole.INSTRUCTOR])),
    db: Session = Depends(get_db),
):
    """Return the instructor's profile including assigned subjects."""
    return service.get_profile(db, str(current_user.user_id))


@router.patch("/profile", response_model=InstructorProfileResponse)
def update_profile(
    data: InstructorProfileUpdateRequest,
    current_user: User = Depends(require_role([UserRole.INSTRUCTOR])),
    db: Session = Depends(get_db),
):
    """Update the instructor's profile name and/or profile image URL."""
    return service.update_profile(
        db,
        str(current_user.user_id),
        data.model_dump(exclude_unset=True),
    )


# ── Notifications ────────────────────────────────────────────────────────────

@router.get("/notifications", response_model=PaginatedResponse[NotificationResponse])
def list_notifications(
    type: str | None = Query(None),
    read: bool | None = Query(None),
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=100),
    current_user: User = Depends(require_role([UserRole.INSTRUCTOR])),
    db: Session = Depends(get_db),
):
    """Return paginated notifications for the current instructor."""
    items, total, unread_count = notification_service.get_notifications(
        db, current_user.user_id, type_filter=type, is_read=read, page=page, per_page=per_page,
    )
    total_pages = max(1, -(-total // per_page))
    return {
        "items": items,
        "total": total,
        "page": page,
        "per_page": per_page,
        "total_pages": total_pages,
        "unread_count": unread_count,
    }


@router.get("/notifications/unread-count", response_model=UnreadCountResponse)
def get_unread_count(
    current_user: User = Depends(require_role([UserRole.INSTRUCTOR])),
    db: Session = Depends(get_db),
):
    """Return the count of unread notifications for the current instructor."""
    count = notification_service.get_unread_count(db, current_user.user_id)
    return {"count": count}


@router.patch("/notifications/{notification_id}/read", response_model=NotificationResponse)
def mark_notification_read(
    notification_id: uuid.UUID,
    current_user: User = Depends(require_role([UserRole.INSTRUCTOR])),
    db: Session = Depends(get_db),
):
    """Mark a single notification as read."""
    notif = notification_service.mark_as_read(db, current_user.user_id, notification_id)
    if not notif:
        from fastapi import HTTPException
        raise HTTPException(status_code=404, detail="Notification not found")
    return notif


@router.patch("/notifications/read-all", response_model=MessageResponse)
def mark_all_read(
    current_user: User = Depends(require_role([UserRole.INSTRUCTOR])),
    db: Session = Depends(get_db),
):
    """Mark all notifications as read for this instructor."""
    count = notification_service.mark_all_as_read(db, current_user.user_id)
    return {"message": f"{count} notification(s) marked as read."}
