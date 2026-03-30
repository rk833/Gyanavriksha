import { useState, useEffect, useRef } from 'react';
import {
  Search,
  FileText,
  Download,
  BookOpen,
  BookMarked,
  Video,
  Filter,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { getLibraryDocuments, getSubjects, getEnrollments } from '../../services/studentService';

const DOC_TYPE_ICONS = {
  curriculum_pdf: FileText,
  instructor_note: BookMarked,
};

const TABS = [
  { key: '', label: 'All Resources' },
  { key: 'curriculum_pdf', label: 'Textbooks' },
  { key: 'instructor_note', label: 'Study Guides' },
];

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
  const docGridRef = useRef(null);

  const handleResumeReading = () => {
    if (currentSubject?.subject_id) {
      setSubjectFilter(String(currentSubject.subject_id));
      setPage(1);
      setTimeout(() => {
        docGridRef.current?.scrollIntoView({ behavior: 'smooth' });
      }, 100);
    }
  };

  const handleViewNotes = () => {
    toast('Notes feature coming soon!', { icon: '📝' });
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
      .then((r) => {
        setDocuments(r.data.items || []);
        setTotalPages(r.data.total_pages || 0);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [page, docType, subjectFilter, search]);

  const currentSubject = enrollments[0];

  return (
    <div>
      {/* Hero banner */}
      {currentSubject && (
        <div className="bg-primary-dark rounded-xl p-6 text-white mb-6 relative overflow-hidden">
          <span className="inline-block text-xs uppercase tracking-wider bg-white/20 text-white px-2 py-0.5 rounded mb-2">
            In Progress
          </span>
          <h2 className="text-xl font-bold mb-1">{currentSubject.subject_name}</h2>
          <p className="text-sm text-white/70 mb-4 max-w-lg">
            Continue your journey. You have completed {currentSubject.completion_percentage}% of this module.
          </p>
          <div className="flex gap-2">
            <button
              onClick={handleResumeReading}
              className="bg-white text-primary-dark text-sm font-medium px-4 py-2 rounded-lg hover:bg-white/90 transition-colors"
            >
              Resume Reading
            </button>
            <button
              onClick={handleViewNotes}
              className="bg-white/10 text-white text-sm font-medium px-4 py-2 rounded-lg hover:bg-white/20 transition-colors border border-white/20"
            >
              View Notes
            </button>
          </div>
          <div className="absolute -right-10 -bottom-10 w-40 h-40 rounded-full bg-white/5" />
        </div>
      )}

      {/* Tabs & filters */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 mb-5">
        <div className="flex gap-2 overflow-x-auto">
          {TABS.map((t) => (
            <button
              key={t.key}
              onClick={() => { setDocType(t.key); setPage(1); }}
              className={`px-4 py-1.5 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${
                docType === t.key
                  ? 'bg-primary-dark text-white'
                  : 'bg-white border border-primary-light text-slate-600 hover:bg-primary-50'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
        <div className="flex gap-2">
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
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search documents..."
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              className="pl-9 pr-3 py-2 border border-primary-light rounded-lg text-sm bg-white focus:ring-2 focus:ring-primary/30 focus:border-primary outline-none w-48"
            />
          </div>
        </div>
      </div>

      {/* Document grid */}
      <div ref={docGridRef} />
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="animate-pulse bg-white rounded-xl border border-primary-light h-48" />
          ))}
        </div>
      ) : documents.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-xl border border-primary-light">
          <BookOpen className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <p className="text-slate-500">No documents found in your library.</p>
          <p className="text-xs text-slate-400 mt-1">Documents will appear when instructors upload materials for your subjects.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {documents.map((doc) => {
            const Icon = DOC_TYPE_ICONS[doc.doc_type] || FileText;
            return (
              <div
                key={doc.doc_id}
                className="bg-white rounded-xl border border-primary-light p-5 hover:shadow-md transition-shadow group"
              >
                <div className="flex items-start gap-3 mb-3">
                  <div className="w-12 h-12 rounded-lg bg-primary-light flex items-center justify-center flex-shrink-0">
                    <Icon className="w-6 h-6 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-primary-dark text-sm truncate">{doc.file_name}</h3>
                    <p className="text-xs text-slate-500 mt-0.5">{doc.subject_name}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3 text-xs text-slate-400 mb-3">
                  {doc.file_size_bytes && (
                    <span>{(doc.file_size_bytes / (1024 * 1024)).toFixed(1)}MB</span>
                  )}
                  <span>{doc.grade_name}</span>
                </div>
                <div className="flex gap-2">
                  <button className="flex-1 text-xs bg-primary-dark text-white px-3 py-1.5 rounded-lg hover:bg-primary transition-colors flex items-center justify-center gap-1">
                    <Download className="w-3 h-3" />
                    Download
                  </button>
                  <button className="text-xs border border-primary-light text-slate-600 px-3 py-1.5 rounded-lg hover:bg-primary-50 transition-colors">
                    Add to Library
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
    </div>
  );
}
