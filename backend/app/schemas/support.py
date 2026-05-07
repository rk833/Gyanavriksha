import uuid
from datetime import datetime

from pydantic import BaseModel, EmailStr, Field


class SupportTicketResponse(BaseModel):
    ticket_id: uuid.UUID
    message: str = "Support ticket submitted successfully"
    created_at: datetime


class SupportTicketAdminItem(BaseModel):
    ticket_id: uuid.UUID
    full_name: str
    email: EmailStr
    role: str
    category: str
    priority: str
    subject: str
    description: str
    status: str
    attachment_name: str | None = None
    attachment_content_type: str | None = None
    attachment_size_bytes: int | None = None
    created_at: datetime


class SupportTicketCreateForm(BaseModel):
    full_name: str = Field(..., min_length=1, max_length=150)
    email: EmailStr
    role: str = Field(..., min_length=1, max_length=50)
    category: str = Field(..., min_length=1, max_length=80)
    priority: str = Field(..., min_length=1, max_length=20)
    subject: str = Field(..., min_length=1, max_length=200)
    description: str = Field(..., min_length=5, max_length=5000)
