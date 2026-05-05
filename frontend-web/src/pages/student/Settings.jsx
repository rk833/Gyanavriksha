import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation } from '@tanstack/react-query';
import { User, Shield, Monitor, Lock, Loader2, Eye, EyeOff, X, Camera } from 'lucide-react';
import toast from 'react-hot-toast';
import { getProfile, updateProfile, getEnrollments } from '../../services/studentService';
import authService from '../../services/authService';
import useAuth from '../../hooks/useAuth';
import { queryClient } from '../../lib/queryClient';
import { applyTheme } from '../../lib/theme';

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
  const fileInputRef = useRef(null);
  const [fullName, setFullName] = useState('');
  const [twoFaEnabled, setTwoFaEnabled] = useState(false);
  const [alerts, setAlerts] = useState({
    grading_updates: true,
    quiz_reminders: true,
    posture_connection: false,
  });
  const [showDisable2FA, setShowDisable2FA] = useState(false);
  const [disableCode, setDisableCode] = useState('');
  const [disablePassword, setDisablePassword] = useState('');
  const [showChangePassword, setShowChangePassword] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPasswords, setShowPasswords] = useState(false);
  const [themePreference, setThemePreference] = useState(
    () => localStorage.getItem('gv_theme_preference') || 'system',
  );

  const { data: profile, isPending: profileLoading } = useQuery({
    queryKey: ['student', 'profile'],
    queryFn: async () => {
      const res = await getProfile();
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

  useEffect(() => {
    if (profile) {
      setFullName(profile.full_name || '');
      setTwoFaEnabled(profile.totp_enabled || false);
      const p = profile.notification_preferences || {};
      setAlerts({
        grading_updates: p.grading_updates !== false,
        quiz_reminders: p.quiz_reminders !== false,
        posture_connection: p.posture_connection === true,
      });
    }
  }, [profile]);

  useEffect(() => {
    applyTheme(themePreference);
  }, [themePreference]);

  const enrollments = enrollmentsData?.items || [];
  const loading = profileLoading || enrollmentsLoading;

  const updateProfileMutation = useMutation({
    mutationFn: (data) => updateProfile(data),
    onSuccess: () => {
      toast.success('Settings saved successfully');
      queryClient.invalidateQueries({ queryKey: ['student', 'profile'] });
    },
    onError: (err) => {
      toast.error(err.response?.data?.detail || 'Failed to save');
    },
  });

  const disable2FAMutation = useMutation({
    mutationFn: ({ code, password }) => authService.disable2FA(code, password),
    onSuccess: () => {
      toast.success('Two-factor authentication disabled');
      setShowDisable2FA(false);
      setDisableCode('');
      setDisablePassword('');
      setTwoFaEnabled(false);
      queryClient.invalidateQueries({ queryKey: ['student', 'profile'] });
    },
    onError: (err) => {
      toast.error(err.response?.data?.detail || 'Failed to disable 2FA');
    },
  });

  const changePasswordMutation = useMutation({
    mutationFn: ({ current, newPass }) => authService.changePassword(current, newPass),
    onSuccess: () => {
      toast.success('Password changed successfully');
      setShowChangePassword(false);
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    },
    onError: (err) => {
      toast.error(err.response?.data?.detail || 'Failed to change password');
    },
  });

  const handleSave = () =>
    updateProfileMutation.mutate({
      full_name: fullName,
      notification_preferences: { ...alerts },
    });

  const handleDiscard = () => {
    setFullName(profile?.full_name || '');
    const p = profile?.notification_preferences || {};
    setAlerts({
      grading_updates: p.grading_updates !== false,
      quiz_reminders: p.quiz_reminders !== false,
      posture_connection: p.posture_connection === true,
    });
    toast('Changes discarded');
  };

  const handleProfileImageSelect = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      toast.error('Please select an image file');
      e.target.value = '';
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      toast.error('Image must be under 2 MB');
      e.target.value = '';
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      updateProfileMutation.mutate({ profile_image_url: String(reader.result || '') });
    };
    reader.onerror = () => toast.error('Could not read image file');
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const handle2FAToggle = () => {
    if (twoFaEnabled) {
      setShowDisable2FA(true);
    } else {
      navigate('/2fa-setup');
    }
  };

  const handleDisable2FA = (e) => {
    e.preventDefault();
    if (!disableCode || disableCode.length !== 6) {
      toast.error('Enter a valid 6-digit code');
      return;
    }
    disable2FAMutation.mutate({ code: disableCode, password: disablePassword });
  };

  const handleChangePassword = (e) => {
    e.preventDefault();
    if (newPassword.length < 8) {
      toast.error('New password must be at least 8 characters');
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error('Passwords do not match');
      return;
    }
    changePasswordMutation.mutate({ current: currentPassword, newPass: newPassword });
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
          <div className="relative flex-shrink-0">
            <div className="w-16 h-16 rounded-full bg-primary-light border-2 border-primary/20 overflow-hidden flex items-center justify-center">
              {profile?.profile_image_url ? (
                <img src={profile.profile_image_url} alt="" className="w-full h-full object-cover" />
              ) : (
                <User className="w-8 h-8 text-primary/50" />
              )}
            </div>
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="absolute -bottom-1 -right-1 w-7 h-7 rounded-full bg-primary text-white flex items-center justify-center shadow-sm hover:bg-primary-dark transition-colors"
              title="Upload profile picture"
            >
              <Camera className="w-3.5 h-3.5" />
            </button>
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleProfileImageSelect}
            className="hidden"
          />
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
                onClick={handle2FAToggle}
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
            {twoFaEnabled && (
              <p className="text-xs text-green-600 flex items-center gap-1">
                <Shield className="w-3 h-3" /> 2FA is active
              </p>
            )}
            <button
              onClick={() => setShowChangePassword(true)}
              className="text-sm text-primary hover:underline flex items-center gap-1"
            >
              <Lock className="w-3.5 h-3.5" />
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
            <div>
              <Toggle
                label="Posture Connection (IoT)"
                checked={alerts.posture_connection}
                onChange={(v) => setAlerts((p) => ({ ...p, posture_connection: v }))}
              />
              <p className="text-[11px] text-slate-500 mt-1.5 pl-0 leading-snug">
                When on, ultrasonic &ldquo;too close&rdquo; readings send in-app posture alerts while your desk device is assigned to you. Your ESP32 desk still adjusts its LED from the LDR automatically in firmware &mdash; use{' '}
                <button
                  type="button"
                  onClick={() => navigate('/student/iot-status')}
                  className="text-primary hover:underline font-medium"
                >
                  IoT Status
                </button>{' '}
                to verify readings. Click <span className="font-medium text-slate-600">Save Settings</span> after changing toggles.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Interface Theme */}
      <div className="bg-white rounded-xl border border-primary-light p-5 mb-4">
        <h3 className="font-semibold text-primary-dark mb-3">Interface Theme</h3>
        <p className="text-xs text-slate-500 mb-3">Choose how the student dashboard appears on this device.</p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {[
            { id: 'light', label: 'Light', bg: 'bg-white border-2 border-slate-300', dot: 'bg-primary-dark' },
            { id: 'dark', label: 'Dark', bg: 'bg-slate-800', dot: 'bg-primary-light' },
            { id: 'system', label: 'System', bg: 'bg-gradient-to-r from-white to-slate-800', dot: 'bg-primary' },
          ].map((theme) => (
            <button
              key={theme.id}
              type="button"
              onClick={() => setThemePreference(theme.id)}
              className={`rounded-xl h-16 flex flex-col items-center justify-center gap-1 border-2 transition ${theme.bg} ${
                themePreference === theme.id ? 'ring-2 ring-primary ring-offset-2' : 'border-transparent'
              }`}
            >
              <div className={`w-3 h-3 rounded-full ${theme.dot}`} />
              <span className={`text-xs font-semibold ${theme.id === 'dark' ? 'text-white' : 'text-slate-700'}`}>
                {theme.label}
              </span>
            </button>
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
                <td className="py-3 text-slate-400">&mdash;</td>
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
          disabled={updateProfileMutation.isPending}
          className="px-6 py-2.5 bg-primary-dark text-white rounded-lg text-sm font-medium hover:bg-primary transition-colors disabled:opacity-50 flex items-center gap-2"
        >
          {updateProfileMutation.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
          Save Settings
        </button>
      </div>

      {/* Disable 2FA Modal */}
      {showDisable2FA && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/30" onClick={() => setShowDisable2FA(false)} />
          <div className="relative bg-white rounded-xl border border-primary-light shadow-xl w-full max-w-md p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-primary-dark">Disable Two-Factor Authentication</h3>
              <button onClick={() => setShowDisable2FA(false)} className="p-1 rounded-lg hover:bg-slate-100">
                <X className="w-5 h-5 text-slate-400" />
              </button>
            </div>
            <p className="text-sm text-slate-500 mb-4">
              Enter your authenticator code and account password to disable 2FA.
            </p>
            <form onSubmit={handleDisable2FA} className="space-y-3">
              <div>
                <label className="text-xs text-slate-500 uppercase tracking-wider block mb-1">
                  Authenticator Code
                </label>
                <input
                  type="text"
                  inputMode="numeric"
                  maxLength={6}
                  value={disableCode}
                  onChange={(e) => setDisableCode(e.target.value.replace(/\D/g, ''))}
                  placeholder="6-digit code"
                  className="w-full text-center text-lg tracking-[0.2em] border border-primary-light rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
                  autoFocus
                />
              </div>
              <div>
                <label className="text-xs text-slate-500 uppercase tracking-wider block mb-1">
                  Account Password
                </label>
                <input
                  type="password"
                  value={disablePassword}
                  onChange={(e) => setDisablePassword(e.target.value)}
                  placeholder="Enter your password"
                  className="w-full border border-primary-light rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
                />
              </div>
              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowDisable2FA(false)}
                  className="flex-1 px-4 py-2 border border-primary-light rounded-lg text-sm text-slate-600 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={disable2FAMutation.isPending}
                  className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg text-sm font-medium hover:bg-red-700 disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {disable2FAMutation.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
                  Disable 2FA
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Change Password Modal */}
      {showChangePassword && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/30" onClick={() => setShowChangePassword(false)} />
          <div className="relative bg-white rounded-xl border border-primary-light shadow-xl w-full max-w-md p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-primary-dark">Change Password</h3>
              <button onClick={() => setShowChangePassword(false)} className="p-1 rounded-lg hover:bg-slate-100">
                <X className="w-5 h-5 text-slate-400" />
              </button>
            </div>
            <form onSubmit={handleChangePassword} className="space-y-3">
              <div>
                <label className="text-xs text-slate-500 uppercase tracking-wider block mb-1">
                  Current Password
                </label>
                <div className="relative">
                  <input
                    type={showPasswords ? 'text' : 'password'}
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    placeholder="Enter current password"
                    className="w-full border border-primary-light rounded-lg px-3 py-2 pr-10 text-sm outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
                    autoFocus
                  />
                  <button
                    type="button"
                    onClick={() => setShowPasswords(!showPasswords)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-primary"
                  >
                    {showPasswords ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
              <div>
                <label className="text-xs text-slate-500 uppercase tracking-wider block mb-1">
                  New Password
                </label>
                <div className="relative">
                  <input
                    type={showPasswords ? 'text' : 'password'}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Min 8 characters, 1 uppercase, 1 digit"
                    className="w-full border border-primary-light rounded-lg px-3 py-2 pr-10 text-sm outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPasswords(!showPasswords)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-primary"
                  >
                    {showPasswords ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
              <div>
                <label className="text-xs text-slate-500 uppercase tracking-wider block mb-1">
                  Confirm New Password
                </label>
                <div className="relative">
                  <input
                    type={showPasswords ? 'text' : 'password'}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Repeat new password"
                    className="w-full border border-primary-light rounded-lg px-3 py-2 pr-10 text-sm outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPasswords(!showPasswords)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-primary"
                  >
                    {showPasswords ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowChangePassword(false)}
                  className="flex-1 px-4 py-2 border border-primary-light rounded-lg text-sm text-slate-600 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={changePasswordMutation.isPending}
                  className="flex-1 px-4 py-2 bg-primary-dark text-white rounded-lg text-sm font-medium hover:bg-primary disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {changePasswordMutation.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
                  Change Password
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
