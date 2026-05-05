import os
import re
import io
from pathlib import Path
from typing import List, Dict, Any, Optional
from dotenv import load_dotenv
from PIL import Image
from app.ocr import extract_text as ocr_extract_text
try:
    import fitz  # PyMuPDF
except ImportError:
    fitz = None

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
    _MIN_OCR_WIDTH = 400
    _MIN_OCR_HEIGHT = 400
    
    def __init__(self, chunk_size: Optional[int] = None, chunk_overlap: Optional[int] = None):
        """
        Initialize the preprocessor using environment variables if arguments are not provided.
        """
        # Load from .env or fallback to defaults
        # 400 chars ≈ 100-130 tokens. Vertex AI text-embedding-005 caps at 20 000 tokens
        # per request, so keep batches well within that limit.
        self.chunk_size = chunk_size if chunk_size is not None else int(os.getenv('CHUNK_SIZE', '400'))
        self.chunk_overlap = chunk_overlap if chunk_overlap is not None else int(os.getenv('CHUNK_OVERLAP', '60'))
        
        if RecursiveCharacterTextSplitter is None:
            raise ImportError("langchain text splitters are required. Please ensure langchain or langchain-text-splitters is installed.")
            
        self.text_splitter = RecursiveCharacterTextSplitter(
            chunk_size=self.chunk_size,
            chunk_overlap=self.chunk_overlap,
            length_function=len,
            is_separator_regex=False,
        )
        self.last_ocr_summary: dict[str, Any] = {
            "used_ocr": False,
            "images_total": 0,
            "images_succeeded": 0,
            "images_failed": 0,
        }

    def extract_text(self, file_path: str) -> str:
        """
        Extract text from the supported file formats.
        """
        self.last_ocr_summary = {
            "used_ocr": False,
            "images_total": 0,
            "images_succeeded": 0,
            "images_failed": 0,
        }
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
            if text.strip():
                return text

            # Fallback for scanned/image-only PDFs:
            # 1) Prefer full-page rendering OCR via PyMuPDF (best for scanned books).
            page_ocr_text = self._extract_text_from_pdf_pages_via_ocr(str(path))
            if page_ocr_text.strip():
                return page_ocr_text

            # 2) Secondary fallback: OCR embedded page images.
            ocr_parts: list[str] = []
            for page in reader.pages:
                for image in list(getattr(page, "images", []) or []):
                    self.last_ocr_summary["images_total"] += 1
                    data = getattr(image, "data", None)
                    if not data:
                        self.last_ocr_summary["images_failed"] += 1
                        continue
                    if not self._is_worth_ocr(data):
                        self.last_ocr_summary["images_failed"] += 1
                        continue
                    ocr_text = (ocr_extract_text(data, provider="auto") or "").strip()
                    if ocr_text:
                        self.last_ocr_summary["images_succeeded"] += 1
                        ocr_parts.append(ocr_text)
                    else:
                        self.last_ocr_summary["images_failed"] += 1
            return "\n".join(ocr_parts)
            
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

    def extract_toc(self, text: str, source_name: str = "") -> Dict[str, Any] | None:
        """Scan raw document text for unit/chapter headings and return a TOC chunk.

        The TOC chunk is stored as a synthetic document so queries like
        'list all units' or 'what chapters are in this book' can retrieve
        the full structure in a single hit.
        Returns None if fewer than 3 headings are found.
        """
        heading_patterns = [
            r"^(Unit\s+\d+[\s:–\-].{0,80})$",
            r"^(Chapter\s+\d+[\s:–\-].{0,80})$",
            r"^(Section\s+\d+[\s:–\-].{0,80})$",
            r"^(Lesson\s+\d+[\s:–\-].{0,80})$",
            r"^([A-Z][A-Z\s]{5,60})$",
        ]
        seen: set[str] = set()
        headings: list[str] = []
        for line in text.splitlines():
            line = line.strip()
            if not line or len(line) > 120:
                continue
            for pat in heading_patterns:
                if re.match(pat, line, re.IGNORECASE):
                    key = line.lower()
                    if key not in seen:
                        seen.add(key)
                        headings.append(line)
                    break

        if len(headings) < 3:
            return None

        toc_text = (
            f"TABLE OF CONTENTS — {source_name}\n\n"
            + "\n".join(f"• {h}" for h in headings)
        )
        return {
            "text": toc_text,
            "metadata": {"chunk_type": "toc", "source": source_name, "chunk_id": -1},
        }

    def get_last_ocr_summary(self) -> dict[str, Any]:
        """Return OCR usage summary from the most recent extract_text call."""
        return dict(self.last_ocr_summary)

    def _is_worth_ocr(self, image_bytes: bytes) -> bool:
        """Skip tiny PDF image fragments that are unlikely to contain useful text."""
        try:
            with Image.open(io.BytesIO(image_bytes)) as img:
                width, height = img.size
        except Exception:
            return False
        return width >= self._MIN_OCR_WIDTH and height >= self._MIN_OCR_HEIGHT

    def _extract_text_from_pdf_pages_via_ocr(self, file_path: str) -> str:
        """Render each PDF page to an image and OCR it (PyMuPDF path)."""
        if fitz is None:
            return ""
        parts: list[str] = []
        self.last_ocr_summary["used_ocr"] = True
        try:
            with fitz.open(file_path) as doc:
                for page in doc:
                    # 2x render scale to improve OCR quality on scanned pages.
                    pix = page.get_pixmap(matrix=fitz.Matrix(2, 2), alpha=False)
                    image_bytes = pix.tobytes("png")
                    self.last_ocr_summary["images_total"] += 1
                    if not self._is_worth_ocr(image_bytes):
                        self.last_ocr_summary["images_failed"] += 1
                        continue
                    ocr_text = (ocr_extract_text(image_bytes, provider="auto") or "").strip()
                    if ocr_text:
                        self.last_ocr_summary["images_succeeded"] += 1
                        parts.append(ocr_text)
                    else:
                        self.last_ocr_summary["images_failed"] += 1
        except Exception:
            return ""
        return "\n".join(parts)


def get_document_preprocessor() -> DocumentPreprocessor:
    return DocumentPreprocessor()
