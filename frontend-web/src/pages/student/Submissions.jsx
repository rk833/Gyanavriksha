import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Calendar,
  TrendingUp,
  Zap,
  Eye,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { getSubmissions, getSubjects, getDashboard } from '../../services/studentService';

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
                    <button className="text-xs text-primary hover:underline flex items-center gap-1">
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
    </div>
  );
}
