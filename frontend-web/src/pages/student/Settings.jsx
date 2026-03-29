import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { User, Shield, Monitor, Smartphone, Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { getProfile, updateProfile, getEnrollments } from '../../services/studentService';
import useAuth from '../../hooks/useAuth';

function Toggle({ checked, onChange, label }) {
  return (
    <label className="flex items-center justify-between cursor-pointer">
      <span className="text-sm text-slate-700">{label}</span>
      <button
        type="button"
        onClick={() => onChange(!checked)}
        className={`relative w-11 h-6 rounded-full transition-colors ${
          checked ? 'bg-primary' : 'bg-slate-300'
        }`}
      >
        <span
          className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${
            checked ? 'translate-x-5' : ''
          }`}
        />
      </button>
    </label>
  );
}

export default function StudentSettings() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [profile, setProfile] = useState(null);
  const [enrollments, setEnrollments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Form state
  const [fullName, setFullName] = useState('');
  const [twoFaEnabled, setTwoFaEnabled] = useState(false);
  const [alerts, setAlerts] = useState({
    grading_updates: true,
    quiz_reminders: true,
    posture_connection: false,
  });

  useEffect(() => {
    Promise.all([
      getProfile().then((r) => {
        setProfile(r.data);
        setFullName(r.data.full_name || '');
        setTwoFaEnabled(false); // 2FA status from auth
      }),
      getEnrollments().then((r) => setEnrollments(r.data.items || [])),
    ])
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      await updateProfile({ full_name: fullName });
      toast.success('Settings saved successfully');
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  const handleDiscard = () => {
    setFullName(profile?.full_name || '');
    toast('Changes discarded');
  };

  if (loading) {
    return (
      <div className="animate-pulse space-y-4">
        <div className="h-8 bg-slate-200 rounded w-32" />
        <div className="h-64 bg-slate-200 rounded-xl" />
      </div>
    );
  }

  return (
    <div className="max-w-4xl">
      <h1 className="text-2xl font-bold text-primary-dark mb-1">Settings</h1>
      <p className="text-slate-500 text-sm mb-6">Manage your academic data and digital preferences.</p>

      {/* Profile info */}
      <div className="bg-white rounded-xl border border-primary-light p-6 mb-4">
        <div className="flex items-start gap-5">
          <div className="w-16 h-16 rounded-full bg-primary-light border-2 border-primary/20 flex items-center justify-center flex-shrink-0">
            <User className="w-8 h-8 text-primary/50" />
          </div>
          <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-xs text-slate-500 uppercase tracking-wider block mb-1">
                Full Name
              </label>
              <input
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                className="w-full border border-primary-light rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary/30 focus:border-primary outline-none"
              />
            </div>
            <div>
              <label className="text-xs text-slate-500 uppercase tracking-wider block mb-1">
                Email
              </label>
              <input
                type="email"
                value={profile?.email || ''}
                disabled
                className="w-full border border-primary-light rounded-lg px-3 py-2 text-sm bg-slate-50 text-slate-500 cursor-not-allowed"
              />
            </div>
            <div>
              <label className="text-xs text-slate-500 uppercase tracking-wider block mb-1">
                Grade
              </label>
              <input
                type="text"
                value={enrollments[0]?.grade_name || 'N/A'}
                disabled
                className="w-full border border-primary-light rounded-lg px-3 py-2 text-sm bg-slate-50 text-slate-500 cursor-not-allowed"
              />
            </div>
            <div>
              <label className="text-xs text-slate-500 uppercase tracking-wider block mb-1">
                Enrolled Subjects
              </label>
              <div className="flex flex-wrap gap-1.5 mt-1">
                {enrollments.map((e) => (
                  <span
                    key={e.enrollment_id}
                    className="text-xs bg-primary-light text-primary-dark px-2 py-0.5 rounded-full"
                  >
                    {e.subject_name}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Security & Learning Alerts */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
        {/* Security */}
        <div className="bg-white rounded-xl border border-primary-light p-5">
          <h3 className="font-semibold text-primary-dark mb-4">Security</h3>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Shield className="w-4 h-4 text-primary" />
                <span className="text-sm text-slate-700">Two-Factor Authentication</span>
              </div>
              <button
                type="button"
                onClick={() => navigate('/2fa-setup')}
                className={`relative w-11 h-6 rounded-full transition-colors ${
                  twoFaEnabled ? 'bg-primary' : 'bg-slate-300'
                }`}
              >
                <span
                  className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${
                    twoFaEnabled ? 'translate-x-5' : ''
                  }`}
                />
              </button>
            </div>
            <button
              onClick={() => navigate('/reset-password')}
              className="text-sm text-primary hover:underline"
            >
              Update Password
            </button>
          </div>
        </div>

        {/* Learning Alerts */}
        <div className="bg-white rounded-xl border border-primary-light p-5">
          <h3 className="font-semibold text-primary-dark mb-4">Learning Alerts</h3>
          <div className="space-y-4">
            <Toggle
              label="Grading Updates"
              checked={alerts.grading_updates}
              onChange={(v) => setAlerts((p) => ({ ...p, grading_updates: v }))}
            />
            <Toggle
              label="Quiz Reminders"
              checked={alerts.quiz_reminders}
              onChange={(v) => setAlerts((p) => ({ ...p, quiz_reminders: v }))}
            />
            <Toggle
              label="Posture Connection (IoT)"
              checked={alerts.posture_connection}
              onChange={(v) => setAlerts((p) => ({ ...p, posture_connection: v }))}
            />
          </div>
        </div>
      </div>

      {/* Interface Theme */}
      <div className="bg-white rounded-xl border border-primary-light p-5 mb-4">
        <h3 className="font-semibold text-primary-dark mb-3">Interface Theme</h3>
        <div className="flex gap-3">
          {[
            { bg: '#F9F7F7', border: '#DBE2EF', active: true },
            { bg: '#112D4E', border: '#3F72AF', active: false },
            { bg: '#1a1a2e', border: '#16213e', active: false },
            { bg: '#e2e8f0', border: '#94a3b8', active: false },
          ].map((theme, idx) => (
            <button
              key={idx}
              className={`w-20 h-14 rounded-lg border-2 transition-all ${
                theme.active ? 'ring-2 ring-primary ring-offset-2' : 'hover:scale-105'
              }`}
              style={{ backgroundColor: theme.bg, borderColor: theme.border }}
            />
          ))}
        </div>
      </div>

      {/* Active Sessions */}
      <div className="bg-white rounded-xl border border-primary-light p-5 mb-6">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-semibold text-primary-dark">Active Sessions</h3>
          <button className="text-xs text-red-500 hover:underline">Sign out all devices</button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-slate-500 uppercase tracking-wider border-b border-primary-light">
                <th className="py-2 pr-4">Device</th>
                <th className="py-2 pr-4">Location</th>
                <th className="py-2 pr-4">Last Active</th>
                <th className="py-2">Action</th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-b border-slate-50">
                <td className="py-3 pr-4 flex items-center gap-2">
                  <Monitor className="w-4 h-4 text-slate-400" />
                  <span>Current Browser</span>
                </td>
                <td className="py-3 pr-4 text-slate-500">Current Session</td>
                <td className="py-3 pr-4 text-slate-500">Now</td>
                <td className="py-3 text-slate-400">—</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* Save / Discard */}
      <div className="flex items-center justify-center gap-3">
        <button
          onClick={handleDiscard}
          className="px-6 py-2.5 border border-primary-light rounded-lg text-sm font-medium text-slate-600 hover:bg-slate-50 transition-colors"
        >
          Discard Changes
        </button>
        <button
          onClick={handleSave}
          disabled={saving}
          className="px-6 py-2.5 bg-primary-dark text-white rounded-lg text-sm font-medium hover:bg-primary transition-colors disabled:opacity-50 flex items-center gap-2"
        >
          {saving && <Loader2 className="w-4 h-4 animate-spin" />}
          Save Settings
        </button>
      </div>
    </div>
  );
}
