import { useState, useEffect } from 'react';
import {
  User,
  Mail,
  BookOpen,
  TrendingUp,
  FileText,
  ClipboardList,
  Users,
  Loader2,
} from 'lucide-react';
import { getProfile } from '../../services/instructorService';
import { getDashboard } from '../../services/instructorService';

export default function InstructorProfile() {
  const [profile, setProfile] = useState(null);
  const [dashboard, setDashboard] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      getProfile().then((r) => setProfile(r.data)),
      getDashboard().then((r) => setDashboard(r.data)),
    ])
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

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

  return (
    <div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Profile Card */}
        <div className="space-y-4">
          <div className="bg-white rounded-xl border border-primary-light p-6 text-center">
            <div className="w-20 h-20 rounded-full bg-primary-light border-2 border-primary/20 flex items-center justify-center mx-auto mb-3">
              {profile?.profile_image_url ? (
                <img src={profile.profile_image_url} alt="" className="w-full h-full rounded-full object-cover" />
              ) : (
                <User className="w-10 h-10 text-primary/50" />
              )}
            </div>
            <h2 className="text-lg font-bold text-primary-dark">{profile?.full_name}</h2>
            <p className="text-xs text-slate-500 mt-0.5 flex items-center justify-center gap-1">
              <Mail className="w-3 h-3" /> {profile?.email}
            </p>
            <span className="inline-block mt-2 px-3 py-0.5 bg-primary text-white text-xs font-medium rounded-full capitalize">
              {profile?.role}
            </span>

            <div className="grid grid-cols-2 gap-3 mt-5">
              <div className="text-center">
                <p className="text-xs text-slate-500 uppercase tracking-wider">Subjects</p>
                <p className="text-lg font-bold text-primary-dark">{profile?.subjects?.length || 0}</p>
              </div>
              <div className="text-center">
                <p className="text-xs text-slate-500 uppercase tracking-wider">2FA</p>
                <p className="text-lg font-bold text-primary-dark">
                  {profile?.totp_enabled ? 'On' : 'Off'}
                </p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl border border-primary-light p-5">
            <h3 className="font-semibold text-primary-dark mb-3">Account Details</h3>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm text-slate-500">Status</span>
                <span className={`text-sm font-medium ${profile?.is_active ? 'text-green-600' : 'text-red-600'}`}>
                  {profile?.is_active ? 'Active' : 'Inactive'}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-slate-500">Joined</span>
                <span className="text-sm text-primary-dark">
                  {profile?.created_at ? new Date(profile.created_at).toLocaleDateString() : '—'}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Right: Stats & Subjects */}
        <div className="lg:col-span-2 space-y-4">
          {/* KPI Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="bg-white rounded-xl border border-primary-light p-5">
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs text-slate-500 uppercase tracking-wider">Participation</p>
                <Users className="w-4 h-4 text-primary" />
              </div>
              <p className="text-2xl font-bold text-primary-dark">
                {dashboard?.class_completion?.toFixed(1) || '0.0'}%
              </p>
            </div>
            <div className="bg-white rounded-xl border border-primary-light p-5">
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs text-slate-500 uppercase tracking-wider">Avg Score</p>
                <TrendingUp className="w-4 h-4 text-primary" />
              </div>
              <p className="text-2xl font-bold text-primary-dark">
                {dashboard?.class_avg_score != null ? `${dashboard.class_avg_score.toFixed(1)}%` : '—'}
              </p>
            </div>
            <div className="bg-white rounded-xl border border-primary-light p-5">
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs text-slate-500 uppercase tracking-wider">Assignments</p>
                <ClipboardList className="w-4 h-4 text-primary" />
              </div>
              <p className="text-2xl font-bold text-primary-dark">{dashboard?.total_assignments || 0}</p>
            </div>
            <div className="bg-white rounded-xl border border-primary-light p-5">
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs text-slate-500 uppercase tracking-wider">Submissions</p>
                <FileText className="w-4 h-4 text-primary" />
              </div>
              <p className="text-2xl font-bold text-primary-dark">{dashboard?.total_submissions || 0}</p>
            </div>
          </div>

          {/* Assigned Subjects */}
          <div className="bg-white rounded-xl border border-primary-light p-5">
            <h3 className="font-semibold text-primary-dark mb-4">Assigned Subjects</h3>
            {profile?.subjects?.length > 0 ? (
              <div className="space-y-3">
                {profile.subjects.map((s) => (
                  <div key={s.subject_id} className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-primary-light flex items-center justify-center">
                        <BookOpen className="w-4 h-4 text-primary" />
                      </div>
                      <div>
                        <span className="text-sm font-medium text-slate-700">{s.subject_name}</span>
                        <p className="text-xs text-slate-400">{s.grade_name} &middot; {s.subject_code}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-4 text-xs text-slate-500">
                      <span>{s.student_count} students</span>
                      <span>{s.assignment_count} assignments</span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-slate-400 text-center py-4">No subjects assigned yet</p>
            )}
          </div>

          {/* Recent Submissions Overview */}
          {dashboard?.recent_submissions?.length > 0 && (
            <div className="bg-white rounded-xl border border-primary-light p-5">
              <h3 className="font-semibold text-primary-dark mb-3">Recent Submissions</h3>
              <div className="space-y-3">
                {dashboard.recent_submissions.slice(0, 5).map((sub) => (
                  <div key={sub.submission_id} className="flex items-start gap-3">
                    <div className="w-2 h-2 rounded-full bg-primary mt-1.5 flex-shrink-0" />
                    <div className="flex-1">
                      <p className="text-sm text-slate-700">
                        <span className="font-medium">{sub.student_name}</span> submitted {sub.assignment_title}
                      </p>
                      <p className="text-xs text-slate-400">
                        {sub.subject_name} &middot; {new Date(sub.submitted_at).toLocaleDateString()}
                      </p>
                    </div>
                    {sub.score_percentage != null && (
                      <span className="text-sm font-semibold text-primary">{sub.score_percentage}%</span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
