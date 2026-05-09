import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { fmtDate } from '../../utils/dateUtils';
import {
  User,
  Mail,
  BookOpen,
  TrendingUp,
  FileText,
  MessageSquare,
  Zap,
} from 'lucide-react';
import { getDashboard, getProfile, getEnrollments } from '../../services/studentService';

export default function StudentProfile() {
  const navigate = useNavigate();

  const { data: profile, isPending: profileLoading } = useQuery({
    queryKey: ['student', 'profile'],
    queryFn: async () => {
      const res = await getProfile();
      return res.data;
    },
  });

  const { data: dashboard, isPending: dashboardLoading } = useQuery({
    queryKey: ['student', 'dashboard'],
    queryFn: async () => {
      const res = await getDashboard();
      return res.data;
    },
  });

  const { data: enrollmentsData, isPending: enrollmentsLoading } = useQuery({
    queryKey: ['student', 'enrollments'],
    queryFn: async () => {
      const res = await getEnrollments();
      return res.data;
    },
  });

  const enrollments = enrollmentsData?.items || [];
  const loading = profileLoading || dashboardLoading || enrollmentsLoading;

  if (loading) {
    return (
      <div className="animate-pulse space-y-4">
        <div className="h-8 bg-slate-200 rounded w-48" />
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="h-72 bg-slate-200 rounded-xl" />
          <div className="lg:col-span-2 h-72 bg-slate-200 rounded-xl" />
        </div>
      </div>
    );
  }

  const avgScore = dashboard?.average_score ?? 0;
  const totalSubs = dashboard?.total_submissions ?? 0;

  return (
    <div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left column: Profile card */}
        <div className="space-y-4">
          {/* Avatar & info */}
          <div className="bg-white rounded-xl border border-primary-light p-6 text-center">
            <div className="w-20 h-20 rounded-full bg-primary-light border-2 border-primary/20 flex items-center justify-center mx-auto mb-3">
              {profile?.profile_image_url ? (
                <img src={profile.profile_image_url} alt="" className="w-full h-full rounded-full object-cover" />
              ) : (
                <User className="w-10 h-10 text-primary/50" />
              )}
            </div>
            <h2 className="text-lg font-bold text-primary-dark">{profile?.full_name}</h2>
            <p className="text-xs text-slate-500 mt-0.5">{profile?.email}</p>
            <div className="flex flex-wrap gap-2 justify-center mt-3">
              {enrollments.length > 0 && (
                <span className="text-xs bg-primary text-white px-2 py-0.5 rounded-full">
                  {enrollments[0]?.grade_name}
                </span>
              )}
            </div>

            {/* Stats */}
            <div className="grid grid-cols-2 gap-3 mt-5">
              <div className="text-center">
                <p className="text-xs text-slate-500 uppercase tracking-wider">AI Insights</p>
                <p className="text-lg font-bold text-primary-dark">14,280</p>
              </div>
              <div className="text-center">
                <p className="text-xs text-slate-500 uppercase tracking-wider">Streak</p>
                <p className="text-lg font-bold text-primary-dark flex items-center justify-center gap-1">
                  <Zap className="w-4 h-4 text-accent" />
                  12 Days
                </p>
              </div>
            </div>
          </div>

          {/* Mentor card */}
          <div className="bg-primary-dark rounded-xl p-5 text-white">
            <p className="text-sm font-semibold mb-1">Gyanavriksha Mentor</p>
            <p className="text-xs text-white/70 mb-3">Your AI-powered learning advisor</p>
            <button
              onClick={() => navigate('/student/ai-tutor')}
              className="bg-white text-primary-dark text-sm font-medium px-4 py-2 rounded-lg hover:bg-white/90 transition-colors w-full"
            >
              <MessageSquare className="w-4 h-4 inline mr-1.5" />
              Message Advisor
            </button>
          </div>
        </div>

        {/* Right column: Stats, subjects, activity */}
        <div className="lg:col-span-2 space-y-4">
          {/* KPI cards */}
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-white rounded-xl border border-primary-light p-5">
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs text-slate-500 uppercase tracking-wider">Average Score</p>
                <TrendingUp className="w-4 h-4 text-primary" />
              </div>
              <p className="text-3xl font-bold text-primary-dark">
                {avgScore ? `${avgScore.toFixed(1)}%` : '—'}
              </p>
            </div>
            <div className="bg-white rounded-xl border border-primary-light p-5">
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs text-slate-500 uppercase tracking-wider">Total Submissions</p>
                <FileText className="w-4 h-4 text-primary" />
              </div>
              <p className="text-3xl font-bold text-primary-dark">{totalSubs}</p>
            </div>
          </div>

          {/* Enrolled subjects */}
          <div className="bg-white rounded-xl border border-primary-light p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-primary-dark">Enrolled Subjects</h3>
              <button
                onClick={() => navigate('/student/assignments')}
                className="text-xs text-primary hover:underline"
              >
                View All
              </button>
            </div>
            <div className="space-y-3">
              {enrollments.map((enr) => {
                const pctRaw = Number(enr.completion_percentage);
                const pctSafe = Number.isFinite(pctRaw) ? Math.min(Math.max(pctRaw, 0), 100) : 0;
                return (
                <div key={enr.enrollment_id} className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-primary-light flex items-center justify-center">
                      <BookOpen className="w-4 h-4 text-primary" />
                    </div>
                    <span className="text-sm font-medium text-slate-700">{enr.subject_name}</span>
                  </div>
                  <div className="flex items-center gap-3 w-40">
                    <div className="flex-1 bg-slate-100 rounded-full h-2 min-w-0">
                      <div
                        className="bg-primary rounded-full h-2 transition-all max-w-full"
                        style={{ width: `${pctSafe}%` }}
                      />
                    </div>
                    <span className="text-xs text-slate-500 w-10 text-right shrink-0">
                      {pctSafe.toFixed(pctSafe % 1 === 0 ? 0 : 1)}%
                    </span>
                  </div>
                </div>
                );
              })}
              {enrollments.length === 0 && (
                <p className="text-sm text-slate-400 text-center py-4">No subjects enrolled</p>
              )}
            </div>
          </div>

          {/* Recent activity */}
          <div className="bg-white rounded-xl border border-primary-light p-5">
              <h3 className="font-semibold text-primary-dark mb-3">Recent Activity</h3>
              <div className="space-y-3">
                {dashboard?.recent_submissions?.length > 0 ? (
                  dashboard.recent_submissions.map((sub, idx) => (
                    <div key={idx} className="flex items-start gap-3">
                      <div className="w-2 h-2 rounded-full bg-primary mt-1.5 flex-shrink-0" />
                      <div>
                        <p className="text-sm text-slate-700">{sub.assignment_title} Submitted</p>
                        <p className="text-xs text-slate-400">
                          {fmtDate(sub.submitted_at)}
                        </p>
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-slate-400 text-center py-4">No recent activity</p>
                )}
              </div>
          </div>
        </div>
      </div>
    </div>
  );
}
