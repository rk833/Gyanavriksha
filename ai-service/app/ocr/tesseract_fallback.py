import logging
from dataclasses import dataclass
from typing import Optional

import pytesseract
from PIL import Image, UnidentifiedImageError
import io

from .cloud_vision import OCRResult

logger = logging.getLogger(__name__)


class TesseractConfigError(Exception):
    """Raised when Tesseract is misconfigured or cannot be invoked."""


class TesseractOCR:
    """
    Fallback OCR engine backed by Tesseract (E1-03).

    Activated by the orchestrator when:
        - The Cloud Vision API is unavailable, OR
        - The Cloud Vision result confidence is below the defined threshold.

    Responsibilities:
        - Accept preprocessed image bytes (preprocessing already done upstream).
        - Run Tesseract with configurable language and OEM/PSM settings.
        - Return a normalised OCRResult with a Tesseract-derived confidence score.
    """

    DEFAULT_LANG: str = "eng"
    DEFAULT_CONFIG: str = "--oem 1 --psm 6"  # LSTM engine, uniform block of text

    def __init__(
        self,
        lang: str = DEFAULT_LANG,
        config: str = DEFAULT_CONFIG,
        tesseract_cmd: Optional[str] = None,
    ) -> None:
        """
        Args:
            lang:           Tesseract language code(s), e.g. ``"eng+fra"``.
            config:         Raw Tesseract config string passed to pytesseract.
            tesseract_cmd:  Optional path override for the Tesseract binary.
        """
        if tesseract_cmd:
            pytesseract.pytesseract.tesseract_cmd = tesseract_cmd

        self._lang = lang
        self._config = config
        self._verify_installation()

    # ------------------------------------------------------------------
    # Public interface
    # ------------------------------------------------------------------

    def extract(self, image_bytes: bytes) -> OCRResult:
        """
        Run Tesseract OCR on preprocessed image bytes.

        Args:
            image_bytes: Raw image bytes produced by the upstream
                        preprocessing microservice (E1-01 delegated).

        Returns:
            OCRResult with extracted text, aggregate confidence, and engine tag.

        Raises:
            TesseractConfigError: If Tesseract cannot process the image.
        """
        pil_image = self._bytes_to_pil(image_bytes)
        text = self._run_ocr(pil_image)
        confidence = self._compute_confidence(pil_image)

        logger.debug("Tesseract confidence: %.3f", confidence)
        return OCRResult(
            text=text,
            confidence=confidence,
            engine="tesseract",
        )

    # ------------------------------------------------------------------
    # Private helpers
    # ------------------------------------------------------------------

    def _run_ocr(self, image: Image.Image) -> str:
        try:
            return pytesseract.image_to_string(
                image, lang=self._lang, config=self._config
            )
        except pytesseract.TesseractError as exc:
            logger.error("Tesseract OCR failed: %s", exc)
            raise TesseractConfigError(f"Tesseract extraction failed: {exc}") from exc

    def _compute_confidence(self, image: Image.Image) -> float:
        """
        Derive aggregate word-level confidence from Tesseract's ``image_to_data``
        output. Words with confidence == -1 (unknown) are excluded.
        """
        try:
            data = pytesseract.image_to_data(
                image,
                lang=self._lang,
                config=self._config,
                output_type=pytesseract.Output.DICT,
            )
            scores = [
                int(c) / 100.0
                for c in data["conf"]
                if str(c).lstrip("-").isdigit() and int(c) >= 0
            ]
            return sum(scores) / len(scores) if scores else 0.0
        except Exception as exc:  # noqa: BLE001
            logger.warning("Could not compute Tesseract confidence: %s", exc)
            return 0.0

    @staticmethod
    def _bytes_to_pil(image_bytes: bytes) -> Image.Image:
        try:
            return Image.open(io.BytesIO(image_bytes))
        except UnidentifiedImageError as exc:
            raise TesseractConfigError(
                f"Could not decode image bytes for Tesseract: {exc}"
            ) from exc

    @staticmethod
    def _verify_installation() -> None:
        try:
            pytesseract.get_tesseract_version()
        except pytesseract.TesseractNotFoundError as exc:
            raise TesseractConfigError(
                "Tesseract binary not found. Install it and ensure it is on PATH."
            ) from exc