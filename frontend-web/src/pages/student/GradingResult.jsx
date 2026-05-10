import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import {
  CheckCircle, XCircle, Clock, Bot, Lightbulb, BookOpen,
  Loader2, ChevronLeft, AlertCircle, Zap, FileText, Download,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { getGradingResult, triggerGrading } from '../../services/aiService';
import { getSubmissionDetail, downloadSubmissionFile } from '../../services/studentService';

const STATUS_ICON = {
  correct: <CheckCircle className="w-5 h-5 text-green-500 shrink-0 mt-0.5" />,
  partial: <AlertCircle className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />,
  incorrect: <XCircle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />,
  missing: <XCircle className="w-5 h-5 text-slate-300 shrink-0 mt-0.5" />,
};

function StepFeedback({ step, index }) {
  const icon = STATUS_ICON[step.status] || STATUS_ICON['missing'];
  const isMissing = step.status === 'missing' || !step.status;
  const isIncorrect = step.status === 'incorrect' || step.status === 'partial';

  return (
    <div className={`border-b border-slate-50 pb-4 mb-4 last:border-0 last:mb-0 last:pb-0 ${isMissing ? 'opacity-50' : ''}`}>
      <div className="flex items-start gap-3">
        <span className="w-5 h-5 rounded-full border-2 border-slate-200 flex items-center justify-center text-xs font-bold text-slate-400 shrink-0 mt-0.5">
          {index + 1}
        </span>
        {icon}
        <div className="flex-1">
          <p className={`text-sm font-semibold ${isMissing ? 'text-slate-400' : 'text-primary-dark'}`}>
            {step.label}
          </p>
          {step.description && (
            <p className="text-sm text-slate-500 mt-0.5">{step.description}</p>
          )}
          {isIncorrect && step.correction && (
            <div className="mt-2 bg-amber-50 border border-amber-200 rounded-lg p-2.5">
              <p className="text-[11px] font-bold text-amber-700 uppercase tracking-wider mb-1">Correction Required</p>
              <p className="text-xs text-amber-800 font-mono">{step.correction}</p>
              {step.expected && (
                <p className="text-xs text-amber-700 mt-1">{step.expected}</p>
              )}
            </div>
          )}
          {isMissing && (
            <p className="text-xs text-slate-400 italic mt-0.5">Section missing from submission.</p>
          )}
        </div>
      </div>
    </div>
  );
}

function ScoreDisplay({ score, maxScore, status }) {
  const statusBadge = {
    passed: { label: 'PASSED', cls: 'bg-green-100 text-green-700' },
    partial: { label: 'PARTIAL', cls: 'bg-amber-100 text-amber-700' },
    failed: { label: 'FAILED', cls: 'bg-red-100 text-red-700' },
    grading: { label: 'GRADING', cls: 'bg-blue-100 text-blue-700' },
    pending: { label: 'PENDING', cls: 'bg-slate-100 text-slate-500' },
  }[status?.toLowerCase()] || { label: status?.toUpperCase() || '—', cls: 'bg-slate-100 text-slate-500' };

  return (
    <div className="flex items-center gap-6 mb-6">
      <div>
        <p className="text-[10px] text-slate-400 uppercase tracking-wider mb-1">Status</p>
        <span className={`inline-block px-2.5 py-1 rounded-lg text-xs font-bold tracking-wider ${statusBadge.cls}`}>
          {statusBadge.label}
        </span>
      </div>
      <div>
        <p className="text-[10px] text-slate-400 uppercase tracking-wider mb-1">Final Score</p>
        <p className="text-2xl font-bold text-primary-dark">
          {score != null ? score : '—'}
          <span className="text-base font-normal text-slate-400">/{maxScore || 100}</span>
        </p>
      </div>
    </div>
  );
}

export default function GradingResultPage() {
  const { submissionId } = useParams();
  const navigate = useNavigate();

  const [result, setResult] = useState(null);
  const [submission, setSubmission] = useState(null);
  const [loading, setLoading] = useState(true);
  const [triggering, setTriggering] = useState(false);

  const load = async () => {
    if (!submissionId) return;
    setLoading(true);
    try {
      const [gradingRes, subRes] = await Promise.allSettled([
        getGradingResult(submissionId),
        getSubmissionDetail(submissionId),
      ]);
      if (gradingRes.status === 'fulfilled') setResult(gradingRes.value.data);
      if (subRes.status === 'fulfilled') setSubmission(subRes.value.data);
    } catch {
      toast.error('Failed to load grading result');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [submissionId]);

  const fileEntryLabel = (entry) => {
    if (entry == null) return 'File';
    if (typeof entry === 'string') return entry;
    return entry.name || 'File';
  };

  const fileEntryIndex = (entry, i) => {
    if (entry && typeof entry === 'object' && typeof entry.index === 'number') return entry.index;
    return i;
  };

  const handleDownloadFile = async (fileIndex, name) => {
    if (!submissionId) return;
    try {
      await downloadSubmissionFile(submissionId, fileIndex, name || `file-${fileIndex}`);
    } catch {
      toast.error('Could not download file');
    }
  };

  const handleTrigger = async () => {
    setTriggering(true);
    try {
      await triggerGrading(submissionId);
      toast.success('Grading triggered — results will appear shortly');
      setTimeout(load, 3000);
    } catch {
      toast.error('Failed to trigger grading');
    } finally {
      setTriggering(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center py-24">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  const rawCorrections = result?.feedback?.step_by_step_corrections;
  const steps = Array.isArray(rawCorrections)
    ? rawCorrections.map((s) => ({
        label: s.step ?? s.label ?? 'Step',
        description: s.comment ?? s.description ?? '',
        status: (s.status || 'missing').toLowerCase(),
        correction: s.correction,
        expected: s.expected,
      }))
    : (result?.steps || result?.feedback_steps || []);

  const aiSummary =
    result?.feedback?.overall_feedback
    || result?.ai_summary
    || result?.overall_feedback
    || submission?.feedback?.overall_feedback
    || null;
  const mentorTip = result?.mentor_tip || null;
  const gap = result?.knowledge_gap || null;

  const processingStatusRaw =
    result?.processing_status
    || submission?.processing_status
    || '';
  const processingStatus = String(processingStatusRaw).toLowerCase();

  const score =
    result?.score_percentage
    ?? result?.score
    ?? submission?.score_percentage
    ?? null;
  const maxScore =
    submission?.assignment_max_score
    ?? submission?.assignment?.max_score
    ?? result?.max_score
    ?? 100;

  const gradeClass = String(
    submission?.grade_classification || result?.grade_classification || '',
  ).toLowerCase();
  const gradingStatus =
    processingStatus === 'rejected' ? 'failed'
      : processingStatus === 'done' && gradeClass === 'partial' ? 'partial'
        : processingStatus === 'done' && gradeClass === 'incorrect' ? 'failed'
          : processingStatus === 'done' ? 'passed'
            : processingStatus || 'pending';

  const breadcrumbs = [
    submission?.subject_name,
    submission?.assignment_title,
  ].filter(Boolean);

  const inFlight = ['queued', 'ocr', 'grading', ''].includes(processingStatus);
  const isPending = inFlight && processingStatus !== 'rejected';

  return (
    <div>
      {/* Back + Breadcrumb */}
      <div className="flex items-center gap-2 mb-4 text-sm text-slate-500">
        <button onClick={() => navigate(-1)} className="flex items-center gap-1 hover:text-primary-dark transition-colors">
          <ChevronLeft className="w-4 h-4" />
          Back
        </button>
        {breadcrumbs.map((b, i) => (
          <span key={i} className="flex items-center gap-2">
            <span>›</span>
            <span className={i === breadcrumbs.length - 1 ? 'text-primary-dark font-medium' : ''}>{b}</span>
          </span>
        ))}
      </div>

      {/* Title + Score */}
      <div className="flex items-start justify-between mb-2">
        <h1 className="text-2xl font-bold text-primary-dark">Submission Result</h1>
      </div>
      <div className="w-16 h-0.5 bg-primary mb-5" />

      {submission?.uploaded_files && submission.uploaded_files.length > 0 && (
        <div className="bg-white rounded-xl border border-primary-light p-4 mb-6">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">Your uploads</p>
          <ul className="space-y-2">
            {submission.uploaded_files.map((f, i) => {
              const idx = fileEntryIndex(f, i);
              const label = fileEntryLabel(f);
              return (
                <li key={`${idx}-${label}`} className="flex items-center justify-between gap-3 text-sm">
                  <span className="flex items-center gap-2 text-slate-700 min-w-0">
                    <FileText className="w-4 h-4 text-primary shrink-0" />
                    <span className="truncate" title={label}>{label}</span>
                  </span>
                  <button
                    type="button"
                    onClick={() => handleDownloadFile(idx, label)}
                    className="shrink-0 inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline"
                  >
                    <Download className="w-3.5 h-3.5" />
                    Download
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {isPending ? (
        <div className="bg-white rounded-xl border border-primary-light p-10 text-center">
          <Clock className="w-12 h-12 text-slate-300 mx-auto mb-4" />
          <h2 className="text-lg font-semibold text-primary-dark mb-2">Grading In Progress</h2>
          <p className="text-slate-500 text-sm mb-6">
            The AI is processing your submission. Results will appear here once grading is complete.
          </p>
          <div className="flex gap-3 justify-center">
            <button
              onClick={load}
              className="px-4 py-2 border border-primary text-primary rounded-xl text-sm font-semibold hover:bg-primary-light transition-colors"
            >
              Refresh
            </button>
            {(processingStatus === 'queued' || processingStatus === 'ocr' || processingStatus === 'grading') && (
              <button
                onClick={handleTrigger}
                disabled={triggering}
                className="px-4 py-2 bg-primary-dark text-white rounded-xl text-sm font-semibold hover:bg-primary disabled:opacity-50 transition-colors flex items-center gap-2"
              >
                {triggering ? <Loader2 className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4" />}
                Process Now
              </button>
            )}
          </div>
        </div>
      ) : (
        <div className="flex gap-6">
          {/* Left: step-by-step feedback */}
          <div className="flex-1">
            <ScoreDisplay score={score} maxScore={maxScore} status={gradingStatus} />

            <div className="bg-white rounded-xl border border-primary-light p-6">
              <div className="flex items-center gap-2 mb-5">
                <BookOpen className="w-4 h-4 text-primary" />
                <h2 className="font-bold text-primary-dark">Step-by-Step Feedback</h2>
              </div>

              {steps.length === 0 ? (
                <p className="text-sm text-slate-500 text-center py-4">No detailed feedback available yet.</p>
              ) : (
                steps.map((step, i) => <StepFeedback key={i} step={step} index={i} />)
              )}
            </div>

            <div className="mt-4 flex gap-3">
              <Link
                to="/student/submissions"
                className="text-sm text-slate-500 hover:text-primary-dark transition-colors flex items-center gap-1"
              >
                <BookOpen className="w-4 h-4" />
                View Submission History
              </Link>
            </div>
          </div>

          {/* Right: AI summary + knowledge gap */}
          <div className="w-72 shrink-0 space-y-4">
            {/* AI Feedback Summary */}
            {aiSummary && (
              <div className="bg-primary-dark rounded-xl p-5 text-white">
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-7 h-7 rounded-full bg-white/10 flex items-center justify-center">
                    <Bot className="w-4 h-4 text-primary-light" />
                  </div>
                  <p className="font-semibold text-sm">AI Feedback Summary</p>
                </div>
                <p className="text-sm text-white/80 leading-relaxed mb-3">{aiSummary}</p>
                {mentorTip && (
                  <div className="flex items-start gap-2 bg-white/10 rounded-lg px-3 py-2 text-xs text-white/70">
                    <Lightbulb className="w-3.5 h-3.5 shrink-0 mt-0.5 text-primary-light" />
                    <span>{mentorTip}</span>
                  </div>
                )}
              </div>
            )}

            {/* Knowledge Gap Detected */}
            {gap && (
              <div className="bg-slate-700 rounded-xl p-5 text-white">
                <div className="flex items-center gap-2 mb-2">
                  <AlertCircle className="w-4 h-4 text-amber-400" />
                  <p className="font-semibold text-sm">Knowledge Gap Detected</p>
                </div>
                <p className="text-xs text-white/60 mb-1">Concept: {gap.concept_name}</p>
                <p className="text-xs text-white/70 mb-4 leading-relaxed">{gap.description}</p>
                <button
                  onClick={() =>
                    navigate(
                      `/student/micro-quiz?gap_id=${gap.gap_id}&concept=${encodeURIComponent(gap.concept_name)}&subject_id=${gap.subject_id || ''}`
                    )
                  }
                  className="w-full bg-white/10 hover:bg-white/20 transition-colors text-white text-sm font-semibold rounded-lg py-2.5"
                >
                  Start Quiz
                </button>
              </div>
            )}

            {!aiSummary && !gap && (
              <div className="bg-white rounded-xl border border-primary-light p-5 text-center">
                <Bot className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                <p className="text-xs text-slate-400">AI summary not yet available.</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
