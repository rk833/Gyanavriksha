"""
chain.py
========
Constructs the LangChain RAG chain that evaluates a student's answer against
retrieved curriculum content, powered by Google Generative AI (Gemini).

Requirement covered:
    E2-01 - LangChain orchestrates RAG queries against the ChromaDB vector store.
"""

import os
from typing import TypedDict

from langchain_google_genai import ChatGoogleGenerativeAI
from langchain.prompts import ChatPromptTemplate
from langchain_core.output_parsers import StrOutputParser
from langchain_core.runnables import RunnablePassthrough, RunnableParallel
from langchain.schema import Document

from .retriever import get_retriever


# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------

# TODO: Load GOOGLE_API_KEY from your environment / secrets manager.
GOOGLE_API_KEY: str = os.environ.get("GOOGLE_API_KEY", "")

# Gemini model to use for answer evaluation.
# Swap to "gemini-1.5-pro" for higher reasoning quality at higher cost.
GENERATIVE_MODEL: str = "gemini-1.5-flash"


# ---------------------------------------------------------------------------
# Prompt template
# ---------------------------------------------------------------------------

_EVALUATION_PROMPT = ChatPromptTemplate.from_messages([
    (
        "system",
        (
            "You are an expert educational assessor. "
            "Your job is to evaluate a student's answer strictly against the "
            "official curriculum content provided below.\n\n"
            "Curriculum context (retrieved from the course materials):\n"
            "{context}\n\n"
            "Guidelines:\n"
            "- Be fair, constructive, and specific.\n"
            "- Reference exact concepts from the curriculum when giving feedback.\n"
            "- Return a score from 0 to 10 with a brief justification.\n"
            "- If the curriculum context is insufficient to evaluate the answer, "
            "  state that clearly rather than guessing."
        ),
    ),
    (
        "human",
        (
            "Question: {question}\n\n"
            "Student's answer: {student_answer}\n\n"
            "Please evaluate the student's answer."
        ),
    ),
])


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _format_docs(docs: list[Document]) -> str:
    """Concatenate retrieved document chunks into a single context string."""
    return "\n\n---\n\n".join(
        f"[Source: {doc.metadata.get('source_file', 'unknown')}, "
        f"Page: {doc.metadata.get('page', '?')}]\n{doc.page_content}"
        for doc in docs
    )


def _get_llm() -> ChatGoogleGenerativeAI:
    """Initialise and return the Google Generative AI chat model."""
    if not GOOGLE_API_KEY:
        raise ValueError(
            "GOOGLE_API_KEY environment variable is not set. "
            "Obtain a key from https://aistudio.google.com/ and export it."
        )
    return ChatGoogleGenerativeAI(
        model=GENERATIVE_MODEL,
        google_api_key=GOOGLE_API_KEY,
        temperature=0.2,   # Low temperature for consistent, factual evaluation.
        convert_system_message_to_human=True,  # Required for Gemini models.
    )


# ---------------------------------------------------------------------------
# Chain factory (E2-01)
# ---------------------------------------------------------------------------

def build_rag_chain(grade: str, subject: str):
    """
    Build a LangChain LCEL (LangChain Expression Language) RAG chain scoped
    to the ChromaDB namespace for *grade* and *subject* (E2-01, E2-02).

    The chain:
        1. Receives {question, student_answer}.
        2. Retrieves relevant curriculum chunks from ChromaDB.
        3. Formats the chunks as context.
        4. Calls Gemini to produce a scored evaluation with justification.

    Args:
        grade:   Student's enrolled grade (e.g. "7").
        subject: Student's enrolled subject (e.g. "mathematics").

    Returns:
        A LangChain Runnable that accepts a dict with keys
        ``question`` and ``student_answer`` and returns an evaluation string.

    Example::

        chain = build_rag_chain(grade="7", subject="mathematics")
        result = chain.invoke({
            "question": "Explain the Pythagorean theorem.",
            "student_answer": "a² + b² = c², where c is the hypotenuse.",
        })
        print(result)
    """
    # TODO: Fetch the student's grade/subject from PostgreSQL before calling
    # this function if they are not already available in the request context.
    # Example:
    #   from db import get_student_enrollment
    #   enrollment = get_student_enrollment(student_id)
    #   chain = build_rag_chain(enrollment.grade, enrollment.subject)

    retriever = get_retriever(grade=grade, subject=subject)
    llm = _get_llm()

    # LCEL chain wiring (E2-01):
    #   - RunnableParallel keeps the original question/student_answer inputs
    #     alongside the retrieved context.
    #   - The prompt merges context + question + student_answer.
    #   - The LLM generates the evaluation.
    #   - StrOutputParser extracts the text response.
    chain = (
        RunnableParallel(
            {
                "context": (
                    # Extract the question to drive retrieval, then format docs.
                    (lambda inputs: inputs["question"])
                    | retriever
                    | _format_docs
                ),
                "question": RunnablePassthrough() | (lambda i: i["question"]),
                "student_answer": RunnablePassthrough() | (lambda i: i["student_answer"]),
            }
        )
        | _EVALUATION_PROMPT
        | llm
        | StrOutputParser()
    )

    return chain


# ---------------------------------------------------------------------------
# Convenience wrapper
# ---------------------------------------------------------------------------

class EvaluationResult(TypedDict):
    """Structured result returned by evaluate_student_answer."""
    grade: str
    subject: str
    question: str
    student_answer: str
    evaluation: str


def evaluate_student_answer(
    question: str,
    student_answer: str,
    grade: str,
    subject: str,
) -> EvaluationResult:
    """
    High-level function to evaluate a single student answer end-to-end.

    This is the primary entry point for the application layer (e.g. a FastAPI
    route or a Celery task) to call into the RAG pipeline.

    Args:
        question:       The exam/assignment question posed to the student.
        student_answer: The student's submitted answer text.
        grade:          Student's enrolled grade level.
        subject:        Student's enrolled subject.

    Returns:
        EvaluationResult: Dict containing all inputs plus the LLM evaluation.

    Example (FastAPI usage)::

        # TODO: Connect this to your existing PostgreSQL-backed student/
        # submission models.  Retrieve question text and student answer from
        # the DB, then call:
        result = evaluate_student_answer(
            question=submission.question_text,
            student_answer=submission.answer_text,
            grade=student.grade,
            subject=submission.subject,
        )
        # TODO: Persist result["evaluation"] back to PostgreSQL as feedback.
    """
    chain = build_rag_chain(grade=grade, subject=subject)
    evaluation: str = chain.invoke({
        "question": question,
        "student_answer": student_answer,
    })

    return EvaluationResult(
        grade=grade,
        subject=subject,
        question=question,
        student_answer=student_answer,
        evaluation=evaluation,
    )
