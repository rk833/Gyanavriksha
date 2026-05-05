import { useState, useEffect, useMemo } from 'react';
import {
  AlertTriangle,
  Loader2,
  ChevronLeft,
  ChevronRight,
  AlertCircle,
  BookOpen,
  ListFilter,
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
  const [riskBand, setRiskBand] = useState('all');
  const [tableQuery, setTableQuery] = useState('');
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

  useEffect(() => {
    setRiskBand('all');
    setTableQuery('');
  }, [subjectId]);

  const filteredItems = useMemo(() => {
    const items = data.items || [];
    const q = tableQuery.trim().toLowerCase();
    return items.filter((student) => {
      const score = Number(student.risk_score) || 0;
      if (riskBand === 'high' && score < 70) return false;
      if (riskBand === 'elevated' && (score < 50 || score >= 70)) return false;
      if (riskBand === 'watch' && (score < 30 || score >= 50)) return false;
      if (q) {
        const factors = (student.risk_factors || []).join(' ');
        const subs = (student.subjects_at_risk || []).join(' ');
        const blob = `${student.full_name ?? ''} ${student.email ?? ''} ${factors} ${subs}`.toLowerCase();
        if (!blob.includes(q)) return false;
      }
      return true;
    });
  }, [data.items, riskBand, tableQuery]);

  const hasListFilters = riskBand !== 'all' || Boolean(tableQuery.trim());

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
          <div className="flex flex-col sm:flex-row flex-wrap items-stretch sm:items-center gap-2 sm:gap-3 p-3 bg-slate-50/80 rounded-xl border border-slate-100">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-500 uppercase tracking-wide shrink-0">
              <ListFilter className="w-3.5 h-3.5" />
              Filter
            </div>
            <select
              value={riskBand}
              onChange={(e) => setRiskBand(e.target.value)}
              className="flex-1 min-w-[140px] sm:max-w-[200px] border border-primary-light rounded-lg px-2.5 py-2 text-sm bg-white text-primary-dark focus:ring-2 focus:ring-primary/25 focus:border-primary outline-none"
              aria-label="Filter by risk level"
            >
              <option value="all">All risk levels</option>
              <option value="high">High (70%+)</option>
              <option value="elevated">Elevated (50–69%)</option>
              <option value="watch">Watch (30–49%)</option>
            </select>
            <input
              type="search"
              value={tableQuery}
              onChange={(e) => setTableQuery(e.target.value)}
              placeholder="Search name, email, factors, subjects…"
              className="flex-1 min-w-[180px] border border-primary-light rounded-lg px-3 py-2 text-sm bg-white text-primary-dark placeholder:text-slate-400 focus:ring-2 focus:ring-primary/25 focus:border-primary outline-none"
              aria-label="Search at-risk students"
            />
            {hasListFilters ? (
              <button
                type="button"
                onClick={() => { setRiskBand('all'); setTableQuery(''); }}
                className="text-xs font-medium text-primary hover:underline whitespace-nowrap px-1 py-2 sm:py-0"
              >
                Clear filters
              </button>
            ) : null}
          </div>
          <p className="text-[11px] text-slate-400 px-0.5">
            Filters apply to students on page {page}. Use the subject control above to narrow the roster from the server.
          </p>

          {filteredItems.length === 0 ? (
            <div className="bg-white border border-primary-light rounded-xl p-10 text-center text-sm text-slate-500">
              No students on this page match your filters.
            </div>
          ) : null}

          {filteredItems.map((student) => (
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
          <div className="text-[11px] text-slate-400">
            Showing {filteredItems.length} of {data.items.length} on this page
            {data.total != null ? ` · ${data.total} total matching subject` : ''}
          </div>
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
