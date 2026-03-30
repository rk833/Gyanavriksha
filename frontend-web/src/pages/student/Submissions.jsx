import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Calendar,
  TrendingUp,
  Zap,
  Eye,
  ChevronLeft,
  ChevronRight,
  X,
  FileText,
  Clock,
  CheckCircle,
  AlertCircle,
  Loader2,
} from 'lucide-react';
import { getSubmissions, getSubjects, getDashboard, getSubmissionDetail, getSubmissionFeedback } from '../../services/studentService';

const STATUS_COLORS = {
  queued: 'bg-yellow-100 text-yellow-700',
  ocr: 'bg-blue-100 text-blue-700',
  grading: 'bg-purple-100 text-purple-700',
  done: 'bg-green-100 text-green-700',
  rejected: 'bg-red-100 text-red-700',
};

const GRADE_COLORS = {
  correct: 'text-green-600',
  partial: 'text-accent',
  incorrect: 'text-red-600',
};

export default function StudentSubmissions() {
  const navigate = useNavigate();
  const [submissions, setSubmissions] = useState([]);
  const [subjects, setSubjects] = useState([]);
  const [dashboard, setDashboard] = useState(null);
  const [loading, setLoading] = useState(true);
  const [subjectFilter, setSubjectFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const [total, setTotal] = useState(0);
  const [selectedSubmission, setSelectedSubmission] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);

  const openDetail = async (submissionId) => {
    setDetailLoading(true);
    setSelectedSubmission({ loading: true });
    try {
      const [detailRes, feedbackRes] = await Promise.allSettled([
        getSubmissionDetail(submissionId),
        getSubmissionFeedback(submissionId),
      ]);
      const detail = detailRes.status === 'fulfilled' ? detailRes.value.data : null;
      const feedback = feedbackRes.status === 'fulfilled' ? feedbackRes.value.data : null;
      setSelectedSubmission({ ...detail, feedback });
    } catch {
      setSelectedSubmission(null);
    } finally {
      setDetailLoading(false);
    }
  };

  useEffect(() => {
    Promise.all([
      getSubjects().then((r) => setSubjects(r.data || [])),
      getDashboard().then((r) => setDashboard(r.data)),
    ]).catch(() => {});
  }, []);

  useEffect(() => {
    setLoading(true);
    const params = { page, per_page: 10 };
    if (subjectFilter) params.subject_id = subjectFilter;
    if (statusFilter) params.status = statusFilter;

    getSubmissions(params)
      .then((r) => {
        setSubmissions(r.data.items || []);
        setTotalPages(r.data.total_pages || 0);
        setTotal(r.data.total || 0);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [page, subjectFilter, statusFilter]);

  const avgScore = dashboard?.average_score;

  return (
    <div>
      {/* Header + stats */}
      <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-primary-dark">My Submissions</h1>
          <p className="text-sm text-slate-500">Review your academic journey and performance analytics.</p>
        </div>
        <div className="flex gap-3">
          {avgScore !== null && avgScore !== undefined && (
            <div className="bg-white rounded-xl border border-primary-light px-4 py-3 text-center">
              <p className="text-xs text-slate-500 uppercase tracking-wider">Current Score</p>
              <p className="text-xl font-bold text-primary-dark flex items-center gap-1">
                <TrendingUp className="w-4 h-4 text-primary" />
                {avgScore.toFixed(1)}
              </p>
            </div>
          )}
          <div className="bg-primary-dark rounded-xl px-4 py-3 text-center text-white">
            <p className="text-xs uppercase tracking-wider text-white/70">Resolve Streak</p>
            <p className="text-xl font-bold flex items-center gap-1">
              <Zap className="w-4 h-4 text-accent" />
              12 Days
            </p>
            <p className="text-[10px] text-white/50">Keep going!</p>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 mb-4">
        <select
          value={subjectFilter}
          onChange={(e) => { setSubjectFilter(e.target.value); setPage(1); }}
          className="border border-primary-light rounded-lg px-3 py-2 text-sm bg-white focus:ring-2 focus:ring-primary/30 focus:border-primary outline-none"
        >
          <option value="">All Subjects</option>
          {subjects.map((s) => (
            <option key={s.subject_id} value={s.subject_id}>{s.subject_name}</option>
          ))}
        </select>
        <select
          value={statusFilter}
          onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
          className="border border-primary-light rounded-lg px-3 py-2 text-sm bg-white focus:ring-2 focus:ring-primary/30 focus:border-primary outline-none"
        >
          <option value="">All Status</option>
          <option value="done">Graded</option>
          <option value="queued">Queued</option>
          <option value="ocr">OCR Processing</option>
          <option value="grading">Grading</option>
          <option value="rejected">Rejected</option>
        </select>
      </div>

      {/* Submissions table */}
      {loading ? (
        <div className="space-y-3">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="animate-pulse bg-white rounded-xl border border-primary-light p-5 h-14" />
          ))}
        </div>
      ) : submissions.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-xl border border-primary-light">
          <p className="text-slate-400">No submissions yet. Submit your first assignment!</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-primary-light overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-slate-500 uppercase tracking-wider border-b border-primary-light bg-primary-50">
                <th className="px-5 py-3">Date</th>
                <th className="px-5 py-3">Subject</th>
                <th className="px-5 py-3 hidden md:table-cell">Assignment</th>
                <th className="px-5 py-3">Score</th>
                <th className="px-5 py-3">Status</th>
                <th className="px-5 py-3">Action</th>
              </tr>
            </thead>
            <tbody>
              {submissions.map((s) => (
                <tr key={s.submission_id} className="border-b border-slate-50 hover:bg-primary-50/30">
                  <td className="px-5 py-3.5 text-slate-600">
                    {new Date(s.submitted_at).toLocaleDateString()}
                  </td>
                  <td className="px-5 py-3.5 font-medium text-primary-dark">{s.subject_name || '—'}</td>
                  <td className="px-5 py-3.5 text-slate-600 hidden md:table-cell">{s.assignment_title || '—'}</td>
                  <td className="px-5 py-3.5">
                    {s.score_percentage !== null && s.score_percentage !== undefined ? (
                      <span className={`font-semibold ${GRADE_COLORS[s.grade_classification] || 'text-slate-700'}`}>
                        {s.score_percentage.toFixed(0)}%
                      </span>
                    ) : (
                      <span className="text-slate-400">—</span>
                    )}
                  </td>
                  <td className="px-5 py-3.5">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLORS[s.processing_status] || 'bg-slate-100 text-slate-600'}`}>
                      {s.processing_status}
                    </span>
                  </td>
                  <td className="px-5 py-3.5">
                    <button
                      onClick={() => openDetail(s.submission_id)}
                      className="text-xs text-primary hover:underline flex items-center gap-1"
                    >
                      <Eye className="w-3 h-3" />
                      View
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between mt-4">
          <p className="text-xs text-slate-500">
            Showing page {page} of {totalPages} ({total} submissions)
          </p>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              className="p-1.5 rounded-lg border border-primary-light hover:bg-primary-50 disabled:opacity-30"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            {[...Array(Math.min(totalPages, 5))].map((_, i) => (
              <button
                key={i}
                onClick={() => setPage(i + 1)}
                className={`w-8 h-8 rounded-lg text-sm font-medium transition-colors ${
                  page === i + 1
                    ? 'bg-primary-dark text-white'
                    : 'border border-primary-light text-slate-600 hover:bg-primary-50'
                }`}
              >
                {i + 1}
              </button>
            ))}
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              className="p-1.5 rounded-lg border border-primary-light hover:bg-primary-50 disabled:opacity-30"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Submission Detail Modal */}
      {selectedSubmission && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/30" onClick={() => setSelectedSubmission(null)} />
          <div className="relative bg-white rounded-xl border border-primary-light shadow-xl w-full max-w-lg max-h-[80vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b border-primary-light px-5 py-4 flex items-center justify-between rounded-t-xl">
              <h3 className="font-bold text-primary-dark">Submission Details</h3>
              <button
                onClick={() => setSelectedSubmission(null)}
                className="p-1 rounded-lg hover:bg-slate-100"
              >
                <X className="w-5 h-5 text-slate-400" />
              </button>
            </div>

            {selectedSubmission.loading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-8 h-8 text-primary animate-spin" />
              </div>
            ) : (
              <div className="p-5 space-y-4">
                {/* Assignment info */}
                <div>
                  <p className="text-xs text-slate-500 uppercase tracking-wider mb-1">Assignment</p>
                  <p className="font-semibold text-primary-dark">{selectedSubmission.assignment_title || 'N/A'}</p>
                  <p className="text-sm text-slate-500">{selectedSubmission.subject_name || ''}</p>
                </div>

                {/* Status & Score */}
                <div className="flex gap-3">
                  <div className="flex-1 bg-primary-50 rounded-lg p-3">
                    <p className="text-xs text-slate-500 mb-1">Status</p>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLORS[selectedSubmission.processing_status] || 'bg-slate-100 text-slate-600'}`}>
                      {selectedSubmission.processing_status || 'unknown'}
                    </span>
                  </div>
                  <div className="flex-1 bg-primary-50 rounded-lg p-3">
                    <p className="text-xs text-slate-500 mb-1">Score</p>
                    <p className="font-bold text-primary-dark text-lg">
                      {selectedSubmission.score_percentage != null
                        ? `${selectedSubmission.score_percentage.toFixed(0)}%`
                        : 'Pending'}
                    </p>
                  </div>
                </div>

                {/* Submitted at */}
                <div className="flex items-center gap-2 text-sm text-slate-500">
                  <Clock className="w-4 h-4" />
                  <span>Submitted: {new Date(selectedSubmission.submitted_at).toLocaleString()}</span>
                </div>

                {/* Uploaded files */}
                {selectedSubmission.uploaded_files && selectedSubmission.uploaded_files.length > 0 && (
                  <div>
                    <p className="text-xs text-slate-500 uppercase tracking-wider mb-2">Uploaded Files</p>
                    <div className="space-y-1.5">
                      {selectedSubmission.uploaded_files.map((f, i) => (
                        <div key={i} className="flex items-center gap-2 text-sm bg-slate-50 rounded-lg px-3 py-2">
                          <FileText className="w-4 h-4 text-primary" />
                          <span className="text-slate-700 truncate">{f}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Feedback */}
                {selectedSubmission.feedback ? (
                  <div className="border-t border-primary-light pt-4">
                    <p className="text-xs text-slate-500 uppercase tracking-wider mb-2">Feedback</p>
                    <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                      <div className="flex items-start gap-2">
                        <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
                        <div>
                          <p className="text-sm font-medium text-green-800 mb-1">
                            Score: {selectedSubmission.feedback.score_percentage?.toFixed(0)}%
                          </p>
                          {selectedSubmission.feedback.strengths && (
                            <p className="text-sm text-green-700 mb-1">
                              <strong>Strengths:</strong> {selectedSubmission.feedback.strengths}
                            </p>
                          )}
                          {selectedSubmission.feedback.improvements && (
                            <p className="text-sm text-green-700">
                              <strong>To improve:</strong> {selectedSubmission.feedback.improvements}
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                ) : selectedSubmission.processing_status !== 'done' ? (
                  <div className="border-t border-primary-light pt-4">
                    <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 flex items-center gap-2">
                      <AlertCircle className="w-5 h-5 text-yellow-600 flex-shrink-0" />
                      <p className="text-sm text-yellow-700">
                        Feedback will be available once grading is complete.
                      </p>
                    </div>
                  </div>
                ) : null}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
