"""Authentication middleware shim.

The canonical implementations of ``get_current_user`` and ``require_role``
live in the auth infrastructure layer. This module re-exports them so that
any existing import paths continue to resolve without modification.
"""
from app.api.auth.infrastructure.dependencies import (  # noqa: F401
    get_current_user,
    require_role,
)
