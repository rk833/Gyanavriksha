import { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  ClipboardList,
  Plus,
  Pencil,
  Trash2,
  Send,
  Search,
  Filter,
  Loader2,
  AlertCircle,
  X,
  Calendar,
  FileText,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import toast from 'react-hot-toast';
import {
  getAssignments,
  getAssignmentDetail,
  createAssignment,
  updateAssignment,
  publishAssignment,
  deleteAssignment,
  getSubjects,
} from '../../services/instructorService';

function StatusBadge({ published }) {
  return published ? (
    <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700">Published</span>
  ) : (
    <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-700">Draft</span>
  );
}

function AssignmentModal({ assignment, subjects, onClose, onSaved }) {
  const isEdit = !!assignment;
  const [form, setForm] = useState({
    title: assignment?.title || '',
    description: assignment?.description || '',
    subject_id: assignment?.subject_id || '',
    due_date: assignment?.due_date ? assignment.due_date.slice(0, 16) : '',
    max_score: assignment?.max_score || 100,
    is_exam_mode: assignment?.is_exam_mode || false,
    topic_tags: assignment?.topic_tags?.join(', ') || '',
  });
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const payload = {
        ...form,
        subject_id: Number(form.subject_id),
        max_score: Number(form.max_score),
        due_date: form.due_date ? new Date(form.due_date).toISOString() : null,
        topic_tags: form.topic_tags ? form.topic_tags.split(',').map((t) => t.trim()).filter(Boolean) : null,
      };
      if (isEdit) {
        await updateAssignment(assignment.assignment_id, payload);
        toast.success('Assignment updated');
      } else {
        await createAssignment(payload);
        toast.success('Assignment created');
      }
      onSaved();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to save assignment');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/30" onClick={onClose} />
      <div className="relative bg-white rounded-xl shadow-xl w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-5 border-b border-primary-light">
          <h2 className="text-lg font-bold text-primary-dark">
            {isEdit ? 'Edit Assignment' : 'New Assignment'}
          </h2>
          <button onClick={onClose} className="p-1 rounded hover:bg-slate-100">
            <X className="w-5 h-5 text-slate-500" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Title *</label>
            <input
              type="text"
              required
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
              placeholder="Assignment title"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Subject *</label>
            <select
              required
              value={form.subject_id}
              onChange={(e) => setForm({ ...form, subject_id: e.target.value })}
              disabled={isEdit}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary disabled:bg-slate-100"
            >
              <option value="">Select subject...</option>
              {subjects.map((s) => (
                <option key={s.subject_id} value={s.subject_id}>
                  {s.subject_name} ({s.grade_name})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Description</label>
            <textarea
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              rows={3}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary resize-none"
              placeholder="Instructions for students..."
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Due Date</label>
              <input
                type="datetime-local"
                value={form.due_date}
                onChange={(e) => setForm({ ...form, due_date: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Max Score</label>
              <input
                type="number"
                min="1"
                value={form.max_score}
                onChange={(e) => setForm({ ...form, max_score: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Topic Tags</label>
            <input
              type="text"
              value={form.topic_tags}
              onChange={(e) => setForm({ ...form, topic_tags: e.target.value })}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
              placeholder="Algebra, Geometry, ... (comma separated)"
            />
          </div>

          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="exam_mode"
              checked={form.is_exam_mode}
              onChange={(e) => setForm({ ...form, is_exam_mode: e.target.checked })}
              className="w-4 h-4 text-primary border-slate-300 rounded focus:ring-primary"
            />
            <label htmlFor="exam_mode" className="text-sm text-slate-700">Exam Mode</label>
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-lg transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-4 py-2 text-sm bg-primary text-white rounded-lg hover:bg-primary/90 transition disabled:opacity-50 flex items-center gap-2"
            >
              {saving && <Loader2 className="w-4 h-4 animate-spin" />}
              {isEdit ? 'Update' : 'Create'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function InstructorAssignments() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [assignments, setAssignments] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [subjects, setSubjects] = useState([]);
  const [detail, setDetail] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [editTarget, setEditTarget] = useState(null);

  const page = Number(searchParams.get('page')) || 1;
  const statusFilter = searchParams.get('status') || '';
  const subjectFilter = searchParams.get('subject_id') || '';
  const searchQuery = searchParams.get('search') || '';
  const perPage = 12;
  const totalPages = Math.ceil(total / perPage);

  const fetchAssignments = useCallback(async () => {
    setLoading(true);
    try {
      const params = { page, per_page: perPage };
      if (statusFilter) params.status = statusFilter;
      if (subjectFilter) params.subject_id = Number(subjectFilter);
      const res = await getAssignments(params);
      setAssignments(res.data.items || []);
      setTotal(res.data.total || 0);
    } catch {
      toast.error('Failed to load assignments');
    } finally {
      setLoading(false);
    }
  }, [page, statusFilter, subjectFilter]);

  useEffect(() => {
    fetchAssignments();
  }, [fetchAssignments]);

  useEffect(() => {
    getSubjects().then((res) => setSubjects(res.data || [])).catch(() => {});
  }, []);

  const handlePublish = async (id) => {
    try {
      await publishAssignment(id);
      toast.success('Assignment published');
      fetchAssignments();
      setDetail(null);
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to publish');
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this draft assignment?')) return;
    try {
      await deleteAssignment(id);
      toast.success('Assignment deleted');
      fetchAssignments();
      setDetail(null);
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to delete');
    }
  };

  const openDetail = async (id) => {
    try {
      const res = await getAssignmentDetail(id);
      setDetail(res.data);
    } catch {
      toast.error('Failed to load details');
    }
  };

  const setFilter = (key, value) => {
    const params = new URLSearchParams(searchParams);
    if (value) params.set(key, value);
    else params.delete(key);
    params.set('page', '1');
    setSearchParams(params);
  };

  const goToPage = (p) => {
    const params = new URLSearchParams(searchParams);
    params.set('page', String(p));
    setSearchParams(params);
  };

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-primary-light flex items-center justify-center">
            <ClipboardList className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-primary-dark">Assignments</h1>
            <p className="text-sm text-slate-500">Create, manage & publish assignments.</p>
          </div>
        </div>
        <button
          onClick={() => { setEditTarget(null); setShowModal(true); }}
          className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg text-sm hover:bg-primary/90 transition"
        >
          <Plus className="w-4 h-4" /> New Assignment
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3 mb-6">
        <div className="relative flex-1 min-w-[200px] max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search assignments..."
            value={searchQuery}
            onChange={(e) => setFilter('search', e.target.value)}
            className="w-full pl-9 pr-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
          />
        </div>

        <select
          value={statusFilter}
          onChange={(e) => setFilter('status', e.target.value)}
          className="px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
        >
          <option value="">All Status</option>
          <option value="draft">Draft</option>
          <option value="published">Published</option>
        </select>

        <select
          value={subjectFilter}
          onChange={(e) => setFilter('subject_id', e.target.value)}
          className="px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
        >
          <option value="">All Subjects</option>
          {subjects.map((s) => (
            <option key={s.subject_id} value={s.subject_id}>{s.subject_name}</option>
          ))}
        </select>
      </div>

      {/* Assignment List */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="bg-white rounded-xl border border-primary-light p-5 animate-pulse">
              <div className="h-4 w-3/4 bg-slate-200 rounded mb-3" />
              <div className="h-3 w-1/2 bg-slate-100 rounded mb-4" />
              <div className="h-3 w-full bg-slate-100 rounded mb-2" />
              <div className="h-3 w-2/3 bg-slate-100 rounded" />
            </div>
          ))}
        </div>
      ) : assignments.length === 0 ? (
        <div className="bg-white border border-primary-light rounded-xl p-12 text-center">
          <FileText className="w-12 h-12 text-slate-300 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-primary-dark mb-2">No Assignments Yet</h3>
          <p className="text-slate-500 text-sm mb-4">Create your first assignment to get started.</p>
          <button
            onClick={() => { setEditTarget(null); setShowModal(true); }}
            className="px-4 py-2 bg-primary text-white rounded-lg text-sm hover:bg-primary/90 transition"
          >
            <Plus className="w-4 h-4 inline mr-1" /> Create Assignment
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {assignments.map((a) => (
            <div
              key={a.assignment_id}
              className="bg-white rounded-xl border border-primary-light p-5 hover:shadow-md transition cursor-pointer"
              onClick={() => openDetail(a.assignment_id)}
            >
              <div className="flex items-start justify-between mb-3">
                <h3 className="text-sm font-semibold text-primary-dark line-clamp-2 flex-1 mr-2">{a.title}</h3>
                <StatusBadge published={a.is_published} />
              </div>
              <p className="text-xs text-slate-500 mb-3">{a.subject_name} &middot; {a.grade_name}</p>
              {a.due_date && (
                <div className="flex items-center gap-1 text-xs text-slate-500 mb-2">
                  <Calendar className="w-3 h-3" />
                  <span>Due {new Date(a.due_date).toLocaleDateString()}</span>
                </div>
              )}
              <div className="flex items-center justify-between mt-3 pt-3 border-t border-slate-100">
                <span className="text-xs text-slate-500">{a.submission_count || 0} submissions</span>
                {a.avg_score != null && (
                  <span className="text-xs font-semibold text-primary">{a.avg_score}% avg</span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 mt-6">
          <button
            onClick={() => goToPage(page - 1)}
            disabled={page <= 1}
            className="p-2 rounded-lg border border-slate-300 text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <span className="text-sm text-slate-600">
            Page {page} of {totalPages}
          </span>
          <button
            onClick={() => goToPage(page + 1)}
            disabled={page >= totalPages}
            className="p-2 rounded-lg border border-slate-300 text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Detail Drawer */}
      {detail && (
        <div className="fixed inset-0 z-50 flex justify-end">
          <div className="absolute inset-0 bg-black/30" onClick={() => setDetail(null)} />
          <div className="relative bg-white w-full max-w-md shadow-xl overflow-y-auto">
            <div className="p-5 border-b border-primary-light flex items-center justify-between">
              <h2 className="text-lg font-bold text-primary-dark">Assignment Detail</h2>
              <button onClick={() => setDetail(null)} className="p-1 rounded hover:bg-slate-100">
                <X className="w-5 h-5 text-slate-500" />
              </button>
            </div>
            <div className="p-5 space-y-4">
              <div>
                <StatusBadge published={detail.is_published} />
                {detail.is_exam_mode && (
                  <span className="ml-2 px-2 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-700">Exam</span>
                )}
              </div>
              <h3 className="text-xl font-bold text-primary-dark">{detail.title}</h3>
              <p className="text-sm text-slate-500">{detail.subject_name} &middot; {detail.grade_name}</p>
              {detail.description && <p className="text-sm text-slate-600">{detail.description}</p>}
              {detail.due_date && (
                <p className="text-sm text-slate-500">
                  <Calendar className="w-4 h-4 inline mr-1" />
                  Due: {new Date(detail.due_date).toLocaleString()}
                </p>
              )}
              {detail.topic_tags?.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {detail.topic_tags.map((tag, i) => (
                    <span key={i} className="px-2 py-0.5 bg-primary-light text-primary text-xs rounded-full">{tag}</span>
                  ))}
                </div>
              )}

              <div className="grid grid-cols-3 gap-3 pt-2">
                <div className="text-center p-3 bg-slate-50 rounded-lg">
                  <p className="text-lg font-bold text-primary-dark">{detail.submission_count}</p>
                  <p className="text-xs text-slate-500">Submissions</p>
                </div>
                <div className="text-center p-3 bg-slate-50 rounded-lg">
                  <p className="text-lg font-bold text-green-600">{detail.graded_count}</p>
                  <p className="text-xs text-slate-500">Graded</p>
                </div>
                <div className="text-center p-3 bg-slate-50 rounded-lg">
                  <p className="text-lg font-bold text-amber-600">{detail.pending_count}</p>
                  <p className="text-xs text-slate-500">Pending</p>
                </div>
              </div>

              {detail.avg_score != null && (
                <div className="bg-primary-light/30 rounded-lg p-3 text-center">
                  <p className="text-sm text-slate-500">Average Score</p>
                  <p className="text-2xl font-bold text-primary-dark">{detail.avg_score}%</p>
                </div>
              )}

              {detail.recent_submissions?.length > 0 && (
                <div>
                  <h4 className="text-sm font-semibold text-primary-dark mb-2">Recent Submissions</h4>
                  <div className="space-y-2">
                    {detail.recent_submissions.map((s) => (
                      <div key={s.submission_id} className="flex items-center justify-between bg-slate-50 rounded-lg p-2">
                        <div>
                          <p className="text-sm font-medium text-primary-dark">{s.student_name}</p>
                          <p className="text-xs text-slate-500 capitalize">{s.status}</p>
                        </div>
                        {s.score_percentage != null && (
                          <span className="text-sm font-semibold text-primary">{s.score_percentage}%</span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex gap-2 pt-3 border-t border-slate-100">
                {!detail.is_published && (
                  <>
                    <button
                      onClick={() => handlePublish(detail.assignment_id)}
                      className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-green-600 text-white rounded-lg text-sm hover:bg-green-700 transition"
                    >
                      <Send className="w-4 h-4" /> Publish
                    </button>
                    <button
                      onClick={() => { setEditTarget(detail); setShowModal(true); setDetail(null); }}
                      className="flex items-center gap-2 px-3 py-2 border border-slate-300 text-slate-600 rounded-lg text-sm hover:bg-slate-50 transition"
                    >
                      <Pencil className="w-4 h-4" /> Edit
                    </button>
                    <button
                      onClick={() => handleDelete(detail.assignment_id)}
                      className="flex items-center gap-2 px-3 py-2 border border-red-200 text-red-600 rounded-lg text-sm hover:bg-red-50 transition"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </>
                )}
                {detail.is_published && (
                  <button
                    onClick={() => { setEditTarget(detail); setShowModal(true); setDetail(null); }}
                    className="flex-1 flex items-center justify-center gap-2 px-3 py-2 border border-slate-300 text-slate-600 rounded-lg text-sm hover:bg-slate-50 transition"
                  >
                    <Pencil className="w-4 h-4" /> Edit Details
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Create/Edit Modal */}
      {showModal && (
        <AssignmentModal
          assignment={editTarget}
          subjects={subjects}
          onClose={() => setShowModal(false)}
          onSaved={() => { setShowModal(false); fetchAssignments(); }}
        />
      )}
    </div>
  );
}
