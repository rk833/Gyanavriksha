import { useState, useEffect } from 'react';
import {
  Settings as SettingsIcon,
  User,
  BookOpen,
  Loader2,
  Save,
  AlertCircle,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { getProfile, updateProfile } from '../../services/instructorService';

export default function InstructorSettings() {
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
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
      } catch {
        toast.error('Failed to load profile');
      } finally {
        setLoading(false);
      }
    };
    fetchProfile();
  }, []);

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const payload = {};
      if (form.full_name !== profile.full_name) payload.full_name = form.full_name;
      if (form.profile_image_url !== (profile.profile_image_url || ''))
        payload.profile_image_url = form.profile_image_url || null;

      if (Object.keys(payload).length === 0) {
        toast('No changes to save');
        setSaving(false);
        return;
      }

      const res = await updateProfile(payload);
      setProfile(res.data);
      toast.success('Profile updated');
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to update profile');
    } finally {
      setSaving(false);
    }
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
          <div className="w-16 h-16 rounded-full bg-primary-light border-2 border-primary/20 flex items-center justify-center text-primary text-2xl font-bold">
            {profile.full_name?.charAt(0)?.toUpperCase() || 'I'}
          </div>
          <div>
            <h2 className="text-lg font-bold text-primary-dark">{profile.full_name}</h2>
            <p className="text-sm text-slate-500">{profile.email}</p>
            <span className="inline-block mt-1 px-2 py-0.5 bg-primary-light text-primary text-xs font-medium rounded-full capitalize">
              {profile.role}
            </span>
          </div>
        </div>

        <form onSubmit={handleSave} className="space-y-4">
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

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Profile Image URL</label>
            <input
              type="text"
              value={form.profile_image_url}
              onChange={(e) => setForm({ ...form, profile_image_url: e.target.value })}
              placeholder="https://example.com/avatar.jpg"
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
            />
          </div>

          <div className="flex justify-end pt-2">
            <button
              type="submit"
              disabled={saving}
              className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg text-sm hover:bg-primary/90 transition disabled:opacity-50"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              Save Changes
            </button>
          </div>
        </form>
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
    </div>
  );
}
