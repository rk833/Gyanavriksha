# image_processor.py

import logging
from dataclasses import dataclass, field
from enum import Enum, auto
from typing import Optional

import cv2
import numpy as np

logger = logging.getLogger(__name__)


class PreprocessingStage(Enum):
    NOISE_REMOVAL      = auto()
    DESKEW             = auto()
    CONTRAST_ENHANCE   = auto()


@dataclass
class ProcessedImage:
    """Carries the result of a full preprocessing pipeline run."""
    image_bytes: bytes
    original_shape: tuple[int, int, int]
    skew_angle_deg: float
    stages_applied: list[PreprocessingStage] = field(default_factory=list)

    @property
    def was_deskewed(self) -> bool:
        return PreprocessingStage.DESKEW in self.stages_applied


class ImageProcessor:
    """
    Applies the three-stage preprocessing pipeline required by E1-01:
        1. Noise removal     — bilateral filter preserving edges
        2. Deskewing         — Hough-line skew correction
        3. Contrast enhance  — CLAHE on the luminance channel

    Preprocessing is intentionally kept stateless: every public method
    accepts and returns plain NumPy arrays so stages can be composed or
    tested individually without side effects.
    """

    # ------------------------------------------------------------------ #
    # Noise removal defaults
    # ------------------------------------------------------------------ #
    _BILATERAL_D: int           = 9
    _BILATERAL_SIGMA_COLOR: int = 75
    _BILATERAL_SIGMA_SPACE: int = 75

    # ------------------------------------------------------------------ #
    # Deskew defaults
    # ------------------------------------------------------------------ #
    _SKEW_THRESHOLD_DEG: float  = 0.5   # angles below this are not corrected
    _HOUGH_THRESHOLD: int       = 100
    _HOUGH_MIN_LINE_LEN: int    = 100
    _HOUGH_MAX_LINE_GAP: int    = 10

    # ------------------------------------------------------------------ #
    # CLAHE defaults
    # ------------------------------------------------------------------ #
    _CLAHE_CLIP_LIMIT: float    = 2.0
    _CLAHE_TILE_GRID: tuple[int, int] = (8, 8)

    def __init__(
        self,
        skew_threshold_deg: float = _SKEW_THRESHOLD_DEG,
        clahe_clip_limit: float   = _CLAHE_CLIP_LIMIT,
        clahe_tile_grid: tuple[int, int] = _CLAHE_TILE_GRID,
    ) -> None:
        self._skew_threshold_deg = skew_threshold_deg
        self._clahe = cv2.createCLAHE(
            clipLimit=clahe_clip_limit,
            tileGridSize=clahe_tile_grid,
        )

    # ------------------------------------------------------------------ #
    # Public pipeline entry-point
    # ------------------------------------------------------------------ #

    def preprocess(self, image_bytes: bytes) -> ProcessedImage:
        """
        Run the full E1-01 pipeline on raw image bytes.

        Args:
            image_bytes: Raw bytes of the student-submitted image.

        Returns:
            ProcessedImage containing the enhanced image bytes and
            metadata about each stage applied.

        Raises:
            ValueError: If the bytes cannot be decoded as an image.
        """
        array = self._decode(image_bytes)
        original_shape = array.shape
        stages: list[PreprocessingStage] = []

        # Stage 1 — noise removal
        array = self.remove_noise(array)
        stages.append(PreprocessingStage.NOISE_REMOVAL)
        logger.debug("Noise removal applied.")

        # Stage 2 — deskew
        array, skew_angle = self.deskew(array)
        stages.append(PreprocessingStage.DESKEW)
        logger.debug("Deskew applied (angle=%.2f°).", skew_angle)

        # Stage 3 — contrast enhancement
        array = self.enhance_contrast(array)
        stages.append(PreprocessingStage.CONTRAST_ENHANCE)
        logger.debug("Contrast enhancement applied.")

        return ProcessedImage(
            image_bytes=self._encode(array),
            original_shape=original_shape,
            skew_angle_deg=skew_angle,
            stages_applied=stages,
        )

    # ------------------------------------------------------------------ #
    # Stage 1 — noise removal
    # ------------------------------------------------------------------ #

    def remove_noise(self, image: np.ndarray) -> np.ndarray:
        """
        Apply a bilateral filter that smooths noise while preserving
        text edges — critical for keeping character strokes legible.
        """
        return cv2.bilateralFilter(
            image,
            self._BILATERAL_D,
            self._BILATERAL_SIGMA_COLOR,
            self._BILATERAL_SIGMA_SPACE,
        )

    # ------------------------------------------------------------------ #
    # Stage 2 — deskewing
    # ------------------------------------------------------------------ #

    def deskew(self, image: np.ndarray) -> tuple[np.ndarray, float]:
        """
        Detect and correct document skew using probabilistic Hough lines.

        Returns:
            Tuple of (corrected image, detected skew angle in degrees).
            If the detected angle is within ``_skew_threshold_deg`` of zero,
            the original image is returned unchanged.
        """
        angle = self._detect_skew(image)
        if abs(angle) < self._skew_threshold_deg:
            logger.debug("Skew angle %.2f° below threshold — skipping rotation.", angle)
            return image, angle

        corrected = self._rotate(image, angle)
        return corrected, angle

    def _detect_skew(self, image: np.ndarray) -> float:
        gray  = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY) if image.ndim == 3 else image
        edges = cv2.Canny(gray, 50, 150, apertureSize=3)
        lines = cv2.HoughLinesP(
            edges,
            rho=1,
            theta=np.pi / 180,
            threshold=self._HOUGH_THRESHOLD,
            minLineLength=self._HOUGH_MIN_LINE_LEN,
            maxLineGap=self._HOUGH_MAX_LINE_GAP,
        )
        if lines is None:
            return 0.0

        angles = [
            np.degrees(np.arctan2(y2 - y1, x2 - x1))
            for x1, y1, x2, y2 in lines[:, 0]
        ]
        # Discard near-vertical lines (likely borders, not text baselines)
        angles = [a for a in angles if abs(a) < 45]
        return float(np.median(angles)) if angles else 0.0

    @staticmethod
    def _rotate(image: np.ndarray, angle: float) -> np.ndarray:
        h, w = image.shape[:2]
        centre = (w // 2, h // 2)
        matrix = cv2.getRotationMatrix2D(centre, angle, scale=1.0)
        return cv2.warpAffine(
            image, matrix, (w, h),
            flags=cv2.INTER_LINEAR,
            borderMode=cv2.BORDER_REPLICATE,
        )

    # ------------------------------------------------------------------ #
    # Stage 3 — contrast enhancement
    # ------------------------------------------------------------------ #

    def enhance_contrast(self, image: np.ndarray) -> np.ndarray:
        """
        Apply CLAHE (Contrast Limited Adaptive Histogram Equalization)
        to the L* channel of the LAB colour space so that colour
        information is preserved while local contrast is boosted.
        For greyscale inputs, CLAHE is applied directly.
        """
        if image.ndim == 2:
            return self._clahe.apply(image)

        lab = cv2.cvtColor(image, cv2.COLOR_BGR2LAB)
        l, a, b = cv2.split(lab)
        l_enhanced = self._clahe.apply(l)
        enhanced_lab = cv2.merge([l_enhanced, a, b])
        return cv2.cvtColor(enhanced_lab, cv2.COLOR_LAB2BGR)

    # ------------------------------------------------------------------ #
    # Codec helpers
    # ------------------------------------------------------------------ #

    @staticmethod
    def _decode(image_bytes: bytes) -> np.ndarray:
        buffer = np.frombuffer(image_bytes, dtype=np.uint8)
        image  = cv2.imdecode(buffer, cv2.IMREAD_COLOR)
        if image is None:
            raise ValueError(
                "OpenCV could not decode the supplied bytes as an image."
            )
        return image

    @staticmethod
    def _encode(image: np.ndarray, fmt: str = ".png") -> bytes:
        success, buffer = cv2.imencode(fmt, image)
        if not success:
            raise RuntimeError("OpenCV failed to encode the processed image.")
        return buffer.tobytes()