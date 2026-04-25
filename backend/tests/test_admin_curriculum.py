"""
Sprint 5 Phase 4 — Admin Curriculum Ingestion Integration Tests (GD-118, GD-119, GD-120)
13 tests covering file upload validation, ingestion job management,
vector store namespaces/stats, and curriculum document library CRUD.
"""
import io
import uuid

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.core.config import settings
from app.core.database import get_db
from app.core.security import hash_password
from app.db.models.curriculum_document import CurriculumDocument
from app.db.models.grade import Grade
from app.db.models.subject import Subject
from app.db.models.user import User
from app.main import app
from app.shared.source_enum import EmbeddingStatus, UserRole

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
TEST_PASSWORD = "StrongPass@123"


def _create_user(suffix: str, role: str = "admin") -> User:
    email = f"curr_{RUN_ID}_{suffix}@example.com"
    db = TestSession()
    user = User(
        email=email,
        password_hash=hash_password(TEST_PASSWORD),
        full_name=f"Curr {suffix}",
        role=UserRole(role),
        is_active=True,
        is_email_verified=True,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    db.close()
    return user


def _create_grade(suffix: str) -> Grade:
    db = TestSession()
    grade = Grade(grade_name=f"CG_{RUN_ID}_{suffix}", grade_level=3, is_active=True)
    db.add(grade)
    db.commit()
    db.refresh(grade)
    db.close()
    return grade


def _create_subject(suffix: str, grade_id: int) -> Subject:
    db = TestSession()
    unique = uuid.uuid4().hex[:6]
    subject = Subject(
        grade_id=grade_id,
        subject_name=f"CS_{RUN_ID}_{suffix}",
        subject_code=f"C{unique}",
        chroma_namespace=f"cns_{unique}_{suffix}",
        is_active=True,
    )
    db.add(subject)
    db.commit()
    db.refresh(subject)
    db.close()
    return subject


def _create_doc(suffix: str, subject_id: int, uploader_id, status: EmbeddingStatus) -> CurriculumDocument:
    db = TestSession()
    doc = CurriculumDocument(
        subject_id=subject_id,
        uploaded_by=uploader_id,
        file_name=f"doc_{RUN_ID}_{suffix}.pdf",
        file_path=f"/tmp/doc_{RUN_ID}_{suffix}.pdf",
        file_size_bytes=1024,
        doc_type="curriculum_pdf",
        embedding_status=status,
    )
    db.add(doc)
    db.commit()
    db.refresh(doc)
    db.close()
    return doc


def _login(email: str) -> str:
    resp = client.post("/api/auth/login", json={"email": email, "password": TEST_PASSWORD})
    assert resp.status_code == 200, resp.json()
    return resp.json()["access_token"]


def _auth(token: str) -> dict:
    return {"Authorization": f"Bearer {token}"}


def _pdf_bytes(size: int = 512) -> bytes:
    return b"%PDF-1.4 " + b"x" * size


class TestIngestionUpload:
    """GD-118 — file upload validation."""

    def test_upload_pdf_success(self):
        admin = _create_user("up_admin")
        grade = _create_grade("up")
        subject = _create_subject("up", grade.grade_id)
        token = _login(admin.email)
        resp = client.post(
            "/api/admin/ingestion/upload",
            files={"file": ("test.pdf", io.BytesIO(_pdf_bytes()), "application/pdf")},
            data={"subject_id": str(subject.subject_id)},
            headers=_auth(token),
        )
        assert resp.status_code == 201
        data = resp.json()
        assert data["status"] == "PENDING"

    def test_upload_non_pdf_returns_400(self):
        admin = _create_user("up_invalid")
        grade = _create_grade("up_invalid")
        subject = _create_subject("up_invalid", grade.grade_id)
        token = _login(admin.email)
        resp = client.post(
            "/api/admin/ingestion/upload",
            files={"file": ("test.txt", io.BytesIO(b"plain text"), "text/plain")},
            data={"subject_id": str(subject.subject_id)},
            headers=_auth(token),
        )
        assert resp.status_code == 400

    def test_upload_oversized_file_returns_400(self):
        admin = _create_user("up_big")
        grade = _create_grade("up_big")
        subject = _create_subject("up_big", grade.grade_id)
        token = _login(admin.email)
        big_content = b"x" * (51 * 1024 * 1024)
        resp = client.post(
            "/api/admin/ingestion/upload",
            files={"file": ("big.pdf", io.BytesIO(big_content), "application/pdf")},
            data={"subject_id": str(subject.subject_id)},
            headers=_auth(token),
        )
        assert resp.status_code == 400


class TestIngestionJobs:
    """GD-118 — ingestion job management."""

    def test_list_jobs_with_status_filter(self):
        admin = _create_user("jobs_admin")
        grade = _create_grade("jobs")
        subject = _create_subject("jobs", grade.grade_id)
        _create_doc("jobs_done", subject.subject_id, admin.user_id, EmbeddingStatus.DONE)
        _create_doc("jobs_pending", subject.subject_id, admin.user_id, EmbeddingStatus.PENDING)
        token = _login(admin.email)
        resp = client.get(
            "/api/admin/ingestion/jobs?job_status=DONE",
            headers=_auth(token),
        )
        assert resp.status_code == 200
        for job in resp.json()["jobs"]:
            assert job["status"] == "DONE"

    def test_get_ingestion_job_by_id(self):
        admin = _create_user("job_get")
        grade = _create_grade("job_get")
        subject = _create_subject("job_get", grade.grade_id)
        doc = _create_doc("job_get_doc", subject.subject_id, admin.user_id, EmbeddingStatus.PENDING)
        token = _login(admin.email)
        resp = client.get(f"/api/admin/ingestion/jobs/{doc.doc_id}", headers=_auth(token))
        assert resp.status_code == 200
        assert resp.json()["job_id"] == str(doc.doc_id)

    def test_cancel_queued_job(self):
        admin = _create_user("job_cancel")
        grade = _create_grade("job_cancel")
        subject = _create_subject("job_cancel", grade.grade_id)
        doc = _create_doc("job_cancel_doc", subject.subject_id, admin.user_id, EmbeddingStatus.PENDING)
        token = _login(admin.email)
        resp = client.delete(f"/api/admin/ingestion/jobs/{doc.doc_id}", headers=_auth(token))
        assert resp.status_code == 204


class TestVectorStore:
    """GD-119 — vector store namespaces and stats."""

    def test_get_namespaces_grouped_by_grade(self):
        admin = _create_user("ns_admin")
        token = _login(admin.email)
        resp = client.get("/api/admin/vector-store/namespaces", headers=_auth(token))
        assert resp.status_code == 200
        data = resp.json()
        assert isinstance(data, list)
        if data:
            assert "grade_name" in data[0]
            assert "namespaces" in data[0]

    def test_get_vector_stats_returns_counts(self):
        admin = _create_user("stats_admin")
        token = _login(admin.email)
        resp = client.get("/api/admin/vector-store/stats", headers=_auth(token))
        assert resp.status_code == 200
        data = resp.json()
        assert "total_documents" in data
        assert "total_done" in data
        assert "ai_service_status" in data

    def test_create_namespace_returns_201(self):
        admin = _create_user("ns_create_admin")
        grade = _create_grade("ns_create")
        subject = _create_subject("ns_create", grade.grade_id)
        token = _login(admin.email)
        resp = client.post(
            "/api/admin/vector-store/namespaces",
            json={"name": f"ns_{RUN_ID}", "grade_id": grade.grade_id, "subject_id": subject.subject_id},
            headers=_auth(token),
        )
        assert resp.status_code == 201

    def test_reindex_sets_docs_back_to_pending(self):
        admin = _create_user("reindex_admin")
        grade = _create_grade("reindex")
        subject = _create_subject("reindex", grade.grade_id)
        doc = _create_doc("reindex_doc", subject.subject_id, admin.user_id, EmbeddingStatus.DONE)
        token = _login(admin.email)
        resp = client.post(
            "/api/admin/vector-store/reindex",
            json={"subject_id": subject.subject_id},
            headers=_auth(token),
        )
        assert resp.status_code == 200
        assert resp.json()["requeued_count"] >= 1
        db = TestSession()
        refreshed = db.query(CurriculumDocument).filter(CurriculumDocument.doc_id == doc.doc_id).first()
        assert refreshed.embedding_status == EmbeddingStatus.PENDING
        db.close()


class TestCurriculumLibrary:
    """GD-120 — curriculum document library CRUD."""

    def test_list_curriculum_docs_with_grade_filter(self):
        admin = _create_user("lib_admin")
        grade = _create_grade("lib")
        subject = _create_subject("lib", grade.grade_id)
        _create_doc("lib_doc", subject.subject_id, admin.user_id, EmbeddingStatus.PENDING)
        token = _login(admin.email)
        resp = client.get(
            f"/api/admin/curriculum?grade_id={grade.grade_id}",
            headers=_auth(token),
        )
        assert resp.status_code == 200
        data = resp.json()
        assert "documents" in data
        assert data["total_count"] >= 1

    def test_delete_curriculum_doc(self):
        admin = _create_user("lib_del_admin")
        grade = _create_grade("lib_del")
        subject = _create_subject("lib_del", grade.grade_id)
        doc = _create_doc("lib_del_doc", subject.subject_id, admin.user_id, EmbeddingStatus.PENDING)
        token = _login(admin.email)
        resp = client.delete(f"/api/admin/curriculum/{doc.doc_id}", headers=_auth(token))
        assert resp.status_code == 204
        db = TestSession()
        deleted = db.query(CurriculumDocument).filter(CurriculumDocument.doc_id == doc.doc_id).first()
        assert deleted is None
        db.close()

    def test_requeue_failed_doc(self):
        admin = _create_user("lib_req_admin")
        grade = _create_grade("lib_req")
        subject = _create_subject("lib_req", grade.grade_id)
        doc = _create_doc("lib_req_doc", subject.subject_id, admin.user_id, EmbeddingStatus.FAILED)
        token = _login(admin.email)
        resp = client.post(f"/api/admin/curriculum/{doc.doc_id}/requeue", headers=_auth(token))
        assert resp.status_code == 200
        assert resp.json()["status"] == "PENDING"
