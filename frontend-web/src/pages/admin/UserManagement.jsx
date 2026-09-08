import { useState, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { fmtDate } from '../../utils/dateUtils';
import {
  Users, Plus, Pencil, KeyRound, Trash2, X, ChevronLeft, ChevronRight,
  Copy, ShieldCheck, Loader2, AlertCircle, UserCog, CheckCircle2, Clock,
  RotateCcw, Upload, Download, FileText, AlertTriangle,
} from 'lucide-react';
import toast from 'react-hot-toast';
import {
  getUsers, createUser, updateUser, suspendUser, reactivateUser, deleteUser,
  bulkSuspend, bulkDelete, resetPassword, changeUserRole,
  getGrades, getPendingEnrollments, approveEnrollment, bulkImportUsers,
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
      {isActive ? 'Active' : 'Suspended'}
    </span>
  );
}

function TfaBadge({ enabled }) {
  return <ShieldCheck className={`w-4 h-4 ${enabled ? 'text-green-500' : 'text-slate-300'}`} />;
}

function Pagination({ page, totalPages, onChange }) {
  if (totalPages <= 1) return null;
  const maxVisible = 5;
  const startPage = Math.max(1, page - Math.floor(maxVisible / 2));
  const endPage = Math.min(totalPages, startPage + maxVisible - 1);
  const pages = [];
  for (let p = startPage; p <= endPage; p += 1) pages.push(p);
  return (
    <div className="flex items-center gap-1">
      <button
        onClick={() => onChange(page - 1)}
        disabled={page === 1}
        className="p-1.5 rounded hover:bg-primary-light/50 disabled:opacity-40 transition"
      >
        <ChevronLeft className="w-4 h-4 text-slate-600" />
      </button>
      {startPage > 1 && (
        <>
          <button
            onClick={() => onChange(1)}
            className="w-8 h-8 rounded text-sm font-medium text-slate-600 hover:bg-primary-light/50 transition"
          >
            1
          </button>
          {startPage > 2 && <span className="px-1 text-slate-400">...</span>}
        </>
      )}
      {pages.map((p) => (
        <button
          key={p}
          onClick={() => onChange(p)}
          className={`w-8 h-8 rounded text-sm font-medium transition ${
            p === page ? 'bg-primary text-white' : 'text-slate-600 hover:bg-primary-light/50'
          }`}
        >
          {p}
        </button>
      ))}
      {endPage < totalPages && (
        <>
          {endPage < totalPages - 1 && <span className="px-1 text-slate-400">...</span>}
          <button
            onClick={() => onChange(totalPages)}
            className="w-8 h-8 rounded text-sm font-medium text-slate-600 hover:bg-primary-light/50 transition"
          >
            {totalPages}
          </button>
        </>
      )}
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

function AddUserModal({ grades, onClose, onSuccess }) {
  const [form, setForm] = useState({ full_name: '', email: '', role: 'student', grade_id: '', password: '' });
  const [autoPass, setAutoPass] = useState(true);
  const [saving, setSaving] = useState(false);
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const payload = { ...form, grade_id: form.grade_id ? parseInt(form.grade_id) : null };
      if (autoPass) delete payload.password;
      const res = await createUser(payload);
      onSuccess(res.data);
    } catch (err) {
      toast.error(err?.response?.data?.detail ?? 'Failed to create user');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-md mx-4 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold text-primary-dark">Add New User</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600"><X className="w-5 h-5" /></button>
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

function EditUserModal({ user, grades = [], onClose, onSuccess }) {
  const [fullName, setFullName] = useState(user.full_name);
  const [gradeId, setGradeId] = useState('');
  const [saving, setSaving] = useState(false);

  const isStudent = user.role === 'student';

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const payload = { full_name: fullName };
      if (isStudent && gradeId) payload.grade_id = parseInt(gradeId);
      await updateUser(user.user_id, payload);
      toast.success('User updated');
      onSuccess();
    } catch (err) {
      toast.error(err?.response?.data?.detail ?? 'Failed to update user');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-sm mx-4">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold text-primary-dark">Edit User</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600"><X className="w-5 h-5" /></button>
        </div>
        <p className="text-xs text-slate-500 mb-4">{user.email}</p>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">Full Name</label>
            <input
              required
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
            />
          </div>
          {isStudent && (
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">
                Grade <span className="font-normal text-slate-400">(current: {user.grade_name || 'none'})</span>
              </label>
              <select
                value={gradeId}
                onChange={(e) => setGradeId(e.target.value)}
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
              >
                <option value="">— no grade —</option>
                {grades.map((g) => (
                  <option key={g.grade_id} value={g.grade_id}>{g.grade_name}</option>
                ))}
              </select>
            </div>
          )}
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="flex-1 py-2 border border-slate-200 text-slate-600 text-sm font-medium rounded-lg hover:bg-slate-50 transition">
              Cancel
            </button>
            <button type="submit" disabled={saving} className="flex-1 py-2 bg-primary text-white text-sm font-medium rounded-lg hover:bg-primary/90 transition disabled:opacity-60 flex items-center justify-center gap-2">
              {saving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              Save
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function ChangeRoleModal({ user, onClose, onSuccess }) {
  const [role, setRole] = useState(user.role);
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await changeUserRole(user.user_id, { role });
      toast.success('Role updated');
      onSuccess();
    } catch (err) {
      toast.error(err?.response?.data?.detail ?? 'Failed to change role');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-sm mx-4">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold text-primary-dark">Change Role</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600"><X className="w-5 h-5" /></button>
        </div>
        <p className="text-sm text-slate-600 mb-4">
          User: <span className="font-semibold text-primary-dark">{user.full_name}</span>
        </p>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">New Role</label>
            <select
              value={role}
              onChange={(e) => setRole(e.target.value)}
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
            >
              <option value="student">Student</option>
              <option value="instructor">Instructor</option>
              <option value="admin">Admin</option>
            </select>
          </div>
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="flex-1 py-2 border border-slate-200 text-slate-600 text-sm font-medium rounded-lg hover:bg-slate-50 transition">
              Cancel
            </button>
            <button type="submit" disabled={saving || role === user.role} className="flex-1 py-2 bg-primary text-white text-sm font-medium rounded-lg hover:bg-primary/90 transition disabled:opacity-60 flex items-center justify-center gap-2">
              {saving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              Update Role
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function PasswordDisplayModal({ password, onClose }) {
  const copy = () => { navigator.clipboard.writeText(password); toast.success('Copied!'); };
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-sm mx-4">
        <h2 className="text-lg font-bold text-primary-dark mb-2">User Created</h2>
        <p className="text-sm text-slate-500 mb-4">This is the one-time generated password. Share it securely.</p>
        <div className="flex items-center gap-2 bg-slate-100 rounded-lg px-3 py-2 font-mono text-sm mb-4">
          <span className="flex-1">{password}</span>
          <button onClick={copy} className="text-slate-500 hover:text-primary"><Copy className="w-4 h-4" /></button>
        </div>
        <button onClick={onClose} className="w-full bg-primary-dark text-white rounded-lg py-2.5 text-sm font-semibold hover:bg-primary transition-colors">
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
        <div className="flex items-start gap-3 mb-4">
          <AlertCircle className={`w-5 h-5 shrink-0 mt-0.5 ${dangerous ? 'text-red-500' : 'text-amber-500'}`} />
          <div>
            <h2 className="font-bold text-primary-dark">{title}</h2>
            <p className="text-sm text-slate-500 mt-1">{message}</p>
          </div>
        </div>
        <div className="flex gap-3">
          <button onClick={onCancel} className="flex-1 border border-slate-200 text-slate-600 rounded-lg py-2 text-sm font-semibold hover:bg-slate-50">
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={loading}
            className={`flex-1 rounded-lg py-2 text-sm font-semibold text-white flex items-center justify-center gap-2 ${dangerous ? 'bg-red-600 hover:bg-red-700' : 'bg-primary hover:bg-primary/90'} disabled:opacity-60`}
          >
            {loading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

function PendingEnrollmentsPanel() {
  const queryClient = useQueryClient();

  const { data: pending = [], isLoading } = useQuery({
    queryKey: ['admin', 'pending-enrollments'],
    queryFn: async () => (await getPendingEnrollments()).data ?? [],
  });

  const approveMutation = useMutation({
    mutationFn: (id) => approveEnrollment(id),
    onSuccess: () => {
      toast.success('Enrollment approved');
      queryClient.invalidateQueries({ queryKey: ['admin', 'pending-enrollments'] });
    },
    onError: () => toast.error('Failed to approve enrollment'),
  });

  return (
    <div className="bg-white rounded-xl border border-primary-light shadow-sm overflow-hidden mt-6">
      <div className="flex items-center justify-between px-5 py-4 border-b border-primary-light">
        <div className="flex items-center gap-2">
          <Clock className="w-4 h-4 text-amber-500" />
          <span className="font-semibold text-primary-dark text-sm">Pending Enrollment Approvals</span>
          {pending.length > 0 && (
            <span className="ml-1 bg-amber-100 text-amber-700 text-xs font-bold px-2 py-0.5 rounded-full">{pending.length}</span>
          )}
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-10">
          <Loader2 className="w-5 h-5 animate-spin text-primary" />
        </div>
      ) : pending.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-10 text-slate-400">
          <CheckCircle2 className="w-8 h-8 mb-2 text-green-400" />
          <p className="text-sm">No pending enrollments</p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100">
                {['Student', 'Email', 'Grade', 'Subject', 'Requested', 'Action'].map((h) => (
                  <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {pending.map((e) => (
                <tr key={e.enrollment_id} className="border-b border-slate-50 hover:bg-slate-50/50">
                  <td className="px-4 py-3 font-medium text-primary-dark">{e.student_name ?? '—'}</td>
                  <td className="px-4 py-3 text-slate-500">{e.student_email ?? '—'}</td>
                  <td className="px-4 py-3 text-slate-500">{e.grade_name ?? '—'}</td>
                  <td className="px-4 py-3 text-slate-500">{e.subject_name ?? '—'}</td>
                  <td className="px-4 py-3 text-slate-400 text-xs">
                    {fmtDate(e.enrolled_at)}
                  </td>
                  <td className="px-4 py-3">
                    <button
                      onClick={() => approveMutation.mutate(e.enrollment_id)}
                      disabled={approveMutation.isPending}
                      className="flex items-center gap-1.5 bg-primary text-white text-xs font-semibold px-3 py-1.5 rounded-lg hover:bg-primary/90 transition disabled:opacity-60"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      Approve
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function BottomStats({ data }) {
  const navigate = useNavigate();
  const roleDist = data?.role_distribution || {};
  const twoFaPct = data?.security_health_pct ?? 0;
  const pendingCount = data?.pending_approvals_count ?? 0;

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
            <span className="font-semibold text-primary-dark">{roleDist.students ?? '—'}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-slate-500">Instructors</span>
            <span className="font-semibold text-primary-dark">{roleDist.instructors ?? '—'}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-slate-500">Administrators</span>
            <span className="font-semibold text-primary-dark">{roleDist.admins ?? '—'}</span>
          </div>
        </div>
      </div>

      <div className="bg-primary-dark text-white rounded-xl p-5 shadow-sm flex flex-col justify-between">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Clock className="w-4 h-4 text-white/70" />
            <span className="text-sm font-semibold">Pending Approvals</span>
          </div>
          <p className="text-4xl font-bold mt-2">{pendingCount}</p>
          <p className="text-white/60 text-xs mt-1">Enrollments requiring review</p>
        </div>
        <button
          onClick={() => navigate('/admin/academic')}
          className="mt-4 w-full py-2 bg-white/10 hover:bg-white/20 text-white text-sm font-medium rounded-lg transition"
        >
          Review Queue
        </button>
      </div>
    </div>
  );
}

function ImportResultRow({ r }) {
  const icon = r.status === 'created'
    ? <CheckCircle2 className="w-4 h-4 text-green-500 shrink-0" />
    : r.status === 'skipped'
    ? <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0" />
    : <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />;
  return (
    <div className={`flex items-start gap-2 py-2 border-b border-slate-100 last:border-0 text-sm ${r.status === 'failed' ? 'bg-red-50 px-2 rounded' : ''}`}>
      {icon}
      <div className="flex-1 min-w-0">
        <p className="font-medium text-slate-700 truncate">{r.full_name} <span className="text-slate-400 font-normal">({r.email})</span></p>
        {r.reason && <p className="text-xs text-slate-500 mt-0.5">{r.reason}</p>}
        {r.generated_password && (
          <p className="text-xs font-mono bg-slate-100 px-2 py-0.5 rounded mt-0.5 text-slate-600">
            Temp password: {r.generated_password}
          </p>
        )}
      </div>
      <span className={`text-xs font-semibold uppercase px-2 py-0.5 rounded-full shrink-0 ${
        r.status === 'created' ? 'bg-green-100 text-green-700'
        : r.status === 'skipped' ? 'bg-amber-100 text-amber-700'
        : 'bg-red-100 text-red-600'
      }`}>{r.status}</span>
    </div>
  );
}

function BulkImportModal({ grades = [], onClose, onDone }) {
  const [role, setRole] = useState('student');
  const [file, setFile] = useState(null);
  const [results, setResults] = useState(null);
  const [importing, setImporting] = useState(false);
  const fileRef = useRef();

  const gradeNames = grades.map((g) => g.grade_name);

  const downloadTemplate = () => {
    const isStudent = role === 'student';
    const header = isStudent ? 'full_name,email,grade' : 'full_name,email';
    const rows = isStudent
      ? `John Doe,john.doe@school.edu,${gradeNames[0] ?? 'Grade 9'}\nJane Smith,jane.smith@school.edu,${gradeNames[1] ?? 'Grade 10'}`
      : 'John Doe,john.doe@school.edu\nJane Smith,jane.smith@school.edu';
    const csv = `${header}\n${rows}\n`;
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `bulk_import_template_${role}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImport = async () => {
    if (!file) { toast.error('Please select a CSV file'); return; }
    setImporting(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      const res = await bulkImportUsers(role, fd);
      setResults(res.data);
      onDone();
      toast.success(`Import complete — ${res.data.created} created, ${res.data.skipped} skipped, ${res.data.failed} failed`);
    } catch (err) {
      toast.error(err?.response?.data?.detail ?? 'Import failed');
    } finally {
      setImporting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-lg mx-4 flex flex-col max-h-[90vh]">
        <div className="flex items-center justify-between px-6 py-4 border-b border-primary-light">
          <div className="flex items-center gap-2">
            <Upload className="w-5 h-5 text-primary" />
            <h2 className="text-base font-bold text-primary-dark">Bulk Import Users</h2>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-4 overflow-y-auto flex-1">
          {!results ? (
            <>
              <div className="bg-primary-light rounded-lg p-4 text-sm text-primary-dark space-y-1">
                <p>Required columns: <code className="font-mono font-bold">full_name</code>, <code className="font-mono font-bold">email</code></p>
                {role === 'student' && (
                  <p>Optional: <code className="font-mono font-bold">grade</code> — use exact grade name e.g. <span className="font-semibold">Grade 9</span>, <span className="font-semibold">Grade 10</span></p>
                )}
                <p className="text-xs text-primary/70">Duplicate emails are skipped. A welcome email is sent after import.</p>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Role to assign</label>
                <select
                  value={role}
                  onChange={(e) => setRole(e.target.value)}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                >
                  <option value="student">Student</option>
                  <option value="instructor">Instructor</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">CSV File</label>
                <div
                  onClick={() => fileRef.current?.click()}
                  className="border-2 border-dashed border-slate-200 rounded-xl p-6 text-center cursor-pointer hover:border-primary/40 transition"
                >
                  {file ? (
                    <div className="flex items-center justify-center gap-2 text-sm text-primary-dark font-medium">
                      <FileText className="w-5 h-5 text-primary" />
                      {file.name}
                    </div>
                  ) : (
                    <>
                      <Upload className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                      <p className="text-sm text-slate-500">Click to choose a CSV file</p>
                    </>
                  )}
                </div>
                <input
                  ref={fileRef}
                  type="file"
                  accept=".csv,text/csv"
                  className="hidden"
                  onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                />
              </div>

              <button
                onClick={downloadTemplate}
                className="flex items-center gap-2 text-sm text-primary font-semibold hover:underline"
              >
                <Download className="w-4 h-4" /> Download CSV template
              </button>
            </>
          ) : (
            <>
              <div className="grid grid-cols-3 gap-3 mb-2">
                {[['Created', results.created, 'text-green-700 bg-green-100'], ['Skipped', results.skipped, 'text-amber-700 bg-amber-100'], ['Failed', results.failed, 'text-red-600 bg-red-100']].map(([label, val, cls]) => (
                  <div key={label} className={`rounded-lg p-3 text-center ${cls}`}>
                    <p className="text-2xl font-bold">{val}</p>
                    <p className="text-xs font-semibold">{label}</p>
                  </div>
                ))}
              </div>
              <div className="max-h-64 overflow-y-auto border border-slate-100 rounded-lg p-2">
                {results.results.map((r) => <ImportResultRow key={`${r.row}-${r.email}`} r={r} />)}
              </div>
            </>
          )}
        </div>

        <div className="px-6 py-4 border-t border-primary-light flex gap-3">
          {results ? (
            <button onClick={onClose} className="flex-1 bg-primary-dark text-white rounded-lg py-2 text-sm font-semibold hover:bg-primary">
              Done
            </button>
          ) : (
            <>
              <button onClick={onClose} className="flex-1 border border-slate-200 text-slate-600 rounded-lg py-2 text-sm font-semibold hover:bg-slate-50">
                Cancel
              </button>
              <button
                onClick={handleImport}
                disabled={importing || !file}
                className="flex-1 bg-primary-dark text-white rounded-lg py-2 text-sm font-semibold hover:bg-primary disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {importing && <Loader2 className="w-4 h-4 animate-spin" />}
                {importing ? 'Importing…' : 'Import Users'}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export default function UserManagement() {
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [roleFilter, setRoleFilter] = useState('');
  const [searchFilter, setSearchFilter] = useState('');
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [showAddModal, setShowAddModal] = useState(false);
  const [showBulkImport, setShowBulkImport] = useState(false);
  const [editTarget, setEditTarget] = useState(null);
  const [roleTarget, setRoleTarget] = useState(null);
  const [generatedPassword, setGeneratedPassword] = useState(null);
  const [confirmSuspend, setConfirmSuspend] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [actionLoading, setActionLoading] = useState(false);

  const perPage = 20;

  const { data: userData, isPending: loading, error } = useQuery({
    queryKey: ['admin', 'users', page, roleFilter, searchFilter],
    queryFn: async () => {
      const params = { page, per_page: perPage };
      if (roleFilter) params.role = roleFilter;
      if (searchFilter.trim()) params.search = searchFilter.trim();
      return (await getUsers(params)).data;
    },
  });

  const { data: gradesData } = useQuery({
    queryKey: ['admin', 'grades'],
    queryFn: async () => (await getGrades()).data ?? [],
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

  const handleReactivate = async (id) => {
    try {
      await reactivateUser(id);
      toast.success('User reactivated');
      invalidate();
    } catch {
      toast.error('Failed to reactivate user');
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
          <input
            value={searchFilter}
            onChange={(e) => { setSearchFilter(e.target.value); setPage(1); }}
            placeholder="Search name or email"
            className="border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-600 focus:outline-none focus:ring-2 focus:ring-primary/30 min-w-[220px]"
          />
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
            onClick={() => setShowBulkImport(true)}
            className="flex items-center gap-2 border border-primary text-primary text-sm font-medium px-4 py-2 rounded-lg hover:bg-primary-light transition"
          >
            <Upload className="w-4 h-4" />
            Bulk Import
          </button>
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
                      <div className="flex items-center gap-1.5">
                        <button
                          onClick={() => setEditTarget(u)}
                          className="text-slate-400 hover:text-primary transition p-1 rounded hover:bg-primary-light/50"
                          title="Edit"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => setRoleTarget(u)}
                          className="text-slate-400 hover:text-blue-500 transition p-1 rounded hover:bg-blue-50"
                          title="Change Role"
                        >
                          <UserCog className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleResetPassword(u.user_id)}
                          className="text-slate-400 hover:text-amber-500 transition p-1 rounded hover:bg-amber-50"
                          title="Reset Password"
                        >
                          <KeyRound className="w-3.5 h-3.5" />
                        </button>
                        {u.is_active ? (
                          <button
                            onClick={() => setConfirmSuspend(u.user_id)}
                            className="text-slate-400 hover:text-orange-500 transition p-1 rounded hover:bg-orange-50"
                            title="Suspend"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        ) : (
                          <button
                            onClick={() => handleReactivate(u.user_id)}
                            className="text-slate-400 hover:text-green-500 transition p-1 rounded hover:bg-green-50"
                            title="Reactivate"
                          >
                            <RotateCcw className="w-3.5 h-3.5" />
                          </button>
                        )}
                        <button
                          onClick={() => setConfirmDelete(u.user_id)}
                          className="text-slate-400 hover:text-red-500 transition p-1 rounded hover:bg-red-50"
                          title="Delete"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
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

      <BottomStats data={userData} />
      <PendingEnrollmentsPanel />

      {showAddModal && (
        <AddUserModal
          grades={gradesData}
          onClose={() => setShowAddModal(false)}
          onSuccess={handleUserCreated}
        />
      )}

      {editTarget && (
        <EditUserModal
          user={editTarget}
          grades={gradesData}
          onClose={() => setEditTarget(null)}
          onSuccess={() => { setEditTarget(null); invalidate(); }}
        />
      )}

      {roleTarget && (
        <ChangeRoleModal
          user={roleTarget}
          onClose={() => setRoleTarget(null)}
          onSuccess={() => { setRoleTarget(null); invalidate(); }}
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

      {showBulkImport && (
        <BulkImportModal
          grades={gradesData}
          onClose={() => setShowBulkImport(false)}
          onDone={invalidate}
        />
      )}
    </div>
  );
}
