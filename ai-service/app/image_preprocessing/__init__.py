# __init__.py
"""
Image Preprocessing Microservice
=================================
Validates and preprocesses student-submitted images before they are
forwarded to the OCR microservice.

Requirement mapping
-------------------
E1-01  ImageProcessor applies noise removal, deskewing, and contrast
    enhancement via OpenCV before the image leaves this service.
E1-04  QualityValidator rejects unacceptable images with actionable,
    student-facing error messages before any preprocessing is attempted.
"""

from __future__ import annotations

import logging
from dataclasses import dataclass

from app.ocr import extract_text  # module-level so tests can patch it easily
from .image_processor import ImageProcessor, ProcessedImage
from .quality_validator import QualityValidator, QualityThresholds, ImageQualityError

logger = logging.getLogger(__name__)


# -------------------------------------------------------
# Module-level convenience functions for simpler usage
# -------------------------------------------------------

def validate(image_bytes: bytes) -> None:
    """
    Validate the quality of a raw image using QualityValidator.

    Parameters
    ----------
    image_bytes:
        Raw bytes of any supported image format.

    Raises
    ------
    ImageQualityError
        Describing the specific quality issue found.
    """
    validator = QualityValidator()
    validator.validate(image_bytes)


def preprocess(image_bytes: bytes) -> bytes:
    """
    Preprocess raw image bytes using ImageProcessor.

    Parameters
    ----------
    image_bytes:
        Raw bytes of any supported image format.

    Returns
    -------
    bytes
        Preprocessed image bytes ready for OCR.

    Raises
    ------
    PreprocessingFailureError
        If preprocessing fails unexpectedly.
    """
    processor = ImageProcessor()
    result = processor.preprocess(image_bytes)
    return result.image_bytes


def run_pipeline(
    image_bytes: bytes,
    *,
    ocr_provider: str = "auto",
) -> str | None:
    """
    Full OCR pipeline: validate → preprocess → OCR.

    Parameters
    ----------
    image_bytes:
        Raw bytes of any supported image format.
    ocr_provider:
        Forwarded to ``ocr.extract_text``.  One of ``"auto"``,
        ``"google_cloud_vision"``, or ``"tesseract"``.

    Returns
    -------
    str
        Extracted text (may be empty string for images with no text).
    None
        When quality validation fails or a ``RuntimeError`` is raised by the
        OCR layer.
    """
    try:
        validate(image_bytes)
    except ImageQualityError as exc:
        logger.info("Image rejected by quality validator: %s", exc)
        return None

    try:
        processed_bytes = preprocess(image_bytes)
    except (RuntimeError, PreprocessingFailureError) as exc:
        logger.warning("Preprocessing failed: %s", exc)
        return None

    try:
        return extract_text(processed_bytes, provider=ocr_provider)
    except RuntimeError as exc:
        logger.warning("OCR failed: %s", exc)
        return None


class PreprocessingFailureError(RuntimeError):
    """Raised when the preprocessing pipeline itself fails unexpectedly."""


@dataclass(frozen=True)
class PreprocessingResponse:
    """
    The outbound payload handed to the OCR microservice.
    Wraps the processed bytes together with pipeline metadata that
    downstream services or monitoring dashboards may find useful.
    """
    image_bytes: bytes
    original_shape: tuple[int, int, int]
    skew_angle_deg: float
    was_deskewed: bool
    stages_applied: list[str]

    @classmethod
    def from_processed(cls, result: ProcessedImage) -> "PreprocessingResponse":
        return cls(
            image_bytes=result.image_bytes,
            original_shape=result.original_shape,
            skew_angle_deg=result.skew_angle_deg,
            was_deskewed=result.was_deskewed,
            stages_applied=[stage.name for stage in result.stages_applied],
        )


class PreprocessingService:
    """
    Orchestrates image quality validation and preprocessing.

    Flow:
        1. ``QualityValidator.validate()`` — reject bad images early (E1-04).
        2. ``ImageProcessor.preprocess()`` — noise removal → deskew →
           contrast enhancement (E1-01).
        3. Return a ``PreprocessingResponse`` ready for the OCR microservice.

    All dependencies are injectable so the service is fully unit-testable
    without a real OpenCV environment.
    """

    def __init__(
        self,
        validator: QualityValidator | None = None,
        processor: ImageProcessor | None = None,
    ) -> None:
        """
        Args:
            validator:  Quality gate applied before preprocessing (E1-04).
                        Defaults to ``QualityValidator`` with standard thresholds.
            processor:  OpenCV preprocessing pipeline (E1-01).
                        Defaults to ``ImageProcessor`` with standard settings.
        """
        self._validator = validator or QualityValidator()
        self._processor = processor or ImageProcessor()

    # ------------------------------------------------------------------ #
    # Public interface
    # ------------------------------------------------------------------ #

    def process(self, image_bytes: bytes) -> PreprocessingResponse:
        """
        Validate and preprocess a student-submitted image.

        Args:
            image_bytes: Raw image bytes received from the submission service.

        Returns:
            PreprocessingResponse containing enhanced image bytes and
            pipeline metadata, ready to be forwarded to the OCR microservice.

        Raises:
            ImageQualityError:        Image failed a quality check (E1-04).
                                    The message is safe to surface to students.
            PreprocessingFailureError: OpenCV pipeline failed unexpectedly.
                                    Should be treated as an internal server error.
        """
        # Step 1 — quality gate (E1-04)
        self._validator.validate(image_bytes)
        logger.info("Image passed quality validation.")

        # Step 2 — preprocessing pipeline (E1-01)
        try:
            result = self._processor.preprocess(image_bytes)
        except (ValueError, RuntimeError) as exc:
            logger.exception("Preprocessing pipeline failed.")
            raise PreprocessingFailureError(
                "The image could not be preprocessed. "
                "Please try again or contact support if the problem persists."
            ) from exc

        logger.info(
            "Preprocessing complete — stages: %s | skew: %.2f° | deskewed: %s.",
            [s.name for s in result.stages_applied],
            result.skew_angle_deg,
            result.was_deskewed,
        )
        return PreprocessingResponse.from_processed(result)


__all__ = [
    # Module-level convenience functions
    "run_pipeline",
    "validate",
    "preprocess",
    "extract_text",
    # Classes and exceptions
    "PreprocessingService",
    "PreprocessingResponse",
    "PreprocessingFailureError",
    "ImageQualityError",
    "QualityValidator",
    "QualityThresholds",
    "ImageProcessor",
    "ProcessedImage",
]