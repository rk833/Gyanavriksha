import { useState, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Upload, CloudUpload, FileText, Folder, FolderOpen, ChevronRight,
  CheckCircle2, RefreshCw, X, Loader2, Activity,
} from 'lucide-react';
import toast from 'react-hot-toast';
import {
  uploadCurriculum, getIngestionJobs, getNamespaces, getGrades, getSubjects, cancelIngestionJob,
} from '../../services/adminService';

const STATUS_STYLE = {
  processing: 'bg-blue-100 text-blue-700',
  complete: 'bg-green-100 text-green-700',
  queued: 'bg-yellow-100 text-yellow-700',
  failed: 'bg-red-100 text-red-700',
  cancelled: 'bg-slate-100 text-slate-500',
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
    if (file && (file.name.endsWith('.pdf') || file.name.endsWith('.docx'))) {
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
    queryFn: async () => (await getSubjects({ grade_id: gradeId })).data?.subjects ?? [],
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
  const cls = STATUS_STYLE[status] ?? 'bg-slate-100 text-slate-500';
  return <span className={`text-xs font-semibold px-2 py-0.5 rounded ${cls} uppercase`}>{status}</span>;
}

function JobsTable({ jobs, onCancel, refetching, onRefetch }) {
  return (
    <div className="bg-white rounded-xl border border-primary-light shadow-sm overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b border-primary-light">
        <p className="text-xs font-semibold text-slate-600 uppercase tracking-wider">Active Ingestion Jobs</p>
        <button onClick={onRefetch} className="flex items-center gap-1 text-xs text-primary font-semibold hover:underline">
          <RefreshCw className={`w-3 h-3 ${refetching ? 'animate-spin' : ''}`} /> Refresh
        </button>
      </div>
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-slate-100 bg-slate-50">
            {['Filename', 'Grade / Subject', 'Status', 'Timestamp', 'Action'].map((h) => (
              <th key={h} className="text-left text-xs font-semibold text-slate-400 uppercase tracking-wider px-4 py-2">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-50">
          {jobs.length === 0 && (
            <tr><td colSpan={5} className="text-center py-8 text-slate-400 text-sm">No ingestion jobs</td></tr>
          )}
          {jobs.map((j) => (
            <tr key={j.job_id} className="hover:bg-slate-50/60">
              <td className="px-4 py-2.5 flex items-center gap-2 font-medium text-slate-700">
                <FileText className="w-4 h-4 text-slate-400 shrink-0" />
                <span className="truncate max-w-[140px]">{j.filename}</span>
              </td>
              <td className="px-4 py-2.5 text-xs text-slate-500">
                {j.grade_name ?? '—'} {j.subject_name ? `/ ${j.subject_name}` : ''}
              </td>
              <td className="px-4 py-2.5"><JobStatusBadge status={j.status} /></td>
              <td className="px-4 py-2.5 text-xs text-slate-400">{j.created_at ? new Date(j.created_at).toLocaleString() : '—'}</td>
              <td className="px-4 py-2.5">
                {['queued', 'processing'].includes(j.status) && (
                  <button onClick={() => onCancel(j.job_id)} className="text-red-400 hover:text-red-600">
                    <X className="w-4 h-4" />
                  </button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
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
  const events = jobs.slice(0, 5).map((j) => ({
    text: `${j.filename} — ${j.status}`,
    sub: j.grade_name ? `Grade ${j.grade_name}` : '',
    time: j.created_at ? new Date(j.created_at).toLocaleTimeString() : '—',
  }));

  return (
    <div className="bg-white rounded-xl border border-primary-light shadow-sm p-4">
      <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3 flex items-center gap-1.5">
        <Activity className="w-3.5 h-3.5" /> Pipeline Activity
      </p>
      {events.length === 0 && <p className="text-xs text-slate-400">No recent activity</p>}
      <div className="space-y-2">
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
    </div>
  );
}

export default function CurriculumUpload() {
  const [selectedFile, setSelectedFile] = useState(null);
  const [gradeId, setGradeId] = useState('');
  const [subjectId, setSubjectId] = useState('');
  const [chunkSize, setChunkSize] = useState(512);
  const [activeStep, setActiveStep] = useState(1);
  const queryClient = useQueryClient();

  const { data: grades = [] } = useQuery({
    queryKey: ['admin', 'grades'],
    queryFn: async () => (await getGrades()).data?.grades ?? [],
  });

  const { data: namespaces = [], isFetching: nsLoading } = useQuery({
    queryKey: ['admin', 'namespaces'],
    queryFn: async () => (await getNamespaces()).data ?? [],
  });

  const { data: jobsData, isFetching: jobsFetching, refetch: refetchJobs } = useQuery({
    queryKey: ['admin', 'ingestion-jobs'],
    queryFn: async () => (await getIngestionJobs()).data,
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
      queryClient.invalidateQueries(['admin', 'namespaces']);
    },
    onError: (err) => toast.error(err?.response?.data?.detail ?? 'Upload failed'),
  });

  const cancelMutation = useMutation({
    mutationFn: (id) => cancelIngestionJob(id),
    onSuccess: () => { toast.success('Job cancelled'); refetchJobs(); },
    onError: () => toast.error('Cancel failed'),
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
            onCancel={(id) => cancelMutation.mutate(id)}
            refetching={jobsFetching}
            onRefetch={refetchJobs}
          />
        </div>

        <div className="space-y-4">
          <ChromaNamespacePanel namespaces={namespaces} />

          <div className="bg-primary-dark rounded-xl p-4">
            <p className="text-xs font-semibold text-primary-light uppercase tracking-wider mb-2">Processing Preview</p>
            <div className="bg-white/10 rounded-lg h-24 flex items-end px-3 pb-3">
              <div className="w-full bg-white/20 rounded-full h-1.5">
                <div className="bg-primary-light h-1.5 rounded-full" style={{ width: '60%' }} />
              </div>
            </div>
          </div>

          <PipelineActivityLog jobs={jobs} />
        </div>
      </div>
    </div>
  );
}
