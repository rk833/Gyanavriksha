import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import {
  Users,
  Plus,
  Pencil,
  KeyRound,
  Trash2,
  X,
  ChevronLeft,
  ChevronRight,
  Copy,
  ShieldCheck,
  Loader2,
  AlertCircle,
} from 'lucide-react';
import toast from 'react-hot-toast';
import {
  getUsers,
  createUser,
  suspendUser,
  deleteUser,
  bulkSuspend,
  bulkDelete,
  resetPassword,
  getGrades,
} from '../../services/adminService';

function RoleBadge({ role }) {
  const styles = {
    student: 'bg-blue-100 text-blue-700',
    instructor: 'bg-green-100 text-green-700',
    admin: 'bg-primary-dark text-white',
  };
  return (
    <span className={`px-2 py-0.5 rounded text-xs font-medium uppercase ${styles[role] || 'bg-slate-100 text-slate-600'}`}>
      {role}
    </span>
  );
}

function UserAvatar({ name }) {
  return (
    <div className="w-8 h-8 rounded-full bg-primary-light flex items-center justify-center text-primary font-bold text-xs flex-shrink-0">
      {name?.charAt(0)?.toUpperCase() || '?'}
    </div>
  );
}

function StatusDot({ isActive }) {
  return (
    <span className={`inline-flex items-center gap-1.5 text-xs font-medium ${isActive ? 'text-green-600' : 'text-amber-600'}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${isActive ? 'bg-green-500' : 'bg-amber-500'}`} />
      {isActive ? 'Active' : 'Pending'}
    </span>
  );
}

function TfaBadge({ enabled }) {
  return (
    <ShieldCheck className={`w-4 h-4 ${enabled ? 'text-green-500' : 'text-slate-300'}`} />
  );
}

function Pagination({ page, totalPages, onChange }) {
  if (totalPages <= 1) return null;
  return (
    <div className="flex items-center gap-1">
      <button
        onClick={() => onChange(page - 1)}
        disabled={page === 1}
        className="p-1.5 rounded hover:bg-primary-light/50 disabled:opacity-40 transition"
      >
        <ChevronLeft className="w-4 h-4 text-slate-600" />
      </button>
      {[...Array(Math.min(totalPages, 5))].map((_, i) => {
        const p = i + 1;
        return (
          <button
            key={p}
            onClick={() => onChange(p)}
            className={`w-8 h-8 rounded text-sm font-medium transition ${
              p === page ? 'bg-primary text-white' : 'text-slate-600 hover:bg-primary-light/50'
            }`}
          >
            {p}
          </button>
        );
      })}
      <button
        onClick={() => onChange(page + 1)}
        disabled={page === totalPages}
        className="p-1.5 rounded hover:bg-primary-light/50 disabled:opacity-40 transition"
      >
        <ChevronRight className="w-4 h-4 text-slate-600" />
      </button>
    </div>
  );
}

function PasswordDisplayModal({ password, onClose }) {
  const copy = () => {
    navigator.clipboard.writeText(password);
    toast.success('Password copied!');
  };
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-sm mx-4">
        <h3 className="text-lg font-bold text-primary-dark mb-2">User Created Successfully</h3>
        <p className="text-sm text-slate-500 mb-4">
          Share this auto-generated password with the user — it will not be shown again.
        </p>
        <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 mb-4">
          <code className="flex-1 text-sm font-mono text-primary-dark">{password}</code>
          <button onClick={copy} className="text-slate-400 hover:text-primary transition">
            <Copy className="w-4 h-4" />
          </button>
        </div>
        <button
          onClick={onClose}
          className="w-full py-2 bg-primary text-white text-sm font-medium rounded-lg hover:bg-primary/90 transition"
        >
          Done
        </button>
      </div>
    </div>
  );
}

function ConfirmDialog({ title, message, confirmLabel, dangerous, onConfirm, onCancel, loading }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-sm mx-4">
        <h3 className="text-lg font-bold text-primary-dark mb-2">{title}</h3>
        <p className="text-sm text-slate-500 mb-6">{message}</p>
        <div className="flex gap-3">
          <button
            onClick={onCancel}
            className="flex-1 py-2 border border-slate-200 text-slate-600 text-sm font-medium rounded-lg hover:bg-slate-50 transition"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={loading}
            className={`flex-1 py-2 text-white text-sm font-medium rounded-lg transition disabled:opacity-60 flex items-center justify-center gap-2 ${
              dangerous ? 'bg-red-600 hover:bg-red-700' : 'bg-primary hover:bg-primary/90'
            }`}
          >
            {loading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

function AddUserModal({ grades, onClose, onSuccess }) {
  const [form, setForm] = useState({ full_name: '', email: '', role: 'student', grade_id: '', password: '' });
  const [autoPass, setAutoPass] = useState(true);
  const [saving, setSaving] = useState(false);

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const payload = { ...form, grade_id: form.grade_id ? Number(form.grade_id) : undefined };
      if (autoPass) delete payload.password;
      const res = await createUser(payload);
      onSuccess(res.data);
    } catch (err) {
      toast.error(err?.response?.data?.detail || 'Failed to create user');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-md mx-4">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-bold text-primary-dark">Add New User</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">Full Name</label>
            <input
              required
              value={form.full_name}
              onChange={(e) => set('full_name', e.target.value)}
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
              placeholder="e.g. Priya Sharma"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">Email</label>
            <input
              required
              type="email"
              value={form.email}
              onChange={(e) => set('email', e.target.value)}
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
              placeholder="user@gyanavriksha.edu.np"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">Role</label>
            <select
              value={form.role}
              onChange={(e) => set('role', e.target.value)}
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
            >
              <option value="student">Student</option>
              <option value="instructor">Instructor</option>
              <option value="admin">Admin</option>
            </select>
          </div>
          {form.role === 'student' && (
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">Grade</label>
              <select
                required
                value={form.grade_id}
                onChange={(e) => set('grade_id', e.target.value)}
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
              >
                <option value="">Select grade</option>
                {grades?.map((g) => (
                  <option key={g.grade_id} value={g.grade_id}>{g.grade_name}</option>
                ))}
              </select>
            </div>
          )}
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={autoPass}
              onChange={(e) => setAutoPass(e.target.checked)}
              className="accent-primary"
            />
            <span className="text-sm text-slate-600">Auto-generate password</span>
          </label>
          {!autoPass && (
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">Password</label>
              <input
                required
                type="password"
                value={form.password}
                onChange={(e) => set('password', e.target.value)}
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
              />
            </div>
          )}
          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2 border border-slate-200 text-slate-600 text-sm font-medium rounded-lg hover:bg-slate-50 transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="flex-1 py-2 bg-primary text-white text-sm font-medium rounded-lg hover:bg-primary/90 transition disabled:opacity-60 flex items-center justify-center gap-2"
            >
              {saving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              Create User
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function BottomStats({ users, data }) {
  const navigate = useNavigate();
  const roleDist = data?.role_distribution || {};
  const twoFaPct = data?.two_fa_compliance?.compliance_pct ?? 0;
  const pendingCount = users?.filter((u) => !u.is_active).length ?? 0;

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6">
      <div className="bg-white rounded-xl border border-primary-light p-5 shadow-sm">
        <div className="flex items-center gap-2 mb-2">
          <ShieldCheck className="w-4 h-4 text-primary" />
          <span className="text-sm font-semibold text-slate-700">Security Health</span>
        </div>
        <p className="text-3xl font-bold text-primary-dark">{twoFaPct}%</p>
        <p className="text-xs text-slate-500 mb-3">2FA Compliance across all staff</p>
        <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
          <div className="h-full bg-primary rounded-full" style={{ width: `${twoFaPct}%` }} />
        </div>
      </div>

      <div className="bg-white rounded-xl border border-primary-light p-5 shadow-sm">
        <div className="flex items-center gap-2 mb-3">
          <Users className="w-4 h-4 text-primary" />
          <span className="text-sm font-semibold text-slate-700">Role Distribution</span>
        </div>
        <div className="space-y-1.5">
          <div className="flex justify-between text-sm">
            <span className="text-slate-500">Students</span>
            <span className="font-semibold text-primary-dark">{roleDist.student ?? '—'}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-slate-500">Instructors</span>
            <span className="font-semibold text-primary-dark">{roleDist.instructor ?? '—'}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-slate-500">Administrators</span>
            <span className="font-semibold text-primary-dark">{roleDist.admin ?? '—'}</span>
          </div>
        </div>
      </div>

      <div className="bg-primary-dark text-white rounded-xl p-5 shadow-sm flex flex-col justify-between">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Users className="w-4 h-4 text-white/70" />
            <span className="text-sm font-semibold">Pending Approval</span>
          </div>
          <p className="text-4xl font-bold mt-2">{pendingCount}</p>
          <p className="text-white/60 text-xs mt-1">New enrollments requiring review</p>
        </div>
        <button
          onClick={() => navigate('/admin/users?status=pending')}
          className="mt-4 w-full py-2 bg-white/10 hover:bg-white/20 text-white text-sm font-medium rounded-lg transition"
        >
          Review Queue
        </button>
      </div>
    </div>
  );
}

export default function UserManagement() {
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [roleFilter, setRoleFilter] = useState('');
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [showAddModal, setShowAddModal] = useState(false);
  const [generatedPassword, setGeneratedPassword] = useState(null);
  const [confirmSuspend, setConfirmSuspend] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [actionLoading, setActionLoading] = useState(false);

  const perPage = 20;

  const { data: userData, isPending: loading, error } = useQuery({
    queryKey: ['admin', 'users', page, roleFilter],
    queryFn: async () => {
      const params = { page, per_page: perPage };
      if (roleFilter) params.role = roleFilter;
      return (await getUsers(params)).data;
    },
  });

  const { data: gradesData } = useQuery({
    queryKey: ['admin', 'grades'],
    queryFn: async () => (await getGrades()).data?.grades ?? [],
  });

  const users = userData?.users ?? [];
  const totalCount = userData?.total_count ?? 0;
  const totalPages = Math.ceil(totalCount / perPage);

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['admin', 'users'] });

  const toggleSelect = (id) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    if (selectedIds.size === users.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(users.map((u) => u.user_id)));
    }
  };

  const handleBulkSuspend = async () => {
    setActionLoading(true);
    try {
      await bulkSuspend({ user_ids: [...selectedIds] });
      toast.success('Users suspended');
      setSelectedIds(new Set());
      invalidate();
    } catch {
      toast.error('Bulk suspend failed');
    } finally {
      setActionLoading(false);
    }
  };

  const handleBulkDelete = async () => {
    setActionLoading(true);
    try {
      await bulkDelete({ user_ids: [...selectedIds] });
      toast.success('Users deleted');
      setSelectedIds(new Set());
      invalidate();
    } catch {
      toast.error('Bulk delete failed');
    } finally {
      setActionLoading(false);
    }
  };

  const handleSuspend = async () => {
    setActionLoading(true);
    try {
      await suspendUser(confirmSuspend);
      toast.success('User suspended');
      setConfirmSuspend(null);
      invalidate();
    } catch {
      toast.error('Failed to suspend user');
    } finally {
      setActionLoading(false);
    }
  };

  const handleDelete = async () => {
    setActionLoading(true);
    try {
      await deleteUser(confirmDelete);
      toast.success('User deleted');
      setConfirmDelete(null);
      invalidate();
    } catch {
      toast.error('Failed to delete user');
    } finally {
      setActionLoading(false);
    }
  };

  const handleResetPassword = async (id) => {
    try {
      await resetPassword(id);
      toast.success('Password reset — email sent to user');
    } catch {
      toast.error('Failed to reset password');
    }
  };

  const handleUserCreated = (data) => {
    setShowAddModal(false);
    invalidate();
    if (data.generated_password) {
      setGeneratedPassword(data.generated_password);
    } else {
      toast.success('User created successfully');
    }
  };

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <AlertCircle className="w-12 h-12 text-red-400 mb-4" />
        <h2 className="text-lg font-semibold text-primary-dark mb-2">Failed to Load Users</h2>
        <p className="text-slate-500 text-sm">{error?.response?.data?.detail || error?.message}</p>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-start justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-primary-light flex items-center justify-center">
            <Users className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-primary-dark">User Management</h1>
            <p className="text-sm text-slate-500">Manage institutional access, roles, and student enrollment status.</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <select
            value={roleFilter}
            onChange={(e) => { setRoleFilter(e.target.value); setPage(1); }}
            className="border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-600 focus:outline-none focus:ring-2 focus:ring-primary/30"
          >
            <option value="">Filter by Role</option>
            <option value="student">Student</option>
            <option value="instructor">Instructor</option>
            <option value="admin">Admin</option>
          </select>
          <button
            onClick={() => setShowAddModal(true)}
            className="flex items-center gap-2 bg-primary text-white text-sm font-medium px-4 py-2 rounded-lg hover:bg-primary/90 transition"
          >
            <Plus className="w-4 h-4" />
            Add New User
          </button>
        </div>
      </div>

      {selectedIds.size > 0 && (
        <div className="flex items-center gap-4 bg-primary-dark text-white rounded-xl px-5 py-3 mb-4">
          <span className="text-sm font-medium">{selectedIds.size} users selected</span>
          <button
            onClick={handleBulkSuspend}
            disabled={actionLoading}
            className="text-xs font-semibold bg-white/10 hover:bg-white/20 px-3 py-1.5 rounded-lg transition"
          >
            BULK SUSPEND
          </button>
          <button
            onClick={handleBulkDelete}
            disabled={actionLoading}
            className="text-xs font-semibold bg-red-500/80 hover:bg-red-500 px-3 py-1.5 rounded-lg transition"
          >
            BULK DELETE
          </button>
          <button
            onClick={() => setSelectedIds(new Set())}
            className="ml-auto text-white/60 hover:text-white transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      <div className="bg-white rounded-xl border border-primary-light shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-100">
                <th className="px-4 py-3">
                  <input
                    type="checkbox"
                    checked={users.length > 0 && selectedIds.size === users.length}
                    onChange={toggleAll}
                    className="accent-primary"
                  />
                </th>
                {['Name', 'Email', 'Role', 'Grade', 'Status', '2FA', 'Actions'].map((h) => (
                  <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                [...Array(5)].map((_, i) => (
                  <tr key={i} className="border-b border-slate-50">
                    {[...Array(8)].map((__, j) => (
                      <td key={j} className="px-4 py-3">
                        <div className="h-4 bg-slate-200 rounded animate-pulse" />
                      </td>
                    ))}
                  </tr>
                ))
              ) : users.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-10 text-center text-sm text-slate-400">
                    No users found.
                  </td>
                </tr>
              ) : (
                users.map((u) => (
                  <tr key={u.user_id} className="border-b border-slate-50 hover:bg-slate-50/50 transition">
                    <td className="px-4 py-3">
                      <input
                        type="checkbox"
                        checked={selectedIds.has(u.user_id)}
                        onChange={() => toggleSelect(u.user_id)}
                        className="accent-primary"
                      />
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <UserAvatar name={u.full_name} />
                        <span className="text-sm font-medium text-primary-dark">{u.full_name}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-600">{u.email}</td>
                    <td className="px-4 py-3">
                      <RoleBadge role={u.role} />
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-600">{u.grade_name || '—'}</td>
                    <td className="px-4 py-3">
                      <StatusDot isActive={u.is_active} />
                    </td>
                    <td className="px-4 py-3">
                      <TfaBadge enabled={u.totp_enabled} />
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleResetPassword(u.user_id)}
                          className="text-slate-400 hover:text-amber-500 transition"
                          title="Reset Password"
                        >
                          <KeyRound className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => setConfirmSuspend(u.user_id)}
                          className="text-slate-400 hover:text-primary transition"
                          title="Suspend"
                        >
                          <Pencil className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => setConfirmDelete(u.user_id)}
                          className="text-slate-400 hover:text-red-500 transition"
                          title="Delete"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className="flex items-center justify-between px-4 py-3 border-t border-slate-100">
          <p className="text-sm text-slate-500">
            Showing {users.length > 0 ? (page - 1) * perPage + 1 : 0}–{Math.min(page * perPage, totalCount)} of {totalCount} users
          </p>
          <Pagination page={page} totalPages={totalPages} onChange={setPage} />
        </div>
      </div>

      <BottomStats users={users} data={userData} />

      {showAddModal && (
        <AddUserModal
          grades={gradesData}
          onClose={() => setShowAddModal(false)}
          onSuccess={handleUserCreated}
        />
      )}

      {generatedPassword && (
        <PasswordDisplayModal
          password={generatedPassword}
          onClose={() => setGeneratedPassword(null)}
        />
      )}

      {confirmSuspend && (
        <ConfirmDialog
          title="Suspend User"
          message="This user will be suspended and cannot log in until reactivated."
          confirmLabel="Suspend"
          dangerous={false}
          onConfirm={handleSuspend}
          onCancel={() => setConfirmSuspend(null)}
          loading={actionLoading}
        />
      )}

      {confirmDelete && (
        <ConfirmDialog
          title="Delete User"
          message="This action will permanently remove the user. This cannot be undone."
          confirmLabel="Delete"
          dangerous
          onConfirm={handleDelete}
          onCancel={() => setConfirmDelete(null)}
          loading={actionLoading}
        />
      )}
    </div>
  );
}
