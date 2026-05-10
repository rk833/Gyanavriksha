import uuid
from datetime import datetime, timezone

from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy import Column, DateTime, ForeignKey, Integer, String, Text

from app.db.base import Base


class ChatHistory(Base):
    __tablename__ = "chat_history"

    history_id = Column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
        nullable=False,
    )
    student_id = Column(
        UUID(as_uuid=True),
        ForeignKey("users.user_id", ondelete="CASCADE"),
        nullable=False,
        index=True
    )
    subject_id = Column(
        Integer,
        ForeignKey("subjects.subject_id", ondelete="CASCADE"),
        nullable=False,
        index=True
    )
    file_path = Column(Text, nullable=False, doc="File path leading to the data where the actual chat history is stored")
    summary = Column(JSONB, nullable=True, doc="Summary of the chat history in string format that will actually be a json object")
    
    created_at = Column(
        DateTime(timezone=True),
        nullable=False,
        default=lambda: datetime.now(timezone.utc),
        server_default="now()",
    )
    updated_at = Column(
        DateTime(timezone=True),
        nullable=False,
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
        server_default="now()",
    )
