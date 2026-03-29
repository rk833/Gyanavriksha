import re
import uuid
from datetime import datetime

from pydantic import BaseModel, EmailStr, Field, field_validator # type: ignore

from app.shared.source_enum import UserRole


# Request Schemas
class UserRegisterRequest(BaseModel):
    email: EmailStr
    password: str = Field(..., min_length=8, max_length=128)
    full_name: str = Field(..., min_length=2, max_length=150)
    role: UserRole

    @field_validator("password")
    @classmethod
    def password_strength(cls, v: str) -> str:
        if not re.search(r"[A-Z]", v):
            raise ValueError("Password must contain at least one uppercase letter")
        if not re.search(r"[a-z]", v):
            raise ValueError("Password must contain at least one lowercase letter")
        if not re.search(r"\d", v):
            raise ValueError("Password must contain at least one digit")
        return v

    @field_validator("role")
    @classmethod
    def restrict_role(cls, v: UserRole) -> UserRole:
        if v == UserRole.ADMIN:
            raise ValueError("Admin accounts cannot be created via registration")
        return v


class UserLoginRequest(BaseModel):
    email: EmailStr
    password: str


class UserUpdateRequest(BaseModel):
    full_name: str | None = Field(None, min_length=2, max_length=150)
    profile_image_url: str | None = None


class TokenRefreshRequest(BaseModel):
    refresh_token: str


class ForgotPasswordRequest(BaseModel):
    email: EmailStr


class ResetPasswordRequest(BaseModel):
    token: str
    new_password: str = Field(..., min_length=8, max_length=128)

    @field_validator("new_password")
    @classmethod
    def password_strength(cls, v: str) -> str:
        if not re.search(r"[A-Z]", v):
            raise ValueError("Password must contain at least one uppercase letter")
        if not re.search(r"[a-z]", v):
            raise ValueError("Password must contain at least one lowercase letter")
        if not re.search(r"\d", v):
            raise ValueError("Password must contain at least one digit")
        return v


class TwoFactorSetupVerifyRequest(BaseModel):
    secret: str
    code: str = Field(..., min_length=6, max_length=6)


class TwoFactorValidateRequest(BaseModel):
    user_id: uuid.UUID
    code: str = Field(..., min_length=6, max_length=6)


class TwoFactorDisableRequest(BaseModel):
    code: str = Field(..., min_length=6, max_length=6)
    password: str


class QrScanRequest(BaseModel):
    session_id: uuid.UUID


class QrAuthenticateRequest(BaseModel):
    session_id: uuid.UUID


# Response Schemas
class UserResponse(BaseModel):
    user_id: uuid.UUID
    email: str
    full_name: str
    role: UserRole
    is_active: bool
    is_email_verified: bool
    profile_image_url: str | None = None
    created_at: datetime

    model_config = {"from_attributes": True}


class TokenResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    expires_in: int


class LoginResponse(BaseModel):
    access_token: str | None = None
    refresh_token: str | None = None
    token_type: str = "bearer"
    expires_in: int | None = None
    requires_2fa: bool = False
    user_id: uuid.UUID | None = None


class MessageResponse(BaseModel):
    message: str
    detail: str | None = None


class TwoFactorSetupResponse(BaseModel):
    qr_code_base64: str
    secret: str


class QrSessionResponse(BaseModel):
    session_id: uuid.UUID
    qr_data: str
    expires_in: int


class QrStatusResponse(BaseModel):
    status: str
    access_token: str | None = None
    refresh_token: str | None = None
    token_type: str | None = None
    expires_in: int | None = None
