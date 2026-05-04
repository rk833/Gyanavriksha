import pytest
from unittest.mock import patch, MagicMock

from app.rag.chroma_client import ChromaDBManager

@patch("app.rag.chroma_client.chromadb.PersistentClient")
def test_chroma_db_manager_initialization(mock_client):
    mock_instance = MagicMock()
    mock_client.return_value = mock_instance
    
    manager = ChromaDBManager(persist_directory="/tmp/chroma")
    
    mock_client.assert_called_once_with(path="/tmp/chroma")
    assert mock_instance.get_or_create_collection.call_count == 3
    
@patch("app.rag.chroma_client.chromadb.PersistentClient")
def test_get_admin_collection(mock_client):
    mock_instance = MagicMock()
    mock_client.return_value = mock_instance
    
    manager = ChromaDBManager()
    manager.get_admin_collection(8)
    manager.get_admin_collection(9)
    manager.get_admin_collection(10)
    
    with pytest.raises(ValueError):
        manager.get_admin_collection(11)

@patch("app.rag.chroma_client.chromadb.PersistentClient")
def test_instructor_collection(mock_client):
    mock_instance = MagicMock()
    mock_client.return_value = mock_instance
    
    manager = ChromaDBManager()
    manager.get_or_create_instructor_collection("inst1", "math101")
    
    mock_instance.get_or_create_collection.assert_called_with(
        name="instructor_inst1_class_math101",
        metadata={"description": "Instructor inst1 collection for class math101"}
    )

@patch("app.rag.chroma_client.chromadb.PersistentClient")
def test_student_collection(mock_client):
    mock_instance = MagicMock()
    mock_client.return_value = mock_instance
    
    manager = ChromaDBManager()
    manager.get_or_create_student_collection("student1")
    
    mock_instance.get_or_create_collection.assert_called_with(
        name="student_student1",
        metadata={"description": "Student student1 private collection"}
    )
