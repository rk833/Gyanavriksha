"""
embeddings.py
=============
Handles embedding generation via Google Generative AI and ingestion of
curriculum PDF content into the ChromaDB vector store.

Requirement covered:
    E2-03 - Admin curriculum ingestion pipeline embeds PDF content into the
            correct ChromaDB namespace (grade + subject).
"""

import os
from typing import List

from langchain_google_genai import GoogleGenerativeAIEmbeddings
from langchain_community.vectorstores import Chroma
from langchain_community.document_loaders import PyPDFLoader
from langchain.text_splitter import RecursiveCharacterTextSplitter
from langchain.schema import Document


# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------

# TODO: Load GOOGLE_API_KEY from your environment / secrets manager.
# The key must have the "Generative Language API" scope enabled in Google Cloud.
GOOGLE_API_KEY: str = os.environ.get("GOOGLE_API_KEY", "")

# TODO: Set CHROMA_PERSIST_DIR to the directory where ChromaDB persists its data.
# This should match the path used when the ChromaDB server / client was initialised.
CHROMA_PERSIST_DIR: str = os.environ.get("CHROMA_PERSIST_DIR", "./chroma_store")

# Chunking strategy — tune these values based on your curriculum document lengths.
CHUNK_SIZE: int = 800
CHUNK_OVERLAP: int = 100


# ---------------------------------------------------------------------------
# Embedding function
# ---------------------------------------------------------------------------

def get_embedding_function() -> GoogleGenerativeAIEmbeddings:
    """
    Return a LangChain-compatible embedding function backed by the Google
    Generative AI Embeddings API (models/embedding-001).

    Returns:
        GoogleGenerativeAIEmbeddings: Ready-to-use embeddings instance.

    Raises:
        ValueError: If GOOGLE_API_KEY is not set.
    """
    if not GOOGLE_API_KEY:
        raise ValueError(
            "GOOGLE_API_KEY environment variable is not set. "
            "Obtain a key from https://aistudio.google.com/ and export it."
        )

    return GoogleGenerativeAIEmbeddings(
        model="models/embedding-001",
        google_api_key=GOOGLE_API_KEY,
    )


# ---------------------------------------------------------------------------
# Namespace helper
# ---------------------------------------------------------------------------

def _build_collection_name(grade: str, subject: str) -> str:
    """
    Derive a deterministic ChromaDB collection name from grade and subject.

    ChromaDB collection names must be 3-63 characters, start/end with an
    alphanumeric character, and contain only alphanumerics, underscores, or
    hyphens.

    Args:
        grade:   Student grade level, e.g. "grade_7" or "7".
        subject: Subject name, e.g. "mathematics".

    Returns:
        str: Sanitised collection name, e.g. "grade_7_mathematics".
    """
    raw = f"grade_{grade}_{subject}".lower()
    # Replace spaces / special chars with underscores for ChromaDB safety.
    sanitised = "".join(c if c.isalnum() or c == "_" else "_" for c in raw)
    return sanitised


# ---------------------------------------------------------------------------
# PDF ingestion (E2-03)
# ---------------------------------------------------------------------------

def _load_and_split_pdf(pdf_path: str) -> List[Document]:
    """
    Load a PDF from *pdf_path* and split it into overlapping text chunks.

    Args:
        pdf_path: Absolute or relative path to the curriculum PDF file.

    Returns:
        List[Document]: Chunked LangChain Document objects with page metadata.
    """
    loader = PyPDFLoader(pdf_path)
    raw_docs: List[Document] = loader.load()

    splitter = RecursiveCharacterTextSplitter(
        chunk_size=CHUNK_SIZE,
        chunk_overlap=CHUNK_OVERLAP,
        separators=["\n\n", "\n", ".", " ", ""],
    )
    return splitter.split_documents(raw_docs)


def embed_curriculum_pdf(
    pdf_path: str,
    grade: str,
    subject: str,
) -> int:
    """
    Ingest a curriculum PDF into the ChromaDB collection that corresponds to
    the given grade and subject (E2-03).

    This function is intended for use by the **Admin curriculum ingestion
    pipeline** and should NOT be called on every student request.

    Steps:
        1. Load and chunk the PDF.
        2. Attach grade/subject metadata to every chunk.
        3. Embed each chunk using the Google Generative AI embedding model.
        4. Persist the embeddings into the correct ChromaDB namespace/collection.

    Args:
        pdf_path: Path to the curriculum PDF to ingest.
        grade:    Grade level the PDF belongs to (e.g. "7").
        subject:  Subject the PDF belongs to (e.g. "mathematics").

    Returns:
        int: Number of document chunks successfully embedded.

    Example (Admin CLI usage)::

        from rag.embeddings import embed_curriculum_pdf
        count = embed_curriculum_pdf("maths_grade7.pdf", grade="7", subject="mathematics")
        print(f"Embedded {count} chunks.")
    """
    collection_name = _build_collection_name(grade, subject)
    docs = _load_and_split_pdf(pdf_path)

    # Stamp each chunk with grade/subject so the retriever can filter on them.
    for doc in docs:
        doc.metadata.update({
            "grade": grade,
            "subject": subject,
            "source_file": os.path.basename(pdf_path),
        })

    embeddings = get_embedding_function()

    # TODO: If you are running ChromaDB in *server* mode (docker / remote),
    # replace Chroma(...) with a HttpClient-backed instance:
    #
    #   import chromadb
    #   from langchain_community.vectorstores import Chroma
    #   client = chromadb.HttpClient(host=CHROMA_HOST, port=CHROMA_PORT)
    #   vector_store = Chroma(
    #       client=client,
    #       collection_name=collection_name,
    #       embedding_function=embeddings,
    #   )
    #
    # For local/persistent usage the default below is sufficient.
    vector_store = Chroma.from_documents(
        documents=docs,
        embedding=embeddings,
        collection_name=collection_name,
        persist_directory=CHROMA_PERSIST_DIR,
    )

    # TODO: ChromaDB auto-persists when persist_directory is set, but call
    # vector_store.persist() explicitly here if using an older Chroma version.

    return len(docs)
