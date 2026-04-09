"""
retriever.py
============
Builds a LangChain-compatible retriever that scopes ChromaDB queries to the
collection (namespace) matching a student's enrolled grade and subject.

Requirement covered:
    E2-02 - RAG queries retrieve content from the ChromaDB namespace matching
            the student's enrolled grade and subject.
"""

import os
from typing import Optional

from langchain_community.vectorstores import Chroma
from langchain.schema.vectorstore import VectorStoreRetriever

from .embeddings import get_embedding_function, _build_collection_name


# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------

# TODO: Keep CHROMA_PERSIST_DIR consistent with embeddings.py.
# Ideally import a shared config constant rather than duplicating it.
CHROMA_PERSIST_DIR: str = os.environ.get("CHROMA_PERSIST_DIR", "./chroma_store")

# Number of curriculum chunks to retrieve per RAG query.
# Increase for broader context; decrease for speed / token economy.
DEFAULT_K: int = 5


# ---------------------------------------------------------------------------
# Retriever factory (E2-02)
# ---------------------------------------------------------------------------

def get_retriever(
    grade: str,
    subject: str,
    k: int = DEFAULT_K,
    score_threshold: Optional[float] = None,
) -> VectorStoreRetriever:
    """
    Return a LangChain VectorStoreRetriever scoped to the ChromaDB collection
    for *grade* and *subject* (E2-02).

    The retriever is stateless — it can be created fresh on every request or
    cached at the application layer (e.g. per grade/subject pair).

    Args:
        grade:           Student's enrolled grade level (e.g. "7").
        subject:         Student's enrolled subject (e.g. "mathematics").
        k:               Maximum number of chunks to retrieve per query.
        score_threshold: Optional minimum similarity score (0-1). When set,
                        the retriever uses similarity_score_threshold search
                        and drops chunks below this value.

    Returns:
        VectorStoreRetriever: Ready for use inside a LangChain chain.

    Raises:
        ValueError: If the target ChromaDB collection does not exist (i.e. the
                    curriculum PDF for this grade/subject has not been ingested).

    Example::

        retriever = get_retriever(grade="7", subject="mathematics")
        docs = retriever.invoke("What is the quadratic formula?")
    """
    collection_name = _build_collection_name(grade, subject)
    embeddings = get_embedding_function()

    # TODO: Switch to HttpClient if ChromaDB runs as a remote/docker service.
    # See the comment block in embeddings.py for the pattern.
    vector_store = Chroma(
        collection_name=collection_name,
        embedding_function=embeddings,
        persist_directory=CHROMA_PERSIST_DIR,
    )

    # TODO: Connect to your PostgreSQL DB here if you need to cross-reference
    # which grade/subject the student is enrolled in before building the
    # retriever.  For example:
    #
    #   from db import get_student_enrollment   # your existing DB module
    #   enrollment = get_student_enrollment(student_id)
    #   grade, subject = enrollment.grade, enrollment.subject
    #
    # Pass those values in when calling get_retriever() from chain.py.

    # Validate that the collection actually has content.
    collection = vector_store._collection  # access underlying chromadb.Collection
    doc_count = collection.count()
    if doc_count == 0:
        raise ValueError(
            f"ChromaDB collection '{collection_name}' is empty or does not exist. "
            f"Run the Admin ingestion pipeline to embed curriculum content for "
            f"grade='{grade}', subject='{subject}' first."
        )

    # Build retriever search kwargs.
    search_type = "similarity"
    search_kwargs: dict = {"k": k}

    if score_threshold is not None:
        search_type = "similarity_score_threshold"
        search_kwargs["score_threshold"] = score_threshold

    return vector_store.as_retriever(
        search_type=search_type,
        search_kwargs=search_kwargs,
    )
