import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  TrendingUp,
  Zap,
  Eye,
  ChevronLeft,
  ChevronRight,
  X,
  FileText,
  Clock,
  CheckCircle,
  AlertCircle,
  Loader2,
  Download,
  Bot,
  UserCircle,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { getSubmissions, getSubjects, getDashboard, getSubmissionDetail, downloadSubmissionFile } from '../../services/studentService';

const STATUS_COLORS = {
  queued: 'bg-yellow-100 text-yellow-700',
  ocr: 'bg-blue-100 text-blue-700',
  grading: 'bg-purple-100 text-purple-700',
  done: 'bg-green-100 text-green-700',
  rejected: 'bg-red-100 text-red-700',
};

const GRADE_COLORS = {
  correct: 'text-green-600',
  partial: 'text-accent',
  incorrect: 'text-red-600',
};

export default function StudentSubmissions() {
  const navigate = useNavigate();
  const [subjectFilter, setSubjectFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [page, setPage] = useState(1);
  const [selectedSubmissionId, setSelectedSubmissionId] = useState(null);
  const [feedbackView, setFeedbackView] = useState('official');

  const { data: subjects = [] } = useQuery({
    queryKey: ['student', 'subjects'],
    queryFn: async () => {
      const res = await getSubjects();
      return res.data || [];
    },
  });

  const { data: dashboard } = useQuery({
    queryKey: ['student', 'dashboard'],
    queryFn: async () => {
      const res = await getDashboard();
      return res.data;
    },
  });

  const {
    data: submissionsData,
    isPending: loading,
  } = useQuery({
    queryKey: ['student', 'submissions', { page, subjectFilter, statusFilter }],
    queryFn: async () => {
      const params = { page, per_page: 10 };
      if (subjectFilter) params.subject_id = subjectFilter;
      if (statusFilter) params.status = statusFilter;
      const res = await getSubmissions(params);
      return res.data;
    },
  });

  const {
    data: selectedSubmission,
    isPending: detailLoading,
    isError: detailError,
  } = useQuery({
    queryKey: ['student', 'submission', selectedSubmissionId],
    queryFn: async () => {
      const res = await getSubmissionDetail(selectedSubmissionId);
      return res.data;
    },
    enabled: !!selectedSubmissionId,
  });

  const submissions = submissionsData?.items || [];
  const totalPages = submissionsData?.total_pages || 0;
  const total = submissionsData?.total || 0;

  const openDetail = (submissionId) => {
    setFeedbackView('official');
    setSelectedSubmissionId(submissionId);
  };
  const closeDetail = () => setSelectedSubmissionId(null);

  const handleDownloadFile = async (fileIndex, name) => {
    if (!selectedSubmissionId) return;
    try {
      await downloadSubmissionFile(selectedSubmissionId, fileIndex, name || `file-${fileIndex}`);
    } catch {
      toast.error('Could not download file');
    }
  };

  const fileEntryLabel = (entry) => {
    if (entry == null) return 'File';
    if (typeof entry === 'string') return entry;
    return entry.name || 'File';
  };

  const fileEntryIndex = (entry, i) => {
    if (entry && typeof entry === 'object' && typeof entry.index === 'number') return entry.index;
    return i;
  };

  const avgScore = dashboard?.average_score;

  return (
    <div>
      {/* Header + stats */}
      <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-primary-dark">My Submissions</h1>
          <p className="text-sm text-slate-500">Review your academic journey and performance analytics.</p>
        </div>
        <div className="flex gap-3">
          {avgScore !== null && avgScore !== undefined && (
            <div className="bg-white rounded-xl border border-primary-light px-4 py-3 text-center">
              <p className="text-xs text-slate-500 uppercase tracking-wider">Current Score</p>
              <p className="text-xl font-bold text-primary-dark flex items-center gap-1">
                <TrendingUp className="w-4 h-4 text-primary" />
                {avgScore.toFixed(1)}
              </p>
            </div>
          )}
          <div className="bg-primary-dark rounded-xl px-4 py-3 text-center text-white">
            <p className="text-xs uppercase tracking-wider text-white/70">Resolve Streak</p>
            <p className="text-xl font-bold flex items-center gap-1">
              <Zap className="w-4 h-4 text-accent" />
              12 Days
            </p>
            <p className="text-[10px] text-white/50">Keep going!</p>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 mb-4">
        <select
          value={subjectFilter}
          onChange={(e) => { setSubjectFilter(e.target.value); setPage(1); }}
          className="border border-primary-light rounded-lg px-3 py-2 text-sm bg-white focus:ring-2 focus:ring-primary/30 focus:border-primary outline-none"
        >
          <option value="">All Subjects</option>
          {subjects.map((s) => (
            <option key={s.subject_id} value={s.subject_id}>{s.subject_name}</option>
          ))}
        </select>
        <select
          value={statusFilter}
          onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
          className="border border-primary-light rounded-lg px-3 py-2 text-sm bg-white focus:ring-2 focus:ring-primary/30 focus:border-primary outline-none"
        >
          <option value="">All Status</option>
          <option value="done">Graded</option>
          <option value="queued">Queued</option>
          <option value="ocr">OCR Processing</option>
          <option value="grading">Grading</option>
          <option value="rejected">Rejected</option>
        </select>
      </div>

      {/* Submissions table */}
      {loading ? (
        <div className="space-y-3">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="animate-pulse bg-white rounded-xl border border-primary-light p-5 h-14" />
          ))}
        </div>
      ) : submissions.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-xl border border-primary-light">
          <p className="text-slate-400">No submissions yet. Submit your first assignment!</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-primary-light overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-slate-500 uppercase tracking-wider border-b border-primary-light bg-primary-50">
                <th className="px-5 py-3">Date</th>
                <th className="px-5 py-3">Subject</th>
                <th className="px-5 py-3 hidden md:table-cell">Assignment</th>
                <th className="px-5 py-3">Score</th>
                <th className="px-5 py-3">Status</th>
                <th className="px-5 py-3">Action</th>
              </tr>
            </thead>
            <tbody>
              {submissions.map((s) => (
                <tr key={s.submission_id} className="border-b border-slate-50 hover:bg-primary-50/30">
                  <td className="px-5 py-3.5 text-slate-600">
                    {new Date(s.submitted_at).toLocaleDateString()}
                  </td>
                  <td className="px-5 py-3.5 font-medium text-primary-dark">{s.subject_name || '—'}</td>
                  <td className="px-5 py-3.5 text-slate-600 hidden md:table-cell">{s.assignment_title || '—'}</td>
                  <td className="px-5 py-3.5">
                    {s.score_percentage !== null && s.score_percentage !== undefined ? (
                      <span className={`font-semibold ${GRADE_COLORS[s.grade_classification] || 'text-slate-700'}`}>
                        {s.score_percentage.toFixed(0)}%
                      </span>
                    ) : (
                      <span className="text-slate-400">—</span>
                    )}
                  </td>
                  <td className="px-5 py-3.5">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLORS[s.processing_status] || 'bg-slate-100 text-slate-600'}`}>
                      {s.processing_status}
                    </span>
                  </td>
                  <td className="px-5 py-3.5">
                    <button
                      onClick={() => openDetail(s.submission_id)}
                      className="text-xs text-primary hover:underline flex items-center gap-1"
                    >
                      <Eye className="w-3 h-3" />
                      View
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between mt-4">
          <p className="text-xs text-slate-500">
            Showing page {page} of {totalPages} ({total} submissions)
          </p>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              className="p-1.5 rounded-lg border border-primary-light hover:bg-primary-50 disabled:opacity-30"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            {[...Array(Math.min(totalPages, 5))].map((_, i) => (
              <button
                key={i}
                onClick={() => setPage(i + 1)}
                className={`w-8 h-8 rounded-lg text-sm font-medium transition-colors ${
                  page === i + 1
                    ? 'bg-primary-dark text-white'
                    : 'border border-primary-light text-slate-600 hover:bg-primary-50'
                }`}
              >
                {i + 1}
              </button>
            ))}
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              className="p-1.5 rounded-lg border border-primary-light hover:bg-primary-50 disabled:opacity-30"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Submission Detail Modal */}
      {selectedSubmission && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/30" onClick={closeDetail} />
          <div className="relative bg-white rounded-xl border border-primary-light shadow-xl w-full max-w-lg max-h-[80vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b border-primary-light px-5 py-4 flex items-center justify-between rounded-t-xl">
              <h3 className="font-bold text-primary-dark">Submission Details</h3>
              <button
                onClick={closeDetail}
                className="p-1 rounded-lg hover:bg-slate-100"
              >
                <X className="w-5 h-5 text-slate-400" />
              </button>
            </div>

            {detailLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-8 h-8 text-primary animate-spin" />
              </div>
            ) : detailError ? (
              <div className="p-8 text-center text-sm text-red-600">Could not load submission details.</div>
            ) : selectedSubmission ? (
              <div className="p-5 space-y-4">
                {/* Assignment info */}
                <div>
                  <p className="text-xs text-slate-500 uppercase tracking-wider mb-1">Assignment</p>
                  <p className="font-semibold text-primary-dark">{selectedSubmission.assignment_title || 'N/A'}</p>
                  <p className="text-sm text-slate-500">{selectedSubmission.subject_name || ''}</p>
                </div>

                {/* Status & Score */}
                <div className="flex gap-3">
                  <div className="flex-1 bg-primary-50 rounded-lg p-3">
                    <p className="text-xs text-slate-500 mb-1">Status</p>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLORS[selectedSubmission.processing_status] || 'bg-slate-100 text-slate-600'}`}>
                      {selectedSubmission.processing_status || 'unknown'}
                    </span>
                  </div>
                  <div className="flex-1 bg-primary-50 rounded-lg p-3">
                    <p className="text-xs text-slate-500 mb-1">Score</p>
                    <p className="font-bold text-primary-dark text-lg">
                      {selectedSubmission.score_percentage != null
                        ? `${selectedSubmission.score_percentage.toFixed(0)}%`
                        : 'Pending'}
                    </p>
                  </div>
                </div>

                {/* Submitted at */}
                <div className="flex items-center gap-2 text-sm text-slate-500">
                  <Clock className="w-4 h-4" />
                  <span>Submitted: {new Date(selectedSubmission.submitted_at).toLocaleString()}</span>
                </div>

                {/* Uploaded files */}
                {selectedSubmission.uploaded_files && selectedSubmission.uploaded_files.length > 0 && (
                  <div>
                    <p className="text-xs text-slate-500 uppercase tracking-wider mb-2">Your uploads</p>
                    <div className="space-y-1.5">
                      {selectedSubmission.uploaded_files.map((f, i) => {
                        const idx = fileEntryIndex(f, i);
                        const label = fileEntryLabel(f);
                        return (
                          <div key={`${idx}-${label}`} className="flex items-center justify-between gap-2 text-sm bg-slate-50 rounded-lg px-3 py-2">
                            <div className="flex items-center gap-2 min-w-0">
                              <FileText className="w-4 h-4 text-primary shrink-0" />
                              <span className="text-slate-700 truncate" title={label}>{label}</span>
                            </div>
                            <button
                              type="button"
                              onClick={() => handleDownloadFile(idx, label)}
                              className="shrink-0 flex items-center gap-1 text-xs font-medium text-primary hover:underline"
                            >
                              <Download className="w-3.5 h-3.5" />
                              Download
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Feedback — official vs original AI when instructor adjusted grade */}
                {selectedSubmission.feedback ? (
                  <div className="border-t border-primary-light pt-4">
                    <p className="text-xs text-slate-500 uppercase tracking-wider mb-2">Feedback</p>
                    {selectedSubmission.feedback.graded_by && !selectedSubmission.feedback.ai_snapshot ? (
                      <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-4">
                        <div className="flex items-start gap-2">
                          <UserCircle className="w-5 h-5 text-emerald-600 flex-shrink-0 mt-0.5" />
                          <div>
                            <p className="text-[11px] font-bold text-emerald-800 uppercase tracking-wider mb-1">Instructor grade</p>
                            <p className="text-sm font-medium text-emerald-900 mb-1">
                              Score:{' '}
                              {selectedSubmission.score_percentage != null
                                ? `${Number(selectedSubmission.score_percentage).toFixed(0)}%`
                                : '—'}
                            </p>
                            {selectedSubmission.feedback.overall_feedback && (
                              <p className="text-sm text-emerald-900/90 mb-2 whitespace-pre-wrap">
                                {selectedSubmission.feedback.overall_feedback}
                              </p>
                            )}
                            {selectedSubmission.feedback.strengths && (
                              <p className="text-sm text-emerald-800 mb-1">
                                <strong>Strengths:</strong> {selectedSubmission.feedback.strengths}
                              </p>
                            )}
                            {selectedSubmission.feedback.improvements && (
                              <p className="text-sm text-emerald-800">
                                <strong>To improve:</strong> {selectedSubmission.feedback.improvements}
                              </p>
                            )}
                            <p className="text-xs text-emerald-700/80 mt-2">Original AI comparison is not available for this submission.</p>
                          </div>
                        </div>
                      </div>
                    ) : selectedSubmission.feedback.graded_by && selectedSubmission.feedback.ai_snapshot ? (
                      <div className="space-y-3">
                        <div className="flex rounded-lg border border-slate-200 p-0.5 bg-slate-50">
                          <button
                            type="button"
                            onClick={() => setFeedbackView('official')}
                            className={`flex-1 flex items-center justify-center gap-1.5 py-2 text-xs font-semibold rounded-md transition ${
                              feedbackView === 'official'
                                ? 'bg-white text-primary-dark shadow-sm'
                                : 'text-slate-500 hover:text-slate-700'
                            }`}
                          >
                            <UserCircle className="w-3.5 h-3.5" />
                            Instructor
                          </button>
                          <button
                            type="button"
                            onClick={() => setFeedbackView('ai')}
                            className={`flex-1 flex items-center justify-center gap-1.5 py-2 text-xs font-semibold rounded-md transition ${
                              feedbackView === 'ai'
                                ? 'bg-white text-primary-dark shadow-sm'
                                : 'text-slate-500 hover:text-slate-700'
                            }`}
                          >
                            <Bot className="w-3.5 h-3.5" />
                            Original AI
                          </button>
                        </div>
                        {feedbackView === 'official' ? (
                          <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-4">
                            <div className="flex items-start gap-2">
                              <CheckCircle className="w-5 h-5 text-emerald-600 flex-shrink-0 mt-0.5" />
                              <div>
                                <p className="text-[11px] font-bold text-emerald-800 uppercase tracking-wider mb-1">Official grade</p>
                                <p className="text-sm font-medium text-emerald-900 mb-1">
                                  Score:{' '}
                                  {selectedSubmission.score_percentage != null
                                    ? `${Number(selectedSubmission.score_percentage).toFixed(0)}%`
                                    : '—'}
                                </p>
                                {selectedSubmission.feedback.overall_feedback && (
                                  <p className="text-sm text-emerald-900/90 mb-2 whitespace-pre-wrap">
                                    {selectedSubmission.feedback.overall_feedback}
                                  </p>
                                )}
                                {selectedSubmission.feedback.strengths && (
                                  <p className="text-sm text-emerald-800 mb-1">
                                    <strong>Strengths:</strong> {selectedSubmission.feedback.strengths}
                                  </p>
                                )}
                                {selectedSubmission.feedback.improvements && (
                                  <p className="text-sm text-emerald-800">
                                    <strong>To improve:</strong> {selectedSubmission.feedback.improvements}
                                  </p>
                                )}
                              </div>
                            </div>
                          </div>
                        ) : (
                          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                            <div className="flex items-start gap-2">
                              <Bot className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
                              <div>
                                <p className="text-[11px] font-bold text-blue-800 uppercase tracking-wider mb-1">AI grading (before adjustment)</p>
                                <p className="text-sm font-medium text-blue-900 mb-1">
                                  Score:{' '}
                                  {selectedSubmission.feedback.ai_snapshot.score_percentage != null
                                    ? `${Number(selectedSubmission.feedback.ai_snapshot.score_percentage).toFixed(0)}%`
                                    : '—'}
                                </p>
                                {selectedSubmission.feedback.ai_snapshot.overall_feedback && (
                                  <p className="text-sm text-blue-900/90 mb-2 whitespace-pre-wrap">
                                    {selectedSubmission.feedback.ai_snapshot.overall_feedback}
                                  </p>
                                )}
                                {selectedSubmission.feedback.ai_snapshot.strengths && (
                                  <p className="text-sm text-blue-800 mb-1">
                                    <strong>Strengths:</strong> {selectedSubmission.feedback.ai_snapshot.strengths}
                                  </p>
                                )}
                                {selectedSubmission.feedback.ai_snapshot.improvements && (
                                  <p className="text-sm text-blue-800">
                                    <strong>To improve:</strong> {selectedSubmission.feedback.ai_snapshot.improvements}
                                  </p>
                                )}
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                        <div className="flex items-start gap-2">
                          <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
                          <div>
                            {(() => {
                              const fbScore = selectedSubmission.feedback.score_percentage;
                              const rowScore = selectedSubmission.score_percentage;
                              const pct = fbScore != null ? fbScore : rowScore;
                              return (
                                <p className="text-sm font-medium text-green-800 mb-1">
                                  Score:
                                  {' '}
                                  {pct != null && pct !== undefined ? `${Number(pct).toFixed(0)}%` : '—'}
                                </p>
                              );
                            })()}
                            {selectedSubmission.feedback.overall_feedback && (
                              <p className="text-sm text-green-800/90 mb-2 whitespace-pre-wrap">
                                {selectedSubmission.feedback.overall_feedback}
                              </p>
                            )}
                            {selectedSubmission.feedback.strengths && (
                              <p className="text-sm text-green-700 mb-1">
                                <strong>Strengths:</strong> {selectedSubmission.feedback.strengths}
                              </p>
                            )}
                            {selectedSubmission.feedback.improvements && (
                              <p className="text-sm text-green-700">
                                <strong>To improve:</strong> {selectedSubmission.feedback.improvements}
                              </p>
                            )}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                ) : selectedSubmission.processing_status !== 'done' ? (
                  <div className="border-t border-primary-light pt-4">
                    <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 flex items-center gap-2">
                      <AlertCircle className="w-5 h-5 text-yellow-600 flex-shrink-0" />
                      <p className="text-sm text-yellow-700">
                        Feedback will be available once grading is complete.
                      </p>
                    </div>
                  </div>
                ) : null}

                {/* Link to full AI result page */}
                {selectedSubmission.submission_id && (
                  <div className="border-t border-primary-light pt-4">
                    <button
                      onClick={() => {
                        closeDetail();
                        navigate(`/student/submissions/${selectedSubmission.submission_id}/result`);
                      }}
                      className="w-full flex items-center justify-center gap-2 text-sm font-semibold text-primary-dark border border-primary rounded-xl py-2.5 hover:bg-primary-light transition-colors"
                    >
                      <Zap className="w-4 h-4" />
                      View Full AI Result
                    </button>
                  </div>
                )}
              </div>
            ) : null}
          </div>
        </div>
      )}
    </div>
  );
}
