"""
Curriculum RAG Indexing Script
================================
Sends each real curriculum PDF from backend/uploads/curriculum/ to the AI service
RAG pipeline (chunking → embedding → ChromaDB) and updates the database status.

Prerequisites:
  - AI service must be running  (uv run uvicorn app.main:app --reload --port 8001)
  - Backend DB must be seeded   (uv run python -m app.scripts.seed_demo_data)

Run:
  uv run python -m app.scripts.index_curriculum_docs

Optional flags (via env or inline edit):
  AI_SERVICE_URL  — defaults to http://localhost:8001
"""
import mimetypes
import os
import time
from datetime import datetime, timezone
from pathlib import Path

import httpx

from app.core.database import SessionLocal
from app.db.models.curriculum_document import CurriculumDocument
from app.shared.source_enum import EmbeddingStatus

AI_SERVICE_URL = os.getenv("AI_SERVICE_URL", "http://localhost:8001")

UPLOADS_ROOT = Path(__file__).resolve().parents[2] / "uploads" / "curriculum"

# Map filename → subject name sent to the AI service RAG endpoint.
# Subject names must match what is stored in the database (see seed_demo_data.py).
FILE_SUBJECT_MAP = {
    "ENGLISH GRADE 9.pdf":            {"subject": "English",          "user_type": "admin", "grade": 9},
    "MATHEMATICS GRADE 10.pdf":       {"subject": "Mathematics",      "user_type": "admin", "grade": 10},
    "Computer Science  Grade 10.pdf": {"subject": "Computer Science", "user_type": "admin", "grade": 10},
    "COMPUTER SCIENCE GRADE 9.pdf":   {"subject": "Computer Science", "user_type": "admin", "grade": 9},
}


def _update_status(db, doc: CurriculumDocument, status: EmbeddingStatus, collection: str | None = None) -> None:
    doc.embedding_status = status
    if status == EmbeddingStatus.DONE:
        doc.embedded_at = datetime.now(timezone.utc)
        if collection:
            doc.chroma_collection_id = collection
    db.commit()


def _send_to_rag(file_path: Path, meta: dict, timeout: float = 600.0, max_retries: int = 5) -> dict:
    """POST the file to the AI service /rag/upload endpoint.

    Retries up to `max_retries` times on 429 (quota exhausted), waiting 65 seconds
    between each attempt so the Vertex AI quota window has time to reset.
    """
    content_type, _ = mimetypes.guess_type(str(file_path))
    content_type = content_type or "application/octet-stream"
    with open(file_path, "rb") as fh:
        file_bytes = fh.read()
    form = {
        "user_type": meta["user_type"],
        "submitted_by": "seed-script",
        "subject": meta["subject"],
        "grade": str(meta["grade"]),
    }
    for attempt in range(1, max_retries + 1):
        with httpx.Client(timeout=timeout) as client:
            response = client.post(
                f"{AI_SERVICE_URL}/rag/upload",
                data=form,
                files={"file": (file_path.name, file_bytes, content_type)},
            )
        if response.status_code == 500 and "429" in response.text:
            wait = 65
            print(f"  [429] Quota exhausted (attempt {attempt}/{max_retries}). Waiting {wait}s for reset...")
            time.sleep(wait)
            continue
        response.raise_for_status()
        return response.json()
    response.raise_for_status()
    return response.json()


def run() -> None:
    db = SessionLocal()
    try:
        print(f"[INDEX] AI service: {AI_SERVICE_URL}")
        print(f"[INDEX] Uploads root: {UPLOADS_ROOT}")
        print()

        # Check AI service is reachable (connect-only check, any response is fine)
        try:
            httpx.get(f"{AI_SERVICE_URL}/docs", timeout=10)
        except httpx.ConnectError:
            print("[ERROR] Cannot reach AI service. Make sure it is running on port 8001.")
            return
        except Exception:
            pass  # Any other error (timeout on slow startup, etc.) — proceed anyway

        for file_name, meta in FILE_SUBJECT_MAP.items():
            file_path = UPLOADS_ROOT / file_name

            if not file_path.exists():
                print(f"  [!] File not found, skipping: {file_path}")
                continue

            # Find matching DB record
            doc: CurriculumDocument | None = (
                db.query(CurriculumDocument)
                .filter(CurriculumDocument.file_name == file_name)
                .first()
            )
            if not doc:
                print(f"  [!] No DB record for '{file_name}' — run seed_demo_data first, skipping.")
                continue

            if doc.embedding_status == EmbeddingStatus.DONE and doc.embedded_at:
                print(f"  [~] Already indexed: {file_name}")
                continue

            size_mb = file_path.stat().st_size / 1_048_576
            print(f"  [>>] Indexing {file_name} ({size_mb:.1f} MB) into '{meta['subject']}'...")
            _update_status(db, doc, EmbeddingStatus.PROCESSING)

            try:
                result = _send_to_rag(file_path, meta)
                collection = result.get("collection", "")
                chunks = result.get("chunks_added", "?")
                _update_status(db, doc, EmbeddingStatus.DONE, collection)
                print(f"  [OK] Done -- {chunks} chunks in collection '{collection}'")
            except httpx.HTTPStatusError as exc:
                _update_status(db, doc, EmbeddingStatus.FAILED)
                print(f"  [FAIL] HTTP error {exc.response.status_code}: {exc.response.text[:200]}")
            except Exception as exc:
                _update_status(db, doc, EmbeddingStatus.FAILED)
                print(f"  [FAIL] {exc}")

        print()
        print("[INDEX] Done.")
    finally:
        db.close()


if __name__ == "__main__":
    run()
