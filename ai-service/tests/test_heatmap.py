import pytest
from unittest.mock import patch, MagicMock, AsyncMock
from app.heatmap.service import HeatmapService, ChatHeatmapSummary
from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)

@pytest.fixture
def heatmap_service():
    with patch("app.heatmap.service.ChatVertexAI"):
        return HeatmapService()

@pytest.mark.asyncio
async def test_heatmap_service_generate_summary():
    mock_result = {
        "student_id": "test-student",
        "chat_id": "test-chat",
        "subject": "Mathematics",
        "concepts": [
            {"concept_name": "Algebra", "topic_tag": "algebra", "proficiency": 8.5},
            {"concept_name": "Calculus", "topic_tag": "calculus", "proficiency": -2.0}
        ]
    }
    
    with patch("app.heatmap.service.ChatVertexAI"):
        service = HeatmapService()
        
        # Build a mock chain that supports: prompt | llm | parser → chain.ainvoke(...)
        mock_chain = MagicMock()
        mock_chain.ainvoke = AsyncMock(return_value=mock_result)
        # The second | (intermediate | parser) should also return our mock chain
        mock_chain.__or__ = MagicMock(return_value=mock_chain)
        
        # The first | (prompt | llm) returns our mock chain
        original_prompt = service.prompt
        service.prompt = MagicMock()
        service.prompt.__or__ = MagicMock(return_value=mock_chain)
        
        result = await service.generate_summary(
            student_id="test-student",
            chat_id="test-chat",
            subject="Mathematics",
            chat_log="Student asked about algebra and calculus."
        )
        
        assert result.student_id == "test-student"
        assert result.chat_id == "test-chat"
        assert result.subject == "Mathematics"
        assert len(result.concepts) == 2
        assert result.concepts[0].concept_name == "Algebra"

@patch("app.heatmap.router.HeatmapService")
def test_process_chat_heatmap_endpoint(mock_heatmap_service):
    # Mock service instance
    mock_service_instance = MagicMock()
    mock_service_instance.generate_summary = AsyncMock(return_value=ChatHeatmapSummary(
        student_id="student-123",
        chat_id="chat-456",
        subject="Science",
        concepts=[
            {"concept_name": "Photosynthesis", "topic_tag": "photosynthesis", "proficiency": 7.0}
        ]
    ))
    
    from app.heatmap.router import get_heatmap_service
    app.dependency_overrides[get_heatmap_service] = lambda: mock_service_instance
    
    payload = {
        "student_id": "student-123",
        "chat_id": "chat-456",
        "subject": "Science",
        "chat_log": "Student: How do plants make food? Tutor: They use photosynthesis."
    }
    
    response = client.post("/heatmap/process", json=payload)
    
    assert response.status_code == 200
    data = response.json()
    assert data["student_id"] == "student-123"
    assert data["concepts"][0]["concept_name"] == "Photosynthesis"
    assert data["concepts"][0]["proficiency"] == 7.0
    
    mock_service_instance.generate_summary.assert_called_once()
    
    # Cleanup
    app.dependency_overrides = {}

def test_heatmap_service_initialization():
    with patch("app.heatmap.service.ChatVertexAI") as mock_llm:
        service = HeatmapService()
        assert service.llm is not None
        assert service.parser is not None
        assert service.prompt is not None
