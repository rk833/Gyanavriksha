import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Loader2, Zap, ChevronLeft, CheckCircle, XCircle, Lightbulb, BookOpen, Timer, GraduationCap, ChevronRight, RefreshCw } from 'lucide-react';
import toast from 'react-hot-toast';
import useAuth from '../../hooks/useAuth';
import { getStudentQuizzes, getStudentQuiz, generateQuizStream, submitMicroQuiz } from '../../services/aiService';
import { getSubjects } from '../../services/studentService';

const OPTION_LABELS = ['A', 'B', 'C', 'D'];
const DEFAULT_NUM_QUESTIONS = 5;

function ProgressBar({ current, total, labelMode = 'quiz' }) {
  const pct =
    total <= 0
      ? 0
      : labelMode === 'generate'
        ? Math.round((current / total) * 100)
        : Math.round(((current - 1) / total) * 100);
  return (
    <div className="flex items-center gap-3">
      <span className="text-sm text-slate-500 shrink-0">
        {labelMode === 'generate' ? `Generated ${current} of ${total}` : `Question ${current} of ${total}`}
      </span>
      <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden">
        <div className="h-full bg-primary rounded-full transition-all" style={{ width: `${pct}%` }} />
      </div>
      <span className="text-sm font-semibold text-primary shrink-0">{pct}%</span>
    </div>
  );
}

function OptionButton({ label, text, selected, correct, incorrect, onSelect, disabled }) {
  let style = 'bg-white border border-primary-light text-primary-dark hover:border-primary hover:bg-primary-light/20';
  if (selected && !correct && !incorrect) style = 'bg-primary-dark text-white border-primary-dark';
  if (correct) style = 'bg-green-600 text-white border-green-600';
  if (incorrect) style = 'bg-red-500 text-white border-red-500';

  return (
    <button
      type="button"
      onClick={onSelect}
      disabled={disabled}
      className={`flex items-center gap-3 w-full rounded-xl px-4 py-3 text-left text-sm font-medium transition-colors ${style} disabled:cursor-default`}
    >
      <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${selected || correct || incorrect ? 'bg-white/20 text-inherit' : 'bg-primary-light text-primary'}`}>
        {label}
      </span>
      {text}
    </button>
  );
}

function QuizStats({ quiz }) {
  return (
    <div className="space-y-4">
      <div className="bg-white rounded-xl border border-primary-light p-4">
        <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-3">Quiz Statistics</p>
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <GraduationCap className="w-4 h-4 text-slate-400 shrink-0" />
            <div>
              <p className="text-[10px] text-slate-400 uppercase tracking-wider">Grade Level</p>
              <p className="text-sm font-semibold text-primary-dark">{quiz?.grade_label || 'Adaptive'}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Timer className="w-4 h-4 text-slate-400 shrink-0" />
            <div>
              <p className="text-[10px] text-slate-400 uppercase tracking-wider">Time Limit</p>
              <p className="text-sm font-semibold text-primary-dark">{quiz?.time_limit_minutes ? `${quiz.time_limit_minutes} Minutes` : '10 Minutes'}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Zap className="w-4 h-4 text-slate-400 shrink-0" />
            <div>
              <p className="text-[10px] text-slate-400 uppercase tracking-wider">Complexity</p>
              <p className="text-sm font-semibold text-primary-dark">{quiz?.difficulty || 'Adaptive Level 3'}</p>
            </div>
          </div>
        </div>
      </div>

      {quiz?.concept && (
        <div className="bg-white rounded-xl border border-primary-light p-4">
          <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-2">Targeting Knowledge Gap</p>
          <p className="text-sm text-primary-dark leading-relaxed">{quiz.concept}</p>
        </div>
      )}

      <div className="bg-primary-dark rounded-xl p-4 text-white">
        <Lightbulb className="w-4 h-4 text-primary-light mb-2" />
        <p className="text-xs font-semibold mb-1">Did you know?</p>
        <p className="text-xs text-white/70 leading-relaxed">
          {quiz?.did_you_know || 'Adaptive quizzes automatically adjust the difficulty to match your current understanding level, helping you progress faster.'}
        </p>
      </div>
    </div>
  );
}

function questionKey(q) {
  const t = (q?.question_text || q?.question || '').trim().toLowerCase();
  return t.replace(/\s+/g, ' ');
}

function dedupeQuestionsByText(list) {
  const seen = new Set();
  return list.filter((q) => {
    const k = questionKey(q);
    if (!k) return true;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

function ResultScreen({ score, total, concept, onRetry, onDone, knowledgeGapResolved, submitSyncFailed, hadServerSubmit }) {
  const pct = total > 0 ? Math.round((score / total) * 100) : 0;
  const passed = pct >= 60;
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div className={`w-20 h-20 rounded-full flex items-center justify-center mb-4 ${passed ? 'bg-green-100' : 'bg-red-100'}`}>
        {passed
          ? <CheckCircle className="w-10 h-10 text-green-600" />
          : <XCircle className="w-10 h-10 text-red-500" />}
      </div>
      <h2 className="text-2xl font-bold text-primary-dark mb-1">
        {passed ? 'Quiz Completed!' : 'Keep Practising'}
      </h2>
      <p className="text-slate-500 text-sm mb-4">
        You scored <span className="font-bold text-primary-dark">{score}/{total}</span> ({pct}%)
        {concept && <> on <span className="italic">{concept}</span></>}
      </p>
      {passed ? (
        <>
          {submitSyncFailed ? (
            <p className="text-amber-800 text-sm bg-amber-50 rounded-xl px-4 py-2 mb-6 max-w-md">
              We could not save your result to the server. Your score above reflects this attempt; try again later or return from Knowledge Gaps.
            </p>
          ) : hadServerSubmit && knowledgeGapResolved ? (
            <p className="text-green-700 text-sm bg-green-50 rounded-xl px-4 py-2 mb-6">
              Great job! This knowledge gap is now marked as resolved.
            </p>
          ) : hadServerSubmit ? (
            <p className="text-slate-600 text-sm bg-slate-50 rounded-xl px-4 py-2 mb-6">
              Your score has been saved. Open Knowledge Gaps to see your updated progress.
            </p>
          ) : (
            <p className="text-slate-600 text-sm bg-slate-50 rounded-xl px-4 py-2 mb-6 max-w-md">
              Open a saved quiz from Knowledge Gaps so your score can be recorded and gaps can update.
            </p>
          )}
        </>
      ) : (
        <p className="text-amber-700 text-sm bg-amber-50 rounded-xl px-4 py-2 mb-6">
          Score 60% or above to resolve this knowledge gap.
        </p>
      )}
      <div className="flex gap-3">
        <button
          type="button"
          onClick={onRetry}
          className="px-5 py-2.5 border border-primary text-primary rounded-xl text-sm font-semibold hover:bg-primary-light transition-colors"
        >
          Retry Quiz
        </button>
        <button
          type="button"
          onClick={onDone}
          className="px-5 py-2.5 bg-primary-dark text-white rounded-xl text-sm font-semibold hover:bg-primary transition-colors"
        >
          Back to Knowledge Gaps
        </button>
      </div>
    </div>
  );
}

function normalizeAiQuestion(q) {
  const raw = q.options || [];
  const opts = raw.map((text) => ({
    text,
    is_correct: q.correct_answer != null && String(q.correct_answer).trim() === String(text).trim(),
  }));
  const ci = opts.findIndex((o) => o.is_correct);
  return {
    question_text: q.question_text,
    question: q.question_text,
    options: opts,
    correct_option_index: ci >= 0 ? ci : 0,
    explanation: q.explanation,
    difficulty: q.difficulty,
  };
}

function normalizeQuestionsFromApi(list) {
  if (!list?.length) return [];
  return list.map((q) => {
    const raw = q.options || [];
    const opts = raw.map((t) => {
      const text = typeof t === 'string' ? t : (t?.text ?? String(t));
      const ok = q.correct_answer != null && String(q.correct_answer).trim() === String(text).trim();
      return { text, is_correct: ok };
    });
    const ci = opts.findIndex((o) => o.is_correct);
    return {
      ...q,
      question_text: q.question_text,
      question: q.question_text,
      options: opts,
      correct_option_index: ci >= 0 ? ci : 0,
    };
  });
}

export default function MicroQuizPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user } = useAuth();

  const gapId = searchParams.get('gap_id');
  const conceptParam = searchParams.get('concept');
  const subjectIdParam = searchParams.get('subject_id');
  const quizIdParam = searchParams.get('quiz_id');

  const [quiz, setQuiz] = useState(null);
  const [questions, setQuestions] = useState([]);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [selected, setSelected] = useState(null);
  const [submitted, setSubmitted] = useState(false);
  const [score, setScore] = useState(0);
  const [done, setDone] = useState(false);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [genProgress, setGenProgress] = useState({ index: 0, total: DEFAULT_NUM_QUESTIONS });
  const [error, setError] = useState(null);
  const [subjectLabel, setSubjectLabel] = useState('');
  const [submitResult, setSubmitResult] = useState(null);
  const [submitError, setSubmitError] = useState(false);

  const streamRef = useRef(null);
  const answersRef = useRef([]);
  const finalizingRef = useRef(false);

  const loadQuiz = useCallback(async () => {
    if (!user?.user_id) return;
    setError(null);
    setCurrentIdx(0);
    setSelected(null);
    setSubmitted(false);
    setScore(0);
    setDone(false);
    setSubmitResult(null);
    setSubmitError(false);
    finalizingRef.current = false;

    try {
      let quizData;

      if (quizIdParam) {
        setLoading(true);
        const res = await getStudentQuiz(user.user_id, quizIdParam);
        quizData = res.data;
        const qs = dedupeQuestionsByText(normalizeQuestionsFromApi(quizData?.questions || []));
        setQuiz(quizData);
        setQuestions(qs);
        if (qs.length === 0) {
          setError('Quiz has no questions. Please try generating a new one.');
        }
      } else if (conceptParam && subjectIdParam) {
        setLoading(false);
        setGenerating(true);
        setGenProgress({ index: 0, total: DEFAULT_NUM_QUESTIONS });
        setQuestions([]);
        setQuiz({ concept: conceptParam, concept_targeted: conceptParam });

        const ac = new AbortController();
        streamRef.current = ac;

        const subjects = await getSubjects().catch(() => ({ data: [] }));
        const sub = (subjects.data || []).find((s) => String(s.subject_id) === subjectIdParam);
        if (sub) setSubjectLabel(sub.subject_name);

        let sawFirst = false;
        let completeReceived = false;
        await generateQuizStream(
          {
            student_id: user.user_id,
            subject_id: Number(subjectIdParam),
            concept: (() => {
              try {
                return decodeURIComponent(conceptParam);
              } catch {
                return conceptParam;
              }
            })(),
            num_questions: DEFAULT_NUM_QUESTIONS,
            ...(gapId ? { gap_id: gapId } : {}),
          },
          (ev) => {
            if (ev.type === 'question') {
              if (!sawFirst) {
                sawFirst = true;
                setLoading(false);
              }
              const mapped = normalizeAiQuestion(ev.question);
              setQuestions((prev) => {
                const k = questionKey(mapped);
                if (k && prev.some((p) => questionKey(p) === k)) return prev;
                return [...prev, mapped];
              });
              setGenProgress({ index: ev.index, total: ev.total });
              setCurrentIdx(ev.index - 1);
            }
            if (ev.type === 'complete' && ev.quiz) {
              completeReceived = true;
              setQuiz(ev.quiz);
              const qs = dedupeQuestionsByText(normalizeQuestionsFromApi(ev.quiz.questions || []));
              setQuestions(qs);
              setGenerating(false);
              setLoading(false);
              setCurrentIdx(0);
              if (qs.length === 0) {
                setError('Quiz has no questions. Please try again.');
              }
            }
          },
          ac.signal
        );

        if (!sawFirst) {
          setError('The AI did not return any questions. Check the AI service and try again.');
        } else if (!completeReceived) {
          setError('Quiz generation stopped early. Please try again.');
        }
        setGenerating(false);
      } else {
        setLoading(true);
        const res = await getStudentQuizzes(user.user_id, { per_page: 1 });
        const items = res.data?.items || res.data?.quizzes || [];
        if (items.length === 0) {
          setError('No quizzes available. Ask your instructor to assign one or visit Knowledge Gaps to generate a quiz.');
          return;
        }
        const latest = items[0];
        const detail = await getStudentQuiz(user.user_id, latest.quiz_id);
        quizData = detail.data;
        const qs = dedupeQuestionsByText(normalizeQuestionsFromApi(quizData?.questions || []));
        setQuiz(quizData);
        setQuestions(qs);
        if (qs.length === 0) {
          setError('Quiz has no questions. Please try generating a new one.');
        }
      }
    } catch (err) {
      if (err?.name === 'AbortError') return;
      const detail = err?.response?.data?.detail || err?.message || 'Failed to load quiz. Please try again.';
      setError(typeof detail === 'string' ? detail : JSON.stringify(detail));
    } finally {
      setLoading(false);
      setGenerating(false);
      streamRef.current = null;
    }
  }, [user, quizIdParam, conceptParam, subjectIdParam, gapId]);

  useEffect(() => {
    loadQuiz();
  }, [loadQuiz]);

  useEffect(() => () => streamRef.current?.abort(), []);

  useEffect(() => {
    answersRef.current = new Array(questions.length).fill(null);
  }, [questions]);

  const finalizeQuiz = useCallback(async () => {
    if (finalizingRef.current) return;
    const qid = quiz?.quiz_id;
    if (!qid) return;
    finalizingRef.current = true;
    const n = questions.length;
    const payload = (answersRef.current || []).slice(0, n);
    while (payload.length < n) payload.push(null);
    try {
      const res = await submitMicroQuiz(qid, payload);
      setSubmitResult(res.data);
      setSubmitError(false);
    } catch (err) {
      setSubmitError(true);
      const detail = err?.response?.data?.detail;
      const msg = typeof detail === 'string' ? detail : err?.message || 'Could not save your quiz result.';
      toast.error(msg);
    }
  }, [quiz?.quiz_id, questions.length]);

  const currentQ = questions[currentIdx];

  const handleSelect = (optionIndex) => {
    if (generating || submitted) return;
    setSelected(optionIndex);
  };

  const handleSubmit = () => {
    if (generating) return;
    if (selected === null) {
      toast.error('Please select an answer first');
      return;
    }
    answersRef.current[currentIdx] = selected;
    setSubmitted(true);
    const isCorrect = currentQ?.options?.[selected]?.is_correct ?? (selected === currentQ?.correct_option_index);
    if (isCorrect) setScore((s) => s + 1);
  };

  const handleNext = async () => {
    if (generating) return;
    if (currentIdx + 1 >= questions.length) {
      await finalizeQuiz();
      setDone(true);
    } else {
      setCurrentIdx((i) => i + 1);
      setSelected(null);
      setSubmitted(false);
    }
  };

  const skipQuestion = async () => {
    if (generating) return;
    answersRef.current[currentIdx] = null;
    setSelected(null);
    setSubmitted(false);
    if (currentIdx + 1 >= questions.length) {
      await finalizeQuiz();
      setDone(true);
    } else {
      setCurrentIdx((i) => i + 1);
    }
  };

  const handleBack = () => {
    if (currentIdx === 0) return;
    setCurrentIdx((i) => i - 1);
    setSelected(null);
    setSubmitted(false);
  };

  const goPrevPreview = () => {
    if (currentIdx <= 0) return;
    setCurrentIdx((i) => i - 1);
    setSelected(null);
    setSubmitted(false);
  };

  const goNextPreview = () => {
    if (currentIdx + 1 >= questions.length) return;
    setCurrentIdx((i) => i + 1);
    setSelected(null);
    setSubmitted(false);
  };

  const subjectTag = subjectLabel || quiz?.subject_name || '';
  const topicTag = quiz?.concept_targeted || quiz?.concept || conceptParam || '';
  const breadcrumbs = [subjectTag, topicTag].filter(Boolean).map((t) => t.toUpperCase());

  const canRegenerateQuiz = Boolean(
    (conceptParam && subjectIdParam) ||
    (quiz?.concept_targeted && quiz?.subject_id != null),
  );

  const handleRegenerateQuiz = () => {
    const concept = conceptParam || quiz?.concept_targeted;
    const subj =
      subjectIdParam != null && subjectIdParam !== ''
        ? subjectIdParam
        : quiz?.subject_id != null
          ? String(quiz.subject_id)
          : '';
    if (!concept || !subj) {
      toast.error('Open this quiz from Knowledge Gaps so we know which topic and subject to regenerate.');
      return;
    }
    const params = new URLSearchParams();
    params.set('concept', concept);
    params.set('subject_id', subj);
    if (gapId) params.set('gap_id', gapId);
    navigate(`/student/micro-quiz?${params.toString()}`, { replace: true });
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-3">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
        <p className="text-sm text-slate-500">Loading quiz…</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center px-4">
        <BookOpen className="w-12 h-12 text-slate-300 mb-4" />
        <p className="text-slate-600 mb-2 font-semibold">No Quiz Available</p>
        <p className="text-slate-400 text-sm max-w-sm mb-6">{error}</p>
        <div className="flex flex-col sm:flex-row gap-3 items-center justify-center">
          {canRegenerateQuiz && (
            <button
              type="button"
              onClick={handleRegenerateQuiz}
              className="inline-flex items-center justify-center gap-2 px-4 py-2.5 border border-primary text-primary rounded-xl text-sm font-semibold hover:bg-primary-light transition-colors"
            >
              <RefreshCw className="w-4 h-4" />
              Regenerate quiz
            </button>
          )}
          <button
            type="button"
            onClick={() => navigate('/student/knowledge-gaps')}
            className="px-4 py-2.5 bg-primary-dark text-white rounded-xl text-sm font-semibold hover:bg-primary transition-colors"
          >
            Go to Knowledge Gaps
          </button>
        </div>
      </div>
    );
  }

  if (done) {
    const displayScore = submitResult ? submitResult.correct_count : score;
    const displayTotal = submitResult ? submitResult.total_questions : questions.length;
    return (
      <ResultScreen
        score={displayScore}
        total={displayTotal}
        concept={quiz?.concept_targeted || quiz?.concept}
        knowledgeGapResolved={submitResult?.knowledge_gap_resolved}
        submitSyncFailed={submitError}
        hadServerSubmit={Boolean(quiz?.quiz_id && !submitError)}
        onRetry={loadQuiz}
        onDone={() => navigate('/student/knowledge-gaps')}
      />
    );
  }

  const previewOnly = generating || false;
  const canPrev = currentIdx > 0;
  const canNextPreview = currentIdx + 1 < questions.length;

  return (
    <div className="flex gap-6">
      <div className="flex-1">
        {breadcrumbs.length > 0 && (
          <div className="flex gap-2 mb-3">
            {breadcrumbs.map((b, i) => (
              <span
                key={i}
                className="text-[11px] font-bold px-2 py-0.5 rounded bg-primary-light text-primary uppercase tracking-wider"
              >
                {b}
              </span>
            ))}
          </div>
        )}

        <h1 className="text-2xl font-bold text-primary-dark mb-1">
          Adaptive Quiz{topicTag ? ` — ${topicTag}` : ''}
        </h1>

        {generating && (
          <div className="mb-3 flex items-center gap-2 text-sm text-primary-dark bg-primary-light/40 border border-primary-light rounded-xl px-3 py-2">
            <Loader2 className="w-4 h-4 animate-spin shrink-0" />
            <span>
              Generating questions… <strong>{genProgress.index}</strong> of <strong>{genProgress.total}</strong> ready.
              Use Previous / Next to review finished questions while we generate the rest.
            </span>
          </div>
        )}

        <div className="mb-6 mt-3">
          {generating ? (
            <ProgressBar
              current={genProgress.index}
              total={genProgress.total}
              labelMode="generate"
            />
          ) : (
            <ProgressBar current={currentIdx + 1} total={questions.length} />
          )}
        </div>

        {questions.length === 0 && generating ? (
          <div className="flex flex-col items-center justify-center py-16 gap-3 rounded-xl border border-dashed border-primary-light bg-slate-50">
            <Loader2 className="w-10 h-10 animate-spin text-primary" />
            <p className="text-sm text-slate-600 font-medium">Waiting for the first question…</p>
            <p className="text-xs text-slate-400 text-center max-w-md">
              The AI service builds each question from your curriculum context. This can take a few seconds per question.
            </p>
          </div>
        ) : (
          <>
            <div className="bg-white rounded-xl border border-primary-light p-6 mb-5">
              <div className="flex items-start justify-between gap-4 mb-4">
                <p className="text-base font-medium text-primary-dark leading-relaxed flex-1">
                  {currentQ?.question_text || currentQ?.question}
                </p>
                {generating && questions.length > 0 && (
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      type="button"
                      onClick={goPrevPreview}
                      disabled={!canPrev}
                      className="p-2 rounded-lg border border-primary-light text-primary-dark hover:bg-primary-light/30 disabled:opacity-40"
                      aria-label="Previous question"
                    >
                      <ChevronLeft className="w-5 h-5" />
                    </button>
                    <span className="text-xs text-slate-500 tabular-nums">
                      {currentIdx + 1}/{questions.length}
                    </span>
                    <button
                      type="button"
                      onClick={goNextPreview}
                      disabled={!canNextPreview}
                      className="p-2 rounded-lg border border-primary-light text-primary-dark hover:bg-primary-light/30 disabled:opacity-40"
                      aria-label="Next question"
                    >
                      <ChevronRight className="w-5 h-5" />
                    </button>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {(currentQ?.options || []).map((opt, i) => {
                  const optText = typeof opt === 'string' ? opt : opt.text;
                  const isCorrectOpt = typeof opt === 'object' ? opt.is_correct : i === currentQ?.correct_option_index;
                  return (
                    <OptionButton
                      key={i}
                      label={OPTION_LABELS[i]}
                      text={optText}
                      selected={selected === i}
                      correct={submitted && isCorrectOpt}
                      incorrect={submitted && selected === i && !isCorrectOpt}
                      onSelect={() => handleSelect(i)}
                      disabled={previewOnly || submitted}
                    />
                  );
                })}
              </div>

              {previewOnly && (
                <p className="mt-4 text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                  Preview mode — answering unlocks when all {genProgress.total} questions are generated.
                </p>
              )}

              {!previewOnly && submitted && currentQ?.explanation && (
                <div className="mt-4 bg-blue-50 border border-blue-200 rounded-xl p-3 text-sm text-blue-700 flex gap-2">
                  <Lightbulb className="w-4 h-4 shrink-0 mt-0.5 text-blue-500" />
                  <span>{currentQ.explanation}</span>
                </div>
              )}
            </div>

            <div className="flex items-center justify-between flex-wrap gap-3">
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={handleBack}
                  disabled={currentIdx === 0 || previewOnly}
                  className="flex items-center gap-1 text-sm text-slate-500 hover:text-primary-dark disabled:opacity-40 transition-colors"
                >
                  <ChevronLeft className="w-4 h-4" />
                  Previous
                </button>
                <button
                  type="button"
                  onClick={() => {
                    void skipQuestion();
                  }}
                  disabled={previewOnly}
                  className="text-sm text-slate-500 hover:text-primary-dark disabled:opacity-40 transition-colors"
                >
                  Skip Question
                </button>
              </div>

              {!previewOnly && !submitted ? (
                <button
                  type="button"
                  onClick={handleSubmit}
                  disabled={selected === null}
                  className="px-6 py-2.5 bg-primary-dark text-white rounded-xl text-sm font-semibold hover:bg-primary disabled:opacity-40 transition-colors"
                >
                  Submit Answer
                </button>
              ) : !previewOnly ? (
                <button
                  type="button"
                  onClick={() => void handleNext()}
                  className="px-6 py-2.5 bg-primary-dark text-white rounded-xl text-sm font-semibold hover:bg-primary transition-colors"
                >
                  {currentIdx + 1 >= questions.length ? 'See Results' : 'Next Question →'}
                </button>
              ) : (
                <div className="text-sm text-slate-400 flex items-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Generating…
                </div>
              )}
            </div>
          </>
        )}
      </div>

      <div className="w-64 shrink-0">
        {generating && (
          <div className="mb-3 bg-white rounded-xl border border-primary-light p-3 text-xs text-slate-600">
            <Loader2 className="w-4 h-4 animate-spin text-primary inline mr-1" />
            Building your adaptive set ({genProgress.index}/{genProgress.total}).
          </div>
        )}
        <QuizStats quiz={{ ...quiz, concept: quiz?.concept || conceptParam }} />
      </div>
    </div>
  );
}
