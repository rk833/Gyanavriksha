import { useState, useMemo, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { fmtDate, fmtDateTime } from '../../utils/dateUtils';
import { useQuery, useMutation } from '@tanstack/react-query';
import {
  Calendar, Upload, CheckCircle, Loader2, X, Image as ImageIcon, Camera,
  FileText, User, Award, ShieldAlert, ListOrdered, Clock, Pause, Users, Cpu,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { getWebSocketOrigin } from '../../lib/wsOrigin';
import MarkdownMath from '../../components/MarkdownMath';
import {
  getAssignments,
  getSubjects,
  uploadSubmission,
  postExamSessionStart,
  postExamSessionTerminate,
  resumeExamSession,
} from '../../services/studentService';
import { queryClient } from '../../lib/queryClient';
import useAuth from '../../hooks/useAuth';

const STATUS_BADGE = {
  open: 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-100',
  closed: 'bg-red-50 text-red-700 ring-1 ring-red-100',
  submitted: 'bg-primary-light text-primary ring-1 ring-primary/20',
};

function formatCountdown(totalSec) {
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

function isAllowedSubmissionFile(file) {
  const name = (file.name || '').toLowerCase();
  if (/\.(jpe?g|png|pdf)$/i.test(name)) return true;
  if (file.type && /^image\/(jpeg|png|jpg)$/i.test(file.type)) return true;
  if (file.type === 'application/pdf') return true;
  return false;
}

export default function StudentAssignments() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const submittedSuccessRef = useRef(false);
  const [subjectFilter, setSubjectFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [dueDateFilter, setDueDateFilter] = useState('');
  const [page, setPage] = useState(1);
  const [uploadModal, setUploadModal] = useState(null);
  const [examSessionStarted, setExamSessionStarted] = useState(false);
  const [files, setFiles] = useState([]);
  const [examRemainSec, setExamRemainSec] = useState(0);
  const [examPauseActive, setExamPauseActive] = useState(false);
  const [examIotPaused, setExamIotPaused] = useState(false); // true when paused by IoT
  const [examPausesUsed, setExamPausesUsed] = useState(0);
  const [activeExamSessionId, setActiveExamSessionId] = useState(null);
  const [examStartLoading, setExamStartLoading] = useState(false);

  const { data: subjects = [] } = useQuery({
    queryKey: ['student', 'subjects'],
    queryFn: async () => {
      const res = await getSubjects();
      return res.data || [];
    },
  });

  const { data: assignmentsData, isPending: loading } = useQuery({
    queryKey: ['student', 'assignments', { page, subjectFilter, statusFilter, dueDateFilter }],
    queryFn: async () => {
      const params = { page, per_page: 10 };
      if (subjectFilter) params.subject_id = subjectFilter;
      if (statusFilter !== 'all') params.status = statusFilter;
      if (dueDateFilter) params.due_on = dueDateFilter;
      const res = await getAssignments(params);
      return res.data;
    },
  });

  const uploadMutation = useMutation({
    mutationFn: ({ assignmentId, files: f }) => uploadSubmission(assignmentId, f),
    onSuccess: () => {
      submittedSuccessRef.current = true;
      toast.success('Submission uploaded successfully!');
      setUploadModal(null);
      setFiles([]);
      setExamSessionStarted(false);
      setExamPauseActive(false);
      setExamIotPaused(false);
      setExamPausesUsed(0);
      setActiveExamSessionId(null);
      queryClient.invalidateQueries({ queryKey: ['student', 'assignments'] });
      queryClient.invalidateQueries({ queryKey: ['student', 'dashboard'] });
    },
    onError: (err) => {
      toast.error(err.response?.data?.detail || 'Upload failed');
    },
  });

  const assignments = assignmentsData?.items || [];
  const totalPages = assignmentsData?.total_pages || 0;

  const getStatus = (a) => {
    if (a.has_submitted) return 'submitted';
    if (a.due_date && new Date(a.due_date) < new Date()) return 'closed';
    return 'open';
  };

  const closeModal = async () => {
    if (uploadMutation.isPending) return;
    if (
      uploadModal?.is_exam_mode
      && examSessionStarted
      && !submittedSuccessRef.current
      && activeExamSessionId
    ) {
      try {
        await postExamSessionTerminate(activeExamSessionId);
        queryClient.invalidateQueries({ queryKey: ['student', 'assignments'] });
      } catch {
        toast.error('Could not record exam exit — try again or contact support.');
        return;
      }
    }
    setUploadModal(null);
    setFiles([]);
    setExamSessionStarted(false);
    setExamPauseActive(false);
    setExamIotPaused(false);
    setExamPausesUsed(0);
    setActiveExamSessionId(null);
  };

  const handleFileSelect = (e) => {
    const selected = Array.from(e.target.files || []).filter(isAllowedSubmissionFile);
    const rejected = (e.target.files?.length || 0) - selected.length;
    if (rejected > 0) {
      toast.error('Only JPG, PNG, or PDF files are allowed');
    }
    if (files.length + selected.length > 5) {
      toast.error('Maximum 5 files per submission');
      return;
    }
    setFiles((prev) => [...prev, ...selected]);
    e.target.value = '';
  };

  const removeFile = (idx) => setFiles((prev) => prev.filter((_, i) => i !== idx));

  const handleUpload = () => {
    if (!files.length) {
      toast.error('Please add at least one image or PDF');
      return;
    }
    uploadMutation.mutate({ assignmentId: uploadModal.assignment_id, files });
  };

  const previewUrls = useMemo(
    () => files.map((f) => (f.type === 'application/pdf' || f.name?.toLowerCase().endsWith('.pdf') ? null : URL.createObjectURL(f))),
    [files],
  );
  useEffect(() => () => previewUrls.forEach((u) => u && URL.revokeObjectURL(u)), [previewUrls]);

  const openSubmit = (a) => {
    if (a.is_exam_mode && a.exam_slot_blocked) {
      toast.error('You already used your exam session for this assignment. Contact your instructor if you need help.');
      return;
    }
    submittedSuccessRef.current = false;
    setUploadModal(a);
    setFiles([]);
    setActiveExamSessionId(null);
    const resume =
      a.is_exam_mode
      && a.exam_active_session_id
      && a.exam_session_started_at
      && !a.exam_slot_blocked;
    if (resume) {
      setExamSessionStarted(true);
      setActiveExamSessionId(a.exam_active_session_id);
      const totalSec = Math.round(Number(a.exam_duration_minutes || 0) * 60);
      const startedMs = new Date(a.exam_session_started_at).getTime();
      const elapsed = Math.max(0, Math.floor((Date.now() - startedMs) / 1000));
      setExamRemainSec(Math.max(0, totalSec - elapsed));
    } else {
      setExamSessionStarted(!a.is_exam_mode);
      const mins = a.exam_duration_minutes;
      setExamRemainSec(mins && a.is_exam_mode ? Math.round(Number(mins) * 60) : 0);
    }
    setExamPauseActive(false);
    setExamIotPaused(false);
    setExamPausesUsed(0);
  };

  const startExamSession = async () => {
    if (!uploadModal?.is_exam_mode || !uploadModal.assignment_id) return;
    setExamStartLoading(true);
    try {
      const res = await postExamSessionStart(uploadModal.assignment_id);
      const { session_id, started_at, exam_duration_seconds } = res.data;
      setActiveExamSessionId(session_id);
      setExamSessionStarted(true);
      const totalSec = exam_duration_seconds != null
        ? exam_duration_seconds
        : Math.round(Number(uploadModal.exam_duration_minutes || 0) * 60);
      const startedMs = new Date(started_at).getTime();
      const elapsed = Math.max(0, Math.floor((Date.now() - startedMs) / 1000));
      setExamRemainSec(Math.max(0, totalSec - elapsed));
      setExamPauseActive(false);
      setExamIotPaused(false);
      setExamPausesUsed(0);
      queryClient.invalidateQueries({ queryKey: ['student', 'assignments'] });
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Could not start exam session');
    } finally {
      setExamStartLoading(false);
    }
  };

  useEffect(() => {
    if (!uploadModal?.is_exam_mode || !uploadModal.exam_duration_minutes || !examSessionStarted) return;
    if (examPauseActive) return;
    const id = setInterval(() => {
      setExamRemainSec((sec) => (sec <= 0 ? 0 : sec - 1));
    }, 1000);
    return () => clearInterval(id);
  }, [
    uploadModal?.assignment_id,
    uploadModal?.is_exam_mode,
    uploadModal?.exam_duration_minutes,
    examPauseActive,
    examSessionStarted,
  ]);

  // ── IoT WebSocket: listen for auto_pause / auto_forfeit / posture_alert ───
  useEffect(() => {
    if (!examSessionStarted || !activeExamSessionId) return;
    const token = localStorage.getItem('access_token');
    if (!token) return;
    const origin = getWebSocketOrigin();
    const ws = new WebSocket(`${origin}/api/students/ws/iot-session?token=${encodeURIComponent(token)}`);
    ws.onmessage = (e) => {
      let msg;
      try { msg = JSON.parse(e.data); } catch { return; }
      if (msg.type === 'auto_pause') {
        setExamPauseActive(true);
        setExamIotPaused(true);
        if (msg.pauses_used != null) setExamPausesUsed(msg.pauses_used);
        toast('IoT: You moved away — exam auto-paused', { icon: '⚠️' });
      }
      if (msg.type === 'auto_forfeit') {
        toast.error('Exam forfeited: you left your desk too many times');
        void closeModal();
      }
    };
    ws.onerror = () => {}; // silently ignore if MQTT/WS not running
    return () => ws.close();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [examSessionStarted, activeExamSessionId]);

  const handleIotResume = async () => {
    if (!activeExamSessionId) return;
    try {
      await resumeExamSession(activeExamSessionId);
      setExamPauseActive(false);
      setExamIotPaused(false);
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Could not resume exam session');
    }
  };

  const toggleExamPause = () => {
    if (!uploadModal?.is_exam_mode || !examSessionStarted) return;
    const maxP = uploadModal.exam_max_pauses != null ? Number(uploadModal.exam_max_pauses) : null;
    if (!examPauseActive) {
      if (maxP !== null && maxP === 0) {
        toast.error('This exam does not allow pauses');
        return;
      }
      if (maxP != null && examPausesUsed >= maxP) {
        toast.error('No pauses remaining');
        return;
      }
      setExamPauseActive(true);
      setExamIotPaused(false);
      if (maxP != null && maxP > 0) setExamPausesUsed((n) => n + 1);
    } else {
      setExamPauseActive(false);
      setExamIotPaused(false);
    }
  };

  const examWorkVisible = uploadModal && (!uploadModal.is_exam_mode || examSessionStarted);
  const examPreflight = uploadModal?.is_exam_mode && !examSessionStarted;

  const instructorRows = useMemo(() => {
    if (!uploadModal) return [];
    const raw = uploadModal.subject_instructors;
    if (Array.isArray(raw) && raw.length > 0) {
      return raw.map((row) => ({
        name: row.full_name || row.name || 'Instructor',
        email: row.email || '',
      }));
    }
    if (uploadModal.instructor_name) {
      return [{ name: uploadModal.instructor_name, email: '' }];
    }
    return [];
  }, [uploadModal]);

  return (
    <div className="max-w-4xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Assignments</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Submit clear photos of handwritten work, or a PDF, for each assignment (OCR grading where supported).
          </p>
        </div>
      </div>

      <div className="flex flex-wrap gap-2 mb-6">
        <select
          value={subjectFilter}
          onChange={(e) => { setSubjectFilter(e.target.value); setPage(1); }}
          className="border border-slate-200 rounded-xl px-3 py-2 text-sm bg-white shadow-sm focus:ring-2 focus:ring-primary/20 outline-none"
        >
          <option value="">All subjects</option>
          {subjects.map((s) => (
            <option key={s.subject_id} value={s.subject_id}>{s.subject_name}</option>
          ))}
        </select>
        <select
          value={statusFilter}
          onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
          className="border border-slate-200 rounded-xl px-3 py-2 text-sm bg-white shadow-sm focus:ring-2 focus:ring-primary/20 outline-none"
        >
          <option value="all">All status</option>
          <option value="open">Open</option>
          <option value="closed">Closed</option>
        </select>
        <div className="flex items-center gap-2">
          <label className="flex items-center gap-2 border border-slate-200 rounded-xl px-3 py-2 text-sm bg-white shadow-sm">
            <Calendar className="w-4 h-4 text-slate-400 shrink-0" />
            <span className="text-slate-500 whitespace-nowrap">Due on</span>
            <input
              type="date"
              value={dueDateFilter}
              onChange={(e) => { setDueDateFilter(e.target.value); setPage(1); }}
              className="bg-transparent outline-none text-slate-800 min-w-0"
            />
          </label>
          {dueDateFilter ? (
            <button
              type="button"
              onClick={() => { setDueDateFilter(''); setPage(1); }}
              className="text-xs text-slate-500 hover:text-slate-700 px-2 py-1 rounded-lg hover:bg-slate-50"
            >
              Clear date
            </button>
          ) : null}
        </div>
      </div>

      {loading ? (
        <div className="space-y-4">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="animate-pulse bg-white rounded-2xl border border-slate-100 h-40" />
          ))}
        </div>
      ) : assignments.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-2xl border border-slate-100">
          <FileText className="w-12 h-12 text-slate-200 mx-auto mb-3" />
          <p className="text-slate-600 font-medium">No assignments yet</p>
          <p className="text-xs text-slate-400 mt-1">Published work from your instructors will show here.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {assignments.map((a) => {
            const st = getStatus(a);
            const desc = a.description?.trim();
            const examBlocked = a.is_exam_mode && a.exam_slot_blocked;
            return (
              <article
                key={a.assignment_id}
                className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden"
              >
                <div className="p-5">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2 mb-1">
                        <h2 className="text-lg font-semibold text-slate-900">{a.title}</h2>
                        {a.is_exam_mode && (
                          <span className="inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide bg-amber-50 text-amber-800 px-2 py-0.5 rounded-md ring-1 ring-amber-100">
                            <ShieldAlert className="w-3 h-3" /> Exam mode
                          </span>
                        )}
                      </div>
                      <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500">
                        <span className="font-medium text-primary">{a.subject_name}</span>
                        <span>{a.grade_name}</span>
                        {a.instructor_name && (
                          <span className="inline-flex items-center gap-1">
                            <User className="w-3 h-3" /> {a.instructor_name}
                          </span>
                        )}
                        {a.max_score != null && (
                          <span className="inline-flex items-center gap-1">
                            <Award className="w-3 h-3" /> {a.max_score} marks
                          </span>
                        )}
                        {a.due_date && (
                          <span className="inline-flex items-center gap-1">
                            <Calendar className="w-3 h-3" />
                            Due {fmtDate(a.due_date)}
                          </span>
                        )}
                      </div>
                    </div>
                    <span className={`text-xs px-2.5 py-1 rounded-full font-semibold shrink-0 ${STATUS_BADGE[st]}`}>
                      {st === 'submitted' ? 'Submitted' : st === 'open' ? 'Open' : 'Closed'}
                    </span>
                  </div>

                  {a.is_exam_mode && (
                    <div className="mt-4 space-y-3">
                      <div className="flex flex-wrap gap-2 text-[11px] font-medium text-slate-600">
                        {a.exam_duration_minutes != null && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-100 border border-slate-200">
                            <Clock className="w-3 h-3" /> Time limit: {a.exam_duration_minutes} min
                          </span>
                        )}
                        {a.exam_max_pauses != null && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-100 border border-slate-200">
                            <Pause className="w-3 h-3" /> Pauses allowed: {a.exam_max_pauses}
                          </span>
                        )}
                        {a.exam_strict_proctor && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-amber-100 border border-amber-200 text-amber-900">
                            <ShieldAlert className="w-3 h-3" /> Strict proctoring
                          </span>
                        )}
                      </div>
                      <div className="rounded-xl border border-amber-200 bg-amber-50/90 px-4 py-3 text-sm text-amber-950">
                        <p className="font-semibold text-amber-900 flex items-center gap-2 mb-1.5">
                          <ShieldAlert className="w-4 h-4 shrink-0" /> Before you begin
                        </p>
                        <ul className="text-xs text-amber-900/90 space-y-1 list-disc pl-4">
                          <li>You will see your instructors, then start the exam — closing after start uses your one attempt.</li>
                          <li>Answer every section in order; show working where marks are shown.</li>
                          <li>Submit JPG, PNG, or PDF (max 5 files, 10 MB each).</li>
                        </ul>
                      </div>
                    </div>
                  )}

                  {desc ? (
                    <div className="mt-4 rounded-xl bg-slate-50 border border-slate-100 px-4 py-3">
                      <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                        <ListOrdered className="w-3.5 h-3.5" /> Questions & instructions
                      </p>
                      <div className="text-sm max-h-80 overflow-y-auto pr-1 border-t border-slate-100/80 pt-3 [&_.katex]:text-base">
                        <MarkdownMath markdown={desc} />
                      </div>
                    </div>
                  ) : (
                    <p className="mt-3 text-xs text-slate-400 italic">No written instructions for this assignment — check with your instructor.</p>
                  )}

                  {a.topic_tags?.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mt-3">
                      {a.topic_tags.map((t, i) => (
                        <span key={i} className="text-[10px] bg-white border border-slate-200 text-slate-500 px-2 py-0.5 rounded-md">{t}</span>
                      ))}
                    </div>
                  )}

                  <div className="flex flex-wrap gap-2 mt-4 pt-4 border-t border-slate-100">
                    {st === 'open' ? (
                      examBlocked ? (
                        <span className="text-sm text-slate-500 font-medium">
                          Exam session already used — contact your instructor if you need a reset.
                        </span>
                      ) : (
                        <button
                          onClick={() => openSubmit(a)}
                          className="inline-flex items-center gap-2 bg-slate-900 text-white text-sm font-semibold px-4 py-2 rounded-xl hover:bg-slate-800 transition-colors"
                        >
                          <Upload className="w-4 h-4" />
                          {a.is_exam_mode ? 'Submit exam answers' : 'Submit work'}
                        </button>
                      )
                    ) : st === 'submitted' ? (
                      <button
                        onClick={() => navigate('/student/submissions')}
                        className="text-sm font-semibold text-primary hover:underline"
                      >
                        View my submission
                      </button>
                    ) : (
                      <span className="text-sm text-slate-400">Deadline passed — contact your instructor.</span>
                    )}
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}

      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 mt-6">
          {[...Array(totalPages)].map((_, i) => (
            <button
              key={i}
              onClick={() => setPage(i + 1)}
              className={`w-9 h-9 rounded-lg text-sm font-medium transition-colors ${
                page === i + 1 ? 'bg-slate-900 text-white' : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
              }`}
            >
              {i + 1}
            </button>
          ))}
        </div>
      )}

      {uploadModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            onClick={() => {
              if (!uploadMutation.isPending) void closeModal();
            }}
          />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[92vh] overflow-y-auto">
            <div className="p-6">
              {examPreflight && (
                <div className="mb-6 rounded-2xl border border-slate-200 bg-slate-50 p-5">
                  <div className="flex items-center gap-2 text-slate-900 font-bold text-lg mb-2">
                    <Users className="w-5 h-5 text-primary" />
                    Your instructors for this subject
                  </div>
                  <p className="text-xs text-slate-600 mb-4">
                    Review who teaches this course. When you start the exam, the timer begins (if applicable) and closing this window without a successful submit counts as your one attempt.
                  </p>
                  <ul className="space-y-2 mb-5">
                    {instructorRows.map((row, idx) => (
                      <li
                        key={`${row.name}-${idx}`}
                        className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1 rounded-xl bg-white border border-slate-200 px-4 py-3 text-sm"
                      >
                        <span className="font-semibold text-slate-900 flex items-center gap-2">
                          <User className="w-4 h-4 text-slate-400" />
                          {row.name}
                        </span>
                        {row.email ? (
                          <span className="text-xs text-slate-500 break-all">{row.email}</span>
                        ) : null}
                      </li>
                    ))}
                  </ul>
                  <div className="flex flex-wrap gap-2 justify-end">
                    <button
                      type="button"
                      onClick={() => void closeModal()}
                      disabled={uploadMutation.isPending}
                      className="px-4 py-2 rounded-xl text-sm font-medium text-slate-600 hover:bg-slate-200/80"
                    >
                      Go back
                    </button>
                    <button
                      type="button"
                      onClick={() => void startExamSession()}
                      disabled={uploadMutation.isPending || examStartLoading}
                      className="px-5 py-2 rounded-xl text-sm font-semibold bg-slate-900 text-white hover:bg-slate-800 disabled:opacity-50"
                    >
                      {examStartLoading ? 'Starting…' : 'Start exam'}
                    </button>
                  </div>
                </div>
              )}

              {uploadModal.is_exam_mode && uploadModal.exam_duration_minutes > 0 && examSessionStarted && (
                <>
                  {examIotPaused && (
                    <div className="flex items-center gap-3 mb-3 p-3 rounded-xl bg-amber-500 text-white text-xs font-semibold">
                      <Cpu className="w-4 h-4 flex-shrink-0" />
                      <span className="flex-1">IoT Auto-paused — you moved away from your desk.</span>
                      <button
                        type="button"
                        onClick={() => void handleIotResume()}
                        disabled={uploadMutation.isPending}
                        className="px-3 py-1.5 rounded-lg bg-white/20 hover:bg-white/30 text-white font-medium transition-colors"
                      >
                        Resume
                      </button>
                    </div>
                  )}
                  <div className="flex flex-wrap items-center gap-3 mb-4 p-3 rounded-xl bg-slate-900 text-white text-xs">
                    <span className="inline-flex items-center gap-1.5 font-semibold">
                      <Clock className="w-3.5 h-3.5" />
                      Time left: {formatCountdown(examRemainSec)}
                      {examPauseActive && <span className="text-amber-300">(paused)</span>}
                    </span>
                    {uploadModal.exam_max_pauses != null && (
                      <span className="text-white/80">
                        Pauses used: {examPausesUsed}/{uploadModal.exam_max_pauses}
                      </span>
                    )}
                    {uploadModal.due_date && (
                      <span className="text-white/70">
                        Due: {fmtDateTime(uploadModal.due_date, { dateStyle: 'short', timeStyle: 'short' })}
                      </span>
                    )}
                    {!examIotPaused && (
                      <button
                        type="button"
                        onClick={toggleExamPause}
                        disabled={uploadMutation.isPending}
                        className="ml-auto inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-white/15 hover:bg-white/25 text-white font-medium"
                      >
                        <Pause className="w-3 h-3" />
                        {examPauseActive ? 'Resume' : 'Pause'}
                      </button>
                    )}
                  </div>
                </>
              )}

              {!examPreflight && (
                <>
                  <div className="flex items-center justify-between mb-4">
                    <h2 className="text-xl font-bold text-slate-900">
                      {uploadModal.is_exam_mode ? 'Submit exam' : 'Submit work'}
                    </h2>
                    <button
                      type="button"
                      onClick={() => {
              if (!uploadMutation.isPending) void closeModal();
            }}
                      className="p-2 rounded-xl hover:bg-slate-100"
                    >
                      <X className="w-5 h-5 text-slate-400" />
                    </button>
                  </div>

                  <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 mb-5">
                    <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Assignment</p>
                    <p className="font-semibold text-slate-900">{uploadModal.title}</p>
                    <p className="text-xs text-slate-500 mt-1">{uploadModal.subject_name} · {uploadModal.grade_name}</p>
                  </div>

                  {uploadModal.description?.trim() && (
                    <div className="rounded-xl border border-primary-light bg-primary-50/50 p-4 mb-5">
                      <p className="text-xs font-semibold text-primary-dark uppercase tracking-wider mb-2">Questions & instructions</p>
                      <div className="text-sm max-h-56 overflow-y-auto pr-1 [&_.katex]:text-sm">
                        <MarkdownMath markdown={uploadModal.description.trim()} />
                      </div>
                    </div>
                  )}
                  {uploadModal.is_exam_mode && examWorkVisible && (
                    <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 mb-5 text-xs text-amber-950">
                      <span className="font-semibold">Exam mode:</span>
                      {' '}
                      Closing this window without a successful submit uses your attempt. Upload JPG, PNG, or PDF before submitting.
                    </div>
                  )}

                  <label className="block border-2 border-dashed border-slate-200 rounded-xl p-8 text-center hover:border-primary/40 hover:bg-slate-50/80 cursor-pointer transition-colors mb-4">
                    <input
                      type="file"
                      multiple
                      accept="image/jpeg,image/png,image/jpg,application/pdf,.jpg,.jpeg,.png,.pdf"
                      onChange={handleFileSelect}
                      className="hidden"
                    />
                    <Upload className="w-10 h-10 text-slate-300 mx-auto mb-2" />
                    <p className="text-sm text-slate-700 font-medium">Add photos or PDFs of your answers</p>
                    <p className="text-xs text-slate-400 mt-1">JPG, PNG, or PDF · max 5 files · 10 MB each</p>
                    <div className="flex items-center justify-center gap-3 mt-4">
                      <span className="inline-flex items-center gap-1.5 bg-slate-900 text-white text-xs px-4 py-2 rounded-lg">
                        <ImageIcon className="w-3.5 h-3.5" /> Browse
                      </span>
                      <span className="inline-flex items-center gap-1.5 border border-slate-200 text-slate-600 text-xs px-4 py-2 rounded-lg">
                        <Camera className="w-3.5 h-3.5" /> Camera
                      </span>
                    </div>
                  </label>

                  {files.length > 0 && (
                    <div className="flex flex-wrap gap-2 mb-4">
                      {files.map((f, i) => {
                        const isPdf = f.type === 'application/pdf' || f.name?.toLowerCase().endsWith('.pdf');
                        return (
                          <div key={`${f.name}-${i}`} className="relative group">
                            <div className="w-20 h-20 rounded-lg border border-slate-200 overflow-hidden bg-slate-50 flex items-center justify-center">
                              {isPdf ? (
                                <FileText className="w-8 h-8 text-red-500" />
                              ) : (
                                <img src={previewUrls[i]} alt="" className="w-full h-full object-cover" />
                              )}
                            </div>
                            <button
                              type="button"
                              onClick={() => removeFile(i)}
                              className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-red-500 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                            >
                              <X className="w-3 h-3" />
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  <div className="bg-slate-50 rounded-xl p-4 mb-5">
                    <p className="text-xs font-semibold text-slate-600 uppercase tracking-wider mb-2">Checklist</p>
                    <div className="space-y-1.5">
                      {['Files are readable', 'Each question is addressed', 'Within 10 MB per file'].map((item, i) => (
                        <div key={i} className="flex items-center gap-2 text-xs text-slate-600">
                          <CheckCircle className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                          <span>{item}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="flex items-center justify-between gap-3">
                    <button
                      type="button"
                      onClick={() => {
              if (!uploadMutation.isPending) void closeModal();
            }}
                      disabled={uploadMutation.isPending}
                      className="text-sm text-slate-500 hover:text-slate-800"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={handleUpload}
                      disabled={uploadMutation.isPending || files.length === 0}
                      className="bg-slate-900 text-white px-6 py-2.5 rounded-xl text-sm font-semibold hover:bg-slate-800 disabled:opacity-50 flex items-center gap-2"
                    >
                      {uploadMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                      Submit
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
