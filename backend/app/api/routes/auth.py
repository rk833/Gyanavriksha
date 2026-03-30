from fastapi import APIRouter, Depends, HTTPException, Request, status  # type: ignore
from fastapi.security import OAuth2PasswordBearer  # type: ignore
from sqlalchemy.orm import Session

from app.api.middleware.rate_limiter import limiter
from app.core.database import get_db
from app.core.security import decode_token
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
from app.services import auth_service

router = APIRouter(prefix="/api/auth", tags=["Authentication"])

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/auth/login")


# Auth dependency

def get_current_user(
    token: str = Depends(oauth2_scheme),
    db: Session = Depends(get_db),
) -> User:
    payload = decode_token(token)
    if not payload or payload.get("type") != "access":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token",
            headers={"WWW-Authenticate": "Bearer"},
        )

    user = auth_service.get_user_by_id(db, payload["sub"])
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


# POST /api/auth/login

@router.post("/login", response_model=LoginResponse)
@limiter.limit("5/minute")
def login(request: Request, data: UserLoginRequest, db: Session = Depends(get_db)):
    try:
        result = auth_service.authenticate_user(db, data.email, data.password)
        return result
    except ValueError as e:
        error = str(e)
        if error == "INVALID_CREDENTIALS":
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid email or password",
            )
        if error == "ACCOUNT_DISABLED":
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Account has been disabled",
            )
        if error == "ACCOUNT_LOCKED":
            raise HTTPException(
                status_code=status.HTTP_423_LOCKED,
                detail="Account is temporarily locked due to too many failed login attempts. Try again in 15 minutes.",
            )
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=error)


# POST /api/auth/refresh

@router.post("/refresh", response_model=TokenResponse)
def refresh(data: TokenRefreshRequest, db: Session = Depends(get_db)):
    try:
        return auth_service.refresh_access_token(db, data.refresh_token)
    except ValueError as e:
        error = str(e)
        if error in ("INVALID_TOKEN", "TOKEN_EXPIRED"):
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid or expired refresh token",
            )
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=error)


# POST /api/auth/logout

@router.post("/logout", response_model=MessageResponse)
def logout(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    auth_service.logout_user(db, str(current_user.user_id))
    return MessageResponse(message="Successfully logged out")


# GET /api/auth/me

@router.get("/me", response_model=UserResponse)
def get_me(current_user: User = Depends(get_current_user)):
    return UserResponse.model_validate(current_user)


# Password reset

@router.post("/forgot-password", response_model=MessageResponse)
@limiter.limit("3/minute")
def forgot_password(request: Request, data: ForgotPasswordRequest, db: Session = Depends(get_db)):
    token = auth_service.request_password_reset(db, data.email)
    if token:
        from app.services.email_service import send_password_reset_email
        send_password_reset_email(data.email, token)
    return MessageResponse(message="If an account with that email exists, a password reset link has been sent")


@router.post("/reset-password", response_model=MessageResponse)
def reset_password(data: ResetPasswordRequest, db: Session = Depends(get_db)):
    try:
        auth_service.reset_password(db, data.token, data.new_password)
        return MessageResponse(message="Password has been reset successfully")
    except ValueError as e:
        error = str(e)
        if error == "INVALID_TOKEN":
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid reset token")
        if error == "TOKEN_ALREADY_USED":
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="This reset token has already been used")
        if error == "TOKEN_EXPIRED":
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Reset token has expired")
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=error)


@router.post("/change-password", response_model=MessageResponse)
def change_password(
    data: ChangePasswordRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    try:
        auth_service.change_password(db, current_user, data.current_password, data.new_password)
        return MessageResponse(message="Password changed successfully")
    except ValueError as e:
        error = str(e)
        if error == "INVALID_CURRENT_PASSWORD":
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Current password is incorrect")
        if error == "PASSWORD_TOO_SHORT":
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="New password must be at least 8 characters")
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=error)


# 2FA (TOTP) endpoints

@router.post("/2fa/setup", response_model=TwoFactorSetupResponse)
def setup_2fa(current_user: User = Depends(get_current_user)):
    try:
        result = auth_service.setup_2fa(current_user)
        return TwoFactorSetupResponse(**result)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.post("/2fa/verify", response_model=MessageResponse)
def verify_2fa_setup(
    data: TwoFactorSetupVerifyRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    try:
        auth_service.verify_2fa_setup(db, current_user, data.secret, data.code)
        return MessageResponse(message="Two-factor authentication enabled successfully")
    except ValueError as e:
        error = str(e)
        if error == "INVALID_CODE":
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid verification code")
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=error)


@router.post("/2fa/validate", response_model=TokenResponse)
@limiter.limit("5/minute")
def validate_2fa(request: Request, data: TwoFactorValidateRequest, db: Session = Depends(get_db)):
    try:
        result = auth_service.validate_2fa(db, str(data.user_id), data.code)
        return TokenResponse(**result)
    except ValueError as e:
        error = str(e)
        if error == "2FA_NOT_ENABLED":
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Two-factor authentication is not enabled")
        if error == "INVALID_CODE":
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid authentication code")
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=error)


@router.post("/2fa/disable", response_model=MessageResponse)
def disable_2fa(
    data: TwoFactorDisableRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    try:
        auth_service.disable_2fa(db, current_user, data.code, data.password)
        return MessageResponse(message="Two-factor authentication disabled successfully")
    except ValueError as e:
        error = str(e)
        if error == "2FA_NOT_ENABLED":
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Two-factor authentication is not enabled")
        if error == "INVALID_PASSWORD":
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid password")
        if error == "INVALID_CODE":
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid authentication code")
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=error)


# QR Login endpoints

@router.post("/qr/create", response_model=QrSessionResponse)
def create_qr_session(db: Session = Depends(get_db)):
    try:
        result = auth_service.create_qr_session(db)
        return QrSessionResponse(**result)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.post("/qr/scan")
def scan_qr_session(
    data: QrScanRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    try:
        auth_service.scan_qr_session(db, str(data.session_id), current_user)
        return MessageResponse(message="QR code scanned successfully")
    except ValueError as e:
        error = str(e)
        if error == "SESSION_NOT_FOUND":
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="QR session not found")
        if error == "SESSION_EXPIRED":
            raise HTTPException(status_code=status.HTTP_410_GONE, detail="QR session has expired")
        if error == "SESSION_INVALID_STATE":
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="QR session is not in a valid state")
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=error)


@router.get("/qr/status/{session_id}", response_model=QrStatusResponse)
def get_qr_status(session_id: str, db: Session = Depends(get_db)):
    try:
        result = auth_service.get_qr_session_status(db, session_id)
        return QrStatusResponse(**result)
    except ValueError as e:
        error = str(e)
        if error == "SESSION_NOT_FOUND":
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="QR session not found")
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=error)


@router.post("/qr/authenticate")
def authenticate_qr(
    data: QrAuthenticateRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    try:
        result = auth_service.authenticate_qr_session(db, str(data.session_id), current_user)
        return result
    except ValueError as e:
        error = str(e)
        if error == "SESSION_NOT_FOUND":
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="QR session not found")
        if error == "SESSION_INVALID_STATE":
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="QR session is not in a valid state")
        if error == "SESSION_USER_MISMATCH":
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Session user mismatch")
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=error)
