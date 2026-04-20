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
    BulkUserIdsRequest,
    EnrollmentResponse,
    RoleChangeRequest,
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
