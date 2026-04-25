"""
OCR Microservice
================
Orchestrates the Cloud Vision (primary) and Tesseract (fallback) OCR engines.

Requirement mapping
-------------------
E1-01  Preprocessing is intentionally delegated to the upstream AI
    microservice. This service receives already-preprocessed image bytes.
E1-02  CloudVisionOCR is the primary extraction engine.
E1-03  TesseractOCR is invoked on API unavailability or low confidence.
E1-04  ImageQualityError is raised with an actionable message for images that
    fail quality checks, before OCR is attempted.
"""

from __future__ import annotations

import logging
from dataclasses import dataclass
from typing import Optional

from google.api_core.exceptions import ServiceUnavailable

from .cloud_vision import CloudVisionOCR, OCRResult
from .tesseract_fallback import TesseractOCR, TesseractConfigError

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Domain exceptions
# ---------------------------------------------------------------------------

class ImageQualityError(ValueError):
    """
    Raised when an image fails quality checks before OCR is attempted (E1-04).
    The message is intended to be forwarded directly to the student.
    """


class OCRFailureError(RuntimeError):
    """Raised when both OCR engines fail to produce a usable result."""


# ---------------------------------------------------------------------------
# Quality gate
# ---------------------------------------------------------------------------

@dataclass(frozen=True)
class QualityGate:
    """
    Stateless validator applied to raw image bytes before OCR.

    Checks (E1-04):
        - Minimum byte size  (rejects empty / truncated uploads)
        - Magic-byte format  (rejects non-image payloads)
        - Maximum byte size  (rejects files too large for the OCR pipeline)
    """

    min_bytes: int = 1_024          # 1 KB
    max_bytes: int = 10 * 1024 * 1024  # 10 MB

    # Leading bytes for JPEG, PNG, GIF, BMP, TIFF, WebP
    _SUPPORTED_MAGIC: tuple[bytes, ...] = (
        b"\xff\xd8\xff",        # JPEG
        b"\x89PNG",             # PNG
        b"GIF8",                # GIF
        b"BM",                  # BMP
        b"II\x2a\x00",         # TIFF (little-endian)
        b"MM\x00\x2a",         # TIFF (big-endian)
        b"RIFF",                # WebP (RIFF container)
    )

    def validate(self, image_bytes: bytes) -> None:
        """
        Validate image bytes and raise ImageQualityError with an actionable
        student-facing message if any check fails (E1-04).
        """
        if not image_bytes or len(image_bytes) < self.min_bytes:
            raise ImageQualityError(
                "The submitted image appears to be empty or incomplete. "
                "Please re-upload a clear, full image of your work."
            )

        if len(image_bytes) > self.max_bytes:
            raise ImageQualityError(
                f"The submitted image exceeds the maximum allowed size of "
                f"{self.max_bytes // (1024 * 1024)} MB. "
                "Please compress or resize the image before resubmitting."
            )

        if not any(image_bytes.startswith(magic) for magic in self._SUPPORTED_MAGIC):
            raise ImageQualityError(
                "The submitted file does not appear to be a supported image format "
                "(JPEG, PNG, GIF, BMP, TIFF, or WebP). "
                "Please convert your file and resubmit."
            )


# ---------------------------------------------------------------------------
# Orchestrator
# ---------------------------------------------------------------------------

class OCRService:
    """
    Top-level OCR orchestrator exposed by this microservice.

    Usage::

        service = OCRService()
        result  = service.process(image_bytes)
        print(result.text, result.engine)

    Engine selection logic (E1-02 / E1-03):
        1. Quality-gate the image bytes first (E1-04).
        2. Attempt Cloud Vision OCR.
        a. If the API is unavailable → fall back to Tesseract.
        b. If the result confidence is below threshold → fall back to Tesseract.
        3. Return the best available OCRResult.
        4. If both engines fail → raise OCRFailureError.
    """

    def __init__(
        self,
        cloud_vision: Optional[CloudVisionOCR] = None,
        tesseract: Optional[TesseractOCR] = None,
        quality_gate: Optional[QualityGate] = None,
    ) -> None:
        """
        All dependencies are injectable for testability.

        Args:
            cloud_vision:  Primary OCR engine (E1-02).
            tesseract:     Fallback OCR engine (E1-03).
            quality_gate:  Pre-OCR image validator (E1-04).
        """
        self._cloud_vision = cloud_vision or CloudVisionOCR()
        self._tesseract = tesseract or TesseractOCR()
        self._quality_gate = quality_gate or QualityGate()

    # ------------------------------------------------------------------
    # Public interface
    # ------------------------------------------------------------------

    def process(self, image_bytes: bytes) -> OCRResult:
        """
        Validate and extract text from preprocessed image bytes.

        Note:
            Preprocessing (noise removal, deskewing, contrast enhancement) is
            performed by the upstream AI microservice before this call (E1-01).

        Args:
            image_bytes: Preprocessed image bytes from the upstream service.

        Returns:
            OCRResult from the first engine that succeeds with sufficient
            confidence.

        Raises:
            ImageQualityError: Image failed the quality gate (E1-04).
            OCRFailureError:   Both OCR engines failed.
        """
        # E1-04 — quality gate before any OCR work
        self._quality_gate.validate(image_bytes)

        # E1-02 — primary: Cloud Vision
        result = self._try_cloud_vision(image_bytes)

        # E1-03 — fallback: Tesseract
        if result is None or not result.is_confident:
            reason = (
                "API unavailable" if result is None
                else f"low confidence ({result.confidence:.0%})"
            )
            logger.info(
                "Falling back to Tesseract OCR — Cloud Vision %s.", reason
            )
            result = self._try_tesseract(image_bytes, cloud_result=result)

        if result is None:
            raise OCRFailureError(
                "All OCR engines failed to extract text from the submitted image. "
                "Please ensure the image is legible and try again."
            )

        logger.info(
            "OCR complete via '%s' (confidence: %.0f%%).",
            result.engine, result.confidence * 100,
        )
        return result

    # ------------------------------------------------------------------
    # Private engine wrappers
    # ------------------------------------------------------------------

    def _try_cloud_vision(self, image_bytes: bytes) -> Optional[OCRResult]:
        try:
            return self._cloud_vision.extract(image_bytes)
        except ServiceUnavailable as exc:
            logger.warning("Cloud Vision unavailable, will use Tesseract: %s", exc)
            return None
        except Exception as exc:  # noqa: BLE001
            logger.error("Unexpected Cloud Vision error: %s", exc)
            return None

    def _try_tesseract(
        self,
        image_bytes: bytes,
        *,
        cloud_result: Optional[OCRResult],
    ) -> Optional[OCRResult]:
        try:
            tesseract_result = self._tesseract.extract(image_bytes)

            # Prefer Tesseract result if it is more confident than the Cloud
            # Vision result (covers the low-confidence fallback branch of E1-03)
            if (
                cloud_result is not None
                and cloud_result.text
                and cloud_result.confidence >= tesseract_result.confidence
            ):
                logger.debug(
                    "Cloud Vision result retained over Tesseract "
                    "(%.2f >= %.2f).",
                    cloud_result.confidence, tesseract_result.confidence,
                )
                return cloud_result

            return tesseract_result
        except TesseractConfigError as exc:
            logger.error("Tesseract fallback failed: %s", exc)
            return cloud_result  # last-resort: return whatever Cloud Vision gave us


__all__ = [
    "OCRService",
    "ImageQualityError",
    "OCRFailureError",
    "QualityGate",
    "OCRResult",
]