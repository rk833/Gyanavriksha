"""
Instructor API routes — full instructor dashboard.
Sprint 4 Phase 1: GD-82, Phase 2: GD-84-86, Phase 3: GD-87-89, Phase 4: GD-90-93
"""
import uuid

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.api.middleware.auth_middleware import require_role
from app.core.database import get_db
from app.db.models.user import User
from app.schemas.common import PaginatedResponse
from app.schemas.instructor import (
    AssignmentCreateRequest,
    AssignmentUpdateRequest,
    AtRiskStudentResponse,
    FeedbackOverrideRequest,
    InstructorAssignmentDetailResponse,
    InstructorAssignmentResponse,
    InstructorDashboardResponse,
    InstructorSubmissionDetailResponse,
    InstructorSubmissionListItem,
    InstructorSubjectDetailResponse,
    InstructorSubjectResponse,
    StudentInSubjectResponse,
    VelocityAnalyticsResponse,
)
from app.services import instructor_service
from app.shared.source_enum import UserRole

router = APIRouter(prefix="/api/instructors", tags=["Instructor"])


# GD-84: Instructor dashboard stats endpoint

@router.get("/dashboard", response_model=InstructorDashboardResponse)
def get_dashboard(
    current_user: User = Depends(require_role([UserRole.INSTRUCTOR])),
    db: Session = Depends(get_db),
):
    """Aggregated dashboard data for the instructor intelligence dashboard."""
    data = instructor_service.get_instructor_dashboard(db, str(current_user.user_id))
    return InstructorDashboardResponse(**data)


# GD-85: Instructor subjects list endpoint

@router.get("/subjects", response_model=list[InstructorSubjectResponse])
def list_subjects(
    current_user: User = Depends(require_role([UserRole.INSTRUCTOR])),
    db: Session = Depends(get_db),
):
    """List all subjects assigned to this instructor, sorted by grade then name."""
    subjects = instructor_service.get_instructor_subjects(db, str(current_user.user_id))
    return [InstructorSubjectResponse(**s) for s in subjects]


# GD-86: Instructor subject detail with students

@router.get("/subjects/{subject_id}", response_model=InstructorSubjectDetailResponse)
def get_subject_detail(
    subject_id: int,
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=100),
    sort_by: str = Query("name", pattern="^(name|score|submissions)$"),
    current_user: User = Depends(require_role([UserRole.INSTRUCTOR])),
    db: Session = Depends(get_db),
):
    """Get subject detail with enrolled students and their progress."""
    if not instructor_service.verify_instructor_subject(db, str(current_user.user_id), subject_id):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You are not assigned to this subject",
        )

    data = instructor_service.get_instructor_subject_detail(
        db,
        str(current_user.user_id),
        subject_id,
        page=page,
        per_page=per_page,
        sort_by=sort_by,
    )
    if data is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Subject not found",
        )

    return InstructorSubjectDetailResponse(**data)


# GD-87: Assignment list & detail endpoints

@router.get("/assignments", response_model=PaginatedResponse[InstructorAssignmentResponse])
def list_assignments(
    subject_id: int | None = Query(None),
    status_filter: str | None = Query(None, alias="status", pattern="^(draft|published)$"),
    is_exam_mode: bool | None = Query(None),
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=100),
    current_user: User = Depends(require_role([UserRole.INSTRUCTOR])),
    db: Session = Depends(get_db),
):
    """List all assignments created by this instructor with filters."""
    items, total = instructor_service.get_instructor_assignments(
        db,
        str(current_user.user_id),
        subject_id=subject_id,
        status_filter=status_filter,
        is_exam_mode=is_exam_mode,
        page=page,
        per_page=per_page,
    )
    total_pages = (total + per_page - 1) // per_page if total else 0
    return PaginatedResponse(
        items=[InstructorAssignmentResponse(**a) for a in items],
        total=total,
        page=page,
        per_page=per_page,
        total_pages=total_pages,
    )


@router.get("/assignments/{assignment_id}", response_model=InstructorAssignmentDetailResponse)
def get_assignment(
    assignment_id: uuid.UUID,
    current_user: User = Depends(require_role([UserRole.INSTRUCTOR])),
    db: Session = Depends(get_db),
):
    """Get detailed assignment info with submission statistics."""
    data = instructor_service.get_assignment_detail(
        db, str(current_user.user_id), assignment_id,
    )
    if data is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Assignment not found",
        )
    return InstructorAssignmentDetailResponse(**data)


# GD-88: Assignment create, update, publish

@router.post("/assignments", response_model=InstructorAssignmentResponse, status_code=201)
def create_assignment(
    data: AssignmentCreateRequest,
    current_user: User = Depends(require_role([UserRole.INSTRUCTOR])),
    db: Session = Depends(get_db),
):
    """Create a new draft assignment for one of the instructor's subjects."""
    # Verify instructor is assigned to the subject
    if not instructor_service.verify_instructor_subject(db, str(current_user.user_id), data.subject_id):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You are not assigned to this subject",
        )

    assignment = instructor_service.create_assignment(
        db, str(current_user.user_id), data.model_dump(),
    )

    # Get subject/grade names for response
    detail = instructor_service.get_assignment_detail(
        db, str(current_user.user_id), assignment.assignment_id,
    )
    return InstructorAssignmentResponse(**detail)


@router.patch("/assignments/{assignment_id}", response_model=InstructorAssignmentResponse)
def update_assignment(
    assignment_id: uuid.UUID,
    data: AssignmentUpdateRequest,
    current_user: User = Depends(require_role([UserRole.INSTRUCTOR])),
    db: Session = Depends(get_db),
):
    """Update assignment fields. Only the creator can modify."""
    update_data = data.model_dump(exclude_unset=True)
    if not update_data:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No fields to update",
        )

    assignment = instructor_service.update_assignment(
        db, str(current_user.user_id), assignment_id, update_data,
    )
    if assignment is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Assignment not found",
        )

    detail = instructor_service.get_assignment_detail(
        db, str(current_user.user_id), assignment.assignment_id,
    )
    return InstructorAssignmentResponse(**detail)


@router.patch("/assignments/{assignment_id}/publish", response_model=InstructorAssignmentResponse)
def publish_assignment(
    assignment_id: uuid.UUID,
    current_user: User = Depends(require_role([UserRole.INSTRUCTOR])),
    db: Session = Depends(get_db),
):
    """Publish a draft assignment. Cannot re-publish already published assignments."""
    try:
        assignment = instructor_service.publish_assignment(
            db, str(current_user.user_id), assignment_id,
        )
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e),
        )

    if assignment is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Assignment not found",
        )

    detail = instructor_service.get_assignment_detail(
        db, str(current_user.user_id), assignment.assignment_id,
    )
    return InstructorAssignmentResponse(**detail)


# GD-89: Assignment delete

@router.delete("/assignments/{assignment_id}", status_code=204)
def delete_assignment(
    assignment_id: uuid.UUID,
    current_user: User = Depends(require_role([UserRole.INSTRUCTOR])),
    db: Session = Depends(get_db),
):
    """Delete a draft assignment with no submissions."""
    result = instructor_service.delete_assignment(
        db, str(current_user.user_id), assignment_id,
    )
    if result == "NOT_FOUND":
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Assignment not found",
        )
    if result is not None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=result,
        )
    return None


# GD-90: Instructor submissions list & detail

@router.get("/submissions", response_model=PaginatedResponse[InstructorSubmissionListItem])
def list_submissions(
    assignment_id: uuid.UUID | None = Query(None),
    student_id: uuid.UUID | None = Query(None),
    subject_id: int | None = Query(None),
    status_filter: str | None = Query(None, alias="status", pattern="^(queued|ocr|grading|done|rejected)$"),
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=100),
    current_user: User = Depends(require_role([UserRole.INSTRUCTOR])),
    db: Session = Depends(get_db),
):
    """List submissions for instructor's assignments with filters."""
    items, total = instructor_service.get_instructor_submissions(
        db,
        str(current_user.user_id),
        assignment_id=assignment_id,
        student_id=student_id,
        subject_id=subject_id,
        status_filter=status_filter,
        page=page,
        per_page=per_page,
    )
    total_pages = (total + per_page - 1) // per_page if total else 0
    return PaginatedResponse(
        items=[InstructorSubmissionListItem(**s) for s in items],
        total=total,
        page=page,
        per_page=per_page,
        total_pages=total_pages,
    )


@router.get("/submissions/{submission_id}", response_model=InstructorSubmissionDetailResponse)
def get_submission_detail(
    submission_id: uuid.UUID,
    current_user: User = Depends(require_role([UserRole.INSTRUCTOR])),
    db: Session = Depends(get_db),
):
    """Get detailed submission view with feedback."""
    data = instructor_service.get_submission_detail(
        db, str(current_user.user_id), submission_id,
    )
    if data is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Submission not found",
        )
    return InstructorSubmissionDetailResponse(**data)


# GD-91: Manual feedback/score override

@router.patch("/submissions/{submission_id}/feedback", response_model=InstructorSubmissionDetailResponse)
def override_feedback(
    submission_id: uuid.UUID,
    data: FeedbackOverrideRequest,
    current_user: User = Depends(require_role([UserRole.INSTRUCTOR])),
    db: Session = Depends(get_db),
):
    """Create or update instructor feedback on a submission."""
    result = instructor_service.override_submission_feedback(
        db,
        str(current_user.user_id),
        submission_id,
        data.model_dump(exclude_unset=True),
    )
    if result is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Submission not found or not accessible",
        )
    return InstructorSubmissionDetailResponse(**result)


# GD-92: Velocity analytics

@router.get("/analytics/velocity", response_model=VelocityAnalyticsResponse)
def get_velocity_analytics(
    subject_id: int | None = Query(None),
    current_user: User = Depends(require_role([UserRole.INSTRUCTOR])),
    db: Session = Depends(get_db),
):
    """Velocity analytics for instructor's subjects."""
    data = instructor_service.get_velocity_analytics(
        db, str(current_user.user_id), subject_id=subject_id,
    )
    return VelocityAnalyticsResponse(**data)


# GD-93: At-risk students

@router.get("/analytics/at-risk", response_model=PaginatedResponse[AtRiskStudentResponse])
def get_at_risk_students(
    subject_id: int | None = Query(None),
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=100),
    current_user: User = Depends(require_role([UserRole.INSTRUCTOR])),
    db: Session = Depends(get_db),
):
    """Identify at-risk students based on scores, missed assignments, inactivity."""
    items, total = instructor_service.get_at_risk_students(
        db,
        str(current_user.user_id),
        subject_id=subject_id,
        page=page,
        per_page=per_page,
    )
    total_pages = (total + per_page - 1) // per_page if total else 0
    return PaginatedResponse(
        items=[AtRiskStudentResponse(**s) for s in items],
        total=total,
        page=page,
        per_page=per_page,
        total_pages=total_pages,
    )
