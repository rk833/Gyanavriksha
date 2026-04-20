"""Domain schemas for the admin bounded context.

Value objects and domain-layer input contracts internal to the admin context.
API-level request/response shapes live in ``app/schemas/admin.py``.
"""
import uuid
from typing import Optional

from pydantic import BaseModel, EmailStr, Field

from app.shared.source_enum import UserRole


class CreateUserInput(BaseModel):
    """Value object for validated data when creating a new user."""

    email: EmailStr
    full_name: str = Field(..., min_length=1, max_length=150)
    role: UserRole
    grade_id: Optional[int] = None
    raw_password: Optional[str] = None


class UpdateUserInput(BaseModel):
    """Value object for validated data when partially updating a user."""

    full_name: Optional[str] = Field(None, min_length=1, max_length=150)
    role: Optional[UserRole] = None
    is_active: Optional[bool] = None
    grade_id: Optional[int] = None
    profile_image_url: Optional[str] = None


class RoleChangeInput(BaseModel):
    """Value object for changing a user role with optional subject assignment."""

    role: UserRole
    subject_ids: Optional[list[int]] = None
    grade_id: Optional[int] = None


class SettingsUpdateInput(BaseModel):
    """Value object for updating admin system settings."""

    ocr_engine: Optional[str] = None
    rag_chunk_size: Optional[int] = Field(None, ge=64, le=2048)
    google_vision_api_key: Optional[str] = None
    gemini_api_key: Optional[str] = None
    mqtt_broker_host: Optional[str] = None
    mqtt_broker_credentials: Optional[str] = None
    maintenance_mode: Optional[bool] = None
