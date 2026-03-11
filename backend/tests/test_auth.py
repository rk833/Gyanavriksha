"""
Minimal backend tests — enough to make CI green.
Expand these as features are built in future sprints.
"""


def test_health_check_placeholder():
    """Placeholder: verify test runner works."""
    assert True


def test_app_imports():
    """Verify the FastAPI app can be imported without errors."""
    from app.main import app
    assert app.title == "Gyanavriksha Backend API"