import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  BookOpen, Plus, Pencil, Trash2, Users, BookMarked,
  ChevronRight, Loader2, AlertCircle, X, GraduationCap, UserPlus, UsersRound,
} from 'lucide-react';
import toast from 'react-hot-toast';
import {
  getGrades, createGrade, updateGrade, deleteGrade,
  getSubjects, createSubject, updateSubject, deleteSubject,
  getUsers, assignInstructor,
  getEnrollments, createEnrollment, bulkEnroll, removeEnrollment,
} from '../../services/adminService';

function GradeCard({ grade, selected, onClick, onEdit, onDelete }) {
  return (
    <div
      onClick={onClick}
      className={`cursor-pointer rounded-xl border p-4 transition-all ${
        selected
          ? 'border-primary bg-primary-light/30 shadow-sm'
          : 'border-slate-200 bg-white hover:border-primary/40 hover:shadow-sm'
      }`}
    >
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <div className={`w-9 h-9 rounded-full flex items-center justify-center font-bold text-sm ${selected ? 'bg-primary text-white' : 'bg-primary-light text-primary-dark'}`}>
            {grade.grade_level}
          </div>
          <div>
            <p className="font-semibold text-primary-dark text-sm">{grade.grade_name}</p>
            <div className="flex items-center gap-3 mt-0.5">
              <span className="text-xs text-slate-400 flex items-center gap-1"><BookMarked className="w-3 h-3" />{grade.subject_count} subjects</span>
              <span className="text-xs text-slate-400 flex items-center gap-1"><Users className="w-3 h-3" />{grade.student_count} students</span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
          <button onClick={onEdit} className="p-1.5 rounded-lg text-slate-400 hover:text-primary hover:bg-primary-light/50 transition-colors">
            <Pencil className="w-3.5 h-3.5" />
          </button>
          <button onClick={onDelete} className="p-1.5 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 transition-colors">
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
      {selected && (
        <div className="mt-2 flex items-center gap-1 text-xs text-primary font-medium">
          <span>Viewing subjects</span>
          <ChevronRight className="w-3 h-3" />
        </div>
      )}
    </div>
  );
}

function SubjectRow({ subject, selected, onEdit, onDelete, onAssign, onViewEnrollments }) {
  return (
    <div className={`flex items-center gap-4 px-4 py-3 border-b border-slate-100 last:border-0 transition-colors ${selected ? 'bg-primary-light/20' : 'hover:bg-slate-50'}`}>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-primary-dark truncate">{subject.name}</p>
        <div className="flex items-center gap-2 mt-0.5">
          <span className="text-xs font-mono bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded">{subject.subject_code}</span>
          {subject.instructor_name
            ? <span className="text-xs text-green-600 font-medium flex items-center gap-1"><GraduationCap className="w-3 h-3" />{subject.instructor_name}</span>
            : <span className="text-xs text-amber-500">No instructor</span>
          }
        </div>
      </div>
      <div className="flex items-center gap-3 text-xs text-slate-400 shrink-0">
        <span className="flex items-center gap-1"><Users className="w-3 h-3" />{subject.student_count}</span>
        <span className="flex items-center gap-1"><BookMarked className="w-3 h-3" />{subject.assignment_count}</span>
      </div>
      <div className="flex items-center gap-1 shrink-0">
        <button onClick={onViewEnrollments} title="Manage enrollments" className={`p-1.5 rounded-lg transition-colors ${selected ? 'text-primary bg-primary-light/50' : 'text-slate-400 hover:text-primary hover:bg-primary-light/50'}`}>
          <Users className="w-3.5 h-3.5" />
        </button>
        <button onClick={onAssign} title="Assign instructor" className="p-1.5 rounded-lg text-slate-400 hover:text-green-600 hover:bg-green-50 transition-colors">
          <GraduationCap className="w-3.5 h-3.5" />
        </button>
        <button onClick={onEdit} className="p-1.5 rounded-lg text-slate-400 hover:text-primary hover:bg-primary-light/50 transition-colors">
          <Pencil className="w-3.5 h-3.5" />
        </button>
        <button onClick={onDelete} className="p-1.5 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 transition-colors">
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}

function EnrollStudentModal({ subject, gradeId, onClose, onSuccess }) {
  const [search, setSearch] = useState('');
  const [selectedStudentId, setSelectedStudentId] = useState('');
  const [saving, setSaving] = useState(false);

  const { data: students = [] } = useQuery({
    queryKey: ['admin', 'students-for-enroll', gradeId, search],
    queryFn: async () => {
      const params = { role: 'student', per_page: 50 };
      if (gradeId) params.grade_id = gradeId;
      if (search) params.search = search;
      return (await getUsers(params)).data?.users ?? [];
    },
    enabled: true,
  });

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!selectedStudentId) { toast.error('Select a student'); return; }
    setSaving(true);
    try {
      await createEnrollment({ student_id: selectedStudentId, subject_id: subject.subject_id });
      toast.success('Student enrolled');
      onSuccess();
    } catch (err) {
      toast.error(err?.response?.data?.detail ?? 'Enrollment failed');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-md mx-4">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold text-primary-dark">Enroll Student</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600"><X className="w-5 h-5" /></button>
        </div>
        <p className="text-xs text-slate-500 mb-4">Subject: <span className="font-semibold text-primary">{subject.name}</span></p>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">Search Student</label>
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by name or email..."
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">Select Student</label>
            <select
              required
              value={selectedStudentId}
              onChange={(e) => setSelectedStudentId(e.target.value)}
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
            >
              <option value="">— Pick a student —</option>
              {students.map((s) => (
                <option key={s.user_id} value={s.user_id}>{s.full_name} ({s.email})</option>
              ))}
            </select>
          </div>
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="flex-1 border border-slate-200 text-slate-600 rounded-lg py-2 text-sm font-semibold hover:bg-slate-50">
              Cancel
            </button>
            <button type="submit" disabled={saving} className="flex-1 bg-primary-dark text-white rounded-lg py-2 text-sm font-semibold hover:bg-primary disabled:opacity-50 flex items-center justify-center gap-2">
              {saving && <Loader2 className="w-4 h-4 animate-spin" />} Enroll
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function BulkEnrollModal({ subject, gradeId, onClose, onSuccess }) {
  const [search, setSearch] = useState('');
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [saving, setSaving] = useState(false);

  const { data: students = [] } = useQuery({
    queryKey: ['admin', 'students-bulk', gradeId, search],
    queryFn: async () => {
      const params = { role: 'student', per_page: 100 };
      if (gradeId) params.grade_id = gradeId;
      if (search) params.search = search;
      return (await getUsers(params)).data?.users ?? [];
    },
  });

  const toggle = (id) => setSelectedIds((prev) => {
    const next = new Set(prev);
    next.has(id) ? next.delete(id) : next.add(id);
    return next;
  });

  const toggleAll = () => {
    if (selectedIds.size === students.length) setSelectedIds(new Set());
    else setSelectedIds(new Set(students.map((s) => s.user_id)));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (selectedIds.size === 0) { toast.error('Select at least one student'); return; }
    setSaving(true);
    try {
      const res = await bulkEnroll({ student_ids: [...selectedIds], subject_id: subject.subject_id });
      const data = res.data;
      toast.success(`Enrolled ${data.enrolled_count ?? selectedIds.size} student(s). Skipped: ${data.skipped_count ?? 0}`);
      onSuccess();
    } catch (err) {
      toast.error(err?.response?.data?.detail ?? 'Bulk enroll failed');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-lg mx-4 max-h-[80vh] flex flex-col">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold text-primary-dark">Bulk Enroll Students</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600"><X className="w-5 h-5" /></button>
        </div>
        <p className="text-xs text-slate-500 mb-4">
          Subject: <span className="font-semibold text-primary">{subject.name}</span>
          <span className="ml-2 text-slate-400">— Already enrolled students are automatically skipped.</span>
        </p>
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search students by name or email..."
          className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm mb-3 focus:outline-none focus:ring-2 focus:ring-primary/30"
        />
        <div className="flex items-center gap-2 mb-2 px-1">
          <input
            type="checkbox"
            checked={students.length > 0 && selectedIds.size === students.length}
            onChange={toggleAll}
            className="accent-primary"
          />
          <span className="text-xs text-slate-500">Select all ({students.length}) · {selectedIds.size} selected</span>
        </div>
        <div className="flex-1 overflow-y-auto border border-slate-100 rounded-lg divide-y divide-slate-50 mb-4">
          {students.length === 0 && (
            <p className="text-sm text-slate-400 text-center py-6">No students found</p>
          )}
          {students.map((s) => (
            <label key={s.user_id} className="flex items-center gap-3 px-4 py-2.5 hover:bg-slate-50 cursor-pointer">
              <input
                type="checkbox"
                checked={selectedIds.has(s.user_id)}
                onChange={() => toggle(s.user_id)}
                className="accent-primary shrink-0"
              />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-primary-dark truncate">{s.full_name}</p>
                <p className="text-xs text-slate-400 truncate">{s.email}</p>
              </div>
              {s.grade_name && <span className="text-xs text-slate-400 shrink-0">{s.grade_name}</span>}
            </label>
          ))}
        </div>
        <div className="flex gap-3">
          <button type="button" onClick={onClose} className="flex-1 border border-slate-200 text-slate-600 rounded-lg py-2 text-sm font-semibold hover:bg-slate-50">
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={saving || selectedIds.size === 0}
            className="flex-1 bg-primary-dark text-white rounded-lg py-2 text-sm font-semibold hover:bg-primary disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {saving && <Loader2 className="w-4 h-4 animate-spin" />}
            Enroll {selectedIds.size > 0 ? `(${selectedIds.size})` : ''} Students
          </button>
        </div>
      </div>
    </div>
  );
}

function EnrollmentsPanel({ subject, gradeId, onClose }) {
  const queryClient = useQueryClient();
  const [showEnrollModal, setShowEnrollModal] = useState(false);
  const [showBulkModal, setShowBulkModal] = useState(false);
  const [confirmRemove, setConfirmRemove] = useState(null);

  const { data, isLoading } = useQuery({
    queryKey: ['admin', 'enrollments', subject.subject_id],
    queryFn: async () => (await getEnrollments({ subject_id: subject.subject_id, per_page: 100 })).data,
  });

  const enrollments = data?.enrollments ?? [];

  const removeMutation = useMutation({
    mutationFn: (id) => removeEnrollment(id),
    onSuccess: () => {
      toast.success('Enrollment removed');
      setConfirmRemove(null);
      queryClient.invalidateQueries({ queryKey: ['admin', 'enrollments', subject.subject_id] });
      queryClient.invalidateQueries({ queryKey: ['admin', 'subjects'] });
    },
    onError: (err) => toast.error(err?.response?.data?.detail ?? 'Cannot remove — submissions exist'),
  });

  return (
    <div className="mt-6 bg-white rounded-xl border border-primary-light shadow-sm overflow-hidden">
      <div className="flex items-center justify-between px-5 py-4 border-b border-primary-light">
        <div>
          <div className="flex items-center gap-2 font-semibold text-primary-dark">
            <Users className="w-4 h-4" />
            Enrollments — <span className="text-primary">{subject.name}</span>
            <span className="text-xs font-normal text-slate-400 ml-1">({enrollments.length})</span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowBulkModal(true)}
            className="flex items-center gap-1.5 border border-primary text-primary text-xs font-semibold px-3 py-1.5 rounded-lg hover:bg-primary-light/50 transition-colors"
          >
            <UsersRound className="w-3.5 h-3.5" /> Bulk Enroll
          </button>
          <button
            onClick={() => setShowEnrollModal(true)}
            className="flex items-center gap-1.5 bg-primary-dark text-white text-xs font-semibold px-3 py-1.5 rounded-lg hover:bg-primary transition-colors"
          >
            <UserPlus className="w-3.5 h-3.5" /> Enroll Student
          </button>
          <button onClick={onClose} className="p-1.5 text-slate-400 hover:text-slate-600 transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-10"><Loader2 className="w-5 h-5 text-primary animate-spin" /></div>
      ) : enrollments.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-10 text-slate-400">
          <Users className="w-8 h-8 mb-2 opacity-30" />
          <p className="text-sm">No students enrolled in this subject.</p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100">
                {['Student', 'Email', 'Grade', 'Enrolled', 'Status', 'Action'].map((h) => (
                  <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {enrollments.map((e) => (
                <tr key={e.enrollment_id} className="border-b border-slate-50 hover:bg-slate-50/50">
                  <td className="px-4 py-3 font-medium text-primary-dark">{e.student_name ?? '—'}</td>
                  <td className="px-4 py-3 text-slate-500 text-xs">{e.student_email ?? '—'}</td>
                  <td className="px-4 py-3 text-slate-500 text-xs">{e.grade_name ?? '—'}</td>
                  <td className="px-4 py-3 text-slate-400 text-xs">
                    {e.enrolled_at ? new Date(e.enrolled_at).toLocaleDateString() : '—'}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${e.is_active ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}`}>
                      {e.is_active ? 'Active' : 'Pending'}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <button
                      onClick={() => setConfirmRemove(e)}
                      className="text-xs text-red-500 hover:text-red-700 font-semibold transition-colors"
                    >
                      Remove
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showEnrollModal && (
        <EnrollStudentModal
          subject={subject}
          gradeId={gradeId}
          onClose={() => setShowEnrollModal(false)}
          onSuccess={() => {
            setShowEnrollModal(false);
            queryClient.invalidateQueries({ queryKey: ['admin', 'enrollments', subject.subject_id] });
            queryClient.invalidateQueries({ queryKey: ['admin', 'subjects'] });
          }}
        />
      )}

      {showBulkModal && (
        <BulkEnrollModal
          subject={subject}
          gradeId={gradeId}
          onClose={() => setShowBulkModal(false)}
          onSuccess={() => {
            setShowBulkModal(false);
            queryClient.invalidateQueries({ queryKey: ['admin', 'enrollments', subject.subject_id] });
            queryClient.invalidateQueries({ queryKey: ['admin', 'subjects'] });
          }}
        />
      )}

      {confirmRemove && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-sm mx-4">
            <div className="flex items-start gap-3 mb-4">
              <AlertCircle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
              <div>
                <h2 className="font-bold text-primary-dark">Remove Enrollment</h2>
                <p className="text-sm text-slate-500 mt-1">
                  Remove <span className="font-semibold">{confirmRemove.student_name}</span> from {subject.name}? This cannot be undone if submissions exist.
                </p>
              </div>
            </div>
            <div className="flex gap-3">
              <button onClick={() => setConfirmRemove(null)} className="flex-1 border border-slate-200 text-slate-600 rounded-lg py-2 text-sm font-semibold hover:bg-slate-50">
                Cancel
              </button>
              <button
                onClick={() => removeMutation.mutate(confirmRemove.enrollment_id)}
                disabled={removeMutation.isPending}
                className="flex-1 bg-red-600 text-white rounded-lg py-2 text-sm font-semibold hover:bg-red-700 disabled:opacity-60 flex items-center justify-center gap-2"
              >
                {removeMutation.isPending && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                Remove
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function GradeModal({ initial, onClose, onSave }) {
  const [form, setForm] = useState({ grade_name: initial?.grade_name ?? '', grade_level: initial?.grade_level ?? '', description: initial?.description ?? '' });
  const [saving, setSaving] = useState(false);
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.grade_name.trim() || !form.grade_level) { toast.error('Grade name and level are required'); return; }
    setSaving(true);
    try {
      await onSave({ ...form, grade_level: parseInt(form.grade_level) });
      onClose();
    } catch (err) {
      toast.error(err?.response?.data?.detail ?? 'Failed to save grade');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-md mx-4">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold text-primary-dark">{initial ? 'Edit Grade' : 'Add New Grade'}</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600"><X className="w-5 h-5" /></button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">Grade Name</label>
            <input required value={form.grade_name} onChange={(e) => set('grade_name', e.target.value)}
              placeholder="e.g. Grade 9"
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">Grade Level (number)</label>
            <input required type="number" min={1} max={20} value={form.grade_level} onChange={(e) => set('grade_level', e.target.value)}
              placeholder="e.g. 9"
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">Description (optional)</label>
            <textarea value={form.description} onChange={(e) => set('description', e.target.value)}
              rows={2} placeholder="Brief description..."
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 resize-none"
            />
          </div>
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="flex-1 border border-slate-200 text-slate-600 rounded-lg py-2 text-sm font-semibold hover:bg-slate-50">Cancel</button>
            <button type="submit" disabled={saving} className="flex-1 bg-primary-dark text-white rounded-lg py-2 text-sm font-semibold hover:bg-primary disabled:opacity-50 flex items-center justify-center gap-2">
              {saving && <Loader2 className="w-4 h-4 animate-spin" />} {initial ? 'Save Changes' : 'Add Grade'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function SubjectModal({ initial, gradeId, gradeName, onClose, onSave, instructors }) {
  const [form, setForm] = useState({
    name: initial?.name ?? '',
    subject_code: initial?.subject_code ?? '',
    description: initial?.description ?? '',
    instructor_id: '',
  });
  const [saving, setSaving] = useState(false);
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.name.trim() || !form.subject_code.trim()) { toast.error('Name and code are required'); return; }
    setSaving(true);
    try {
      const payload = { name: form.name, subject_code: form.subject_code, description: form.description, grade_id: gradeId };
      if (form.instructor_id) payload.instructor_id = form.instructor_id;
      await onSave(payload);
      onClose();
    } catch (err) {
      toast.error(err?.response?.data?.detail ?? 'Failed to save subject');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-md mx-4">
        <div className="flex items-center justify-between mb-1">
          <h2 className="text-lg font-bold text-primary-dark">{initial ? 'Edit Subject' : 'Add New Subject'}</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600"><X className="w-5 h-5" /></button>
        </div>
        <p className="text-xs text-slate-500 mb-4">Grade: <span className="font-semibold text-primary">{gradeName}</span></p>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">Subject Name</label>
            <input required value={form.name} onChange={(e) => set('name', e.target.value)}
              placeholder="e.g. Science — Physics"
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">Subject Code</label>
            <input required value={form.subject_code} onChange={(e) => set('subject_code', e.target.value.toUpperCase())}
              placeholder="e.g. SCI901"
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-primary/30"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">Assign Instructor (optional)</label>
            <select value={form.instructor_id} onChange={(e) => set('instructor_id', e.target.value)}
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
            >
              <option value="">No instructor</option>
              {instructors.map((i) => <option key={i.user_id} value={i.user_id}>{i.full_name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">Description (optional)</label>
            <textarea value={form.description} onChange={(e) => set('description', e.target.value)}
              rows={2} placeholder="Brief description..."
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 resize-none"
            />
          </div>
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="flex-1 border border-slate-200 text-slate-600 rounded-lg py-2 text-sm font-semibold hover:bg-slate-50">Cancel</button>
            <button type="submit" disabled={saving} className="flex-1 bg-primary-dark text-white rounded-lg py-2 text-sm font-semibold hover:bg-primary disabled:opacity-50 flex items-center justify-center gap-2">
              {saving && <Loader2 className="w-4 h-4 animate-spin" />} {initial ? 'Save Changes' : 'Add Subject'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function AssignInstructorModal({ subject, instructors, onClose, onSave }) {
  const [instructorId, setInstructorId] = useState('');
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!instructorId) { toast.error('Select an instructor'); return; }
    setSaving(true);
    try {
      await onSave(subject.subject_id, { instructor_id: instructorId });
      onClose();
    } catch (err) {
      toast.error(err?.response?.data?.detail ?? 'Failed to assign instructor');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-sm mx-4">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold text-primary-dark">Assign Instructor</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600"><X className="w-5 h-5" /></button>
        </div>
        <p className="text-sm text-slate-500 mb-4">Subject: <span className="font-semibold text-primary-dark">{subject.name}</span></p>
        <form onSubmit={handleSubmit} className="space-y-4">
          <select required value={instructorId} onChange={(e) => setInstructorId(e.target.value)}
            className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
          >
            <option value="">Select instructor</option>
            {instructors.map((i) => <option key={i.user_id} value={i.user_id}>{i.full_name}</option>)}
          </select>
          <div className="flex gap-3">
            <button type="button" onClick={onClose} className="flex-1 border border-slate-200 text-slate-600 rounded-lg py-2 text-sm font-semibold hover:bg-slate-50">Cancel</button>
            <button type="submit" disabled={saving} className="flex-1 bg-primary-dark text-white rounded-lg py-2 text-sm font-semibold hover:bg-primary disabled:opacity-50 flex items-center justify-center gap-2">
              {saving && <Loader2 className="w-4 h-4 animate-spin" />} Assign
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function ConfirmDeleteDialog({ title, message, onConfirm, onCancel }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-sm mx-4">
        <div className="flex items-start gap-3 mb-4">
          <AlertCircle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
          <div>
            <h2 className="font-bold text-primary-dark">{title}</h2>
            <p className="text-sm text-slate-500 mt-1">{message}</p>
          </div>
        </div>
        <div className="flex gap-3">
          <button onClick={onCancel} className="flex-1 border border-slate-200 text-slate-600 rounded-lg py-2 text-sm font-semibold hover:bg-slate-50">Cancel</button>
          <button onClick={onConfirm} className="flex-1 bg-red-600 text-white rounded-lg py-2 text-sm font-semibold hover:bg-red-700">Delete</button>
        </div>
      </div>
    </div>
  );
}

export default function AcademicManagement() {
  const [selectedGrade, setSelectedGrade] = useState(null);
  const [selectedSubject, setSelectedSubject] = useState(null);
  const [gradeModal, setGradeModal] = useState(null);
  const [subjectModal, setSubjectModal] = useState(null);
  const [assignModal, setAssignModal] = useState(null);
  const [deleteGradeTarget, setDeleteGradeTarget] = useState(null);
  const [deleteSubjectTarget, setDeleteSubjectTarget] = useState(null);
  const queryClient = useQueryClient();

  const { data: grades = [], isLoading: gradesLoading } = useQuery({
    queryKey: ['admin', 'grades'],
    queryFn: async () => (await getGrades()).data ?? [],
  });

  const { data: subjects = [], isLoading: subjectsLoading } = useQuery({
    queryKey: ['admin', 'subjects', selectedGrade?.grade_id],
    queryFn: async () => (await getSubjects({ grade_id: selectedGrade.grade_id })).data ?? [],
    enabled: !!selectedGrade,
  });

  const { data: instructorList = [] } = useQuery({
    queryKey: ['admin', 'instructors'],
    queryFn: async () => {
      const res = await getUsers({ role: 'instructor', per_page: 100 });
      return res.data?.users ?? [];
    },
  });

  const invalidateAll = () => {
    queryClient.invalidateQueries({ queryKey: ['admin', 'grades'] });
    queryClient.invalidateQueries({ queryKey: ['admin', 'subjects'] });
  };

  const gradeCreateMutation = useMutation({
    mutationFn: (data) => createGrade(data),
    onSuccess: () => { toast.success('Grade created'); invalidateAll(); },
  });

  const gradeUpdateMutation = useMutation({
    mutationFn: ({ id, data }) => updateGrade(id, data),
    onSuccess: () => { toast.success('Grade updated'); invalidateAll(); },
  });

  const gradeDeleteMutation = useMutation({
    mutationFn: (id) => deleteGrade(id),
    onSuccess: () => {
      toast.success('Grade deleted');
      if (selectedGrade?.grade_id === deleteGradeTarget?.grade_id) {
        setSelectedGrade(null);
        setSelectedSubject(null);
      }
      setDeleteGradeTarget(null);
      invalidateAll();
    },
    onError: (err) => toast.error(err?.response?.data?.detail ?? 'Cannot delete grade — subjects may exist'),
  });

  const subjectCreateMutation = useMutation({
    mutationFn: (data) => createSubject(data),
    onSuccess: () => { toast.success('Subject created'); invalidateAll(); },
  });

  const subjectUpdateMutation = useMutation({
    mutationFn: ({ id, data }) => updateSubject(id, data),
    onSuccess: () => { toast.success('Subject updated'); invalidateAll(); },
  });

  const subjectDeleteMutation = useMutation({
    mutationFn: (id) => deleteSubject(id),
    onSuccess: () => {
      toast.success('Subject deleted');
      setDeleteSubjectTarget(null);
      invalidateAll();
    },
    onError: (err) => toast.error(err?.response?.data?.detail ?? 'Cannot delete — active enrollments exist'),
  });

  const assignMutation = useMutation({
    mutationFn: ({ subjectId, data }) => assignInstructor(subjectId, data),
    onSuccess: () => { toast.success('Instructor assigned'); invalidateAll(); },
  });

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-primary-dark">Academic Management</h1>
        <p className="text-sm text-slate-500 mt-0.5">Manage grades, subjects, and instructor assignments.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        <div className="lg:col-span-2">
          <div className="bg-white rounded-xl border border-primary-light shadow-sm">
            <div className="flex items-center justify-between px-5 py-4 border-b border-primary-light">
              <div className="flex items-center gap-2 font-semibold text-primary-dark">
                <BookOpen className="w-4 h-4" />
                Grades <span className="text-xs font-normal text-slate-400 ml-1">({grades.length})</span>
              </div>
              <button
                onClick={() => setGradeModal({ mode: 'create' })}
                className="flex items-center gap-1.5 bg-primary-dark text-white text-xs font-semibold px-3 py-1.5 rounded-lg hover:bg-primary transition-colors"
              >
                <Plus className="w-3.5 h-3.5" /> Add Grade
              </button>
            </div>
            <div className="p-3 space-y-2 max-h-[calc(100vh-280px)] overflow-y-auto">
              {gradesLoading && <div className="flex justify-center py-8"><Loader2 className="w-5 h-5 text-primary animate-spin" /></div>}
              {!gradesLoading && grades.length === 0 && (
                <div className="text-center py-10 text-slate-400">
                  <BookOpen className="w-8 h-8 mx-auto mb-2 opacity-30" />
                  <p className="text-sm">No grades yet. Add your first grade.</p>
                </div>
              )}
              {grades.map((g) => (
                <GradeCard
                  key={g.grade_id}
                  grade={g}
                  selected={selectedGrade?.grade_id === g.grade_id}
                  onClick={() => setSelectedGrade(g)}
                  onEdit={() => setGradeModal({ mode: 'edit', grade: g })}
                  onDelete={() => setDeleteGradeTarget(g)}
                />
              ))}
            </div>
          </div>
        </div>

        <div className="lg:col-span-3">
          <div className="bg-white rounded-xl border border-primary-light shadow-sm">
            <div className="flex items-center justify-between px-5 py-4 border-b border-primary-light">
              <div className="flex items-center gap-2 font-semibold text-primary-dark">
                <BookMarked className="w-4 h-4" />
                {selectedGrade ? (
                  <>Subjects — <span className="text-primary">{selectedGrade.grade_name}</span></>
                ) : 'Subjects'}
                {subjects.length > 0 && <span className="text-xs font-normal text-slate-400 ml-1">({subjects.length})</span>}
              </div>
              <button
                onClick={() => selectedGrade ? setSubjectModal({ mode: 'create' }) : toast('Select a grade first')}
                disabled={!selectedGrade}
                className="flex items-center gap-1.5 bg-primary-dark text-white text-xs font-semibold px-3 py-1.5 rounded-lg hover:bg-primary transition-colors disabled:opacity-40"
              >
                <Plus className="w-3.5 h-3.5" /> Add Subject
              </button>
            </div>

            {!selectedGrade ? (
              <div className="flex flex-col items-center justify-center py-20 text-slate-400">
                <ChevronRight className="w-10 h-10 mb-2 opacity-20" />
                <p className="text-sm font-medium">Select a grade to view subjects</p>
              </div>
            ) : subjectsLoading ? (
              <div className="flex justify-center py-12"><Loader2 className="w-5 h-5 text-primary animate-spin" /></div>
            ) : subjects.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-slate-400">
                <BookMarked className="w-8 h-8 mb-2 opacity-30" />
                <p className="text-sm">No subjects in {selectedGrade.grade_name}.</p>
                <button onClick={() => setSubjectModal({ mode: 'create' })} className="mt-3 text-primary text-xs font-semibold hover:underline">
                  + Add the first subject
                </button>
              </div>
            ) : (
              <div className="divide-y divide-slate-50 max-h-[calc(100vh-280px)] overflow-y-auto">
                {subjects.map((s) => (
                  <SubjectRow
                    key={s.subject_id}
                    subject={s}
                    selected={selectedSubject?.subject_id === s.subject_id}
                    onEdit={() => setSubjectModal({ mode: 'edit', subject: s })}
                    onDelete={() => { setDeleteSubjectTarget(s); setSelectedSubject(null); }}
                    onAssign={() => setAssignModal(s)}
                    onViewEnrollments={() => setSelectedSubject(
                      selectedSubject?.subject_id === s.subject_id ? null : s
                    )}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {selectedSubject && (
        <EnrollmentsPanel
          subject={selectedSubject}
          gradeId={selectedGrade?.grade_id}
          onClose={() => setSelectedSubject(null)}
        />
      )}

      {gradeModal && (
        <GradeModal
          initial={gradeModal.mode === 'edit' ? gradeModal.grade : null}
          onClose={() => setGradeModal(null)}
          onSave={(data) =>
            gradeModal.mode === 'edit'
              ? gradeUpdateMutation.mutateAsync({ id: gradeModal.grade.grade_id, data })
              : gradeCreateMutation.mutateAsync(data)
          }
        />
      )}

      {subjectModal && selectedGrade && (
        <SubjectModal
          initial={subjectModal.mode === 'edit' ? subjectModal.subject : null}
          gradeId={selectedGrade.grade_id}
          gradeName={selectedGrade.grade_name}
          instructors={instructorList}
          onClose={() => setSubjectModal(null)}
          onSave={(data) =>
            subjectModal.mode === 'edit'
              ? subjectUpdateMutation.mutateAsync({ id: subjectModal.subject.subject_id, data })
              : subjectCreateMutation.mutateAsync(data)
          }
        />
      )}

      {assignModal && (
        <AssignInstructorModal
          subject={assignModal}
          instructors={instructorList}
          onClose={() => setAssignModal(null)}
          onSave={(subjectId, data) => assignMutation.mutateAsync({ subjectId, data })}
        />
      )}

      {deleteGradeTarget && (
        <ConfirmDeleteDialog
          title={`Delete "${deleteGradeTarget.grade_name}"?`}
          message="All subjects and enrollments in this grade must be removed first."
          onConfirm={() => gradeDeleteMutation.mutate(deleteGradeTarget.grade_id)}
          onCancel={() => setDeleteGradeTarget(null)}
        />
      )}

      {deleteSubjectTarget && (
        <ConfirmDeleteDialog
          title={`Delete "${deleteSubjectTarget.name}"?`}
          message="This will permanently remove the subject. Active enrollments must be removed first."
          onConfirm={() => subjectDeleteMutation.mutate(deleteSubjectTarget.subject_id)}
          onCancel={() => setDeleteSubjectTarget(null)}
        />
      )}
    </div>
  );
}
