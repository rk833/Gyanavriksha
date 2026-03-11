import uuid
from datetime import datetime

from sqlalchemy.dialects.postgresql import UUID, ARRAY
from sqlalchemy import Boolean, Column, DateTime, ForeignKey, Integer, String, Text

from app.db.base import Base


class Assignment(Base):
    __tablename__ = "assignments"

    assignment_id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, nullable=False)
    subject_id = Column(Integer, ForeignKey("subjects.subject_id"), nullable=False)
    instructor_id = Column(UUID(as_uuid=True), ForeignKey("users.user_id"), nullable=False)
    title = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    topic_tags = Column(ARRAY(String), nullable=True)
    is_exam_mode = Column(Boolean, nullable=False, default=False, server_default="false")
    due_date = Column(DateTime(timezone=True), nullable=True)
    is_published = Column(Boolean, nullable=False, default=False, server_default="false")
    created_at = Column(
        DateTime(timezone=True),
        nullable=False,
        default=datetime.utcnow,
        server_default="now()",
    )
