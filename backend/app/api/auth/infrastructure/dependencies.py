"""FastAPI dependency providers for the authentication infrastructure layer.

These callables are injected via FastAPI's ``Depends`` mechanism and centralise
token decoding, user resolution, and role-based access control so that every
bounded context imports from one authoritative location.
"""
from typing import Callable

from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.security import decode_token
from app.db.models.user import User
from app.shared.source_enum import UserRole

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/auth/login")


def _validate_access_token(token: str) -> dict:
    """Decode and validate a Bearer token, raising HTTP 401 when invalid."""
    payload = decode_token(token)
    if not payload or payload.get("type") != "access":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token",
            headers={"WWW-Authenticate": "Bearer"},
        )
    return payload


def _resolve_user_id(payload: dict) -> str:
    """Extract the subject claim from a decoded token payload.

    Raises HTTP 401 when the ``sub`` field is absent or empty.
    """
    user_id = payload.get("sub")
    if not user_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token payload",
            headers={"WWW-Authenticate": "Bearer"},
        )
    return user_id


def _fetch_active_user(db: Session, user_id: str) -> User:
    """Load the user record from the database and assert the account is active.

    Raises HTTP 401 when the user does not exist or when the account has been
    disabled by an administrator.
    """
    user = db.query(User).filter(User.user_id == user_id).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found",
            headers={"WWW-Authenticate": "Bearer"},
        )
    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Account disabled",
            headers={"WWW-Authenticate": "Bearer"},
        )
    return user


def get_current_user(
    token: str = Depends(oauth2_scheme),
    db: Session = Depends(get_db),
) -> User:
    """FastAPI dependency that resolves the authenticated user from the Bearer token."""
    payload = _validate_access_token(token)
    user_id = _resolve_user_id(payload)
    return _fetch_active_user(db, user_id)


def require_role(allowed_roles: list[UserRole]) -> Callable:
    """Return a FastAPI dependency that enforces membership in one of the allowed roles.

    The returned callable itself serves as a ``Depends`` target and yields the
    authenticated user when the role check passes.
    """
    def _role_checker(current_user: User = Depends(get_current_user)) -> User:
        """Verify the current user's role against the allowed set, raising HTTP 403 on failure."""
        if current_user.role not in allowed_roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You do not have permission to access this resource",
            )
        return current_user
    return _role_checker
