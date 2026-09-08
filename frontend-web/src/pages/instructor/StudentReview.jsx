import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { fmtDate } from '../../utils/dateUtils';
import {
  User,
  ArrowLeft,
  FileText,
  TrendingUp,
  AlertTriangle,
  BookOpen,
  Loader2,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { getSubmissions, getSubjects } from '../../services/instructorService';

function StatusBadge({ status }) {
  const styles = {
    queued: 'bg-amber-100 text-amber-700',
    ocr: 'bg-blue-100 text-blue-700',
    grading: 'bg-purple-100 text-purple-700',
    done: 'bg-green-100 text-green-700',
    rejected: 'bg-red-100 text-red-700',
  };
  return (
    <span className={`px-2 py-0.5 rounded-full text-xs font-medium capitalize ${styles[status] || 'bg-slate-100 text-slate-600'}`}>
      {status}
    </span>
  );
}

export default function StudentReview() {
  const { studentId } = useParams();
  const navigate = useNavigate();
  const [submissions, setSubmissions] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const perPage = 20;
  const totalPages = Math.ceil(total / perPage);

  const studentName = submissions.length > 0 ? submissions[0].student_name : 'Student';

  useEffect(() => {
    if (!studentId) return;
    setLoading(true);
    getSubmissions({ student_id: studentId, page, per_page: perPage })
      .then((res) => {
        setSubmissions(res.data.items || []);
        setTotal(res.data.total || 0);
      })
      .catch(() => toast.error('Failed to load student data'))
      .finally(() => setLoading(false));
  }, [studentId, page]);

  // Calculate stats from submissions
  const gradedSubs = submissions.filter((s) => s.processing_status === 'done' && s.score_percentage != null);
  const avgScore = gradedSubs.length > 0
    ? (gradedSubs.reduce((sum, s) => sum + s.score_percentage, 0) / gradedSubs.length).toFixed(1)
    : null;
  const subjectSet = new Set(submissions.map((s) => s.subject_name));

  if (!studentId) {
    return (
      <div className="text-center py-16 bg-white rounded-xl border border-primary-light">
        <User className="w-16 h-16 text-slate-200 mx-auto mb-4" />
        <h3 className="text-lg font-semibold text-primary-dark mb-2">Student Review</h3>
        <p className="text-slate-500 text-sm max-w-sm mx-auto">
          Select a student from the Subjects detail page or Submissions page to view their detailed performance review.
        </p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div>
      {/* Back */}
      <button
        onClick={() => navigate(-1)}
        className="flex items-center gap-2 text-sm text-primary hover:underline mb-4"
      >
        <ArrowLeft className="w-4 h-4" /> Back
      </button>

      {/* Student Header */}
      <div className="bg-white rounded-xl border border-primary-light p-6 mb-6">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-full bg-primary-light border-2 border-primary/20 flex items-center justify-center text-primary text-xl font-bold">
            {studentName?.charAt(0)?.toUpperCase() || 'S'}
          </div>
          <div>
            <h1 className="text-xl font-bold text-primary-dark">{studentName}</h1>
            <p className="text-sm text-slate-500">Student Performance Review</p>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-6">
          <div className="text-center p-3 bg-primary-light/30 rounded-lg">
            <p className="text-2xl font-bold text-primary-dark">{total}</p>
            <p className="text-xs text-slate-500">Total Submissions</p>
          </div>
          <div className="text-center p-3 bg-primary-light/30 rounded-lg">
            <p className="text-2xl font-bold text-primary-dark">{gradedSubs.length}</p>
            <p className="text-xs text-slate-500">Graded</p>
          </div>
          <div className="text-center p-3 bg-primary-light/30 rounded-lg">
            <p className="text-2xl font-bold text-primary-dark">{avgScore != null ? `${avgScore}%` : '—'}</p>
            <p className="text-xs text-slate-500">Avg Score</p>
          </div>
          <div className="text-center p-3 bg-primary-light/30 rounded-lg">
            <p className="text-2xl font-bold text-primary-dark">{subjectSet.size}</p>
            <p className="text-xs text-slate-500">Subjects</p>
          </div>
        </div>
      </div>

      {/* Submissions Table */}
      <div className="bg-white rounded-xl border border-primary-light p-6">
        <h2 className="text-lg font-bold text-primary-dark mb-4">Submission History</h2>

        {submissions.length === 0 ? (
          <div className="py-8 text-center">
            <FileText className="w-12 h-12 text-slate-300 mx-auto mb-4" />
            <p className="text-slate-500 text-sm">No submissions found for this student.</p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-primary-light">
                    <th className="text-left py-2 px-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Assignment</th>
                    <th className="text-left py-2 px-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Subject</th>
                    <th className="text-center py-2 px-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Status</th>
                    <th className="text-center py-2 px-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Score</th>
                    <th className="text-right py-2 px-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Submitted</th>
                  </tr>
                </thead>
                <tbody>
                  {submissions.map((s) => (
                    <tr key={s.submission_id} className="border-b border-slate-50 hover:bg-slate-50/50">
                      <td className="py-3 px-3 text-sm font-medium text-primary-dark">{s.assignment_title}</td>
                      <td className="py-3 px-3 text-sm text-slate-500">{s.subject_name}</td>
                      <td className="py-3 px-3 text-center">
                        <StatusBadge status={s.processing_status} />
                      </td>
                      <td className="py-3 px-3 text-center text-sm font-semibold text-primary-dark">
                        {s.score_percentage != null ? `${s.score_percentage}%` : '—'}
                      </td>
                      <td className="py-3 px-3 text-right text-xs text-slate-500">
                        {fmtDate(s.submitted_at)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {totalPages > 1 && (
              <div className="flex items-center justify-center gap-2 mt-4">
                <button onClick={() => setPage(page - 1)} disabled={page <= 1} className="p-2 rounded-lg border border-slate-300 text-slate-600 hover:bg-slate-50 disabled:opacity-40">
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <span className="text-sm text-slate-600">Page {page} of {totalPages}</span>
                <button onClick={() => setPage(page + 1)} disabled={page >= totalPages} className="p-2 rounded-lg border border-slate-300 text-slate-600 hover:bg-slate-50 disabled:opacity-40">
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
