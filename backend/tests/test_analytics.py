"""
Phase 2 — Analytics / Heatmap Integration Tests (GD-155)

Tests the chat-processing trigger and student heatmap retrieval routes. The AI
microservice call inside process_chat_heatmap is mocked so no real service or
chat log files are required.
"""
import uuid
from unittest.mock import AsyncMock, patch

from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.core.config import settings
from app.core.database import get_db
from app.core.security import hash_password
from app.db.models.concept_heatmap_entry import ConceptHeatmapEntry
from app.db.models.user import User
from app.main import app
from app.shared.source_enum import UserRole

engine = create_engine(settings.SYNC_DATABASE_URL)
TestSession = sessionmaker(bind=engine, autocommit=False, autoflush=False)


def override_get_db():
    db = TestSession()
    try:
        yield db
    finally:
        db.close()


app.dependency_overrides[get_db] = override_get_db
client = TestClient(app)

RUN_ID = uuid.uuid4().hex[:6]

_HEATMAP_AI_RESULT = {
    "concepts": [
        {"concept_name": "Fractions", "topic_tag": "fractions", "proficiency": 4.5},
        {"concept_name": "Division", "topic_tag": "division", "proficiency": 7.0},
    ]
}


def _create_student() -> User:
    """Create and persist a test student user."""
    db = TestSession()
    user = User(
        email=f"analytics_{RUN_ID}_{uuid.uuid4().hex[:4]}@test.com",
        password_hash=hash_password("Pass@1234"),
        full_name="Analytics Student",
        role=UserRole.STUDENT,
        is_active=True,
        is_email_verified=True,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    db.close()
    return user


def _create_heatmap_entry(student_id: uuid.UUID, topic_tag: str, subject_id: int = 1) -> ConceptHeatmapEntry:
    """Create and persist one ConceptHeatmapEntry for the given student."""
    from datetime import datetime
    db = TestSession()
    entry = ConceptHeatmapEntry(
        student_id=student_id,
        subject_id=subject_id,
        grade_id=1,
        concept_name=topic_tag.capitalize(),
        topic_tag=topic_tag,
        occurrence_count=2,
        proficiency_score=6.5,
        last_updated_at=datetime.utcnow(),
    )
    db.add(entry)
    db.commit()
    db.refresh(entry)
    db.close()
    return entry


def _mock_heatmap_service(return_value: dict = None):
    """Patch process_chat_heatmap to avoid real AI and file-system calls."""
    return patch(
        "app.services.heatmap_service.process_chat_heatmap",
        new=AsyncMock(return_value=return_value or _HEATMAP_AI_RESULT),
    )


class TestProcessChat:
    def test_trigger_returns_200(self):
        history_id = uuid.uuid4()
        with _mock_heatmap_service():
            resp = client.post(f"/analytics/process-chat/{history_id}")
        assert resp.status_code == 200
        assert "started" in resp.json()["message"].lower()

    def test_trigger_invalid_uuid_returns_422(self):
        resp = client.post("/analytics/process-chat/not-a-uuid")
        assert resp.status_code == 422


class TestGetStudentHeatmap:
    def test_returns_entries_for_student(self):
        student = _create_student()
        _create_heatmap_entry(student.user_id, "fractions")
        _create_heatmap_entry(student.user_id, "algebra")
        resp = client.get(f"/analytics/heatmap/{student.user_id}")
        assert resp.status_code == 200
        data = resp.json()
        assert isinstance(data, list)
        assert len(data) >= 2
        topic_tags = [e["topic_tag"] for e in data]
        assert "fractions" in topic_tags
        assert "algebra" in topic_tags

    def test_returns_empty_list_for_unknown_student(self):
        resp = client.get(f"/analytics/heatmap/{uuid.uuid4()}")
        assert resp.status_code == 200
        assert resp.json() == []

    def test_entry_has_expected_fields(self):
        student = _create_student()
        _create_heatmap_entry(student.user_id, "geometry")
        resp = client.get(f"/analytics/heatmap/{student.user_id}")
        assert resp.status_code == 200
        entry = resp.json()[0]
        assert "subject_id" in entry
        assert "concept_name" in entry
        assert "topic_tag" in entry
        assert "occurrence_count" in entry
        assert "proficiency_score" in entry

    def test_invalid_student_uuid_returns_422(self):
        resp = client.get("/analytics/heatmap/not-a-uuid")
        assert resp.status_code == 422
