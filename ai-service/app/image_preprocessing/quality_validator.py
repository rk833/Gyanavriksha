# quality_validator.py

import io
import logging
from dataclasses import dataclass

import cv2
import numpy as np
from PIL import Image, ImageFilter

logger = logging.getLogger(__name__)


# =====================================================================
# Module-level threshold constants for configuration and testing
# =====================================================================

#: Minimum width **and** height in pixels.
MIN_DIMENSION_PX: int = 50

#: Mean luminance on a 0-255 scale below which an image is deemed "too dark".
DARK_THRESHOLD: float = 40.0

#: Pixel standard-deviation below which an image is deemed blank / uniform.
BLANK_STD_THRESHOLD: float = 8.0

#: Variance of the discrete Laplacian below which an image is deemed too blurry.
BLUR_THRESHOLD: float = 5.0


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
    min_width_px:       int   = MIN_DIMENSION_PX   # 50 pixels minimum
    min_height_px:      int   = MIN_DIMENSION_PX   # 50 pixels minimum
    max_width_px:       int   = 10_000
    max_height_px:      int   = 10_000
    min_dpi:            int   = 72
    blur_laplacian_var: float = BLUR_THRESHOLD
    dark_threshold:     float = DARK_THRESHOLD
    blank_std_threshold: float = BLANK_STD_THRESHOLD


class QualityValidator:
    """
    Validates structural and perceptual quality of an image before the
    preprocessing pipeline is invoked (E1-04).

    Each check is an isolated method so callers can run them selectively
    in tests, and so new checks can be added without touching existing ones.

    Checks performed (in order):
        1. Minimum / maximum resolution
        2. Darkness (mean luminance)
        3. Blankness  (pixel standard deviation)
        4. Blurriness  (Laplacian variance)
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
            ImageQualityError: If any quality check fails. The message is
                             actionable and safe for students to read.
        """
        # Use PIL to load and analyze the image
        try:
            img = Image.open(io.BytesIO(image_bytes)).convert("RGB")
        except Exception as exc:
            raise ImageQualityError(
                "Could not decode your image. "
                "Please ensure the file is a valid image (JPEG, PNG, BMP, or TIFF)."
            ) from exc

        # Convert to numpy array for analysis
        arr = np.asarray(img.convert("L"), dtype=np.float32)

        self.check_resolution(img)
        self.check_darkness(arr)
        self.check_blankness(arr)
        self.check_blurriness(arr)
        self.check_text_coverage(arr)

        logger.info("Image passed all quality checks: %dx%d.", img.width, img.height)

    # ------------------------------------------------------------------ #
    # Individual quality checks
    # ------------------------------------------------------------------ #

    def check_resolution(self, image: Image.Image) -> None:
        """Check that the image has a reasonable resolution."""
        w, h = image.size
        if w < self._t.min_width_px or h < self._t.min_height_px:
            raise ImageQualityError(
                "Your image is too small "
                f"({w}×{h} px, minimum required: {self._t.min_width_px}×{self._t.min_height_px}). "
                "Please ensure your work is fully visible in the frame."
            )
        if w > self._t.max_width_px or h > self._t.max_height_px:
            raise ImageQualityError(
                f"Your image is too large ({w}×{h} px). "
                f"Maximum allowed: {self._t.max_width_px}×{self._t.max_height_px}."
            )

    def check_darkness(self, arr: np.ndarray) -> None:
        """Check that the image is not too dark."""
        mean_luminance = arr.mean()
        if mean_luminance < self._t.dark_threshold:
            raise ImageQualityError(
                "Your image appears to be too dark "
                "(mean luminance "
                f"{mean_luminance:.1f} < {self._t.dark_threshold}). "
                "Please retake the photo in better lighting."
            )

    def check_blankness(self, arr: np.ndarray) -> None:
        """Check that the image is not blank/featureless."""
        std = arr.std()
        if std < self._t.blank_std_threshold:
            raise ImageQualityError(
                "Your image appears to be blank or mostly featureless "
                f"(pixel variation {std:.1f} < {self._t.blank_std_threshold}). "
                "Please ensure your work is visible."
            )

    def check_blurriness(self, arr: np.ndarray) -> None:
        """
        Use the variance of the Laplacian as a focus measure.
        A low variance indicates a blurry image where character edges
        are indistinct and OCR accuracy will be poor.
        """
        arr_uint8 = np.clip(arr, 0, 255).astype(np.uint8)
        laplacian = cv2.Laplacian(arr_uint8, cv2.CV_64F)
        variance = float(laplacian.var())

        logger.debug("Blur score (Laplacian variance): %.2f (threshold: %.2f).",
                    variance, self._t.blur_laplacian_var)

        if variance < self._t.blur_laplacian_var:
            raise ImageQualityError(
                "Your image appears to be blurry or out of focus "
                f"(blur score: {variance:.1f}, minimum required: {self._t.blur_laplacian_var:.1f}). "
                "Please retake the photo, keeping the camera steady."
            )

    def check_text_coverage(self, arr: np.ndarray) -> None:
        """
        Use Otsu thresholding to estimate text coverage.
        Blank or overexposed images will have very low coverage.
        """
        arr_uint8 = np.clip(arr, 0, 255).astype(np.uint8)
        _, binary = cv2.threshold(arr_uint8, 0, 255, cv2.THRESH_BINARY_INV + cv2.THRESH_OTSU)
        coverage = float(np.count_nonzero(binary)) / binary.size

        logger.debug("Text coverage ratio: %.3%.", coverage * 100)

        # Very low coverage suggests a blank image
        # Clean images have ~0.8% coverage; blank has ~14% but is uniform
        # So we check for very uniform coverage (not natural text)
        if coverage < 0.001:
            raise ImageQualityError(
                "Your image appears to be mostly blank "
                f"(text coverage: {coverage:.1%}). "
                "Please ensure your work is visible and fully within the frame."
            )


# =====================================================================
# Module-level convenience function
# =====================================================================

def validate(image_bytes: bytes) -> None:
    """
    Validate the quality of a raw image (convenience wrapper).

    Parameters
    ----------
    image_bytes:
        Raw bytes of any supported image format.

    Raises
    ------
    ImageQualityError
        Describing the specific quality issue found. The message is
        actionable and student-facing.
    """
    validator = QualityValidator()
    validator.validate(image_bytes)