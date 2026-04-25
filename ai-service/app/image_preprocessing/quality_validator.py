# quality_validator.py

import logging
from dataclasses import dataclass

import cv2
import numpy as np

logger = logging.getLogger(__name__)


class ImageQualityError(ValueError):
    """
    Raised when an image fails a quality check before preprocessing (E1-04).
    The attached message is actionable and student-facing.
    """


@dataclass(frozen=True)
class QualityThresholds:
    """
    Tuneable thresholds for every quality check, grouped in one place
    so they can be overridden per-environment without subclassing.
    """
    min_width_px:       int   = 200
    min_height_px:      int   = 200
    max_width_px:       int   = 10_000
    max_height_px:      int   = 10_000
    min_dpi:            int   = 72    # below this text is rarely legible
    blur_laplacian_var: float = 50.0  # variance below this → too blurry
    min_text_coverage:  float = 0.02  # fraction of non-background pixels
    max_text_coverage:  float = 0.98  # fully black/white → likely corrupt


class QualityValidator:
    """
    Validates structural and perceptual quality of an image before the
    preprocessing pipeline is invoked (E1-04).

    Each check is an isolated method so callers can run them selectively
    in tests, and so new checks can be added without touching existing ones.

    Checks performed (in order):
        1. Minimum / maximum resolution
        2. Blurriness  (Laplacian variance)
        3. Text-coverage ratio  (catches blank scans and fully-occluded pages)
    """

    def __init__(self, thresholds: QualityThresholds = QualityThresholds()) -> None:
        self._t = thresholds

    # ------------------------------------------------------------------ #
    # Public interface
    # ------------------------------------------------------------------ #

    def validate(self, image_bytes: bytes) -> None:
        """
        Run all quality checks against the supplied raw image bytes.

        Args:
            image_bytes: Raw bytes of the student-submitted image.

        Raises:
            ImageQualityError: On the first failing check, with a student-
                               facing actionable message (E1-04).
            ValueError:        If the bytes cannot be decoded as an image.
        """
        image = self._decode(image_bytes)
        self.check_resolution(image)
        self.check_blurriness(image)
        self.check_text_coverage(image)
        logger.debug("Image passed all quality checks.")

    # ------------------------------------------------------------------ #
    # Individual checks  (public so they are independently testable)
    # ------------------------------------------------------------------ #

    def check_resolution(self, image: np.ndarray) -> None:
        """
        Reject images that are too small to yield readable OCR output,
        or suspiciously large (likely a miscoded upload).
        """
        h, w = image.shape[:2]
        t = self._t

        if w < t.min_width_px or h < t.min_height_px:
            raise ImageQualityError(
                f"Your image is too small ({w}×{h} px). "
                f"Please submit an image of at least "
                f"{t.min_width_px}×{t.min_height_px} px so the text can be read clearly."
            )

        if w > t.max_width_px or h > t.max_height_px:
            raise ImageQualityError(
                f"Your image is too large ({w}×{h} px). "
                f"Please resize it to a maximum of "
                f"{t.max_width_px}×{t.max_height_px} px before resubmitting."
            )

        logger.debug("Resolution check passed (%dx%d).", w, h)

    def check_blurriness(self, image: np.ndarray) -> None:
        """
        Use the variance of the Laplacian as a focus measure.
        A low variance indicates a blurry image where character edges
        are indistinct and OCR accuracy will be poor.
        """
        gray      = self._to_gray(image)
        laplacian = cv2.Laplacian(gray, cv2.CV_64F)
        variance  = float(laplacian.var())
        logger.debug("Laplacian variance: %.2f (threshold: %.2f).",
                    variance, self._t.blur_laplacian_var)

        if variance < self._t.blur_laplacian_var:
            raise ImageQualityError(
                "Your image appears to be blurry or out of focus "
                f"(sharpness score: {variance:.1f}, minimum required: "
                f"{self._t.blur_laplacian_var:.1f}). "
                "Please retake the photo in good lighting, keeping the camera steady."
            )

    def check_text_coverage(self, image: np.ndarray) -> None:
        """
        Estimate the proportion of foreground (text) pixels using Otsu
        thresholding.  Checks two failure modes:
            - Too few dark pixels  → blank scan or heavily overexposed image.
            - Too many dark pixels → fully occluded, extremely dark, or corrupt.
        """
        gray        = self._to_gray(image)
        _, binary   = cv2.threshold(gray, 0, 255, cv2.THRESH_BINARY_INV + cv2.THRESH_OTSU)
        coverage    = float(np.count_nonzero(binary)) / binary.size
        t           = self._t

        logger.debug("Text coverage ratio: %.3f (min: %.3f, max: %.3f).",
                    coverage, t.min_text_coverage, t.max_text_coverage)

        if coverage < t.min_text_coverage:
            raise ImageQualityError(
                "Your image appears to be mostly blank "
                f"(text coverage: {coverage:.1%}, minimum required: {t.min_text_coverage:.1%}). "
                "Please ensure your work is visible and fully within the frame."
            )

        if coverage > t.max_text_coverage:
            raise ImageQualityError(
                "Your image appears to be too dark or heavily obscured "
                f"(coverage: {coverage:.1%}, maximum allowed: {t.max_text_coverage:.1%}). "
                "Please improve the lighting and resubmit."
            )

    # ------------------------------------------------------------------ #
    # Helpers
    # ------------------------------------------------------------------ #

    @staticmethod
    def _decode(image_bytes: bytes) -> np.ndarray:
        buffer = np.frombuffer(image_bytes, dtype=np.uint8)
        image  = cv2.imdecode(buffer, cv2.IMREAD_COLOR)
        if image is None:
            raise ValueError(
                "Could not decode the image bytes. "
                "Please ensure the file is a valid image (JPEG, PNG, BMP, or TIFF)."
            )
        return image

    @staticmethod
    def _to_gray(image: np.ndarray) -> np.ndarray:
        return cv2.cvtColor(image, cv2.COLOR_BGR2GRAY) if image.ndim == 3 else image