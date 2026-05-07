"""Presentation layer for the student bounded context.

All route handlers are intentionally thin: they declare HTTP contracts
(prefix, response model, status code) and delegate immediately to the
application-layer use cases. Business logic, response construction, and error
mapping all live in the application layer.
"""
import uuid
from datetime import date
from urllib.parse import quote

import mimetypes
from pathlib import Path

from typing import TYPE_CHECKING

from fastapi import APIRouter, BackgroundTasks, Depends, File, HTTPException, Query, UploadFile, status
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session

if TYPE_CHECKING:
    pass

from app.api.auth.infrastructure.dependencies import require_role
from app.api.student.application import service
from app.services import submission_service as submission_service_mod
from app.services import ocr_service
from app.api.student.domain.schemas import StudentProfileUpdateInput
from app.core.database import get_db
from app.db.models.user import User
from app.schemas.assignment import AssignmentDetailResponse, AssignmentListItem
from app.schemas.exam_session import ExamSessionResponse
from app.schemas.common import PaginatedResponse
from app.schemas.library import CurriculumDocumentResponse
from app.schemas.notification import NotificationResponse, UnreadCountResponse
from app.schemas.progress import (
    DashboardResponse,
    KnowledgeGapResponse,
    KnowledgeGapSummary,
    StudentProgressResponse,
)
from app.schemas.quiz import MicroQuizSchema, MicroQuizSubmitResponse, QuizGenerateRequest, SubmitMicroQuizInput
from app.schemas.submission import (
    SubmissionDetailResponse,
    SubmissionFeedbackResponse,
    SubmissionListItem,
)
from app.schemas.subject import EnrollmentResponse, SubjectResponse
from app.schemas.user import MessageResponse, UserResponse
from app.schemas.chat_tutor import (
    AiTutorChatRequest,
    AiTutorChatResponse,
    AiTutorSessionDetailResponse,
    AiTutorSessionItem,
)
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
    due_on: date | None = Query(None, description="Calendar due date (YYYY-MM-DD)"),
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
        due_on=due_on,
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


@router.post(
    "/assignments/{assignment_id}/exam-session/start",
    response_model=ExamSessionResponse,
    status_code=201,
)
def start_exam_session(
    assignment_id: uuid.UUID,
    current_user: User = Depends(require_role([UserRole.STUDENT])),
    db: Session = Depends(get_db),
):
    """Create or return the active persisted exam session for this assignment."""
    return service.start_exam_session(db, current_user.user_id, assignment_id)


@router.post(
    "/exam-sessions/{session_id}/terminate",
    response_model=ExamSessionResponse,
)
def terminate_exam_session(
    session_id: uuid.UUID,
    current_user: User = Depends(require_role([UserRole.STUDENT])),
    db: Session = Depends(get_db),
):
    """Abandon an in-progress exam (counts as attempt used)."""
    return service.terminate_exam_session(db, current_user.user_id, session_id)


@router.post("/submissions", response_model=SubmissionListItem, status_code=201)
async def upload_submission(
    background_tasks: BackgroundTasks,
    assignment_id: uuid.UUID = Query(...),
    files: list[UploadFile] = File(...),
    current_user: User = Depends(require_role([UserRole.STUDENT])),
    db: Session = Depends(get_db),
):
    """Upload handwritten work images as a new submission for the given assignment."""
    result = await service.create_submission(
        db, current_user.user_id, assignment_id, files
    )
    # Automatically enqueue OCR + LLM grading so the submission progresses
    # past QUEUED without requiring a separate manual trigger call.
    background_tasks.add_task(
        ocr_service.process_submission_ocr, db, result.submission_id
    )
    # Notify the subject instructor about the new submission.
    background_tasks.add_task(
        _notify_instructor_new_submission,
        db,
        result.submission_id,
        current_user.full_name,
    )
    return result


def _notify_instructor_new_submission(
    db: "Session",
    submission_id: uuid.UUID,
    student_name: str,
) -> None:
    """Background task: find the subject instructor and send a SUBMISSION_RECEIVED notification."""
    try:
        from app.db.models.assignment import Assignment
        from app.db.models.instructor_subject import InstructorSubject
        from app.db.models.submission import Submission
        from app.services import notification_service
        from app.shared.source_enum import NotificationType

        sub = db.query(Submission).filter(Submission.submission_id == submission_id).first()
        if not sub:
            return
        assignment = db.query(Assignment).filter(Assignment.assignment_id == sub.assignment_id).first()
        assignment_title = assignment.title if assignment else "an assignment"

        instructor_link = (
            db.query(InstructorSubject)
            .filter(
                InstructorSubject.subject_id == sub.subject_id,
                InstructorSubject.is_active == True,
            )
            .first()
        )
        if not instructor_link:
            return

        notification_service.create_notification(
            db=db,
            recipient_id=instructor_link.instructor_id,
            notification_type=NotificationType.SUBMISSION_RECEIVED,
            title="New Submission Received",
            body=f'{student_name} submitted "{assignment_title}".',
            related_resource_id=str(submission_id),
        )
        db.commit()
    except Exception:
        pass


@router.get("/submissions", response_model=PaginatedResponse[SubmissionListItem])
def list_submissions(
    subject_id: int | None = Query(None),
    status: str | None = Query(None),
    search: str | None = Query(None, max_length=200),
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
        search=search,
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


@router.get("/submissions/{submission_id}/files/{file_index}")
def download_submission_file(
    submission_id: uuid.UUID,
    file_index: int,
    current_user: User = Depends(require_role([UserRole.STUDENT])),
    db: Session = Depends(get_db),
):
    """Download one uploaded file for the student's own submission."""
    submission_service_mod.get_submission_detail(db, current_user.user_id, submission_id)
    abs_path, fname = submission_service_mod.get_submission_file_for_download(
        db, submission_id, file_index
    )
    media, _ = mimetypes.guess_type(fname)
    return FileResponse(
        abs_path,
        filename=fname,
        media_type=media or "application/octet-stream",
    )


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
    """Update the current student's profile and learning-alert preferences."""
    return service.update_profile(
        db,
        current_user,
        full_name=data.full_name,
        profile_image_url=data.profile_image_url,
        notification_preferences=data.notification_preferences,
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


_BACKEND_ROOT = Path(__file__).resolve().parents[4]


def _build_download_content_disposition(filename: str) -> str:
    """Return ASCII-safe Content-Disposition with UTF-8 fallback for unicode filenames."""
    ascii_fallback = filename.encode("ascii", errors="ignore").decode("ascii").strip()
    if not ascii_fallback:
        ascii_fallback = "download"
    return (
        f'attachment; filename="{ascii_fallback}"; '
        f"filename*=UTF-8''{quote(filename, safe='')}"
    )


@router.get("/library/{doc_id}/download")
def download_library_document(
    doc_id: uuid.UUID,
    current_user: User = Depends(require_role([UserRole.STUDENT])),
    db: Session = Depends(get_db),
):
    """Stream a curriculum document file to the authenticated student."""
    detail = service.get_library_document(db, current_user.user_id, doc_id)
    file_path = _BACKEND_ROOT / detail.file_path
    if not file_path.exists():
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="File not found on server.",
        )
    media_type, _ = mimetypes.guess_type(str(file_path))
    return FileResponse(
        path=str(file_path),
        media_type=media_type or "application/octet-stream",
        headers={
            "Content-Disposition": _build_download_content_disposition(detail.file_name)
        },
    )


@router.get("/quizzes", response_model=PaginatedResponse[MicroQuizSchema])
def list_quizzes(
    subject_id: int | None = Query(None),
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=100),
    current_user: User = Depends(require_role([UserRole.STUDENT])),
    db: Session = Depends(get_db),
):
    """Return paginated micro-quizzes for the current student."""
    return service.list_quizzes(db, current_user.user_id, subject_id, page, per_page)


@router.get("/quizzes/{quiz_id}", response_model=MicroQuizSchema)
def get_quiz_detail(
    quiz_id: uuid.UUID,
    current_user: User = Depends(require_role([UserRole.STUDENT])),
    db: Session = Depends(get_db),
):
    """Return full detail for a specific quiz, including questions."""
    return service.get_quiz_detail(db, current_user.user_id, quiz_id)


@router.post("/quizzes/{quiz_id}/submit", response_model=MicroQuizSubmitResponse)
def submit_micro_quiz(
    quiz_id: uuid.UUID,
    data: SubmitMicroQuizInput,
    current_user: User = Depends(require_role([UserRole.STUDENT])),
    db: Session = Depends(get_db),
):
    """Submit answers; server scores against stored keys and may mark the linked knowledge gap resolved."""
    return service.submit_micro_quiz(db, current_user.user_id, quiz_id, list(data.answers))


@router.post("/quizzes/generate", response_model=MicroQuizSchema, status_code=201)
async def generate_quiz(
    data: QuizGenerateRequest,
    current_user: User = Depends(require_role([UserRole.STUDENT])),
    db: Session = Depends(get_db),
):
    """Trigger AI quiz generation for a concept and save to DB."""
    return await service.generate_quiz(
        db, current_user.user_id, data.subject_id, data.concept, data.num_questions
    )


@router.post("/ai-tutor/chat", response_model=AiTutorChatResponse)
async def ai_tutor_chat(
    data: AiTutorChatRequest,
    current_user: User = Depends(require_role([UserRole.STUDENT])),
    db: Session = Depends(get_db),
):
    """Curriculum RAG chat; persists turns to ``chat_history`` when ``subject_id`` is set."""
    return await service.ai_tutor_chat(db, current_user.user_id, data)


@router.get("/ai-tutor/sessions", response_model=PaginatedResponse[AiTutorSessionItem])
def list_ai_tutor_sessions(
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=50),
    subject_id: int | None = Query(None),
    search: str | None = Query(None, max_length=200),
    current_user: User = Depends(require_role([UserRole.STUDENT])),
    db: Session = Depends(get_db),
):
    """Past AI tutor sessions for the current student (summary metadata + preview)."""
    return service.list_ai_tutor_sessions(
        db,
        current_user.user_id,
        page,
        per_page,
        subject_id=subject_id,
        search=search,
    )


@router.get("/ai-tutor/sessions/{history_id}", response_model=AiTutorSessionDetailResponse)
def get_ai_tutor_session(
    history_id: uuid.UUID,
    current_user: User = Depends(require_role([UserRole.STUDENT])),
    db: Session = Depends(get_db),
):
    """Load one saved chat session (messages for replay)."""
    return service.get_ai_tutor_session(db, current_user.user_id, history_id)


# ── IoT endpoints ─────────────────────────────────────────────────────────────

@router.get("/iot/status")
def get_iot_status(
    current_user: User = Depends(require_role([UserRole.STUDENT])),
    db: Session = Depends(get_db),
):
    """Return latest sensor readings and linked IoT devices for the current student."""
    return service.get_iot_status(db, current_user.user_id)


@router.post(
    "/exam-sessions/{session_id}/resume",
    response_model=ExamSessionResponse,
)
def resume_exam_session(
    session_id: uuid.UUID,
    current_user: User = Depends(require_role([UserRole.STUDENT])),
    db: Session = Depends(get_db),
):
    """Resume a paused exam session (e.g. after IoT auto-pause)."""
    return service.resume_exam_session(db, current_user.user_id, session_id)
