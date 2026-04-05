"""Application-layer use cases for the authentication bounded context.

Each use case orchestrates a single user-facing operation: it calls the
underlying service, maps domain-level ValueError codes to HTTP exceptions,
and returns the appropriate response schema. No HTTP-specific concerns leak
into callers beyond the HTTPException type.
"""
from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.db.models.user import User
from app.schemas.user import (
    LoginResponse,
    MessageResponse,
    QrSessionResponse,
    QrStatusResponse,
    TokenResponse,
    TwoFactorSetupResponse,
)
from app.services import auth_service


def _raise_for_error(error: str, mapping: dict[str, tuple[int, str]]) -> None:
    """Raise an HTTPException matched from the error-code mapping.

    Falls back to HTTP 400 with the raw error string when the code is absent
    from the mapping, so no domain error escapes to the caller unhandled.
    """
    if error in mapping:
        code, detail = mapping[error]
        raise HTTPException(status_code=code, detail=detail)
    raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=error)


def execute_login(db: Session, email: str, password: str) -> LoginResponse:
    """Authenticate the user by email and password and return login tokens.

    Raises HTTPException for invalid credentials, disabled accounts, or
    temporarily locked accounts.
    """
    try:
        return auth_service.authenticate_user(db, email, password)
    except ValueError as exc:
        _raise_for_error(str(exc), {
            "INVALID_CREDENTIALS": (
                status.HTTP_401_UNAUTHORIZED,
                "Invalid email or password",
            ),
            "ACCOUNT_DISABLED": (
                status.HTTP_401_UNAUTHORIZED,
                "Account has been disabled",
            ),
            "ACCOUNT_LOCKED": (
                status.HTTP_423_LOCKED,
                "Account is temporarily locked due to too many failed login attempts."
                " Try again in 15 minutes.",
            ),
        })


def execute_refresh(db: Session, refresh_token: str) -> TokenResponse:
    """Rotate the refresh token and issue a fresh access/refresh token pair."""
    try:
        return auth_service.refresh_access_token(db, refresh_token)
    except ValueError as exc:
        _raise_for_error(str(exc), {
            "INVALID_TOKEN": (
                status.HTTP_401_UNAUTHORIZED,
                "Invalid or expired refresh token",
            ),
            "TOKEN_EXPIRED": (
                status.HTTP_401_UNAUTHORIZED,
                "Invalid or expired refresh token",
            ),
        })


def execute_logout(db: Session, user_id: str) -> MessageResponse:
    """Revoke all active sessions for the user and confirm the action."""
    auth_service.logout_user(db, user_id)
    return MessageResponse(message="Successfully logged out")


def execute_forgot_password(db: Session, email: str) -> MessageResponse:
    """Request a password-reset link; silently succeeds when the email is unknown."""
    token = auth_service.request_password_reset(db, email)
    if token:
        _send_reset_email(email, token)
    return MessageResponse(
        message=(
            "If an account with that email exists, "
            "a password reset link has been sent"
        )
    )


def _send_reset_email(email: str, token: str) -> None:
    """Dispatch the password-reset email via the email service."""
    from app.services.email_service import send_password_reset_email
    send_password_reset_email(email, token)


def execute_reset_password(
    db: Session, token: str, new_password: str
) -> MessageResponse:
    """Apply the password reset and return a success confirmation."""
    try:
        auth_service.reset_password(db, token, new_password)
        return MessageResponse(message="Password has been reset successfully")
    except ValueError as exc:
        _raise_for_error(str(exc), {
            "INVALID_TOKEN": (
                status.HTTP_400_BAD_REQUEST,
                "Invalid reset token",
            ),
            "TOKEN_ALREADY_USED": (
                status.HTTP_400_BAD_REQUEST,
                "This reset token has already been used",
            ),
            "TOKEN_EXPIRED": (
                status.HTTP_400_BAD_REQUEST,
                "Reset token has expired",
            ),
        })


def execute_change_password(
    db: Session,
    user: User,
    current_password: str,
    new_password: str,
) -> MessageResponse:
    """Verify and replace the user's password, returning a success confirmation."""
    try:
        auth_service.change_password(db, user, current_password, new_password)
        return MessageResponse(message="Password changed successfully")
    except ValueError as exc:
        _raise_for_error(str(exc), {
            "INVALID_CURRENT_PASSWORD": (
                status.HTTP_401_UNAUTHORIZED,
                "Current password is incorrect",
            ),
            "PASSWORD_TOO_SHORT": (
                status.HTTP_400_BAD_REQUEST,
                "New password must be at least 8 characters",
            ),
        })


def execute_setup_2fa(user: User) -> TwoFactorSetupResponse:
    """Generate a TOTP QR code and plaintext secret for the user to scan."""
    try:
        result = auth_service.setup_2fa(user)
        return TwoFactorSetupResponse(**result)
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)
        )


def execute_verify_2fa_setup(
    db: Session, user: User, secret: str, code: str
) -> MessageResponse:
    """Confirm the TOTP code and persist the secret to activate 2FA."""
    try:
        auth_service.verify_2fa_setup(db, user, secret, code)
        return MessageResponse(message="Two-factor authentication enabled successfully")
    except ValueError as exc:
        _raise_for_error(str(exc), {
            "INVALID_CODE": (
                status.HTTP_400_BAD_REQUEST,
                "Invalid verification code",
            ),
        })


def execute_validate_2fa(
    db: Session, user_id: str, code: str
) -> TokenResponse:
    """Validate the TOTP code and exchange it for full access/refresh tokens."""
    try:
        result = auth_service.validate_2fa(db, user_id, code)
        return TokenResponse(**result)
    except ValueError as exc:
        _raise_for_error(str(exc), {
            "2FA_NOT_ENABLED": (
                status.HTTP_400_BAD_REQUEST,
                "Two-factor authentication is not enabled",
            ),
            "INVALID_CODE": (
                status.HTTP_401_UNAUTHORIZED,
                "Invalid authentication code",
            ),
        })


def execute_disable_2fa(
    db: Session, user: User, code: str, password: str
) -> MessageResponse:
    """Disable TOTP after verifying the account password and a valid code."""
    try:
        auth_service.disable_2fa(db, user, code, password)
        return MessageResponse(message="Two-factor authentication disabled successfully")
    except ValueError as exc:
        _raise_for_error(str(exc), {
            "2FA_NOT_ENABLED": (
                status.HTTP_400_BAD_REQUEST,
                "Two-factor authentication is not enabled",
            ),
            "INVALID_PASSWORD": (
                status.HTTP_401_UNAUTHORIZED,
                "Invalid password",
            ),
            "INVALID_CODE": (
                status.HTTP_401_UNAUTHORIZED,
                "Invalid authentication code",
            ),
        })


def execute_create_qr_session(db: Session) -> QrSessionResponse:
    """Create a new QR-login session and return its session ID and encoded QR data."""
    try:
        result = auth_service.create_qr_session(db)
        return QrSessionResponse(**result)
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)
        )


def execute_scan_qr_session(
    db: Session, session_id: str, user: User
) -> MessageResponse:
    """Record that the authenticated user has scanned the QR session."""
    try:
        auth_service.scan_qr_session(db, session_id, user)
        return MessageResponse(message="QR code scanned successfully")
    except ValueError as exc:
        _raise_for_error(str(exc), {
            "SESSION_NOT_FOUND": (
                status.HTTP_404_NOT_FOUND,
                "QR session not found",
            ),
            "SESSION_EXPIRED": (
                status.HTTP_410_GONE,
                "QR session has expired",
            ),
            "SESSION_INVALID_STATE": (
                status.HTTP_409_CONFLICT,
                "QR session is not in a valid state",
            ),
        })


def execute_get_qr_status(db: Session, session_id: str) -> QrStatusResponse:
    """Return the current status and optional token payload for a QR session."""
    try:
        result = auth_service.get_qr_session_status(db, session_id)
        return QrStatusResponse(**result)
    except ValueError as exc:
        _raise_for_error(str(exc), {
            "SESSION_NOT_FOUND": (
                status.HTTP_404_NOT_FOUND,
                "QR session not found",
            ),
        })


def execute_authenticate_qr(
    db: Session, session_id: str, user: User
) -> dict:
    """Complete QR authentication and return the resulting access tokens."""
    try:
        return auth_service.authenticate_qr_session(db, session_id, user)
    except ValueError as exc:
        _raise_for_error(str(exc), {
            "SESSION_NOT_FOUND": (
                status.HTTP_404_NOT_FOUND,
                "QR session not found",
            ),
            "SESSION_INVALID_STATE": (
                status.HTTP_409_CONFLICT,
                "QR session is not in a valid state",
            ),
            "SESSION_USER_MISMATCH": (
                status.HTTP_403_FORBIDDEN,
                "Session user mismatch",
            ),
        })
