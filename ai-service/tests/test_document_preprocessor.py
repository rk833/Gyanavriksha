"""
test_document_preprocessor.py
Pytest test suite for DocumentPreprocessor.

Run with:
    pytest test_document_preprocessor.py -v

Optional — see coverage:
    pytest test_document_preprocessor.py -v --cov=document_preprocessor
"""

import sys
import types
import textwrap
from io import BytesIO
from pathlib import Path
from unittest.mock import MagicMock, mock_open, patch

import pytest

# ---------------------------------------------------------------------------
# Make the module importable whether the tests live inside the package or
# alongside it (no install required).
# ---------------------------------------------------------------------------
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.document_preprocessing.document_preprocessor import (  # noqa: E402
    DocumentChunk,
    DocumentPreprocessor,
    PreprocessingConfig,
)


# ===========================================================================
# Helpers / shared fixtures
# ===========================================================================

def make_words(n: int, word: str = "word") -> str:
    """Return a string of *n* space-separated tokens."""
    return " ".join([word] * n)


@pytest.fixture()
def default_preprocessor() -> DocumentPreprocessor:
    return DocumentPreprocessor()


@pytest.fixture()
def small_config() -> PreprocessingConfig:
    """Config that makes chunking behaviour easy to reason about in tests."""
    return PreprocessingConfig(
        chunk_size=10,
        chunk_overlap=2,
        min_chunk_words=3,
    )


@pytest.fixture()
def small_preprocessor(small_config) -> DocumentPreprocessor:
    return DocumentPreprocessor(config=small_config)


# ===========================================================================
# 1. PreprocessingConfig — defaults and custom values
# ===========================================================================

class TestPreprocessingConfig:
    def test_defaults(self):
        cfg = PreprocessingConfig()
        assert cfg.chunk_size == 500
        assert cfg.chunk_overlap == 50
        assert cfg.min_chunk_words == 20
        assert cfg.remove_extra_whitespace is True
        assert cfg.remove_headers_footers is True
        assert cfg.lowercase is False

    def test_custom_values(self):
        cfg = PreprocessingConfig(chunk_size=100, chunk_overlap=10, lowercase=True)
        assert cfg.chunk_size == 100
        assert cfg.chunk_overlap == 10
        assert cfg.lowercase is True


# ===========================================================================
# 2. DocumentChunk — structure
# ===========================================================================

class TestDocumentChunk:
    def test_fields_present(self):
        chunk = DocumentChunk(
            chunk_id="doc_0",
            source="/some/doc.txt",
            file_type="txt",
            page=None,
            chunk_index=0,
            total_chunks=1,
            text="hello world",
        )
        assert chunk.chunk_id == "doc_0"
        assert chunk.metadata == {}

    def test_metadata_default_is_independent(self):
        """Each instance must get its own metadata dict (not a shared default)."""
        c1 = DocumentChunk("a", "s", "txt", None, 0, 1, "x")
        c2 = DocumentChunk("b", "s", "txt", None, 1, 1, "y")
        c1.metadata["key"] = "value"
        assert "key" not in c2.metadata


# ===========================================================================
# 3. Validation
# ===========================================================================

class TestValidation:
    def test_missing_file_raises(self, default_preprocessor, tmp_path):
        with pytest.raises(FileNotFoundError):
            default_preprocessor.process(tmp_path / "ghost.txt")

    def test_unsupported_extension_raises(self, default_preprocessor, tmp_path):
        f = tmp_path / "file.csv"
        f.write_text("a,b,c")
        with pytest.raises(ValueError, match="Unsupported extension"):
            default_preprocessor.process(f)

    def test_directory_path_raises(self, default_preprocessor, tmp_path):
        with pytest.raises(ValueError, match="not a file"):
            default_preprocessor.process(tmp_path)

    def test_supported_extensions_set(self):
        assert ".pdf" in DocumentPreprocessor.SUPPORTED_EXTENSIONS
        assert ".txt" in DocumentPreprocessor.SUPPORTED_EXTENSIONS
        assert ".doc" in DocumentPreprocessor.SUPPORTED_EXTENSIONS
        assert ".docx" in DocumentPreprocessor.SUPPORTED_EXTENSIONS


# ===========================================================================
# 4. TXT extraction & full pipeline
# ===========================================================================

class TestTxtProcessing:
    def _write_txt(self, tmp_path, content: str, name="sample.txt") -> Path:
        p = tmp_path / name
        p.write_text(content, encoding="utf-8")
        return p

    def test_basic_txt(self, default_preprocessor, tmp_path):
        p = self._write_txt(tmp_path, make_words(50))
        chunks = default_preprocessor.process(p)
        # With default chunk_size=500 and only 50 words → single chunk
        assert len(chunks) == 1
        assert chunks[0].file_type == "txt"
        assert chunks[0].page is None

    def test_chunk_id_format(self, small_preprocessor, tmp_path):
        p = self._write_txt(tmp_path, make_words(30), name="mydoc.txt")
        chunks = small_preprocessor.process(p)
        for chunk in chunks:
            assert chunk.chunk_id.startswith("mydoc_")

    def test_total_chunks_is_accurate(self, small_preprocessor, tmp_path):
        p = self._write_txt(tmp_path, make_words(30))
        chunks = small_preprocessor.process(p)
        expected_total = len(chunks)
        for chunk in chunks:
            assert chunk.total_chunks == expected_total

    def test_chunk_index_is_sequential(self, small_preprocessor, tmp_path):
        p = self._write_txt(tmp_path, make_words(50))
        chunks = small_preprocessor.process(p)
        for i, chunk in enumerate(chunks):
            assert chunk.chunk_index == i

    def test_extra_metadata_merged(self, default_preprocessor, tmp_path):
        p = self._write_txt(tmp_path, make_words(50))
        chunks = default_preprocessor.process(p, extra_metadata={"project": "rag_v1"})
        for chunk in chunks:
            assert chunk.metadata.get("project") == "rag_v1"

    def test_metadata_contains_filename_and_type(self, default_preprocessor, tmp_path):
        p = self._write_txt(tmp_path, make_words(50), name="report.txt")
        chunks = default_preprocessor.process(p)
        assert chunks[0].metadata["filename"] == "report.txt"
        assert chunks[0].metadata["file_type"] == "txt"

    def test_latin1_encoding(self, default_preprocessor, tmp_path):
        # Use enough words to clear the default min_chunk_words=20 threshold
        p = tmp_path / "latin.txt"
        content = ("caf\xe9 na\xefve r\xe9sum\xe9 " * 10).strip()  # 30 latin-1 words
        p.write_bytes(content.encode("latin-1"))
        chunks = default_preprocessor.process(p)
        assert len(chunks) >= 1

    def test_empty_file_returns_no_chunks(self, default_preprocessor, tmp_path):
        p = self._write_txt(tmp_path, "")
        chunks = default_preprocessor.process(p)
        assert chunks == []

    def test_short_text_below_min_chunk_words(self, small_preprocessor, tmp_path):
        # min_chunk_words=3; write only 2 words
        p = self._write_txt(tmp_path, "one two")
        chunks = small_preprocessor.process(p)
        assert chunks == []

    def test_source_field_is_absolute_path(self, default_preprocessor, tmp_path):
        p = self._write_txt(tmp_path, make_words(50))
        chunks = default_preprocessor.process(p)
        assert Path(chunks[0].source).is_absolute()


# ===========================================================================
# 5. Chunking logic
# ===========================================================================

class TestChunking:
    """Unit-test _chunk_pages directly with controlled inputs."""

    def _preprocessor(self, chunk_size=10, chunk_overlap=2, min_chunk_words=3):
        cfg = PreprocessingConfig(
            chunk_size=chunk_size,
            chunk_overlap=chunk_overlap,
            min_chunk_words=min_chunk_words,
        )
        return DocumentPreprocessor(config=cfg)

    def test_single_chunk_when_text_fits(self):
        p = self._preprocessor(chunk_size=100, chunk_overlap=10)
        pages = [(1, make_words(50))]
        chunks = p._chunk_pages(pages, source="/f/doc.txt", file_type="txt")
        assert len(chunks) == 1

    def test_multiple_chunks_produced(self):
        p = self._preprocessor(chunk_size=10, chunk_overlap=0)
        pages = [(1, make_words(30))]
        chunks = p._chunk_pages(pages, source="/f/doc.txt", file_type="txt")
        assert len(chunks) == 3

    def test_overlap_repeats_words(self):
        """With overlap=2, the last 2 words of chunk N appear at the start of chunk N+1."""
        words = [f"w{i}" for i in range(20)]
        p = self._preprocessor(chunk_size=10, chunk_overlap=2)
        pages = [(None, " ".join(words))]
        chunks = p._chunk_pages(pages, source="/f/doc.txt", file_type="txt")

        chunk0_words = chunks[0].text.split()
        chunk1_words = chunks[1].text.split()
        assert chunk0_words[-2:] == chunk1_words[:2]

    def test_page_numbers_carried_through(self):
        p = self._preprocessor(chunk_size=5, chunk_overlap=0)
        pages = [(3, make_words(10)), (4, make_words(10))]
        chunks = p._chunk_pages(pages, source="/f/doc.txt", file_type="txt")
        page_nums = [c.page for c in chunks]
        assert 3 in page_nums
        assert 4 in page_nums

    def test_chunks_do_not_cross_page_boundary(self):
        """No chunk should contain words from two different pages."""
        p = self._preprocessor(chunk_size=5, chunk_overlap=2)
        pages = [(1, "a b c d e f g"), (2, "h i j k l m n")]
        chunks = p._chunk_pages(pages, source="/f/doc.txt", file_type="txt")
        page1_chunks = [c for c in chunks if c.page == 1]
        page2_chunks = [c for c in chunks if c.page == 2]
        assert page1_chunks and page2_chunks

    def test_empty_page_skipped(self):
        p = self._preprocessor()
        pages = [(1, ""), (2, make_words(5))]
        chunks = p._chunk_pages(pages, source="/f/doc.txt", file_type="txt")
        assert all(c.page == 2 for c in chunks)

    def test_chunk_below_min_words_discarded(self):
        # chunk_size=10, overlap=0, text=12 words → chunks of 10 and 2
        # min_chunk_words=3 → the 2-word tail is dropped
        p = self._preprocessor(chunk_size=10, chunk_overlap=0, min_chunk_words=3)
        pages = [(None, make_words(12))]
        chunks = p._chunk_pages(pages, source="/f/doc.txt", file_type="txt")
        assert len(chunks) == 1
        assert len(chunks[0].text.split()) == 10


# ===========================================================================
# 6. Cleaning
# ===========================================================================

class TestCleaning:
    def _clean(self, text: str, **cfg_kwargs) -> str:
        cfg = PreprocessingConfig(**cfg_kwargs)
        return DocumentPreprocessor(cfg)._clean(text)

    def test_empty_string_returns_empty(self):
        assert self._clean("") == ""

    def test_unicode_quotes_normalised(self):
        result = self._clean("\u2018hello\u2019 \u201cworld\u201d")
        assert "'" in result
        assert '"' in result
        assert "\u2018" not in result
        assert "\u201c" not in result

    def test_unicode_dashes_normalised(self):
        result = self._clean("en\u2013dash em\u2014dash")
        assert "-" in result
        assert "\u2013" not in result
        assert "\u2014" not in result

    def test_control_characters_removed(self):
        result = self._clean("hello\x00world\x07!")
        assert "\x00" not in result
        assert "\x07" not in result
        assert "helloworld!" in result

    def test_newlines_and_tabs_preserved(self):
        result = self._clean("line1\nline2\ttabbed", remove_extra_whitespace=False)
        assert "\n" in result
        assert "\t" in result

    def test_extra_whitespace_collapsed(self):
        result = self._clean("too   many    spaces", remove_extra_whitespace=True)
        assert "  " not in result

    def test_excess_newlines_collapsed(self):
        result = self._clean("a\n\n\n\n\nb", remove_extra_whitespace=True)
        assert "\n\n\n" not in result

    def test_lowercase_option(self):
        result = self._clean("Hello WORLD", lowercase=True)
        assert result == "hello world"

    def test_lowercase_disabled_by_default(self):
        result = self._clean("Hello WORLD")
        assert "H" in result
        assert "W" in result

    def test_header_footer_heuristic_removes_repeated_lines(self):
        # "Page 1" appearing 3+ times should be stripped; body lines are unique
        repeated = "Page 1"
        lines = []
        for i in range(4):
            lines.append(repeated)
            lines.append(f"Unique body content on paragraph number {i} of this document.")
        text = "\n".join(lines)
        result = self._clean(text, remove_headers_footers=True)
        assert repeated not in result
        assert "Unique body content" in result

    def test_header_footer_disabled_keeps_repeated_lines(self):
        repeated = "Page 1"
        text = "\n".join([repeated] * 4)
        result = self._clean(text, remove_headers_footers=False)
        assert repeated in result


# ===========================================================================
# 7. PDF extraction (mocked — no real PDF needed)
# ===========================================================================

class TestPdfExtraction:
    def _make_fake_pdfplumber(self, pages_text: list[str]):
        """Return a fake pdfplumber module + context manager."""
        fake_page = lambda text: MagicMock(extract_text=MagicMock(return_value=text))
        fake_pdf = MagicMock()
        fake_pdf.__enter__ = MagicMock(return_value=fake_pdf)
        fake_pdf.__exit__ = MagicMock(return_value=False)
        fake_pdf.pages = [fake_page(t) for t in pages_text]

        fake_pdfplumber = MagicMock()
        fake_pdfplumber.open = MagicMock(return_value=fake_pdf)
        return fake_pdfplumber

    def test_pdf_pages_extracted_with_pdfplumber(self, tmp_path):
        p = tmp_path / "test.pdf"
        p.write_bytes(b"%PDF-1.4 fake")  # just needs to exist

        fake_pdfplumber = self._make_fake_pdfplumber(
            [make_words(30), make_words(30)]
        )
        cfg = PreprocessingConfig(chunk_size=50, chunk_overlap=5, min_chunk_words=3)
        preprocessor = DocumentPreprocessor(cfg)

        with patch.dict("sys.modules", {"pdfplumber": fake_pdfplumber}):
            chunks = preprocessor.process(p)

        assert len(chunks) >= 1
        assert all(c.file_type == "pdf" for c in chunks)

    def test_pdf_page_numbers_set(self, tmp_path):
        p = tmp_path / "test.pdf"
        p.write_bytes(b"%PDF-1.4 fake")

        fake_pdfplumber = self._make_fake_pdfplumber(
            [make_words(30), make_words(30)]
        )
        cfg = PreprocessingConfig(chunk_size=500, chunk_overlap=0, min_chunk_words=1)
        preprocessor = DocumentPreprocessor(cfg)

        with patch.dict("sys.modules", {"pdfplumber": fake_pdfplumber}):
            chunks = preprocessor.process(p)

        pages_seen = {c.page for c in chunks}
        assert 1 in pages_seen
        assert 2 in pages_seen

    def test_pdf_falls_back_to_pypdf2_when_pdfplumber_missing(self, tmp_path):
        p = tmp_path / "test.pdf"
        p.write_bytes(b"%PDF-1.4 fake")

        # Simulate pdfplumber not installed
        fake_page = MagicMock()
        fake_page.extract_text = MagicMock(return_value=make_words(30))
        fake_reader = MagicMock()
        fake_reader.pages = [fake_page]
        fake_pypdf2 = MagicMock()
        fake_pypdf2.PdfReader = MagicMock(return_value=fake_reader)

        cfg = PreprocessingConfig(chunk_size=500, chunk_overlap=0, min_chunk_words=1)
        preprocessor = DocumentPreprocessor(cfg)

        import builtins
        real_import = builtins.__import__

        def import_blocker(name, *args, **kwargs):
            if name == "pdfplumber":
                raise ImportError("blocked for test")
            return real_import(name, *args, **kwargs)

        with patch("builtins.__import__", side_effect=import_blocker):
            with patch.dict("sys.modules", {"PyPDF2": fake_pypdf2}):
                # Re-run extraction directly
                chunks = preprocessor._extract_pdf(p)

        assert len(chunks) >= 1

    def test_pdf_no_libraries_raises_import_error(self, tmp_path):
        p = tmp_path / "test.pdf"
        p.write_bytes(b"%PDF-1.4 fake")

        preprocessor = DocumentPreprocessor()
        import builtins
        real_import = builtins.__import__

        def block_both(name, *args, **kwargs):
            if name in ("pdfplumber", "PyPDF2"):
                raise ImportError(f"blocked {name}")
            return real_import(name, *args, **kwargs)

        with patch("builtins.__import__", side_effect=block_both):
            with pytest.raises(ImportError, match="pdfplumber"):
                preprocessor._extract_pdf(p)


# ===========================================================================
# 8. DOCX extraction (mocked)
# ===========================================================================

class TestDocxExtraction:
    def _fake_docx_module(self, paragraphs: list[str], table_cells: list[str] = None):
        fake_para = lambda t: MagicMock(text=t)
        fake_cell = lambda t: MagicMock(text=t)

        rows = []
        if table_cells:
            row = MagicMock()
            row.cells = [fake_cell(c) for c in table_cells]
            rows = [row]

        fake_table = MagicMock()
        fake_table.rows = rows

        fake_doc = MagicMock()
        fake_doc.paragraphs = [fake_para(p) for p in paragraphs]
        fake_doc.tables = [fake_table] if table_cells else []

        fake_docx_mod = MagicMock()
        fake_docx_mod.Document = MagicMock(return_value=fake_doc)
        return fake_docx_mod

    def test_docx_paragraphs_extracted(self, tmp_path):
        p = tmp_path / "sample.docx"
        p.write_bytes(b"fake docx bytes")

        fake_mod = self._fake_docx_module([make_words(30), make_words(20)])
        cfg = PreprocessingConfig(chunk_size=500, chunk_overlap=0, min_chunk_words=1)
        preprocessor = DocumentPreprocessor(cfg)

        with patch.dict("sys.modules", {"docx": fake_mod}):
            chunks = preprocessor.process(p)

        assert len(chunks) >= 1
        assert all(c.file_type == "docx" for c in chunks)

    def test_docx_table_cells_included(self, tmp_path):
        p = tmp_path / "sample.docx"
        p.write_bytes(b"fake docx bytes")

        table_content = "table cell content here"
        fake_mod = self._fake_docx_module(
            paragraphs=[make_words(5)],
            table_cells=[table_content],
        )
        cfg = PreprocessingConfig(chunk_size=500, chunk_overlap=0, min_chunk_words=1)
        preprocessor = DocumentPreprocessor(cfg)

        with patch.dict("sys.modules", {"docx": fake_mod}):
            chunks = preprocessor.process(p)

        combined = " ".join(c.text for c in chunks)
        assert "table cell content here" in combined

    def test_docx_empty_paragraphs_skipped(self, tmp_path):
        p = tmp_path / "sample.docx"
        p.write_bytes(b"fake docx bytes")

        fake_mod = self._fake_docx_module(["", "  ", make_words(10)])
        cfg = PreprocessingConfig(chunk_size=500, chunk_overlap=0, min_chunk_words=1)
        preprocessor = DocumentPreprocessor(cfg)

        with patch.dict("sys.modules", {"docx": fake_mod}):
            chunks = preprocessor.process(p)

        assert len(chunks) == 1

    def test_docx_missing_library_raises(self, tmp_path):
        p = tmp_path / "sample.docx"
        p.write_bytes(b"fake docx bytes")

        preprocessor = DocumentPreprocessor()
        import builtins
        real_import = builtins.__import__

        def block_docx(name, *args, **kwargs):
            if name == "docx":
                raise ImportError("blocked")
            return real_import(name, *args, **kwargs)

        with patch("builtins.__import__", side_effect=block_docx):
            with pytest.raises(ImportError, match="python-docx"):
                preprocessor._extract_docx(p)


# ===========================================================================
# 9. DOC extraction (mocked)
# ===========================================================================

class TestDocExtraction:
    def test_doc_text_extracted(self, tmp_path):
        p = tmp_path / "legacy.doc"
        p.write_bytes(b"fake doc bytes")

        fake_docx2txt = MagicMock()
        fake_docx2txt.process = MagicMock(return_value=make_words(30))

        cfg = PreprocessingConfig(chunk_size=500, chunk_overlap=0, min_chunk_words=1)
        preprocessor = DocumentPreprocessor(cfg)

        with patch.dict("sys.modules", {"docx2txt": fake_docx2txt}):
            chunks = preprocessor.process(p)

        assert len(chunks) >= 1
        assert all(c.file_type == "doc" for c in chunks)

    def test_doc_missing_library_raises(self, tmp_path):
        p = tmp_path / "legacy.doc"
        p.write_bytes(b"fake doc bytes")

        preprocessor = DocumentPreprocessor()
        import builtins
        real_import = builtins.__import__

        def block_docx2txt(name, *args, **kwargs):
            if name == "docx2txt":
                raise ImportError("blocked")
            return real_import(name, *args, **kwargs)

        with patch("builtins.__import__", side_effect=block_docx2txt):
            with pytest.raises(ImportError, match="docx2txt"):
                preprocessor._extract_doc(p)


# ===========================================================================
# 10. process_directory
# ===========================================================================

class TestProcessDirectory:
    def _populate(self, tmp_path: Path) -> None:
        (tmp_path / "a.txt").write_text(make_words(50), encoding="utf-8")
        (tmp_path / "b.txt").write_text(make_words(50), encoding="utf-8")
        (tmp_path / "ignored.csv").write_text("x,y,z")

    def test_only_supported_files_processed(self, tmp_path):
        self._populate(tmp_path)
        preprocessor = DocumentPreprocessor()
        chunks = preprocessor.process_directory(tmp_path)
        sources = {Path(c.source).name for c in chunks}
        assert "a.txt" in sources
        assert "b.txt" in sources
        assert "ignored.csv" not in sources

    def test_returns_chunks_from_all_files(self, tmp_path):
        self._populate(tmp_path)
        preprocessor = DocumentPreprocessor()
        chunks = preprocessor.process_directory(tmp_path)
        sources = {Path(c.source).name for c in chunks}
        assert len(sources) == 2

    def test_recursive_finds_nested_files(self, tmp_path):
        sub = tmp_path / "sub"
        sub.mkdir()
        (tmp_path / "root.txt").write_text(make_words(50), encoding="utf-8")
        (sub / "nested.txt").write_text(make_words(50), encoding="utf-8")

        preprocessor = DocumentPreprocessor()
        chunks_flat = preprocessor.process_directory(tmp_path, recursive=False)
        chunks_recursive = preprocessor.process_directory(tmp_path, recursive=True)

        flat_names = {Path(c.source).name for c in chunks_flat}
        recursive_names = {Path(c.source).name for c in chunks_recursive}

        assert "nested.txt" not in flat_names
        assert "nested.txt" in recursive_names

    def test_bad_file_skipped_others_continue(self, tmp_path):
        (tmp_path / "good.txt").write_text(make_words(50), encoding="utf-8")
        # A .txt file that will cause an error (unreadable encoding trick)
        bad = tmp_path / "bad.txt"
        bad.write_bytes(b"\xff\xfe" + b"\x00" * 10)  # will fail all encodings

        preprocessor = DocumentPreprocessor()
        # Should not raise; bad file is skipped
        chunks = preprocessor.process_directory(tmp_path)
        sources = {Path(c.source).name for c in chunks}
        assert "good.txt" in sources

    def test_extra_metadata_passed_through(self, tmp_path):
        (tmp_path / "doc.txt").write_text(make_words(50), encoding="utf-8")
        preprocessor = DocumentPreprocessor()
        chunks = preprocessor.process_directory(
            tmp_path, extra_metadata={"corpus": "test_corpus"}
        )
        assert all(c.metadata.get("corpus") == "test_corpus" for c in chunks)

    def test_empty_directory_returns_empty_list(self, tmp_path):
        preprocessor = DocumentPreprocessor()
        assert preprocessor.process_directory(tmp_path) == []


# ===========================================================================
# 11. Integration — end-to-end with real .txt files
# ===========================================================================

class TestIntegration:
    ARTICLE = textwrap.dedent("""\
        Retrieval-Augmented Generation (RAG) is a technique that enhances
        large language models by retrieving relevant documents at inference
        time. This allows the model to produce answers grounded in up-to-date
        or domain-specific knowledge that was not present during pre-training.

        The pipeline typically consists of three stages: indexing, retrieval,
        and generation. During indexing, documents are split into chunks,
        converted into dense vector embeddings, and stored in a vector
        database. At query time, the user's question is embedded using the
        same model and the nearest-neighbour chunks are fetched. Finally,
        those chunks are concatenated with the original question and passed
        to the language model to produce a final answer.

        Choosing the right chunk size is a critical design decision. Smaller
        chunks improve retrieval precision but may lose context. Larger chunks
        preserve context but can introduce noise and exceed the model context
        window. Overlap between consecutive chunks helps maintain continuity
        across boundaries.
    """)

    def test_full_pipeline_produces_valid_chunks(self, tmp_path):
        p = tmp_path / "article.txt"
        p.write_text(self.ARTICLE, encoding="utf-8")

        cfg = PreprocessingConfig(chunk_size=50, chunk_overlap=10, min_chunk_words=5)
        preprocessor = DocumentPreprocessor(cfg)
        chunks = preprocessor.process(p, extra_metadata={"topic": "rag"})

        assert len(chunks) > 0
        for i, chunk in enumerate(chunks):
            assert chunk.chunk_index == i
            assert chunk.total_chunks == len(chunks)
            assert chunk.file_type == "txt"
            assert chunk.metadata["filename"] == "article.txt"
            assert chunk.metadata["topic"] == "rag"
            assert len(chunk.text.split()) >= cfg.min_chunk_words
            assert chunk.chunk_id == f"article_{i}"

    def test_no_chunk_exceeds_chunk_size(self, tmp_path):
        p = tmp_path / "article.txt"
        p.write_text(self.ARTICLE, encoding="utf-8")

        cfg = PreprocessingConfig(chunk_size=30, chunk_overlap=5, min_chunk_words=3)
        preprocessor = DocumentPreprocessor(cfg)
        chunks = preprocessor.process(p)

        for chunk in chunks:
            assert len(chunk.text.split()) <= cfg.chunk_size

    def test_chunk_text_not_empty(self, tmp_path):
        p = tmp_path / "article.txt"
        p.write_text(self.ARTICLE, encoding="utf-8")

        preprocessor = DocumentPreprocessor()
        chunks = preprocessor.process(p)

        for chunk in chunks:
            assert chunk.text.strip() != ""