"""
document_preprocessor.py
Preprocesses .pdf, .txt, .doc, and .docx files for a RAG pipeline.
Produces cleaned, chunked documents with metadata ready for embedding.
"""

import os
import re
import logging
from dataclasses import dataclass, field
from pathlib import Path
from typing import Optional

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Data models
# ---------------------------------------------------------------------------

@dataclass
class DocumentChunk:
    """A single chunk of text ready for embedding."""
    chunk_id: str               # "<source_stem>_<index>"
    source: str                 # original file path
    file_type: str              # pdf | txt | doc | docx
    page: Optional[int]         # page number when available, else None
    chunk_index: int            # position of this chunk within the document
    total_chunks: int           # total chunks for this document (filled in post-split)
    text: str                   # cleaned chunk text
    metadata: dict = field(default_factory=dict)  # any extra caller-supplied metadata


@dataclass
class PreprocessingConfig:
    """Tune chunking and cleaning behaviour."""
    chunk_size: int = 500           # target chunk size in words
    chunk_overlap: int = 50         # overlap between consecutive chunks (words)
    min_chunk_words: int = 20       # discard chunks shorter than this
    remove_extra_whitespace: bool = True
    remove_headers_footers: bool = True  # heuristic — repeated short lines
    lowercase: bool = False          # keep original casing by default


# ---------------------------------------------------------------------------
# Main class
# ---------------------------------------------------------------------------

class DocumentPreprocessor:
    """
    Converts raw documents into lists of DocumentChunk objects.

    Supported formats
    -----------------
    .pdf   — pdfplumber (text layer); falls back to PyPDF2
    .txt   — built-in
    .docx  — python-docx
    .doc   — python-docx2txt  (requires LibreOffice or antiword on some OSes)

    Install dependencies
    --------------------
    pip install pdfplumber PyPDF2 python-docx docx2txt
    """

    SUPPORTED_EXTENSIONS = {".pdf", ".txt", ".doc", ".docx"}

    def __init__(self, config: Optional[PreprocessingConfig] = None):
        self.config = config or PreprocessingConfig()

    # ------------------------------------------------------------------
    # Public API
    # ------------------------------------------------------------------

    def process(
        self,
        file_path: str | Path,
        extra_metadata: Optional[dict] = None,
    ) -> list[DocumentChunk]:
        """
        Main entry point. Returns a list of DocumentChunk objects.

        Parameters
        ----------
        file_path      : path to the document to process
        extra_metadata : optional dict merged into every chunk's metadata
        """
        path = Path(file_path).expanduser().resolve()
        self._validate(path)

        ext = path.suffix.lower()
        logger.info("Processing %s (type=%s)", path.name, ext)

        # 1. Extract raw text (+ optional per-page structure)
        pages: list[tuple[int | None, str]] = self._extract(path, ext)

        # 2. Clean each page/section
        pages = [(pg, self._clean(text)) for pg, text in pages]

        # 3. Chunk across pages
        chunks = self._chunk_pages(pages, source=str(path), file_type=ext.lstrip("."))

        # 4. Attach metadata
        base_meta = {"filename": path.name, "file_type": ext.lstrip(".")}
        if extra_metadata:
            base_meta.update(extra_metadata)
        for chunk in chunks:
            chunk.metadata.update(base_meta)
            chunk.total_chunks = len(chunks)

        logger.info("  → %d chunks produced", len(chunks))
        return chunks

    def process_directory(
        self,
        directory: str | Path,
        recursive: bool = False,
        extra_metadata: Optional[dict] = None,
    ) -> list[DocumentChunk]:
        """Process every supported file in *directory*."""
        directory = Path(directory).expanduser().resolve()
        pattern = "**/*" if recursive else "*"
        all_chunks: list[DocumentChunk] = []
        for f in sorted(directory.glob(pattern)):
            if f.is_file() and f.suffix.lower() in self.SUPPORTED_EXTENSIONS:
                try:
                    all_chunks.extend(self.process(f, extra_metadata=extra_metadata))
                except Exception as exc:  # noqa: BLE001
                    logger.warning("Skipping %s — %s", f.name, exc)
        return all_chunks

    # ------------------------------------------------------------------
    # Validation
    # ------------------------------------------------------------------

    def _validate(self, path: Path) -> None:
        if not path.exists():
            raise FileNotFoundError(f"File not found: {path}")
        if not path.is_file():
            raise ValueError(f"Path is not a file: {path}")
        if path.suffix.lower() not in self.SUPPORTED_EXTENSIONS:
            raise ValueError(
                f"Unsupported extension '{path.suffix}'. "
                f"Supported: {self.SUPPORTED_EXTENSIONS}"
            )

    # ------------------------------------------------------------------
    # Extraction layer  (returns list of (page_number | None, raw_text))
    # ------------------------------------------------------------------

    def _extract(self, path: Path, ext: str) -> list[tuple[int | None, str]]:
        dispatch = {
            ".pdf":  self._extract_pdf,
            ".txt":  self._extract_txt,
            ".docx": self._extract_docx,
            ".doc":  self._extract_doc,
        }
        return dispatch[ext](path)

    def _extract_pdf(self, path: Path) -> list[tuple[int, str]]:
        try:
            import pdfplumber  # preferred
            pages = []
            with pdfplumber.open(path) as pdf:
                for i, page in enumerate(pdf.pages, start=1):
                    text = page.extract_text() or ""
                    pages.append((i, text))
            return pages
        except ImportError:
            pass  # fall through to PyPDF2

        try:
            import PyPDF2  # noqa: N813
            pages = []
            with open(path, "rb") as fh:
                reader = PyPDF2.PdfReader(fh)
                for i, page in enumerate(reader.pages, start=1):
                    text = page.extract_text() or ""
                    pages.append((i, text))
            return pages
        except ImportError as exc:
            raise ImportError(
                "PDF support requires pdfplumber or PyPDF2. "
                "Install with: pip install pdfplumber"
            ) from exc

    def _extract_txt(self, path: Path) -> list[tuple[None, str]]:
        encodings = ["utf-8", "utf-8-sig", "latin-1", "cp1252"]
        for enc in encodings:
            try:
                return [(None, path.read_text(encoding=enc))]
            except (UnicodeDecodeError, LookupError):
                continue
        raise ValueError(f"Could not decode {path.name} with any standard encoding.")

    def _extract_docx(self, path: Path) -> list[tuple[None, str]]:
        try:
            from docx import Document  # python-docx
        except ImportError as exc:
            raise ImportError(
                "DOCX support requires python-docx. "
                "Install with: pip install python-docx"
            ) from exc

        doc = Document(str(path))
        paragraphs = [p.text for p in doc.paragraphs if p.text.strip()]
        # Also pull text from tables
        for table in doc.tables:
            for row in table.rows:
                for cell in row.cells:
                    if cell.text.strip():
                        paragraphs.append(cell.text.strip())
        return [(None, "\n".join(paragraphs))]

    def _extract_doc(self, path: Path) -> list[tuple[None, str]]:
        try:
            import docx2txt
            text = docx2txt.process(str(path))
            return [(None, text or "")]
        except ImportError as exc:
            raise ImportError(
                ".doc support requires docx2txt. "
                "Install with: pip install docx2txt"
            ) from exc

    # ------------------------------------------------------------------
    # Cleaning
    # ------------------------------------------------------------------

    def _clean(self, text: str) -> str:
        if not text:
            return ""

        # Normalise unicode dashes and quotes
        text = text.replace("\u2019", "'").replace("\u2018", "'")
        text = text.replace("\u201c", '"').replace("\u201d", '"')
        text = text.replace("\u2013", "-").replace("\u2014", "-")

        # Remove null bytes and other control characters (keep \n \t)
        text = re.sub(r"[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]", "", text)

        if self.config.remove_headers_footers:
            text = self._strip_headers_footers(text)

        if self.config.remove_extra_whitespace:
            # Collapse horizontal whitespace, preserve paragraph breaks
            text = re.sub(r"[^\S\n]+", " ", text)
            text = re.sub(r"\n{3,}", "\n\n", text)
            text = text.strip()

        if self.config.lowercase:
            text = text.lower()

        return text

    @staticmethod
    def _strip_headers_footers(text: str) -> str:
        """
        Heuristic: remove lines that are very short and appear more than
        twice (typical page headers / footers like page numbers or titles).
        """
        lines = text.splitlines()
        line_counts: dict[str, int] = {}
        for line in lines:
            stripped = line.strip()
            if stripped and len(stripped) < 80:
                line_counts[stripped] = line_counts.get(stripped, 0) + 1

        repeated = {line for line, cnt in line_counts.items() if cnt > 2}
        filtered = [l for l in lines if l.strip() not in repeated]
        return "\n".join(filtered)

    # ------------------------------------------------------------------
    # Chunking
    # ------------------------------------------------------------------

    def _chunk_pages(
        self,
        pages: list[tuple[int | None, str]],
        source: str,
        file_type: str,
    ) -> list[DocumentChunk]:
        """
        Slide a word-count window over the full document.
        Page boundaries are respected — a chunk will not span two pages.
        """
        cfg = self.config
        stem = Path(source).stem
        chunks: list[DocumentChunk] = []

        for page_num, text in pages:
            words = text.split()
            if not words:
                continue

            start = 0
            while start < len(words):
                end = min(start + cfg.chunk_size, len(words))
                chunk_words = words[start:end]

                if len(chunk_words) >= cfg.min_chunk_words:
                    idx = len(chunks)
                    chunks.append(
                        DocumentChunk(
                            chunk_id=f"{stem}_{idx}",
                            source=source,
                            file_type=file_type,
                            page=page_num,
                            chunk_index=idx,
                            total_chunks=0,  # filled in after all pages
                            text=" ".join(chunk_words),
                        )
                    )

                if end == len(words):
                    break
                start += cfg.chunk_size - cfg.chunk_overlap

        return chunks