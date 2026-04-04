"""Domain-level protocols for the instructor bounded context.

These protocols establish the contracts between the application layer and the
concrete service implementations. Depending on protocols rather than concrete
classes allows the application layer to be tested independently of infrastructure.
"""
import uuid
from typing import Protocol

from sqlalchemy.orm import Session


class IInstructorService(Protocol):
    """Protocol defining the full contract for instructor data and management operations."""

    def get_instructor_dashboard(
        self, db: Session, instructor_id: str
    ) -> dict:
        """Return aggregated dashboard statistics for the instructor."""
        ...

    def get_instructor_subjects(
        self, db: Session, instructor_id: str
    ) -> list:
        """Return all subjects assigned to this instructor."""
        ...

    def verify_instructor_subject(
        self, db: Session, instructor_id: str, subject_id: int
    ) -> bool:
        """Return True when the instructor is assigned to the given subject."""
        ...

    def get_instructor_subject_detail(
        self,
        db: Session,
        instructor_id: str,
        subject_id: int,
        page: int,
        per_page: int,
        sort_by: str,
    ) -> "dict | None":
        """Return subject detail with paginated student data, or None when not found."""
        ...

    def get_instructor_assignments(
        self,
        db: Session,
        instructor_id: str,
        subject_id: "int | None",
        status_filter: "str | None",
        is_exam_mode: "bool | None",
        page: int,
        per_page: int,
    ) -> "tuple[list, int]":
        """Return paginated assignment records and the total count."""
        ...

    def get_assignment_detail(
        self, db: Session, instructor_id: str, assignment_id: uuid.UUID
    ) -> "dict | None":
        """Return full assignment detail, or None when not found."""
        ...

    def create_assignment(
        self, db: Session, instructor_id: str, data: dict
    ) -> object:
        """Persist a new draft assignment and return the ORM instance."""
        ...

    def update_assignment(
        self,
        db: Session,
        instructor_id: str,
        assignment_id: uuid.UUID,
        data: dict,
    ) -> "object | None":
        """Apply partial updates to an assignment and return the updated instance."""
        ...

    def publish_assignment(
        self, db: Session, instructor_id: str, assignment_id: uuid.UUID
    ) -> "object | None":
        """Publish a draft assignment, raising ValueError for invalid state transitions."""
        ...

    def delete_assignment(
        self, db: Session, instructor_id: str, assignment_id: uuid.UUID
    ) -> "str | None":
        """Delete a draft assignment and return an error code string or None on success."""
        ...

    def get_instructor_submissions(
        self,
        db: Session,
        instructor_id: str,
        assignment_id: "uuid.UUID | None",
        student_id: "uuid.UUID | None",
        subject_id: "int | None",
        status_filter: "str | None",
        page: int,
        per_page: int,
    ) -> "tuple[list, int]":
        """Return paginated submission records for the instructor's assignments."""
        ...

    def get_submission_detail(
        self, db: Session, instructor_id: str, submission_id: uuid.UUID
    ) -> "dict | None":
        """Return full submission detail, or None when not found."""
        ...

    def override_submission_feedback(
        self,
        db: Session,
        instructor_id: str,
        submission_id: uuid.UUID,
        data: dict,
    ) -> "dict | None":
        """Create or replace instructor feedback on a submission, returning None when inaccessible."""
        ...

    def get_velocity_analytics(
        self,
        db: Session,
        instructor_id: str,
        subject_id: "int | None",
    ) -> dict:
        """Return velocity analytics data for the instructor's subjects."""
        ...

    def get_at_risk_students(
        self,
        db: Session,
        instructor_id: str,
        subject_id: "int | None",
        page: int,
        per_page: int,
    ) -> "tuple[list, int]":
        """Return paginated at-risk students and the total count."""
        ...

    def get_concept_heatmap(
        self,
        db: Session,
        instructor_id: str,
        subject_id: "int | None",
        timeframe: str,
    ) -> dict:
        """Return concept heatmap data for topic-level struggle analysis."""
        ...

    def get_knowledge_base_documents(
        self,
        db: Session,
        instructor_id: str,
        subject_id: "int | None",
        doc_type: "str | None",
        search: "str | None",
        page: int,
        per_page: int,
    ) -> "tuple[list, int]":
        """Return paginated knowledge-base documents uploaded by the instructor."""
        ...

    def upload_document(
        self,
        db: Session,
        instructor_id: str,
        subject_id: int,
        filename: str,
        content: bytes,
        doc_type: str,
    ) -> dict:
        """Persist an uploaded document to the knowledge base and return its metadata."""
        ...

    def delete_document(
        self, db: Session, instructor_id: str, doc_id: uuid.UUID
    ) -> "str | None":
        """Delete a knowledge-base document and return an error code string or None on success."""
        ...

    def get_instructor_profile(
        self, db: Session, instructor_id: str
    ) -> dict:
        """Return the instructor's profile including assigned subjects."""
        ...

    def update_instructor_profile(
        self, db: Session, instructor_id: str, data: dict
    ) -> dict:
        """Apply profile field updates and return the refreshed profile."""
        ...
