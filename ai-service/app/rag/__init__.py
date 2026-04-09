"""
RAG Pipeline Package
====================
Orchestrates Retrieval-Augmented Generation for evaluating student answers
against curriculum content using LangChain, ChromaDB, and Google Generative AI.

Modules:
    chain       - LangChain RAG chain construction and query execution (E2-01)
    embeddings  - Google embedding generation and ChromaDB ingestion (E2-03)
    retriever   - ChromaDB namespace-scoped retriever by grade/subject (E2-02)
"""

from .chain import build_rag_chain, evaluate_student_answer
from .embeddings import embed_curriculum_pdf, get_embedding_function
from .retriever import get_retriever

__all__ = [
    "build_rag_chain",
    "evaluate_student_answer",
    "embed_curriculum_pdf",
    "get_embedding_function",
    "get_retriever",
]
