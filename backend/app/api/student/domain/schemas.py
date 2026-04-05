"""Domain input models for student self-service mutations.

These models represent validated user intent at the domain boundary. They are
distinct from shared schemas so that the student context owns its own input
contract independently of the shared schema layer.
"""
from pydantic import BaseModel


class StudentProfileUpdateInput(BaseModel):
    """Validated input for updating the student's own profile fields.

    All fields are optional; only non-None values will be applied during the
    update operation, leaving unspecified fields unchanged.
    """

    full_name: str | None = None
    profile_image_url: str | None = None
