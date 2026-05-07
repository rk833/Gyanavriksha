"""Domain input models for student self-service mutations.

These models represent validated user intent at the domain boundary. They are
distinct from shared schemas so that the student context owns its own input
contract independently of the shared schema layer.
"""
from typing import Any

from pydantic import BaseModel, field_validator


class StudentProfileUpdateInput(BaseModel):
    """Validated input for updating the student's own profile fields.

    All fields are optional; only non-None values will be applied during the
    update operation, leaving unspecified fields unchanged.
    """

    full_name: str | None = None
    profile_image_url: str | None = None
    notification_preferences: dict[str, Any] | None = None

    @field_validator("notification_preferences")
    @classmethod
    def filter_notification_prefs(cls, v: dict[str, Any] | None) -> dict[str, bool] | None:
        """Allow only known learning-alert toggles."""
        if v is None:
            return None
        allowed = ("grading_updates", "quiz_reminders", "posture_connection")
        return {k: bool(v[k]) for k in allowed if k in v} or None
