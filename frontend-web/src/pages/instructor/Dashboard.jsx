import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import {
  LayoutDashboard,
  TrendingUp,
  TrendingDown,
  Minus,
  Users,
  FileText,
  BarChart3,
  Award,
  ExternalLink,
  Loader2,
  AlertCircle,
} from 'lucide-react';
import { getDashboard } from '../../services/instructorService';

// Skeleton loader for cards
function KpiSkeleton() {
  return (
    <div className="bg-white rounded-xl border border-primary-light p-5 animate-pulse">
      <div className="h-3 w-24 bg-slate-200 rounded mb-3" />
      <div className="h-8 w-20 bg-slate-200 rounded mb-2" />
      <div className="h-2 w-32 bg-slate-100 rounded" />
    </div>
  );
}

function TableSkeleton() {
  return (
    <div className="animate-pulse space-y-3">
      {[...Array(5)].map((_, i) => (
        <div key={i} className="flex items-center gap-4">
          <div className="w-8 h-8 bg-slate-200 rounded-full" />
          <div className="flex-1 h-4 bg-slate-200 rounded" />
          <div className="w-12 h-4 bg-slate-200 rounded" />
          <div className="w-16 h-4 bg-slate-200 rounded" />
        </div>
      ))}
    </div>
  );
}

// Trend icon helper
function TrendIcon({ trend }) {
  if (trend === 'up') return <TrendingUp className="w-4 h-4 text-green-500" />;
  if (trend === 'down') return <TrendingDown className="w-4 h-4 text-red-500" />;
  return <Minus className="w-4 h-4 text-slate-400" />;
}

// Status badge for submissions
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

export default function InstructorDashboard() {
  const {
    data,
    isPending: loading,
    error,
    refetch,
  } = useQuery({
    queryKey: ['instructor', 'dashboard'],
    queryFn: async () => {
      const res = await getDashboard();
      return res.data;
    },
  });

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <AlertCircle className="w-12 h-12 text-red-400 mb-4" />
        <h2 className="text-lg font-semibold text-primary-dark mb-2">Dashboard Unavailable</h2>
        <p className="text-slate-500 text-sm mb-4">
          {error?.response?.data?.detail || error?.message || 'Failed to load dashboard'}
        </p>
        <button
          onClick={() => refetch()}
          className="px-4 py-2 bg-primary text-white rounded-lg text-sm hover:bg-primary/90 transition"
        >
          Try Again
        </button>
      </div>
    );
  }

  return (
    <div>
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 rounded-lg bg-primary-light flex items-center justify-center">
          <LayoutDashboard className="w-5 h-5 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-primary-dark">Intelligence Dashboard</h1>
          <p className="text-sm text-slate-500">Class-wide performance insights and cognitive health tracking.</p>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {loading ? (
          <>
            <KpiSkeleton />
            <KpiSkeleton />
            <KpiSkeleton />
            <KpiSkeleton />
          </>
        ) : (
          <>
            <div className="bg-white rounded-xl border border-primary-light p-5">
              <div className="flex items-center gap-2 mb-2">
                <Users className="w-4 h-4 text-primary" />
                <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Participation Rate</span>
              </div>
              <p className="text-3xl font-bold text-primary-dark">
                {data?.class_completion?.toFixed(1) || '0.0'}
                <span className="text-base font-normal text-slate-400">%</span>
              </p>
            </div>

            <div className="bg-white rounded-xl border border-primary-light p-5">
              <div className="flex items-center gap-2 mb-2">
                <Award className="w-4 h-4 text-primary" />
                <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Average Score</span>
              </div>
              <p className="text-3xl font-bold text-primary-dark">
                {data?.class_avg_score != null ? data.class_avg_score.toFixed(1) : '—'}
                <span className="text-base font-normal text-slate-400">/100</span>
              </p>
            </div>

            <div className="bg-white rounded-xl border border-primary-light p-5">
              <div className="flex items-center gap-2 mb-2">
                <FileText className="w-4 h-4 text-primary" />
                <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Total Assignments</span>
              </div>
              <p className="text-3xl font-bold text-primary-dark">{data?.total_assignments || 0}</p>
            </div>

            <div className="bg-white rounded-xl border border-primary-light p-5">
              <div className="flex items-center gap-2 mb-2">
                <BarChart3 className="w-4 h-4 text-primary" />
                <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Total Submissions</span>
              </div>
              <p className="text-3xl font-bold text-primary-dark">{data?.total_submissions || 0}</p>
            </div>
          </>
        )}
      </div>

      {/* Main content: Heatmap + Recent Submissions */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
        {/* Concept Heatmap Preview */}
        <div className="lg:col-span-2">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h2 className="text-lg font-bold text-primary-dark">Concept Heatmap</h2>
              <p className="text-xs text-slate-500">Topic areas where students struggle most.</p>
            </div>
            <Link
              to="/instructor/concept-heatmap"
              className="text-xs text-primary font-medium hover:underline flex items-center gap-1"
            >
              Detailed <ExternalLink className="w-3 h-3" />
            </Link>
          </div>

          {loading ? (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="h-32 bg-slate-200 rounded-xl animate-pulse" />
              ))}
            </div>
          ) : data?.heatmap_preview?.length > 0 ? (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {data.heatmap_preview.map((item, idx) => (
                <div
                  key={idx}
                  className="bg-primary-dark rounded-xl p-4 flex flex-col justify-between min-h-[120px]"
                >
                  <span className="text-3xl font-bold text-white">
                    {item.struggle_percentage.toFixed(0)}%
                  </span>
                  <div>
                    <p className="text-white/90 text-sm font-medium truncate">{item.topic_tag}</p>
                    <p className="text-white/50 text-xs truncate">{item.subject_name}</p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="bg-primary-dark/5 border border-primary-light rounded-xl p-8 text-center">
              <p className="text-slate-500 text-sm">No struggle areas detected yet. Data will appear after students submit work.</p>
            </div>
          )}
        </div>

        {/* Recent Submissions */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-bold text-primary-dark">Recent Submissions</h2>
            <Link
              to="/instructor/submissions"
              className="text-xs text-primary font-medium hover:underline flex items-center gap-1"
            >
              View All <ExternalLink className="w-3 h-3" />
            </Link>
          </div>

          {loading ? (
            <div className="space-y-3 animate-pulse">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="h-14 bg-slate-200 rounded-lg" />
              ))}
            </div>
          ) : data?.recent_submissions?.length > 0 ? (
            <div className="space-y-2">
              {data.recent_submissions.map((sub) => (
                <div
                  key={sub.submission_id}
                  className="bg-white border border-primary-light rounded-lg p-3 flex items-center justify-between"
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-primary-dark truncate">{sub.student_name}</p>
                    <p className="text-xs text-slate-500 truncate">{sub.assignment_title}</p>
                  </div>
                  <div className="flex items-center gap-2 ml-2">
                    <StatusBadge status={sub.status} />
                    {sub.score_percentage != null && (
                      <span className="text-xs font-semibold text-primary-dark">{sub.score_percentage}%</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="bg-white border border-primary-light rounded-xl p-8 text-center">
              <p className="text-slate-500 text-sm">No submissions yet.</p>
            </div>
          )}
        </div>
      </div>

      {/* Performance Velocity Table */}
      <div className="bg-white rounded-xl border border-primary-light p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-lg font-bold text-primary-dark">Performance Velocity</h2>
            <p className="text-xs text-slate-500">Student activity rate and momentum tracking.</p>
          </div>
          <Link
            to="/instructor/velocity-analytics"
            className="text-xs text-primary font-medium hover:underline flex items-center gap-1"
          >
            Export Full Report <ExternalLink className="w-3 h-3" />
          </Link>
        </div>

        {loading ? (
          <TableSkeleton />
        ) : data?.velocity_table?.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-primary-light">
                  <th className="text-left py-2 px-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Student</th>
                  <th className="text-center py-2 px-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Velocity Score</th>
                  <th className="text-center py-2 px-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Completion Rate</th>
                  <th className="text-right py-2 px-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Productivity Trend</th>
                </tr>
              </thead>
              <tbody>
                {data.velocity_table.map((row) => (
                  <tr key={row.student_id} className="border-b border-slate-50 hover:bg-slate-50/50 transition">
                    <td className="py-3 px-3 flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-primary-light flex items-center justify-center text-primary font-bold text-xs">
                        {row.student_name?.charAt(0)?.toUpperCase()}
                      </div>
                      <span className="text-sm font-medium text-primary-dark">{row.student_name}</span>
                    </td>
                    <td className="py-3 px-3 text-center text-sm font-semibold text-primary-dark">{row.velocity_score}</td>
                    <td className="py-3 px-3 text-center">
                      <div className="flex items-center justify-center gap-2">
                        <div className="w-20 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-primary rounded-full"
                            style={{ width: `${Math.min((row.submission_count / Math.max(data.total_assignments, 1)) * 100, 100)}%` }}
                          />
                        </div>
                        <span className="text-xs text-slate-500">
                          {Math.round((row.submission_count / Math.max(data.total_assignments, 1)) * 100)}%
                        </span>
                      </div>
                    </td>
                    <td className="py-3 px-3">
                      <div className="flex items-center justify-end gap-1">
                        <TrendIcon trend={row.trend} />
                        <span className={`text-xs font-medium ${
                          row.trend === 'up' ? 'text-green-600' :
                          row.trend === 'down' ? 'text-red-600' : 'text-slate-500'
                        }`}>
                          {row.avg_score != null ? `${row.avg_score}%` : '—'}
                        </span>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="py-8 text-center">
            <p className="text-slate-500 text-sm">No velocity data available yet. Data will populate as students submit graded work.</p>
          </div>
        )}

        {data?.velocity_table?.length > 0 && (
          <div className="mt-4 text-center">
            <Link
              to="/instructor/velocity-analytics"
              className="text-sm text-primary font-medium hover:underline"
            >
              View all students
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
