import pytest
from fastapi.testclient import TestClient
from unittest.mock import patch, MagicMock
from app.main import app

client = TestClient(app)

@patch("app.rag.router.RAGService")
def test_upload_document(mock_rag_service):
    mock_service_instance = MagicMock()
    mock_service_instance.upload_document.return_value = {"status": "success"}
    
    # We patch the dependency
    from app.rag.router import get_rag_service
    app.dependency_overrides[get_rag_service] = lambda: mock_service_instance
    
    files = {"file": ("test.txt", b"hello world")}
    data = {
        "user_type": "admin",
        "submitted_by": "test_user",
        "grade": 8
    }
    
    response = client.post("/rag/upload", files=files, data=data)
    
    assert response.status_code == 200
    assert response.json() == {"status": "success"}
    mock_service_instance.upload_document.assert_called_once()
    
    # Cleanup overrides
    app.dependency_overrides = {}

@patch("app.rag.router.RAGService")
def test_query_rag(mock_rag_service):
    mock_service_instance = MagicMock()
    mock_service_instance.query.return_value = {"answer": "test answer", "context_sources": []}
    
    from app.rag.router import get_rag_service
    app.dependency_overrides[get_rag_service] = lambda: mock_service_instance
    
    data = {
        "user_type": "admin",
        "query": "test query",
        "grade": 8
    }
    
    response = client.post("/rag/query", json=data)
    
    assert response.status_code == 200
    assert response.json()["answer"] == "test answer"
    mock_service_instance.query.assert_called_once()
    
    # Cleanup overrides
    app.dependency_overrides = {}
