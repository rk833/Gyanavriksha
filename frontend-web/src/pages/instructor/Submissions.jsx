import { useState, useEffect, useCallback, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  FileText,
  Search,
  Eye,
  MessageSquare,
  X,
  Loader2,
  ChevronLeft,
  ChevronRight,
  Save,
  Download,
  Bot,
  UserCircle,
  ListFilter,
} from 'lucide-react';
import toast from 'react-hot-toast';
import {
  getSubmissions,
  getSubmissionDetail,
  overrideFeedback,
  getSubjects,
  downloadSubmissionFile,
} from '../../services/instructorService';

function StatusBadge({ status }) {
  const styles = {
    queued: 'bg-amber-100 text-amber-700',
    ocr: 'bg-blue-100 text-blue-700',
    grading: 'bg-purple-100 text-purple-700',
    done: 'bg-green-100 text-green-700',
    rejected: 'bg-red-100 text-red-700',
  };
  return (
    <span className={`px-2 py-0.5 rounded-full text-xs font-medium capitalize ${styles[status] || 'bg-slate-100 text-slate-600'}`}>
      {status}
    </span>
  );
}

function StepSnippet({ corrections }) {
  const arr = Array.isArray(corrections) ? corrections : [];
  if (!arr.length) return null;
  return (
    <details className="text-sm mt-2 group">
      <summary className="cursor-pointer text-slate-600 font-medium list-none flex items-center gap-1 [&::-webkit-details-marker]:hidden">
        Step-by-step ({arr.length})
      </summary>
      <ol className="list-decimal pl-5 mt-2 space-y-1.5 text-slate-600 max-h-48 overflow-y-auto">
        {arr.slice(0, 20).map((s, i) => (
          <li key={i}>
            <span className="font-medium text-slate-700">{s.step ?? s.label ?? `Step ${i + 1}`}</span>
            {s.comment || s.correction ? (
              <span className="text-slate-600"> — {s.comment ?? s.correction}</span>
            ) : null}
          </li>
        ))}
      </ol>
    </details>
  );
}

function FeedbackPanel({ submission, onClose, onSaved }) {
  const hasInstructorOverride = !!submission.feedback?.graded_by;
  const aiSnapshot = submission.feedback?.ai_snapshot;
  const [gradeTab, setGradeTab] = useState(hasInstructorOverride && aiSnapshot ? 'official' : 'ai');
  const [form, setForm] = useState({
    score_percentage: submission.score_percentage ?? '',
    overall_feedback: submission.feedback?.overall_feedback || '',
    strengths: submission.feedback?.strengths || '',
    improvements: submission.feedback?.improvements || '',
    instructor_comments: submission.feedback?.instructor_comments || '',
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setGradeTab(submission.feedback?.graded_by && submission.feedback?.ai_snapshot ? 'official' : 'ai');
    setForm({
      score_percentage: submission.score_percentage ?? '',
      overall_feedback: submission.feedback?.overall_feedback || '',
      strengths: submission.feedback?.strengths || '',
      improvements: submission.feedback?.improvements || '',
      instructor_comments: submission.feedback?.instructor_comments || '',
    });
  }, [
    submission.submission_id,
    submission.score_percentage,
    submission.feedback?.feedback_id,
    submission.feedback?.graded_by,
  ]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await overrideFeedback(submission.submission_id, {
        score_percentage: Number(form.score_percentage),
        overall_feedback: form.overall_feedback || null,
        strengths: form.strengths || null,
        improvements: form.improvements || null,
        instructor_comments: form.instructor_comments || null,
      });
      toast.success('Feedback saved');
      await onSaved();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to save feedback');
    } finally {
      setSaving(false);
    }
  };

  const fileLabel = (f, i) => {
    if (f == null) return `file-${i}`;
    if (typeof f === 'string') return f;
    return f.name || `file-${i}`;
  };

  const fileIdx = (f, i) => (f && typeof f === 'object' && typeof f.index === 'number' ? f.index : i);

  const downloadFile = async (idx, name) => {
    try {
      await downloadSubmissionFile(submission.submission_id, idx, name);
    } catch {
      toast.error('Could not download file');
    }
  };

  const liveAiBlock = submission.feedback && !hasInstructorOverride
    ? {
        score_percentage: submission.feedback.score_percentage,
        overall_feedback: submission.feedback.overall_feedback,
        strengths: submission.feedback.strengths,
        improvements: submission.feedback.improvements,
        step_by_step_corrections: submission.feedback.step_by_step_corrections,
      }
    : null;

  const snapshotBlock = aiSnapshot && typeof aiSnapshot === 'object' ? aiSnapshot : null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-black/30" onClick={onClose} />
      <div className="relative bg-white w-full max-w-2xl shadow-xl overflow-y-auto">
        <div className="p-5 border-b border-primary-light flex items-center justify-between sticky top-0 bg-white z-10">
          <h2 className="text-lg font-bold text-primary-dark">Submission Review</h2>
          <button type="button" onClick={onClose} className="p-1 rounded hover:bg-slate-100">
            <X className="w-5 h-5 text-slate-500" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          {/* Student info */}
          <div className="bg-slate-50 rounded-lg p-4">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 rounded-full bg-primary-light flex items-center justify-center text-primary font-bold">
                {submission.student_name?.charAt(0)?.toUpperCase()}
              </div>
              <div>
                <p className="text-sm font-semibold text-primary-dark">{submission.student_name}</p>
                <p className="text-xs text-slate-500">{submission.student_email || '—'}</p>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2 mt-3">
              <div>
                <p className="text-xs text-slate-500">Assignment</p>
                <p className="text-sm font-medium text-primary-dark">{submission.assignment_title}</p>
              </div>
              <div>
                <p className="text-xs text-slate-500">Subject</p>
                <p className="text-sm font-medium text-primary-dark">{submission.subject_name}</p>
              </div>
              <div className="col-span-2">
                <p className="text-xs text-slate-500">Assignment owner</p>
                <p className="text-sm font-medium text-primary-dark">{submission.assignment_instructor_name || '—'}</p>
              </div>
              <div>
                <p className="text-xs text-slate-500">Status</p>
                <StatusBadge status={submission.processing_status} />
              </div>
              <div>
                <p className="text-xs text-slate-500">Submitted</p>
                <p className="text-sm text-primary-dark">{new Date(submission.submitted_at).toLocaleString()}</p>
              </div>
            </div>
          </div>

          {/* Uploaded files */}
          {submission.uploaded_files && submission.uploaded_files.length > 0 && (
            <div>
              <h4 className="text-sm font-semibold text-primary-dark mb-2">Student uploads</h4>
              <ul className="space-y-2">
                {submission.uploaded_files.map((f, i) => {
                  const idx = fileIdx(f, i);
                  const label = fileLabel(f, i);
                  return (
                    <li key={`${idx}-${label}`} className="flex items-center justify-between gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm">
                      <span className="flex items-center gap-2 min-w-0 text-slate-700">
                        <FileText className="w-4 h-4 text-primary shrink-0" />
                        <span className="truncate" title={label}>{label}</span>
                      </span>
                      <button
                        type="button"
                        onClick={() => downloadFile(idx, label)}
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

          {/* Official vs AI */}
          {submission.feedback && (
            <div className="space-y-3">
              <h4 className="text-sm font-semibold text-primary-dark">Grading</h4>
              {hasInstructorOverride && snapshotBlock && (
                <>
                  <div className="flex rounded-lg border border-slate-200 p-0.5 bg-slate-50">
                    <button
                      type="button"
                      onClick={() => setGradeTab('official')}
                      className={`flex-1 flex items-center justify-center gap-1.5 py-2 text-xs font-semibold rounded-md transition ${
                        gradeTab === 'official' ? 'bg-white text-primary-dark shadow-sm' : 'text-slate-500 hover:text-slate-700'
                      }`}
                    >
                      <UserCircle className="w-3.5 h-3.5" />
                      Instructor (official)
                    </button>
                    <button
                      type="button"
                      onClick={() => setGradeTab('ai')}
                      className={`flex-1 flex items-center justify-center gap-1.5 py-2 text-xs font-semibold rounded-md transition ${
                        gradeTab === 'ai' ? 'bg-white text-primary-dark shadow-sm' : 'text-slate-500 hover:text-slate-700'
                      }`}
                    >
                      <Bot className="w-3.5 h-3.5" />
                      AI (original)
                    </button>
                  </div>
                  {gradeTab === 'official' ? (
                    <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4">
                      <p className="text-[11px] font-bold uppercase tracking-wider text-emerald-800 mb-2">Shown to student</p>
                      <p className="text-lg font-bold text-emerald-900 mb-1">
                        {submission.score_percentage != null ? `${Number(submission.score_percentage).toFixed(1)}%` : '—'}
                      </p>
                      {submission.feedback.overall_feedback && (
                        <p className="text-sm text-emerald-900/95 whitespace-pre-wrap mb-2">{submission.feedback.overall_feedback}</p>
                      )}
                      {submission.feedback.strengths && (
                        <p className="text-sm text-emerald-800 mb-1"><strong>Strengths:</strong> {submission.feedback.strengths}</p>
                      )}
                      {submission.feedback.improvements && (
                        <p className="text-sm text-emerald-800"><strong>Improvements:</strong> {submission.feedback.improvements}</p>
                      )}
                      <StepSnippet corrections={submission.feedback.step_by_step_corrections} />
                    </div>
                  ) : (
                    <div className="rounded-lg border border-blue-200 bg-blue-50 p-4">
                      <p className="text-[11px] font-bold uppercase tracking-wider text-blue-800 mb-2">AI before override</p>
                      <p className="text-lg font-bold text-blue-900 mb-1">
                        {snapshotBlock.score_percentage != null ? `${Number(snapshotBlock.score_percentage).toFixed(1)}%` : '—'}
                      </p>
                      {snapshotBlock.overall_feedback && (
                        <p className="text-sm text-blue-900/95 whitespace-pre-wrap mb-2">{snapshotBlock.overall_feedback}</p>
                      )}
                      {snapshotBlock.strengths && (
                        <p className="text-sm text-blue-800 mb-1"><strong>Strengths:</strong> {snapshotBlock.strengths}</p>
                      )}
                      {snapshotBlock.improvements && (
                        <p className="text-sm text-blue-800"><strong>Improvements:</strong> {snapshotBlock.improvements}</p>
                      )}
                      <StepSnippet corrections={snapshotBlock.step_by_step_corrections} />
                    </div>
                  )}
                </>
              )}
              {hasInstructorOverride && !snapshotBlock && (
                <>
                  <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4">
                    <p className="text-[11px] font-bold uppercase tracking-wider text-emerald-800 mb-2">Instructor (official)</p>
                    <p className="text-lg font-bold text-emerald-900 mb-1">
                      {submission.score_percentage != null ? `${Number(submission.score_percentage).toFixed(1)}%` : '—'}
                    </p>
                    {submission.feedback.overall_feedback && (
                      <p className="text-sm text-emerald-900/95 whitespace-pre-wrap mb-2">{submission.feedback.overall_feedback}</p>
                    )}
                    {submission.feedback.strengths && (
                      <p className="text-sm text-emerald-800 mb-1"><strong>Strengths:</strong> {submission.feedback.strengths}</p>
                    )}
                    {submission.feedback.improvements && (
                      <p className="text-sm text-emerald-800"><strong>Improvements:</strong> {submission.feedback.improvements}</p>
                    )}
                    <StepSnippet corrections={submission.feedback.step_by_step_corrections} />
                  </div>
                  <p className="text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                    Original AI snapshot was not stored for this submission, so the pre-override AI breakdown cannot be shown here.
                  </p>
                </>
              )}
              {!hasInstructorOverride && liveAiBlock && (
                <div className="rounded-lg border border-blue-200 bg-blue-50 p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <Bot className="w-4 h-4 text-blue-700" />
                    <p className="text-[11px] font-bold uppercase tracking-wider text-blue-800">AI grading</p>
                  </div>
                  <p className="text-lg font-bold text-blue-900 mb-1">
                    {liveAiBlock.score_percentage != null ? `${Number(liveAiBlock.score_percentage).toFixed(1)}%` : '—'}
                  </p>
                  {liveAiBlock.overall_feedback && (
                    <p className="text-sm text-blue-900/95 whitespace-pre-wrap mb-2">{liveAiBlock.overall_feedback}</p>
                  )}
                  {liveAiBlock.strengths && (
                    <p className="text-sm text-blue-800 mb-1"><strong>Strengths:</strong> {liveAiBlock.strengths}</p>
                  )}
                  {liveAiBlock.improvements && (
                    <p className="text-sm text-blue-800"><strong>Improvements:</strong> {liveAiBlock.improvements}</p>
                  )}
                  <StepSnippet corrections={liveAiBlock.step_by_step_corrections} />
                </div>
              )}
            </div>
          )}

          {/* Override Form */}
          <form onSubmit={handleSubmit} className="space-y-4 border-t border-primary-light pt-4">
            <h4 className="text-sm font-semibold text-primary-dark flex items-center gap-2">
              <MessageSquare className="w-4 h-4" /> Instructor override
            </h4>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Score (%)</label>
              <input
                type="number"
                min="0"
                max="100"
                step="0.1"
                required
                value={form.score_percentage}
                onChange={(e) => setForm({ ...form, score_percentage: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Overall Feedback</label>
              <textarea
                value={form.overall_feedback}
                onChange={(e) => setForm({ ...form, overall_feedback: e.target.value })}
                rows={3}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary resize-none"
                placeholder="General feedback for the student..."
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Strengths</label>
                <textarea
                  value={form.strengths}
                  onChange={(e) => setForm({ ...form, strengths: e.target.value })}
                  rows={2}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary resize-none"
                  placeholder="What they did well..."
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Improvements</label>
                <textarea
                  value={form.improvements}
                  onChange={(e) => setForm({ ...form, improvements: e.target.value })}
                  rows={2}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary resize-none"
                  placeholder="Areas to improve..."
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Private Comments</label>
              <textarea
                value={form.instructor_comments}
                onChange={(e) => setForm({ ...form, instructor_comments: e.target.value })}
                rows={2}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary resize-none"
                placeholder="Internal notes (not shown to student)..."
              />
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-lg transition"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving}
                className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg text-sm hover:bg-primary/90 transition disabled:opacity-50"
              >
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                Save Feedback
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

export default function InstructorSubmissions() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [submissions, setSubmissions] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [subjects, setSubjects] = useState([]);
  const [selectedSubmission, setSelectedSubmission] = useState(null);
  const [localSearch, setLocalSearch] = useState('');
  const [scoreBand, setScoreBand] = useState('all');

  const page = Number(searchParams.get('page')) || 1;
  const statusFilter = searchParams.get('status') || '';
  const subjectFilter = searchParams.get('subject_id') || '';
  const assignmentFilter = searchParams.get('assignment_id') || '';
  const perPage = 20;
  const totalPages = Math.ceil(total / perPage);

  const fetchSubmissions = useCallback(async () => {
    setLoading(true);
    try {
      const params = { page, per_page: perPage };
      if (statusFilter) params.status = statusFilter;
      if (subjectFilter) params.subject_id = Number(subjectFilter);
      if (assignmentFilter) params.assignment_id = assignmentFilter;
      const res = await getSubmissions(params);
      setSubmissions(res.data.items || []);
      setTotal(res.data.total || 0);
    } catch {
      toast.error('Failed to load submissions');
    } finally {
      setLoading(false);
    }
  }, [page, statusFilter, subjectFilter, assignmentFilter]);

  useEffect(() => { fetchSubmissions(); }, [fetchSubmissions]);
  useEffect(() => { getSubjects().then((r) => setSubjects(r.data || [])).catch(() => {}); }, []);

  useEffect(() => {
    setLocalSearch('');
    setScoreBand('all');
  }, [statusFilter, subjectFilter, assignmentFilter]);

  const filteredSubmissions = useMemo(() => {
    const q = localSearch.trim().toLowerCase();
    return submissions.filter((s) => {
      const pct = s.score_percentage != null ? Number(s.score_percentage) : null;
      if (scoreBand === 'has_score' && pct == null) return false;
      if (scoreBand === 'no_score' && pct != null) return false;
      if (scoreBand === 'high' && (pct == null || pct < 70)) return false;
      if (scoreBand === 'mid' && (pct == null || pct < 50 || pct >= 70)) return false;
      if (scoreBand === 'low' && (pct == null || pct >= 50)) return false;
      if (q) {
        const blob = `${s.student_name ?? ''} ${s.student_email ?? ''} ${s.assignment_title ?? ''} ${s.subject_name ?? ''} ${s.assignment_instructor_name ?? ''}`.toLowerCase();
        if (!blob.includes(q)) return false;
      }
      return true;
    });
  }, [submissions, localSearch, scoreBand]);

  const hasLocalFilters = Boolean(localSearch.trim()) || scoreBand !== 'all';

  const openDetail = async (id) => {
    try {
      const res = await getSubmissionDetail(id);
      setSelectedSubmission(res.data);
    } catch {
      toast.error('Failed to load submission');
    }
  };

  const setFilter = (key, value) => {
    const params = new URLSearchParams(searchParams);
    if (value) params.set(key, value);
    else params.delete(key);
    params.set('page', '1');
    setSearchParams(params);
  };

  const goToPage = (p) => {
    const params = new URLSearchParams(searchParams);
    params.set('page', String(p));
    setSearchParams(params);
  };

  return (
    <div>
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 rounded-lg bg-primary-light flex items-center justify-center">
          <FileText className="w-5 h-5 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-primary-dark">Submissions</h1>
          <p className="text-sm text-slate-500">Review student submissions and provide feedback.</p>
        </div>
      </div>

      {/* Filters */}
      <div className="mb-6 p-3 bg-slate-50/80 rounded-xl border border-slate-100 flex flex-col lg:flex-row flex-wrap items-stretch lg:items-center gap-2 lg:gap-3">
        <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-500 uppercase tracking-wide shrink-0">
          <ListFilter className="w-3.5 h-3.5" />
          Filter
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setFilter('status', e.target.value)}
          className="flex-1 min-w-[120px] lg:max-w-[160px] px-3 py-2 border border-primary-light rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-primary/25 focus:border-primary"
          aria-label="Processing status"
        >
          <option value="">All status</option>
          <option value="queued">Queued</option>
          <option value="ocr">OCR</option>
          <option value="grading">Grading</option>
          <option value="done">Done</option>
          <option value="rejected">Rejected</option>
        </select>

        <select
          value={subjectFilter}
          onChange={(e) => setFilter('subject_id', e.target.value)}
          className="flex-1 min-w-[120px] lg:max-w-[200px] px-3 py-2 border border-primary-light rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-primary/25 focus:border-primary"
          aria-label="Subject"
        >
          <option value="">All subjects</option>
          {subjects.map((s) => (
            <option key={s.subject_id} value={s.subject_id}>{s.subject_name}</option>
          ))}
        </select>

        <select
          value={scoreBand}
          onChange={(e) => setScoreBand(e.target.value)}
          className="flex-1 min-w-[120px] lg:max-w-[200px] px-3 py-2 border border-primary-light rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-primary/25 focus:border-primary"
          aria-label="Score band"
        >
          <option value="all">All scores</option>
          <option value="has_score">Has score</option>
          <option value="no_score">No score yet</option>
          <option value="high">Score 70%+</option>
          <option value="mid">Score 50–69%</option>
          <option value="low">Score under 50%</option>
        </select>

        <div className="relative flex-1 min-w-[200px] max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="search"
            value={localSearch}
            onChange={(e) => setLocalSearch(e.target.value)}
            placeholder="Search student, email, assignment, subject…"
            className="w-full pl-9 pr-3 py-2 border border-primary-light rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-primary/25 focus:border-primary"
            aria-label="Search submissions"
          />
        </div>

        {hasLocalFilters ? (
          <button
            type="button"
            onClick={() => { setLocalSearch(''); setScoreBand('all'); }}
            className="text-xs font-medium text-primary hover:underline whitespace-nowrap px-1 py-2 lg:py-0"
          >
            Clear local filters
          </button>
        ) : null}

        <span className="text-sm text-slate-500 lg:ml-auto lg:text-right">
          {total} total · showing {filteredSubmissions.length} on this page
        </span>
      </div>

      {/* Table */}
      {loading ? (
        <div className="bg-white rounded-xl border border-primary-light p-6 animate-pulse space-y-4">
          {[...Array(8)].map((_, i) => (
            <div key={i} className="flex items-center gap-4">
              <div className="w-8 h-8 bg-slate-200 rounded-full" />
              <div className="flex-1 h-4 bg-slate-200 rounded" />
              <div className="w-20 h-4 bg-slate-200 rounded" />
              <div className="w-16 h-4 bg-slate-200 rounded" />
            </div>
          ))}
        </div>
      ) : submissions.length === 0 ? (
        <div className="bg-white border border-primary-light rounded-xl p-12 text-center">
          <FileText className="w-12 h-12 text-slate-300 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-primary-dark mb-2">No Submissions</h3>
          <p className="text-slate-500 text-sm">No submissions match your filters.</p>
        </div>
      ) : filteredSubmissions.length === 0 ? (
        <div className="bg-white border border-primary-light rounded-xl p-12 text-center">
          <FileText className="w-12 h-12 text-slate-300 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-primary-dark mb-2">No Rows Match</h3>
          <p className="text-slate-500 text-sm mb-4">Try clearing local search or score filters.</p>
          <button
            type="button"
            onClick={() => { setLocalSearch(''); setScoreBand('all'); }}
            className="px-4 py-2 bg-slate-100 text-slate-700 rounded-lg text-sm hover:bg-slate-200 transition"
          >
            Clear local filters
          </button>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-primary-light overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-slate-50 border-b border-primary-light">
                  <th className="text-left py-3 px-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Student</th>
                  <th className="text-left py-3 px-4 text-xs font-semibold text-slate-500 uppercase tracking-wider hidden lg:table-cell">Email</th>
                  <th className="text-left py-3 px-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Assignment</th>
                  <th className="text-left py-3 px-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Subject</th>
                  <th className="text-left py-3 px-4 text-xs font-semibold text-slate-500 uppercase tracking-wider hidden xl:table-cell">Owner</th>
                  <th className="text-center py-3 px-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Status</th>
                  <th className="text-center py-3 px-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Score</th>
                  <th className="text-right py-3 px-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Submitted</th>
                  <th className="py-3 px-4"></th>
                </tr>
              </thead>
              <tbody>
                {filteredSubmissions.map((s) => (
                  <tr key={s.submission_id} className="border-b border-slate-50 hover:bg-slate-50/50 transition">
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-full bg-primary-light flex items-center justify-center text-primary font-bold text-xs">
                          {s.student_name?.charAt(0)?.toUpperCase()}
                        </div>
                        <span className="text-sm text-primary-dark">{s.student_name || '—'}</span>
                      </div>
                    </td>
                    <td className="py-3 px-4 text-xs text-slate-500 max-w-[160px] truncate hidden lg:table-cell" title={s.student_email}>
                      {s.student_email || '—'}
                    </td>
                    <td className="py-3 px-4 text-sm text-slate-600 max-w-[200px] truncate">{s.assignment_title}</td>
                    <td className="py-3 px-4 text-sm text-slate-500">{s.subject_name}</td>
                    <td className="py-3 px-4 text-xs text-slate-500 max-w-[140px] truncate hidden xl:table-cell" title={s.assignment_instructor_name}>
                      {s.assignment_instructor_name || '—'}
                    </td>
                    <td className="py-3 px-4 text-center">
                      <StatusBadge status={s.processing_status} />
                    </td>
                    <td className="py-3 px-4 text-center text-sm font-semibold text-primary-dark">
                      {s.score_percentage != null ? `${s.score_percentage}%` : '—'}
                    </td>
                    <td className="py-3 px-4 text-right text-xs text-slate-500">
                      {new Date(s.submitted_at).toLocaleDateString()}
                    </td>
                    <td className="py-3 px-4">
                      <button
                        onClick={() => openDetail(s.submission_id)}
                        className="p-1.5 rounded-lg hover:bg-primary-light text-primary transition"
                        title="Review"
                      >
                        <Eye className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 mt-6">
          <button onClick={() => goToPage(page - 1)} disabled={page <= 1} className="p-2 rounded-lg border border-slate-300 text-slate-600 hover:bg-slate-50 disabled:opacity-40">
            <ChevronLeft className="w-4 h-4" />
          </button>
          <span className="text-sm text-slate-600">Page {page} of {totalPages}</span>
          <button onClick={() => goToPage(page + 1)} disabled={page >= totalPages} className="p-2 rounded-lg border border-slate-300 text-slate-600 hover:bg-slate-50 disabled:opacity-40">
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Detail/Feedback Panel */}
      {selectedSubmission && (
        <FeedbackPanel
          submission={selectedSubmission}
          onClose={() => setSelectedSubmission(null)}
          onSaved={async () => {
            const id = selectedSubmission.submission_id;
            try {
              const res = await getSubmissionDetail(id);
              setSelectedSubmission(res.data);
            } catch {
              setSelectedSubmission(null);
            }
            fetchSubmissions();
          }}
        />
      )}
    </div>
  );
}
