"""
Phase 2 — RAG Integration Tests (GD-155)

Tests the RAG query and document upload relay routes. The AI microservice HTTP
calls are mocked so no real ai-service instance is required.
"""
import io
import uuid
from unittest.mock import AsyncMock, MagicMock, patch

from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.core.config import settings
from app.core.database import get_db
from app.main import app

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

_QUERY_SUCCESS = {
    "answer": "Fractions represent parts of a whole.",
    "sources": [{"chunk": "Fractions 101", "score": 0.91}],
}
_UPLOAD_SUCCESS = {"status": "indexed", "chunks_created": 4}


def _mock_ai_post(return_value: dict):
    """Return a patch context that makes ai_post return a fixed dict."""
    return patch("app.services.rag_service.ai_post", new=AsyncMock(return_value=return_value))


def _mock_upload_response(status_code: int = 200, json_body: dict = None):
    """Return a patch context that makes the upload httpx call return a fixed response."""
    mock_resp = MagicMock()
    mock_resp.status_code = status_code
    mock_resp.is_success = status_code < 400
    mock_resp.json.return_value = json_body or _UPLOAD_SUCCESS
    mock_resp.text = str(json_body)
    mock_client = AsyncMock()
    mock_client.__aenter__ = AsyncMock(return_value=mock_client)
    mock_client.__aexit__ = AsyncMock(return_value=False)
    mock_client.post = AsyncMock(return_value=mock_resp)
    return patch("app.services.rag_service.httpx.AsyncClient", return_value=mock_client)


class TestRagQuery:
    def test_query_success(self):
        with _mock_ai_post(_QUERY_SUCCESS):
            resp = client.post("/api/rag/query", json={
                "user_type": "student",
                "query": "Explain fractions",
                "student_id": str(uuid.uuid4()),
            })
        assert resp.status_code == 200
        assert resp.json()["answer"] == _QUERY_SUCCESS["answer"]

    def test_query_admin_with_grade(self):
        with _mock_ai_post(_QUERY_SUCCESS):
            resp = client.post("/api/rag/query", json={
                "user_type": "admin",
                "query": "Curriculum overview",
                "grade": 8,
            })
        assert resp.status_code == 200

    def test_query_missing_user_type_returns_422(self):
        resp = client.post("/api/rag/query", json={"query": "Explain fractions"})
        assert resp.status_code == 422

    def test_query_missing_query_returns_422(self):
        resp = client.post("/api/rag/query", json={"user_type": "student"})
        assert resp.status_code == 422

    def test_query_empty_query_returns_422(self):
        resp = client.post("/api/rag/query", json={"user_type": "student", "query": ""})
        assert resp.status_code == 422

    def test_query_ai_service_unavailable_returns_503(self):
        from fastapi import HTTPException
        with patch(
            "app.services.rag_service.ai_post",
            new=AsyncMock(side_effect=HTTPException(status_code=503, detail="AI service is unavailable.")),
        ):
            resp = client.post("/api/rag/query", json={
                "user_type": "student",
                "query": "Test query",
            })
        assert resp.status_code == 503


class TestRagUpload:
    def test_upload_pdf_success(self):
        with _mock_upload_response(200, _UPLOAD_SUCCESS):
            resp = client.post(
                "/api/rag/upload",
                data={"user_type": "instructor", "submitted_by": str(uuid.uuid4())},
                files={"file": ("notes.pdf", io.BytesIO(b"%PDF-1.4 test"), "application/pdf")},
            )
        assert resp.status_code == 201
        assert resp.json()["status"] == "indexed"

    def test_upload_txt_success(self):
        with _mock_upload_response(200, _UPLOAD_SUCCESS):
            resp = client.post(
                "/api/rag/upload",
                data={"user_type": "admin", "submitted_by": str(uuid.uuid4())},
                files={"file": ("lesson.txt", io.BytesIO(b"lesson content"), "text/plain")},
            )
        assert resp.status_code == 201

    def test_upload_unsupported_type_returns_422(self):
        resp = client.post(
            "/api/rag/upload",
            data={"user_type": "admin", "submitted_by": str(uuid.uuid4())},
            files={"file": ("file.exe", io.BytesIO(b"binary"), "application/octet-stream")},
        )
        assert resp.status_code == 422

    def test_upload_missing_file_returns_422(self):
        resp = client.post(
            "/api/rag/upload",
            data={"user_type": "admin", "submitted_by": str(uuid.uuid4())},
        )
        assert resp.status_code == 422

    def test_upload_missing_user_type_returns_422(self):
        resp = client.post(
            "/api/rag/upload",
            data={"submitted_by": str(uuid.uuid4())},
            files={"file": ("notes.pdf", io.BytesIO(b"%PDF"), "application/pdf")},
        )
        assert resp.status_code == 422

    def test_upload_ai_service_unavailable_returns_503(self):
        import httpx
        mock_client = AsyncMock()
        mock_client.__aenter__ = AsyncMock(return_value=mock_client)
        mock_client.__aexit__ = AsyncMock(return_value=False)
        mock_client.post = AsyncMock(side_effect=httpx.ConnectError("refused"))
        with patch("app.services.rag_service.httpx.AsyncClient", return_value=mock_client):
            resp = client.post(
                "/api/rag/upload",
                data={"user_type": "admin", "submitted_by": str(uuid.uuid4())},
                files={"file": ("notes.pdf", io.BytesIO(b"%PDF"), "application/pdf")},
            )
        assert resp.status_code == 503
