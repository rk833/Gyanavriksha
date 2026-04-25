import logging
from dataclasses import dataclass, field
from typing import Optional

from google.cloud import vision
from google.api_core.exceptions import GoogleAPICallError, ServiceUnavailable

logger = logging.getLogger(__name__)


@dataclass
class OCRResult:
    """Encapsulates a raw OCR extraction result."""
    text: str
    confidence: float
    engine: str
    raw_response: Optional[object] = field(default=None, repr=False)

    @property
    def is_confident(self) -> bool:
        return self.confidence >= CloudVisionOCR.CONFIDENCE_THRESHOLD


class CloudVisionOCR:
    """
    Primary OCR engine backed by the Google Cloud Vision API.

    Responsibilities (E1-02):
        - Submit preprocessed image bytes to the Vision API.
        - Parse and score the returned full-text annotation.
        - Signal low-confidence or API-unavailable outcomes to the caller.
    """

    CONFIDENCE_THRESHOLD: float = 0.80  # Scores below this trigger fallback (E1-03)

    def __init__(self, client: Optional[vision.ImageAnnotatorClient] = None) -> None:
        """
        Args:
            client: Injectable Vision API client; a default is created when
                    omitted, which picks up ADC / GOOGLE_APPLICATION_CREDENTIALS.
        """
        self._client = client or vision.ImageAnnotatorClient()

    # ------------------------------------------------------------------
    # Public interface
    # ------------------------------------------------------------------

    def extract(self, image_bytes: bytes) -> OCRResult:
        """
        Run OCR on *already-preprocessed* image bytes.

        Args:
            image_bytes: Raw image bytes produced by the upstream
                        preprocessing microservice (E1-01 delegated).

        Returns:
            OCRResult with extracted text, aggregate confidence, and engine tag.

        Raises:
            ServiceUnavailable: Propagated so the orchestrator can invoke the
                                Tesseract fallback (E1-03).
        """
        image = vision.Image(content=image_bytes)
        try:
            response = self._client.document_text_detection(image=image)
        except ServiceUnavailable as exc:
            logger.warning("Cloud Vision API unavailable: %s", exc)
            raise
        except GoogleAPICallError as exc:
            logger.error("Cloud Vision API call failed: %s", exc)
            raise ServiceUnavailable(str(exc)) from exc

        self._raise_for_api_errors(response)

        full_text = response.full_text_annotation
        if not full_text or not full_text.text.strip():
            logger.info("Cloud Vision returned an empty annotation.")
            return OCRResult(text="", confidence=0.0, engine="cloud_vision",
                            raw_response=response)

        confidence = self._aggregate_confidence(full_text)
        logger.debug("Cloud Vision confidence: %.3f", confidence)

        return OCRResult(
            text=full_text.text,
            confidence=confidence,
            engine="cloud_vision",
            raw_response=response,
        )

    # ------------------------------------------------------------------
    # Private helpers
    # ------------------------------------------------------------------

    @staticmethod
    def _raise_for_api_errors(response: vision.AnnotateImageResponse) -> None:
        if response.error.message:
            raise GoogleAPICallError(
                f"Cloud Vision returned an error: {response.error.message}"
            )

    @staticmethod
    def _aggregate_confidence(
        full_text: vision.TextAnnotation,
    ) -> float:
        """
        Derive an aggregate confidence score from page-level symbol confidences.
        Falls back to 0.0 if the API omits confidence metadata.
        """
        scores: list[float] = []
        for page in full_text.pages:
            for block in page.blocks:
                for paragraph in block.paragraphs:
                    for word in paragraph.words:
                        for symbol in word.symbols:
                            if symbol.confidence:
                                scores.append(symbol.confidence)
        return sum(scores) / len(scores) if scores else 0.0