from sqlalchemy import Boolean, Column, Integer, SmallInteger, String, Text

from app.db.base import Base


class Grade(Base):
    __tablename__ = "grades"

    grade_id = Column(Integer, primary_key=True, autoincrement=True)
    grade_name = Column(String(50), unique=True, nullable=False)
    grade_level = Column(SmallInteger, nullable=False)
    description = Column(Text, nullable=True)
    is_active = Column(Boolean, nullable=False, default=True, server_default="true")
