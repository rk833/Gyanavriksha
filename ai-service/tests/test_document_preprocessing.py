import pytest
from unittest.mock import patch, MagicMock
from pathlib import Path

from app.rag.document_preprocessing import DocumentPreprocessor, get_document_preprocessor

def test_document_preprocessor_init():
    preprocessor = DocumentPreprocessor(chunk_size=500, chunk_overlap=50)
    assert preprocessor.chunk_size == 500
    assert preprocessor.chunk_overlap == 50

def test_extract_text_unsupported():
    preprocessor = DocumentPreprocessor()
    with pytest.raises(ValueError, match="Unsupported file extension"):
        preprocessor.extract_text("test.csv")

def test_extract_text_txt(tmp_path):
    p = tmp_path / "test.txt"
    p.write_text("hello world")
    preprocessor = DocumentPreprocessor()
    text = preprocessor.extract_text(str(p))
    assert text == "hello world"

@patch("app.rag.document_preprocessing.PdfReader")
def test_extract_text_pdf(mock_pdf_reader):
    mock_instance = MagicMock()
    mock_page = MagicMock()
    mock_page.extract_text.return_value = "pdf content"
    mock_instance.pages = [mock_page]
    mock_pdf_reader.return_value = mock_instance
    
    preprocessor = DocumentPreprocessor()
    text = preprocessor.extract_text("test.pdf")
    assert "pdf content" in text

@patch("app.rag.document_preprocessing.docx.Document")
def test_extract_text_docx(mock_docx):
    mock_instance = MagicMock()
    mock_para = MagicMock()
    mock_para.text = "docx content"
    mock_instance.paragraphs = [mock_para]
    mock_docx.return_value = mock_instance
    
    preprocessor = DocumentPreprocessor()
    text = preprocessor.extract_text("test.docx")
    assert "docx content" in text

def test_process(tmp_path):
    p = tmp_path / "test.txt"
    p.write_text("hello world")
    preprocessor = DocumentPreprocessor(chunk_size=5, chunk_overlap=0)
    results = preprocessor.process(str(p))
    
    assert len(results) > 0
    assert "text" in results[0]
    assert "metadata" in results[0]
    assert results[0]["metadata"]["source"] == "test.txt"

def test_get_document_preprocessor():
    preprocessor = get_document_preprocessor()
    assert isinstance(preprocessor, DocumentPreprocessor)
