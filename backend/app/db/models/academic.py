import uuid
from datetime import datetime

from sqlalchemy import (
    Boolean,
    Column,
    DateTime,
    ForeignKey,
    Integer,
    SmallInteger,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy.dialects.postgresql import UUID

from app.db.base import Base


class Grade(Base):
    __tablename__ = "grades"

    grade_id = Column(Integer, primary_key=True, autoincrement=True)
    grade_name = Column(String(50), unique=True, nullable=False)
    grade_level = Column(SmallInteger, nullable=False)
    description = Column(Text, nullable=True)
    is_active = Column(Boolean, nullable=False, default=True, server_default="true")


class Subject(Base):
    __tablename__ = "subjects"

    subject_id = Column(Integer, primary_key=True, autoincrement=True)
    grade_id = Column(Integer, ForeignKey("grades.grade_id"), nullable=False)
    subject_name = Column(String(100), nullable=False)
    subject_code = Column(String(20), unique=True, nullable=False)
    chroma_namespace = Column(String(100), unique=True, nullable=False)
    description = Column(Text, nullable=True)
    is_active = Column(Boolean, nullable=False, default=True, server_default="true")


class StudentEnrollment(Base):
    __tablename__ = "student_enrollments"

    enrollment_id = Column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, nullable=False
    )
    student_id = Column(UUID(as_uuid=True), ForeignKey("users.user_id"), nullable=False)
    grade_id = Column(Integer, ForeignKey("grades.grade_id"), nullable=False)
    subject_id = Column(Integer, ForeignKey("subjects.subject_id"), nullable=False)
    enrolled_at = Column(
        DateTime(timezone=True),
        nullable=False,
        default=datetime.utcnow,
        server_default="now()",
    )
    is_active = Column(Boolean, nullable=False, default=True, server_default="true")

    __table_args__ = (
        UniqueConstraint(
            "student_id", "grade_id", "subject_id", name="uq_student_enrollment"
        ),
    )


class InstructorSubject(Base):
    __tablename__ = "instructor_subjects"

    assignment_id = Column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, nullable=False
    )
    instructor_id = Column(
        UUID(as_uuid=True), ForeignKey("users.user_id"), nullable=False
    )
    subject_id = Column(Integer, ForeignKey("subjects.subject_id"), nullable=False)
    assigned_by = Column(UUID(as_uuid=True), ForeignKey("users.user_id"), nullable=False)
    assigned_at = Column(
        DateTime(timezone=True),
        nullable=False,
        default=datetime.utcnow,
        server_default="now()",
    )
    is_active = Column(Boolean, nullable=False, default=True, server_default="true")

    __table_args__ = (
        UniqueConstraint("instructor_id", "subject_id", name="uq_instructor_subject"),
    )

