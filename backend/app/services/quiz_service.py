"""Quiz and knowledge-gap service.

Detects knowledge gaps from a chat session and generates AI-powered micro-quizzes
targeting those gaps. Also provides read helpers for the student quiz feed.
"""
import re
import uuid
from datetime import datetime, timezone
from collections.abc import AsyncIterator
from typing import Any

from sqlalchemy.orm import Session
from sqlalchemy.orm import selectinload

from app.core.ai_client import ai_post
from app.services import chat_log_io
from app.db.models.chat_history import ChatHistory
from app.db.models.knowledge_gap import KnowledgeGap
from app.db.models.micro_quiz import MicroQuiz
from app.db.models.notification import Notification
from app.db.models.submission import Submission
from app.db.models.quiz_question import QuizQuestion
from app.db.models.subject import Subject
from app.db.models.user import User
from app.schemas.quiz import MicroQuizSchema
from app.shared.source_enum import MicroQuizStatus, NotificationChannel, NotificationType, QuestionDifficulty, QuestionType

# Minimum score (%) to mark a linked knowledge gap as resolved
GAP_RESOLVE_MIN_SCORE_PCT = 60.0
# Retries when streaming generation returns a duplicate of an earlier question
_MAX_UNIQUE_ATTEMPTS_PER_SLOT = 12


# Private helpers

def _read_chat_log(file_path: str) -> str:
    """Read chat log as plain text (JSON transcripts are converted)."""
    return chat_log_io.read_as_plain_text(file_path)


def _get_subject_name(db: Session, subject_id: int) -> str:
    """Return the subject name for the given subject ID, or 'Unknown'."""
    subject = db.query(Subject).filter(Subject.subject_id == subject_id).first()
    return subject.subject_name if subject else "Unknown"


def _slug_topic_tag(raw: str, max_len: int = 100) -> str:
    """Normalize AI or human labels to a stable snake_case topic_tag."""
    s = re.sub(r"[^a-zA-Z0-9]+", "_", raw.strip().lower())
    s = re.sub(r"_+", "_", s).strip("_")
    return (s[:max_len] if s else "gap")[:max_len]


def _upsert_knowledge_gap(
    db: Session,
    student_id: uuid.UUID,
    subject_id: int,
    history_id: uuid.UUID,
    gap: dict[str, Any],
) -> KnowledgeGap:
    """Insert a new KnowledgeGap or increment its recurrence counter."""
    now = datetime.now(timezone.utc)
    existing = db.query(KnowledgeGap).filter(
        KnowledgeGap.student_id == student_id,
        KnowledgeGap.topic_tag == gap["topic_tag"],
    ).first()
    if existing:
        existing.recurrence_count = min(32767, int(existing.recurrence_count) + 1)
        existing.history_id = history_id
        existing.detected_at = now
        existing.is_resolved = False
        existing.concept_name = gap["concept_name"]
        return existing
    row = KnowledgeGap(
        student_id=student_id,
        subject_id=subject_id,
        history_id=history_id,
        concept_name=gap["concept_name"],
        topic_tag=gap["topic_tag"],
        recurrence_count=1,
        is_resolved=False,
    )
    db.add(row)
    db.flush()
    return row


def upsert_gap_from_grading(
    db: Session,
    sub: Submission,
    result: dict[str, Any],
) -> KnowledgeGap | None:
    """Create or update a KnowledgeGap when grading marks ``knowledge_gap_detected``."""
    if not result.get("knowledge_gap_detected"):
        return None
    raw_concept = (
        result.get("gap_concept")
        or result.get("failed_at_step")
        or "Review needed"
    )
    concept_name = str(raw_concept).strip()[:255] or "Review needed"
    raw_tag = result.get("gap_topic_tag")
    if raw_tag:
        topic_tag = _slug_topic_tag(str(raw_tag))
    else:
        topic_tag = _slug_topic_tag(f"grading_{concept_name}")

    now = datetime.now(timezone.utc)
    existing = db.query(KnowledgeGap).filter(
        KnowledgeGap.student_id == sub.student_id,
        KnowledgeGap.topic_tag == topic_tag,
    ).first()
    if existing:
        existing.recurrence_count = min(32767, int(existing.recurrence_count) + 1)
        existing.submission_id = sub.submission_id
        existing.detected_at = now
        existing.is_resolved = False
        existing.concept_name = concept_name
        return existing
    row = KnowledgeGap(
        student_id=sub.student_id,
        subject_id=sub.subject_id,
        submission_id=sub.submission_id,
        concept_name=concept_name,
        topic_tag=topic_tag,
        recurrence_count=1,
        is_resolved=False,
    )
    db.add(row)
    db.flush()
    return row


def _has_open_quiz_for_gap(db: Session, gap_id: uuid.UUID) -> bool:
    """True when an assigned or in-progress micro-quiz already targets this gap."""
    q = (
        db.query(MicroQuiz)
        .filter(
            MicroQuiz.gap_id == gap_id,
            MicroQuiz.status.in_([MicroQuizStatus.ASSIGNED, MicroQuizStatus.IN_PROGRESS]),
        )
        .first()
    )
    return q is not None


async def generate_quiz_if_eligible(
    db: Session,
    gap: KnowledgeGap,
) -> MicroQuiz | None:
    """Generate a micro-quiz for ``gap`` unless one is already open for that gap."""
    if _has_open_quiz_for_gap(db, gap.gap_id):
        return None
    return await generate_and_save_quiz(
        db,
        gap.student_id,
        gap.subject_id,
        gap.concept_name,
        num_questions=5,
        gap_id=gap.gap_id,
    )


def _parse_question_type(raw: str) -> QuestionType:
    """Return a QuestionType enum from the AI response string, defaulting to MCQ."""
    try:
        return QuestionType(raw.lower())
    except ValueError:
        return QuestionType.MCQ


def _parse_difficulty(raw: str) -> QuestionDifficulty:
    """Return a QuestionDifficulty enum from the AI response string, defaulting to MEDIUM."""
    try:
        return QuestionDifficulty(raw.upper())
    except ValueError:
        return QuestionDifficulty.MEDIUM


def _question_signature(q: dict[str, Any]) -> str:
    text = (q.get("question_text") or "").strip().lower()
    return re.sub(r"\s+", " ", text)


_QUIZ_STOP = frozenset(
    "a an the in on at to for of and or as by is are was were be been being "
    "it its this that these those with from than then into about which what "
    "when where who how why can could should would will shall may might must "
    "do does did done doing have has had having not no yes if so such".split()
)
_DIAGRAM_DOMAIN = frozenset(
    "flowchart flowcharts diagram diagrams chart charts symbol symbols shape shapes "
    "terminator terminators oval ovals diamond diamonds rectangle rectangles "
    "parallelogram parallelograms process processes decision input output data "
    "indicates indicate indicating represents represent representing typical "
    "standard shows showing used use denotes denote designated designation "
    "program procedure step steps control termination initiation".split()
)


def _quiz_tokens(text: str) -> set[str]:
    return {
        w
        for w in re.findall(r"[a-z0-9]+", text.lower())
        if len(w) > 2 and w not in _QUIZ_STOP
    }


def _quiz_questions_similar(a: str, b: str) -> bool:
    """Near-duplicate stems (paraphrases / same fact), aligned with AI-service diversity checks."""
    if not (a and b):
        return False
    na = re.sub(r"\s+", " ", a.strip().lower())
    nb = re.sub(r"\s+", " ", b.strip().lower())
    if na == nb:
        return True
    if len(na) > 30 and (na in nb or nb in na):
        return True
    ta, tb = _quiz_tokens(a), _quiz_tokens(b)
    if not ta or not tb:
        return False
    union = len(ta | tb)
    jaccard = len(ta & tb) / union if union else 0.0
    if jaccard >= 0.34:
        return True
    if len(ta & tb & _DIAGRAM_DOMAIN) >= 3 and jaccard >= 0.22:
        return True
    return False


def _dedupe_questions(questions: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """Drop duplicate or near-duplicate questions, preserving order."""
    seen: set[str] = set()
    out: list[dict[str, Any]] = []
    for q in questions:
        sig = _question_signature(q)
        text = q.get("question_text") or ""
        if sig and sig in seen:
            continue
        if any(_quiz_questions_similar(text, (o.get("question_text") or "")) for o in out):
            continue
        if sig:
            seen.add(sig)
        out.append(q)
    return out


def _create_quiz_questions(db: Session, quiz_id: uuid.UUID, questions: list[dict]) -> None:
    """Persist QuizQuestion rows for all questions in the AI response."""
    for i, q in enumerate(questions):
        db.add(QuizQuestion(
            quiz_id=quiz_id,
            question_text=q["question_text"],
            question_type=_parse_question_type(q["question_type"]),
            options=q.get("options"),
            correct_answer=q["correct_answer"],
            explanation=q.get("explanation"),
            difficulty=_parse_difficulty(q["difficulty"]),
            order_num=i + 1,
        ))


def _notify_quiz_assigned(
    db: Session,
    student_id: uuid.UUID,
    concept: str,
    num_questions: int,
    quiz_id: uuid.UUID,
) -> None:
    """Create an in-app QUIZ_ASSIGNED notification for the student."""
    db.add(Notification(
        recipient_id=student_id,
        type=NotificationType.QUIZ_ASSIGNED,
        title="New Quiz Ready",
        body=f"Your AI quiz on \"{concept}\" is ready — {num_questions} question{'s' if num_questions != 1 else ''} waiting for you.",
        channel=NotificationChannel.IN_APP,
        related_resource_id=str(quiz_id),
    ))


# Public API

async def detect_gaps_for_quiz(db: Session, history_id: uuid.UUID) -> dict[str, Any]:
    """Detect knowledge gaps from a chat session and persist them for quiz targeting.

    Steps:
    1. Fetch the ChatHistory record and read the log from disk.
    2. Call the AI service to detect gaps.
    3. Upsert KnowledgeGap rows for each returned gap.
    """
    chat = db.query(ChatHistory).filter(ChatHistory.history_id == history_id).first()
    if not chat:
        raise ValueError(f"Chat history {history_id} not found")
    chat_log = _read_chat_log(chat.file_path)
    subject_name = _get_subject_name(db, chat.subject_id)
    gaps_result = await ai_post(
        "/quiz/detect-gaps",
        {
            "student_id": str(chat.student_id),
            "subject": subject_name,
            "chat_log": chat_log,
        },
    )
    saved: list[KnowledgeGap] = []
    for gap in gaps_result.get("gaps", []):
        saved.append(
            _upsert_knowledge_gap(db, chat.student_id, chat.subject_id, chat.history_id, gap)
        )
    db.commit()
    for row in saved:
        db.refresh(row)
        await generate_quiz_if_eligible(db, row)
    return gaps_result


async def stream_generate_quiz_events(
    db: Session,
    student_id: uuid.UUID,
    subject_id: int,
    concept: str,
    num_questions: int = 5,
    gap_id: uuid.UUID | None = None,
) -> AsyncIterator[dict[str, Any]]:
    """Call AI once per question so clients can show incremental progress, then persist one quiz."""
    student = db.query(User).filter(User.user_id == student_id).first()
    if not student:
        raise ValueError(f"Student {student_id} not found")
    grade_id = student.grade_id if hasattr(student, "grade_id") else None

    collected: list[dict[str, Any]] = []
    seen_sigs: set[str] = set()
    for step in range(num_questions):
        q: dict[str, Any] | None = None
        for _attempt in range(_MAX_UNIQUE_ATTEMPTS_PER_SLOT):
            avoid_texts = [str(c.get("question_text") or "") for c in collected if c.get("question_text")]
            quiz_data = await ai_post(
                "/quiz/generate",
                {
                    "concept": concept,
                    "num_questions": 1,
                    "user_type": "student",
                    "student_id": str(student_id),
                    "grade": grade_id,
                    "avoid_question_texts": avoid_texts,
                },
                long=True,
            )
            batch = quiz_data.get("questions") or []
            if not batch:
                continue
            cand = batch[0]
            ct = str(cand.get("question_text") or "")
            if collected and any(
                _quiz_questions_similar(ct, str(p.get("question_text") or "")) for p in collected
            ):
                continue
            sig = _question_signature(cand)
            if sig and sig in seen_sigs:
                continue
            if sig:
                seen_sigs.add(sig)
            q = cand
            break
        if q is None:
            raise ValueError("AI returned only duplicate or empty questions for this step")
        collected.append(q)
        yield {"type": "question", "index": step + 1, "total": num_questions, "question": q}

    collected = _dedupe_questions(collected)
    if not collected:
        raise ValueError("All generated questions were duplicates; try again")

    new_quiz = MicroQuiz(
        student_id=student_id,
        subject_id=subject_id,
        gap_id=gap_id,
        concept_targeted=concept,
        total_questions=len(collected),
        status=MicroQuizStatus.ASSIGNED,
    )
    db.add(new_quiz)
    db.flush()
    _create_quiz_questions(db, new_quiz.quiz_id, collected)
    db.commit()
    db.refresh(new_quiz)

    _notify_quiz_assigned(db, student_id, concept, len(collected), new_quiz.quiz_id)
    db.commit()

    full = get_quiz_detail(db, student_id, new_quiz.quiz_id)
    if full and full.questions:
        full.questions.sort(key=lambda x: x.order_num)

    payload = MicroQuizSchema.model_validate(full).model_dump(mode="json")
    yield {"type": "complete", "quiz": payload}


async def generate_and_save_quiz(
    db: Session,
    student_id: uuid.UUID,
    subject_id: int,
    concept: str,
    num_questions: int = 5,
    gap_id: uuid.UUID | None = None,
) -> MicroQuiz:
    """Generate an AI micro-quiz for a concept and persist it with its questions.

    Steps:
    1. Fetch the student record for grade context.
    2. Call the AI service to generate the quiz (long timeout).
    3. Persist the MicroQuiz header and QuizQuestion rows.
    """
    student = db.query(User).filter(User.user_id == student_id).first()
    if not student:
        raise ValueError(f"Student {student_id} not found")
    grade_id = student.grade_id if hasattr(student, "grade_id") else None
    quiz_data = await ai_post(
        "/quiz/generate",
        {
            "concept": concept,
            "num_questions": num_questions,
            "user_type": "student",
            "student_id": str(student_id),
            "grade": grade_id,
        },
        long=True,
    )
    uniq_questions = _dedupe_questions(quiz_data.get("questions") or [])
    if not uniq_questions:
        raise ValueError("Quiz generation produced no unique questions")
    new_quiz = MicroQuiz(
        student_id=student_id,
        subject_id=subject_id,
        gap_id=gap_id,
        concept_targeted=concept,
        total_questions=len(uniq_questions),
        status=MicroQuizStatus.ASSIGNED,
    )
    db.add(new_quiz)
    db.flush()
    _create_quiz_questions(db, new_quiz.quiz_id, uniq_questions)
    _notify_quiz_assigned(db, student_id, concept, len(uniq_questions), new_quiz.quiz_id)
    db.commit()
    db.refresh(new_quiz)
    return new_quiz


def get_quizzes_for_student(
    db: Session,
    student_id: uuid.UUID,
    subject_id: int | None = None,
    page: int = 1,
    per_page: int = 20,
) -> tuple[list[MicroQuiz], int]:
    """Return a paginated list of micro-quizzes for a student."""
    query = db.query(MicroQuiz).filter(MicroQuiz.student_id == student_id)
    if subject_id:
        query = query.filter(MicroQuiz.subject_id == subject_id)
    total = query.count()
    quizzes = query.order_by(MicroQuiz.created_at.desc()).offset((page - 1) * per_page).limit(per_page).all()
    return quizzes, total


def get_quiz_detail(db: Session, student_id: uuid.UUID, quiz_id: uuid.UUID) -> MicroQuiz | None:
    """Return the MicroQuiz row for a specific student and quiz ID, or None."""
    return (
        db.query(MicroQuiz)
        .options(selectinload(MicroQuiz.questions))
        .filter(
            MicroQuiz.quiz_id == quiz_id,
            MicroQuiz.student_id == student_id,
        )
        .first()
    )


def _option_text_at(options: Any, idx: int) -> str | None:
    if options is None or idx < 0:
        return None
    if not isinstance(options, list) or idx >= len(options):
        return None
    raw = options[idx]
    if isinstance(raw, str):
        return raw
    if isinstance(raw, dict) and "text" in raw:
        return str(raw["text"])
    return str(raw)


def _normalize_mc_text(s: str) -> str:
    """Loose match for correct option vs stored answer (whitespace / case)."""
    return re.sub(r"\s+", " ", (s or "").strip().lower())


def _find_gap_for_resolution(db: Session, student_id: uuid.UUID, quiz: MicroQuiz) -> KnowledgeGap | None:
    """Use quiz.gap_id if set; otherwise the newest open gap for this subject + same concept name."""
    if quiz.gap_id:
        return (
            db.query(KnowledgeGap)
            .filter(
                KnowledgeGap.gap_id == quiz.gap_id,
                KnowledgeGap.student_id == student_id,
            )
            .first()
        )
    target = _normalize_mc_text(quiz.concept_targeted or "")
    if not target:
        return None
    rows = (
        db.query(KnowledgeGap)
        .filter(
            KnowledgeGap.student_id == student_id,
            KnowledgeGap.subject_id == quiz.subject_id,
            KnowledgeGap.is_resolved == False,
        )
        .order_by(KnowledgeGap.detected_at.desc())
        .all()
    )
    for g in rows:
        if _normalize_mc_text(g.concept_name or "") == target:
            return g
    for g in rows:
        cn = _normalize_mc_text(g.concept_name or "")
        if not cn:
            continue
        if target in cn or cn in target:
            if min(len(target), len(cn)) >= 8:
                return g
    return None


def _apply_micro_quiz_gap_resolution(
    db: Session,
    student_id: uuid.UUID,
    quiz: MicroQuiz,
    score_pct: float,
) -> bool:
    """Link quiz to a matching gap when missing, mark gap resolved when score meets threshold."""
    if score_pct < GAP_RESOLVE_MIN_SCORE_PCT:
        return False
    gap = _find_gap_for_resolution(db, student_id, quiz)
    if not gap:
        return False
    if quiz.gap_id is None:
        quiz.gap_id = gap.gap_id
    if gap.is_resolved:
        return True
    gap.is_resolved = True
    return True


def submit_micro_quiz_answers(
    db: Session,
    student_id: uuid.UUID,
    quiz_id: uuid.UUID,
    selected_indices: list[int | None],
) -> dict[str, Any]:
    """Score answers from DB, mark quiz complete, and resolve the linked gap when score is high enough."""
    quiz = get_quiz_detail(db, student_id, quiz_id)
    if not quiz:
        raise ValueError("Quiz not found")

    questions = sorted(quiz.questions, key=lambda x: x.order_num)
    n = len(questions)
    if n == 0:
        raise ValueError("Quiz has no questions")

    if len(selected_indices) != n:
        raise ValueError(f"Expected {n} answers, got {len(selected_indices)}")

    if quiz.status == MicroQuizStatus.COMPLETED and quiz.score_percentage is not None:
        # Retry: re-score from submitted answers and update the stored result.
        correct = 0
        for q, idx in zip(questions, selected_indices, strict=True):
            if idx is None:
                continue
            picked = _option_text_at(q.options, idx)
            ca = str(q.correct_answer or "")
            if picked is not None and _normalize_mc_text(str(picked)) == _normalize_mc_text(ca):
                correct += 1

        pct = (correct / n) * 100.0 if n else 0.0
        quiz.score_percentage = round(pct, 2)
        quiz.completed_at = datetime.now(timezone.utc)

        knowledge_gap_resolved = _apply_micro_quiz_gap_resolution(db, student_id, quiz, pct)

        db.commit()
        db.refresh(quiz)
        return {
            "quiz": quiz,
            "correct_count": correct,
            "total_questions": n,
            "knowledge_gap_resolved": knowledge_gap_resolved,
        }

    correct = 0
    for q, idx in zip(questions, selected_indices, strict=True):
        if idx is None:
            continue
        picked = _option_text_at(q.options, idx)
        ca = str(q.correct_answer or "")
        if picked is not None and _normalize_mc_text(str(picked)) == _normalize_mc_text(ca):
            correct += 1

    pct = (correct / n) * 100.0 if n else 0.0
    quiz.score_percentage = round(pct, 2)
    quiz.status = MicroQuizStatus.COMPLETED
    quiz.completed_at = datetime.now(timezone.utc)

    knowledge_gap_resolved = _apply_micro_quiz_gap_resolution(db, student_id, quiz, pct)

    db.commit()
    db.refresh(quiz)
    return {
        "quiz": quiz,
        "correct_count": correct,
        "total_questions": n,
        "knowledge_gap_resolved": knowledge_gap_resolved,
    }
