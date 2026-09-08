"""Infrastructure dependencies for the analytics bounded context.

Re-exports shared authentication dependencies so that analytics route handlers
have a single, consistent import path within their own bounded context.
"""
from app.api.auth.infrastructure.dependencies import get_current_user, require_role

__all__ = ["get_current_user", "require_role"]
