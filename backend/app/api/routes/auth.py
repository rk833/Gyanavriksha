from fastapi import APIRouter, Depends, HTTPException, status  # type: ignore
from fastapi.security import OAuth2PasswordBearer  # type: ignore
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.security import decode_token
from app.db.models.user import User
from app.schemas.user import (
    ForgotPasswordRequest,
    LoginResponse,
    MessageResponse,
    ResendVerificationRequest,
    ResetPasswordRequest,
    TokenRefreshRequest,
    TokenResponse,
    UserLoginRequest,
    UserRegisterRequest,
    UserResponse,
    VerifyEmailRequest,
)
from app.services import auth_service

router = APIRouter(prefix="/api/auth", tags=["Authentication"])

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/auth/login")


#  Auth dependency


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


# POST /api/auth/register 


@router.post(
    "/register",
    response_model=UserResponse,
    status_code=status.HTTP_201_CREATED,
)
def register(data: UserRegisterRequest, db: Session = Depends(get_db)):
    try:
        user = auth_service.register_user(db, data)
        return UserResponse.model_validate(user)
    except ValueError as e:
        if str(e) == "EMAIL_EXISTS":
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="An account with this email already exists",
            )
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


# POST /api/auth/login 


@router.post("/login", response_model=LoginResponse)
def login(data: UserLoginRequest, db: Session = Depends(get_db)):
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


# Email verification

@router.post("/verify-email", response_model=MessageResponse)
def verify_email(data: VerifyEmailRequest, db: Session = Depends(get_db)):
    try:
        auth_service.verify_email(db, data.token)
        return MessageResponse(message="Email verified successfully")
    except ValueError as e:
        error = str(e)
        if error == "INVALID_TOKEN":
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid verification token")
        if error == "TOKEN_ALREADY_USED":
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="This token has already been used")
        if error == "TOKEN_EXPIRED":
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Verification token has expired")
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=error)


@router.post("/resend-verification", response_model=MessageResponse)
def resend_verification(data: ResendVerificationRequest, db: Session = Depends(get_db)):
    try:
        token = auth_service.resend_verification(db, data.email)
        if token:
            from app.services.email_service import send_verification_email
            send_verification_email(data.email, token)
        return MessageResponse(message="If your email is registered and unverified, a new verification email has been sent")
    except ValueError as e:
        error = str(e)
        if error == "ALREADY_VERIFIED":
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Email is already verified")
        # Don't reveal if user exists or not
        return MessageResponse(message="If your email is registered and unverified, a new verification email has been sent")


# Password reset

@router.post("/forgot-password", response_model=MessageResponse)
def forgot_password(data: ForgotPasswordRequest, db: Session = Depends(get_db)):
    token = auth_service.request_password_reset(db, data.email)
    if token:
        from app.services.email_service import send_password_reset_email
        send_password_reset_email(data.email, token)
    # Always return 200 to prevent email enumeration
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
