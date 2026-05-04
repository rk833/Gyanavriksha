import os
from pathlib import Path


def configure_google_credentials() -> None:
    """
    Ensure Google ADC credentials are configured for Vertex/GenAI clients.
    Prefer GOOGLE_APPLICATION_CREDENTIALS from env.
    """
    credentials_path = os.getenv("GOOGLE_APPLICATION_CREDENTIALS")
    if not credentials_path:
        # Fallback for local dev if env is missing.
        default_path = Path(__file__).resolve().parents[2] / "service-account.json"
        if default_path.exists():
            os.environ["GOOGLE_APPLICATION_CREDENTIALS"] = str(default_path)

    region = os.getenv("GOOGLE_CLOUD_REGION") or os.getenv("GOOGLE_CLOUD_LOCATION")
    if not region:
        region = "us-central1"

    # Support both env names; some libraries expect LOCATION while teams use REGION.
    os.environ["GOOGLE_CLOUD_REGION"] = region
    os.environ["GOOGLE_CLOUD_LOCATION"] = region
