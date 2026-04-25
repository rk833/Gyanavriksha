"""
RAG Document Preprocessor package.

Quick start
-----------
from document_preprocessor import DocumentPreprocessor, PreprocessingConfig

config = PreprocessingConfig(chunk_size=400, chunk_overlap=40)
preprocessor = DocumentPreprocessor(config)
chunks = preprocessor.process("my_file.pdf")
"""

from .document_preprocessor import (
    DocumentChunk,
    DocumentPreprocessor,
    PreprocessingConfig,
)

__all__ = [
    "DocumentChunk",
    "DocumentPreprocessor",
    "PreprocessingConfig",
]