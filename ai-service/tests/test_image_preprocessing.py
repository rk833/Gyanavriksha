import pytest
import numpy as np
import cv2
from PIL import Image
import io
from app.image_preprocessing.image_processor import ImageProcessor, PreprocessingStage
from app.image_preprocessing.quality_validator import QualityValidator, ImageQualityError, QualityThresholds

def create_dummy_image(width=100, height=100, color=(255, 255, 255), noise=False, text=False):
    # Create a white image
    img = np.full((height, width, 3), color, dtype=np.uint8)
    
    if noise:
        # Add some random noise
        noise_img = np.random.randint(0, 50, (height, width, 3), dtype=np.uint8)
        img = cv2.add(img, noise_img)
        
    if text:
        # Add some text to have edges/features
        cv2.putText(img, "Test Text", (10, 50), cv2.FONT_HERSHEY_SIMPLEX, 1, (0, 0, 0), 2)
        
    success, encoded_img = cv2.imencode(".png", img)
    return encoded_img.tobytes()

def test_quality_validator_valid_image():
    validator = QualityValidator()
    # Image with text and good lighting
    image_bytes = create_dummy_image(width=200, height=200, text=True)
    # Should not raise any error
    validator.validate(image_bytes)

def test_quality_validator_too_small():
    validator = QualityValidator(QualityThresholds(min_width_px=100, min_height_px=100))
    image_bytes = create_dummy_image(width=50, height=50)
    with pytest.raises(ImageQualityError) as excinfo:
        validator.validate(image_bytes)
    assert "too small" in str(excinfo.value)

def test_quality_validator_too_dark():
    validator = QualityValidator(QualityThresholds(dark_threshold=50))
    # Create a very dark image (almost black)
    image_bytes = create_dummy_image(width=200, height=200, color=(10, 10, 10))
    with pytest.raises(ImageQualityError) as excinfo:
        validator.validate(image_bytes)
    assert "too dark" in str(excinfo.value)

def test_quality_validator_blank():
    validator = QualityValidator(QualityThresholds(blank_std_threshold=5))
    # Create a perfectly uniform image
    image_bytes = create_dummy_image(width=200, height=200, color=(200, 200, 200), text=False)
    with pytest.raises(ImageQualityError) as excinfo:
        validator.validate(image_bytes)
    assert "blank or mostly featureless" in str(excinfo.value)

def test_quality_validator_blurry():
    # To test blur, we create an image and blur it
    # Use gray background (not black) to avoid triggering the darkness check
    img = np.full((200, 200, 3), 128, dtype=np.uint8)
    cv2.putText(img, "Sharp Text", (10, 100), cv2.FONT_HERSHEY_SIMPLEX, 1, (255, 255, 255), 2)
    # Apply heavy blur
    blurred = cv2.GaussianBlur(img, (21, 21), 0)
    success, encoded_img = cv2.imencode(".png", blurred)
    image_bytes = encoded_img.tobytes()
    
    validator = QualityValidator(QualityThresholds(blur_laplacian_var=10))
    with pytest.raises(ImageQualityError) as excinfo:
        validator.validate(image_bytes)
    assert "blurry or out of focus" in str(excinfo.value)

def test_image_processor_stages():
    processor = ImageProcessor()
    # Create a skewed image with some noise and text
    img = np.full((300, 300, 3), 200, dtype=np.uint8)
    cv2.putText(img, "Skewed Text Example", (20, 150), cv2.FONT_HERSHEY_SIMPLEX, 1, (0, 0, 0), 2)
    
    # Rotate it
    centre = (150, 150)
    matrix = cv2.getRotationMatrix2D(centre, 5, 1.0)
    skewed = cv2.warpAffine(img, matrix, (300, 300))
    
    success, encoded_img = cv2.imencode(".png", skewed)
    image_bytes = encoded_img.tobytes()
    
    result = processor.preprocess(image_bytes)
    
    assert result.image_bytes is not None
    assert PreprocessingStage.NOISE_REMOVAL in result.stages_applied
    assert PreprocessingStage.DESKEW in result.stages_applied
    assert PreprocessingStage.CONTRAST_ENHANCE in result.stages_applied
    assert abs(result.skew_angle_deg) > 0

def test_image_processor_decode_error():
    processor = ImageProcessor()
    with pytest.raises(ValueError):
        processor.preprocess(b"not an image")
