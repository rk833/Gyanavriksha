import { useState, useEffect, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Loader2, Zap, ChevronLeft, CheckCircle, XCircle, Lightbulb, BookOpen, Timer, GraduationCap } from 'lucide-react';
import toast from 'react-hot-toast';
import useAuth from '../../hooks/useAuth';
import { getStudentQuizzes, getStudentQuiz, generateQuiz } from '../../services/aiService';
import { getKnowledgeGaps, getSubjects } from '../../services/studentService';

const OPTION_LABELS = ['A', 'B', 'C', 'D'];

function ProgressBar({ current, total }) {
  const pct = total > 0 ? Math.round(((current - 1) / total) * 100) : 0;
  return (
    <div className="flex items-center gap-3">
      <span className="text-sm text-slate-500 shrink-0">Question {current} of {total}</span>
      <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden">
        <div className="h-full bg-primary rounded-full transition-all" style={{ width: `${pct}%` }} />
      </div>
      <span className="text-sm font-semibold text-primary shrink-0">{pct}% Complete</span>
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

function ResultScreen({ score, total, concept, onRetry, onDone }) {
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
        <p className="text-green-700 text-sm bg-green-50 rounded-xl px-4 py-2 mb-6">
          Great job! This knowledge gap is now being marked as resolved.
        </p>
      ) : (
        <p className="text-amber-700 text-sm bg-amber-50 rounded-xl px-4 py-2 mb-6">
          Score 60% or above to resolve this knowledge gap.
        </p>
      )}
      <div className="flex gap-3">
        <button
          onClick={onRetry}
          className="px-5 py-2.5 border border-primary text-primary rounded-xl text-sm font-semibold hover:bg-primary-light transition-colors"
        >
          Retry Quiz
        </button>
        <button
          onClick={onDone}
          className="px-5 py-2.5 bg-primary-dark text-white rounded-xl text-sm font-semibold hover:bg-primary transition-colors"
        >
          Back to Knowledge Gaps
        </button>
      </div>
    </div>
  );
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
  const [error, setError] = useState(null);
  const [subjectLabel, setSubjectLabel] = useState('');

  const loadQuiz = useCallback(async () => {
    if (!user?.user_id) return;
    setLoading(true);
    setError(null);
    setCurrentIdx(0);
    setSelected(null);
    setSubmitted(false);
    setScore(0);
    setDone(false);

    try {
      let quizData;

      if (quizIdParam) {
        const res = await getStudentQuiz(user.user_id, quizIdParam);
        quizData = res.data;
      } else if (conceptParam && subjectIdParam) {
        const res = await generateQuiz({
          student_id: user.user_id,
          subject_id: Number(subjectIdParam),
          concept: conceptParam,
          num_questions: 5,
          ...(gapId ? { gap_id: gapId } : {}),
        });
        quizData = res.data;
        const subjects = await getSubjects().catch(() => ({ data: [] }));
        const sub = (subjects.data || []).find((s) => String(s.subject_id) === subjectIdParam);
        if (sub) setSubjectLabel(sub.subject_name);
      } else {
        const res = await getStudentQuizzes(user.user_id, { per_page: 1 });
        const items = res.data?.items || res.data?.quizzes || [];
        if (items.length === 0) {
          setError('No quizzes available. Ask your instructor to assign one or visit Knowledge Gaps to generate a quiz.');
          return;
        }
        const latest = items[0];
        const detail = await getStudentQuiz(user.user_id, latest.quiz_id);
        quizData = detail.data;
      }

      const qs = quizData?.questions || [];
      setQuiz(quizData);
      setQuestions(qs);
      if (qs.length === 0) {
        setError('Quiz has no questions. Please try generating a new one.');
      }
    } catch (err) {
      setError(err?.response?.data?.detail || 'Failed to load quiz. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [user, quizIdParam, conceptParam, subjectIdParam, gapId]);

  useEffect(() => {
    loadQuiz();
  }, [loadQuiz]);

  const currentQ = questions[currentIdx];

  const handleSelect = (optionIndex) => {
    if (submitted) return;
    setSelected(optionIndex);
  };

  const handleSubmit = () => {
    if (selected === null) {
      toast.error('Please select an answer first');
      return;
    }
    setSubmitted(true);
    const isCorrect = currentQ?.options?.[selected]?.is_correct ?? (selected === currentQ?.correct_option_index);
    if (isCorrect) setScore((s) => s + 1);
  };

  const handleNext = () => {
    if (currentIdx + 1 >= questions.length) {
      setDone(true);
    } else {
      setCurrentIdx((i) => i + 1);
      setSelected(null);
      setSubmitted(false);
    }
  };

  const handleBack = () => {
    if (currentIdx === 0) return;
    setCurrentIdx((i) => i - 1);
    setSelected(null);
    setSubmitted(false);
  };

  const subjectTag = subjectLabel || quiz?.subject_name || '';
  const topicTag = quiz?.concept || conceptParam || '';
  const breadcrumbs = [subjectTag, topicTag].filter(Boolean).map((t) => t.toUpperCase());

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-3">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
        <p className="text-sm text-slate-500">Generating your adaptive quiz…</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center">
        <BookOpen className="w-12 h-12 text-slate-300 mb-4" />
        <p className="text-slate-600 mb-2 font-semibold">No Quiz Available</p>
        <p className="text-slate-400 text-sm max-w-sm mb-6">{error}</p>
        <button
          onClick={() => navigate('/student/knowledge-gaps')}
          className="px-4 py-2 bg-primary-dark text-white rounded-xl text-sm font-semibold hover:bg-primary transition-colors"
        >
          Go to Knowledge Gaps
        </button>
      </div>
    );
  }

  if (done) {
    return (
      <ResultScreen
        score={score}
        total={questions.length}
        concept={quiz?.concept}
        onRetry={loadQuiz}
        onDone={() => navigate('/student/knowledge-gaps')}
      />
    );
  }

  return (
    <div className="flex gap-6">
      {/* Main quiz area */}
      <div className="flex-1">
        {/* Breadcrumbs */}
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

        {/* Title */}
        <h1 className="text-2xl font-bold text-primary-dark mb-1">
          Adaptive Quiz{quiz?.concept ? ` — ${quiz.concept}` : ''}
        </h1>

        {/* Progress */}
        <div className="mb-6 mt-3">
          <ProgressBar current={currentIdx + 1} total={questions.length} />
        </div>

        {/* Question card */}
        <div className="bg-white rounded-xl border border-primary-light p-6 mb-5">
          <p className="text-base font-medium text-primary-dark leading-relaxed mb-6">
            {currentQ?.question_text || currentQ?.question}
          </p>

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
                  disabled={submitted}
                />
              );
            })}
          </div>

          {submitted && currentQ?.explanation && (
            <div className="mt-4 bg-blue-50 border border-blue-200 rounded-xl p-3 text-sm text-blue-700 flex gap-2">
              <Lightbulb className="w-4 h-4 shrink-0 mt-0.5 text-blue-500" />
              <span>{currentQ.explanation}</span>
            </div>
          )}
        </div>

        {/* Action row */}
        <div className="flex items-center justify-between">
          <div className="flex gap-3">
            <button
              onClick={handleBack}
              disabled={currentIdx === 0}
              className="flex items-center gap-1 text-sm text-slate-500 hover:text-primary-dark disabled:opacity-40 transition-colors"
            >
              <ChevronLeft className="w-4 h-4" />
              Back
            </button>
            <button
              onClick={() => {
                setSelected(null);
                setSubmitted(false);
                handleNext();
              }}
              className="text-sm text-slate-500 hover:text-primary-dark transition-colors"
            >
              Skip Question
            </button>
          </div>

          {!submitted ? (
            <button
              onClick={handleSubmit}
              disabled={selected === null}
              className="px-6 py-2.5 bg-primary-dark text-white rounded-xl text-sm font-semibold hover:bg-primary disabled:opacity-40 transition-colors"
            >
              Submit Answer
            </button>
          ) : (
            <button
              onClick={handleNext}
              className="px-6 py-2.5 bg-primary-dark text-white rounded-xl text-sm font-semibold hover:bg-primary transition-colors"
            >
              {currentIdx + 1 >= questions.length ? 'See Results' : 'Next Question →'}
            </button>
          )}
        </div>
      </div>

      {/* Stats sidebar */}
      <div className="w-64 shrink-0">
        <QuizStats quiz={{ ...quiz, concept: quiz?.concept || conceptParam }} />
      </div>
    </div>
  );
}
