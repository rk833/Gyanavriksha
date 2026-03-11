from sqlalchemy import Boolean, Column, ForeignKey, Integer, String, Text

from app.db.base import Base


class Subject(Base):
    __tablename__ = "subjects"

    subject_id = Column(Integer, primary_key=True, autoincrement=True)
    grade_id = Column(Integer, ForeignKey("grades.grade_id"), nullable=False)
    subject_name = Column(String(100), nullable=False)
    subject_code = Column(String(20), unique=True, nullable=False)
    chroma_namespace = Column(String(100), unique=True, nullable=False)
    description = Column(Text, nullable=True)
    is_active = Column(Boolean, nullable=False, default=True, server_default="true")
