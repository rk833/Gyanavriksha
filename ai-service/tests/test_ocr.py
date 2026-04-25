"""
test_ocr.py
===========
Test suite for the OCR and Preprocessing microservices.

Test-file assets required
-------------------------
Place the following files under tests/test_files/ before running:

    sample_clean.png        â€” A clear, well-lit scan of printed text (â‰¥300 DPI).
                            Used to verify the happy path end-to-end.

    sample_skewed.png       â€” The same document rotated ~5â€“10 degrees.
                            Used to verify deskewing corrects the angle.

    sample_blurry.png       â€” A heavily out-of-focus photo of text.
                            Must fail the Laplacian variance quality check.

    sample_blank.png        â€” A plain white or near-white image with no text.
                            Must fail the text-coverage (too low) check.

    sample_dark.png         â€” A fully or near-fully black image.
                            Must fail the text-coverage (too high) check.

    sample_tiny.png         â€” An image smaller than 200Ã—200 px.
                            Must fail the minimum-resolution check.

    sample_corrupt.bin      â€” Any non-image binary file (e.g. a renamed .zip).
                            Must be rejected by both quality validators.

    sample_handwritten.png  â€” A handwritten note photograph.
                            Used to exercise the Tesseract fallback path when
                            Cloud Vision returns low confidence.
"""

from __future__ import annotations

import io
import struct
import zlib
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import MagicMock, patch, PropertyMock

import numpy as np
import pytest
from PIL import Image as PILImage

# ---------------------------------------------------------------------------
# Helpers â€” synthetic image factories (no disk I/O needed for unit tests)
# ---------------------------------------------------------------------------

TEST_FILES = Path(__file__).parent / "test_files"


def _png_bytes(width: int = 400, height: int = 300, text_ratio: float = 0.2) -> bytes:
    """
    Create a minimal valid PNG in memory.
    ``text_ratio`` controls the fraction of black pixels (simulates text density).
    """
    arr = np.full((height, width, 3), 255, dtype=np.uint8)
    n_dark = int(width * height * text_ratio)
    ys = np.random.randint(0, height, n_dark)
    xs = np.random.randint(0, width, n_dark)
    arr[ys, xs] = 0

    img = PILImage.fromarray(arr, "RGB")
    buf = io.BytesIO()
    img.save(buf, format="PNG")
    return buf.getvalue()


def _tiny_png_bytes() -> bytes:
    """50Ã—50 â€” below the minimum resolution threshold."""
    return _png_bytes(width=50, height=50)


def _blank_png_bytes() -> bytes:
    """Fully white image â€” text coverage will be ~0."""
    return _png_bytes(text_ratio=0.0)


def _dark_png_bytes() -> bytes:
    """Fully black image â€” text coverage will be ~1."""
    arr = np.zeros((300, 400, 3), dtype=np.uint8)
    img = PILImage.fromarray(arr, "RGB")
    buf = io.BytesIO()
    img.save(buf, format="PNG")
    return buf.getvalue()


def _corrupt_bytes() -> bytes:
    return b"\x00\x01\x02\x03NOT_AN_IMAGE"


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------

@pytest.fixture()
def clean_image_bytes() -> bytes:
    path = TEST_FILES / "sample_clean.png"
    if path.exists():
        return path.read_bytes()
    return _png_bytes(text_ratio=0.25)


@pytest.fixture()
def skewed_image_bytes() -> bytes:
    path = TEST_FILES / "sample_skewed.png"
    if path.exists():
        return path.read_bytes()
    # Synthesise a skewed image by rotating a clean one
    arr = np.full((400, 400, 3), 255, dtype=np.uint8)
    arr[180:220, 50:350] = 0   # horizontal text stripe
    img = PILImage.fromarray(arr).rotate(7, expand=False, fillcolor=(255, 255, 255))
    buf = io.BytesIO()
    img.save(buf, format="PNG")
    return buf.getvalue()


@pytest.fixture()
def blurry_image_bytes() -> bytes:
    path = TEST_FILES / "sample_blurry.png"
    if path.exists():
        return path.read_bytes()
    # Synthesise extreme blur via a large Gaussian kernel
    import cv2
    arr = np.full((300, 400, 3), 200, dtype=np.uint8)
    arr[130:170, 50:350] = 50
    blurred = cv2.GaussianBlur(arr, (51, 51), 30)
    img = PILImage.fromarray(blurred)
    buf = io.BytesIO()
    img.save(buf, format="PNG")
    return buf.getvalue()


@pytest.fixture()
def handwritten_image_bytes() -> bytes:
    path = TEST_FILES / "sample_handwritten.png"
    if path.exists():
        return path.read_bytes()
    return _png_bytes(text_ratio=0.15)


# ---------------------------------------------------------------------------
# Mocked Google Cloud Vision responses
# ---------------------------------------------------------------------------

def _mock_vision_response(text: str = "Hello World", confidence: float = 0.95):
    """Build a fake vision.AnnotateImageResponse structure."""
    symbol = SimpleNamespace(confidence=confidence)
    word = SimpleNamespace(symbols=[symbol])
    paragraph = SimpleNamespace(words=[word])
    block = SimpleNamespace(paragraphs=[paragraph])
    page = SimpleNamespace(blocks=[block])
    full_text = SimpleNamespace(text=text, pages=[page])
    return SimpleNamespace(
        full_text_annotation=full_text,
        error=SimpleNamespace(message=""),
    )


def _mock_vision_api_error_response():
    """A response where the API itself reports an error."""
    return SimpleNamespace(
        full_text_annotation=None,
        error=SimpleNamespace(message="Internal Vision API error"),
    )


def _mock_empty_vision_response():
    return SimpleNamespace(
        full_text_annotation=SimpleNamespace(text="", pages=[]),
        error=SimpleNamespace(message=""),
    )


# ===========================================================================
# Section 1 â€” Health-check & import smoke tests (keep the originals)
# ===========================================================================

def test_health_check_placeholder():
    """Placeholder: verify test runner works."""
    assert True


def test_ai_app_imports():
    """Verify the AI FastAPI app can be imported without errors."""
    from app.main import app
    assert app.title == "Gyanavriksha AI Microservice"


# ===========================================================================
# Section 2 â€” OCRResult
# ===========================================================================

class TestOCRResult:

    def test_is_confident_above_threshold(self):
        from app.ocr.cloud_vision import OCRResult, CloudVisionOCR
        result = OCRResult(text="hello", confidence=0.90, engine="cloud_vision")
        assert result.is_confident is True

    def test_is_not_confident_below_threshold(self):
        from app.ocr.cloud_vision import OCRResult
        result = OCRResult(text="hello", confidence=0.50, engine="cloud_vision")
        assert result.is_confident is False

    def test_is_not_confident_at_exact_threshold(self):
        from app.ocr.cloud_vision import OCRResult, CloudVisionOCR
        result = OCRResult(
            text="hello",
            confidence=CloudVisionOCR.CONFIDENCE_THRESHOLD - 0.01,
            engine="cloud_vision",
        )
        assert result.is_confident is False

    def test_engine_tag_preserved(self):
        from app.ocr.cloud_vision import OCRResult
        result = OCRResult(text="x", confidence=0.9, engine="tesseract")
        assert result.engine == "tesseract"

    def test_raw_response_defaults_to_none(self):
        from app.ocr.cloud_vision import OCRResult
        result = OCRResult(text="x", confidence=0.9, engine="cloud_vision")
        assert result.raw_response is None


# ===========================================================================
# Section 3 â€” CloudVisionOCR
# ===========================================================================

class TestCloudVisionOCR:

    def _make_ocr(self, mock_response):
        from app.ocr.cloud_vision import CloudVisionOCR
        client = MagicMock()
        client.document_text_detection.return_value = mock_response
        return CloudVisionOCR(client=client), client

    def test_extract_returns_ocr_result_on_success(self, clean_image_bytes):
        from app.ocr.cloud_vision import CloudVisionOCR
        ocr, client = self._make_ocr(_mock_vision_response("Extracted text", 0.95))
        result = ocr.extract(clean_image_bytes)
        assert result.text == "Extracted text"
        assert result.engine == "cloud_vision"
        client.document_text_detection.assert_called_once()

    def test_extract_confidence_aggregated_from_symbols(self, clean_image_bytes):
        from app.ocr.cloud_vision import CloudVisionOCR
        ocr, _ = self._make_ocr(_mock_vision_response("Text", 0.80))
        result = ocr.extract(clean_image_bytes)
        assert 0.0 <= result.confidence <= 1.0

    def test_extract_returns_empty_result_on_blank_annotation(self, clean_image_bytes):
        from app.ocr.cloud_vision import CloudVisionOCR
        ocr, _ = self._make_ocr(_mock_empty_vision_response())
        result = ocr.extract(clean_image_bytes)
        assert result.text == ""
        assert result.confidence == 0.0

    def test_extract_raises_on_api_error_message(self, clean_image_bytes):
        from app.ocr.cloud_vision import CloudVisionOCR
        from google.api_core.exceptions import GoogleAPICallError
        ocr, _ = self._make_ocr(_mock_vision_api_error_response())
        with pytest.raises(GoogleAPICallError):
            ocr.extract(clean_image_bytes)

    def test_extract_raises_service_unavailable_on_network_failure(self, clean_image_bytes):
        from app.ocr.cloud_vision import CloudVisionOCR
        from google.api_core.exceptions import ServiceUnavailable
        client = MagicMock()
        client.document_text_detection.side_effect = ServiceUnavailable("down")
        ocr = CloudVisionOCR(client=client)
        with pytest.raises(ServiceUnavailable):
            ocr.extract(clean_image_bytes)

    def test_high_confidence_result_is_confident(self, clean_image_bytes):
        from app.ocr.cloud_vision import CloudVisionOCR
        ocr, _ = self._make_ocr(_mock_vision_response("Text", 0.95))
        result = ocr.extract(clean_image_bytes)
        assert result.is_confident is True

    def test_low_confidence_result_is_not_confident(self, clean_image_bytes):
        from app.ocr.cloud_vision import CloudVisionOCR
        ocr, _ = self._make_ocr(_mock_vision_response("Text", 0.30))
        result = ocr.extract(clean_image_bytes)
        assert result.is_confident is False

    def test_confidence_threshold_class_attribute_is_float(self):
        from app.ocr.cloud_vision import CloudVisionOCR
        assert isinstance(CloudVisionOCR.CONFIDENCE_THRESHOLD, float)
        assert 0.0 < CloudVisionOCR.CONFIDENCE_THRESHOLD < 1.0


# ===========================================================================
# Section 4 â€” TesseractOCR
# ===========================================================================

class TestTesseractOCR:

    @patch("app.ocr.tesseract_fallback.pytesseract.get_tesseract_version")
    @patch("app.ocr.tesseract_fallback.pytesseract.image_to_string", return_value="Fallback text")
    @patch("app.ocr.tesseract_fallback.pytesseract.image_to_data")
    def test_extract_returns_text(self, mock_data, mock_string, mock_version,
                                  clean_image_bytes):
        mock_data.return_value = {"conf": ["90", "85", "88"]}
        from app.ocr.tesseract_fallback import TesseractOCR
        ocr = TesseractOCR()
        result = ocr.extract(clean_image_bytes)
        assert result.text == "Fallback text"
        assert result.engine == "tesseract"

    @patch("app.ocr.tesseract_fallback.pytesseract.get_tesseract_version")
    @patch("app.ocr.tesseract_fallback.pytesseract.image_to_string", return_value="Text")
    @patch("app.ocr.tesseract_fallback.pytesseract.image_to_data")
    def test_confidence_excludes_negative_scores(self, mock_data, mock_string,
                                                  mock_version, clean_image_bytes):
        # conf=-1 means Tesseract could not score that word; must be ignored
        mock_data.return_value = {"conf": ["90", "-1", "80"]}
        from app.ocr.tesseract_fallback import TesseractOCR
        ocr = TesseractOCR()
        result = ocr.extract(clean_image_bytes)
        expected = (90 + 80) / 2 / 100.0
        assert abs(result.confidence - expected) < 0.01

    @patch("app.ocr.tesseract_fallback.pytesseract.get_tesseract_version")
    @patch("app.ocr.tesseract_fallback.pytesseract.image_to_string", return_value="")
    @patch("app.ocr.tesseract_fallback.pytesseract.image_to_data")
    def test_zero_confidence_on_all_negative_scores(self, mock_data, mock_string,
                                                     mock_version, clean_image_bytes):
        mock_data.return_value = {"conf": ["-1", "-1"]}
        from app.ocr.tesseract_fallback import TesseractOCR
        ocr = TesseractOCR()
        result = ocr.extract(clean_image_bytes)
        assert result.confidence == 0.0

    @patch("app.ocr.tesseract_fallback.pytesseract.get_tesseract_version")
    def test_raises_config_error_on_corrupt_input(self, mock_version):
        from app.ocr.tesseract_fallback import TesseractOCR, TesseractConfigError
        ocr = TesseractOCR()
        with pytest.raises(TesseractConfigError):
            ocr.extract(_corrupt_bytes())

    @patch("app.ocr.tesseract_fallback.pytesseract.get_tesseract_version",
           side_effect=Exception("not found"))
    def test_raises_config_error_when_tesseract_missing(self, _):
        from app.ocr.tesseract_fallback import TesseractOCR, TesseractConfigError
        with pytest.raises(TesseractConfigError, match="binary not found"):
            TesseractOCR()

    @patch("app.ocr.tesseract_fallback.pytesseract.get_tesseract_version")
    @patch("app.ocr.tesseract_fallback.pytesseract.image_to_string")
    @patch("app.ocr.tesseract_fallback.pytesseract.image_to_data")
    def test_custom_lang_passed_to_pytesseract(self, mock_data, mock_string,
                                                mock_version, clean_image_bytes):
        mock_string.return_value = "Texte"
        mock_data.return_value = {"conf": ["80"]}
        from app.ocr.tesseract_fallback import TesseractOCR
        ocr = TesseractOCR(lang="fra")
        ocr.extract(clean_image_bytes)
        call_kwargs = mock_string.call_args
        assert call_kwargs.kwargs.get("lang") == "fra" or "fra" in call_kwargs.args


# ===========================================================================
# Section 5 â€” OCR QualityGate (byte-level, inside the OCR microservice)
# ===========================================================================

class TestOCRQualityGate:

    def _gate(self):
        from app.ocr import QualityGate     # __init__.py of OCR microservice
        return QualityGate()

    def test_passes_valid_png(self, clean_image_bytes):
        self._gate().validate(clean_image_bytes)    # must not raise

    def test_rejects_empty_bytes(self):
        from app.ocr import ImageQualityError
        with pytest.raises(ImageQualityError, match="empty or incomplete"):
            self._gate().validate(b"")

    def test_rejects_bytes_below_minimum_size(self):
        from app.ocr import ImageQualityError
        with pytest.raises(ImageQualityError):
            self._gate().validate(b"\xff\xd8\xff" + b"\x00" * 10)   # JPEG magic but tiny

    def test_rejects_corrupt_non_image(self):
        from app.ocr import ImageQualityError
        with pytest.raises(ImageQualityError, match="supported image format"):
            self._gate().validate(_corrupt_bytes())

    def test_rejects_oversized_payload(self):
        from app.ocr import ImageQualityError
        gate = self._gate()
        big = b"\xff\xd8\xff" + b"\x00" * (gate.max_bytes + 1)
        with pytest.raises(ImageQualityError, match="maximum allowed size"):
            gate.validate(big)

    def test_accepts_jpeg_magic_bytes(self):
        # Construct a minimal valid JPEG so the magic-byte check passes
        # (size check also requires the payload to exceed min_bytes)
        jpeg_magic = b"\xff\xd8\xff\xe0" + b"\x00" * 2000
        # Will pass format check; may still fail size â€” we only care about format here
        from app.ocr import ImageQualityError, QualityGate
        gate = QualityGate(min_bytes=10)    # relax size for this test
        gate.validate(jpeg_magic)           # must not raise ImageQualityError


# ===========================================================================
# Section 6 â€” OCRService orchestrator
# ===========================================================================

class TestOCRService:

    def _make_service(
        self,
        vision_result=None,
        vision_side_effect=None,
        tesseract_result=None,
        tesseract_side_effect=None,
        skip_quality_gate=True,
    ):
        from app.ocr import OCRService, QualityGate
        from app.ocr.cloud_vision import CloudVisionOCR, OCRResult
        from app.ocr.tesseract_fallback import TesseractOCR

        cv_mock = MagicMock(spec=CloudVisionOCR)
        if vision_side_effect:
            cv_mock.extract.side_effect = vision_side_effect
        else:
            cv_mock.extract.return_value = vision_result

        ts_mock = MagicMock(spec=TesseractOCR)
        if tesseract_side_effect:
            ts_mock.extract.side_effect = tesseract_side_effect
        else:
            ts_mock.extract.return_value = tesseract_result

        gate_mock = MagicMock(spec=QualityGate)   # validate() is a no-op by default

        return OCRService(
            cloud_vision=cv_mock,
            tesseract=ts_mock,
            quality_gate=gate_mock,
        )

    def _ocr_result(self, text="Text", confidence=0.95, engine="cloud_vision"):
        from app.ocr.cloud_vision import OCRResult
        return OCRResult(text=text, confidence=confidence, engine=engine)

    # --- Happy path -------------------------------------------------------

    def test_returns_cloud_vision_result_when_confident(self, clean_image_bytes):
        result = _ocr_result = self._ocr_result(confidence=0.95)
        svc = self._make_service(vision_result=result)
        out = svc.process(clean_image_bytes)
        assert out.text == "Text"
        assert out.engine == "cloud_vision"

    # --- Fallback: API unavailable ----------------------------------------

    def test_falls_back_to_tesseract_on_service_unavailable(self, clean_image_bytes):
        from google.api_core.exceptions import ServiceUnavailable
        ts_result = self._ocr_result(text="Tesseract text", engine="tesseract",
                                      confidence=0.75)
        svc = self._make_service(
            vision_side_effect=ServiceUnavailable("down"),
            tesseract_result=ts_result,
        )
        out = svc.process(clean_image_bytes)
        assert out.engine == "tesseract"
        assert out.text == "Tesseract text"

    # --- Fallback: low confidence -----------------------------------------

    def test_falls_back_to_tesseract_on_low_confidence(self, clean_image_bytes):
        low_conf = self._ocr_result(confidence=0.40, engine="cloud_vision")
        ts_result = self._ocr_result(text="Better text", confidence=0.78,
                                      engine="tesseract")
        svc = self._make_service(vision_result=low_conf, tesseract_result=ts_result)
        out = svc.process(clean_image_bytes)
        assert out.engine == "tesseract"

    def test_retains_cloud_vision_if_tesseract_is_worse(self, clean_image_bytes):
        """If both engines run but CV confidence is higher, CV result is returned."""
        cv_result = self._ocr_result(confidence=0.78, engine="cloud_vision",
                                      text="CV text")
        # Tesseract returns lower confidence than Cloud Vision
        ts_result = self._ocr_result(confidence=0.50, engine="tesseract",
                                      text="TS text")
        svc = self._make_service(vision_result=cv_result, tesseract_result=ts_result)
        out = svc.process(clean_image_bytes)
        assert out.engine == "cloud_vision"
        assert out.text == "CV text"

    # --- Both engines fail ------------------------------------------------

    def test_raises_ocr_failure_when_both_engines_fail(self, clean_image_bytes):
        from google.api_core.exceptions import ServiceUnavailable
        from app.ocr import OCRFailureError
        from app.ocr.tesseract_fallback import TesseractConfigError
        svc = self._make_service(
            vision_side_effect=ServiceUnavailable("down"),
            tesseract_side_effect=TesseractConfigError("no binary"),
        )
        with pytest.raises(OCRFailureError):
            svc.process(clean_image_bytes)

    # --- Quality gate integration -----------------------------------------

    def test_quality_gate_called_before_ocr(self, clean_image_bytes):
        from app.ocr import OCRService, QualityGate, ImageQualityError
        from app.ocr.cloud_vision import CloudVisionOCR
        from app.ocr.tesseract_fallback import TesseractOCR

        gate_mock = MagicMock(spec=QualityGate)
        gate_mock.validate.side_effect = ImageQualityError("bad image")

        svc = OCRService(
            cloud_vision=MagicMock(spec=CloudVisionOCR),
            tesseract=MagicMock(spec=TesseractOCR),
            quality_gate=gate_mock,
        )
        with pytest.raises(ImageQualityError):
            svc.process(clean_image_bytes)

        gate_mock.validate.assert_called_once_with(clean_image_bytes)

    def test_cloud_vision_not_called_after_quality_gate_rejects(self, clean_image_bytes):
        from app.ocr import OCRService, QualityGate, ImageQualityError
        from app.ocr.cloud_vision import CloudVisionOCR
        from app.ocr.tesseract_fallback import TesseractOCR

        gate_mock = MagicMock(spec=QualityGate)
        gate_mock.validate.side_effect = ImageQualityError("bad image")
        cv_mock = MagicMock(spec=CloudVisionOCR)

        svc = OCRService(cloud_vision=cv_mock,
                        tesseract=MagicMock(spec=TesseractOCR),
                        quality_gate=gate_mock)
        with pytest.raises(ImageQualityError):
            svc.process(clean_image_bytes)

        cv_mock.extract.assert_not_called()


# ===========================================================================
# Section 7 â€” QualityValidator (preprocessing microservice)
# ===========================================================================

class TestQualityValidator:

    def _validator(self, **kwargs):
        from app.preprocessing.quality_validator import QualityValidator, QualityThresholds
        return QualityValidator(QualityThresholds(**kwargs))

    def test_passes_clean_image(self, clean_image_bytes):
        self._validator().validate(clean_image_bytes)     # must not raise

    def test_rejects_corrupt_bytes(self):
        from app.preprocessing.quality_validator import ImageQualityError
        with pytest.raises((ImageQualityError, ValueError)):
            self._validator().validate(_corrupt_bytes())

    # --- Resolution -------------------------------------------------------

    def test_rejects_image_below_minimum_resolution(self):
        from app.preprocessing.quality_validator import ImageQualityError
        v = self._validator(min_width_px=200, min_height_px=200)
        with pytest.raises(ImageQualityError, match="too small"):
            v.validate(_tiny_png_bytes())

    def test_rejects_image_above_maximum_resolution(self):
        from app.preprocessing.quality_validator import ImageQualityError
        # Override max to something small
        v = self._validator(max_width_px=300, max_height_px=300)
        big = _png_bytes(width=400, height=400)
        with pytest.raises(ImageQualityError, match="too large"):
            v.validate(big)

    def test_check_resolution_passes_exact_minimum(self):
        from app.preprocessing.quality_validator import QualityValidator, QualityThresholds
        v = QualityValidator(QualityThresholds(min_width_px=400, min_height_px=300))
        v.check_resolution(np.zeros((300, 400, 3), dtype=np.uint8))   # must not raise

    # --- Blurriness -------------------------------------------------------

    def test_rejects_blurry_image(self, blurry_image_bytes):
        from app.preprocessing.quality_validator import ImageQualityError
        v = self._validator(blur_laplacian_var=50.0)
        with pytest.raises(ImageQualityError, match="blurry"):
            v.validate(blurry_image_bytes)

    def test_blurriness_threshold_respected(self):
        """A razor-sharp synthetic image must always exceed any reasonable threshold."""
        from app.preprocessing.quality_validator import QualityValidator, QualityThresholds
        import cv2
        # Sharp alternating black/white stripes â†’ very high Laplacian variance
        arr = np.zeros((300, 400, 3), dtype=np.uint8)
        arr[:, ::2] = 255
        v = QualityValidator(QualityThresholds(blur_laplacian_var=50.0))
        v.check_blurriness(arr)     # must not raise

    # --- Text coverage ----------------------------------------------------

    def test_rejects_blank_image(self):
        from app.preprocessing.quality_validator import ImageQualityError
        v = self._validator(min_text_coverage=0.02)
        with pytest.raises(ImageQualityError, match="blank"):
            v.validate(_blank_png_bytes())

    def test_rejects_dark_image(self):
        from app.preprocessing.quality_validator import ImageQualityError
        v = self._validator(max_text_coverage=0.98)
        with pytest.raises(ImageQualityError, match="too dark"):
            v.validate(_dark_png_bytes())

    def test_check_text_coverage_passes_moderate_coverage(self):
        from app.preprocessing.quality_validator import QualityValidator, QualityThresholds
        v = QualityValidator(QualityThresholds(
            min_text_coverage=0.02,
            max_text_coverage=0.98,
        ))
        arr_bytes = _png_bytes(text_ratio=0.25)
        v.check_text_coverage(
            __import__("cv2").imdecode(
                np.frombuffer(arr_bytes, np.uint8), __import__("cv2").IMREAD_COLOR
            )
        )   # must not raise


# ===========================================================================
# Section 8 â€” ImageProcessor (preprocessing microservice)
# ===========================================================================

class TestImageProcessor:

    def _processor(self):
        from app.preprocessing.image_processor import ImageProcessor
        return ImageProcessor()

    def test_preprocess_returns_processed_image(self, clean_image_bytes):
        result = self._processor().preprocess(clean_image_bytes)
        assert isinstance(result.image_bytes, bytes)
        assert len(result.image_bytes) > 0

    def test_all_three_stages_applied(self, clean_image_bytes):
        from app.preprocessing.image_processor import PreprocessingStage
        result = self._processor().preprocess(clean_image_bytes)
        assert PreprocessingStage.NOISE_REMOVAL   in result.stages_applied
        assert PreprocessingStage.DESKEW          in result.stages_applied
        assert PreprocessingStage.CONTRAST_ENHANCE in result.stages_applied

    def test_output_is_valid_png(self, clean_image_bytes):
        result = self._processor().preprocess(clean_image_bytes)
        assert result.image_bytes[:4] == b"\x89PNG"

    def test_original_shape_recorded(self, clean_image_bytes):
        result = self._processor().preprocess(clean_image_bytes)
        h, w, c = result.original_shape
        assert h > 0 and w > 0 and c == 3

    def test_raises_value_error_on_corrupt_input(self):
        with pytest.raises(ValueError, match="could not decode"):
            self._processor().preprocess(_corrupt_bytes())

    # --- Noise removal ----------------------------------------------------

    def test_remove_noise_preserves_shape(self, clean_image_bytes):
        import cv2
        arr = cv2.imdecode(
            np.frombuffer(clean_image_bytes, np.uint8), cv2.IMREAD_COLOR
        )
        result = self._processor().remove_noise(arr)
        assert result.shape == arr.shape

    def test_remove_noise_does_not_produce_identical_output(self, clean_image_bytes):
        """The filter must actually change pixel values."""
        import cv2
        arr = cv2.imdecode(
            np.frombuffer(clean_image_bytes, np.uint8), cv2.IMREAD_COLOR
        )
        # Add strong salt-and-pepper noise so bilateral filter must change values
        noisy = arr.copy()
        noisy[::10, ::10] = 0
        result = self._processor().remove_noise(noisy)
        assert not np.array_equal(result, noisy)

    # --- Deskewing --------------------------------------------------------

    def test_deskew_returns_same_shape(self, skewed_image_bytes):
        import cv2
        arr = cv2.imdecode(
            np.frombuffer(skewed_image_bytes, np.uint8), cv2.IMREAD_COLOR
        )
        corrected, angle = self._processor().deskew(arr)
        assert corrected.shape == arr.shape

    def test_deskew_skewed_image_detects_nonzero_angle(self, skewed_image_bytes):
        import cv2
        arr = cv2.imdecode(
            np.frombuffer(skewed_image_bytes, np.uint8), cv2.IMREAD_COLOR
        )
        _, angle = self._processor().deskew(arr)
        # Skewed fixture has ~7 degree rotation; allow generous tolerance
        assert abs(angle) > 0.5, f"Expected non-trivial angle, got {angle}"

    def test_deskew_near_straight_image_is_not_rotated(self, clean_image_bytes):
        import cv2
        arr = cv2.imdecode(
            np.frombuffer(clean_image_bytes, np.uint8), cv2.IMREAD_COLOR
        )
        proc = ImageProcessor = self._processor()
        corrected, angle = proc.deskew(arr)
        # For a straight image the angle is below threshold â†’ output identical to input
        if abs(angle) < proc._skew_threshold_deg:
            assert np.array_equal(corrected, arr)

    # --- Contrast enhancement --------------------------------------------

    def test_enhance_contrast_preserves_shape_for_colour(self, clean_image_bytes):
        import cv2
        arr = cv2.imdecode(
            np.frombuffer(clean_image_bytes, np.uint8), cv2.IMREAD_COLOR
        )
        enhanced = self._processor().enhance_contrast(arr)
        assert enhanced.shape == arr.shape

    def test_enhance_contrast_works_on_greyscale(self, clean_image_bytes):
        import cv2
        arr = cv2.imdecode(
            np.frombuffer(clean_image_bytes, np.uint8), cv2.IMREAD_GRAYSCALE
        )
        enhanced = self._processor().enhance_contrast(arr)
        assert enhanced.shape == arr.shape

    def test_enhance_contrast_changes_pixel_values(self, clean_image_bytes):
        import cv2
        arr = cv2.imdecode(
            np.frombuffer(clean_image_bytes, np.uint8), cv2.IMREAD_COLOR
        )
        # Flatten to uniform grey â€” CLAHE must alter the histogram
        flat = np.full_like(arr, 128)
        enhanced = self._processor().enhance_contrast(flat)
        assert not np.array_equal(enhanced, flat)


# ===========================================================================
# Section 9 â€” PreprocessingService orchestrator
# ===========================================================================

class TestPreprocessingService:

    def _make_service(self, validator=None, processor=None):
        from app.preprocessing import PreprocessingService  # __init__.py
        from app.preprocessing.quality_validator import QualityValidator
        from app.preprocessing.image_processor import ImageProcessor
        return PreprocessingService(
            validator=validator or MagicMock(spec=QualityValidator),
            processor=processor or MagicMock(spec=ImageProcessor),
        )

    def test_process_calls_validator_then_processor(self, clean_image_bytes):
        from app.preprocessing.quality_validator import QualityValidator
        from app.preprocessing.image_processor import ImageProcessor, ProcessedImage, PreprocessingStage

        val_mock = MagicMock(spec=QualityValidator)
        proc_mock = MagicMock(spec=ImageProcessor)
        proc_mock.preprocess.return_value = ProcessedImage(
            image_bytes=clean_image_bytes,
            original_shape=(300, 400, 3),
            skew_angle_deg=0.0,
            stages_applied=[
                PreprocessingStage.NOISE_REMOVAL,
                PreprocessingStage.DESKEW,
                PreprocessingStage.CONTRAST_ENHANCE,
            ],
        )

        from app.preprocessing import PreprocessingService
        svc = PreprocessingService(validator=val_mock, processor=proc_mock)
        svc.process(clean_image_bytes)

        val_mock.validate.assert_called_once_with(clean_image_bytes)
        proc_mock.preprocess.assert_called_once_with(clean_image_bytes)

    def test_process_returns_preprocessing_response(self, clean_image_bytes):
        from app.preprocessing.quality_validator import QualityValidator
        from app.preprocessing.image_processor import ImageProcessor, ProcessedImage, PreprocessingStage
        from app.preprocessing import PreprocessingService, PreprocessingResponse

        proc_mock = MagicMock(spec=ImageProcessor)
        proc_mock.preprocess.return_value = ProcessedImage(
            image_bytes=b"PROCESSED",
            original_shape=(300, 400, 3),
            skew_angle_deg=3.5,
            stages_applied=[
                PreprocessingStage.NOISE_REMOVAL,
                PreprocessingStage.DESKEW,
                PreprocessingStage.CONTRAST_ENHANCE,
            ],
        )

        svc = PreprocessingService(
            validator=MagicMock(spec=QualityValidator),
            processor=proc_mock,
        )
        response = svc.process(clean_image_bytes)
        assert isinstance(response, PreprocessingResponse)
        assert response.image_bytes == b"PROCESSED"
        assert response.skew_angle_deg == pytest.approx(3.5)
        assert response.was_deskewed is True

    def test_quality_error_propagates_before_preprocessing(self, clean_image_bytes):
        from app.preprocessing.quality_validator import ImageQualityError, QualityValidator
        from app.preprocessing.image_processor import ImageProcessor

        val_mock = MagicMock(spec=QualityValidator)
        val_mock.validate.side_effect = ImageQualityError("too blurry")
        proc_mock = MagicMock(spec=ImageProcessor)

        from app.preprocessing import PreprocessingService
        svc = PreprocessingService(validator=val_mock, processor=proc_mock)
        with pytest.raises(ImageQualityError, match="too blurry"):
            svc.process(clean_image_bytes)

        proc_mock.preprocess.assert_not_called()

    def test_preprocessing_failure_wraps_opencv_error(self, clean_image_bytes):
        from app.preprocessing.quality_validator import QualityValidator
        from app.preprocessing.image_processor import ImageProcessor
        from app.preprocessing import PreprocessingService, PreprocessingFailureError

        proc_mock = MagicMock(spec=ImageProcessor)
        proc_mock.preprocess.side_effect = RuntimeError("OpenCV segfault")

        svc = PreprocessingService(
            validator=MagicMock(spec=QualityValidator),
            processor=proc_mock,
        )
        with pytest.raises(PreprocessingFailureError):
            svc.process(clean_image_bytes)

    def test_stages_applied_serialised_as_strings(self, clean_image_bytes):
        from app.preprocessing.quality_validator import QualityValidator
        from app.preprocessing.image_processor import ImageProcessor, ProcessedImage, PreprocessingStage
        from app.preprocessing import PreprocessingService

        proc_mock = MagicMock(spec=ImageProcessor)
        proc_mock.preprocess.return_value = ProcessedImage(
            image_bytes=b"X",
            original_shape=(100, 100, 3),
            skew_angle_deg=0.0,
            stages_applied=[PreprocessingStage.NOISE_REMOVAL,
                            PreprocessingStage.CONTRAST_ENHANCE],
        )

        svc = PreprocessingService(
            validator=MagicMock(spec=QualityValidator),
            processor=proc_mock,
        )
        response = svc.process(clean_image_bytes)
        assert all(isinstance(s, str) for s in response.stages_applied)
        assert "NOISE_REMOVAL" in response.stages_applied


# ===========================================================================
# Section 10 â€” End-to-end integration (real files from test_files/)
# ===========================================================================

@pytest.mark.integration
class TestEndToEnd:
    """
    Requires real test assets in tests/test_files/ and a live environment
    (Tesseract installed, GCP credentials set). Skip in CI with:
        pytest -m "not integration"
    """

    @pytest.mark.skipif(
        not (TEST_FILES / "sample_clean.png").exists(),
        reason="sample_clean.png not found in tests/test_files/",
    )
    @patch("app.ocr.cloud_vision.vision.ImageAnnotatorClient")
    def test_full_pipeline_clean_image(self, mock_client_cls):
        """
        Full stack: preprocessing â†’ OCR (mocked Cloud Vision returning high
        confidence) â€” verifies both microservices wire together correctly.
        """
        mock_client_cls.return_value.document_text_detection.return_value = (
            _mock_vision_response("Full pipeline text", 0.92)
        )
        from app.preprocessing import PreprocessingService
        from app.ocr import OCRService

        raw_bytes = (TEST_FILES / "sample_clean.png").read_bytes()

        preprocessed = PreprocessingService().process(raw_bytes)
        result = OCRService().process(preprocessed.image_bytes)

        assert result.text
        assert result.confidence > 0.0

    @pytest.mark.skipif(
        not (TEST_FILES / "sample_blurry.png").exists(),
        reason="sample_blurry.png not found in tests/test_files/",
    )
    def test_full_pipeline_rejects_blurry_image(self):
        from app.preprocessing import PreprocessingService
        from app.preprocessing.quality_validator import ImageQualityError

        raw_bytes = (TEST_FILES / "sample_blurry.png").read_bytes()
        with pytest.raises(ImageQualityError, match="blurry"):
            PreprocessingService().process(raw_bytes)

    @pytest.mark.skipif(
        not (TEST_FILES / "sample_handwritten.png").exists(),
        reason="sample_handwritten.png not found in tests/test_files/",
    )
    @patch("app.ocr.cloud_vision.vision.ImageAnnotatorClient")
    def test_tesseract_fallback_on_low_confidence(self, mock_client_cls):
        """Cloud Vision returns low confidence â†’ Tesseract must be invoked."""
        mock_client_cls.return_value.document_text_detection.return_value = (
            _mock_vision_response("??", 0.30)    # below threshold
        )
        from app.preprocessing import PreprocessingService
        from app.ocr import OCRService

        raw_bytes = (TEST_FILES / "sample_handwritten.png").read_bytes()
        preprocessed = PreprocessingService().process(raw_bytes)
        result = OCRService().process(preprocessed.image_bytes)

        # Tesseract may not be perfect but it must produce some output
        assert result.engine == "tesseract"

