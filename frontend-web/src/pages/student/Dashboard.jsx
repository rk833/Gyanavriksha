import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import {
  BookOpen,
  Upload,
  FileText,
  ArrowRight,
  Send,
  Bot,
  LayoutGrid,
  Triangle,
  MoreVertical,
  Sparkles,
  Radio,
  Calendar,
  ChevronRight,
  Zap,
} from 'lucide-react';
import { getDashboard } from '../../services/studentService';
import { getStudentQuizzes } from '../../services/aiService';
import MarkdownMath from '../../components/MarkdownMath';
import useAuth from '../../hooks/useAuth';

const OCR_PROGRESS = { queued: 22, ocr: 48, grading: 82, done: 100 };
const ICONS = [LayoutGrid, Triangle, BookOpen, Zap, Sparkles];

function SkeletonCard({ className = '' }) {
  return (
    <div className={`animate-pulse bg-white rounded-2xl border border-slate-100/80 shadow-sm p-6 ${className}`}>
      <div className="h-4 bg-slate-200 rounded w-1/3 mb-3" />
      <div className="h-3 bg-slate-200 rounded w-2/3 mb-2" />
      <div className="h-3 bg-slate-200 rounded w-1/2" />
    </div>
  );
}

function formatDue(iso) {
  if (!iso) return null;
  const d = new Date(iso);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export default function StudentDashboard() {
  const navigate = useNavigate();
  const { user } = useAuth();

  const {
    data,
    isPending: loading,
    error,
    refetch,
  } = useQuery({
    queryKey: ['student', 'dashboard'],
    queryFn: async () => {
      const res = await getDashboard();
      return res.data;
    },
  });

  // Real quiz data — pending quizzes (status != done) for each enrolled subject
  const { data: quizzesData } = useQuery({
    queryKey: ['student', 'dashboard-quizzes'],
    queryFn: async () => {
      if (!user?.user_id) return null;
      const res = await getStudentQuizzes(user.user_id, { per_page: 20 });
      return res.data;
    },
    enabled: !!user?.user_id,
  });

  // Sort subjects by completion asc so the one with most work remaining is first
  const sortedSubjects = useMemo(() => {
    const subs = data?.enrolled_subjects || [];
    return [...subs].sort((a, b) => (a.completion_percentage ?? 0) - (b.completion_percentage ?? 0));
  }, [data?.enrolled_subjects]);

  // Next upcoming assignment = real data
  const nextAssignment = useMemo(() => {
    const upcoming = data?.upcoming_assignments || [];
    return upcoming[0] || null;
  }, [data?.upcoming_assignments]);

  // Processing OCR submission
  const processingSubmission = useMemo(() => {
    const recent = data?.recent_submissions || [];
    return recent.find((r) => r.processing_status && r.processing_status !== 'done') || null;
  }, [data?.recent_submissions]);

  // Recommended practice rows — real quizzes grouped by subject, fall back to enrolled subjects
  const practiceRows = useMemo(() => {
    const subs = data?.enrolled_subjects || [];
    const quizItems = quizzesData?.items || [];

    // Group pending quizzes by subject_id
    const quizBySubject = {};
    quizItems.forEach((q) => {
      if (!q.subject_id) return;
      if (!quizBySubject[q.subject_id]) quizBySubject[q.subject_id] = [];
      quizBySubject[q.subject_id].push(q);
    });

    return subs.slice(0, 3).map((s, i) => {
      const Icon = ICONS[i % ICONS.length];
      const pending = (quizBySubject[s.subject_id] || []).filter((q) => {
        const st = q.status ? String(q.status).toUpperCase() : '';
        return st !== 'COMPLETED' && st !== 'SUBMITTED';
      });
      const questionCount = pending.reduce((acc, q) => acc + (q.total_questions ?? 0), 0);
      const pct = s.completion_percentage ?? 0;
      const tag = pct < 45 ? 'Refresh required' : pct < 70 ? 'High impact' : 'Practice more';
      return {
        ...s,
        quizCount: pending.length,
        questionCount,
        tag,
        Icon,
      };
    });
  }, [data?.enrolled_subjects, quizzesData]);


  if (loading) {
    return (
      <div className="max-w-6xl mx-auto">
        <div className="mb-8">
          <div className="h-9 bg-slate-200 rounded w-72 mb-2 animate-pulse" />
          <div className="h-4 bg-slate-200 rounded w-96 animate-pulse" />
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
          <SkeletonCard className="lg:col-span-8 min-h-[220px]" />
          <SkeletonCard className="lg:col-span-4 min-h-[220px]" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mt-5">
          <SkeletonCard className="min-h-[280px]" />
          <SkeletonCard className="min-h-[280px]" />
          <SkeletonCard className="min-h-[280px]" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-16 max-w-md mx-auto">
        <p className="text-red-600 mb-4">
          {error?.response?.data?.detail || error?.message || 'Failed to load dashboard'}
        </p>
        <button
          type="button"
          onClick={() => refetch()}
          className="px-5 py-2.5 bg-slate-900 text-white rounded-xl text-sm font-medium hover:bg-slate-800 transition-colors"
        >
          Retry
        </button>
      </div>
    );
  }

  const firstName = data?.student_name?.split(' ')[0] || 'Student';
  const allSubjects = sortedSubjects;

  return (
    <div className="max-w-6xl mx-auto pb-24 relative">
      {/* Welcome */}
      <header className="mb-8">
        <h1 className="text-3xl font-bold text-slate-900 tracking-tight">
          Welcome back, {firstName}.
        </h1>
        <p className="text-slate-500 mt-1.5 text-sm md:text-base">
          Your learning path is optimised for today.
        </p>
      </header>

      {/* Row 1 — All subjects + Next assignment */}
      <section className="grid grid-cols-1 lg:grid-cols-12 gap-5 mb-5">
        {allSubjects.length > 0 ? (
          <div className="lg:col-span-8 rounded-2xl bg-gradient-to-br from-slate-900 via-slate-900 to-slate-800 text-white p-6 md:p-8 shadow-lg shadow-slate-900/10 relative overflow-hidden flex flex-col">
            {/* Header */}
            <div className="relative z-10 flex items-center justify-between mb-5">
              <span className="inline-flex items-center text-[10px] font-semibold uppercase tracking-widest bg-white/15 text-white/95 px-2.5 py-1 rounded-md border border-white/10">
                My subjects
              </span>
              <span className="text-[11px] text-white/50">
                {allSubjects.length} subject{allSubjects.length !== 1 ? 's' : ''} enrolled
              </span>
            </div>

            {/* Subject rows */}
            <div className="relative z-10 flex-1 space-y-4">
              {allSubjects.map((s) => (
                <div key={s.subject_id} className="group">
                  <div className="flex items-center justify-between mb-1.5">
                    <div>
                      <span className="font-semibold text-white text-sm">{s.subject_name}</span>
                      <span className="text-white/45 text-xs ml-2">{s.grade_name}</span>
                    </div>
                    <span className="text-white/80 text-xs font-medium tabular-nums">{s.completion_percentage}%</span>
                  </div>
                  <div className="w-full bg-white/15 rounded-full h-1.5 overflow-hidden">
                    <div
                      className="bg-white rounded-full h-1.5 transition-all duration-500"
                      style={{ width: `${Math.min(100, s.completion_percentage)}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>

            {/* Action */}
            <div className="relative z-10 mt-6 flex items-center gap-3 flex-wrap">
              <button
                type="button"
                onClick={() => navigate('/student/library')}
                className="inline-flex items-center justify-center gap-2 bg-white text-slate-900 px-5 py-2.5 rounded-xl text-sm font-semibold hover:bg-white/95 transition-colors shadow-sm"
              >
                <BookOpen className="w-4 h-4" />
                Resume learning
              </button>
              <button
                type="button"
                onClick={() => navigate('/student/assignments')}
                className="inline-flex items-center justify-center gap-2 bg-white/10 text-white/90 border border-white/15 px-5 py-2.5 rounded-xl text-sm font-semibold hover:bg-white/15 transition-colors"
              >
                View assignments
              </button>
            </div>
            <div className="absolute -right-16 -bottom-16 w-56 h-56 rounded-full bg-white/[0.05]" />
            <div className="absolute right-8 top-8 w-32 h-32 rounded-full bg-primary/20 blur-2xl" />
          </div>
        ) : (
          <div className="lg:col-span-8 rounded-2xl border border-dashed border-slate-200 bg-slate-50/80 p-8 flex items-center justify-center min-h-[220px]">
            <p className="text-slate-500 text-sm">No subjects enrolled yet.</p>
          </div>
        )}

        {/* Next assignment (real data) */}
        <div className="lg:col-span-4 rounded-2xl bg-white border border-slate-100 shadow-sm p-5 flex flex-col min-h-[220px]">
          <div className="flex items-start justify-between gap-2 mb-3">
            <span className="text-[10px] font-semibold uppercase tracking-widest text-slate-500">
              Next due
            </span>
            {nextAssignment ? (
              <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-100">
                <Radio className="w-3 h-3" />
                {formatDue(nextAssignment.due_date) || 'Upcoming'}
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-slate-400 bg-slate-50 px-2 py-0.5 rounded-full border border-slate-100">
                All clear
              </span>
            )}
          </div>

          <div className="flex-1 rounded-xl bg-slate-50/90 border border-slate-100 min-h-[90px] mb-4 flex items-center justify-center overflow-hidden">
            {nextAssignment ? (
              <div className="p-4 text-center">
                <FileText className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                <p className="text-xs text-slate-600 font-medium line-clamp-2">{nextAssignment.title}</p>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-1 py-4">
                <Sparkles className="w-9 h-9 text-slate-300" strokeWidth={1.25} />
                <span className="text-[10px] uppercase tracking-wider text-slate-400 font-medium">No upcoming</span>
              </div>
            )}
          </div>

          {nextAssignment ? (
            <>
              <h3 className="font-semibold text-slate-900 text-sm leading-snug line-clamp-2">
                {nextAssignment.subject_name}
              </h3>
              <p className="text-xs text-slate-500 mt-1 line-clamp-2 flex items-center gap-1">
                <Calendar className="w-3.5 h-3.5 shrink-0" />
                Due {formatDue(nextAssignment.due_date) || 'soon'}
              </p>
              <button
                type="button"
                onClick={() => navigate('/student/assignments')}
                className="mt-4 w-full bg-slate-900 text-white py-2.5 rounded-xl text-sm font-semibold hover:bg-slate-800 transition-colors flex items-center justify-center gap-2"
              >
                <ChevronRight className="w-4 h-4" />
                Go to assignment
              </button>
            </>
          ) : (
            <div className="flex-1">
              <p className="text-sm text-slate-500">
                No upcoming deadlines. Check your assignments page for open work.
              </p>
              <button
                type="button"
                onClick={() => navigate('/student/assignments')}
                className="mt-4 w-full bg-slate-900 text-white py-2.5 rounded-xl text-sm font-semibold hover:bg-slate-800 transition-colors"
              >
                View assignments
              </button>
            </div>
          )}
        </div>
      </section>

      {/* Row 2 — Widgets */}
      <section className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {/* Gyan AI Tutor */}
        <div className="rounded-2xl bg-white border border-slate-100 shadow-sm p-5 flex flex-col min-h-[300px]">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-9 h-9 rounded-full bg-slate-900 flex items-center justify-center">
              <Bot className="w-4 h-4 text-white" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-slate-900">Gyan AI Tutor</p>
              <p className="text-[11px] font-medium text-emerald-600">Online</p>
            </div>
          </div>
          <div className="flex-1 space-y-2.5 mb-4 overflow-y-auto max-h-[200px]">
            <div className="bg-slate-50 rounded-xl px-3 py-2 text-xs text-slate-600 max-w-[92%] border border-slate-100/80">
              Hello {firstName}! Need help with any topics in your current modules?
            </div>
            <div className="bg-primary rounded-xl px-3 py-2 text-xs text-white max-w-[92%] ml-auto shadow-sm">
              Yes, I&apos;m working through some practice problems.
            </div>
            <div className="bg-slate-50 rounded-xl px-3 py-2 text-xs max-w-[92%] border border-slate-100/80">
              <MarkdownMath
                markdown="No problem! For example, area between curves: $A = \int_a^b [f(x) - g(x)]\,dx$. Want a practice problem?"
                className="text-xs [&_p]:text-slate-600 [&_p]:mb-0 [&_.katex]:text-[0.85em]"
              />
            </div>
          </div>
          <div className="flex gap-2 pt-1">
            <button
              type="button"
              onClick={() => navigate('/student/ai-tutor')}
              className="flex-1 flex items-center gap-2 bg-slate-50 rounded-xl px-3 py-2.5 text-left text-sm text-slate-500 border border-slate-100 hover:border-primary/30 hover:bg-white transition-colors"
            >
              <span className="truncate">Ask a question...</span>
            </button>
            <button
              type="button"
              onClick={() => navigate('/student/ai-tutor')}
              className="p-2.5 rounded-xl bg-slate-900 text-white hover:bg-slate-800 transition-colors shrink-0"
              aria-label="Open AI Tutor"
            >
              <Send className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Homework OCR */}
        <div className="rounded-2xl bg-white border border-slate-100 shadow-sm p-5 flex flex-col min-h-[300px]">
          <h3 className="text-[10px] font-semibold uppercase tracking-widest text-slate-500 mb-1">
            Homework OCR
          </h3>
          <p className="text-xs text-slate-500 mb-4">Drop your handwritten sheets here to scan</p>
          <button
            type="button"
            onClick={() => navigate('/student/assignments')}
            className="flex-1 border-2 border-dashed border-slate-200 rounded-2xl flex flex-col items-center justify-center p-6 hover:border-primary/35 hover:bg-slate-50/80 transition-colors group min-h-[120px]"
          >
            <Upload className="w-9 h-9 text-slate-300 group-hover:text-primary/70 mb-2 transition-colors" />
            <p className="text-xs text-slate-400 group-hover:text-slate-600 text-center leading-relaxed">
              Click to open assignments and upload your work
            </p>
          </button>
          {processingSubmission ? (
            <div className="mt-4 pt-4 border-t border-slate-100">
              <div className="flex items-center gap-2 text-xs text-slate-600 mb-2">
                <FileText className="w-3.5 h-3.5 shrink-0 text-primary" />
                <span className="truncate font-medium">{processingSubmission.assignment_title}</span>
              </div>
              <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
                <div
                  className="bg-primary rounded-full h-1.5 transition-all"
                  style={{ width: `${OCR_PROGRESS[processingSubmission.processing_status] ?? 40}%` }}
                />
              </div>
              <p className="text-[10px] text-slate-400 mt-1.5">
                Processing handwriting and extracting key steps...
              </p>
            </div>
          ) : data?.recent_submissions?.[0] ? (
            <div className="mt-4 pt-4 border-t border-slate-100">
              <div className="flex items-center gap-2 text-xs text-slate-600">
                <FileText className="w-3.5 h-3.5 text-slate-400" />
                <span className="truncate">Latest: {data.recent_submissions[0].assignment_title}</span>
              </div>
            </div>
          ) : null}
        </div>

        {/* Recommended practice — real quiz data */}
        <div className="rounded-2xl bg-white border border-slate-100 shadow-sm p-5 flex flex-col min-h-[300px]">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-[10px] font-semibold uppercase tracking-widest text-slate-500">
              Recommended practice
            </h3>
            <button
              type="button"
              onClick={() => navigate('/student/performance')}
              className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-50"
              aria-label="More options"
            >
              <MoreVertical className="w-4 h-4" />
            </button>
          </div>
          <div className="flex-1 space-y-2">
            {practiceRows.map((row) => (
              <button
                key={row.subject_id}
                type="button"
                onClick={() => navigate(`/student/micro-quiz?subject_id=${row.subject_id}`)}
                className="w-full flex items-start gap-3 px-3 py-3 rounded-xl border border-slate-100 hover:border-primary/25 hover:bg-slate-50/80 transition-colors text-left group"
              >
                <div className="w-9 h-9 rounded-lg bg-slate-100 flex items-center justify-center shrink-0 group-hover:bg-primary/10 transition-colors">
                  <row.Icon className="w-4 h-4 text-slate-600 group-hover:text-primary" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-slate-800 leading-snug">{row.subject_name}</p>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    {row.quizCount > 0
                      ? `${row.quizCount} quiz${row.quizCount > 1 ? 'zes' : ''} pending · ${row.tag}`
                      : `Start a practice quiz · ${row.tag}`}
                  </p>
                </div>
                <ArrowRight className="w-4 h-4 text-slate-300 group-hover:text-primary shrink-0 mt-0.5" />
              </button>
            ))}
            {practiceRows.length === 0 && (
              <p className="text-sm text-slate-400 text-center py-8">No subjects enrolled</p>
            )}
          </div>
          <button
            type="button"
            onClick={() => navigate('/student/performance')}
            className="mt-4 text-xs font-semibold text-primary hover:text-primary-dark text-center w-full py-2"
          >
            View all topics
          </button>
        </div>
      </section>

      {/* FAB — AI Tutor */}
      <button
        type="button"
        onClick={() => navigate('/student/ai-tutor')}
        className="fixed bottom-6 right-6 z-30 w-12 h-12 rounded-full bg-slate-900 text-white shadow-lg shadow-slate-900/25 flex items-center justify-center hover:bg-slate-800 hover:scale-105 transition-all lg:right-10"
        aria-label="Open AI Tutor"
      >
        <Bot className="w-5 h-5" />
      </button>
    </div>
  );
}
