import { useState, useEffect, useCallback } from 'react';
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
} from 'lucide-react';
import toast from 'react-hot-toast';
import {
  getSubmissions,
  getSubmissionDetail,
  overrideFeedback,
  getSubjects,
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

function FeedbackPanel({ submission, onClose, onSaved }) {
  const [form, setForm] = useState({
    score_percentage: submission.score_percentage || '',
    overall_feedback: submission.feedback?.overall_feedback || '',
    strengths: submission.feedback?.strengths || '',
    improvements: submission.feedback?.improvements || '',
    instructor_comments: submission.feedback?.instructor_comments || '',
  });
  const [saving, setSaving] = useState(false);

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
      onSaved();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to save feedback');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-black/30" onClick={onClose} />
      <div className="relative bg-white w-full max-w-lg shadow-xl overflow-y-auto">
        <div className="p-5 border-b border-primary-light flex items-center justify-between sticky top-0 bg-white z-10">
          <h2 className="text-lg font-bold text-primary-dark">Submission Review</h2>
          <button onClick={onClose} className="p-1 rounded hover:bg-slate-100">
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
                <p className="text-xs text-slate-500">{submission.student_email}</p>
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

          {/* Existing AI Feedback */}
          {submission.feedback && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <h4 className="text-sm font-semibold text-blue-800 mb-2">AI Feedback</h4>
              <p className="text-sm text-blue-700">{submission.feedback.overall_feedback}</p>
              {submission.feedback.score_percentage != null && (
                <p className="text-sm text-blue-700 mt-1">AI Score: {submission.feedback.score_percentage}%</p>
              )}
            </div>
          )}

          {/* Override Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            <h4 className="text-sm font-semibold text-primary-dark flex items-center gap-2">
              <MessageSquare className="w-4 h-4" /> Instructor Override
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

  const page = Number(searchParams.get('page')) || 1;
  const statusFilter = searchParams.get('status') || '';
  const subjectFilter = searchParams.get('subject_id') || '';
  const perPage = 20;
  const totalPages = Math.ceil(total / perPage);

  const fetchSubmissions = useCallback(async () => {
    setLoading(true);
    try {
      const params = { page, per_page: perPage };
      if (statusFilter) params.status = statusFilter;
      if (subjectFilter) params.subject_id = Number(subjectFilter);
      const res = await getSubmissions(params);
      setSubmissions(res.data.items || []);
      setTotal(res.data.total || 0);
    } catch {
      toast.error('Failed to load submissions');
    } finally {
      setLoading(false);
    }
  }, [page, statusFilter, subjectFilter]);

  useEffect(() => { fetchSubmissions(); }, [fetchSubmissions]);
  useEffect(() => { getSubjects().then((r) => setSubjects(r.data || [])).catch(() => {}); }, []);

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
      <div className="flex flex-wrap items-center gap-3 mb-6">
        <select
          value={statusFilter}
          onChange={(e) => setFilter('status', e.target.value)}
          className="px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
        >
          <option value="">All Status</option>
          <option value="queued">Queued</option>
          <option value="ocr">OCR</option>
          <option value="grading">Grading</option>
          <option value="done">Done</option>
          <option value="rejected">Rejected</option>
        </select>

        <select
          value={subjectFilter}
          onChange={(e) => setFilter('subject_id', e.target.value)}
          className="px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
        >
          <option value="">All Subjects</option>
          {subjects.map((s) => (
            <option key={s.subject_id} value={s.subject_id}>{s.subject_name}</option>
          ))}
        </select>

        <span className="text-sm text-slate-500 ml-auto">{total} total submissions</span>
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
      ) : (
        <div className="bg-white rounded-xl border border-primary-light overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-slate-50 border-b border-primary-light">
                  <th className="text-left py-3 px-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Student</th>
                  <th className="text-left py-3 px-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Assignment</th>
                  <th className="text-left py-3 px-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Subject</th>
                  <th className="text-center py-3 px-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Status</th>
                  <th className="text-center py-3 px-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Score</th>
                  <th className="text-right py-3 px-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Submitted</th>
                  <th className="py-3 px-4"></th>
                </tr>
              </thead>
              <tbody>
                {submissions.map((s) => (
                  <tr key={s.submission_id} className="border-b border-slate-50 hover:bg-slate-50/50 transition">
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-full bg-primary-light flex items-center justify-center text-primary font-bold text-xs">
                          {s.student_name?.charAt(0)?.toUpperCase()}
                        </div>
                        <span className="text-sm text-primary-dark">{s.student_name}</span>
                      </div>
                    </td>
                    <td className="py-3 px-4 text-sm text-slate-600 max-w-[200px] truncate">{s.assignment_title}</td>
                    <td className="py-3 px-4 text-sm text-slate-500">{s.subject_name}</td>
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
          onSaved={() => { setSelectedSubmission(null); fetchSubmissions(); }}
        />
      )}
    </div>
  );
}
