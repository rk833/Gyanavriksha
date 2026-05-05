import { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  Upload,
  FileText,
  Trash2,
  Search,
  Loader2,
  X,
  ChevronLeft,
  ChevronRight,
  File,
} from 'lucide-react';
import toast from 'react-hot-toast';
import {
  getKnowledgeBase,
  uploadDocument,
  deleteDocument,
  getSubjects,
} from '../../services/instructorService';

function UploadModal({ subjects, onClose, onUploaded }) {
  const [file, setFile] = useState(null);
  const [subjectId, setSubjectId] = useState('');
  const [docType, setDocType] = useState('curriculum_pdf');
  const [uploading, setUploading] = useState(false);

  const handleUpload = async (e) => {
    e.preventDefault();
    if (!file || !subjectId) return;
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('subject_id', subjectId);
      formData.append('doc_type', docType);
      await uploadDocument(formData);
      toast.success('Document uploaded');
      onUploaded();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Upload failed');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/30" onClick={onClose} />
      <div className="relative bg-white rounded-xl shadow-xl w-full max-w-md mx-4">
        <div className="flex items-center justify-between p-5 border-b border-primary-light">
          <h2 className="text-lg font-bold text-primary-dark">Upload Document</h2>
          <button onClick={onClose} className="p-1 rounded hover:bg-slate-100">
            <X className="w-5 h-5 text-slate-500" />
          </button>
        </div>

        <form onSubmit={handleUpload} className="p-5 space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Subject *</label>
            <select
              required
              value={subjectId}
              onChange={(e) => setSubjectId(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
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
            <label className="block text-sm font-medium text-slate-700 mb-1">Document Type *</label>
            <select
              value={docType}
              onChange={(e) => setDocType(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
            >
              <option value="curriculum_pdf">Curriculum PDF</option>
              <option value="instructor_note">Instructor Note</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">PDF File *</label>
            <div className="border-2 border-dashed border-slate-300 rounded-lg p-6 text-center hover:border-primary/50 transition">
              <input
                type="file"
                accept=".pdf"
                onChange={(e) => setFile(e.target.files?.[0] || null)}
                className="hidden"
                id="pdf-upload"
              />
              <label htmlFor="pdf-upload" className="cursor-pointer">
                {file ? (
                  <div className="flex items-center justify-center gap-2">
                    <File className="w-5 h-5 text-primary" />
                    <span className="text-sm text-primary-dark font-medium">{file.name}</span>
                    <span className="text-xs text-slate-400">({(file.size / 1024).toFixed(0)} KB)</span>
                  </div>
                ) : (
                  <>
                    <Upload className="w-8 h-8 text-slate-400 mx-auto mb-2" />
                    <p className="text-sm text-slate-500">Click to select PDF file</p>
                    <p className="text-xs text-slate-400 mt-1">Max 50MB</p>
                  </>
                )}
              </label>
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-lg transition">
              Cancel
            </button>
            <button
              type="submit"
              disabled={uploading || !file || !subjectId}
              className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg text-sm hover:bg-primary/90 transition disabled:opacity-50"
            >
              {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
              Upload
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function formatBytes(bytes) {
  if (!bytes) return '—';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function KnowledgeBasePage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [docs, setDocs] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [subjects, setSubjects] = useState([]);
  const [showUpload, setShowUpload] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);

  const page = Number(searchParams.get('page')) || 1;
  const subjectFilter = searchParams.get('subject_id') || '';
  const docTypeFilter = searchParams.get('doc_type') || '';
  const searchQuery = searchParams.get('search') || '';
  const perPage = 20;
  const totalPages = Math.ceil(total / perPage);

  const fetchDocs = useCallback(async () => {
    setLoading(true);
    try {
      const params = { page, per_page: perPage };
      if (subjectFilter) params.subject_id = Number(subjectFilter);
      if (docTypeFilter) params.doc_type = docTypeFilter;
      if (searchQuery) params.search = searchQuery;
      const res = await getKnowledgeBase(params);
      setDocs(res.data.items || []);
      setTotal(res.data.total || 0);
    } catch {
      toast.error('Failed to load documents');
    } finally {
      setLoading(false);
    }
  }, [page, subjectFilter, docTypeFilter, searchQuery]);

  useEffect(() => { fetchDocs(); }, [fetchDocs]);
  useEffect(() => { getSubjects().then((r) => setSubjects(r.data || [])).catch(() => {}); }, []);

  const handleDelete = async () => {
    if (!deleteTarget?.id) return;
    setDeleting(true);
    try {
      await deleteDocument(deleteTarget.id);
      toast.success('Document deleted');
      setDeleteTarget(null);
      fetchDocs();
    } catch {
      toast.error('Failed to delete');
    } finally {
      setDeleting(false);
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
            <Upload className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-primary-dark">Knowledge Base</h1>
            <p className="text-sm text-slate-500">Upload and manage curriculum documents.</p>
          </div>
        </div>
        <button
          onClick={() => setShowUpload(true)}
          className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg text-sm hover:bg-primary/90 transition"
        >
          <Upload className="w-4 h-4" /> Upload Document
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3 mb-6">
        <div className="relative flex-1 min-w-[200px] max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search by file name..."
            value={searchQuery}
            onChange={(e) => setFilter('search', e.target.value)}
            className="w-full pl-9 pr-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
          />
        </div>

        <select
          value={docTypeFilter}
          onChange={(e) => setFilter('doc_type', e.target.value)}
          className="px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
        >
          <option value="">All Types</option>
          <option value="curriculum_pdf">Curriculum PDF</option>
          <option value="instructor_note">Instructor Note</option>
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

        <span className="text-sm text-slate-500 ml-auto">{total} documents</span>
      </div>

      {/* Document List */}
      {loading ? (
        <div className="space-y-3">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="bg-white rounded-xl border border-primary-light p-5 animate-pulse flex items-center gap-4">
              <div className="w-10 h-10 bg-slate-200 rounded-lg" />
              <div className="flex-1">
                <div className="h-4 w-1/3 bg-slate-200 rounded mb-2" />
                <div className="h-3 w-1/4 bg-slate-100 rounded" />
              </div>
            </div>
          ))}
        </div>
      ) : docs.length === 0 ? (
        <div className="bg-white border border-primary-light rounded-xl p-12 text-center">
          <FileText className="w-12 h-12 text-slate-300 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-primary-dark mb-2">No Documents</h3>
          <p className="text-slate-500 text-sm mb-4">Upload your first document to build the knowledge base.</p>
          <button
            onClick={() => setShowUpload(true)}
            className="px-4 py-2 bg-primary text-white rounded-lg text-sm hover:bg-primary/90 transition"
          >
            <Upload className="w-4 h-4 inline mr-1" /> Upload Document
          </button>
        </div>
      ) : (
        <div className="space-y-2">
          {docs.map((doc) => (
            <div
              key={doc.doc_id}
              className="bg-white rounded-xl border border-primary-light p-4 flex items-center gap-4 hover:shadow-sm transition"
            >
              <div className="w-10 h-10 rounded-lg bg-red-50 flex items-center justify-center shrink-0">
                <FileText className="w-5 h-5 text-red-500" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-primary-dark truncate">{doc.file_name}</p>
                <p className="text-xs text-slate-500">
                  {doc.subject_name} &middot; {doc.grade_name} &middot; {formatBytes(doc.file_size_bytes)}
                </p>
              </div>
              <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                doc.doc_type === 'curriculum_pdf' ? 'bg-blue-100 text-blue-700' : 'bg-purple-100 text-purple-700'
              }`}>
                {doc.doc_type === 'curriculum_pdf' ? 'Curriculum' : 'Note'}
              </span>
              <span className="text-xs text-slate-400">{new Date(doc.created_at).toLocaleDateString()}</span>
              <button
                onClick={() => setDeleteTarget({ id: doc.doc_id, fileName: doc.file_name })}
                className="p-1.5 rounded-lg hover:bg-red-50 text-slate-400 hover:text-red-600 transition"
                title="Delete"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 mt-6">
          <button onClick={() => goToPage(page - 1)} disabled={page <= 1} className="p-2 rounded-lg border border-slate-300 text-slate-600 hover:bg-slate-50 disabled:opacity-40">
            <ChevronLeft className="w-4 h-4" />
          </button>
          <span className="text-sm text-slate-600">Page {page} of {totalPages}</span>
          <button onClick={() => goToPage(page + 1)} disabled={page >= totalPages} className="p-2 rounded-lg border border-slate-300 text-slate-600 hover:bg-slate-50 disabled:opacity-40">
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Upload Modal */}
      {showUpload && (
        <UploadModal
          subjects={subjects}
          onClose={() => setShowUpload(false)}
          onUploaded={() => { setShowUpload(false); fetchDocs(); }}
        />
      )}

      {/* Delete Confirmation Modal */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
          <div className="absolute inset-0 bg-black/40" onClick={() => !deleting && setDeleteTarget(null)} />
          <div className="relative w-full max-w-md rounded-2xl bg-white shadow-2xl border border-primary-light">
            <div className="p-5 border-b border-primary-light">
              <h3 className="text-lg font-bold text-primary-dark">Delete document?</h3>
              <p className="mt-1 text-sm text-slate-500">This action cannot be undone.</p>
            </div>
            <div className="p-5">
              <div className="rounded-lg bg-red-50 border border-red-100 p-3 text-sm text-red-800 break-words">
                {deleteTarget.fileName}
              </div>
            </div>
            <div className="p-5 pt-0 flex items-center justify-end gap-3">
              <button
                type="button"
                disabled={deleting}
                onClick={() => setDeleteTarget(null)}
                className="px-4 py-2 rounded-lg text-sm text-slate-700 hover:bg-slate-100 transition disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={deleting}
                onClick={handleDelete}
                className="px-4 py-2 rounded-lg text-sm bg-red-600 text-white hover:bg-red-700 transition disabled:opacity-50"
              >
                {deleting ? (
                  <span className="inline-flex items-center gap-2">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Deleting...
                  </span>
                ) : (
                  'Delete'
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
