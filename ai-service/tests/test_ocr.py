"""
Minimal AI service tests — enough to make CI green.
Expand these as OCR/RAG features are built.
"""


def test_health_check_placeholder():
    """Placeholder: verify test runner works."""
    assert True


def test_ai_app_imports():
    """Verify the AI FastAPI app can be imported without errors."""
    from app.main import app
    assert app.title == "Gyanavriksha AI Microservice"