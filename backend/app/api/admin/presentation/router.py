"""Presentation layer for the admin bounded context.

Route handlers declare HTTP contracts and immediately delegate to the
application-layer use cases. No business logic occurs here.
"""
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.api.admin.infrastructure.dependencies import require_role
from app.api.admin.application import service
from app.core.database import get_db
from app.db.models.user import User
from app.schemas.admin import AdminDashboardResponse
from app.shared.source_enum import UserRole

router = APIRouter(prefix="/api/admin", tags=["Admin"])


@router.get("/dashboard", response_model=AdminDashboardResponse)
def get_dashboard(
    current_user: User = Depends(require_role([UserRole.ADMIN])),
    db: Session = Depends(get_db),
):
    """Return the aggregated admin control panel overview."""
    return service.get_dashboard(db)
