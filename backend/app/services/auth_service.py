import uuid
import secrets
from datetime import datetime, timedelta, timezone
from typing import Any

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
from app.db.models.qr_session import QrSession
from app.db.models.refresh_token import RefreshToken
from app.db.models.two_factor_email_challenge import TwoFactorEmailChallenge
from app.db.models.two_factor_trusted_device import TwoFactorTrustedDevice
from app.db.models.user import User
from app.schemas.user import (
    LoginResponse,
    TokenResponse,
    UserRegisterRequest,
    UserResponse,
)
from app.services import email_service
from app.shared.source_enum import EmailVerificationType, QrSessionStatus, UserRole


TRUSTED_DEVICE_SKIP_DAYS = 3


def revoke_two_factor_trusted_devices(db: Session, user_id: uuid.UUID) -> None:
    db.query(TwoFactorTrustedDevice).filter(TwoFactorTrustedDevice.user_id == user_id).delete()


def _trusted_device_valid(db: Session, user_id: uuid.UUID, raw_token: str) -> bool:
    token_hash = hash_token(raw_token)
    row = (
        db.query(TwoFactorTrustedDevice)
        .filter(
            TwoFactorTrustedDevice.user_id == user_id,
            TwoFactorTrustedDevice.token_hash == token_hash,
        )
        .first()
    )
    if not row:
        return False
    now = datetime.now(timezone.utc)
    if row.expires_at < now:
        db.delete(row)
        return False
    return True


def _create_trusted_device_token(db: Session, user_id: uuid.UUID) -> str:
    raw = secrets.token_urlsafe(32)
    db.add(
        TwoFactorTrustedDevice(
            user_id=user_id,
            token_hash=hash_token(raw),
            expires_at=datetime.now(timezone.utc) + timedelta(days=TRUSTED_DEVICE_SKIP_DAYS),
        )
    )
    return raw


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

def authenticate_user(
    db: Session,
    email: str,
    password: str,
    trusted_device_token: str | None = None,
) -> LoginResponse:
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

    # Check if 2FA is enabled (authenticator and/or email)
    needs_2fa = bool(user.totp_enabled or user.email_2fa_enabled)
    trust_raw = (trusted_device_token or "").strip()
    if needs_2fa and trust_raw and _trusted_device_valid(db, user.user_id, trust_raw):
        token_data = {
            "sub": str(user.user_id),
            "email": user.email,
            "role": user.role.value,
            "tv": user.token_version,
        }
        access_token = create_access_token(token_data)
        refresh_token = create_refresh_token(token_data)
        _store_refresh_token(db, user.user_id, refresh_token)
        db.commit()
        return LoginResponse(
            access_token=access_token,
            refresh_token=refresh_token,
            token_type="bearer",
            expires_in=settings.JWT_ACCESS_TOKEN_EXPIRE_MINUTES * 60,
        )

    if needs_2fa:
        methods: list[str] = []
        if user.totp_enabled:
            methods.append("totp")
        if user.email_2fa_enabled:
            methods.append("email")
        db.commit()
        return LoginResponse(
            requires_2fa=True,
            user_id=user.user_id,
            two_factor_methods=methods,
        )

    token_data = {
        "sub": str(user.user_id),
        "email": user.email,
        "role": user.role.value,
        "tv": user.token_version,
    }
    access_token = create_access_token(token_data)
    refresh_token = create_refresh_token(token_data)

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
        "tv": user.token_version,
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
        revoke_two_factor_trusted_devices(db, uuid.UUID(str(user_id)))
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
    revoke_two_factor_trusted_devices(db, user.user_id)
    db.commit()


# 2FA (TOTP)

def setup_2fa(user: User) -> dict:
    import base64
    import io

    import pyotp  # type: ignore
    import qrcode  # type: ignore

    secret = pyotp.random_base32()
    totp = pyotp.TOTP(secret)
    uri = totp.provisioning_uri(name=user.email, issuer_name="Gyanavriksha")

    # Generate QR code as base64
    img = qrcode.make(uri)
    buffer = io.BytesIO()
    img.save(buffer, format="PNG")
    qr_base64 = base64.b64encode(buffer.getvalue()).decode("utf-8")

    return {"qr_code_base64": qr_base64, "secret": secret}


def verify_2fa_setup(db: Session, user: User, secret: str, code: str) -> None:
    import pyotp  # type: ignore

    totp = pyotp.TOTP(secret)
    if not totp.verify(code):
        raise ValueError("INVALID_CODE")

    user.totp_secret = secret
    user.totp_enabled = True
    db.commit()


def send_2fa_email_otp(db: Session, user_id: str) -> None:
    user = db.query(User).filter(User.user_id == user_id).first()
    if not user or not user.email_2fa_enabled:
        raise ValueError("EMAIL_2FA_NOT_ENABLED")
    if not user.is_email_verified:
        raise ValueError("EMAIL_NOT_VERIFIED")

    raw = f"{secrets.randbelow(1_000_000):06d}"
    db.query(TwoFactorEmailChallenge).filter(TwoFactorEmailChallenge.user_id == user.user_id).delete()
    ch = TwoFactorEmailChallenge(
        user_id=user.user_id,
        code_hash=hash_token(raw),
        expires_at=datetime.now(timezone.utc) + timedelta(minutes=10),
    )
    db.add(ch)
    db.commit()

    email_service.send_2fa_login_email(user.email, raw, user.full_name)
    if settings.ENVIRONMENT == "development":
        print(f"\n[DEV] Email 2FA code for {user.email}: {raw}\n")


def enable_email_2fa(db: Session, user: User, password: str) -> None:
    if not verify_password(password, user.password_hash):
        raise ValueError("INVALID_PASSWORD")
    if not user.is_email_verified:
        raise ValueError("EMAIL_NOT_VERIFIED")
    user.email_2fa_enabled = True
    db.commit()


def disable_email_2fa(db: Session, user: User, password: str) -> None:
    if not verify_password(password, user.password_hash):
        raise ValueError("INVALID_PASSWORD")
    user.email_2fa_enabled = False
    db.query(TwoFactorEmailChallenge).filter(TwoFactorEmailChallenge.user_id == user.user_id).delete()
    revoke_two_factor_trusted_devices(db, user.user_id)
    db.commit()


def validate_2fa(
    db: Session,
    user_id: str,
    code: str,
    method: str = "totp",
    *,
    remember_device: bool = False,
) -> dict:
    import pyotp  # type: ignore

    user = db.query(User).filter(User.user_id == user_id).first()
    if not user:
        raise ValueError("USER_NOT_FOUND")

    if method == "email":
        if not user.email_2fa_enabled:
            raise ValueError("EMAIL_2FA_NOT_ENABLED")
        ch = (
            db.query(TwoFactorEmailChallenge)
            .filter(TwoFactorEmailChallenge.user_id == user.user_id)
            .order_by(TwoFactorEmailChallenge.created_at.desc())
            .first()
        )
        now = datetime.now(timezone.utc)
        if not ch or ch.expires_at < now:
            if ch:
                db.delete(ch)
                db.commit()
            raise ValueError("INVALID_CODE")
        if not verify_token_hash(code, ch.code_hash):
            raise ValueError("INVALID_CODE")
        db.query(TwoFactorEmailChallenge).filter(TwoFactorEmailChallenge.user_id == user.user_id).delete()
    else:
        if not user.totp_enabled or not user.totp_secret:
            raise ValueError("2FA_NOT_ENABLED")

        totp = pyotp.TOTP(user.totp_secret)
        if not totp.verify(code):
            raise ValueError("INVALID_CODE")

    token_data = {
        "sub": str(user.user_id),
        "email": user.email,
        "role": user.role.value,
        "tv": user.token_version,
    }
    access_token = create_access_token(token_data)
    refresh_token = create_refresh_token(token_data)
    _store_refresh_token(db, user.user_id, refresh_token)

    trusted_raw: str | None = None
    if remember_device:
        trusted_raw = _create_trusted_device_token(db, user.user_id)

    user.last_login_at = datetime.now(timezone.utc)
    db.commit()

    out: dict[str, Any] = {
        "access_token": access_token,
        "refresh_token": refresh_token,
        "token_type": "bearer",
        "expires_in": settings.JWT_ACCESS_TOKEN_EXPIRE_MINUTES * 60,
    }
    if trusted_raw:
        out["trusted_device_token"] = trusted_raw
    return out


def disable_2fa(db: Session, user: User, code: str, password: str) -> None:
    import pyotp  # type: ignore

    if not user.totp_enabled or not user.totp_secret:
        raise ValueError("2FA_NOT_ENABLED")

    if not verify_password(password, user.password_hash):
        raise ValueError("INVALID_PASSWORD")

    totp = pyotp.TOTP(user.totp_secret)
    if not totp.verify(code):
        raise ValueError("INVALID_CODE")

    user.totp_secret = None
    user.totp_enabled = False
    revoke_two_factor_trusted_devices(db, user.user_id)
    db.commit()


def change_password(db: Session, user: User, current_password: str, new_password: str) -> None:
    if not verify_password(current_password, user.password_hash):
        raise ValueError("INVALID_CURRENT_PASSWORD")

    if len(new_password) < 8:
        raise ValueError("PASSWORD_TOO_SHORT")

    user.password_hash = hash_password(new_password)
    user.must_change_password = False
    revoke_two_factor_trusted_devices(db, user.user_id)
    db.commit()


def force_change_password(db: Session, user: User, new_password: str) -> None:
    """Set a new password without requiring the current one.

    Only allowed when must_change_password is True (first-login / admin reset flow).
    Increments token_version so all other sessions are invalidated.
    """
    if not user.must_change_password:
        raise ValueError("FORCE_CHANGE_NOT_REQUIRED")

    if len(new_password) < 8:
        raise ValueError("PASSWORD_TOO_SHORT")

    user.password_hash = hash_password(new_password)
    user.must_change_password = False
    user.token_version = (user.token_version or 0) + 1
    revoke_two_factor_trusted_devices(db, user.user_id)
    db.commit()


# QR session login

def create_qr_session(db: Session) -> dict:
    sid = uuid.uuid4()
    session_id_str = str(sid)
    qr_data = f"gyanavriksha://auth?session={session_id_str}"

    qr_session = QrSession(
        qr_session_id=sid,
        qr_code_hash=hash_token(session_id_str),
        status=QrSessionStatus.PENDING,
        expires_at=datetime.now(timezone.utc) + timedelta(minutes=2),
    )
    db.add(qr_session)
    db.commit()
    db.refresh(qr_session)

    return {
        "session_id": session_id_str,
        "qr_data": qr_data,
        "expires_in": 120,
    }


def scan_qr_session(db: Session, session_id: str, user: User) -> None:
    if user.role != UserRole.STUDENT:
        raise ValueError("QR_LOGIN_STUDENT_ONLY")

    qr_session = db.query(QrSession).filter(QrSession.qr_session_id == session_id).first()
    if not qr_session:
        raise ValueError("SESSION_NOT_FOUND")

    if qr_session.expires_at < datetime.now(timezone.utc):
        qr_session.status = QrSessionStatus.EXPIRED
        db.commit()
        raise ValueError("SESSION_EXPIRED")

    if qr_session.status != QrSessionStatus.PENDING:
        raise ValueError("SESSION_INVALID_STATE")

    qr_session.status = QrSessionStatus.SCANNED
    qr_session.user_id = user.user_id
    qr_session.scanned_at = datetime.now(timezone.utc)
    db.commit()


def get_qr_session_status(db: Session, session_id: str) -> dict:
    qr_session = db.query(QrSession).filter(QrSession.qr_session_id == session_id).first()
    if not qr_session:
        raise ValueError("SESSION_NOT_FOUND")

    # Check expiry
    if qr_session.status == QrSessionStatus.PENDING and qr_session.expires_at < datetime.now(timezone.utc):
        qr_session.status = QrSessionStatus.EXPIRED
        db.commit()

    result: dict[str, Any] = {"status": qr_session.status.value}

    if qr_session.status == QrSessionStatus.AUTHENTICATED:
        wa = qr_session.web_access_token
        wr = qr_session.web_refresh_token
        if wa and wr:
            result["access_token"] = wa
            result["refresh_token"] = wr
            result["token_type"] = "bearer"
            result["expires_in"] = settings.JWT_ACCESS_TOKEN_EXPIRE_MINUTES * 60
            qr_session.web_access_token = None
            qr_session.web_refresh_token = None
            db.commit()

    return result


def authenticate_qr_session(db: Session, session_id: str, user: User) -> dict:
    qr_session = db.query(QrSession).filter(QrSession.qr_session_id == session_id).first()
    if not qr_session:
        raise ValueError("SESSION_NOT_FOUND")

    if user.role != UserRole.STUDENT:
        raise ValueError("QR_LOGIN_STUDENT_ONLY")

    if qr_session.status != QrSessionStatus.SCANNED:
        raise ValueError("SESSION_INVALID_STATE")

    if qr_session.user_id != user.user_id:
        raise ValueError("SESSION_USER_MISMATCH")

    token_data = {
        "sub": str(user.user_id),
        "email": user.email,
        "role": user.role.value,
        "tv": user.token_version,
    }
    access_token = create_access_token(token_data)
    refresh_token = create_refresh_token(token_data)
    _store_refresh_token(db, user.user_id, refresh_token)

    qr_session.web_access_token = access_token
    qr_session.web_refresh_token = refresh_token
    qr_session.status = QrSessionStatus.AUTHENTICATED
    db.commit()

    return {
        "status": "authenticated",
        "access_token": access_token,
        "refresh_token": refresh_token,
        "token_type": "bearer",
        "expires_in": settings.JWT_ACCESS_TOKEN_EXPIRE_MINUTES * 60,
    }


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
