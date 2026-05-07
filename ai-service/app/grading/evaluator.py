"""
Submission grading evaluator.

Pipeline:
  1. OCR the uploaded image (Cloud Vision → Tesseract fallback)
  2. Run LLM to grade extracted text against expected answer
  3. Return structured feedback
"""
import os
import logging
from io import BytesIO
from typing import Any

from langchain_google_vertexai import ChatVertexAI
from langchain_core.messages import HumanMessage

from app.core.google_auth import configure_google_credentials
from app.ocr.cloud_vision import VisionService
from app.ocr.tesseract_fallback import TesseractService
import re

from pypdf import PdfReader

logger = logging.getLogger(__name__)

# Words that appear in scanner watermarks but carry no student content.
# If pypdf's extracted text is entirely composed of these tokens it means the
# PDF is image-based and we must fall through to the PyMuPDF→OCR path.
_WATERMARK_TOKENS = {
    "camscanner", "scanned", "scan", "adobe", "acrobat",
    "microsoft", "office", "lens", "genius", "tiny",
}


def _is_watermark_only(text: str) -> bool:
    """Return True when *text* contains no meaningful student content.

    Strips punctuation/whitespace, lowercases every word, and checks whether
    ALL remaining words are known scanner/watermark tokens.
    Texts shorter than 30 meaningful characters are also treated as noise.
    """
    cleaned = re.sub(r"[^a-zA-Z0-9\s]", " ", text).lower()
    words = [w for w in cleaned.split() if len(w) > 1]
    if not words:
        return True
    meaningful_chars = sum(len(w) for w in words if w not in _WATERMARK_TOKENS)
    return meaningful_chars < 30

_GRADE_PROMPT = """
You are an experienced teacher grading a student's handwritten assignment.

**Subject:** {subject}
**Question / Assignment Brief:** {question}
**Expected Answer / Marking Scheme:** {expected_answer}

**Student's Submitted Text (extracted via OCR):**
{extracted_text}

Evaluate the submission and respond ONLY with valid JSON in this exact structure:
{{
  "grade_classification": "correct" | "partial" | "incorrect",
  "score_percentage": <float 0-100>,
  "overall_feedback": "<concise feedback string>",
  "step_by_step_corrections": [
    {{ "step": "<step name>", "status": "correct"|"incorrect"|"missing", "comment": "<note>" }}
  ],
  "strengths": "<what the student did well>",
  "improvements": "<what the student needs to work on>",
  "knowledge_gap_detected": true | false,
  "failed_at_step": "<step name if a critical step failed, else null>",
  "gap_concept": "<short label for the weak concept if knowledge_gap_detected, else null>",
  "gap_topic_tag": "<snake_case tag unique within subject if knowledge_gap_detected, else null>"
}}
""".strip()


class GradingEvaluator:
    def __init__(self) -> None:
        configure_google_credentials()

        project = os.getenv("GOOGLE_CLOUD_PROJECT") or os.getenv("GOOGLE_CLOUD_REGION", "us-central1")
        location = os.getenv("GOOGLE_CLOUD_LOCATION") or os.getenv("GOOGLE_CLOUD_REGION", "us-central1")

        self._llm = ChatVertexAI(
            model_name="gemini-2.5-flash",
            project=os.getenv("GOOGLE_CLOUD_PROJECT"),
            location=location,
            temperature=0.2,
        )
        self._vision = VisionService()
        self._tesseract = TesseractService()

    def _run_ocr(self, image_bytes: bytes) -> tuple[str, str]:
        """Returns (extracted_text, engine_used)."""
        text = self._vision.extract_text(image_bytes)
        if text.strip():
            return text, "google_cloud_vision"

        logger.warning("Cloud Vision returned empty text; falling back to Tesseract")
        text = self._tesseract.extract_text(image_bytes)
        return text, "tesseract_fallback"

    def _extract_text_from_pdf(self, pdf_bytes: bytes) -> tuple[str, str]:
        """Extract text from a PDF.

        Strategy:
        1. pypdf  — fast, works for digitally-created PDFs with embedded text.
        2. pymupdf render → OCR — for scanned / handwritten PDFs (e.g. CamScanner)
           where page content is a rasterised image with no embedded text layer.
        """
        # ── Step 1: pypdf (text-based PDFs) ──────────────────────────────────
        try:
            reader = PdfReader(BytesIO(pdf_bytes))
            parts = [page.extract_text() or "" for page in reader.pages]
            text = "\n".join(parts).strip()
            if text and not _is_watermark_only(text):
                logger.info("PDF text extracted via pypdf (%d chars)", len(text))
                return text, "pypdf"
            if text:
                logger.info(
                    "pypdf found only watermark/noise text (%r) — falling through to image OCR",
                    text[:80],
                )
        except Exception as exc:  # noqa: BLE001
            logger.warning("pypdf text extraction failed: %s", exc)

        # ── Step 2: pymupdf render → OCR (scanned/handwritten PDFs) ─────────
        try:
            import fitz  # pymupdf

            doc = fitz.open(stream=pdf_bytes, filetype="pdf")
            page_count = min(len(doc), 10)
            page_texts: list[str] = []
            for page_num in range(page_count):  # cap at 10 pages
                page = doc.load_page(page_num)

                # Compute a scale that renders the long edge to ~2000 px.
                # CamScanner sometimes sets page size to photo dimensions
                # (e.g. 3456×4608 pts) which would be enormous at 2× scale.
                page_w = page.rect.width   # points (1 pt = 1/72 inch)
                page_h = page.rect.height
                TARGET_PX = 2000
                scale = TARGET_PX / max(page_w, page_h, 1)
                # Never go below 1× so we don't lose detail on standard A4 pages
                scale = max(scale, 1.0)
                logger.info(
                    "PDF page %d: %.0f×%.0f pts → scale %.2f → ~%.0f×%.0f px",
                    page_num + 1, page_w, page_h, scale,
                    page_w * scale, page_h * scale,
                )

                # Force RGB so JPEG encoding never fails due to alpha channel
                pix = page.get_pixmap(
                    matrix=fitz.Matrix(scale, scale),
                    colorspace=fitz.csRGB,
                    alpha=False,
                )
                img_bytes = pix.tobytes("jpeg")
                page_text, engine = self._run_ocr(img_bytes)
                logger.info(
                    "PDF page %d OCR via %s → %d chars",
                    page_num + 1, engine, len(page_text),
                )
                if page_text.strip():
                    page_texts.append(page_text.strip())
            doc.close()
            if page_texts:
                return "\n\n".join(page_texts), "pymupdf_ocr"
            logger.warning("pymupdf rendered %d pages but OCR returned no text", page_count)
        except Exception as exc:  # noqa: BLE001
            logger.warning("pymupdf render + OCR failed: %s", exc)

        return "", "pdf_all_methods_failed"

    async def extract_text(
        self,
        image_bytes: bytes,
        content_type: str = "image/jpeg",
    ) -> dict[str, Any]:
        """OCR only — returns extracted text without running the LLM grader."""
        if content_type == "application/pdf" or image_bytes[:4] == b"%PDF":
            text, engine = self._extract_text_from_pdf(image_bytes)
        else:
            text, engine = self._run_ocr(image_bytes)
        return {"extracted_text": text, "ocr_engine_used": engine}

    async def grade(
        self,
        image_bytes: bytes,
        subject: str,
        question: str,
        expected_answer: str,
        content_type: str = "image/jpeg",
        pre_extracted_text: str | None = None,
    ) -> dict[str, Any]:
        # Use caller-supplied text when all pages have already been OCR'd externally.
        if pre_extracted_text is not None:
            extracted_text = pre_extracted_text
            engine_used = "pre_extracted"
        elif content_type == "application/pdf" or image_bytes[:4] == b"%PDF":
            extracted_text, engine_used = self._extract_text_from_pdf(image_bytes)
        else:
            extracted_text, engine_used = self._run_ocr(image_bytes)

        if not extracted_text.strip():
            return {
                "grade_classification": "incorrect",
                "score_percentage": 0.0,
                "overall_feedback": "No readable text could be extracted from your submission.",
                "step_by_step_corrections": [],
                "strengths": "",
                "improvements": (
                    "Please submit clear JPG/PNG photos of your handwritten work. "
                    "If uploading a PDF, ensure each page is a high-quality scan or photo."
                ),
                "knowledge_gap_detected": False,
                "failed_at_step": "ocr",
                "ocr_engine_used": engine_used,
                "extracted_text": "",
            }

        prompt = _GRADE_PROMPT.format(
            subject=subject,
            question=question,
            expected_answer=expected_answer,
            extracted_text=extracted_text,
        )

        response = await self._llm.ainvoke([HumanMessage(content=prompt)])
        raw = response.content.strip()

        # Strip markdown code fences if present
        if raw.startswith("```"):
            raw = raw.split("\n", 1)[-1].rsplit("```", 1)[0].strip()

        import json
        result = json.loads(raw)
        result["ocr_engine_used"] = engine_used
        result["extracted_text"] = extracted_text
        return result
