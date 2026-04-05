"""Application-layer use cases for the instructor bounded context.

Each use case orchestrates one instructor-facing operation: it calls the
underlying service, maps domain-level results and errors to response schemas
or HTTPExceptions, and keeps the presentation layer free of business logic.
"""
import uuid

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.schemas.common import PaginatedResponse
from app.schemas.instructor import (
    AtRiskStudentResponse,
    ConceptHeatmapResponse,
    InstructorAssignmentDetailResponse,
    InstructorAssignmentResponse,
    InstructorDashboardResponse,
    InstructorProfileResponse,
    InstructorSubmissionDetailResponse,
    InstructorSubmissionListItem,
    InstructorSubjectDetailResponse,
    InstructorSubjectResponse,
    KnowledgeBaseDocumentResponse,
    VelocityAnalyticsResponse,
)
from app.services import instructor_service


def _calculate_total_pages(total: int, per_page: int) -> int:
    """Return the number of pages needed to hold all records at the given page size."""
    return (total + per_page - 1) // per_page if total else 0


def _build_paginated(
    schema_class: type,
    raw_items: list,
    total: int,
    page: int,
    per_page: int,
) -> PaginatedResponse:
    """Construct a PaginatedResponse wrapping validated schema instances."""
    return PaginatedResponse(
        items=[schema_class(**item) for item in raw_items],
        total=total,
        page=page,
        per_page=per_page,
        total_pages=_calculate_total_pages(total, per_page),
    )


def _require_subject_access(
    db: Session, instructor_id: str, subject_id: int
) -> None:
    """Raise HTTP 403 when the instructor is not assigned to the given subject."""
    if not instructor_service.verify_instructor_subject(
        db, instructor_id, subject_id
    ):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You are not assigned to this subject",
        )


def _require_fields_present(update_data: dict) -> None:
    """Raise HTTP 400 when no updateable fields are provided in the request."""
    if not update_data:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No fields to update",
        )


def _raise_delete_error(result: "str | None") -> None:
    """Map a service-returned error code to the appropriate HTTPException."""
    if result == "NOT_FOUND":
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Assignment not found",
        )
    if result is not None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=result,
        )


def get_dashboard(
    db: Session, instructor_id: str
) -> InstructorDashboardResponse:
    """Return aggregated intelligence-dashboard statistics for the instructor."""
    return InstructorDashboardResponse(
        **instructor_service.get_instructor_dashboard(db, instructor_id)
    )


def list_subjects(
    db: Session, instructor_id: str
) -> list[InstructorSubjectResponse]:
    """Return all subjects assigned to the instructor, sorted by grade then name."""
    subjects = instructor_service.get_instructor_subjects(db, instructor_id)
    return [InstructorSubjectResponse(**s) for s in subjects]


def get_subject_detail(
    db: Session,
    instructor_id: str,
    subject_id: int,
    page: int,
    per_page: int,
    sort_by: str,
) -> InstructorSubjectDetailResponse:
    """Return subject detail with paginated student progress after verifying access."""
    _require_subject_access(db, instructor_id, subject_id)
    data = instructor_service.get_instructor_subject_detail(
        db,
        instructor_id,
        subject_id,
        page=page,
        per_page=per_page,
        sort_by=sort_by,
    )
    if data is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Subject not found",
        )
    return InstructorSubjectDetailResponse(**data)


def list_assignments(
    db: Session,
    instructor_id: str,
    subject_id: "int | None",
    status_filter: "str | None",
    is_exam_mode: "bool | None",
    page: int,
    per_page: int,
) -> PaginatedResponse[InstructorAssignmentResponse]:
    """Return paginated assignments for the instructor with optional filters."""
    items, total = instructor_service.get_instructor_assignments(
        db,
        instructor_id,
        subject_id=subject_id,
        status_filter=status_filter,
        is_exam_mode=is_exam_mode,
        page=page,
        per_page=per_page,
    )
    return _build_paginated(
        InstructorAssignmentResponse, items, total, page, per_page
    )


def get_assignment(
    db: Session, instructor_id: str, assignment_id: uuid.UUID
) -> InstructorAssignmentDetailResponse:
    """Return full assignment detail with submission statistics, or raise HTTP 404."""
    data = instructor_service.get_assignment_detail(
        db, instructor_id, assignment_id
    )
    if data is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Assignment not found",
        )
    return InstructorAssignmentDetailResponse(**data)


def create_assignment(
    db: Session, instructor_id: str, payload: dict
) -> InstructorAssignmentResponse:
    """Create a new draft assignment after verifying the instructor's subject access."""
    _require_subject_access(db, instructor_id, payload["subject_id"])
    assignment = instructor_service.create_assignment(db, instructor_id, payload)
    detail = instructor_service.get_assignment_detail(
        db, instructor_id, assignment.assignment_id
    )
    return InstructorAssignmentResponse(**detail)


def update_assignment(
    db: Session,
    instructor_id: str,
    assignment_id: uuid.UUID,
    update_data: dict,
) -> InstructorAssignmentResponse:
    """Apply partial updates to an assignment and return the refreshed record."""
    _require_fields_present(update_data)
    assignment = instructor_service.update_assignment(
        db, instructor_id, assignment_id, update_data
    )
    if assignment is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Assignment not found",
        )
    detail = instructor_service.get_assignment_detail(
        db, instructor_id, assignment.assignment_id
    )
    return InstructorAssignmentResponse(**detail)


def publish_assignment(
    db: Session, instructor_id: str, assignment_id: uuid.UUID
) -> InstructorAssignmentResponse:
    """Publish a draft assignment, delegating state-transition validation to the service."""
    assignment = _execute_publish(db, instructor_id, assignment_id)
    detail = instructor_service.get_assignment_detail(
        db, instructor_id, assignment.assignment_id
    )
    return InstructorAssignmentResponse(**detail)


def _execute_publish(
    db: Session, instructor_id: str, assignment_id: uuid.UUID
) -> object:
    """Call the service publish method and map ValueError/None to HTTPExceptions."""
    try:
        assignment = instructor_service.publish_assignment(
            db, instructor_id, assignment_id
        )
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)
        )
    if assignment is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Assignment not found",
        )
    return assignment


def delete_assignment(
    db: Session, instructor_id: str, assignment_id: uuid.UUID
) -> None:
    """Delete a draft assignment that has no submissions."""
    result = instructor_service.delete_assignment(
        db, instructor_id, assignment_id
    )
    _raise_delete_error(result)


def list_submissions(
    db: Session,
    instructor_id: str,
    assignment_id: "uuid.UUID | None",
    student_id: "uuid.UUID | None",
    subject_id: "int | None",
    status_filter: "str | None",
    page: int,
    per_page: int,
) -> PaginatedResponse[InstructorSubmissionListItem]:
    """Return paginated submissions for the instructor's assignments with optional filters."""
    items, total = instructor_service.get_instructor_submissions(
        db,
        instructor_id,
        assignment_id=assignment_id,
        student_id=student_id,
        subject_id=subject_id,
        status_filter=status_filter,
        page=page,
        per_page=per_page,
    )
    return _build_paginated(
        InstructorSubmissionListItem, items, total, page, per_page
    )


def get_submission_detail(
    db: Session, instructor_id: str, submission_id: uuid.UUID
) -> InstructorSubmissionDetailResponse:
    """Return full submission detail with feedback, or raise HTTP 404."""
    data = instructor_service.get_submission_detail(
        db, instructor_id, submission_id
    )
    if data is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Submission not found",
        )
    return InstructorSubmissionDetailResponse(**data)


def override_feedback(
    db: Session,
    instructor_id: str,
    submission_id: uuid.UUID,
    feedback_data: dict,
) -> InstructorSubmissionDetailResponse:
    """Create or replace instructor feedback on a submission."""
    result = instructor_service.override_submission_feedback(
        db, instructor_id, submission_id, feedback_data
    )
    if result is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Submission not found or not accessible",
        )
    return InstructorSubmissionDetailResponse(**result)


def get_velocity_analytics(
    db: Session, instructor_id: str, subject_id: "int | None"
) -> VelocityAnalyticsResponse:
    """Return velocity analytics for the instructor's subjects."""
    return VelocityAnalyticsResponse(
        **instructor_service.get_velocity_analytics(
            db, instructor_id, subject_id=subject_id
        )
    )


def get_at_risk_students(
    db: Session,
    instructor_id: str,
    subject_id: "int | None",
    page: int,
    per_page: int,
) -> PaginatedResponse[AtRiskStudentResponse]:
    """Return paginated at-risk students identified by the analytics engine."""
    items, total = instructor_service.get_at_risk_students(
        db,
        instructor_id,
        subject_id=subject_id,
        page=page,
        per_page=per_page,
    )
    return _build_paginated(
        AtRiskStudentResponse, items, total, page, per_page
    )


def get_concept_heatmap(
    db: Session,
    instructor_id: str,
    subject_id: "int | None",
    timeframe: str,
) -> ConceptHeatmapResponse:
    """Return concept heatmap data highlighting topic-level struggle areas."""
    return ConceptHeatmapResponse(
        **instructor_service.get_concept_heatmap(
            db,
            instructor_id,
            subject_id=subject_id,
            timeframe=timeframe,
        )
    )


def list_knowledge_base(
    db: Session,
    instructor_id: str,
    subject_id: "int | None",
    doc_type: "str | None",
    search: "str | None",
    page: int,
    per_page: int,
) -> PaginatedResponse[KnowledgeBaseDocumentResponse]:
    """Return paginated knowledge-base documents uploaded by the instructor."""
    items, total = instructor_service.get_knowledge_base_documents(
        db,
        instructor_id,
        subject_id=subject_id,
        doc_type=doc_type,
        search=search,
        page=page,
        per_page=per_page,
    )
    return _build_paginated(
        KnowledgeBaseDocumentResponse, items, total, page, per_page
    )


async def upload_document(
    db: Session,
    instructor_id: str,
    subject_id: int,
    file: object,
    doc_type: str,
) -> KnowledgeBaseDocumentResponse:
    """Validate and upload a PDF document to the knowledge base."""
    _validate_pdf_extension(file.filename)
    content = await file.read()
    _validate_file_size(content, max_bytes=50 * 1024 * 1024)
    _require_subject_access(db, instructor_id, subject_id)
    result = instructor_service.upload_document(
        db, instructor_id, subject_id, file.filename, content, doc_type
    )
    return KnowledgeBaseDocumentResponse(**result)


def _validate_pdf_extension(filename: str) -> None:
    """Raise HTTP 400 when the filename does not carry a .pdf extension."""
    if not filename.lower().endswith(".pdf"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Only PDF files are allowed",
        )


def _validate_file_size(content: bytes, max_bytes: int) -> None:
    """Raise HTTP 400 when the file content exceeds the permitted size."""
    if len(content) > max_bytes:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="File size exceeds 50MB limit",
        )


def delete_document(
    db: Session, instructor_id: str, doc_id: uuid.UUID
) -> None:
    """Delete a knowledge-base document, raising HTTP 404 when not found."""
    result = instructor_service.delete_document(db, instructor_id, doc_id)
    if result == "NOT_FOUND":
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Document not found",
        )


def get_profile(
    db: Session, instructor_id: str
) -> InstructorProfileResponse:
    """Return the instructor's profile with assigned subjects."""
    return InstructorProfileResponse(
        **instructor_service.get_instructor_profile(db, instructor_id)
    )


def update_profile(
    db: Session, instructor_id: str, update_data: dict
) -> InstructorProfileResponse:
    """Apply profile field updates and return the refreshed profile."""
    _require_fields_present(update_data)
    result = instructor_service.update_instructor_profile(
        db, instructor_id, update_data
    )
    return InstructorProfileResponse(**result)
