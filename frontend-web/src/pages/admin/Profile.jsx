import useAuth from '../../hooks/useAuth';
import { Link } from 'react-router-dom';

export default function AdminProfile() {
  const { user } = useAuth();

  return (
    <div className="max-w-3xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-primary-dark">Profile</h1>
        <p className="text-sm text-slate-500 mt-1">
          Account details for the currently signed-in admin.
        </p>
      </div>

      <div className="bg-white rounded-xl border border-primary-light shadow-sm p-6">
        <div className="flex items-center gap-4 mb-6">
          <div className="w-14 h-14 rounded-full bg-primary-light border-2 border-primary/20 flex items-center justify-center text-primary font-semibold text-lg">
            {user?.full_name?.charAt(0)?.toUpperCase() || 'A'}
          </div>
          <div>
            <p className="text-lg font-semibold text-primary-dark">{user?.full_name || 'Admin User'}</p>
            <p className="text-sm text-slate-500">{user?.email || '—'}</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="border border-slate-100 rounded-lg p-4">
            <p className="text-xs text-slate-400 uppercase tracking-wider mb-1">Role</p>
            <p className="text-sm font-medium text-slate-700">{user?.role || 'admin'}</p>
          </div>
          <div className="border border-slate-100 rounded-lg p-4">
            <p className="text-xs text-slate-400 uppercase tracking-wider mb-1">User ID</p>
            <p className="text-sm font-mono text-slate-600 break-all">{user?.user_id || '—'}</p>
          </div>
        </div>

        <div className="mt-6 pt-4 border-t border-slate-100 flex items-center justify-between">
          <div>
            <p className="text-sm font-semibold text-primary-dark">System Configuration</p>
            <p className="text-xs text-slate-500">Open admin settings and configuration panels.</p>
          </div>
          <Link
            to="/admin/settings"
            className="inline-flex items-center px-4 py-2 rounded-lg bg-primary text-white text-sm font-medium hover:bg-primary/90 transition"
          >
            Open Settings
          </Link>
        </div>
      </div>
    </div>
  );
}
