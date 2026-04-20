"""Presentation layer for the admin bounded context.

Route handlers declare HTTP contracts and immediately delegate to the
application-layer use cases. No business logic occurs here.
"""
import uuid
from typing import Optional

from fastapi import APIRouter, Depends, Request, status
from sqlalchemy.orm import Session

from app.api.admin.infrastructure.dependencies import require_role
from app.api.admin.application import service
from app.core.database import get_db
from app.db.models.user import User
from app.schemas.admin import (
    AdminDashboardResponse,
    AdminUserCreateRequest,
    AdminUserCreateResponse,
    AdminUserListResponse,
    AdminUserResponse,
    AdminUserUpdateRequest,
    AssignInstructorRequest,
    BulkEnrollmentResponse,
    BulkUserIdsRequest,
    EnrollmentBulkCreateRequest,
    EnrollmentCreateRequest,
    EnrollmentListResponse,
    EnrollmentResponse,
    GradeCreateRequest,
    GradeResponse,
    GradeUpdateRequest,
    RoleChangeRequest,
    SubjectCreateRequest,
    SubjectResponse,
    SubjectUpdateRequest,
)
from app.shared.source_enum import UserRole

router = APIRouter(prefix="/api/admin", tags=["Admin"])


def _ip(request: Request) -> str | None:
    """Extract the client IP address from the request."""
    forwarded = request.headers.get("X-Forwarded-For")
    return forwarded.split(",")[0].strip() if forwarded else request.client.host


@router.get("/dashboard", response_model=AdminDashboardResponse)
def get_dashboard(
    current_user: User = Depends(require_role([UserRole.ADMIN])),
    db: Session = Depends(get_db),
):
    """Return the aggregated admin control panel overview."""
    return service.get_dashboard(db)


@router.get("/users", response_model=AdminUserListResponse)
def list_users(
    role: Optional[UserRole] = None,
    is_active: Optional[bool] = None,
    search: Optional[str] = None,
    grade_id: Optional[int] = None,
    page: int = 1,
    per_page: int = 20,
    current_user: User = Depends(require_role([UserRole.ADMIN])),
    db: Session = Depends(get_db),
):
    """Return a paginated, filtered list of all platform users."""
    return service.list_users(db, role, is_active, search, grade_id, page, per_page)


@router.get("/users/pending-enrollments", response_model=list[EnrollmentResponse])
def get_pending_enrollments(
    current_user: User = Depends(require_role([UserRole.ADMIN])),
    db: Session = Depends(get_db),
):
    """Return all enrollments awaiting admin approval."""
    return service.get_pending_enrollments(db)


@router.patch("/users/enrollments/{enrollment_id}/approve", response_model=EnrollmentResponse)
def approve_enrollment(
    enrollment_id: uuid.UUID,
    request: Request,
    current_user: User = Depends(require_role([UserRole.ADMIN])),
    db: Session = Depends(get_db),
):
    """Approve a pending enrollment by activating it."""
    return service.approve_enrollment(db, enrollment_id, current_user.user_id, _ip(request))


@router.post("/users", response_model=AdminUserCreateResponse, status_code=status.HTTP_201_CREATED)
def create_user(
    body: AdminUserCreateRequest,
    request: Request,
    current_user: User = Depends(require_role([UserRole.ADMIN])),
    db: Session = Depends(get_db),
):
    """Create a new platform user and return the one-time generated password."""
    return service.create_user(
        db,
        email=body.email,
        full_name=body.full_name,
        role=body.role,
        raw_password=body.password,
        actor_id=current_user.user_id,
        ip_address=_ip(request),
    )


@router.post("/users/bulk-suspend")
def bulk_suspend(
    body: BulkUserIdsRequest,
    current_user: User = Depends(require_role([UserRole.ADMIN])),
    db: Session = Depends(get_db),
):
    """Suspend multiple user accounts in a single operation."""
    return service.bulk_suspend_users(db, body.user_ids, current_user.user_id)


@router.post("/users/bulk-delete")
def bulk_delete(
    body: BulkUserIdsRequest,
    current_user: User = Depends(require_role([UserRole.ADMIN])),
    db: Session = Depends(get_db),
):
    """Soft-delete multiple user accounts in a single operation."""
    return service.bulk_delete_users(db, body.user_ids, current_user.user_id)


@router.get("/users/{user_id}", response_model=AdminUserResponse)
def get_user(
    user_id: uuid.UUID,
    current_user: User = Depends(require_role([UserRole.ADMIN])),
    db: Session = Depends(get_db),
):
    """Return full profile detail for a single user."""
    return service.get_user(db, user_id)


@router.patch("/users/{user_id}", response_model=AdminUserResponse)
def update_user(
    user_id: uuid.UUID,
    body: AdminUserUpdateRequest,
    request: Request,
    current_user: User = Depends(require_role([UserRole.ADMIN])),
    db: Session = Depends(get_db),
):
    """Partially update a user's profile fields."""
    return service.update_user(
        db,
        user_id=user_id,
        full_name=body.full_name,
        is_active=body.is_active,
        profile_image_url=body.profile_image_url,
        actor_id=current_user.user_id,
        ip_address=_ip(request),
    )


@router.patch("/users/{user_id}/suspend", response_model=AdminUserResponse)
def suspend_user(
    user_id: uuid.UUID,
    request: Request,
    current_user: User = Depends(require_role([UserRole.ADMIN])),
    db: Session = Depends(get_db),
):
    """Suspend a user account."""
    return service.suspend_user(db, user_id, current_user.user_id, _ip(request))


@router.patch("/users/{user_id}/reactivate", response_model=AdminUserResponse)
def reactivate_user(
    user_id: uuid.UUID,
    request: Request,
    current_user: User = Depends(require_role([UserRole.ADMIN])),
    db: Session = Depends(get_db),
):
    """Reactivate a suspended user account."""
    return service.reactivate_user(db, user_id, current_user.user_id, _ip(request))


@router.delete("/users/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_user(
    user_id: uuid.UUID,
    request: Request,
    current_user: User = Depends(require_role([UserRole.ADMIN])),
    db: Session = Depends(get_db),
):
    """Soft-delete a user account."""
    service.delete_user(db, user_id, current_user.user_id, _ip(request))


@router.post("/users/{user_id}/reset-password")
def reset_password(
    user_id: uuid.UUID,
    request: Request,
    current_user: User = Depends(require_role([UserRole.ADMIN])),
    db: Session = Depends(get_db),
):
    """Force-reset a user's password and email the new credentials."""
    return service.force_reset_password(db, user_id, current_user.user_id, _ip(request))


@router.patch("/users/{user_id}/role", response_model=AdminUserResponse)
def change_role(
    user_id: uuid.UUID,
    body: RoleChangeRequest,
    request: Request,
    current_user: User = Depends(require_role([UserRole.ADMIN])),
    db: Session = Depends(get_db),
):
    """Change a user's platform role with optional instructor subject assignment."""
    return service.change_role(
        db,
        user_id=user_id,
        new_role=body.role,
        subject_ids=body.subject_ids,
        actor_id=current_user.user_id,
        ip_address=_ip(request),
    )


@router.get("/grades", response_model=list[GradeResponse])
def list_grades(
    current_user: User = Depends(require_role([UserRole.ADMIN])),
    db: Session = Depends(get_db),
):
    """Return all grades sorted by level with subject and student counts."""
    return service.list_grades(db)


@router.post("/grades", response_model=GradeResponse, status_code=status.HTTP_201_CREATED)
def create_grade(
    body: GradeCreateRequest,
    request: Request,
    current_user: User = Depends(require_role([UserRole.ADMIN])),
    db: Session = Depends(get_db),
):
    """Create a new academic grade."""
    return service.create_grade(db, body.grade_name, body.grade_level, body.description, current_user.user_id, _ip(request))


@router.patch("/grades/{grade_id}", response_model=GradeResponse)
def update_grade(
    grade_id: int,
    body: GradeUpdateRequest,
    request: Request,
    current_user: User = Depends(require_role([UserRole.ADMIN])),
    db: Session = Depends(get_db),
):
    """Update a grade's name or description."""
    return service.update_grade(db, grade_id, body.grade_name, body.description, current_user.user_id, _ip(request))


@router.delete("/grades/{grade_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_grade(
    grade_id: int,
    request: Request,
    current_user: User = Depends(require_role([UserRole.ADMIN])),
    db: Session = Depends(get_db),
):
    """Delete a grade only when no subjects or enrollments are linked."""
    service.delete_grade(db, grade_id, current_user.user_id, _ip(request))


@router.get("/subjects", response_model=list[SubjectResponse])
def list_subjects(
    grade_id: Optional[int] = None,
    search: Optional[str] = None,
    current_user: User = Depends(require_role([UserRole.ADMIN])),
    db: Session = Depends(get_db),
):
    """Return subjects optionally filtered by grade or name search."""
    return service.list_subjects(db, grade_id, search)


@router.post("/subjects", response_model=SubjectResponse, status_code=status.HTTP_201_CREATED)
def create_subject(
    body: SubjectCreateRequest,
    request: Request,
    current_user: User = Depends(require_role([UserRole.ADMIN])),
    db: Session = Depends(get_db),
):
    """Create a new subject with an auto-generated ChromaDB namespace."""
    return service.create_subject(
        db, body.name, body.subject_code, body.description, body.grade_id,
        body.instructor_id, current_user.user_id, _ip(request),
    )


@router.patch("/subjects/{subject_id}", response_model=SubjectResponse)
def update_subject(
    subject_id: int,
    body: SubjectUpdateRequest,
    request: Request,
    current_user: User = Depends(require_role([UserRole.ADMIN])),
    db: Session = Depends(get_db),
):
    """Update a subject's name or description."""
    return service.update_subject(db, subject_id, body.name, body.description, current_user.user_id, _ip(request))


@router.delete("/subjects/{subject_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_subject(
    subject_id: int,
    request: Request,
    current_user: User = Depends(require_role([UserRole.ADMIN])),
    db: Session = Depends(get_db),
):
    """Delete a subject only when no active enrollments exist."""
    service.delete_subject(db, subject_id, current_user.user_id, _ip(request))


@router.post("/subjects/{subject_id}/assign-instructor", response_model=SubjectResponse)
def assign_instructor(
    subject_id: int,
    body: AssignInstructorRequest,
    request: Request,
    current_user: User = Depends(require_role([UserRole.ADMIN])),
    db: Session = Depends(get_db),
):
    """Assign an instructor to a subject."""
    return service.assign_instructor(db, subject_id, body.instructor_id, current_user.user_id, _ip(request))


@router.get("/enrollments", response_model=EnrollmentListResponse)
def list_enrollments(
    student_id: Optional[uuid.UUID] = None,
    subject_id: Optional[int] = None,
    grade_id: Optional[int] = None,
    enrollment_status: Optional[str] = None,
    page: int = 1,
    per_page: int = 20,
    current_user: User = Depends(require_role([UserRole.ADMIN])),
    db: Session = Depends(get_db),
):
    """Return a paginated, filtered enrollment list."""
    return service.list_enrollments(db, student_id, subject_id, grade_id, enrollment_status, page, per_page)


@router.post("/enrollments/bulk", response_model=BulkEnrollmentResponse)
def bulk_enroll(
    body: EnrollmentBulkCreateRequest,
    request: Request,
    current_user: User = Depends(require_role([UserRole.ADMIN])),
    db: Session = Depends(get_db),
):
    """Bulk-enroll multiple students into one subject."""
    return service.bulk_enroll(db, body.student_ids, body.subject_id, current_user.user_id, _ip(request))


@router.post("/enrollments", response_model=EnrollmentResponse, status_code=status.HTTP_201_CREATED)
def create_enrollment(
    body: EnrollmentCreateRequest,
    request: Request,
    current_user: User = Depends(require_role([UserRole.ADMIN])),
    db: Session = Depends(get_db),
):
    """Create a single student enrollment."""
    return service.create_enrollment(db, body.student_id, body.subject_id, current_user.user_id, _ip(request))


@router.delete("/enrollments/{enrollment_id}", status_code=status.HTTP_204_NO_CONTENT)
def remove_enrollment(
    enrollment_id: uuid.UUID,
    request: Request,
    current_user: User = Depends(require_role([UserRole.ADMIN])),
    db: Session = Depends(get_db),
):
    """Soft-delete an enrollment when no submissions exist."""
    service.remove_enrollment(db, enrollment_id, current_user.user_id, _ip(request))
