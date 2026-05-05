import { useState, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Upload, CloudUpload, FileText, Folder, FolderOpen, ChevronRight,
  CheckCircle2, RefreshCw, X, Loader2, Activity, Library, Trash2, RotateCcw, Clock3,
} from 'lucide-react';
import toast from 'react-hot-toast';
import {
  uploadCurriculum, getIngestionJobs, getNamespaces, getGrades, getSubjects, cancelIngestionJob,
  getCurriculumDocs, deleteCurriculumDoc, requeueCurriculumDoc,
} from '../../services/adminService';

const STATUS_STYLE = {
  PROCESSING: 'bg-blue-100 text-blue-700',
  DONE: 'bg-green-100 text-green-700',
  PENDING: 'bg-yellow-100 text-yellow-700',
  FAILED: 'bg-red-100 text-red-700',
  CANCELLED: 'bg-slate-100 text-slate-500',
};

const STEPS = [
  { n: 1, label: 'Upload PDF' },
  { n: 2, label: 'Select Namespace' },
  { n: 3, label: 'Embed' },
  { n: 4, label: 'Confirm' },
];

function StepperProgress({ active }) {
  return (
    <div className="flex items-center gap-0 mb-6">
      {STEPS.map((s, i) => (
        <div key={s.n} className="flex items-center flex-1">
          <div className="flex flex-col items-center">
            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold border-2 transition-colors ${s.n <= active ? 'bg-primary-dark border-primary-dark text-white' : 'border-slate-300 text-slate-400'}`}>
              {s.n < active ? <CheckCircle2 className="w-4 h-4" /> : s.n}
            </div>
            <span className={`text-xs mt-1 font-semibold uppercase tracking-wider ${s.n <= active ? 'text-primary-dark' : 'text-slate-400'}`}>{s.label}</span>
          </div>
          {i < STEPS.length - 1 && (
            <div className={`flex-1 h-0.5 mb-4 mx-2 ${s.n < active ? 'bg-primary' : 'bg-slate-200'}`} />
          )}
        </div>
      ))}
    </div>
  );
}

function DropZone({ onFileSelect, selectedFile, onClear }) {
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef();

  const handleDrop = (e) => {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files[0];
    if (file && (file.name.toLowerCase().endsWith('.pdf') || file.name.toLowerCase().endsWith('.docx'))) {
      onFileSelect(file);
    } else {
      toast.error('Only PDF and DOCX files are supported');
    }
  };

  return (
    <div
      onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
      onDragLeave={() => setDragging(false)}
      onDrop={handleDrop}
      className={`border-2 border-dashed rounded-xl p-10 text-center transition-colors ${dragging ? 'border-primary bg-primary-light/30' : 'border-slate-300 bg-white'}`}
    >
      {selectedFile ? (
        <div className="flex items-center justify-center gap-3">
          <FileText className="w-8 h-8 text-primary" />
          <div className="text-left">
            <p className="text-sm font-semibold text-primary-dark">{selectedFile.name}</p>
            <p className="text-xs text-slate-400">{(selectedFile.size / 1024 / 1024).toFixed(2)} MB</p>
          </div>
          <button onClick={onClear} className="ml-2 text-slate-400 hover:text-red-500">
            <X className="w-5 h-5" />
          </button>
        </div>
      ) : (
        <>
          <CloudUpload className="w-12 h-12 mx-auto text-slate-300 mb-3" />
          <p className="font-semibold text-slate-700">Drop curriculum files here</p>
          <p className="text-sm text-slate-400 mt-1">PDF, DOCX up to 50MB supported</p>
          <input
            type="file"
            accept=".pdf,.docx"
            hidden
            ref={inputRef}
            onChange={(e) => onFileSelect(e.target.files[0])}
          />
          <button
            onClick={() => inputRef.current.click()}
            className="mt-4 px-5 py-2 bg-primary-dark text-white rounded-full text-sm font-semibold hover:bg-primary transition-colors"
          >
            Select Files
          </button>
        </>
      )}
    </div>
  );
}

function NamespaceSelector({ grades, gradeId, setGradeId, subjectId, setSubjectId }) {
  const { data: subjects = [] } = useQuery({
    queryKey: ['admin', 'subjects', gradeId],
    queryFn: async () => (await getSubjects({ grade_id: gradeId })).data ?? [],
    enabled: !!gradeId,
  });

  return (
    <div className="bg-white rounded-xl border border-primary-light p-4">
      <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3 flex items-center gap-1.5">
        <Folder className="w-3.5 h-3.5" /> Namespace Selector
      </p>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-semibold text-slate-600 mb-1">Grade Level</label>
          <select
            value={gradeId}
            onChange={(e) => { setGradeId(e.target.value); setSubjectId(''); }}
            className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
          >
            <option value="">Select Grade</option>
            {grades.map((g) => <option key={g.grade_id} value={g.grade_id}>{g.grade_name}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs font-semibold text-slate-600 mb-1">Subject Area</label>
          <select
            value={subjectId}
            onChange={(e) => setSubjectId(e.target.value)}
            disabled={!gradeId}
            className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 disabled:opacity-50"
          >
            <option value="">Select Subject</option>
            {subjects.map((s) => <option key={s.subject_id} value={s.subject_id}>{s.name}</option>)}
          </select>
        </div>
      </div>
    </div>
  );
}

function EmbeddingSettings({ chunkSize, setChunkSize }) {
  return (
    <div className="bg-white rounded-xl border border-primary-light p-4">
      <div className="flex items-center justify-between mb-3">
        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Embedding Settings</p>
        <button onClick={() => setChunkSize(512)} className="text-xs text-primary font-semibold hover:underline">Reset</button>
      </div>
      <div className="flex items-center justify-between text-xs text-slate-500 mb-1">
        <span>Chunk Size</span>
        <span className="font-semibold text-primary-dark">{chunkSize} Tokens</span>
      </div>
      <div className="flex items-center gap-2">
        <span className="text-xs text-slate-400">206</span>
        <input
          type="range" min={206} max={1024} step={1}
          value={chunkSize}
          onChange={(e) => setChunkSize(parseInt(e.target.value))}
          className="flex-1 accent-primary"
        />
        <span className="text-xs text-slate-400">1024</span>
      </div>
    </div>
  );
}

function JobStatusBadge({ status }) {
  const normalized = String(status || '').toUpperCase();
  const cls = STATUS_STYLE[normalized] ?? 'bg-slate-100 text-slate-500';
  return <span className={`text-xs font-semibold px-2 py-0.5 rounded ${cls} uppercase`}>{normalized || 'UNKNOWN'}</span>;
}

function JobsTable({
  jobs, totalCount, page, perPage, onPageChange, onCancel, onRequeue, onDelete, refetching, onRefetch,
}) {
  const [statusFilter, setStatusFilter] = useState('');
  const [confirmDeleteJob, setConfirmDeleteJob] = useState(null);

  const filtered = statusFilter
    ? jobs.filter((j) => String(j.status || '').toUpperCase() === statusFilter)
    : jobs;
  const totalPages = Math.max(1, Math.ceil((totalCount || 0) / perPage));

  return (
    <div className="bg-white rounded-xl border border-primary-light shadow-sm overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b border-primary-light">
        <div className="flex items-center gap-3">
          <p className="text-xs font-semibold text-slate-600 uppercase tracking-wider">Ingestion Jobs</p>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="border border-slate-200 rounded-lg px-2.5 py-1 text-xs text-slate-600 focus:outline-none focus:ring-2 focus:ring-primary/30"
          >
            <option value="">All Statuses</option>
            <option value="PENDING">Pending</option>
            <option value="PROCESSING">Processing</option>
            <option value="DONE">Done</option>
            <option value="FAILED">Failed</option>
            <option value="CANCELLED">Cancelled</option>
          </select>
        </div>
        <button onClick={onRefetch} className="flex items-center gap-1 text-xs text-primary font-semibold hover:underline">
          <RefreshCw className={`w-3 h-3 ${refetching ? 'animate-spin' : ''}`} /> Refresh
        </button>
      </div>

      <div className="bg-primary-light/20 px-4 py-2 border-b border-primary-light/40 text-xs text-slate-500 flex items-center gap-1.5">
        <RefreshCw className="w-3 h-3 text-primary" />
        Status transitions (PENDING → PROCESSING → DONE) are handled automatically by the backend pipeline.
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-100 bg-slate-50">
              {['Filename', 'Grade / Subject', 'Status', 'Timestamp', 'Actions'].map((h) => (
                <th key={h} className="text-left text-xs font-semibold text-slate-400 uppercase tracking-wider px-4 py-2">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {filtered.length === 0 && (
              <tr><td colSpan={5} className="text-center py-8 text-slate-400 text-sm">No matching jobs</td></tr>
            )}
            {filtered.map((j) => (
              <tr key={j.job_id} className="hover:bg-slate-50/60">
                <td className="px-4 py-2.5">
                  <div className="flex items-center gap-2">
                    <FileText className="w-4 h-4 text-slate-400 shrink-0" />
                    <span className="font-medium text-slate-700 truncate max-w-[160px]">{j.filename}</span>
                  </div>
                  {String(j.status || '').toUpperCase() === 'PROCESSING' && (
                    <div className="mt-1 h-1 w-full max-w-[160px] ml-6 bg-slate-100 rounded-full overflow-hidden">
                      <div className="h-full bg-blue-400 rounded-full animate-pulse" style={{ width: `${j.progress_pct ?? 50}%` }} />
                    </div>
                  )}
                </td>
                <td className="px-4 py-2.5 text-xs text-slate-500">{j.grade_subject ?? '—'}</td>
                <td className="px-4 py-2.5"><JobStatusBadge status={j.status} /></td>
                <td className="px-4 py-2.5 text-xs text-slate-400 whitespace-nowrap">
                  {j.created_at ? new Date(j.created_at).toLocaleString() : '—'}
                </td>
                <td className="px-4 py-2.5">
                  <div className="flex items-center gap-2 flex-wrap">
                    {['PENDING', 'PROCESSING'].includes(String(j.status || '').toUpperCase()) && (
                      <button
                        onClick={() => onCancel(j.job_id)}
                        className="flex items-center gap-1 text-xs font-semibold text-red-500 hover:text-red-700 bg-red-50 hover:bg-red-100 px-2.5 py-1 rounded-lg transition-colors"
                      >
                        <X className="w-3 h-3" /> Cancel
                      </button>
                    )}
                    {['FAILED', 'CANCELLED', 'DONE'].includes(String(j.status || '').toUpperCase()) && (
                      <button
                        onClick={() => onRequeue(j.job_id)}
                        className="flex items-center gap-1 text-xs font-semibold text-primary hover:text-primary-dark bg-primary-light/50 hover:bg-primary-light px-2.5 py-1 rounded-lg transition-colors"
                      >
                        <RotateCcw className="w-3 h-3" /> Requeue
                      </button>
                    )}
                    <button
                      onClick={() => setConfirmDeleteJob(j)}
                      className="flex items-center gap-1 text-xs font-semibold text-slate-400 hover:text-red-500 hover:bg-red-50 px-2.5 py-1 rounded-lg transition-colors"
                      title="Delete this job record"
                    >
                      <Trash2 className="w-3 h-3" /> Delete
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-between px-4 py-3 border-t border-slate-100">
          <p className="text-xs text-slate-500">
            Showing {(page - 1) * perPage + 1}-{Math.min(page * perPage, totalCount)} of {totalCount}
          </p>
          <div className="flex items-center gap-2">
            <button
              onClick={() => onPageChange(Math.max(1, page - 1))}
              disabled={page === 1}
              className="px-3 py-1.5 text-xs font-semibold border border-slate-200 rounded-lg disabled:opacity-40 hover:bg-slate-50"
            >
              Prev
            </button>
            <span className="text-xs text-slate-500">Page {page} / {totalPages}</span>
            <button
              onClick={() => onPageChange(Math.min(totalPages, page + 1))}
              disabled={page >= totalPages}
              className="px-3 py-1.5 text-xs font-semibold border border-slate-200 rounded-lg disabled:opacity-40 hover:bg-slate-50"
            >
              Next
            </button>
          </div>
        </div>
      )}

      {confirmDeleteJob && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-sm mx-4">
            <div className="flex items-start gap-3 mb-4">
              <Trash2 className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
              <div>
                <h2 className="font-bold text-primary-dark">Delete Job Record</h2>
                <p className="text-sm text-slate-500 mt-1">
                  Delete <span className="font-semibold">{confirmDeleteJob.filename}</span>? This removes the file record and its vector embeddings permanently.
                </p>
              </div>
            </div>
            <div className="flex gap-3">
              <button onClick={() => setConfirmDeleteJob(null)} className="flex-1 border border-slate-200 text-slate-600 rounded-lg py-2 text-sm font-semibold hover:bg-slate-50">
                Cancel
              </button>
              <button
                onClick={() => { onDelete(confirmDeleteJob.job_id); setConfirmDeleteJob(null); }}
                className="flex-1 bg-red-600 text-white rounded-lg py-2 text-sm font-semibold hover:bg-red-700"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function ChromaNamespacePanel({ namespaces }) {
  const [open, setOpen] = useState(true);
  const [expanded, setExpanded] = useState({});

  const toggle = (level) => setExpanded((s) => ({ ...s, [level]: !s[level] }));

  return (
    <div className="bg-white rounded-xl border border-primary-light shadow-sm">
      <div className="flex items-center justify-between px-4 py-3 border-b border-primary-light">
        <p className="text-xs font-semibold text-slate-600 uppercase tracking-wider">ChromaDB Namespaces</p>
        <button onClick={() => setOpen(!open)} className="w-8 h-5 rounded bg-primary-dark relative cursor-pointer">
          <span className={`absolute top-0.5 w-4 h-4 bg-white rounded transition-all ${open ? 'left-3.5' : 'left-0.5'}`} />
        </button>
      </div>
      {open && (
        <div className="p-3 space-y-1 max-h-64 overflow-y-auto">
          {namespaces.map((g) => (
            <div key={g.grade_level}>
              <button
                onClick={() => toggle(g.grade_level)}
                className="flex items-center gap-2 w-full py-1.5 px-2 rounded-lg hover:bg-slate-50 text-xs font-semibold text-slate-700"
              >
                {expanded[g.grade_level] ? <FolderOpen className="w-3.5 h-3.5 text-primary" /> : <Folder className="w-3.5 h-3.5 text-slate-400" />}
                <span>{g.grade_name}</span>
                <ChevronRight className={`w-3 h-3 ml-auto text-slate-400 transition-transform ${expanded[g.grade_level] ? 'rotate-90' : ''}`} />
              </button>
              {expanded[g.grade_level] && g.namespaces.map((ns) => (
                <div key={ns.name} className="ml-6 flex items-center gap-2 py-1 px-2 text-xs text-slate-500">
                  <FileText className="w-3 h-3 shrink-0" />
                  <span className="flex-1 truncate">{ns.name}</span>
                  <span className="text-primary font-medium">{ns.chunk_count?.toLocaleString() ?? 0} chunks</span>
                </div>
              ))}
            </div>
          ))}
          {namespaces.length === 0 && <p className="text-xs text-slate-400 text-center py-4">No namespaces</p>}
        </div>
      )}
    </div>
  );
}

function PipelineActivityLog({ jobs }) {
  const [page, setPage] = useState(1);
  const perPage = 5;
  const totalPages = Math.max(1, Math.ceil((jobs?.length || 0) / perPage));
  const startIdx = (page - 1) * perPage;
  const pageJobs = (jobs || []).slice(startIdx, startIdx + perPage);
  const events = pageJobs.map((j) => ({
    text: `${j.filename} — ${j.status}`,
    sub: j.grade_subject || '',
    time: j.created_at ? new Date(j.created_at).toLocaleTimeString() : '—',
  }));

  return (
    <div className="bg-white rounded-xl border border-primary-light shadow-sm p-4">
      <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3 flex items-center gap-1.5">
        <Activity className="w-3.5 h-3.5" /> Pipeline Activity
      </p>
      {events.length === 0 && <p className="text-xs text-slate-400">No recent activity</p>}
      <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
        {events.map((e, i) => (
          <div key={i} className="flex items-start gap-2">
            <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-primary shrink-0" />
            <div className="flex-1">
              <p className="text-xs font-medium text-slate-700">{e.text}</p>
              <p className="text-xs text-slate-400">{e.sub} · {e.time}</p>
            </div>
          </div>
        ))}
      </div>
      {totalPages > 1 && (
        <div className="mt-3 pt-3 border-t border-slate-100 flex items-center justify-between">
          <span className="text-xs text-slate-500">Page {page} / {totalPages}</span>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              className="px-2.5 py-1 text-xs font-semibold border border-slate-200 rounded-lg disabled:opacity-40 hover:bg-slate-50"
            >
              Prev
            </button>
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages}
              className="px-2.5 py-1 text-xs font-semibold border border-slate-200 rounded-lg disabled:opacity-40 hover:bg-slate-50"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

const DOC_STATUS_STYLE = {
  DONE: 'bg-green-100 text-green-700',
  PROCESSING: 'bg-blue-100 text-blue-700',
  PENDING: 'bg-yellow-100 text-yellow-700',
  FAILED: 'bg-red-100 text-red-700',
  CANCELLED: 'bg-slate-100 text-slate-500',
};

function DocumentLibrary() {
  const queryClient = useQueryClient();
  const [gradeFilter, setGradeFilter] = useState('');
  const [subjectFilter, setSubjectFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const perPage = 10;
  const [confirmDelete, setConfirmDelete] = useState(null);

  const { data: grades = [] } = useQuery({
    queryKey: ['admin', 'grades'],
    queryFn: async () => (await getGrades()).data ?? [],
  });

  const { data: subjects = [] } = useQuery({
    queryKey: ['admin', 'subjects', 'doc-library', gradeFilter],
    queryFn: async () => (await getSubjects({ grade_id: gradeFilter })).data ?? [],
    enabled: !!gradeFilter,
  });

  const { data: docsData, isLoading } = useQuery({
    queryKey: ['admin', 'curriculum-docs', gradeFilter, subjectFilter, statusFilter, search, page, perPage],
    queryFn: async () => {
      const params = { per_page: perPage, page };
      if (gradeFilter) params.grade_id = gradeFilter;
      if (subjectFilter) params.subject_id = subjectFilter;
      if (statusFilter) params.doc_status = statusFilter;
      if (search.trim()) params.search = search.trim();
      return (await getCurriculumDocs(params)).data;
    },
  });

  const docs = docsData?.documents ?? [];
  const totalCount = docsData?.total_count ?? 0;
  const totalPages = Math.max(1, Math.ceil(totalCount / perPage));

  const deleteMutation = useMutation({
    mutationFn: (id) => deleteCurriculumDoc(id),
    onSuccess: () => {
      toast.success('Document deleted');
      setConfirmDelete(null);
      queryClient.invalidateQueries({ queryKey: ['admin', 'curriculum-docs'] });
    },
    onError: () => toast.error('Failed to delete document'),
  });

  const requeueMutation = useMutation({
    mutationFn: (id) => requeueCurriculumDoc(id),
    onSuccess: () => {
      toast.success('Document re-queued for embedding');
      queryClient.invalidateQueries({ queryKey: ['admin', 'curriculum-docs'] });
      queryClient.invalidateQueries({ queryKey: ['admin', 'ingestion-jobs'] });
    },
    onError: () => toast.error('Failed to requeue document'),
  });

  const onGradeChange = (value) => {
    setGradeFilter(value);
    setSubjectFilter('');
    setPage(1);
  };

  return (
    <div className="mt-8">
      <div className="bg-white rounded-xl border border-primary-light shadow-sm overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-primary-light">
          <div className="flex items-center gap-2 font-semibold text-primary-dark">
            <Library className="w-4 h-4 text-primary" />
            Document Library
            {docs.length > 0 && <span className="text-xs font-normal text-slate-400">({docs.length})</span>}
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <input
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              placeholder="Search file name..."
              className="border border-slate-200 rounded-lg px-3 py-1.5 text-xs text-slate-600 focus:outline-none focus:ring-2 focus:ring-primary/30"
            />
            <select
              value={gradeFilter}
              onChange={(e) => onGradeChange(e.target.value)}
              className="border border-slate-200 rounded-lg px-3 py-1.5 text-xs text-slate-600 focus:outline-none focus:ring-2 focus:ring-primary/30"
            >
              <option value="">All Grades</option>
              {grades.map((g) => <option key={g.grade_id} value={g.grade_id}>{g.grade_name}</option>)}
            </select>
            <select
              value={subjectFilter}
              onChange={(e) => { setSubjectFilter(e.target.value); setPage(1); }}
              disabled={!gradeFilter}
              className="border border-slate-200 rounded-lg px-3 py-1.5 text-xs text-slate-600 focus:outline-none focus:ring-2 focus:ring-primary/30 disabled:opacity-50"
            >
              <option value="">All Subjects</option>
              {subjects.map((s) => <option key={s.subject_id} value={s.subject_id}>{s.name}</option>)}
            </select>
            <select
              value={statusFilter}
              onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
              className="border border-slate-200 rounded-lg px-3 py-1.5 text-xs text-slate-600 focus:outline-none focus:ring-2 focus:ring-primary/30"
            >
              <option value="">All Statuses</option>
              <option value="PENDING">Pending</option>
              <option value="PROCESSING">Processing</option>
              <option value="DONE">Done</option>
              <option value="FAILED">Failed</option>
            </select>
          </div>
        </div>

        {isLoading ? (
          <div className="flex justify-center py-10"><Loader2 className="w-5 h-5 text-primary animate-spin" /></div>
        ) : docs.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-slate-400">
            <Library className="w-8 h-8 mb-2 opacity-30" />
            <p className="text-sm">No curriculum documents yet</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50">
                  {['File Name', 'Grade / Subject', 'Type', 'Status', 'Uploaded', 'Actions'].map((h) => (
                    <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {docs.map((d) => (
                  <tr key={d.doc_id} className="hover:bg-slate-50/60">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <FileText className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                        <span className="font-medium text-primary-dark text-xs truncate max-w-xs">{d.file_name ?? d.doc_id}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-slate-500 text-xs">{[d.grade_name, d.subject_name].filter(Boolean).join(' / ') || '—'}</td>
                    <td className="px-4 py-3">
                      <span className="text-xs font-mono bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded">{d.doc_type ?? '—'}</span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${DOC_STATUS_STYLE[String(d.embedding_status || '').toUpperCase()] ?? 'bg-slate-100 text-slate-600'}`}>
                        {String(d.embedding_status || '—').toUpperCase()}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-400 text-xs">
                      {d.created_at ? new Date(d.created_at).toLocaleDateString() : '—'}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2 flex-wrap">
                        <button
                          onClick={() => requeueMutation.mutate(d.doc_id)}
                          disabled={requeueMutation.isPending}
                          className="flex items-center gap-1 text-xs font-semibold text-primary hover:text-primary-dark bg-primary-light/50 hover:bg-primary-light px-2.5 py-1 rounded-lg transition-colors disabled:opacity-40"
                        >
                          <RotateCcw className="w-3 h-3" /> Requeue
                        </button>
                        <button
                          onClick={() => setConfirmDelete(d)}
                          className="flex items-center gap-1 text-xs font-semibold text-red-500 hover:text-red-700 bg-red-50 hover:bg-red-100 px-2.5 py-1 rounded-lg transition-colors"
                        >
                          <Trash2 className="w-3 h-3" /> Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {!isLoading && totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-slate-100">
            <p className="text-xs text-slate-500">
              Showing {(page - 1) * perPage + 1}-{Math.min(page * perPage, totalCount)} of {totalCount}
            </p>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="px-3 py-1.5 text-xs font-semibold border border-slate-200 rounded-lg disabled:opacity-40 hover:bg-slate-50"
              >
                Prev
              </button>
              <span className="text-xs text-slate-500">Page {page} / {totalPages}</span>
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages}
                className="px-3 py-1.5 text-xs font-semibold border border-slate-200 rounded-lg disabled:opacity-40 hover:bg-slate-50"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>

      {confirmDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-sm mx-4">
            <div className="flex items-start gap-3 mb-4">
              <Trash2 className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
              <div>
                <h2 className="font-bold text-primary-dark">Delete Document</h2>
                <p className="text-sm text-slate-500 mt-1">
                  Delete <span className="font-semibold">{confirmDelete.file_name}</span>? This removes the file and its vector embeddings.
                </p>
              </div>
            </div>
            <div className="flex gap-3">
              <button onClick={() => setConfirmDelete(null)} className="flex-1 border border-slate-200 text-slate-600 rounded-lg py-2 text-sm font-semibold hover:bg-slate-50">
                Cancel
              </button>
              <button
                onClick={() => deleteMutation.mutate(confirmDelete.doc_id)}
                disabled={deleteMutation.isPending}
                className="flex-1 bg-red-600 text-white rounded-lg py-2 text-sm font-semibold hover:bg-red-700 disabled:opacity-60 flex items-center justify-center gap-2"
              >
                {deleteMutation.isPending && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function CurriculumUpload() {
  const [selectedFile, setSelectedFile] = useState(null);
  const [gradeId, setGradeId] = useState('');
  const [subjectId, setSubjectId] = useState('');
  const [chunkSize, setChunkSize] = useState(512);
  const [activeStep, setActiveStep] = useState(1);
  const [jobsPage, setJobsPage] = useState(1);
  const jobsPerPage = 8;
  const queryClient = useQueryClient();

  const { data: grades = [] } = useQuery({
    queryKey: ['admin', 'grades'],
    queryFn: async () => (await getGrades()).data ?? [],
  });

  const { data: namespaces = [], isFetching: nsLoading } = useQuery({
    queryKey: ['admin', 'namespaces'],
    queryFn: async () => (await getNamespaces()).data ?? [],
  });

  const { data: jobsData, isFetching: jobsFetching, refetch: refetchJobs } = useQuery({
    queryKey: ['admin', 'ingestion-jobs', jobsPage, jobsPerPage],
    queryFn: async () => (await getIngestionJobs({ page: jobsPage, per_page: jobsPerPage })).data,
    refetchInterval: 10000,
  });

  const uploadMutation = useMutation({
    mutationFn: (formData) => uploadCurriculum(formData),
    onSuccess: () => {
      toast.success('File uploaded and queued for embedding');
      setSelectedFile(null);
      setGradeId('');
      setSubjectId('');
      setActiveStep(1);
      refetchJobs();
      queryClient.invalidateQueries({ queryKey: ['admin', 'namespaces'] });
    },
    onError: (err) => toast.error(err?.response?.data?.detail ?? 'Upload failed'),
  });

  const cancelMutation = useMutation({
    mutationFn: (id) => cancelIngestionJob(id),
    onSuccess: () => { toast.success('Job cancelled'); refetchJobs(); },
    onError: () => toast.error('Cancel failed'),
  });

  const requeueJobMutation = useMutation({
    mutationFn: (id) => requeueCurriculumDoc(id),
    onSuccess: () => { toast.success('Job re-queued for embedding'); refetchJobs(); },
    onError: () => toast.error('Re-queue failed'),
  });

  const deleteJobMutation = useMutation({
    mutationFn: (id) => deleteCurriculumDoc(id),
    onSuccess: () => { toast.success('Job record deleted'); refetchJobs(); },
    onError: () => toast.error('Delete failed'),
  });

  const handleFileSelect = (file) => {
    setSelectedFile(file);
    setActiveStep(2);
  };

  const handleUpload = () => {
    if (!selectedFile || !gradeId || !subjectId) {
      toast.error('Please select a file, grade and subject');
      return;
    }
    const formData = new FormData();
    formData.append('file', selectedFile);
    formData.append('grade_id', gradeId);
    formData.append('subject_id', subjectId);
    formData.append('chunk_size', String(chunkSize));
    setActiveStep(3);
    uploadMutation.mutate(formData);
  };

  const jobs = jobsData?.jobs ?? [];
  const jobsTotalCount = jobsData?.total_count ?? 0;
  const processingJobs = jobs.filter((j) => String(j.status || '').toUpperCase() === 'PROCESSING');
  const pendingJobs = jobs.filter((j) => String(j.status || '').toUpperCase() === 'PENDING');
  const doneJobs = jobs.filter((j) => String(j.status || '').toUpperCase() === 'DONE');
  const failedJobs = jobs.filter((j) => String(j.status || '').toUpperCase() === 'FAILED');
  const avgProgress = processingJobs.length
    ? Math.round(processingJobs.reduce((sum, j) => sum + (j.progress_pct ?? 50), 0) / processingJobs.length)
    : pendingJobs.length
      ? 15
      : doneJobs.length
        ? 100
        : 0;
  const previewLabel = processingJobs.length
    ? `${processingJobs.length} processing, ${pendingJobs.length} pending`
    : pendingJobs.length
      ? `${pendingJobs.length} queued for processing`
      : failedJobs.length
        ? `${failedJobs.length} failed job${failedJobs.length > 1 ? 's' : ''} need attention`
        : doneJobs.length
          ? 'All visible jobs completed'
          : 'No active ingestion jobs';
  const previewToneClass = processingJobs.length || pendingJobs.length
    ? 'text-blue-100'
    : failedJobs.length
      ? 'text-red-200'
      : doneJobs.length
        ? 'text-green-200'
        : 'text-primary-light/80';

  return (
    <div>
      <div className="mb-4">
        <h1 className="text-2xl font-bold text-primary-dark">Curriculum Ingestion Pipeline</h1>
        <p className="text-sm text-slate-500 mt-0.5">Automated vector processing for academic content</p>
      </div>

      <StepperProgress active={activeStep} />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-4">
          <DropZone
            selectedFile={selectedFile}
            onFileSelect={handleFileSelect}
            onClear={() => { setSelectedFile(null); setActiveStep(1); }}
          />

          <NamespaceSelector
            grades={grades}
            gradeId={gradeId}
            setGradeId={setGradeId}
            subjectId={subjectId}
            setSubjectId={setSubjectId}
          />

          <EmbeddingSettings chunkSize={chunkSize} setChunkSize={setChunkSize} />

          <div className="flex justify-end">
            <button
              onClick={handleUpload}
              disabled={!selectedFile || !gradeId || !subjectId || uploadMutation.isPending}
              className="flex items-center gap-2 bg-primary-dark text-white text-sm font-semibold px-6 py-2.5 rounded-lg hover:bg-primary disabled:opacity-50 transition-colors"
            >
              {uploadMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
              Upload &amp; Queue
            </button>
          </div>

          <JobsTable
            jobs={jobs}
            totalCount={jobsTotalCount}
            page={jobsPage}
            perPage={jobsPerPage}
            onPageChange={setJobsPage}
            onCancel={(id) => cancelMutation.mutate(id)}
            onRequeue={(id) => requeueJobMutation.mutate(id)}
            onDelete={(id) => deleteJobMutation.mutate(id)}
            refetching={jobsFetching}
            onRefetch={refetchJobs}
          />
        </div>

        <div className="space-y-4">
          <ChromaNamespacePanel namespaces={namespaces} />

          <div className="bg-primary-dark rounded-xl p-4">
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs font-semibold text-primary-light uppercase tracking-wider">Processing Preview</p>
              <span className="text-xs font-semibold text-white bg-white/15 px-2 py-0.5 rounded-full">
                {avgProgress}%
              </span>
            </div>
            <p className={`text-xs mb-3 flex items-center gap-1.5 ${previewToneClass}`}>
              <Clock3 className="w-3.5 h-3.5" />
              {previewLabel}
            </p>
            <div className="grid grid-cols-3 gap-2 mb-3">
              <div className="bg-white/10 rounded-lg px-2 py-1.5">
                <p className="text-[10px] text-primary-light/70 uppercase">Pending</p>
                <p className="text-sm font-semibold text-white">{pendingJobs.length}</p>
              </div>
              <div className="bg-white/10 rounded-lg px-2 py-1.5">
                <p className="text-[10px] text-primary-light/70 uppercase">Processing</p>
                <p className="text-sm font-semibold text-white">{processingJobs.length}</p>
              </div>
              <div className="bg-white/10 rounded-lg px-2 py-1.5">
                <p className="text-[10px] text-primary-light/70 uppercase">Done</p>
                <p className="text-sm font-semibold text-white">{doneJobs.length}</p>
              </div>
            </div>
            <div className="bg-white/10 rounded-lg h-16 flex items-end px-3 pb-3">
              <div className="w-full bg-white/20 rounded-full h-2">
                <div className="bg-primary-light h-2 rounded-full transition-all duration-500" style={{ width: `${avgProgress}%` }} />
              </div>
            </div>
          </div>

          <PipelineActivityLog jobs={jobs} />
        </div>
      </div>

      <DocumentLibrary />
    </div>
  );
}
