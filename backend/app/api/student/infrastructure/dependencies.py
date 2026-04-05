"""Infrastructure dependencies for the student bounded context.

Re-exports the shared authentication dependencies from the auth infrastructure
layer so that student route handlers have a single, consistent import path
within their own bounded context.
"""
from app.api.auth.infrastructure.dependencies import get_current_user, require_role

__all__ = ["get_current_user", "require_role"]
