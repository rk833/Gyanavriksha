import os
from pathlib import Path
from typing import List, Dict, Any, Optional
from dotenv import load_dotenv

# Document parsers
try:
    from pypdf import PdfReader
except ImportError:
    PdfReader = None

try:
    import docx
except ImportError:
    docx = None

try:
    from langchain.text_splitter import RecursiveCharacterTextSplitter
except ImportError:
    # Try importing from newer package location if installed
    try:
        from langchain_text_splitters import RecursiveCharacterTextSplitter
    except ImportError:
        RecursiveCharacterTextSplitter = None

# Load environment variables
load_dotenv()

class DocumentPreprocessor:
    """
    A service for preprocessing documents to be used in the RAG pipeline.
    It accepts only .txt, .pdf, .docx/.doc, and .md files.
    """
    
    ALLOWED_EXTENSIONS = {'.txt', '.pdf', '.docx', '.doc', '.md'}
    
    def __init__(self, chunk_size: Optional[int] = None, chunk_overlap: Optional[int] = None):
        """
        Initialize the preprocessor using environment variables if arguments are not provided.
        """
        # Load from .env or fallback to defaults
        self.chunk_size = chunk_size if chunk_size is not None else int(os.getenv('CHUNK_SIZE', '1000'))
        self.chunk_overlap = chunk_overlap if chunk_overlap is not None else int(os.getenv('CHUNK_OVERLAP', '200'))
        
        if RecursiveCharacterTextSplitter is None:
            raise ImportError("langchain text splitters are required. Please ensure langchain or langchain-text-splitters is installed.")
            
        self.text_splitter = RecursiveCharacterTextSplitter(
            chunk_size=self.chunk_size,
            chunk_overlap=self.chunk_overlap,
            length_function=len,
            is_separator_regex=False,
        )

    def extract_text(self, file_path: str) -> str:
        """
        Extract text from the supported file formats.
        """
        path = Path(file_path)
        ext = path.suffix.lower()
        
        if ext not in self.ALLOWED_EXTENSIONS:
            raise ValueError(f"Unsupported file extension: {ext}. Allowed extensions: {', '.join(self.ALLOWED_EXTENSIONS)}")
            
        if ext in {'.txt', '.md'}:
            with open(path, 'r', encoding='utf-8') as f:
                return f.read()
                
        elif ext == '.pdf':
            if PdfReader is None:
                raise ImportError("pypdf is required to process PDF files. Run: pip install pypdf")
            reader = PdfReader(str(path))
            text = ""
            for page in reader.pages:
                extracted = page.extract_text()
                if extracted:
                    text += extracted + "\n"
            return text
            
        elif ext in {'.docx', '.doc'}:
            if docx is None:
                raise ImportError("python-docx is required to process DOCX files. Run: pip install python-docx")
            doc = docx.Document(str(path))
            text = "\n".join([paragraph.text for paragraph in doc.paragraphs])
            return text
            
        raise ValueError(f"Cannot process file {file_path}")

    def chunk_document(self, file_path: str) -> List[str]:
        """
        Read the file, extract its text, and return a list of text chunks.
        """
        text = self.extract_text(file_path)
        chunks = self.text_splitter.split_text(text)
        return chunks
        
    def process(self, file_path: str) -> List[Dict[str, Any]]:
        """
        Process the document into chunks along with some basic metadata.
        Returns a list of dictionaries with 'text' and 'metadata'.
        """
        chunks = self.chunk_document(file_path)
        path = Path(file_path)
        
        results = []
        for i, chunk in enumerate(chunks):
            results.append({
                "text": chunk,
                "metadata": {
                    "source": path.name,
                    "chunk_id": i,
                    "extension": path.suffix.lower()
                }
            })
            
        return results

# A convenience function for easy RAG pipeline integration
def get_document_preprocessor() -> DocumentPreprocessor:
    return DocumentPreprocessor()
