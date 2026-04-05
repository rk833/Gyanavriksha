"""Presentation layer for the authentication bounded context.

Route handlers are intentionally thin: they receive the HTTP request, delegate
immediately to the application-layer use cases, and return the result. All
business logic, error mapping, and response construction live in the
application layer.
"""
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.api.auth.application import service
from app.api.auth.infrastructure.dependencies import get_current_user
from app.core.database import get_db
from app.db.models.user import User
from app.schemas.user import (
    ChangePasswordRequest,
    ForgotPasswordRequest,
    LoginResponse,
    MessageResponse,
    QrAuthenticateRequest,
    QrScanRequest,
    QrSessionResponse,
    QrStatusResponse,
    ResetPasswordRequest,
    TokenRefreshRequest,
    TokenResponse,
    TwoFactorDisableRequest,
    TwoFactorSetupResponse,
    TwoFactorSetupVerifyRequest,
    TwoFactorValidateRequest,
    UserLoginRequest,
    UserResponse,
)

router = APIRouter(prefix="/api/auth", tags=["Authentication"])


@router.post("/login", response_model=LoginResponse)
def login(
    data: UserLoginRequest,
    db: Session = Depends(get_db),
):
    """Authenticate a user by email and password and return access/refresh tokens."""
    return service.execute_login(db, data.email, data.password)


@router.post("/refresh", response_model=TokenResponse)
def refresh(
    data: TokenRefreshRequest,
    db: Session = Depends(get_db),
):
    """Rotate the refresh token and issue a new access/refresh token pair."""
    return service.execute_refresh(db, data.refresh_token)


@router.post("/logout", response_model=MessageResponse)
def logout(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Revoke all active sessions for the currently authenticated user."""
    return service.execute_logout(db, str(current_user.user_id))


@router.get("/me", response_model=UserResponse)
def get_me(current_user: User = Depends(get_current_user)):
    """Return the profile of the currently authenticated user."""
    return UserResponse.model_validate(current_user)


@router.post("/forgot-password", response_model=MessageResponse)
def forgot_password(
    data: ForgotPasswordRequest,
    db: Session = Depends(get_db),
):
    """Send a password-reset link to the provided email address."""
    return service.execute_forgot_password(db, data.email)


@router.post("/reset-password", response_model=MessageResponse)
def reset_password(
    data: ResetPasswordRequest,
    db: Session = Depends(get_db),
):
    """Apply a password reset using the supplied token and new password."""
    return service.execute_reset_password(db, data.token, data.new_password)


@router.post("/change-password", response_model=MessageResponse)
def change_password(
    data: ChangePasswordRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Change the authenticated user's password after verifying the current one."""
    return service.execute_change_password(
        db, current_user, data.current_password, data.new_password
    )


@router.post("/2fa/setup", response_model=TwoFactorSetupResponse)
def setup_2fa(current_user: User = Depends(get_current_user)):
    """Generate a TOTP secret and QR code for the authenticated user to configure."""
    return service.execute_setup_2fa(current_user)


@router.post("/2fa/verify", response_model=MessageResponse)
def verify_2fa_setup(
    data: TwoFactorSetupVerifyRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Confirm the scanned TOTP code and activate two-factor authentication."""
    return service.execute_verify_2fa_setup(
        db, current_user, data.secret, data.code
    )


@router.post("/2fa/validate", response_model=TokenResponse)
def validate_2fa(
    data: TwoFactorValidateRequest,
    db: Session = Depends(get_db),
):
    """Validate a TOTP code at login time and return full access/refresh tokens."""
    return service.execute_validate_2fa(db, str(data.user_id), data.code)


@router.post("/2fa/disable", response_model=MessageResponse)
def disable_2fa(
    data: TwoFactorDisableRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Disable two-factor authentication after verifying the account password and code."""
    return service.execute_disable_2fa(
        db, current_user, data.code, data.password
    )


@router.post("/qr/create", response_model=QrSessionResponse)
def create_qr_session(db: Session = Depends(get_db)):
    """Create a new QR-login session and return its session ID and QR payload."""
    return service.execute_create_qr_session(db)


@router.post("/qr/scan")
def scan_qr_session(
    data: QrScanRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Record that the authenticated user has scanned the given QR session."""
    return service.execute_scan_qr_session(
        db, str(data.session_id), current_user
    )


@router.get("/qr/status/{session_id}", response_model=QrStatusResponse)
def get_qr_status(
    session_id: str,
    db: Session = Depends(get_db),
):
    """Poll the authentication status of a QR-login session."""
    return service.execute_get_qr_status(db, session_id)


@router.post("/qr/authenticate")
def authenticate_qr(
    data: QrAuthenticateRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Finalise QR authentication and return the resulting access tokens."""
    return service.execute_authenticate_qr(
        db, str(data.session_id), current_user
    )
