import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import {
  BookOpen,
  Users,
  FileText,
  BarChart3,
  ArrowLeft,
  Loader2,
  ChevronLeft,
  ChevronRight,
  ArrowUpDown,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { getSubjects, getSubjectDetail } from '../../services/instructorService';

function SubjectCard({ subject, onClick }) {
  return (
    <div
      className="bg-white rounded-xl border border-primary-light p-5 hover:shadow-md transition cursor-pointer"
      onClick={onClick}
    >
      <div className="flex items-start justify-between mb-3">
        <div className="w-10 h-10 rounded-lg bg-primary-light flex items-center justify-center">
          <BookOpen className="w-5 h-5 text-primary" />
        </div>
        <span className="text-xs font-mono text-slate-400">{subject.subject_code}</span>
      </div>
      <h3 className="text-sm font-semibold text-primary-dark mb-1">{subject.subject_name}</h3>
      <p className="text-xs text-slate-500 mb-3">{subject.grade_name}</p>
      <div className="flex items-center gap-4 pt-3 border-t border-slate-100">
        <div className="flex items-center gap-1 text-xs text-slate-500">
          <Users className="w-3.5 h-3.5" /> {subject.student_count} students
        </div>
        <div className="flex items-center gap-1 text-xs text-slate-500">
          <FileText className="w-3.5 h-3.5" /> {subject.assignment_count} assignments
        </div>
      </div>
    </div>
  );
}

function SubjectDetailView({ subjectId }) {
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [sortBy, setSortBy] = useState('name');

  useEffect(() => {
    setLoading(true);
    getSubjectDetail(subjectId, { page, per_page: 20, sort_by: sortBy })
      .then((res) => setData(res.data))
      .catch(() => toast.error('Failed to load subject'))
      .finally(() => setLoading(false));
  }, [subjectId, page, sortBy]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!data) return null;

  return (
    <div>
      <button
        onClick={() => navigate('/instructor/subjects')}
        className="flex items-center gap-2 text-sm text-primary hover:underline mb-4"
      >
        <ArrowLeft className="w-4 h-4" /> Back to Subjects
      </button>

      <div className="bg-white rounded-xl border border-primary-light p-6 mb-6">
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-xl font-bold text-primary-dark">{data.subject_name}</h2>
            <p className="text-sm text-slate-500">{data.grade_name} &middot; {data.subject_code}</p>
            {data.description && <p className="text-sm text-slate-600 mt-2">{data.description}</p>}
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-6">
          <div className="text-center p-3 bg-primary-light/30 rounded-lg">
            <p className="text-2xl font-bold text-primary-dark">{data.student_count}</p>
            <p className="text-xs text-slate-500">Students</p>
          </div>
          <div className="text-center p-3 bg-primary-light/30 rounded-lg">
            <p className="text-2xl font-bold text-primary-dark">{data.assignment_count}</p>
            <p className="text-xs text-slate-500">Assignments</p>
          </div>
          <div className="text-center p-3 bg-primary-light/30 rounded-lg">
            <p className="text-2xl font-bold text-primary-dark">{data.total_submissions}</p>
            <p className="text-xs text-slate-500">Submissions</p>
          </div>
          <div className="text-center p-3 bg-primary-light/30 rounded-lg">
            <p className="text-2xl font-bold text-primary-dark">{data.class_avg_score != null ? `${data.class_avg_score}%` : '—'}</p>
            <p className="text-xs text-slate-500">Avg Score</p>
          </div>
        </div>
      </div>

      {/* Students Table */}
      <div className="bg-white rounded-xl border border-primary-light p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-bold text-primary-dark">Enrolled Students</h3>
          <div className="flex items-center gap-2">
            <ArrowUpDown className="w-4 h-4 text-slate-400" />
            <select
              value={sortBy}
              onChange={(e) => { setSortBy(e.target.value); setPage(1); }}
              className="text-sm border border-slate-300 rounded-lg px-2 py-1 focus:outline-none focus:ring-2 focus:ring-primary/30"
            >
              <option value="name">Name</option>
              <option value="score">Score</option>
              <option value="submissions">Submissions</option>
            </select>
          </div>
        </div>

        {data.students?.length > 0 ? (
          <>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-primary-light">
                    <th className="text-left py-2 px-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Student</th>
                    <th className="text-center py-2 px-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Submissions</th>
                    <th className="text-center py-2 px-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Avg Score</th>
                    <th className="text-center py-2 px-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Completion</th>
                    <th className="text-right py-2 px-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Last Active</th>
                  </tr>
                </thead>
                <tbody>
                  {data.students.map((s) => (
                    <tr key={s.student_id} className="border-b border-slate-50 hover:bg-slate-50/50">
                      <td className="py-3 px-3">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-primary-light flex items-center justify-center text-primary font-bold text-xs">
                            {s.full_name?.charAt(0)?.toUpperCase()}
                          </div>
                          <div>
                            <p className="text-sm font-medium text-primary-dark">{s.full_name}</p>
                            <p className="text-xs text-slate-400">{s.email}</p>
                          </div>
                        </div>
                      </td>
                      <td className="py-3 px-3 text-center text-sm text-primary-dark">{s.total_submissions}</td>
                      <td className="py-3 px-3 text-center text-sm font-semibold text-primary-dark">
                        {s.avg_score != null ? `${s.avg_score}%` : '—'}
                      </td>
                      <td className="py-3 px-3 text-center">
                        <div className="flex items-center justify-center gap-2">
                          <div className="w-16 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                            <div
                              className="h-full bg-primary rounded-full"
                              style={{ width: `${Math.min(s.completion_percentage, 100)}%` }}
                            />
                          </div>
                          <span className="text-xs text-slate-500">{s.completion_percentage}%</span>
                        </div>
                      </td>
                      <td className="py-3 px-3 text-right text-xs text-slate-500">
                        {s.last_active ? new Date(s.last_active).toLocaleDateString() : 'Never'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {data.students_total_pages > 1 && (
              <div className="flex items-center justify-center gap-2 mt-4">
                <button
                  onClick={() => setPage(page - 1)}
                  disabled={page <= 1}
                  className="p-2 rounded-lg border border-slate-300 text-slate-600 hover:bg-slate-50 disabled:opacity-40"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <span className="text-sm text-slate-600">Page {page} of {data.students_total_pages}</span>
                <button
                  onClick={() => setPage(page + 1)}
                  disabled={page >= data.students_total_pages}
                  className="p-2 rounded-lg border border-slate-300 text-slate-600 hover:bg-slate-50 disabled:opacity-40"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            )}
          </>
        ) : (
          <div className="py-8 text-center">
            <p className="text-slate-500 text-sm">No students enrolled in this subject yet.</p>
          </div>
        )}
      </div>
    </div>
  );
}

export default function InstructorSubjects() {
  const { subjectId } = useParams();
  const navigate = useNavigate();
  const [subjects, setSubjects] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!subjectId) {
      setLoading(true);
      getSubjects()
        .then((res) => setSubjects(res.data || []))
        .catch(() => toast.error('Failed to load subjects'))
        .finally(() => setLoading(false));
    }
  }, [subjectId]);

  if (subjectId) {
    return <SubjectDetailView subjectId={subjectId} />;
  }

  return (
    <div>
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 rounded-lg bg-primary-light flex items-center justify-center">
          <BookOpen className="w-5 h-5 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-primary-dark">My Subjects</h1>
          <p className="text-sm text-slate-500">Subjects assigned to you with class details.</p>
        </div>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="bg-white rounded-xl border border-primary-light p-5 animate-pulse">
              <div className="w-10 h-10 bg-slate-200 rounded-lg mb-3" />
              <div className="h-4 w-3/4 bg-slate-200 rounded mb-2" />
              <div className="h-3 w-1/2 bg-slate-100 rounded mb-4" />
              <div className="h-3 w-full bg-slate-100 rounded" />
            </div>
          ))}
        </div>
      ) : subjects.length === 0 ? (
        <div className="bg-white border border-primary-light rounded-xl p-12 text-center">
          <BookOpen className="w-12 h-12 text-slate-300 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-primary-dark mb-2">No Subjects Assigned</h3>
          <p className="text-slate-500 text-sm">Contact your admin to get assigned to subjects.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {subjects.map((s) => (
            <SubjectCard
              key={s.subject_id}
              subject={s}
              onClick={() => navigate(`/instructor/subjects/${s.subject_id}`)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
