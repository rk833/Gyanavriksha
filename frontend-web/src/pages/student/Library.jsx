import { useState, useEffect, useRef, useCallback } from 'react';
import {
  Search, FileText, Download, BookOpen, BookMarked,
  PlayCircle, X, ChevronLeft, ChevronRight, Loader2,
  AlertCircle, Maximize2, GraduationCap,
} from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../../services/api';
import { getLibraryDocuments, getSubjects, getEnrollments, downloadDocument } from '../../services/studentService';

/* ── Colour palette per subject (cycles if more than 6) ───── */
const SUBJECT_COLORS = [
  { bg: 'bg-blue-50',   ring: 'ring-blue-200',   text: 'text-blue-600',   bar: 'bg-blue-500',   icon: 'bg-blue-100'   },
  { bg: 'bg-emerald-50',ring: 'ring-emerald-200', text: 'text-emerald-600',bar: 'bg-emerald-500', icon: 'bg-emerald-100'},
  { bg: 'bg-violet-50', ring: 'ring-violet-200',  text: 'text-violet-600', bar: 'bg-violet-500',  icon: 'bg-violet-100' },
  { bg: 'bg-amber-50',  ring: 'ring-amber-200',   text: 'text-amber-600',  bar: 'bg-amber-500',   icon: 'bg-amber-100'  },
  { bg: 'bg-rose-50',   ring: 'ring-rose-200',    text: 'text-rose-600',   bar: 'bg-rose-500',    icon: 'bg-rose-100'   },
  { bg: 'bg-cyan-50',   ring: 'ring-cyan-200',    text: 'text-cyan-600',   bar: 'bg-cyan-500',    icon: 'bg-cyan-100'   },
];

const DOC_TYPE_ICONS = { curriculum_pdf: FileText, instructor_note: BookMarked };
const TABS = [
  { key: '', label: 'All Resources' },
  { key: 'curriculum_pdf', label: 'Textbooks' },
  { key: 'instructor_note', label: 'Study Guides' },
];

/* ── PDF Reader Modal ─────────────────────────────────────── */
function PDFReaderModal({ initialDoc, documents, onClose }) {
  const [currentIdx, setCurrentIdx] = useState(
    Math.max(documents.findIndex((d) => d.doc_id === initialDoc.doc_id), 0)
  );
  const [blobUrl, setBlobUrl] = useState(null);
  const [loadingPdf, setLoadingPdf] = useState(true);
  const [pdfError, setPdfError] = useState(null);
  const [downloadingId, setDownloadingId] = useState(null);
  const blobUrlRef = useRef(null);

  const currentDoc = documents[currentIdx] || initialDoc;
  const hasPrev = currentIdx > 0;
  const hasNext = currentIdx < documents.length - 1;

  const loadPdf = useCallback(async (doc) => {
    if (blobUrlRef.current) URL.revokeObjectURL(blobUrlRef.current);
    setBlobUrl(null); setLoadingPdf(true); setPdfError(null);
    try {
      const res = await api.get(`/api/students/library/${doc.doc_id}/download`, {
        responseType: 'blob', timeout: 180_000,
      });
      const url = URL.createObjectURL(new Blob([res.data], { type: 'application/pdf' }));
      blobUrlRef.current = url;
      setBlobUrl(url);
    } catch { setPdfError('Could not load document. Try downloading instead.'); }
    finally { setLoadingPdf(false); }
  }, []);

  useEffect(() => {
    loadPdf(currentDoc);
    return () => { if (blobUrlRef.current) URL.revokeObjectURL(blobUrlRef.current); };
  }, [currentDoc.doc_id]);

  useEffect(() => {
    const fn = (e) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowRight' && hasNext) setCurrentIdx((i) => i + 1);
      if (e.key === 'ArrowLeft' && hasPrev) setCurrentIdx((i) => i - 1);
    };
    window.addEventListener('keydown', fn);
    return () => window.removeEventListener('keydown', fn);
  }, [hasPrev, hasNext, onClose]);

  const handleDownload = async () => {
    setDownloadingId(currentDoc.doc_id);
    try { await downloadDocument(currentDoc.doc_id, currentDoc.file_name); }
    catch { toast.error('Download failed.'); }
    finally { setDownloadingId(null); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-stretch bg-black/60 backdrop-blur-sm p-4"
      onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="flex flex-col w-full max-w-6xl mx-auto bg-white rounded-2xl overflow-hidden shadow-2xl">

        {/* Toolbar */}
        <div className="flex items-center justify-between px-5 py-3 bg-slate-900 shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center shrink-0">
              <FileText className="w-4 h-4 text-white/80" />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-white truncate max-w-[260px]">{currentDoc.file_name}</p>
              <p className="text-[11px] text-white/40">{currentDoc.subject_name} · {currentDoc.grade_name}</p>
            </div>
          </div>
          {documents.length > 1 && (
            <div className="flex items-center gap-2 absolute left-1/2 -translate-x-1/2">
              <button onClick={() => setCurrentIdx((i) => i - 1)} disabled={!hasPrev}
                className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 disabled:opacity-30 transition-colors">
                <ChevronLeft className="w-4 h-4 text-white" />
              </button>
              <span className="text-xs text-white/50 min-w-[3.5rem] text-center">{currentIdx + 1} / {documents.length}</span>
              <button onClick={() => setCurrentIdx((i) => i + 1)} disabled={!hasNext}
                className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 disabled:opacity-30 transition-colors">
                <ChevronRight className="w-4 h-4 text-white" />
              </button>
            </div>
          )}
          <div className="flex items-center gap-1.5">
            <button onClick={() => blobUrl && window.open(blobUrl, '_blank')} disabled={!blobUrl}
              className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 disabled:opacity-30 transition-colors" title="Full screen">
              <Maximize2 className="w-4 h-4 text-white" />
            </button>
            <button onClick={handleDownload} disabled={!!downloadingId}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 disabled:opacity-50 transition-colors text-xs font-medium text-white">
              {downloadingId ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
              Download
            </button>
            <button onClick={onClose} className="p-1.5 rounded-lg bg-white/10 hover:bg-red-500/70 transition-colors ml-1" title="Close">
              <X className="w-4 h-4 text-white" />
            </button>
          </div>
        </div>

        {/* Viewport */}
        <div className="flex-1 bg-slate-100 relative min-h-0">
          {loadingPdf && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-slate-50">
              <Loader2 className="w-8 h-8 text-primary animate-spin" />
              <p className="text-sm text-slate-500">Loading document…</p>
            </div>
          )}
          {pdfError && !loadingPdf && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-4">
              <AlertCircle className="w-10 h-10 text-red-300" />
              <p className="text-sm text-slate-500">{pdfError}</p>
              <button onClick={handleDownload}
                className="flex items-center gap-2 px-4 py-2 bg-primary-dark text-white text-sm rounded-xl hover:bg-primary transition-colors">
                <Download className="w-4 h-4" /> Download instead
              </button>
            </div>
          )}
          {blobUrl && !loadingPdf && (
            <iframe src={`${blobUrl}#toolbar=1&navpanes=0&scrollbar=1`}
              className="w-full h-full border-0" title={currentDoc.file_name} />
          )}
        </div>

        {/* Doc strip */}
        {documents.length > 1 && (
          <div className="flex gap-1.5 px-4 py-2.5 bg-slate-900 overflow-x-auto shrink-0">
            {documents.map((doc, idx) => (
              <button key={doc.doc_id} onClick={() => setCurrentIdx(idx)}
                className={`flex-shrink-0 px-3 py-1.5 rounded-lg text-xs transition-colors ${
                  idx === currentIdx ? 'bg-white/20 text-white' : 'text-white/40 hover:bg-white/10 hover:text-white/70'
                }`}>
                {doc.subject_name || doc.file_name}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

/* ── Subject card ─────────────────────────────────────────── */
function SubjectCard({ enrollment, color, onStart, onFilter, isActive }) {
  const pct = Number(enrollment.completion_percentage ?? 0);
  const started = pct > 0;
  return (
    <button
      onClick={onFilter}
      className={`group relative flex flex-col text-left p-4 rounded-2xl border-2 transition-all w-44 shrink-0
        ${isActive
          ? `${color.bg} ${color.ring} ring-2 shadow-md`
          : 'bg-white border-slate-100 hover:border-slate-200 hover:shadow-sm'
        }`}
    >
      {/* Icon */}
      <div className={`w-9 h-9 rounded-xl flex items-center justify-center mb-3 ${color.icon}`}>
        <GraduationCap className={`w-5 h-5 ${color.text}`} />
      </div>

      {/* Name & grade */}
      <p className="font-semibold text-slate-800 text-sm leading-tight mb-0.5">{enrollment.subject_name}</p>
      <p className="text-[10px] text-slate-400 mb-3">{enrollment.grade_name}</p>

      {/* Progress */}
      <div className="mt-auto w-full">
        <div className="flex justify-between text-[10px] mb-1">
          <span className={isActive ? color.text : 'text-slate-400'}>{started ? 'In progress' : 'Not started'}</span>
          <span className="font-semibold text-slate-600">{pct}%</span>
        </div>
        <div className="h-1 bg-slate-100 rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-700 ${color.bar}`}
            style={{ width: `${Math.max(pct, started ? 4 : 0)}%` }}
          />
        </div>
      </div>

      {/* Read hover button */}
      <div
        onClick={(e) => { e.stopPropagation(); onStart(); }}
        className={`absolute bottom-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity
          flex items-center gap-1 text-[10px] font-semibold px-2.5 py-1 rounded-lg ${color.text} ${color.icon}`}
      >
        {started ? <PlayCircle className="w-3 h-3" /> : <BookOpen className="w-3 h-3" />}
        {started ? 'Resume' : 'Start'}
      </div>
    </button>
  );
}

/* ── Main page ────────────────────────────────────────────── */
export default function StudentLibrary() {
  const [documents, setDocuments] = useState([]);
  const [subjects, setSubjects] = useState([]);
  const [enrollments, setEnrollments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [docType, setDocType] = useState('');
  const [subjectFilter, setSubjectFilter] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const [downloadingId, setDownloadingId] = useState(null);
  const [readerDoc, setReaderDoc] = useState(null);
  const docGridRef = useRef(null);

  const openReader = useCallback((doc) => setReaderDoc(doc), []);
  const closeReader = useCallback(() => setReaderDoc(null), []);

  const handleDownload = async (doc, e) => {
    e.stopPropagation();
    setDownloadingId(doc.doc_id);
    try { await downloadDocument(doc.doc_id, doc.file_name); }
    catch { toast.error('Download failed. Please try again.'); }
    finally { setDownloadingId(null); }
  };

  useEffect(() => {
    Promise.all([
      getSubjects().then((r) => setSubjects(r.data || [])),
      getEnrollments().then((r) => setEnrollments(r.data.items || [])),
    ]).catch(() => {});
  }, []);

  useEffect(() => {
    setLoading(true);
    const params = { page, per_page: 12 };
    if (docType) params.doc_type = docType;
    if (subjectFilter) params.subject_id = subjectFilter;
    if (search) params.search = search;
    getLibraryDocuments(params)
      .then((r) => { setDocuments(r.data.items || []); setTotalPages(r.data.total_pages || 0); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [page, docType, subjectFilter, search]);

  const handleStartReading = (enrollment) => {
    const subjectDocs = documents.filter((d) => String(d.subject_id) === String(enrollment.subject_id));
    const firstDoc = subjectDocs[0];
    if (firstDoc) { openReader(firstDoc); return; }
    setSubjectFilter(String(enrollment.subject_id));
    setPage(1);
    setTimeout(() => docGridRef.current?.scrollIntoView({ behavior: 'smooth' }), 150);
  };

  const handleFilterSubject = (enrollment) => {
    const id = String(enrollment.subject_id);
    setSubjectFilter((prev) => (prev === id ? '' : id));
    setPage(1);
    setTimeout(() => docGridRef.current?.scrollIntoView({ behavior: 'smooth' }), 150);
  };

  return (
    <>
      {readerDoc && <PDFReaderModal initialDoc={readerDoc} documents={documents} onClose={closeReader} />}

      <div>
        {/* ── Page header ── */}
        <div className="flex items-center justify-between mb-5">
          <div>
            <h1 className="text-xl font-bold text-slate-800">My Library</h1>
            <p className="text-sm text-slate-400 mt-0.5">
              {enrollments.length > 0
                ? `Enrolled in ${enrollments.length} subject${enrollments.length > 1 ? 's' : ''}`
                : 'No subjects enrolled yet'}
            </p>
          </div>
          {/* Search always visible */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search documents…"
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              className="pl-9 pr-4 py-2 border border-slate-200 rounded-xl text-sm bg-white focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none w-52 shadow-sm"
            />
          </div>
        </div>

        {/* ── Subject cards — horizontal scroll, any count ── */}
        {enrollments.length > 0 && (
          <div className="flex gap-3 overflow-x-auto pb-1 mb-6 scrollbar-hide">
            {/* "All" pill */}
            <button
              onClick={() => { setSubjectFilter(''); setPage(1); }}
              className={`shrink-0 flex items-center gap-2 px-4 py-2.5 rounded-2xl border-2 text-sm font-medium transition-all ${
                subjectFilter === ''
                  ? 'bg-slate-800 border-slate-800 text-white shadow-md'
                  : 'bg-white border-slate-100 text-slate-500 hover:border-slate-200'
              }`}
            >
              All Subjects
            </button>

            {enrollments.map((enrollment, idx) => (
              <SubjectCard
                key={enrollment.enrollment_id}
                enrollment={enrollment}
                color={SUBJECT_COLORS[idx % SUBJECT_COLORS.length]}
                isActive={subjectFilter === String(enrollment.subject_id)}
                onStart={() => handleStartReading(enrollment)}
                onFilter={() => handleFilterSubject(enrollment)}
              />
            ))}
          </div>
        )}

        {/* ── Filter bar ── */}
        <div className="flex items-center justify-between gap-3 mb-5">
          <div className="flex gap-2">
            {TABS.map((t) => (
              <button
                key={t.key}
                onClick={() => { setDocType(t.key); setPage(1); }}
                className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                  docType === t.key
                    ? 'bg-slate-800 text-white'
                    : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
          <select
            value={subjectFilter}
            onChange={(e) => { setSubjectFilter(e.target.value); setPage(1); }}
            className="border border-slate-200 rounded-lg px-3 py-1.5 text-sm bg-white focus:ring-2 focus:ring-primary/20 outline-none text-slate-600"
          >
            <option value="">All Subjects</option>
            {subjects.map((s) => (
              <option key={s.subject_id} value={s.subject_id}>{s.subject_name}</option>
            ))}
          </select>
        </div>

        {/* ── Document grid ── */}
        <div ref={docGridRef} />
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {[...Array(8)].map((_, i) => (
              <div key={i} className="animate-pulse bg-white rounded-2xl border border-slate-100 h-48" />
            ))}
          </div>
        ) : documents.length === 0 ? (
          <div className="text-center py-20 bg-white rounded-2xl border border-slate-100">
            <div className="w-14 h-14 rounded-2xl bg-slate-50 flex items-center justify-center mx-auto mb-4">
              <BookOpen className="w-7 h-7 text-slate-300" />
            </div>
            <p className="text-slate-500 font-medium">No documents found</p>
            <p className="text-xs text-slate-400 mt-1">Materials will appear once instructors upload them.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {documents.map((doc, idx) => {
              const Icon = DOC_TYPE_ICONS[doc.doc_type] || FileText;
              const isDownloading = downloadingId === doc.doc_id;
              const enrollIdx = enrollments.findIndex((e) => String(e.subject_id) === String(doc.subject_id));
              const color = SUBJECT_COLORS[Math.max(enrollIdx, 0) % SUBJECT_COLORS.length];

              return (
                <div
                  key={doc.doc_id}
                  onClick={() => openReader(doc)}
                  className="bg-white rounded-2xl border border-slate-100 p-4 hover:shadow-md hover:border-slate-200 transition-all cursor-pointer group flex flex-col"
                >
                  {/* Doc icon */}
                  <div className={`w-11 h-11 rounded-xl flex items-center justify-center mb-3 ${color.icon} transition-colors`}>
                    <Icon className={`w-5 h-5 ${color.text}`} />
                  </div>

                  {/* Meta */}
                  <h3 className="font-semibold text-slate-800 text-sm leading-snug mb-1 line-clamp-2">{doc.file_name}</h3>
                  <div className="flex items-center gap-2 mb-4">
                    <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${color.bg} ${color.text}`}>
                      {doc.subject_name}
                    </span>
                    {doc.file_size_bytes && (
                      <span className="text-[10px] text-slate-400">
                        {(doc.file_size_bytes / (1024 * 1024)).toFixed(1)} MB
                      </span>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="flex gap-2 mt-auto" onClick={(e) => e.stopPropagation()}>
                    <button
                      onClick={() => openReader(doc)}
                      className="flex-1 flex items-center justify-center gap-1.5 text-xs font-semibold bg-slate-800 text-white py-2 rounded-xl hover:bg-slate-700 transition-colors"
                    >
                      <BookOpen className="w-3 h-3" /> Read
                    </button>
                    <button
                      onClick={(e) => handleDownload(doc, e)}
                      disabled={isDownloading}
                      className="w-9 h-9 flex items-center justify-center rounded-xl border border-slate-200 text-slate-500 hover:bg-slate-50 disabled:opacity-50 transition-colors"
                      title="Download"
                    >
                      {isDownloading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-center gap-2 mt-6">
            {[...Array(totalPages)].map((_, i) => (
              <button
                key={i}
                onClick={() => setPage(i + 1)}
                className={`w-8 h-8 rounded-lg text-sm font-medium transition-colors ${
                  page === i + 1 ? 'bg-slate-800 text-white' : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
                }`}
              >
                {i + 1}
              </button>
            ))}
          </div>
        )}
      </div>
    </>
  );
}
