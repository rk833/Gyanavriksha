"""Domain-level protocols for the student bounded context.

These protocols establish the contracts between the application layer and the
underlying service implementations, enabling dependency inversion so that the
application layer never depends directly on a concrete infrastructure module.
"""
import uuid
from datetime import date
from typing import Protocol

from sqlalchemy.orm import Session


class IStudentService(Protocol):
    """Protocol defining the contract for student-related data operations."""

    def get_student_enrollments(
        self, db: Session, student_id: uuid.UUID
    ) -> list:
        """Return a list of (enrollment, subject, grade) tuples for all active enrollments."""
        ...

    def verify_student_enrollment(
        self, db: Session, student_id: uuid.UUID, subject_id: int
    ) -> None:
        """Raise HTTPException when the student is not enrolled in the given subject."""
        ...

    def get_enrollment_completion(
        self, db: Session, student_id: uuid.UUID, subject_id: int
    ) -> float:
        """Return the completion percentage for a specific enrollment."""
        ...

    def get_student_dashboard_data(
        self, db: Session, student_id: uuid.UUID
    ) -> dict:
        """Return aggregated dashboard statistics for the student."""
        ...

    def get_knowledge_gaps(
        self,
        db: Session,
        student_id: uuid.UUID,
        subject_id: "int | None",
        is_resolved: "bool | None",
        page: int,
        per_page: int,
    ) -> "tuple[list, int]":
        """Return paginated knowledge-gap records and the total count."""
        ...

    def get_knowledge_gap_summary(
        self, db: Session, student_id: uuid.UUID
    ) -> dict:
        """Return aggregated counts for resolved and pending knowledge gaps."""
        ...

    def get_student_progress(
        self, db: Session, student_id: uuid.UUID, period: str
    ) -> dict:
        """Return progress analytics data for the requested time period."""
        ...


class ISubmissionService(Protocol):
    """Protocol defining the contract for submission-related operations."""

    def get_assignments_for_student(
        self,
        db: Session,
        student_id: uuid.UUID,
        subject_id: "int | None",
        status_filter: "str | None",
        due_on: date | None,
        page: int,
        per_page: int,
    ) -> "tuple[list, int]":
        """Return paginated assignment records visible to the student."""
        ...

    def get_assignment_detail(
        self, db: Session, student_id: uuid.UUID, assignment_id: uuid.UUID
    ) -> dict:
        """Return full assignment details or raise when not found/accessible."""
        ...

    def get_submissions_for_student(
        self,
        db: Session,
        student_id: uuid.UUID,
        subject_id: "int | None",
        status_filter: "str | None",
        search: "str | None",
        page: int,
        per_page: int,
    ) -> "tuple[list, int]":
        """Return paginated submission records for the student."""
        ...

    def get_submission_detail(
        self, db: Session, student_id: uuid.UUID, submission_id: uuid.UUID
    ) -> dict:
        """Return full submission details including feedback and knowledge gaps."""
        ...


class INotificationService(Protocol):
    """Protocol defining the contract for student notification operations."""

    def get_notifications(
        self,
        db: Session,
        student_id: uuid.UUID,
        type_filter: "str | None",
        is_read: "bool | None",
        page: int,
        per_page: int,
    ) -> "tuple[list, int, int]":
        """Return (items, total, unread_count) for the student's notifications."""
        ...

    def get_unread_count(self, db: Session, student_id: uuid.UUID) -> int:
        """Return the number of unread notifications for the student."""
        ...

    def mark_as_read(
        self, db: Session, student_id: uuid.UUID, notification_id: uuid.UUID
    ) -> "object | None":
        """Mark a single notification as read and return the updated record."""
        ...

    def mark_all_as_read(self, db: Session, student_id: uuid.UUID) -> int:
        """Mark all unread notifications as read and return the count updated."""
        ...


class ILibraryService(Protocol):
    """Protocol defining the contract for curriculum library operations."""

    def get_library_documents(
        self,
        db: Session,
        student_id: uuid.UUID,
        subject_id: "int | None",
        doc_type: "str | None",
        search: "str | None",
        page: int,
        per_page: int,
    ) -> "tuple[list, int]":
        """Return paginated curriculum documents accessible to the student."""
        ...

    def get_document_detail(
        self, db: Session, student_id: uuid.UUID, doc_id: uuid.UUID
    ) -> dict:
        """Return detail for a single curriculum document."""
        ...
