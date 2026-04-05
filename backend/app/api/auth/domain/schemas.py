"""Domain schemas for the authentication bounded context.

These Pydantic models represent value objects and domain-layer input contracts
that are specific to the authentication context. They encode domain invariants
rather than HTTP request/response shapes, which live in ``app/schemas/user.py``.
"""
from pydantic import BaseModel


class AuthCredentials(BaseModel):
    """Value object encapsulating the credentials required to authenticate a user."""

    email: str
    password: str


class TokenPair(BaseModel):
    """Value object representing an issued access/refresh token pair."""

    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    expires_in: int


class PasswordResetInput(BaseModel):
    """Value object carrying the data needed to complete a password-reset flow."""

    token: str
    new_password: str


class TwoFactorInput(BaseModel):
    """Value object for a TOTP validation attempt."""

    user_id: str
    code: str


class QrSessionInput(BaseModel):
    """Value object identifying a QR-login session for scan or authentication."""

    session_id: str
