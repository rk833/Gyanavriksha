import json
import logging
import re
from typing import Any, List, Optional

from langchain_core.prompts import ChatPromptTemplate
from langchain_core.output_parsers import StrOutputParser
from langchain_google_vertexai import ChatVertexAI
from pydantic import BaseModel, Field, ValidationError

from app.core.google_auth import configure_google_credentials
from app.rag.rag_service import RAGService, QueryRequest

logger = logging.getLogger(__name__)

# Common English stopwords for rough duplicate detection (Jaccard on content words)
_STOP = frozenset(
    "a an the in on at to for of and or as by is are was were be been being "
    "it its this that these those with from than then into about which what "
    "when where who how why can could should would will shall may might must "
    "do does did done doing have has had having not no yes if so such".split()
)

# Words often shared by superficially different flowchart questions — tighten similarity when many overlap
_DIAGRAM_DOMAIN = frozenset(
    "flowchart flowcharts diagram diagrams chart charts symbol symbols shape shapes "
    "terminator terminators oval ovals diamond diamonds rectangle rectangles "
    "parallelogram parallelograms process processes decision input output data "
    "indicates indicate indicating represents represent representing typical "
    "standard shows showing used use denotes denote designated designation "
    "program procedure step steps control termination initiation ".split()
)


def _content_tokens(text: str) -> set[str]:
    return {
        w
        for w in re.findall(r"[a-z0-9]+", text.lower())
        if len(w) > 2 and w not in _STOP
    }


def questions_similar(a: str, b: str) -> bool:
    """True when two stems target the same learned fact (including light paraphrases)."""
    if not (a and b):
        return False
    na = re.sub(r"\s+", " ", a.strip().lower())
    nb = re.sub(r"\s+", " ", b.strip().lower())
    if na == nb:
        return True
    if len(na) > 30 and (na in nb or nb in na):
        return True
    ta, tb = _content_tokens(a), _content_tokens(b)
    if not ta or not tb:
        return False
    inter = len(ta & tb)
    union = len(ta | tb)
    jaccard = inter / union if union else 0.0
    if jaccard >= 0.34:
        return True
    shared_diag = ta & tb & _DIAGRAM_DOMAIN
    if len(shared_diag) >= 3 and jaccard >= 0.22:
        return True
    return False


def _format_anti_repeat(existing: list[str]) -> str:
    if not existing:
        return (
            "Each question must test a different sub-concept, rule, or skill within the topic. "
            "Never ask the same knowledge twice using different wording."
        )
    lines = "\n".join(f"  — {t[:480]}" for t in existing if t.strip())
    return (
        "Already-used question stems (do NOT repeat or lightly paraphrase these; pick different facts):\n"
        f"{lines}\n"
        "Every new question must cover a distinct aspect that is not covered above."
    )


class GeneratedQuestion(BaseModel):
    question_text: str = Field(description="The text of the question")
    question_type: str = Field(description="The type of the question (mcq, short_answer)")
    options: Optional[List[str]] = Field(default=None, description="List of options for MCQ questions")
    correct_answer: str = Field(description="The correct answer text")
    explanation: Optional[str] = Field(default=None, description="Explanation for the correct answer")
    difficulty: str = Field(description="Difficulty level (EASY, MEDIUM, HARD)")


class GeneratedQuiz(BaseModel):
    concept_targeted: str
    questions: List[GeneratedQuestion]


def _strip_json_from_llm(text: str) -> str:
    """Gemini often wraps JSON in markdown fences; extract the payload."""
    text = text.strip()
    if "```" in text:
        m = re.search(r"```(?:json)?\s*([\s\S]*?)\s*```", text)
        if m:
            return m.group(1).strip()
    return text


def _coerce_questions_list(data: Any) -> list:
    """Normalize LLM output to a list of question dicts."""
    if data is None:
        return []
    if isinstance(data, list):
        return data
    if isinstance(data, dict):
        if "questions" in data and isinstance(data["questions"], list):
            return data["questions"]
        # Single question object mistaken for wrapper
        if "question_text" in data:
            return [data]
    raise ValueError("Expected a JSON array of questions or an object with a 'questions' array")


class QuizGeneratorService:
    def __init__(self):
        configure_google_credentials()
        self.llm = ChatVertexAI(model_name="gemini-2.5-flash", temperature=0.3)
        self.rag_service = RAGService()
        self.str_parser = StrOutputParser()

        # NOTE: ChatPromptTemplate treats single {...} as variables — only {context} is a variable here.
        # Do not put raw JSON braces in this string unless doubled as {{ and }}.
        system_prompt = (
            "You are an expert educator and assessment designer. Generate quiz questions from the context. "
            "Reply with ONLY valid JSON — no markdown fences, no commentary before or after the JSON.\n\n"
            "Output format: a JSON array of objects. Each object must have these keys:\n"
            "question_text (string), question_type (mcq or short_answer), "
            "options (array of exactly four strings for mcq; omit or null for short_answer), "
            "correct_answer (must match one option for mcq), explanation (string), "
            "difficulty (EASY, MEDIUM, or HARD).\n\n"
            "Diversity rules:\n"
            "— Each question must assess a different fact, procedure, or error pattern.\n"
            "— Do not ask the same idea twice with different phrasing (e.g. two questions both asking which "
            "flowchart symbol means start/end).\n"
            "— Vary what you test (definitions, common mistakes, use cases, comparisons to related ideas).\n\n"
            "Context for grounding:\n{context}"
        )

        self.prompt = ChatPromptTemplate.from_messages(
            [
                ("system", system_prompt),
                (
                    "human",
                    "Generate exactly {num_questions} questions for the concept \"{concept}\". "
                    "The JSON array length must be exactly {num_questions}.\n\n"
                    "{anti_repeat}",
                ),
            ]
        )

    def _parse_questions_json(self, raw: str, num_expected: int) -> List[GeneratedQuestion]:
        cleaned = _strip_json_from_llm(raw)
        try:
            data = json.loads(cleaned)
        except json.JSONDecodeError as e:
            logger.warning("Quiz JSON decode failed; snippet=%r", cleaned[:500])
            raise ValueError(f"Model did not return valid JSON: {e}") from e

        items = _coerce_questions_list(data)
        if len(items) > num_expected:
            logger.warning("Trimming questions from %s to %s", len(items), num_expected)
            items = items[:num_expected]

        out: list[GeneratedQuestion] = []
        for i, item in enumerate(items):
            if not isinstance(item, dict):
                raise ValueError(f"Question {i} is not an object")
            try:
                out.append(GeneratedQuestion(**item))
            except ValidationError as ve:
                raise ValueError(f"Invalid question schema at index {i}: {ve}") from ve

        if len(out) < num_expected:
            raise ValueError(f"Got {len(out)} valid questions, need {num_expected}")
        return out

    async def generate_quiz(
        self,
        concept: str,
        num_questions: int = 5,
        user_type: str = "admin",
        grade: Optional[int] = None,
        instructor_id: Optional[str] = None,
        class_id: Optional[str] = None,
        student_id: Optional[str] = None,
        avoid_question_texts: Optional[list[str]] = None,
    ) -> GeneratedQuiz:
        """
        Generates a quiz by first retrieving relevant context via RAG and then using LLM to generate questions.
        Re-queries the model if outputs are too similar, and honours ``avoid_question_texts`` for streaming callers.
        """
        query_request = QueryRequest(
            user_type=user_type,
            query=f"Comprehensive information about {concept}",
            grade=grade,
            instructor_id=instructor_id,
            class_id=class_id,
            student_id=student_id,
        )

        context_text = ""
        try:
            rag_response = self.rag_service.query(query_request)
            context_text = "\n\n".join(
                [src.get("text", "") for src in rag_response.get("context_sources", [])]
            )
        except Exception as rag_exc:
            logger.warning("RAG query failed for quiz generation, using fallback context: %s", rag_exc)

        if not context_text.strip():
            context_text = (
                f"No curriculum chunks were retrieved for this learner. "
                f"Generate {num_questions} accurate multiple-choice questions about: {concept}. "
                "Use standard secondary-level knowledge."
            )

        avoid_list = [t.strip() for t in (avoid_question_texts or []) if t and t.strip()]
        chain = self.prompt | self.llm | self.str_parser
        accumulated: list[GeneratedQuestion] = []
        max_rounds = 8

        while len(accumulated) < num_questions and max_rounds > 0:
            max_rounds -= 1
            need = num_questions - len(accumulated)
            if need < 1:
                break
            raw_output = await chain.ainvoke(
                {
                    "num_questions": need,
                    "concept": concept,
                    "context": context_text,
                    "anti_repeat": _format_anti_repeat(avoid_list),
                }
            )
            try:
                batch = self._parse_questions_json(raw_output, need)
            except ValueError as exc:
                logger.warning("Quiz parse failed in refill round: %s", exc)
                continue

            for q in batch:
                if len(accumulated) >= num_questions:
                    break
                if any(questions_similar(q.question_text, x.question_text) for x in accumulated):
                    continue
                if any(questions_similar(q.question_text, x) for x in avoid_list):
                    continue
                accumulated.append(q)
                avoid_list.append(q.question_text)

        if len(accumulated) < num_questions:
            raise ValueError(
                f"Could not produce {num_questions} sufficiently diverse questions (got {len(accumulated)}). "
                "Try again or narrow the concept."
            )
        return GeneratedQuiz(concept_targeted=concept, questions=accumulated[:num_questions])
