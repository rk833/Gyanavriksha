"""
test_rag.py
===========
Pytest test suite for the RAG pipeline (E2-01, E2-02, E2-03).

Coverage:
    - embeddings.py  : collection naming, PDF ingestion, embedding function init
    - retriever.py   : namespace scoping, empty-collection guard, search kwargs
    - chain.py       : chain construction, evaluate_student_answer end-to-end
    - __init__.py    : public API surface

External services (Google AI, ChromaDB, PostgreSQL) are fully mocked so the
suite runs offline with no credentials required.

Run:
    pip install pytest pytest-mock langchain langchain-google-genai \
                langchain-community chromadb
    pytest test_rag.py -v
"""

import os
import pytest
from unittest.mock import MagicMock, patch, PropertyMock

# ---------------------------------------------------------------------------
# Ensure env vars are set before any rag imports so init guards don't fire
# ---------------------------------------------------------------------------
os.environ.setdefault("GOOGLE_API_KEY", "test-api-key-placeholder")
os.environ.setdefault("CHROMA_PERSIST_DIR", "/tmp/test_chroma")


# ===========================================================================
# Helpers / shared fixtures
# ===========================================================================

GRADE = "7"
SUBJECT = "mathematics"
EXPECTED_COLLECTION = "grade_7_mathematics"


@pytest.fixture
def mock_embeddings():
    """A mock GoogleGenerativeAIEmbeddings instance."""
    with patch("rag.embeddings.GoogleGenerativeAIEmbeddings") as MockEmb:
        instance = MagicMock()
        MockEmb.return_value = instance
        yield instance


@pytest.fixture
def mock_chroma_store():
    """A mock Chroma vector store with a non-empty collection."""
    store = MagicMock()
    store._collection.count.return_value = 10  # non-empty
    store.as_retriever.return_value = MagicMock()
    return store


# ===========================================================================
# embeddings.py tests
# ===========================================================================

class TestBuildCollectionName:
    """Unit tests for the internal _build_collection_name helper."""

    def test_standard_grade_and_subject(self):
        from rag.embeddings import _build_collection_name
        assert _build_collection_name("7", "mathematics") == "grade_7_mathematics"

    def test_subject_with_spaces_is_sanitised(self):
        from rag.embeddings import _build_collection_name
        result = _build_collection_name("8", "physical science")
        assert " " not in result
        assert result == "grade_8_physical_science"

    def test_special_characters_are_replaced(self):
        from rag.embeddings import _build_collection_name
        result = _build_collection_name("9", "english & literature")
        assert "&" not in result
        assert result.startswith("grade_9_")

    def test_output_is_lowercase(self):
        from rag.embeddings import _build_collection_name
        result = _build_collection_name("6", "BIOLOGY")
        assert result == result.lower()

    def test_numeric_grade_preserved(self):
        from rag.embeddings import _build_collection_name
        result = _build_collection_name("12", "history")
        assert "12" in result


class TestGetEmbeddingFunction:
    """Tests for embedding function initialisation."""

    def test_returns_embedding_instance_when_key_set(self):
        with patch("rag.embeddings.GoogleGenerativeAIEmbeddings") as MockEmb:
            MockEmb.return_value = MagicMock()
            from rag.embeddings import get_embedding_function
            result = get_embedding_function()
            MockEmb.assert_called_once_with(
                model="models/embedding-001",
                google_api_key="test-api-key-placeholder",
            )
            assert result is MockEmb.return_value

    def test_raises_when_api_key_missing(self):
        with patch.dict(os.environ, {"GOOGLE_API_KEY": ""}, clear=False):
            # Re-import to pick up the patched env (module-level constant)
            import importlib
            import rag.embeddings as emb_module
            original_key = emb_module.GOOGLE_API_KEY
            emb_module.GOOGLE_API_KEY = ""
            try:
                with pytest.raises(ValueError, match="GOOGLE_API_KEY"):
                    emb_module.get_embedding_function()
            finally:
                emb_module.GOOGLE_API_KEY = original_key


class TestLoadAndSplitPDF:
    """Tests for the internal PDF loading/splitting helper."""

    def test_splits_pdf_into_documents(self):
        from langchain.schema import Document
        fake_docs = [Document(page_content="A" * 2000, metadata={"page": 0})]

        with patch("rag.embeddings.PyPDFLoader") as MockLoader:
            MockLoader.return_value.load.return_value = fake_docs
            from rag.embeddings import _load_and_split_pdf
            chunks = _load_and_split_pdf("fake.pdf")

        # A 2000-char doc with chunk_size=800 must produce more than 1 chunk.
        assert len(chunks) > 1

    def test_each_chunk_is_document(self):
        from langchain.schema import Document
        fake_docs = [Document(page_content="Word " * 300, metadata={"page": 1})]

        with patch("rag.embeddings.PyPDFLoader") as MockLoader:
            MockLoader.return_value.load.return_value = fake_docs
            from rag.embeddings import _load_and_split_pdf
            chunks = _load_and_split_pdf("fake.pdf")

        assert all(isinstance(c, Document) for c in chunks)

    def test_empty_pdf_returns_empty_list(self):
        with patch("rag.embeddings.PyPDFLoader") as MockLoader:
            MockLoader.return_value.load.return_value = []
            from rag.embeddings import _load_and_split_pdf
            chunks = _load_and_split_pdf("empty.pdf")

        assert chunks == []


class TestEmbedCurriculumPDF:
    """Integration-style tests for embed_curriculum_pdf (E2-03)."""

    def _make_fake_doc(self, content="Sample curriculum text."):
        from langchain.schema import Document
        return Document(page_content=content, metadata={"page": 0})

    @patch("rag.embeddings.Chroma")
    @patch("rag.embeddings.get_embedding_function")
    @patch("rag.embeddings._load_and_split_pdf")
    def test_returns_chunk_count(self, mock_split, mock_emb_fn, mock_chroma):
        fake_docs = [self._make_fake_doc() for _ in range(5)]
        mock_split.return_value = fake_docs
        mock_emb_fn.return_value = MagicMock()
        mock_chroma.from_documents.return_value = MagicMock()

        from rag.embeddings import embed_curriculum_pdf
        count = embed_curriculum_pdf("curriculum.pdf", grade=GRADE, subject=SUBJECT)

        assert count == 5

    @patch("rag.embeddings.Chroma")
    @patch("rag.embeddings.get_embedding_function")
    @patch("rag.embeddings._load_and_split_pdf")
    def test_metadata_stamped_on_chunks(self, mock_split, mock_emb_fn, mock_chroma):
        fake_docs = [self._make_fake_doc() for _ in range(3)]
        mock_split.return_value = fake_docs
        mock_emb_fn.return_value = MagicMock()
        mock_chroma.from_documents.return_value = MagicMock()

        from rag.embeddings import embed_curriculum_pdf
        embed_curriculum_pdf("maths.pdf", grade=GRADE, subject=SUBJECT)

        for doc in fake_docs:
            assert doc.metadata["grade"] == GRADE
            assert doc.metadata["subject"] == SUBJECT
            assert doc.metadata["source_file"] == "maths.pdf"

    @patch("rag.embeddings.Chroma")
    @patch("rag.embeddings.get_embedding_function")
    @patch("rag.embeddings._load_and_split_pdf")
    def test_correct_collection_name_used(self, mock_split, mock_emb_fn, mock_chroma):
        mock_split.return_value = [self._make_fake_doc()]
        mock_emb_fn.return_value = MagicMock()
        mock_chroma.from_documents.return_value = MagicMock()

        from rag.embeddings import embed_curriculum_pdf
        embed_curriculum_pdf("bio.pdf", grade="9", subject="biology")

        call_kwargs = mock_chroma.from_documents.call_args.kwargs
        assert call_kwargs["collection_name"] == "grade_9_biology"

    @patch("rag.embeddings.Chroma")
    @patch("rag.embeddings.get_embedding_function")
    @patch("rag.embeddings._load_and_split_pdf")
    def test_chroma_called_with_persist_dir(self, mock_split, mock_emb_fn, mock_chroma):
        mock_split.return_value = [self._make_fake_doc()]
        mock_emb_fn.return_value = MagicMock()
        mock_chroma.from_documents.return_value = MagicMock()

        from rag.embeddings import embed_curriculum_pdf, CHROMA_PERSIST_DIR
        embed_curriculum_pdf("doc.pdf", grade=GRADE, subject=SUBJECT)

        call_kwargs = mock_chroma.from_documents.call_args.kwargs
        assert call_kwargs["persist_directory"] == CHROMA_PERSIST_DIR


# ===========================================================================
# retriever.py tests
# ===========================================================================

class TestGetRetriever:
    """Tests for the namespace-scoped retriever factory (E2-02)."""

    def _mock_chroma(self, doc_count=10):
        store = MagicMock()
        store._collection.count.return_value = doc_count
        store.as_retriever.return_value = MagicMock()
        return store

    @patch("rag.retriever.Chroma")
    @patch("rag.retriever.get_embedding_function")
    def test_returns_retriever(self, mock_emb_fn, mock_chroma_cls):
        mock_emb_fn.return_value = MagicMock()
        mock_chroma_cls.return_value = self._mock_chroma()

        from rag.retriever import get_retriever
        retriever = get_retriever(grade=GRADE, subject=SUBJECT)
        assert retriever is not None

    @patch("rag.retriever.Chroma")
    @patch("rag.retriever.get_embedding_function")
    def test_correct_collection_name_scoped(self, mock_emb_fn, mock_chroma_cls):
        """Confirms namespace matches grade+subject (E2-02)."""
        mock_emb_fn.return_value = MagicMock()
        mock_chroma_cls.return_value = self._mock_chroma()

        from rag.retriever import get_retriever
        get_retriever(grade=GRADE, subject=SUBJECT)

        call_kwargs = mock_chroma_cls.call_args.kwargs
        assert call_kwargs["collection_name"] == EXPECTED_COLLECTION

    @patch("rag.retriever.Chroma")
    @patch("rag.retriever.get_embedding_function")
    def test_different_grades_use_different_collections(self, mock_emb_fn, mock_chroma_cls):
        """Two students in different grades must hit different namespaces."""
        mock_emb_fn.return_value = MagicMock()
        mock_chroma_cls.return_value = self._mock_chroma()

        from rag.retriever import get_retriever

        get_retriever(grade="7", subject="mathematics")
        first_call = mock_chroma_cls.call_args.kwargs["collection_name"]

        get_retriever(grade="8", subject="mathematics")
        second_call = mock_chroma_cls.call_args.kwargs["collection_name"]

        assert first_call != second_call

    @patch("rag.retriever.Chroma")
    @patch("rag.retriever.get_embedding_function")
    def test_raises_on_empty_collection(self, mock_emb_fn, mock_chroma_cls):
        """Empty namespace → clear error instead of silent empty retrieval."""
        mock_emb_fn.return_value = MagicMock()
        mock_chroma_cls.return_value = self._mock_chroma(doc_count=0)

        from rag.retriever import get_retriever
        with pytest.raises(ValueError, match="empty or does not exist"):
            get_retriever(grade=GRADE, subject=SUBJECT)

    @patch("rag.retriever.Chroma")
    @patch("rag.retriever.get_embedding_function")
    def test_default_k_applied(self, mock_emb_fn, mock_chroma_cls):
        mock_emb_fn.return_value = MagicMock()
        store = self._mock_chroma()
        mock_chroma_cls.return_value = store

        from rag.retriever import get_retriever, DEFAULT_K
        get_retriever(grade=GRADE, subject=SUBJECT)

        _, kwargs = store.as_retriever.call_args
        assert kwargs["search_kwargs"]["k"] == DEFAULT_K

    @patch("rag.retriever.Chroma")
    @patch("rag.retriever.get_embedding_function")
    def test_custom_k_applied(self, mock_emb_fn, mock_chroma_cls):
        mock_emb_fn.return_value = MagicMock()
        store = self._mock_chroma()
        mock_chroma_cls.return_value = store

        from rag.retriever import get_retriever
        get_retriever(grade=GRADE, subject=SUBJECT, k=3)

        _, kwargs = store.as_retriever.call_args
        assert kwargs["search_kwargs"]["k"] == 3

    @patch("rag.retriever.Chroma")
    @patch("rag.retriever.get_embedding_function")
    def test_score_threshold_switches_search_type(self, mock_emb_fn, mock_chroma_cls):
        mock_emb_fn.return_value = MagicMock()
        store = self._mock_chroma()
        mock_chroma_cls.return_value = store

        from rag.retriever import get_retriever
        get_retriever(grade=GRADE, subject=SUBJECT, score_threshold=0.75)

        _, kwargs = store.as_retriever.call_args
        assert kwargs["search_type"] == "similarity_score_threshold"
        assert kwargs["search_kwargs"]["score_threshold"] == 0.75

    @patch("rag.retriever.Chroma")
    @patch("rag.retriever.get_embedding_function")
    def test_default_search_type_is_similarity(self, mock_emb_fn, mock_chroma_cls):
        mock_emb_fn.return_value = MagicMock()
        store = self._mock_chroma()
        mock_chroma_cls.return_value = store

        from rag.retriever import get_retriever
        get_retriever(grade=GRADE, subject=SUBJECT)

        _, kwargs = store.as_retriever.call_args
        assert kwargs["search_type"] == "similarity"


# ===========================================================================
# chain.py tests
# ===========================================================================

class TestFormatDocs:
    """Tests for the internal _format_docs helper."""

    def test_single_doc_formatted(self):
        from langchain.schema import Document
        from rag.chain import _format_docs

        doc = Document(
            page_content="The quadratic formula is x = (-b ± √D) / 2a.",
            metadata={"source_file": "maths.pdf", "page": 3},
        )
        result = _format_docs([doc])
        assert "The quadratic formula" in result
        assert "maths.pdf" in result
        assert "Page: 3" in result

    def test_multiple_docs_separated(self):
        from langchain.schema import Document
        from rag.chain import _format_docs

        docs = [
            Document(page_content="Content A", metadata={}),
            Document(page_content="Content B", metadata={}),
        ]
        result = _format_docs(docs)
        assert "Content A" in result
        assert "Content B" in result
        assert "---" in result  # separator present

    def test_empty_list_returns_empty_string(self):
        from rag.chain import _format_docs
        assert _format_docs([]) == ""

    def test_missing_metadata_uses_defaults(self):
        from langchain.schema import Document
        from rag.chain import _format_docs

        doc = Document(page_content="No metadata here.", metadata={})
        result = _format_docs([doc])
        assert "unknown" in result
        assert "?" in result


class TestBuildRagChain:
    """Tests for build_rag_chain (E2-01)."""

    @patch("rag.chain.get_retriever")
    @patch("rag.chain._get_llm")
    def test_chain_is_returned(self, mock_llm, mock_retriever):
        mock_retriever.return_value = MagicMock()
        mock_llm.return_value = MagicMock()

        from rag.chain import build_rag_chain
        chain = build_rag_chain(grade=GRADE, subject=SUBJECT)
        assert chain is not None

    @patch("rag.chain.get_retriever")
    @patch("rag.chain._get_llm")
    def test_retriever_called_with_correct_namespace(self, mock_llm, mock_retriever):
        """Chain must scope retrieval to the student's grade+subject (E2-02)."""
        mock_retriever.return_value = MagicMock()
        mock_llm.return_value = MagicMock()

        from rag.chain import build_rag_chain
        build_rag_chain(grade=GRADE, subject=SUBJECT)

        mock_retriever.assert_called_once_with(grade=GRADE, subject=SUBJECT)

    @patch("rag.chain.get_retriever")
    @patch("rag.chain._get_llm")
    def test_raises_when_retriever_raises(self, mock_llm, mock_retriever):
        """Propagates collection-not-found errors from retriever."""
        mock_retriever.side_effect = ValueError("empty or does not exist")
        mock_llm.return_value = MagicMock()

        from rag.chain import build_rag_chain
        with pytest.raises(ValueError, match="empty or does not exist"):
            build_rag_chain(grade=GRADE, subject=SUBJECT)


class TestGetLLM:
    """Tests for the LLM factory helper."""

    def test_returns_chat_model_when_key_set(self):
        with patch("rag.chain.ChatGoogleGenerativeAI") as MockLLM:
            MockLLM.return_value = MagicMock()
            from rag.chain import _get_llm
            result = _get_llm()
            assert result is MockLLM.return_value

    def test_raises_when_api_key_missing(self):
        import rag.chain as chain_module
        original = chain_module.GOOGLE_API_KEY
        chain_module.GOOGLE_API_KEY = ""
        try:
            with pytest.raises(ValueError, match="GOOGLE_API_KEY"):
                chain_module._get_llm()
        finally:
            chain_module.GOOGLE_API_KEY = original


class TestEvaluateStudentAnswer:
    """End-to-end tests for the public evaluate_student_answer function."""

    QUESTION = "Explain the Pythagorean theorem."
    ANSWER = "a squared plus b squared equals c squared."
    MOCK_EVALUATION = (
        "Score: 8/10 — The student correctly states the theorem but does not "
        "mention that c must be the hypotenuse."
    )

    @patch("rag.chain.build_rag_chain")
    def test_returns_evaluation_result_dict(self, mock_build):
        mock_chain = MagicMock()
        mock_chain.invoke.return_value = self.MOCK_EVALUATION
        mock_build.return_value = mock_chain

        from rag.chain import evaluate_student_answer
        result = evaluate_student_answer(
            question=self.QUESTION,
            student_answer=self.ANSWER,
            grade=GRADE,
            subject=SUBJECT,
        )

        assert result["evaluation"] == self.MOCK_EVALUATION
        assert result["grade"] == GRADE
        assert result["subject"] == SUBJECT
        assert result["question"] == self.QUESTION
        assert result["student_answer"] == self.ANSWER

    @patch("rag.chain.build_rag_chain")
    def test_chain_invoked_with_question_and_answer(self, mock_build):
        mock_chain = MagicMock()
        mock_chain.invoke.return_value = self.MOCK_EVALUATION
        mock_build.return_value = mock_chain

        from rag.chain import evaluate_student_answer
        evaluate_student_answer(
            question=self.QUESTION,
            student_answer=self.ANSWER,
            grade=GRADE,
            subject=SUBJECT,
        )

        mock_chain.invoke.assert_called_once_with({
            "question": self.QUESTION,
            "student_answer": self.ANSWER,
        })

    @patch("rag.chain.build_rag_chain")
    def test_build_chain_called_with_grade_and_subject(self, mock_build):
        mock_chain = MagicMock()
        mock_chain.invoke.return_value = self.MOCK_EVALUATION
        mock_build.return_value = mock_chain

        from rag.chain import evaluate_student_answer
        evaluate_student_answer(
            question=self.QUESTION,
            student_answer=self.ANSWER,
            grade=GRADE,
            subject=SUBJECT,
        )

        mock_build.assert_called_once_with(grade=GRADE, subject=SUBJECT)

    @patch("rag.chain.build_rag_chain")
    def test_llm_error_propagates(self, mock_build):
        mock_chain = MagicMock()
        mock_chain.invoke.side_effect = RuntimeError("Google API quota exceeded")
        mock_build.return_value = mock_chain

        from rag.chain import evaluate_student_answer
        with pytest.raises(RuntimeError, match="quota exceeded"):
            evaluate_student_answer(
                question=self.QUESTION,
                student_answer=self.ANSWER,
                grade=GRADE,
                subject=SUBJECT,
            )

    @patch("rag.chain.build_rag_chain")
    def test_empty_student_answer_still_runs(self, mock_build):
        """An empty answer is valid input — the LLM should handle the scoring."""
        mock_chain = MagicMock()
        mock_chain.invoke.return_value = "Score: 0/10 — No answer provided."
        mock_build.return_value = mock_chain

        from rag.chain import evaluate_student_answer
        result = evaluate_student_answer(
            question=self.QUESTION,
            student_answer="",
            grade=GRADE,
            subject=SUBJECT,
        )
        assert result["student_answer"] == ""


# ===========================================================================
# __init__.py public API surface tests
# ===========================================================================

class TestPublicAPI:
    """Smoke tests — confirm the package exports what it promises."""

    def test_build_rag_chain_importable(self):
        from rag import build_rag_chain
        assert callable(build_rag_chain)

    def test_evaluate_student_answer_importable(self):
        from rag import evaluate_student_answer
        assert callable(evaluate_student_answer)

    def test_embed_curriculum_pdf_importable(self):
        from rag import embed_curriculum_pdf
        assert callable(embed_curriculum_pdf)

    def test_get_embedding_function_importable(self):
        from rag import get_embedding_function
        assert callable(get_embedding_function)

    def test_get_retriever_importable(self):
        from rag import get_retriever
        assert callable(get_retriever)


# ===========================================================================
# Cross-module integration: namespace consistency
# ===========================================================================

class TestNamespaceConsistency:
    """
    Verifies that embeddings.py and retriever.py derive identical collection
    names from the same grade+subject pair — critical for E2-02 / E2-03
    correctness.
    """

    def test_ingestion_and_retrieval_use_same_collection(self):
        from rag.embeddings import _build_collection_name as emb_name
        from rag.retriever import _build_collection_name as ret_name  # same import

        for grade, subject in [("7", "mathematics"), ("9", "biology"), ("12", "history")]:
            assert emb_name(grade, subject) == ret_name(grade, subject), (
                f"Collection name mismatch for grade={grade}, subject={subject}"
            )