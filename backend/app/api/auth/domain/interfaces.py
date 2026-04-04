"""Domain-level protocols for the authentication bounded context.

These protocols define the contracts that the application layer depends on,
enabling loose coupling between layers and facilitating unit testing without
requiring concrete infrastructure implementations.
"""
from typing import Protocol

from sqlalchemy.orm import Session

from app.db.models.user import User


class IAuthService(Protocol):
    """Protocol defining the contract for all authentication operations."""

    def authenticate_user(self, db: Session, email: str, password: str) -> dict:
        """Authenticate a user by credentials and return token data or raise ValueError."""
        ...

    def refresh_access_token(self, db: Session, refresh_token: str) -> dict:
        """Issue a new access token from a valid refresh token or raise ValueError."""
        ...

    def logout_user(self, db: Session, user_id: str) -> None:
        """Revoke all active refresh tokens for the given user."""
        ...

    def get_user_by_id(self, db: Session, user_id: str) -> "User | None":
        """Retrieve a user record by primary key, returning None if absent."""
        ...

    def request_password_reset(self, db: Session, email: str) -> "str | None":
        """Generate a password-reset token and return it, or None when the email is unknown."""
        ...

    def reset_password(self, db: Session, token: str, new_password: str) -> None:
        """Validate the reset token and replace the user's password or raise ValueError."""
        ...

    def change_password(
        self, db: Session, user: User, current_password: str, new_password: str
    ) -> None:
        """Verify the current password and replace it with the new value or raise ValueError."""
        ...

    def setup_2fa(self, user: User) -> dict:
        """Generate a TOTP secret and QR code URI for the given user."""
        ...

    def verify_2fa_setup(
        self, db: Session, user: User, secret: str, code: str
    ) -> None:
        """Confirm a TOTP code and persist the secret on the user record or raise ValueError."""
        ...

    def validate_2fa(self, db: Session, user_id: str, code: str) -> dict:
        """Validate a TOTP code and return access/refresh tokens or raise ValueError."""
        ...

    def disable_2fa(
        self, db: Session, user: User, code: str, password: str
    ) -> None:
        """Disable TOTP after verifying the user's password and a valid code, or raise ValueError."""
        ...

    def create_qr_session(self, db: Session) -> dict:
        """Create a new QR-login session and return its metadata."""
        ...

    def scan_qr_session(
        self, db: Session, session_id: str, user: User
    ) -> None:
        """Mark a QR session as scanned by the authenticated user or raise ValueError."""
        ...

    def get_qr_session_status(self, db: Session, session_id: str) -> dict:
        """Return the current status and optional token payload for a QR session."""
        ...

    def authenticate_qr_session(
        self, db: Session, session_id: str, user: User
    ) -> dict:
        """Confirm and complete QR authentication, returning access tokens or raising ValueError."""
        ...
