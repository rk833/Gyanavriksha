"""
Library service — curriculum document queries scoped by student enrollment.
Sprint 3 Phase 5: GD-61
"""
import uuid

from fastapi import HTTPException, status
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.db.models.curriculum_document import CurriculumDocument
from app.db.models.grade import Grade
from app.db.models.student_enrollment import StudentEnrollment
from app.db.models.subject import Subject
from app.db.models.user import User


def get_library_documents(
    db: Session,
    user_id: uuid.UUID,
    subject_id: int | None = None,
    doc_type: str | None = None,
    search: str | None = None,
    page: int = 1,
    per_page: int = 20,
) -> tuple[list, int]:
    """Get curriculum documents for subjects the student is enrolled in."""
    # Get enrolled subject IDs
    enrolled = (
        db.query(StudentEnrollment.subject_id)
        .filter(
            StudentEnrollment.student_id == user_id,
            StudentEnrollment.is_active == True,
        )
        .all()
    )
    enrolled_ids = [r[0] for r in enrolled]

    if not enrolled_ids:
        return [], 0

    query = (
        db.query(CurriculumDocument, Subject, Grade, User)
        .join(Subject, CurriculumDocument.subject_id == Subject.subject_id)
        .join(Grade, Subject.grade_id == Grade.grade_id)
        .join(User, CurriculumDocument.uploaded_by == User.user_id)
        .filter(CurriculumDocument.subject_id.in_(enrolled_ids))
    )

    if subject_id is not None:
        if subject_id not in enrolled_ids:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You are not enrolled in this subject",
            )
        query = query.filter(CurriculumDocument.subject_id == subject_id)

    if doc_type:
        query = query.filter(CurriculumDocument.doc_type == doc_type)

    if search:
        query = query.filter(CurriculumDocument.file_name.ilike(f"%{search}%"))

    total = query.count()
    rows = (
        query.order_by(CurriculumDocument.created_at.desc())
        .offset((page - 1) * per_page)
        .limit(per_page)
        .all()
    )

    results = []
    for doc, subject, grade, uploader in rows:
        results.append({
            "doc_id": doc.doc_id,
            "file_name": doc.file_name,
            "file_path": doc.file_path,
            "file_size_bytes": doc.file_size_bytes,
            "doc_type": doc.doc_type,
            "embedding_status": doc.embedding_status,
            "subject_id": subject.subject_id,
            "subject_name": subject.subject_name,
            "grade_name": grade.grade_name,
            "uploaded_by_name": uploader.full_name,
            "created_at": doc.created_at,
        })

    return results, total


def get_document_detail(
    db: Session, user_id: uuid.UUID, doc_id: uuid.UUID
) -> dict:
    """Get a single document detail, verifying enrollment."""
    row = (
        db.query(CurriculumDocument, Subject, Grade, User)
        .join(Subject, CurriculumDocument.subject_id == Subject.subject_id)
        .join(Grade, Subject.grade_id == Grade.grade_id)
        .join(User, CurriculumDocument.uploaded_by == User.user_id)
        .filter(CurriculumDocument.doc_id == doc_id)
        .first()
    )

    if not row:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Document not found",
        )

    doc, subject, grade, uploader = row

    # Verify enrollment
    enrolled = (
        db.query(StudentEnrollment)
        .filter(
            StudentEnrollment.student_id == user_id,
            StudentEnrollment.subject_id == subject.subject_id,
            StudentEnrollment.is_active == True,
        )
        .first()
    )
    if not enrolled:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You are not enrolled in this subject",
        )

    return {
        "doc_id": doc.doc_id,
        "file_name": doc.file_name,
        "file_path": doc.file_path,
        "file_size_bytes": doc.file_size_bytes,
        "doc_type": doc.doc_type,
        "embedding_status": doc.embedding_status,
        "subject_id": subject.subject_id,
        "subject_name": subject.subject_name,
        "grade_name": grade.grade_name,
        "uploaded_by_name": uploader.full_name,
        "created_at": doc.created_at,
    }
