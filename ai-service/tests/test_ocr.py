import pytest
import os
from app.ocr import get_text_from_image

# Configuration
TEST_FOLDER = "test_files"

# Map filenames to their expected text
# None indicates we expect an empty string or no valid text detection
TEST_CASES = [
    ("sample_blank.png", None),
    ("sample_blurry.png", None),
    ("sample_clean.png", "This is a test for OCR."),
    ("sample_corrupt.bin", None),
    ("sample_dark.png", None),
    ("sample_handwritten.png", "This is a test for OCR."),
    ("sample_skewed.png", "This is a test for OCR."),
    ("sample_tiny.png", None),
]

@pytest.mark.parametrize("filename, expected_text", TEST_CASES)
def test_ocr_extraction(filename, expected_text):
    # 1. Construct path and read the file bytes
    file_path = os.path.join(TEST_FOLDER, filename)
    
    if not os.path.exists(file_path):
        pytest.skip(f"Test file {filename} not found in {TEST_FOLDER}")

    with open(file_path, "rb") as f:
        image_bytes = f.read()

    # 2. Call the microservice
    result = get_text_from_image(image_bytes)

    # 3. Validation Logic
    if expected_text is None:
        # If we expect None, the result should be empty or just whitespace
        assert result.strip() == "", f"Expected no text for {filename}, but got: {result}"
    else:
        # Case-insensitive comparison and stripping whitespace/newlines
        assert result.strip().lower() == expected_text.strip().lower(), \
            f"Text mismatch for {filename}. Expected: '{expected_text}', Got: '{result}'"