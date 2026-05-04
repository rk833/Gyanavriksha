import io
import pytesseract
from PIL import Image
from ..preprocessing.image_processor import validate_image

class TesseractService:
    """
    Fallback OCR Service using Tesseract.
    Requires Tesseract-OCR engine to be installed on the system.
    """
    
    def __init__(self, tesseract_path: str = None):
        """
        Initialize with an optional path to the Tesseract executable.
        If not provided, looks for TESSERACT_PATH environment variable.
        """
        import os
        path = tesseract_path or os.getenv("TESSERACT_PATH")
        if path:
            pytesseract.pytesseract.tesseract_cmd = path

    def extract_text(self, image_content: bytes) -> str:
        """
        Extracts text from image bytes using Tesseract.
        """
        # Validate the image first
        if not validate_image(image_content):
            print("TesseractService: Image validation failed.")
            return ""

        try:
            # Convert bytes to PIL Image
            image = Image.open(io.BytesIO(image_content))
            
            # Perform OCR
            # --psm 3 is 'Fully automatic page segmentation, but no OSD (default)'
            text = pytesseract.image_to_string(image, config='--psm 3')
            
            return text.strip()
            
        except pytesseract.TesseractNotFoundError:
            print("Error: Tesseract-OCR is not installed or not in your PATH.")
            return ""
        except Exception as e:
            print(f"Tesseract OCR failed: {e}")
            return ""