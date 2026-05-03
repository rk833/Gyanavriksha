import os
import base64
import requests
try:
    from dotenv import load_dotenv
except Exception:
    def load_dotenv(*_, **__):
        return False

from ..preprocessing.image_processor import validate_image

# Load .env if available
load_dotenv()

class VisionService:
    def __init__(self):
        # Accept multiple possible env var names used in this project
        self.api_key = (
            os.getenv("GOOGLE_VISION_API_KEY")
            or os.getenv("GOOGLE_CLOUD_VISION_APPLICATION_CREDENTIALS")
            or os.getenv("GOOGLE_GENAI_API_KEY")
        )
        if not self.api_key:
            print(
                "WARNING: Google Vision API key not found in environment. "
                "OCR will not work until GOOGLE_VISION_API_KEY or "
                "GOOGLE_CLOUD_VISION_APPLICATION_CREDENTIALS is set."
            )

        self.url = f"https://vision.googleapis.com/v1/images:annotate?key={self.api_key}"

    def extract_text(self, image_content: bytes) -> str:
        """
        Validates the image locally first, then sends to Vision API.
        """
        # --- NEW PREPROCESSING STEP ---
        if not validate_image(image_content):
            return "" # Return empty string for invalid images
        # ------------------------------

        image_base64 = base64.b64encode(image_content).decode("utf-8")

        payload = {
            "requests": [
                {
                    "image": {"content": image_base64},
                    "features": [{"type": "TEXT_DETECTION"}]
                }
            ]
        }

        try:
            response = requests.post(self.url, json=payload)
            response.raise_for_status()
            
            data = response.json()
            results = data.get("responses", [])
            
            if results and "textAnnotations" in results[0]:
                return results[0]["textAnnotations"][0]["description"]
            
            return ""

        except requests.exceptions.RequestException as e:
            print(f"API Request failed: {e}")
            return ""