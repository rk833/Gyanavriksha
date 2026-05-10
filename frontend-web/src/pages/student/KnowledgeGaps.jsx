import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { fmtDate } from '../../utils/dateUtils';
import {
  AlertCircle,
  CheckCircle,
  Clock,
  BookOpen,
  BarChart3,
  Sparkles,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { getKnowledgeGaps, getKnowledgeGapSummary, getSubjects } from '../../services/studentService';

export default function StudentKnowledgeGaps() {
  const navigate = useNavigate();
  const [gaps, setGaps] = useState([]);
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all'); // all, pending, resolved

  const [subjects, setSubjects] = useState([]);
  const [genSubjectId, setGenSubjectId] = useState('');
  const [genConcept, setGenConcept] = useState('');
  const [topicQuizOpen, setTopicQuizOpen] = useState(true);
  /** '' = all subjects; otherwise subjectFilterKey from subjectOptions */
  const [subjectFilterKey, setSubjectFilterKey] = useState('');

  useEffect(() => {
    const params = {};
    if (filter === 'pending') params.resolved = false;
    if (filter === 'resolved') params.resolved = true;

    Promise.all([
      getKnowledgeGaps(params).then((r) => setGaps(r.data.items || [])),
      getKnowledgeGapSummary().then((r) => setSummary(r.data)),
    ])
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [filter]);

  useEffect(() => {
    getSubjects()
      .then((r) => {
        const raw = r.data;
        const items = Array.isArray(raw) ? raw : raw?.items ?? [];
        setSubjects(items);
        setGenSubjectId((prev) => {
          if (prev) return prev;
          if (items.length > 0) return String(items[0].subject_id);
          return '';
        });
      })
      .catch(() => {});
  }, []);

  const startTopicQuiz = () => {
    const concept = genConcept.trim();
    if (!concept || !genSubjectId) return;
    navigate(
      `/student/micro-quiz?concept=${encodeURIComponent(concept)}&subject_id=${encodeURIComponent(genSubjectId)}`
    );
  };

  const subjectOptions = useMemo(() => {
    const seen = new Map();
    for (const g of gaps) {
      const name = g.subject_name || 'Unknown';
      const key = g.subject_id != null ? `id:${g.subject_id}` : `name:${name}`;
      if (!seen.has(key)) seen.set(key, { key, label: name });
    }
    return [...seen.values()].sort((a, b) => a.label.localeCompare(b.label, undefined, { sensitivity: 'base' }));
  }, [gaps]);

  const activeSubjectKey =
    subjectFilterKey && subjectOptions.some((o) => o.key === subjectFilterKey) ? subjectFilterKey : '';

  const gapsForSubject = useMemo(() => {
    if (!activeSubjectKey) return gaps;
    return gaps.filter((g) => {
      if (activeSubjectKey.startsWith('id:')) {
        const id = activeSubjectKey.slice(3);
        return g.subject_id != null && String(g.subject_id) === id;
      }
      if (activeSubjectKey.startsWith('name:')) {
        const name = activeSubjectKey.slice(5);
        return (g.subject_name || 'Unknown') === name;
      }
      return true;
    });
  }, [gaps, activeSubjectKey]);

  // Group gaps by subject (after subject filter)
  const grouped = gapsForSubject.reduce((acc, g) => {
    const key = g.subject_name || 'Unknown';
    if (!acc[key]) acc[key] = [];
    acc[key].push(g);
    return acc;
  }, {});

  return (
    <div>
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-primary-dark">Knowledge Gap History</h1>
        <p className="text-sm text-slate-500">
          Review your identified learning gaps and track your progress as you master challenging concepts across your curriculum.
        </p>
      </div>

      {/* Generate quiz on any topic (same flow as mobile Quizzes tab) */}
      <div className="mb-6 bg-white rounded-xl border border-primary-light overflow-hidden shadow-sm">
        <button
          type="button"
          onClick={() => setTopicQuizOpen((o) => !o)}
          className="w-full flex items-center justify-between gap-3 px-4 py-3 text-left hover:bg-slate-50/80 transition-colors"
        >
          <div className="flex items-center gap-3 min-w-0">
            <span className="w-10 h-10 rounded-full bg-primary-light flex items-center justify-center shrink-0">
              <Sparkles className="w-5 h-5 text-primary" />
            </span>
            <div className="min-w-0">
              <p className="font-semibold text-primary-dark text-sm">Generate quiz on a topic</p>
              <p className="text-xs text-slate-500 truncate">
                Pick a subject, enter any concept—the AI builds a short micro-quiz (like the mobile app).
              </p>
            </div>
          </div>
          {topicQuizOpen ? (
            <ChevronUp className="w-5 h-5 text-slate-400 shrink-0" />
          ) : (
            <ChevronDown className="w-5 h-5 text-slate-400 shrink-0" />
          )}
        </button>
        {topicQuizOpen && (
          <div className="px-4 pb-4 pt-0 border-t border-primary-light/60 bg-slate-50/50">
            <div className="pt-4 flex flex-col sm:flex-row sm:items-end gap-3">
              <label className="flex-1 min-w-0 block text-xs font-medium text-slate-600">
                Subject
                <select
                  value={genSubjectId}
                  onChange={(e) => setGenSubjectId(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-primary-light bg-white px-3 py-2 text-sm text-primary-dark focus:outline-none focus:ring-2 focus:ring-primary/25"
                  disabled={subjects.length === 0}
                >
                  {subjects.length === 0 ? (
                    <option value="">No subjects enrolled</option>
                  ) : (
                    subjects.map((s) => (
                      <option key={s.subject_id} value={String(s.subject_id)}>
                        {s.subject_name}
                      </option>
                    ))
                  )}
                </select>
              </label>
              <label className="flex-[1.2] min-w-0 block text-xs font-medium text-slate-600">
                Concept or topic
                <input
                  type="text"
                  value={genConcept}
                  onChange={(e) => setGenConcept(e.target.value)}
                  placeholder="e.g. Newton's second law"
                  className="mt-1 w-full rounded-lg border border-primary-light bg-white px-3 py-2 text-sm text-primary-dark placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-primary/25"
                />
              </label>
              <button
                type="button"
                onClick={startTopicQuiz}
                disabled={!genConcept.trim() || !genSubjectId || subjects.length === 0}
                className="shrink-0 inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-primary-dark text-white text-sm font-semibold hover:bg-primary transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <BookOpen className="w-4 h-4" />
                Start quiz
              </button>
            </div>
            <p className="mt-2 text-[11px] text-slate-500">
              Generation streams in the next screen and may take up to a minute. Your gap list below is for detected weak areas; this option is for any topic you choose.
            </p>
          </div>
        )}
      </div>

      {/* Summary cards */}
      {summary && (
        <div className="grid grid-cols-3 gap-4 mb-6">
          <div className="bg-white rounded-xl border border-primary-light p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center">
              <AlertCircle className="w-5 h-5 text-slate-500" />
            </div>
            <div>
              <p className="text-xs text-slate-500 uppercase tracking-wider">Total Gaps Detected</p>
              <p className="text-2xl font-bold text-primary-dark">{summary.total_gaps}</p>
            </div>
          </div>
          <div className="bg-white rounded-xl border border-primary-light p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center">
              <CheckCircle className="w-5 h-5 text-green-600" />
            </div>
            <div>
              <p className="text-xs text-slate-500 uppercase tracking-wider">Gaps Resolved</p>
              <p className="text-2xl font-bold text-green-600">{summary.gaps_resolved}</p>
            </div>
          </div>
          <div className="bg-white rounded-xl border border-primary-light p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-accent/10 flex items-center justify-center">
              <Clock className="w-5 h-5 text-accent" />
            </div>
            <div>
              <p className="text-xs text-slate-500 uppercase tracking-wider">Pending Gaps</p>
              <p className="text-2xl font-bold text-accent">{summary.gaps_pending}</p>
            </div>
          </div>
        </div>
      )}

      {/* Filter: status + subject */}
      <div className="flex flex-col sm:flex-row sm:flex-wrap sm:items-center gap-3 mb-5">
        <div className="flex gap-2 flex-wrap">
          {[
            { key: 'all', label: 'All' },
            { key: 'pending', label: 'Pending' },
            { key: 'resolved', label: 'Resolved' },
          ].map((tab) => (
            <button
              key={tab.key}
              type="button"
              onClick={() => setFilter(tab.key)}
              className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                filter === tab.key
                  ? 'bg-primary-dark text-white'
                  : 'bg-white border border-primary-light text-slate-600 hover:bg-primary-50'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
        <label className="flex items-center gap-2 text-sm text-slate-600 sm:ml-auto min-w-0">
          <span className="shrink-0 font-medium whitespace-nowrap">Subject</span>
          <select
            value={activeSubjectKey}
            onChange={(e) => setSubjectFilterKey(e.target.value)}
            className="min-w-[10rem] max-w-full rounded-lg border border-primary-light bg-white px-3 py-1.5 text-sm text-primary-dark focus:outline-none focus:ring-2 focus:ring-primary/25"
            disabled={loading || gaps.length === 0}
          >
            <option value="">All subjects</option>
            {subjectOptions.map((opt) => (
              <option key={opt.key} value={opt.key}>
                {opt.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      {/* Grouped gaps */}
      {loading ? (
        <div className="space-y-4">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="animate-pulse bg-white rounded-xl border border-primary-light p-5 h-20" />
          ))}
        </div>
      ) : Object.keys(grouped).length === 0 ? (
        <div className="text-center py-12 bg-white rounded-xl border border-primary-light">
          <CheckCircle className="w-12 h-12 text-green-300 mx-auto mb-3" />
          <p className="text-slate-500">
            {gaps.length === 0
              ? filter === 'all'
                ? 'No knowledge gaps detected yet.'
                : `No ${filter} gaps found.`
              : activeSubjectKey
                ? 'No gaps for this subject with the current filter.'
                : 'No gaps to show.'}
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {Object.entries(grouped).map(([subject, subjectGaps]) => (
            <div key={subject}>
              <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">{subject}</h3>
              <div className="space-y-2">
                {subjectGaps.map((gap) => (
                  <div
                    key={gap.gap_id}
                    className="bg-white rounded-xl border border-primary-light p-4 flex items-center justify-between hover:shadow-sm transition-shadow"
                  >
                    <div className="flex items-center gap-3">
                      <div className={`w-2 h-2 rounded-full flex-shrink-0 ${gap.is_resolved ? 'bg-green-500' : 'bg-accent'}`} />
                      <div>
                        <p className="font-medium text-primary-dark text-sm">{gap.concept_name}</p>
                        <div className="flex items-center gap-3 mt-0.5">
                          <span className="text-xs text-slate-400">
                            {fmtDate(gap.detected_at)}
                          </span>
                          <span className={`text-xs px-1.5 py-0.5 rounded ${
                            gap.recurrence_count > 2
                              ? 'bg-red-100 text-red-600'
                              : gap.recurrence_count > 1
                              ? 'bg-accent/10 text-accent'
                              : 'bg-slate-100 text-slate-500'
                          }`}>
                            {gap.recurrence_count}x detected
                          </span>
                        </div>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        if (gap.is_resolved) {
                          navigate('/student/submissions');
                        } else if (gap.quiz_id) {
                          // Open the auto-saved micro-quiz from the database (no regeneration)
                          navigate(`/student/micro-quiz?quiz_id=${gap.quiz_id}`);
                        } else {
                          // Gap exists but quiz creation failed or is pending — generate on demand
                          navigate(
                            `/student/micro-quiz?gap_id=${gap.gap_id}&concept=${encodeURIComponent(gap.concept_name)}&subject_id=${gap.subject_id || ''}`
                          );
                        }
                      }}
                      className="text-xs bg-primary-dark text-white px-3 py-1.5 rounded-lg hover:bg-primary transition-colors"
                    >
                      {gap.is_resolved
                        ? 'Review Results'
                        : gap.quiz_id
                          ? gap.quiz_status === 'COMPLETED'
                            ? 'View Quiz'
                            : 'Open saved quiz'
                          : 'Generate quiz'}
                    </button>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Academic completion banner */}
      <div className="mt-8 bg-primary-dark rounded-xl p-5 flex items-center justify-between text-white">
        <div>
          <h3 className="font-bold text-lg">Academic Completion Progress</h3>
          <p className="text-sm text-white/70">
            You've resolved {summary?.gaps_resolved || 0} of {summary?.total_gaps || 0} identified knowledge gaps this semester. Keep going to reach your academic goals.
          </p>
        </div>
        <button
          onClick={() => navigate('/student/performance')}
          className="bg-white text-primary-dark px-4 py-2 rounded-lg text-sm font-semibold hover:bg-white/90 transition-colors flex-shrink-0"
        >
          <BarChart3 className="w-4 h-4 inline mr-1.5" />
          Detailed Analytics
        </button>
      </div>
    </div>
  );
}
