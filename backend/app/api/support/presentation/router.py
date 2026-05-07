import logging
import re
import uuid
from pathlib import Path

from fastapi import APIRouter, BackgroundTasks, Depends, File, Form, HTTPException, UploadFile, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.db.models.support_ticket import SupportTicket
from app.db.models.user import User
from app.schemas.support import SupportTicketAdminItem, SupportTicketCreateForm, SupportTicketResponse
from app.services import email_service, notification_service
from app.shared.source_enum import NotificationType, UserRole

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/support", tags=["Support"])

_MAX_ATTACHMENT_BYTES = 10 * 1024 * 1024  # 10MB
_ALLOWED_ATTACHMENT_TYPES = {
    "image/png",
    "image/jpeg",
    "application/pdf",
}


def _safe_filename(name: str) -> str:
    stripped = re.sub(r"[^a-zA-Z0-9._-]+", "_", (name or "").strip())
    return stripped[:180] or "attachment"


@router.post("/tickets", response_model=SupportTicketResponse, status_code=status.HTTP_201_CREATED)
async def create_support_ticket(
    background_tasks: BackgroundTasks,
    full_name: str = Form(...),
    email: str = Form(...),
    role: str = Form(...),
    category: str = Form(...),
    priority: str = Form(...),
    subject: str = Form(...),
    description: str = Form(...),
    attachment: UploadFile | None = File(default=None),
    db: Session = Depends(get_db),
):
    payload = SupportTicketCreateForm(
        full_name=full_name,
        email=email,
        role=role,
        category=category,
        priority=priority,
        subject=subject,
        description=description,
    )

    attachment_name = None
    attachment_path = None
    attachment_type = None
    attachment_size = None

    if attachment is not None and attachment.filename:
        if (attachment.content_type or "") not in _ALLOWED_ATTACHMENT_TYPES:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="Attachment must be PNG, JPG, or PDF",
            )
        raw = await attachment.read()
        if len(raw) > _MAX_ATTACHMENT_BYTES:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="Attachment exceeds 10MB limit",
            )
        ticket_uuid = uuid.uuid4()
        upload_dir = Path("uploads") / "support_tickets"
        upload_dir.mkdir(parents=True, exist_ok=True)
        safe_name = _safe_filename(attachment.filename)
        stored_name = f"{ticket_uuid}_{safe_name}"
        saved_path = upload_dir / stored_name
        saved_path.write_bytes(raw)

        attachment_name = attachment.filename
        attachment_path = str(saved_path).replace("\\", "/")
        attachment_type = attachment.content_type
        attachment_size = len(raw)
        ticket_id = ticket_uuid
    else:
        ticket_id = uuid.uuid4()

    ticket = SupportTicket(
        ticket_id=ticket_id,
        full_name=payload.full_name,
        email=str(payload.email),
        role=payload.role,
        category=payload.category,
        priority=payload.priority,
        subject=payload.subject,
        description=payload.description,
        attachment_name=attachment_name,
        attachment_path=attachment_path,
        attachment_content_type=attachment_type,
        attachment_size_bytes=attachment_size,
    )
    db.add(ticket)
    db.commit()
    db.refresh(ticket)

    # Notify all active admin users in-app
    admin_users = (
        db.query(User)
        .filter(User.role == UserRole.ADMIN, User.is_active == True)
        .all()
    )
    short_id = str(ticket.ticket_id)[:8].upper()
    priority_label = payload.priority
    for admin in admin_users:
        notification_service.create_notification(
            db=db,
            recipient_id=admin.user_id,
            notification_type=NotificationType.SUPPORT_TICKET,
            title=f"New Support Ticket #{short_id}",
            body=f"{payload.full_name} ({payload.role}) submitted a {priority_label} priority ticket: \"{payload.subject}\"",
            related_resource_id=str(ticket.ticket_id),
        )
    db.commit()

    background_tasks.add_task(
        email_service.send_support_ticket_confirmation_email,
        to_email=str(payload.email),
        full_name=payload.full_name,
        ticket_id=str(ticket.ticket_id),
        subject_text=payload.subject,
        category=payload.category,
        priority=payload.priority,
    )

    return SupportTicketResponse(ticket_id=ticket.ticket_id, created_at=ticket.created_at)


@router.get("/admin/tickets", response_model=list[SupportTicketAdminItem])
def list_support_tickets(
    status_filter: str | None = None,
    priority: str | None = None,
    category: str | None = None,
    skip: int = 0,
    limit: int = 50,
    db: Session = Depends(get_db),
):
    query = db.query(SupportTicket)
    if status_filter:
        query = query.filter(SupportTicket.status == status_filter)
    if priority:
        query = query.filter(SupportTicket.priority == priority)
    if category:
        query = query.filter(SupportTicket.category == category)
    tickets = query.order_by(SupportTicket.created_at.desc()).offset(skip).limit(limit).all()
    return [
        SupportTicketAdminItem(
            ticket_id=t.ticket_id,
            full_name=t.full_name,
            email=t.email,
            role=t.role,
            category=t.category,
            priority=t.priority,
            subject=t.subject,
            description=t.description,
            status=t.status,
            attachment_name=t.attachment_name,
            attachment_content_type=t.attachment_content_type,
            attachment_size_bytes=t.attachment_size_bytes,
            created_at=t.created_at,
        )
        for t in tickets
    ]


@router.patch("/admin/tickets/{ticket_id}")
def update_ticket_status(
    ticket_id: uuid.UUID,
    body: dict,
    db: Session = Depends(get_db),
):
    ticket = db.query(SupportTicket).filter(SupportTicket.ticket_id == ticket_id).first()
    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket not found")
    allowed_statuses = {"open", "in_progress", "resolved", "closed"}
    new_status = body.get("status")
    if new_status and new_status in allowed_statuses:
        ticket.status = new_status
    db.commit()
    db.refresh(ticket)
    return {"ticket_id": str(ticket.ticket_id), "status": ticket.status}


@router.post("/admin/tickets/{ticket_id}/reply", status_code=status.HTTP_200_OK)
async def reply_to_ticket(
    ticket_id: uuid.UUID,
    background_tasks: BackgroundTasks,
    body: dict,
    db: Session = Depends(get_db),
):
    ticket = db.query(SupportTicket).filter(SupportTicket.ticket_id == ticket_id).first()
    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket not found")

    reply_message = (body.get("message") or "").strip()
    if not reply_message:
        raise HTTPException(status_code=422, detail="Reply message cannot be empty")

    admin_name = (body.get("admin_name") or "").strip() or None

    # Auto-move to in_progress if still open
    if ticket.status == "open":
        ticket.status = "in_progress"
        db.commit()
        db.refresh(ticket)

    background_tasks.add_task(
        email_service.send_support_ticket_reply_email,
        to_email=ticket.email,
        full_name=ticket.full_name,
        ticket_id=str(ticket.ticket_id),
        subject_text=ticket.subject,
        reply_message=reply_message,
        admin_name=admin_name,
    )

    return {"ticket_id": str(ticket.ticket_id), "status": ticket.status, "message": "Reply sent"}


# ── Contact Form ──────────────────────────────────────────────────────────────

@router.post("/contact", status_code=status.HTTP_200_OK)
async def submit_contact_form(
    background_tasks: BackgroundTasks,
    body: dict,
):
    name = (body.get("name") or "").strip()
    email = (body.get("email") or "").strip()
    subject = (body.get("subject") or "").strip()
    message = (body.get("message") or "").strip()

    if not name or not email or not subject or not message:
        raise HTTPException(status_code=422, detail="All fields are required")
    if len(message) < 10:
        raise HTTPException(status_code=422, detail="Message must be at least 10 characters")
    if len(message) > 3000:
        raise HTTPException(status_code=422, detail="Message must be 3000 characters or less")

    background_tasks.add_task(
        email_service.send_contact_form_email,
        sender_name=name,
        sender_email=email,
        subject=subject,
        message=message,
    )
    background_tasks.add_task(
        email_service.send_contact_form_auto_reply,
        to_email=email,
        sender_name=name,
        subject=subject,
    )

    return {"message": "Message sent successfully"}
