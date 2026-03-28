from datetime import datetime, timedelta, timezone

from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.security import (
    create_access_token,
    create_refresh_token,
    decode_token,
    generate_verification_token,
    hash_password,
    hash_token,
    verify_password,
    verify_token_hash,
)
from app.db.models.email_verification import EmailVerification
from app.db.models.refresh_token import RefreshToken
from app.db.models.user import User
from app.schemas.user import (
    LoginResponse,
    TokenResponse,
    UserRegisterRequest,
    UserResponse,
)
from app.shared.source_enum import EmailVerificationType


# Registration 


def register_user(db: Session, data: UserRegisterRequest) -> User:
    existing = db.query(User).filter(User.email == data.email).first()
    if existing:
        raise ValueError("EMAIL_EXISTS")

    user = User(
        email=data.email,
        password_hash=hash_password(data.password),
        full_name=data.full_name,
        role=data.role,
    )
    db.add(user)
    db.flush()

    # Create email verification record
    raw_token = generate_verification_token()
    verification = EmailVerification(
        user_id=user.user_id,
        token_hash=hash_token(raw_token),
        type=EmailVerificationType.EMAIL_VERIFY,
        expires_at=datetime.now(timezone.utc) + timedelta(hours=24),
    )
    db.add(verification)
    db.commit()
    db.refresh(user)

    # In dev mode, log the verification token to console
    if settings.ENVIRONMENT == "development":
        print(f"\n[DEV] Email verification token for {user.email}: {raw_token}\n")

    return user


# Login

def authenticate_user(db: Session, email: str, password: str) -> LoginResponse:
    user = db.query(User).filter(User.email == email).first()
    if not user:
        raise ValueError("INVALID_CREDENTIALS")

    if not user.is_active:
        raise ValueError("ACCOUNT_DISABLED")

    # Check account lockout
    if user.locked_until and user.locked_until > datetime.now(timezone.utc):
        raise ValueError("ACCOUNT_LOCKED")

    # Verify password
    if not verify_password(password, user.password_hash):
        user.failed_login_attempts += 1
        if user.failed_login_attempts >= 5:
            user.locked_until = datetime.now(timezone.utc) + timedelta(minutes=15)
        db.commit()
        raise ValueError("INVALID_CREDENTIALS")

    # Reset failed attempts on success
    user.failed_login_attempts = 0
    user.locked_until = None
    user.last_login_at = datetime.now(timezone.utc)

    # Check if 2FA is enabled
    if user.totp_enabled:
        db.commit()
        return LoginResponse(
            requires_2fa=True,
            user_id=user.user_id,
        )

    # Generate tokens
    token_data = {
        "sub": str(user.user_id),
        "email": user.email,
        "role": user.role.value,
    }
    access_token = create_access_token(token_data)
    refresh_token = create_refresh_token(token_data)

    # Store refresh token hash
    _store_refresh_token(db, user.user_id, refresh_token)

    db.commit()

    return LoginResponse(
        access_token=access_token,
        refresh_token=refresh_token,
        token_type="bearer",
        expires_in=settings.JWT_ACCESS_TOKEN_EXPIRE_MINUTES * 60,
    )


# Token Refresh


def refresh_access_token(db: Session, refresh_token_str: str) -> TokenResponse:
    payload = decode_token(refresh_token_str)
    if not payload or payload.get("type") != "refresh":
        raise ValueError("INVALID_TOKEN")

    user_id = payload.get("sub")
    if not user_id:
        raise ValueError("INVALID_TOKEN")

    # Verify refresh token exists in DB
    token_hash = hash_token(refresh_token_str)
    stored_token = (
        db.query(RefreshToken)
        .filter(
            RefreshToken.token_hash == token_hash,
            RefreshToken.user_id == user_id,
        )
        .first()
    )
    if not stored_token:
        raise ValueError("INVALID_TOKEN")

    if stored_token.expires_at < datetime.now(timezone.utc):
        db.delete(stored_token)
        db.commit()
        raise ValueError("TOKEN_EXPIRED")

    # Fetch user to ensure still active
    user = db.query(User).filter(User.user_id == user_id).first()
    if not user or not user.is_active:
        raise ValueError("INVALID_TOKEN")

    # Rotate: delete old, create new
    db.delete(stored_token)

    token_data = {
        "sub": str(user.user_id),
        "email": user.email,
        "role": user.role.value,
    }
    new_access = create_access_token(token_data)
    new_refresh = create_refresh_token(token_data)

    _store_refresh_token(db, user.user_id, new_refresh)
    db.commit()

    return TokenResponse(
        access_token=new_access,
        refresh_token=new_refresh,
        token_type="bearer",
        expires_in=settings.JWT_ACCESS_TOKEN_EXPIRE_MINUTES * 60,
    )


# Logout 


def logout_user(db: Session, user_id: str, refresh_token_str: str | None = None) -> None:
    if refresh_token_str:
        token_hash = hash_token(refresh_token_str)
        db.query(RefreshToken).filter(
            RefreshToken.token_hash == token_hash,
            RefreshToken.user_id == user_id,
        ).delete()
    else:
        # Delete all refresh tokens for this user
        db.query(RefreshToken).filter(RefreshToken.user_id == user_id).delete()
    db.commit()


# Get User


def get_user_by_id(db: Session, user_id: str) -> User | None:
    return db.query(User).filter(User.user_id == user_id).first()


# Email verification

def verify_email(db: Session, token: str) -> None:
    token_hash_val = hash_token(token)
    record = (
        db.query(EmailVerification)
        .filter(
            EmailVerification.token_hash == token_hash_val,
            EmailVerification.type == EmailVerificationType.EMAIL_VERIFY,
        )
        .first()
    )
    if not record:
        raise ValueError("INVALID_TOKEN")
    if record.used_at is not None:
        raise ValueError("TOKEN_ALREADY_USED")
    if record.expires_at < datetime.now(timezone.utc):
        raise ValueError("TOKEN_EXPIRED")

    record.used_at = datetime.now(timezone.utc)
    user = db.query(User).filter(User.user_id == record.user_id).first()
    if user:
        user.is_email_verified = True
    db.commit()


def resend_verification(db: Session, email: str) -> str | None:
    user = db.query(User).filter(User.email == email).first()
    if not user:
        raise ValueError("USER_NOT_FOUND")
    if user.is_email_verified:
        raise ValueError("ALREADY_VERIFIED")

    # Invalidate old verification tokens
    db.query(EmailVerification).filter(
        EmailVerification.user_id == user.user_id,
        EmailVerification.type == EmailVerificationType.EMAIL_VERIFY,
        EmailVerification.used_at.is_(None),
    ).delete()

    raw_token = generate_verification_token()
    verification = EmailVerification(
        user_id=user.user_id,
        token_hash=hash_token(raw_token),
        type=EmailVerificationType.EMAIL_VERIFY,
        expires_at=datetime.now(timezone.utc) + timedelta(hours=24),
    )
    db.add(verification)
    db.commit()

    if settings.ENVIRONMENT == "development":
        print(f"\n[DEV] Resend verification token for {email}: {raw_token}\n")

    return raw_token


# Password reset

def request_password_reset(db: Session, email: str) -> str | None:
    user = db.query(User).filter(User.email == email).first()
    if not user:
        # Always return None silently to prevent email enumeration
        return None

    # Invalidate old reset tokens
    db.query(EmailVerification).filter(
        EmailVerification.user_id == user.user_id,
        EmailVerification.type == EmailVerificationType.PASSWORD_RESET,
        EmailVerification.used_at.is_(None),
    ).delete()

    raw_token = generate_verification_token()
    record = EmailVerification(
        user_id=user.user_id,
        token_hash=hash_token(raw_token),
        type=EmailVerificationType.PASSWORD_RESET,
        expires_at=datetime.now(timezone.utc) + timedelta(hours=1),
    )
    db.add(record)
    db.commit()

    if settings.ENVIRONMENT == "development":
        print(f"\n[DEV] Password reset token for {email}: {raw_token}\n")

    return raw_token


def reset_password(db: Session, token: str, new_password: str) -> None:
    token_hash_val = hash_token(token)
    record = (
        db.query(EmailVerification)
        .filter(
            EmailVerification.token_hash == token_hash_val,
            EmailVerification.type == EmailVerificationType.PASSWORD_RESET,
        )
        .first()
    )
    if not record:
        raise ValueError("INVALID_TOKEN")
    if record.used_at is not None:
        raise ValueError("TOKEN_ALREADY_USED")
    if record.expires_at < datetime.now(timezone.utc):
        raise ValueError("TOKEN_EXPIRED")

    record.used_at = datetime.now(timezone.utc)

    user = db.query(User).filter(User.user_id == record.user_id).first()
    if not user:
        raise ValueError("USER_NOT_FOUND")

    user.password_hash = hash_password(new_password)

    # Force re-login everywhere by clearing all refresh tokens
    db.query(RefreshToken).filter(RefreshToken.user_id == user.user_id).delete()
    db.commit()


# Internal helpers

def _store_refresh_token(db: Session, user_id, raw_token: str) -> None:
    expires_at = datetime.now(timezone.utc) + timedelta(
        days=settings.JWT_REFRESH_TOKEN_EXPIRE_DAYS
    )
    rt = RefreshToken(
        user_id=user_id,
        token_hash=hash_token(raw_token),
        expires_at=expires_at,
    )
    db.add(rt)
