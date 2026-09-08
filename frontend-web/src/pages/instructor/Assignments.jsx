import { useState, useEffect, useCallback, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { fmtDate, fmtDateTime } from '../../utils/dateUtils';
import { useQuery, useMutation } from '@tanstack/react-query';
import {
  ClipboardList,
  Plus,
  Pencil,
  Trash2,
  Send,
  Search,
  ListFilter,
  Loader2,
  X,
  Calendar,
  FileText,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import MarkdownMath from '../../components/MarkdownMath';
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
import { queryClient } from '../../lib/queryClient';

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
    exam_duration_minutes: assignment?.exam_duration_minutes ?? 60,
    exam_max_pauses: assignment?.exam_max_pauses ?? 2,
    exam_strict_proctor: assignment?.exam_strict_proctor || false,
    topic_tags: assignment?.topic_tags?.join(', ') || '',
  });

  const saveMutation = useMutation({
    mutationFn: async (payload) => {
      if (isEdit) {
        return updateAssignment(assignment.assignment_id, payload);
      } else {
        return createAssignment(payload);
      }
    },
    onSuccess: () => {
      toast.success(isEdit ? 'Assignment updated' : 'Assignment created');
      queryClient.invalidateQueries({ queryKey: ['instructor', 'assignments'] });
      queryClient.invalidateQueries({ queryKey: ['instructor', 'dashboard'] });
      onSaved();
    },
    onError: (err) => {
      toast.error(err.response?.data?.detail || 'Failed to save assignment');
    },
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    const payload = {
      ...form,
      subject_id: Number(form.subject_id),
      max_score: Number(form.max_score),
      due_date: form.due_date ? new Date(form.due_date).toISOString() : null,
      topic_tags: form.topic_tags ? form.topic_tags.split(',').map((t) => t.trim()).filter(Boolean) : null,
      exam_duration_minutes: form.is_exam_mode ? Number(form.exam_duration_minutes) || null : null,
      exam_max_pauses: form.is_exam_mode ? Number(form.exam_max_pauses) : null,
      exam_strict_proctor: form.is_exam_mode ? !!form.exam_strict_proctor : false,
    };
    saveMutation.mutate(payload);
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
            <label className="block text-sm font-medium text-slate-700 mb-1">Description & questions</label>
            <textarea
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              rows={6}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary resize-y font-mono"
              placeholder={'Use Markdown. Math: $x^2 + 1$ inline or block:\n$$\\\\int_0^1 x\\\\,dx$$'}
            />
            <p className="text-[10px] text-slate-400 mt-1">
              LaTeX: <code className="bg-slate-100 px-1 rounded">$...$</code> inline,{' '}
              <code className="bg-slate-100 px-1 rounded">$$...$$</code> display. Line breaks are preserved for students.
            </p>
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

          <div className="rounded-lg border border-slate-200 bg-slate-50/80 p-3 space-y-3">
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="exam_mode"
                checked={form.is_exam_mode}
                onChange={(e) => setForm({ ...form, is_exam_mode: e.target.checked })}
                className="w-4 h-4 text-primary border-slate-300 rounded focus:ring-primary"
              />
              <label htmlFor="exam_mode" className="text-sm font-medium text-slate-800">Exam mode</label>
            </div>
            {form.is_exam_mode && (
              <div className="grid grid-cols-2 gap-3 pl-6 pt-1 border-t border-slate-200">
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Time limit (minutes)</label>
                  <input
                    type="number"
                    min={1}
                    max={600}
                    value={form.exam_duration_minutes}
                    onChange={(e) => setForm({ ...form, exam_duration_minutes: e.target.value })}
                    className="w-full px-2 py-1.5 border border-slate-300 rounded-lg text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Max pauses</label>
                  <input
                    type="number"
                    min={0}
                    max={30}
                    value={form.exam_max_pauses}
                    onChange={(e) => setForm({ ...form, exam_max_pauses: e.target.value })}
                    className="w-full px-2 py-1.5 border border-slate-300 rounded-lg text-sm"
                  />
                </div>
                <div className="col-span-2 flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="exam_strict"
                    checked={form.exam_strict_proctor}
                    onChange={(e) => setForm({ ...form, exam_strict_proctor: e.target.checked })}
                    className="w-4 h-4 text-primary border-slate-300 rounded"
                  />
                  <label htmlFor="exam_strict" className="text-xs text-slate-700">
                    Strict proctored mode (full-screen / tab tracking when supported)
                  </label>
                </div>
              </div>
            )}
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
              disabled={saveMutation.isPending}
              className="px-4 py-2 text-sm bg-primary text-white rounded-lg hover:bg-primary/90 transition disabled:opacity-50 flex items-center gap-2"
            >
              {saveMutation.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
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
  const [detail, setDetail] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [editTarget, setEditTarget] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [examModeFilter, setExamModeFilter] = useState('all');

  const page = Number(searchParams.get('page')) || 1;
  const statusFilter = searchParams.get('status') || '';
  const subjectFilter = searchParams.get('subject_id') || '';
  const perPage = 12;

  const { data: subjects = [] } = useQuery({
    queryKey: ['instructor', 'subjects'],
    queryFn: async () => {
      const res = await getSubjects();
      return res.data || [];
    },
  });

  const {
    data: assignmentsData,
    isPending: loading,
  } = useQuery({
    queryKey: ['instructor', 'assignments', { page, statusFilter, subjectFilter }],
    queryFn: async () => {
      const params = { page, per_page: perPage };
      if (statusFilter) params.status = statusFilter;
      if (subjectFilter) params.subject_id = Number(subjectFilter);
      const res = await getAssignments(params);
      return res.data;
    },
  });

  const publishMutation = useMutation({
    mutationFn: (id) => publishAssignment(id),
    onSuccess: () => {
      toast.success('Assignment published');
      queryClient.invalidateQueries({ queryKey: ['instructor', 'assignments'] });
      queryClient.invalidateQueries({ queryKey: ['instructor', 'dashboard'] });
      setDetail(null);
    },
    onError: (err) => {
      toast.error(err.response?.data?.detail || 'Failed to publish');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => deleteAssignment(id),
    onSuccess: () => {
      toast.success('Assignment deleted');
      queryClient.invalidateQueries({ queryKey: ['instructor', 'assignments'] });
      queryClient.invalidateQueries({ queryKey: ['instructor', 'dashboard'] });
      setDetail(null);
    },
    onError: (err) => {
      toast.error(err.response?.data?.detail || 'Failed to delete');
    },
  });

  const assignments = assignmentsData?.items || [];
  const total = assignmentsData?.total || 0;
  const totalPages = Math.ceil(total / perPage);

  const filteredAssignments = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    return assignments.filter((a) => {
      if (examModeFilter === 'exam' && !a.is_exam_mode) return false;
      if (examModeFilter === 'regular' && a.is_exam_mode) return false;
      if (query) {
        const inText =
          a.title?.toLowerCase().includes(query) ||
          a.description?.toLowerCase().includes(query) ||
          a.subject_name?.toLowerCase().includes(query) ||
          a.grade_name?.toLowerCase().includes(query) ||
          a.topic_tags?.some((tag) => tag.toLowerCase().includes(query));
        if (!inText) return false;
      }
      return true;
    });
  }, [assignments, searchQuery, examModeFilter]);

  const hasExtraListFilters = examModeFilter !== 'all';

  const handlePublish = (id) => publishMutation.mutate(id);

  const handleDelete = (id) => {
    if (!window.confirm('Delete this draft assignment?')) return;
    deleteMutation.mutate(id);
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
      <div className="mb-6 p-3 bg-slate-50/80 rounded-xl border border-slate-100 flex flex-col lg:flex-row flex-wrap items-stretch lg:items-center gap-2 lg:gap-3">
        <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-500 uppercase tracking-wide shrink-0">
          <ListFilter className="w-3.5 h-3.5" />
          Filter
        </div>
        <div className="relative flex-1 min-w-[200px] max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="search"
            placeholder="Search title, description, tags, subject, grade…"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-2 border border-primary-light rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-primary/25 focus:border-primary"
            aria-label="Search assignments"
          />
        </div>

        <select
          value={statusFilter}
          onChange={(e) => setFilter('status', e.target.value)}
          className="flex-1 min-w-[120px] lg:max-w-[160px] px-3 py-2 border border-primary-light rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-primary/25 focus:border-primary"
          aria-label="Filter by status"
        >
          <option value="">All status</option>
          <option value="draft">Draft</option>
          <option value="published">Published</option>
        </select>

        <select
          value={subjectFilter}
          onChange={(e) => setFilter('subject_id', e.target.value)}
          className="flex-1 min-w-[120px] lg:max-w-[200px] px-3 py-2 border border-primary-light rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-primary/25 focus:border-primary"
          aria-label="Filter by subject"
        >
          <option value="">All subjects</option>
          {subjects.map((s) => (
            <option key={s.subject_id} value={s.subject_id}>{s.subject_name}</option>
          ))}
        </select>

        <select
          value={examModeFilter}
          onChange={(e) => setExamModeFilter(e.target.value)}
          className="flex-1 min-w-[120px] lg:max-w-[180px] px-3 py-2 border border-primary-light rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-primary/25 focus:border-primary"
          aria-label="Exam mode"
        >
          <option value="all">All types</option>
          <option value="exam">Exam mode only</option>
          <option value="regular">Regular only</option>
        </select>

        {(searchQuery.trim() || hasExtraListFilters) ? (
          <button
            type="button"
            onClick={() => { setSearchQuery(''); setExamModeFilter('all'); }}
            className="text-xs font-medium text-primary hover:underline whitespace-nowrap px-1 py-2 lg:py-0"
          >
            Clear local filters
          </button>
        ) : null}
      </div>
      <p className="text-[11px] text-slate-400 -mt-4 mb-6">
        Showing {filteredAssignments.length} of {assignments.length} assignments on this page
        {total ? ` · ${total} total from server` : ''}
      </p>

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
      ) : filteredAssignments.length === 0 ? (
        <div className="bg-white border border-primary-light rounded-xl p-12 text-center">
          <FileText className="w-12 h-12 text-slate-300 mx-auto mb-4" />
          {assignments.length > 0 ? (
            <>
              <h3 className="text-lg font-semibold text-primary-dark mb-2">No Results Found</h3>
              <p className="text-slate-500 text-sm mb-4">
                No assignments on this page match your filters. Try clearing local filters or changing status / subject.
              </p>
              <button
                type="button"
                onClick={() => { setSearchQuery(''); setExamModeFilter('all'); }}
                className="px-4 py-2 bg-slate-100 text-slate-700 rounded-lg text-sm hover:bg-slate-200 transition"
              >
                Clear local filters
              </button>
            </>
          ) : (
            <>
              <h3 className="text-lg font-semibold text-primary-dark mb-2">No Assignments Yet</h3>
              <p className="text-slate-500 text-sm mb-4">Create your first assignment to get started.</p>
              <button
                onClick={() => { setEditTarget(null); setShowModal(true); }}
                className="px-4 py-2 bg-primary text-white rounded-lg text-sm hover:bg-primary/90 transition"
              >
                <Plus className="w-4 h-4 inline mr-1" /> Create Assignment
              </button>
            </>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredAssignments.map((a) => (
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
                  <span>Due {fmtDate(a.due_date)}</span>
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
              {detail.is_exam_mode && (
                <div className="text-xs text-slate-600 space-y-1 bg-slate-50 rounded-lg p-3 border border-slate-100">
                  {detail.exam_duration_minutes != null && (
                    <p><span className="font-semibold">Time limit:</span> {detail.exam_duration_minutes} min</p>
                  )}
                  {detail.exam_max_pauses != null && (
                    <p><span className="font-semibold">Max pauses:</span> {detail.exam_max_pauses}</p>
                  )}
                  {detail.exam_strict_proctor && (
                    <p className="text-amber-800 font-medium">Strict proctoring enabled</p>
                  )}
                </div>
              )}
              {detail.description && (
                <div className="text-sm text-slate-600 max-h-64 overflow-y-auto border border-slate-100 rounded-lg p-3">
                  <MarkdownMath markdown={detail.description} />
                </div>
              )}
              {detail.due_date && (
                <p className="text-sm text-slate-500">
                  <Calendar className="w-4 h-4 inline mr-1" />
                  Due: {fmtDateTime(detail.due_date)}
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
          onSaved={() => setShowModal(false)}
        />
      )}
    </div>
  );
}
