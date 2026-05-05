import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation } from '@tanstack/react-query';
import {
  Settings as SettingsIcon,
  User,
  BookOpen,
  Loader2,
  AlertCircle,
  Camera,
  Shield,
  Lock,
  Eye,
  EyeOff,
  X,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { getProfile, updateProfile } from '../../services/instructorService';
import authService from '../../services/authService';
import { applyTheme } from '../../lib/theme';
import { queryClient } from '../../lib/queryClient';

export default function InstructorSettings() {
  const navigate = useNavigate();
  const fileInputRef = useRef(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [twoFaEnabled, setTwoFaEnabled] = useState(false);
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
  const [form, setForm] = useState({ full_name: '', profile_image_url: '' });

  useEffect(() => {
    const fetchProfile = async () => {
      try {
        const res = await getProfile();
        setProfile(res.data);
        setForm({
          full_name: res.data.full_name || '',
          profile_image_url: res.data.profile_image_url || '',
        });
        setTwoFaEnabled(Boolean(res.data.totp_enabled));
      } catch {
        toast.error('Failed to load profile');
      } finally {
        setLoading(false);
      }
    };
    fetchProfile();
  }, []);

  useEffect(() => {
    applyTheme(themePreference);
  }, [themePreference]);

  const updateProfileMutation = useMutation({
    mutationFn: (payload) => updateProfile(payload),
    onSuccess: (res) => {
      setProfile(res.data);
      setForm({
        full_name: res.data.full_name || '',
        profile_image_url: res.data.profile_image_url || '',
      });
      toast.success('Profile updated');
      queryClient.invalidateQueries({ queryKey: ['instructor', 'profile'] });
    },
    onError: (err) => {
      toast.error(err.response?.data?.detail || 'Failed to update profile');
    },
  });

  const disable2FAMutation = useMutation({
    mutationFn: ({ code, password }) => authService.disable2FA(code, password),
    onSuccess: async () => {
      toast.success('Two-factor authentication disabled');
      setShowDisable2FA(false);
      setDisableCode('');
      setDisablePassword('');
      setTwoFaEnabled(false);
      queryClient.invalidateQueries({ queryKey: ['instructor', 'profile'] });
      try {
        const res = await getProfile();
        setProfile(res.data);
      } catch {
        // Ignore refresh errors here; local state already reflects change.
      }
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

  const handleSave = () => {
    if (!profile) return;
    const payload = {};
    if (form.full_name !== profile.full_name) payload.full_name = form.full_name;
    if ((form.profile_image_url || '') !== (profile.profile_image_url || '')) {
      payload.profile_image_url = form.profile_image_url || null;
    }
    if (Object.keys(payload).length === 0) {
      toast('No changes to save');
      return;
    }
    updateProfileMutation.mutate(payload);
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
      setForm((prev) => ({ ...prev, profile_image_url: String(reader.result || '') }));
      toast.success('Profile image selected');
    };
    reader.onerror = () => toast.error('Could not read image file');
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const handle2FAToggle = () => {
    if (twoFaEnabled) setShowDisable2FA(true);
    else navigate('/2fa-setup');
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
    if (!currentPassword || !newPassword || !confirmPassword) {
      toast.error('Fill in all password fields');
      return;
    }
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

  const handleDiscard = () => {
    if (!profile) return;
    setForm({
      full_name: profile.full_name || '',
      profile_image_url: profile.profile_image_url || '',
    });
    toast('Changes discarded');
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <AlertCircle className="w-12 h-12 text-red-400 mb-4" />
        <p className="text-slate-500">Failed to load profile.</p>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 rounded-lg bg-primary-light flex items-center justify-center">
          <SettingsIcon className="w-5 h-5 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-primary-dark">Settings</h1>
          <p className="text-sm text-slate-500">Manage your profile and preferences.</p>
        </div>
      </div>

      {/* Profile Card */}
      <div className="bg-white rounded-xl border border-primary-light p-6 mb-6">
        <div className="flex items-center gap-4 mb-6 pb-6 border-b border-slate-100">
          <div className="relative">
            <div className="w-16 h-16 rounded-full bg-primary-light border-2 border-primary/20 overflow-hidden flex items-center justify-center text-primary text-2xl font-bold">
              {form.profile_image_url ? (
                <img src={form.profile_image_url} alt="" className="w-full h-full object-cover" />
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
          <div>
            <h2 className="text-lg font-bold text-primary-dark">{profile.full_name}</h2>
            <p className="text-sm text-slate-500">{profile.email}</p>
            <span className="inline-block mt-1 px-2 py-0.5 bg-primary-light text-primary text-xs font-medium rounded-full capitalize">
              {profile.role}
            </span>
          </div>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Full Name</label>
            <input
              type="text"
              required
              value={form.full_name}
              onChange={(e) => setForm({ ...form, full_name: e.target.value })}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
            />
          </div>

          <p className="text-xs text-slate-500">
            Upload a profile image from your device. Supports common image formats up to 2 MB.
          </p>

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={handleDiscard}
              className="px-4 py-2 border border-primary-light rounded-lg text-sm text-slate-600 hover:bg-slate-50 transition-colors"
            >
              Discard
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={updateProfileMutation.isPending}
              className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg text-sm hover:bg-primary/90 transition disabled:opacity-50"
            >
              {updateProfileMutation.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
              Save Changes
            </button>
          </div>
        </div>
      </div>

      {/* Security */}
      <div className="bg-white rounded-xl border border-primary-light p-6 mb-6">
        <h3 className="text-sm font-semibold text-primary-dark mb-4">Security</h3>
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Shield className="w-4 h-4 text-primary" />
              <span className="text-sm text-slate-700">Two-Factor Authentication</span>
            </div>
            <button
              type="button"
              onClick={handle2FAToggle}
              className={`relative w-11 h-6 rounded-full transition-colors ${twoFaEnabled ? 'bg-primary' : 'bg-slate-300'}`}
            >
              <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${twoFaEnabled ? 'translate-x-5' : ''}`} />
            </button>
          </div>
          {twoFaEnabled && (
            <p className="text-xs text-green-600 flex items-center gap-1">
              <Shield className="w-3 h-3" /> 2FA is active
            </p>
          )}
          <button
            type="button"
            onClick={() => setShowChangePassword(true)}
            className="text-sm text-primary hover:underline flex items-center gap-1"
          >
            <Lock className="w-3.5 h-3.5" />
            Update Password
          </button>
        </div>
      </div>

      {/* Interface Theme */}
      <div className="bg-white rounded-xl border border-primary-light p-5 mb-6">
        <h3 className="font-semibold text-primary-dark mb-3">Interface Theme</h3>
        <p className="text-xs text-slate-500 mb-3">Choose how the instructor dashboard appears on this device.</p>
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

      {/* Account Info */}
      <div className="bg-white rounded-xl border border-primary-light p-6 mb-6">
        <h3 className="text-sm font-semibold text-primary-dark mb-4">Account Information</h3>
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm text-slate-500">Email</span>
            <span className="text-sm text-primary-dark font-medium">{profile.email}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-slate-500">Account Status</span>
            <span className={`text-sm font-medium ${profile.is_active ? 'text-green-600' : 'text-red-600'}`}>
              {profile.is_active ? 'Active' : 'Inactive'}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-slate-500">Two-Factor Auth</span>
            <span className={`text-sm font-medium ${profile.totp_enabled ? 'text-green-600' : 'text-slate-500'}`}>
              {profile.totp_enabled ? 'Enabled' : 'Not Enabled'}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-slate-500">Joined</span>
            <span className="text-sm text-primary-dark">{new Date(profile.created_at).toLocaleDateString()}</span>
          </div>
        </div>
      </div>

      {/* Assigned Subjects */}
      {profile.subjects?.length > 0 && (
        <div className="bg-white rounded-xl border border-primary-light p-6">
          <h3 className="text-sm font-semibold text-primary-dark mb-4">Assigned Subjects</h3>
          <div className="space-y-2">
            {profile.subjects.map((s) => (
              <div key={s.subject_id} className="flex items-center justify-between bg-slate-50 rounded-lg p-3">
                <div className="flex items-center gap-3">
                  <BookOpen className="w-4 h-4 text-primary" />
                  <div>
                    <p className="text-sm font-medium text-primary-dark">{s.subject_name}</p>
                    <p className="text-xs text-slate-500">{s.grade_name}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3 text-xs text-slate-500">
                  <span>{s.student_count} students</span>
                  <span>{s.assignment_count} assignments</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

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
              <input
                type="text"
                inputMode="numeric"
                maxLength={6}
                value={disableCode}
                onChange={(e) => setDisableCode(e.target.value.replace(/\D/g, ''))}
                placeholder="6-digit code"
                className="w-full text-center text-lg tracking-[0.2em] border border-primary-light rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
              />
              <input
                type="password"
                value={disablePassword}
                onChange={(e) => setDisablePassword(e.target.value)}
                placeholder="Account password"
                className="w-full border border-primary-light rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
              />
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
                <label className="text-xs text-slate-500 uppercase tracking-wider block mb-1">Current Password</label>
                <div className="relative">
                  <input
                    type={showPasswords ? 'text' : 'password'}
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
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
                <label className="text-xs text-slate-500 uppercase tracking-wider block mb-1">New Password</label>
                <div className="relative">
                  <input
                    type={showPasswords ? 'text' : 'password'}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
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
                <label className="text-xs text-slate-500 uppercase tracking-wider block mb-1">Confirm New Password</label>
                <div className="relative">
                  <input
                    type={showPasswords ? 'text' : 'password'}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
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
