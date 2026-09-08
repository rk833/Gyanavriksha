import pytest
from unittest.mock import patch, MagicMock
from app.rag.rag_service import RAGService, DocumentUploadRequest, QueryRequest

@pytest.fixture
@patch("app.rag.rag_service.HuggingFaceEmbeddings")
@patch("app.rag.rag_service.ChatVertexAI")
@patch("app.rag.rag_service.get_document_preprocessor")
def rag_service(mock_preprocessor, mock_llm, mock_embeddings):
    return RAGService()

@patch("app.rag.rag_service.chroma_manager")
def test_get_collection_admin(mock_chroma_manager, rag_service):
    rag_service.get_collection("admin", grade=8)
    mock_chroma_manager.get_admin_collection.assert_called_once_with(8)

def test_get_collection_admin_missing_grade(rag_service):
    with pytest.raises(ValueError):
        rag_service.get_collection("admin")

@patch("app.rag.rag_service.chroma_manager")
def test_get_collection_instructor(mock_chroma_manager, rag_service):
    rag_service.get_collection("instructor", instructor_id="inst1", class_id="math1")
    mock_chroma_manager.get_or_create_instructor_collection.assert_called_once_with("inst1", "math1")

def test_get_collection_instructor_missing_args(rag_service):
    with pytest.raises(ValueError):
        rag_service.get_collection("instructor")

@patch("app.rag.rag_service.chroma_manager")
def test_get_collection_student(mock_chroma_manager, rag_service):
    rag_service.get_collection("student", student_id="student1")
    mock_chroma_manager.get_or_create_student_collection.assert_called_once_with("student1")

@patch("app.rag.rag_service.Chroma")
@patch("app.rag.rag_service.chroma_manager")
def test_upload_document(mock_chroma_manager, mock_chroma, rag_service):
    rag_service.preprocessor.process.return_value = [{"text": "chunk1", "metadata": {"chunk_id": 0}}]
    # Stub extract_toc so no synthetic TOC chunk is prepended
    rag_service.preprocessor.extract_toc.return_value = None

    mock_collection = MagicMock()
    mock_collection.name = "test_col"
    mock_chroma_manager.get_admin_collection.return_value = mock_collection

    request = DocumentUploadRequest(user_type="admin", grade=8, submitted_by="test_user", subject="math")

    result = rag_service.upload_document("test.txt", request)
    assert result["status"] == "success"
    assert result["chunks_added"] == 1

    mock_chroma_instance = mock_chroma.return_value
    mock_chroma_instance.add_texts.assert_called_once()


@patch("app.rag.rag_service.create_stuff_documents_chain")
@patch("app.rag.rag_service.Chroma")
@patch("app.rag.rag_service.chroma_manager")
def test_query(mock_chroma_manager, mock_chroma, mock_stuff, rag_service):
    mock_collection = MagicMock()
    mock_collection.name = "test_col"
    mock_chroma_manager.get_admin_collection.return_value = mock_collection

    mock_chroma_instance = mock_chroma.return_value
    mock_chroma_instance._collection.get.return_value = None

    mock_doc = MagicMock()
    mock_doc.page_content = "relevant context text"
    mock_doc.metadata = {"source": "test.txt"}
    mock_retriever = MagicMock()
    mock_retriever.invoke.return_value = [mock_doc]
    mock_chroma_instance.as_retriever.return_value = mock_retriever

    mock_chain = MagicMock()
    mock_chain.invoke.return_value = "test answer"
    mock_stuff.return_value = mock_chain

    request = QueryRequest(user_type="admin", query="test query", grade=8)

    result = rag_service.query(request)
    assert result["answer"] == "test answer"
    assert len(result["context_sources"]) == 1
