import { useState, useEffect } from 'react';
import {
  AlertTriangle,
  Loader2,
  ChevronLeft,
  ChevronRight,
  AlertCircle,
  BookOpen,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { getAtRiskStudents, getSubjects } from '../../services/instructorService';

function RiskBadge({ score }) {
  const color =
    score >= 70 ? 'bg-red-100 text-red-700 border-red-200' :
    score >= 50 ? 'bg-amber-100 text-amber-700 border-amber-200' :
    'bg-yellow-100 text-yellow-700 border-yellow-200';
  return (
    <span className={`px-2 py-0.5 rounded-full text-xs font-bold border ${color}`}>
      {score.toFixed(0)}%
    </span>
  );
}

export default function AtRiskStudentsPage() {
  const [data, setData] = useState({ items: [], total: 0 });
  const [loading, setLoading] = useState(true);
  const [subjects, setSubjects] = useState([]);
  const [subjectId, setSubjectId] = useState('');
  const [page, setPage] = useState(1);
  const perPage = 20;
  const totalPages = Math.ceil(data.total / perPage);

  useEffect(() => {
    getSubjects().then((r) => setSubjects(r.data || [])).catch(() => {});
  }, []);

  useEffect(() => {
    setLoading(true);
    const params = { page, per_page: perPage };
    if (subjectId) params.subject_id = Number(subjectId);
    getAtRiskStudents(params)
      .then((res) => setData(res.data))
      .catch(() => toast.error('Failed to load at-risk students'))
      .finally(() => setLoading(false));
  }, [page, subjectId]);

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-red-50 flex items-center justify-center">
            <AlertTriangle className="w-5 h-5 text-red-500" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-primary-dark">At-Risk Students</h1>
            <p className="text-sm text-slate-500">Students who need extra attention based on performance patterns.</p>
          </div>
        </div>
        <select
          value={subjectId}
          onChange={(e) => { setSubjectId(e.target.value); setPage(1); }}
          className="px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
        >
          <option value="">All Subjects</option>
          {subjects.map((s) => (
            <option key={s.subject_id} value={s.subject_id}>{s.subject_name}</option>
          ))}
        </select>
      </div>

      {/* Info Banner */}
      <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-6 flex items-start gap-3">
        <AlertCircle className="w-5 h-5 text-amber-600 mt-0.5 shrink-0" />
        <div>
          <p className="text-sm font-medium text-amber-800">Risk Score Calculation</p>
          <p className="text-xs text-amber-700 mt-1">
            Based on three weighted factors: low average scores (&lt;50% = high), missed assignments, and inactivity (&gt;14 days = high). Students with risk score above 30% appear here.
          </p>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      ) : data.items.length === 0 ? (
        <div className="bg-white border border-primary-light rounded-xl p-12 text-center">
          <AlertTriangle className="w-12 h-12 text-green-300 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-primary-dark mb-2">No At-Risk Students</h3>
          <p className="text-slate-500 text-sm">All students are performing within acceptable parameters.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {data.items.map((student) => (
            <div
              key={student.student_id}
              className="bg-white rounded-xl border border-primary-light p-5 hover:shadow-md transition"
            >
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-red-50 flex items-center justify-center text-red-600 font-bold text-sm">
                    {student.full_name?.charAt(0)?.toUpperCase()}
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-primary-dark">{student.full_name}</h3>
                    <p className="text-xs text-slate-500">{student.email}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-xs text-slate-500 mb-1">Risk Score</p>
                  <RiskBadge score={student.risk_score} />
                </div>
              </div>

              {/* Stats */}
              <div className="grid grid-cols-3 gap-3 mb-3">
                <div className="bg-slate-50 rounded-lg p-2 text-center">
                  <p className="text-lg font-bold text-primary-dark">
                    {student.avg_score != null ? `${student.avg_score}%` : '—'}
                  </p>
                  <p className="text-xs text-slate-500">Avg Score</p>
                </div>
                <div className="bg-slate-50 rounded-lg p-2 text-center">
                  <p className="text-lg font-bold text-primary-dark">{student.total_submissions}</p>
                  <p className="text-xs text-slate-500">Submissions</p>
                </div>
                <div className="bg-slate-50 rounded-lg p-2 text-center">
                  <p className="text-lg font-bold text-red-600">{student.missed_assignments}</p>
                  <p className="text-xs text-slate-500">Missed</p>
                </div>
              </div>

              {/* Risk Factors */}
              {student.risk_factors?.length > 0 && (
                <div className="mb-3">
                  <p className="text-xs font-semibold text-slate-500 mb-1">Risk Factors</p>
                  <div className="flex flex-wrap gap-1">
                    {student.risk_factors.map((factor, i) => (
                      <span key={i} className="px-2 py-0.5 bg-red-50 text-red-700 text-xs rounded-full">
                        {factor}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Subjects at Risk */}
              {student.subjects_at_risk?.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-slate-500 mb-1">Subjects at Risk</p>
                  <div className="flex flex-wrap gap-1">
                    {student.subjects_at_risk.map((subj, i) => (
                      <span key={i} className="flex items-center gap-1 px-2 py-0.5 bg-amber-50 text-amber-700 text-xs rounded-full">
                        <BookOpen className="w-3 h-3" /> {subj}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 mt-6">
          <button onClick={() => setPage(page - 1)} disabled={page <= 1} className="p-2 rounded-lg border border-slate-300 text-slate-600 hover:bg-slate-50 disabled:opacity-40">
            <ChevronLeft className="w-4 h-4" />
          </button>
          <span className="text-sm text-slate-600">Page {page} of {totalPages}</span>
          <button onClick={() => setPage(page + 1)} disabled={page >= totalPages} className="p-2 rounded-lg border border-slate-300 text-slate-600 hover:bg-slate-50 disabled:opacity-40">
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      )}
    </div>
  );
}
