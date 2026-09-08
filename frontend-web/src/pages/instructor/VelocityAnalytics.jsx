import { useState, useEffect, useMemo } from 'react';
import {
  TrendingUp,
  TrendingDown,
  Minus,
  BarChart3,
  Loader2,
  ListFilter,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { getVelocityAnalytics, getSubjects } from '../../services/instructorService';

function TrendIcon({ trend }) {
  if (trend === 'up') return <TrendingUp className="w-4 h-4 text-green-500" />;
  if (trend === 'down') return <TrendingDown className="w-4 h-4 text-red-500" />;
  return <Minus className="w-4 h-4 text-slate-400" />;
}

function VelocityBar({ score, max = 10 }) {
  const pct = Math.min((score / max) * 100, 100);
  const color = pct >= 70 ? 'bg-green-500' : pct >= 40 ? 'bg-amber-500' : 'bg-red-500';
  return (
    <div className="flex items-center gap-2">
      <div className="w-24 h-2 bg-slate-100 rounded-full overflow-hidden">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-xs font-semibold text-slate-600">{score}</span>
    </div>
  );
}

export default function VelocityAnalyticsPage() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [subjects, setSubjects] = useState([]);
  const [subjectId, setSubjectId] = useState('');
  const [assignQuery, setAssignQuery] = useState('');
  const [studentQuery, setStudentQuery] = useState('');
  const [trendFilter, setTrendFilter] = useState('all');
  const [velocityBand, setVelocityBand] = useState('all');

  useEffect(() => {
    getSubjects().then((r) => setSubjects(r.data || [])).catch(() => {});
  }, []);

  useEffect(() => {
    setLoading(true);
    const params = {};
    if (subjectId) params.subject_id = Number(subjectId);
    getVelocityAnalytics(params)
      .then((res) => setData(res.data))
      .catch(() => toast.error('Failed to load analytics'))
      .finally(() => setLoading(false));
  }, [subjectId]);

  useEffect(() => {
    setAssignQuery('');
    setStudentQuery('');
    setTrendFilter('all');
    setVelocityBand('all');
  }, [subjectId]);

  const filteredCompletion = useMemo(() => {
    const rows = data?.completion_distribution ?? [];
    const q = assignQuery.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((item) => (item.assignment_title || '').toLowerCase().includes(q));
  }, [data?.completion_distribution, assignQuery]);

  const filteredVelocities = useMemo(() => {
    const rows = data?.student_velocities ?? [];
    const q = studentQuery.trim().toLowerCase();
    return rows.filter((s) => {
      const vs = Number(s.velocity_score) || 0;
      if (velocityBand === 'high' && vs < 7) return false;
      if (velocityBand === 'mid' && (vs < 4 || vs >= 7)) return false;
      if (velocityBand === 'low' && vs >= 4) return false;
      const tr = s.trend || 'stable';
      if (trendFilter === 'up' && tr !== 'up') return false;
      if (trendFilter === 'down' && tr !== 'down') return false;
      if (trendFilter === 'stable' && tr !== 'stable') return false;
      if (q && !(s.student_name || '').toLowerCase().includes(q)) return false;
      return true;
    });
  }, [data?.student_velocities, studentQuery, trendFilter, velocityBand]);

  const hasVelocityFilters =
    Boolean(studentQuery.trim()) || trendFilter !== 'all' || velocityBand !== 'all';

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-primary-light flex items-center justify-center">
            <TrendingUp className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-primary-dark">Velocity Analytics</h1>
            <p className="text-sm text-slate-500">Student activity momentum and engagement tracking.</p>
          </div>
        </div>
        <select
          value={subjectId}
          onChange={(e) => setSubjectId(e.target.value)}
          className="px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
        >
          <option value="">All Subjects</option>
          {subjects.map((s) => (
            <option key={s.subject_id} value={s.subject_id}>{s.subject_name}</option>
          ))}
        </select>
      </div>

      {/* Class Average */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
        <div className="bg-white rounded-xl border border-primary-light p-5">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Class Avg Velocity</p>
          <p className="text-3xl font-bold text-primary-dark">
            {data?.class_avg_velocity?.toFixed(1) || '0.0'}
            <span className="text-base font-normal text-slate-400">/10</span>
          </p>
        </div>
        <div className="bg-white rounded-xl border border-primary-light p-5">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Total Students</p>
          <p className="text-3xl font-bold text-primary-dark">{data?.student_velocities?.length || 0}</p>
        </div>
        <div className="bg-white rounded-xl border border-primary-light p-5">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Assignments Tracked</p>
          <p className="text-3xl font-bold text-primary-dark">{data?.completion_distribution?.length || 0}</p>
        </div>
      </div>

      {/* Completion Distribution */}
      {data?.completion_distribution?.length > 0 && (
        <div className="bg-white rounded-xl border border-primary-light p-6 mb-8">
          <h2 className="text-lg font-bold text-primary-dark mb-4">Assignment Completion Rate</h2>
          <div className="mb-4 flex flex-col sm:flex-row flex-wrap items-stretch sm:items-center gap-2 sm:gap-3 p-3 bg-slate-50/80 rounded-lg border border-slate-100">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-500 uppercase tracking-wide shrink-0">
              <ListFilter className="w-3.5 h-3.5" />
              Filter
            </div>
            <input
              type="search"
              value={assignQuery}
              onChange={(e) => setAssignQuery(e.target.value)}
              placeholder="Search assignment title…"
              className="flex-1 min-w-[200px] border border-primary-light rounded-lg px-3 py-2 text-sm bg-white focus:ring-2 focus:ring-primary/25 focus:border-primary outline-none"
              aria-label="Filter completion list"
            />
            {assignQuery.trim() ? (
              <button
                type="button"
                onClick={() => setAssignQuery('')}
                className="text-xs font-medium text-primary hover:underline"
              >
                Clear
              </button>
            ) : null}
          </div>
          {filteredCompletion.length === 0 ? (
            <p className="text-sm text-slate-500 py-4 text-center">No assignments match your search.</p>
          ) : (
            <div className="space-y-3">
              {filteredCompletion.map((item, idx) => (
                <div key={`${item.assignment_title}-${idx}`} className="flex items-center gap-4">
                  <span className="text-sm text-primary-dark w-48 truncate" title={item.assignment_title}>{item.assignment_title}</span>
                  <div className="flex-1 h-3 bg-slate-100 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-primary rounded-full transition-all"
                      style={{ width: `${item.completion_percentage}%` }}
                    />
                  </div>
                  <span className="text-xs font-semibold text-slate-600 w-20 text-right">
                    {item.submitted}/{item.total} ({item.completion_percentage}%)
                  </span>
                </div>
              ))}
            </div>
          )}
          <p className="text-[11px] text-slate-400 mt-3">
            Showing {filteredCompletion.length} of {data.completion_distribution.length} assignments
          </p>
        </div>
      )}

      {/* Student Velocities Table */}
      <div className="bg-white rounded-xl border border-primary-light p-6">
        <h2 className="text-lg font-bold text-primary-dark mb-4">Student Velocity Rankings</h2>

        {data?.student_velocities?.length > 0 ? (
          <>
            <div className="mb-4 flex flex-col lg:flex-row flex-wrap items-stretch lg:items-center gap-2 lg:gap-3 p-3 bg-slate-50/80 rounded-lg border border-slate-100">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-500 uppercase tracking-wide shrink-0">
                <ListFilter className="w-3.5 h-3.5" />
                Filter
              </div>
              <input
                type="search"
                value={studentQuery}
                onChange={(e) => setStudentQuery(e.target.value)}
                placeholder="Search student name…"
                className="flex-1 min-w-[160px] border border-primary-light rounded-lg px-3 py-2 text-sm bg-white focus:ring-2 focus:ring-primary/25 focus:border-primary outline-none"
                aria-label="Search students"
              />
              <select
                value={trendFilter}
                onChange={(e) => setTrendFilter(e.target.value)}
                className="flex-1 min-w-[120px] lg:max-w-[160px] border border-primary-light rounded-lg px-2.5 py-2 text-sm bg-white focus:ring-2 focus:ring-primary/25 outline-none"
                aria-label="Trend"
              >
                <option value="all">All trends</option>
                <option value="up">Up</option>
                <option value="down">Down</option>
                <option value="stable">Stable</option>
              </select>
              <select
                value={velocityBand}
                onChange={(e) => setVelocityBand(e.target.value)}
                className="flex-1 min-w-[120px] lg:max-w-[180px] border border-primary-light rounded-lg px-2.5 py-2 text-sm bg-white focus:ring-2 focus:ring-primary/25 outline-none"
                aria-label="Velocity band"
              >
                <option value="all">All velocity</option>
                <option value="high">High (7–10)</option>
                <option value="mid">Mid (4–6.9)</option>
                <option value="low">Low (&lt;4)</option>
              </select>
              {hasVelocityFilters ? (
                <button
                  type="button"
                  onClick={() => {
                    setStudentQuery('');
                    setTrendFilter('all');
                    setVelocityBand('all');
                  }}
                  className="text-xs font-medium text-primary hover:underline whitespace-nowrap px-1"
                >
                  Clear filters
                </button>
              ) : null}
            </div>
            <div className="overflow-x-auto">
              {filteredVelocities.length === 0 ? (
                <p className="text-sm text-slate-500 py-8 text-center">No students match your filters.</p>
              ) : (
            <table className="w-full">
              <thead>
                <tr className="border-b border-primary-light">
                  <th className="text-left py-2 px-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Rank</th>
                  <th className="text-left py-2 px-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Student</th>
                  <th className="text-center py-2 px-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Velocity</th>
                  <th className="text-center py-2 px-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Submissions</th>
                  <th className="text-center py-2 px-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Avg Score</th>
                  <th className="text-right py-2 px-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Trend</th>
                </tr>
              </thead>
              <tbody>
                {filteredVelocities.map((s, idx) => (
                  <tr key={s.student_id} className="border-b border-slate-50 hover:bg-slate-50/50">
                    <td className="py-3 px-3">
                      <span className={`w-6 h-6 rounded-full inline-flex items-center justify-center text-xs font-bold ${
                        idx === 0 ? 'bg-amber-100 text-amber-700' :
                        idx === 1 ? 'bg-slate-200 text-slate-700' :
                        idx === 2 ? 'bg-orange-100 text-orange-700' :
                        'bg-slate-50 text-slate-500'
                      }`}>
                        {idx + 1}
                      </span>
                    </td>
                    <td className="py-3 px-3">
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-full bg-primary-light flex items-center justify-center text-primary font-bold text-xs">
                          {s.student_name?.charAt(0)?.toUpperCase()}
                        </div>
                        <span className="text-sm font-medium text-primary-dark">{s.student_name}</span>
                      </div>
                    </td>
                    <td className="py-3 px-3 text-center">
                      <VelocityBar score={s.velocity_score} />
                    </td>
                    <td className="py-3 px-3 text-center text-sm text-primary-dark">{s.submission_count}</td>
                    <td className="py-3 px-3 text-center text-sm font-semibold text-primary-dark">
                      {s.avg_score != null ? `${s.avg_score}%` : '—'}
                    </td>
                    <td className="py-3 px-3">
                      <div className="flex items-center justify-end gap-1">
                        <TrendIcon trend={s.trend} />
                        <span className={`text-xs font-medium ${
                          s.trend === 'up' ? 'text-green-600' :
                          s.trend === 'down' ? 'text-red-600' : 'text-slate-500'
                        }`}>
                          {s.trend}
                        </span>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
              )}
            </div>
            <p className="text-[11px] text-slate-400 mt-3">
              Showing {filteredVelocities.length} of {data.student_velocities.length} students (rank is within filtered list)
            </p>
          </>
        ) : (
          <div className="py-8 text-center">
            <BarChart3 className="w-12 h-12 text-slate-300 mx-auto mb-4" />
            <p className="text-slate-500 text-sm">No velocity data yet. Data appears after students submit graded work.</p>
          </div>
        )}
      </div>
    </div>
  );
}
