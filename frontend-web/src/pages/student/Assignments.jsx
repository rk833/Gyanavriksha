import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Calendar,
  Clock,
  Filter,
  Upload,
  CheckCircle,
  AlertCircle,
  Loader2,
  X,
  Image as ImageIcon,
  Camera,
  FileText,
} from 'lucide-react';
import toast from 'react-hot-toast';
import {
  getAssignments,
  getSubjects,
  uploadSubmission,
} from '../../services/studentService';

const STATUS_BADGE = {
  open: 'bg-green-100 text-green-700',
  closed: 'bg-red-100 text-red-700',
  submitted: 'bg-primary-light text-primary',
};

export default function StudentAssignments() {
  const navigate = useNavigate();
  const [assignments, setAssignments] = useState([]);
  const [subjects, setSubjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [subjectFilter, setSubjectFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);

  // Upload modal state
  const [uploadModal, setUploadModal] = useState(null);
  const [files, setFiles] = useState([]);
  const [uploading, setUploading] = useState(false);

  const fetchAssignments = () => {
    setLoading(true);
    const params = { page, per_page: 10 };
    if (subjectFilter) params.subject_id = subjectFilter;
    if (statusFilter !== 'all') params.status = statusFilter;

    getAssignments(params)
      .then((r) => {
        setAssignments(r.data.items || []);
        setTotalPages(r.data.total_pages || 0);
      })
      .catch(() => toast.error('Failed to load assignments'))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    getSubjects().then((r) => setSubjects(r.data || [])).catch(() => {});
  }, []);

  useEffect(() => {
    fetchAssignments();
  }, [page, subjectFilter, statusFilter]);

  const getStatus = (a) => {
    if (a.has_submitted) return 'submitted';
    if (a.due_date && new Date(a.due_date) < new Date()) return 'closed';
    return 'open';
  };

  const handleFileSelect = (e) => {
    const selected = Array.from(e.target.files || []);
    if (files.length + selected.length > 5) {
      toast.error('Maximum 5 files per submission');
      return;
    }
    setFiles((prev) => [...prev, ...selected]);
  };

  const removeFile = (idx) => setFiles((prev) => prev.filter((_, i) => i !== idx));

  const handleUpload = async () => {
    if (!files.length) {
      toast.error('Please select at least one image');
      return;
    }
    setUploading(true);
    try {
      await uploadSubmission(uploadModal.assignment_id, files);
      toast.success('Submission uploaded successfully!');
      setUploadModal(null);
      setFiles([]);
      fetchAssignments();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Upload failed');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-primary-dark">Assignments</h1>
          <p className="text-sm text-slate-500">View and submit your assignments</p>
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
          <option value="all">All Status</option>
          <option value="open">Open</option>
          <option value="closed">Closed</option>
        </select>
      </div>

      {/* Assignment list */}
      {loading ? (
        <div className="space-y-3">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="animate-pulse bg-white rounded-xl border border-primary-light p-5 h-20" />
          ))}
        </div>
      ) : assignments.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-xl border border-primary-light">
          <FileText className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <p className="text-slate-500">No assignments found</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-primary-light overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-slate-500 uppercase tracking-wider border-b border-primary-light bg-primary-50">
                <th className="px-5 py-3">Title</th>
                <th className="px-5 py-3 hidden md:table-cell">Subject</th>
                <th className="px-5 py-3 hidden lg:table-cell">Tags</th>
                <th className="px-5 py-3">Due Date</th>
                <th className="px-5 py-3">Status</th>
                <th className="px-5 py-3">Action</th>
              </tr>
            </thead>
            <tbody>
              {assignments.map((a) => {
                const st = getStatus(a);
                return (
                  <tr key={a.assignment_id} className="border-b border-slate-50 hover:bg-primary-50/30">
                    <td className="px-5 py-3.5">
                      <p className="font-medium text-primary-dark">{a.title}</p>
                      <p className="text-xs text-slate-400 md:hidden">{a.subject_name}</p>
                    </td>
                    <td className="px-5 py-3.5 text-slate-600 hidden md:table-cell">{a.subject_name}</td>
                    <td className="px-5 py-3.5 hidden lg:table-cell">
                      <div className="flex flex-wrap gap-1">
                        {a.topic_tags?.slice(0, 2).map((t, i) => (
                          <span key={i} className="text-xs bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded">{t}</span>
                        ))}
                      </div>
                    </td>
                    <td className="px-5 py-3.5 text-slate-600">
                      {a.due_date ? (
                        <span className="flex items-center gap-1">
                          <Calendar className="w-3.5 h-3.5" />
                          {new Date(a.due_date).toLocaleDateString()}
                        </span>
                      ) : '—'}
                    </td>
                    <td className="px-5 py-3.5">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_BADGE[st]}`}>
                        {st === 'submitted' ? 'Submitted' : st === 'open' ? 'Open' : 'Closed'}
                      </span>
                    </td>
                    <td className="px-5 py-3.5">
                      {st === 'open' ? (
                        <button
                          onClick={() => { setUploadModal(a); setFiles([]); }}
                          className="text-xs bg-primary-dark text-white px-3 py-1.5 rounded-lg hover:bg-primary transition-colors flex items-center gap-1"
                        >
                          <Upload className="w-3 h-3" />
                          Submit
                        </button>
                      ) : st === 'submitted' ? (
                        <button
                          onClick={() => navigate('/student/submissions')}
                          className="text-xs text-primary hover:underline"
                        >
                          View
                        </button>
                      ) : (
                        <span className="text-xs text-slate-400">Closed</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 mt-4">
          {[...Array(totalPages)].map((_, i) => (
            <button
              key={i}
              onClick={() => setPage(i + 1)}
              className={`w-8 h-8 rounded-lg text-sm font-medium transition-colors ${
                page === i + 1
                  ? 'bg-primary-dark text-white'
                  : 'bg-white border border-primary-light text-slate-600 hover:bg-primary-50'
              }`}
            >
              {i + 1}
            </button>
          ))}
        </div>
      )}

      {/* Upload modal */}
      {uploadModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40" onClick={() => !uploading && setUploadModal(null)} />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              {/* Header */}
              <div className="flex items-center justify-between mb-1">
                <h2 className="text-xl font-bold text-primary-dark">Submit Your Work</h2>
                <button
                  onClick={() => !uploading && setUploadModal(null)}
                  className="p-1 rounded-lg hover:bg-slate-100"
                >
                  <X className="w-5 h-5 text-slate-400" />
                </button>
              </div>
              <p className="text-sm text-slate-500 mb-5">
                Turn your handwritten notes into digital submissions. Our AI will automatically extract text and evaluate formatting.
              </p>

              {/* Assignment info */}
              <div className="grid grid-cols-2 gap-3 mb-5">
                <div>
                  <label className="text-xs text-slate-500 uppercase tracking-wider block mb-1">Subject</label>
                  <p className="text-sm font-medium text-primary-dark bg-primary-50 rounded-lg px-3 py-2 border border-primary-light">
                    {uploadModal.subject_name}
                  </p>
                </div>
                <div>
                  <label className="text-xs text-slate-500 uppercase tracking-wider block mb-1">Grade</label>
                  <p className="text-sm font-medium text-primary-dark bg-primary-50 rounded-lg px-3 py-2 border border-primary-light">
                    {uploadModal.grade_name}
                  </p>
                </div>
              </div>
              <div className="mb-5">
                <label className="text-xs text-slate-500 uppercase tracking-wider block mb-1">Assignment Title</label>
                <p className="text-sm font-medium text-primary-dark bg-primary-50 rounded-lg px-3 py-2 border border-primary-light">
                  {uploadModal.title}
                </p>
              </div>

              {/* Upload zone */}
              <label className="block border-2 border-dashed border-primary-light rounded-xl p-8 text-center hover:border-primary/40 hover:bg-primary-50 cursor-pointer transition-colors group mb-4">
                <input
                  type="file"
                  multiple
                  accept=".jpg,.jpeg,.png"
                  onChange={handleFileSelect}
                  className="hidden"
                />
                <Upload className="w-10 h-10 text-primary/40 group-hover:text-primary mx-auto mb-2 transition-colors" />
                <p className="text-sm text-slate-600 font-medium">Scan or Drop Work</p>
                <p className="text-xs text-slate-400 mt-1">
                  Take a photo or drag your files here. High resolution photos work best. Max 5 files, 10 MB each.
                </p>
                <div className="flex items-center justify-center gap-3 mt-4">
                  <span className="inline-flex items-center gap-1.5 bg-primary-dark text-white text-xs px-4 py-2 rounded-lg">
                    <ImageIcon className="w-3.5 h-3.5" />
                    Browse Files
                  </span>
                  <span className="inline-flex items-center gap-1.5 bg-white text-primary-dark border border-primary-light text-xs px-4 py-2 rounded-lg">
                    <Camera className="w-3.5 h-3.5" />
                    Open Camera
                  </span>
                </div>
                <p className="text-[10px] text-slate-400 mt-2">Supported formats: JPG, PNG. Max 10 MB per file.</p>
              </label>

              {/* File previews */}
              {files.length > 0 && (
                <div className="flex flex-wrap gap-2 mb-4">
                  {files.map((f, i) => (
                    <div key={i} className="relative group">
                      <div className="w-20 h-20 rounded-lg border border-primary-light overflow-hidden bg-slate-50">
                        <img
                          src={URL.createObjectURL(f)}
                          alt={f.name}
                          className="w-full h-full object-cover"
                        />
                      </div>
                      <button
                        onClick={() => removeFile(i)}
                        className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-red-500 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <X className="w-3 h-3" />
                      </button>
                      <p className="text-[10px] text-slate-400 truncate w-20 mt-0.5">{f.name}</p>
                    </div>
                  ))}
                </div>
              )}

              {/* Checklist */}
              <div className="bg-primary-50 rounded-lg p-4 mb-5">
                <p className="text-xs font-semibold text-primary-dark uppercase tracking-wider mb-2">Submission Checklist</p>
                <div className="space-y-1.5">
                  {['Image quality optimized', 'File size within 10MB limit', 'Aligned with NEB Curriculum'].map((item, i) => (
                    <div key={i} className="flex items-center gap-2 text-xs text-slate-600">
                      <CheckCircle className="w-3.5 h-3.5 text-green-500" />
                      <span>{item}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Actions */}
              <div className="flex items-center justify-between">
                <button
                  onClick={() => { setUploadModal(null); setFiles([]); }}
                  disabled={uploading}
                  className="text-sm text-slate-500 hover:text-slate-700"
                >
                  Cancel Submission
                </button>
                <button
                  onClick={handleUpload}
                  disabled={uploading || files.length === 0}
                  className="bg-primary-dark text-white px-6 py-2.5 rounded-lg text-sm font-semibold hover:bg-primary transition-colors disabled:opacity-50 flex items-center gap-2"
                >
                  {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                  Submit Assignment
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
