from .cloud_vision import VisionService

# Create a single instance for the microservice
_service = VisionService()

def get_text_from_image(image_bytes: bytes) -> str:
    """
    Main entry point for extracting text from preprocessed image bytes.
    """
    return _service.extract_text(image_bytes)