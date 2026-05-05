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
from pypdf import PdfReader

logger = logging.getLogger(__name__)

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
        """Extract text from a PDF (text-based PDFs; scanned pages may be empty)."""
        try:
            reader = PdfReader(BytesIO(pdf_bytes))
            parts = []
            for page in reader.pages:
                parts.append(page.extract_text() or "")
            text = "\n".join(parts).strip()
            return text, "pypdf"
        except Exception as exc:  # noqa: BLE001
            logger.warning("PDF text extraction failed: %s", exc)
            return "", "pypdf_error"

    async def grade(
        self,
        image_bytes: bytes,
        subject: str,
        question: str,
        expected_answer: str,
        content_type: str = "image/jpeg",
    ) -> dict[str, Any]:
        if content_type == "application/pdf" or image_bytes[:4] == b"%PDF":
            extracted_text, engine_used = self._extract_text_from_pdf(image_bytes)
        else:
            extracted_text, engine_used = self._run_ocr(image_bytes)

        if not extracted_text.strip():
            return {
                "grade_classification": "incorrect",
                "score_percentage": 0.0,
                "overall_feedback": "No text could be extracted from the submitted file.",
                "step_by_step_corrections": [],
                "strengths": "",
                "improvements": "For PDFs, use a text-based export or submit clear JPG/PNG photos of your work.",
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
