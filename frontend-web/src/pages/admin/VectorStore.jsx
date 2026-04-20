import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell,
} from 'recharts';
import {
  Database, Folder, FolderOpen, FileText, ChevronRight, ChevronDown,
  Plus, Download, CheckCircle2, Loader2, Clock, AlertTriangle,
} from 'lucide-react';
import toast from 'react-hot-toast';
import {
  getNamespaces, getVectorStats, createNamespace, reindexStore, getExportSnapshot, getGrades, getSubjects,
} from '../../services/adminService';

function formatTimeAgo(isoString) {
  if (!isoString) return 'Never';
  const mins = Math.floor((Date.now() - new Date(isoString).getTime()) / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins} min ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

function StatCard({ label, value, sub, dark }) {
  if (dark) {
    return (
      <div className="bg-primary-dark text-white rounded-xl p-5 flex items-center justify-between">
        <div>
          <p className="text-xs text-primary-light uppercase tracking-wider font-semibold">{label}</p>
          <p className="text-3xl font-bold mt-1">{value}</p>
        </div>
        <CheckCircle2 className="w-8 h-8 text-primary-light opacity-70" />
      </div>
    );
  }
  return (
    <div className="bg-white rounded-xl border border-primary-light p-5 shadow-sm">
      <p className="text-xs text-slate-500 uppercase tracking-wider font-semibold">{label}</p>
      <p className="text-3xl font-bold text-primary-dark mt-1">{value}</p>
      {sub && (
        <p className="text-xs text-green-500 font-medium mt-1 flex items-center gap-1">
          <span className="w-2 h-2 rounded-full bg-green-400 inline-block" />{sub}
        </p>
      )}
    </div>
  );
}

function GradeFolder({ grade, open, onToggle }) {
  return (
    <div>
      <button
        onClick={onToggle}
        className="flex items-center gap-2 w-full py-2 px-3 rounded-lg hover:bg-slate-50 text-sm font-semibold text-slate-700"
      >
        {open ? <ChevronDown className="w-4 h-4 text-slate-400" /> : <ChevronRight className="w-4 h-4 text-slate-400" />}
        {open ? <FolderOpen className="w-4 h-4 text-primary" /> : <Folder className="w-4 h-4 text-slate-400" />}
        <span>{grade.grade_name}</span>
        <span className="ml-auto text-xs text-slate-400 font-normal">{grade.namespaces.length} Namespaces</span>
      </button>
      {open && (
        <div className="ml-8 space-y-0.5 mt-0.5">
          {grade.namespaces.map((ns) => (
            <div key={ns.name} className="flex items-center gap-2 py-1.5 px-3 rounded-lg hover:bg-slate-50 text-sm text-slate-600">
              <FileText className="w-4 h-4 text-slate-400 shrink-0" />
              <span className="flex-1 truncate">{ns.name}</span>
              <span className="text-xs bg-primary-light text-primary px-2 py-0.5 rounded-full font-medium">
                {ns.chunk_count?.toLocaleString() ?? 0} chunks
              </span>
            </div>
          ))}
          {grade.namespaces.length === 0 && (
            <p className="text-xs text-slate-400 px-3 py-1">No namespaces</p>
          )}
        </div>
      )}
    </div>
  );
}

function NamespaceExplorer({ grades }) {
  const [expandedSet, setExpandedSet] = useState(() => new Set(grades.slice(0, 1).map(g => g.grade_level)));

  const toggle = (level) => setExpandedSet((s) => {
    const next = new Set(s);
    if (next.has(level)) next.delete(level);
    else next.add(level);
    return next;
  });

  const expandAll = () => setExpandedSet(new Set(grades.map(g => g.grade_level)));
  const collapseAll = () => setExpandedSet(new Set());
  const allExpanded = grades.length > 0 && expandedSet.size === grades.length;

  return (
    <div className="bg-white rounded-xl border border-primary-light shadow-sm">
      <div className="flex items-center justify-between px-5 py-4 border-b border-primary-light">
        <div className="flex items-center gap-2 font-semibold text-primary-dark">
          <Database className="w-4 h-4" />
          Namespace Explorer
        </div>
        <button
          onClick={allExpanded ? collapseAll : expandAll}
          className="text-xs font-semibold text-primary uppercase tracking-wider hover:underline"
        >
          {allExpanded ? 'Collapse All' : 'Expand All'}
        </button>
      </div>
      <div className="p-4 space-y-1 max-h-96 overflow-y-auto">
        {grades.map((g) => (
          <GradeFolder
            key={g.grade_level}
            grade={g}
            open={expandedSet.has(g.grade_level)}
            onToggle={() => toggle(g.grade_level)}
          />
        ))}
        {grades.length === 0 && <p className="text-sm text-slate-400 text-center py-8">No namespaces found</p>}
      </div>
    </div>
  );
}

function EmbeddingStatusChart({ stats }) {
  const chartData = [
    { label: 'Done', value: stats?.total_done ?? 0, fill: '#3F72AF' },
    { label: 'Pending', value: stats?.total_pending ?? 0, fill: '#F6C90E' },
    { label: 'Failed', value: stats?.total_failed ?? 0, fill: '#EF4444' },
  ].filter((d) => d.value > 0);

  const total = stats?.total_documents ?? 0;
  const successPct = total > 0 ? Math.round(((stats?.total_done ?? 0) / total) * 100) : 0;

  return (
    <div className="bg-white rounded-xl border border-primary-light shadow-sm p-5">
      <div className="flex items-center justify-between mb-4">
        <p className="font-semibold text-primary-dark">Embedding Status</p>
        <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${successPct >= 80 ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}`}>
          {successPct}% complete
        </span>
      </div>
      {chartData.length === 0 ? (
        <div className="h-40 flex items-center justify-center text-slate-400 text-sm">
          No documents ingested yet
        </div>
      ) : (
        <ResponsiveContainer width="100%" height={140}>
          <BarChart data={chartData} barSize={36}>
            <XAxis dataKey="label" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
            <YAxis hide />
            <Tooltip formatter={(v) => [v, 'Documents']} />
            <Bar dataKey="value" radius={[4, 4, 0, 0]}>
              {chartData.map((d, i) => (
                <Cell key={i} fill={d.fill} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      )}
      <div className="flex items-center gap-4 mt-2 flex-wrap">
        <span className="flex items-center gap-1 text-xs text-slate-500">
          <span className="w-2.5 h-2.5 rounded-sm bg-primary inline-block" /> Done: {stats?.total_done ?? 0}
        </span>
        <span className="flex items-center gap-1 text-xs text-slate-500">
          <span className="w-2.5 h-2.5 rounded-sm bg-yellow-400 inline-block" /> Pending: {stats?.total_pending ?? 0}
        </span>
        <span className="flex items-center gap-1 text-xs text-slate-500">
          <span className="w-2.5 h-2.5 rounded-sm bg-red-400 inline-block" /> Failed: {stats?.total_failed ?? 0}
        </span>
      </div>
    </div>
  );
}

function ReindexConfirmModal({ onConfirm, onClose }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-sm mx-4">
        <div className="flex items-start gap-3 mb-4">
          <div className="w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center shrink-0">
            <AlertTriangle className="w-5 h-5 text-amber-600" />
          </div>
          <div>
            <h2 className="text-base font-bold text-slate-800">Re-index Entire Store?</h2>
            <p className="text-sm text-slate-500 mt-1">
              This will reset <strong>all documents</strong> to <span className="font-semibold text-amber-600">PENDING</span> and re-queue them for embedding.
              The <em>Last Indexed</em> stat will show <strong>Never</strong> until the pipeline finishes re-embedding.
            </p>
          </div>
        </div>
        <div className="flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 border border-slate-200 text-slate-600 rounded-lg py-2 text-sm font-semibold hover:bg-slate-50"
          >
            Cancel
          </button>
          <button
            onClick={() => { onConfirm(); onClose(); }}
            className="flex-1 bg-primary-dark text-white rounded-lg py-2 text-sm font-semibold hover:bg-primary"
          >
            Yes, Re-index
          </button>
        </div>
      </div>
    </div>
  );
}

function QuickOps({ onCreateNamespace, onExport, reindexing, onReindex, onShowReindexConfirm }) {
  return (
    <div className="bg-white rounded-xl border border-primary-light shadow-sm p-5">
      <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">Quick Operations</p>
      <div className="space-y-2">
        <button
          onClick={onCreateNamespace}
          className="w-full bg-primary-dark text-white rounded-lg py-2.5 text-sm font-semibold flex items-center justify-center gap-2 hover:bg-primary transition-colors"
        >
          <Plus className="w-4 h-4" /> Create New Namespace
        </button>
        <button
          onClick={onShowReindexConfirm}
          disabled={reindexing}
          className="w-full border border-primary text-primary rounded-lg py-2.5 text-sm font-semibold flex items-center justify-center gap-2 hover:bg-primary-light transition-colors disabled:opacity-50"
        >
          {reindexing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Database className="w-4 h-4" />}
          {reindexing ? 'Re-indexing…' : 'Re-index Store'}
        </button>
        <button
          onClick={onExport}
          className="w-full border border-slate-200 text-slate-600 rounded-lg py-2.5 text-sm font-semibold flex items-center justify-center gap-2 hover:bg-slate-50 transition-colors"
        >
          <Download className="w-4 h-4" /> Export Chroma Snapshot
        </button>
      </div>
    </div>
  );
}

function CreateNamespaceModal({ grades, onClose, onCreated }) {
  const [gradeSel, setGradeSel] = useState('');
  const [subjectSel, setSubjectSel] = useState('');
  const [name, setName] = useState('');
  const [saving, setSaving] = useState(false);

  const { data: subjects = [] } = useQuery({
    queryKey: ['admin', 'subjects', gradeSel],
    queryFn: async () => (await getSubjects({ grade_id: gradeSel })).data ?? [],
    enabled: !!gradeSel,
  });

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!name.trim() || !gradeSel || !subjectSel) {
      toast.error('All fields are required');
      return;
    }
    setSaving(true);
    try {
      await createNamespace({ name: name.trim(), grade_id: parseInt(gradeSel), subject_id: parseInt(subjectSel) });
      toast.success('Namespace created');
      onCreated();
    } catch {
      toast.error('Failed to create namespace');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-md mx-4">
        <h2 className="text-lg font-bold text-primary-dark mb-4">Create New Namespace</h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">Namespace Name</label>
            <input
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Science_G10_Main"
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">Grade</label>
            <select
              required
              value={gradeSel}
              onChange={(e) => { setGradeSel(e.target.value); setSubjectSel(''); }}
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
            >
              <option value="">Select grade</option>
              {grades.map((g) => <option key={g.grade_id} value={g.grade_id}>{g.grade_name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">Subject</label>
            <select
              required
              value={subjectSel}
              onChange={(e) => setSubjectSel(e.target.value)}
              disabled={!gradeSel}
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 disabled:opacity-50"
            >
              <option value="">Select subject</option>
              {subjects.map((s) => <option key={s.subject_id} value={s.subject_id}>{s.name}</option>)}
            </select>
          </div>
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="flex-1 border border-slate-200 text-slate-600 rounded-lg py-2 text-sm font-semibold hover:bg-slate-50">
              Cancel
            </button>
            <button type="submit" disabled={saving} className="flex-1 bg-primary-dark text-white rounded-lg py-2 text-sm font-semibold hover:bg-primary disabled:opacity-50 flex items-center justify-center gap-2">
              {saving && <Loader2 className="w-4 h-4 animate-spin" />} Create
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function VectorStore() {
  const [showCreate, setShowCreate] = useState(false);
  const [showReindexConfirm, setShowReindexConfirm] = useState(false);
  const queryClient = useQueryClient();

  const { data: namespacesData = [], isLoading } = useQuery({
    queryKey: ['admin', 'namespaces'],
    queryFn: async () => (await getNamespaces()).data ?? [],
  });

  const { data: stats } = useQuery({
    queryKey: ['admin', 'vector-stats'],
    queryFn: async () => (await getVectorStats()).data,
  });

  const { data: grades = [] } = useQuery({
    queryKey: ['admin', 'grades'],
    queryFn: async () => (await getGrades()).data ?? [],
  });

  const reindexMutation = useMutation({
    mutationFn: () => reindexStore(),
    onSuccess: (res) => {
      const count = res?.data?.requeued_count ?? 0;
      toast.success(`Re-index triggered — ${count} document${count !== 1 ? 's' : ''} queued for re-embedding`);
      queryClient.invalidateQueries({ queryKey: ['admin', 'namespaces'] });
      queryClient.invalidateQueries({ queryKey: ['admin', 'vector-stats'] });
    },
    onError: () => toast.error('Re-index failed'),
  });

  const handleExport = async () => {
    try {
      const res = await getExportSnapshot();
      const blob = new Blob([JSON.stringify(res.data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'chroma_snapshot.json';
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      toast.error('Export failed');
    }
  };

  const handleCreated = () => {
    setShowCreate(false);
    queryClient.invalidateQueries({ queryKey: ['admin', 'namespaces'] });
    queryClient.invalidateQueries({ queryKey: ['admin', 'vector-stats'] });
  };

  const totalDocs = stats?.total_documents ?? 0;
  const totalNamespaces = stats?.total_namespaces ?? 0;
  const successRate = stats?.embedding_success_rate != null
    ? `${Math.round(stats.embedding_success_rate * 100)}%`
    : '—';
  const hasPending = (stats?.total_pending ?? 0) > 0;
  const lastIndexed = stats?.last_indexed_at
    ? formatTimeAgo(stats.last_indexed_at)
    : hasPending ? 'Pending…' : 'Never';
  const lastIndexedSub = !stats?.last_indexed_at && hasPending
    ? `${stats.total_pending} doc${stats.total_pending !== 1 ? 's' : ''} queued`
    : stats?.last_indexed_at ? 'Live connection' : undefined;
  const chunkDisplay = totalDocs >= 1000 ? `${(totalDocs / 1000).toFixed(1)}k` : String(totalDocs);
  const successSub = stats?.total_done != null ? `${stats.total_done} docs embedded` : undefined;

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-primary-dark">Vector Store</h1>
        <p className="text-sm text-slate-500 mt-0.5">ChromaDB namespace management and embedding status</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <StatCard label="Active Namespaces" value={totalNamespaces} />
        <StatCard label="Total Documents" value={chunkDisplay} />
        <StatCard
          label="Last Indexed"
          value={lastIndexed}
          sub={lastIndexedSub}
        />
        <StatCard label="Embedding Success" value={successRate} sub={successSub} dark />
      </div>

      {isLoading ? (
        <div className="flex justify-center py-20"><Loader2 className="w-8 h-8 text-primary animate-spin" /></div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <NamespaceExplorer grades={namespacesData} />
          <div className="space-y-4">
            <EmbeddingStatusChart stats={stats} />
            <QuickOps
              onCreateNamespace={() => setShowCreate(true)}
              onExport={handleExport}
              onReindex={() => reindexMutation.mutate()}
              reindexing={reindexMutation.isPending}
              onShowReindexConfirm={() => setShowReindexConfirm(true)}
            />
          </div>
        </div>
      )}

      {showCreate && (
        <CreateNamespaceModal
          grades={grades}
          onClose={() => setShowCreate(false)}
          onCreated={handleCreated}
        />
      )}

      {showReindexConfirm && (
        <ReindexConfirmModal
          onConfirm={() => reindexMutation.mutate()}
          onClose={() => setShowReindexConfirm(false)}
        />
      )}
    </div>
  );
}
