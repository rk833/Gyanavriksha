import io
from PIL import Image

# Configuration
MIN_DIMENSION = 400
MAX_DIMENSION = 4096
ALLOWED_FORMATS = {"PNG", "JPEG", "JPG", "WEBP", "BMP", "TIFF", "TIF"}

def validate_image(image_bytes: bytes) -> bool:
    """
    Validates image format and dimensions.
    Returns True if valid, False otherwise.
    """
    try:
        # Load image from bytes
        img = Image.open(io.BytesIO(image_bytes))
        
        # 1. Check Format
        if img.format not in ALLOWED_FORMATS:
            print(f"Validation Failed: Unsupported format {img.format}")
            return False

        # 2. Check Dimensions
        width, height = img.size
        
        if width < MIN_DIMENSION or height < MIN_DIMENSION:
            print(f"Validation Failed: Image too small ({width}x{height})")
            return False
            
        if width > MAX_DIMENSION or height > MAX_DIMENSION:
            print(f"Validation Failed: Image too large ({width}x{height})")
            return False

        return True

    except Exception as e:
        print(f"Validation Failed: Corrupt or invalid image file. {e}")
        return False