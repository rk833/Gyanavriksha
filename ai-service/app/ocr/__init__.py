from .cloud_vision import VisionService
from .tesseract_fallback import TesseractService

# Initialize services
_vision_service = VisionService()
_tesseract_service = TesseractService()

def extract_text(image_bytes: bytes, provider: str = "auto") -> str:
    """
    Main entry point for extracting text from preprocessed image bytes.
    Uses Google Cloud Vision as primary and Tesseract as fallback by default.
    """
    if provider == "google_cloud_vision":
        return _vision_service.extract_text(image_bytes)
    elif provider == "tesseract":
        return _tesseract_service.extract_text(image_bytes)
    
    # "auto" or default behavior
    # 1. Try Primary: Google Cloud Vision
    text = ""
    try:
        text = _vision_service.extract_text(image_bytes)
    except Exception as e:
        print(f"Primary OCR (Vision API) failed: {e}")

    # 2. Try Fallback: Tesseract (if primary failed or returned empty)
    if not text.strip():
        print("Falling back to Tesseract OCR...")
        try:
            text = _tesseract_service.extract_text(image_bytes)
        except Exception as e:
            print(f"Fallback OCR (Tesseract) failed: {e}")

    return text