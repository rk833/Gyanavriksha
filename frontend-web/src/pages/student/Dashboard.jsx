import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import {
  BookOpen,
  Upload,
  FileText,
  ArrowRight,
  Send,
  Loader2,
} from 'lucide-react';
import { getDashboard } from '../../services/studentService';

function SkeletonCard({ className = '' }) {
  return (
    <div className={`animate-pulse bg-white rounded-xl border border-primary-light p-6 ${className}`}>
      <div className="h-4 bg-slate-200 rounded w-1/3 mb-3" />
      <div className="h-3 bg-slate-200 rounded w-2/3 mb-2" />
      <div className="h-3 bg-slate-200 rounded w-1/2" />
    </div>
  );
}

export default function StudentDashboard() {
  const navigate = useNavigate();
  const {
    data,
    isPending: loading,
    error,
    refetch,
  } = useQuery({
    queryKey: ['student', 'dashboard'],
    queryFn: async () => {
      const res = await getDashboard();
      return res.data;
    },
  });

  if (loading) {
    return (
      <div>
        <div className="mb-6">
          <div className="h-7 bg-slate-200 rounded w-56 mb-2 animate-pulse" />
          <div className="h-4 bg-slate-200 rounded w-80 animate-pulse" />
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <SkeletonCard className="lg:col-span-2 h-52" />
          <SkeletonCard className="h-52" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
          <SkeletonCard className="h-48" />
          <SkeletonCard className="h-48" />
          <SkeletonCard className="h-48" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-12">
        <p className="text-red-500 mb-4">
          {error?.response?.data?.detail || error?.message || 'Failed to load dashboard'}
        </p>
        <button
          onClick={() => refetch()}
          className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary-dark transition-colors"
        >
          Retry
        </button>
      </div>
    );
  }

  const currentSubject = data?.current_subject;
  const secondarySubject = data?.enrolled_subjects?.[1];

  return (
    <div>
      {/* Welcome header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-primary-dark mb-1">
          Welcome back, {data?.student_name?.split(' ')[0] || 'Student'}.
        </h1>
        <p className="text-slate-500">Your learning path is optimized for today.</p>
      </div>

      {/* Subject cards row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-4">
        {/* Current subject card */}
        {currentSubject ? (
          <div className="lg:col-span-2 bg-primary-dark rounded-xl p-6 text-white relative overflow-hidden">
            <span className="inline-block text-xs uppercase tracking-wider bg-white/20 text-white px-2 py-0.5 rounded mb-3">
              Current Focus
            </span>
            <h2 className="text-xl font-bold mb-2">{currentSubject.subject_name}</h2>
            <p className="text-white/70 text-sm mb-4 max-w-md">
              {currentSubject.grade_name} — Continue your learning journey.
            </p>
            <div className="mb-4">
              <div className="flex justify-between text-sm mb-1">
                <span>Progress</span>
                <span>{currentSubject.completion_percentage}%</span>
              </div>
              <div className="w-full bg-white/20 rounded-full h-2">
                <div
                  className="bg-white rounded-full h-2 transition-all"
                  style={{ width: `${currentSubject.completion_percentage}%` }}
                />
              </div>
            </div>
            <button
              onClick={() => navigate('/student/assignments')}
              className="bg-white text-primary-dark px-5 py-2 rounded-lg text-sm font-semibold hover:bg-white/90 transition-colors"
            >
              Resume Learning
            </button>
            {/* Decorative circles */}
            <div className="absolute -right-10 -bottom-10 w-40 h-40 rounded-full bg-white/5" />
            <div className="absolute -right-5 -top-5 w-24 h-24 rounded-full bg-white/5" />
          </div>
        ) : (
          <div className="lg:col-span-2 bg-primary-light rounded-xl p-6 flex items-center justify-center">
            <p className="text-slate-500">No subjects enrolled yet.</p>
          </div>
        )}

        {/* Secondary subject card */}
        {secondarySubject ? (
          <div className="bg-primary-50 rounded-xl p-5 border border-primary-light flex flex-col justify-between">
            <div>
              <div className="w-full h-24 bg-primary-light/50 rounded-lg mb-3 flex items-center justify-center">
                <BookOpen className="w-10 h-10 text-primary/40" />
              </div>
              <h3 className="font-semibold text-primary-dark text-sm">{secondarySubject.subject_name}</h3>
              <p className="text-xs text-slate-500 mt-0.5">{secondarySubject.grade_name}</p>
            </div>
            <button
              onClick={() => navigate('/student/assignments')}
              className="mt-3 bg-primary-dark text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-primary transition-colors w-full"
            >
              Join Room
            </button>
          </div>
        ) : null}
      </div>

      {/* Bottom row: AI Tutor, Homework OCR, Recommended Practice */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* AI Tutor preview */}
        <div className="bg-white rounded-xl border border-primary-light p-5 flex flex-col">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-8 h-8 rounded-full bg-primary-light flex items-center justify-center">
              <span className="text-primary font-bold text-xs">AI</span>
            </div>
            <div>
              <p className="text-sm font-semibold text-primary-dark">Gyan AI Tutor</p>
              <p className="text-xs text-green-500">Online</p>
            </div>
          </div>
          <div className="flex-1 space-y-2 mb-3">
            <div className="bg-primary-light/50 rounded-lg px-3 py-2 text-xs text-slate-600 max-w-[85%]">
              Hello! Based on your data, I see some integration problems in your homework.
            </div>
            <div className="bg-primary rounded-lg px-3 py-2 text-xs text-white max-w-[85%] ml-auto">
              Yes, I'm struggling with the area between curves.
            </div>
            <div className="bg-primary-light/50 rounded-lg px-3 py-2 text-xs text-slate-600 max-w-[85%]">
              No problem. Remember: Area = ∫(f(x) - g(x)) dx. Want a practice problem?
            </div>
          </div>
          <div className="flex gap-2">
            <input
              type="text"
              placeholder="Ask a question..."
              disabled
              className="flex-1 bg-slate-50 rounded-lg px-3 py-2 text-sm text-slate-400 border border-primary-light cursor-not-allowed"
            />
            <button
              disabled
              className="p-2 rounded-lg bg-primary-light text-primary cursor-not-allowed"
            >
              <Send className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Homework OCR section */}
        <div className="bg-white rounded-xl border border-primary-light p-5 flex flex-col">
          <h3 className="text-sm font-semibold text-primary-dark mb-1">Homework OCR</h3>
          <p className="text-xs text-slate-500 mb-4">Drop your handwritten sheets here to scan</p>
          <div
            onClick={() => navigate('/student/assignments')}
            className="flex-1 border-2 border-dashed border-primary-light rounded-xl flex flex-col items-center justify-center p-6 hover:border-primary/40 hover:bg-primary-50 cursor-pointer transition-colors group"
          >
            <Upload className="w-8 h-8 text-primary/40 group-hover:text-primary mb-2 transition-colors" />
            <p className="text-xs text-slate-400 group-hover:text-slate-600 text-center">
              Click to upload or drag and drop
            </p>
          </div>
          {data?.upcoming_assignments?.length > 0 && (
            <div className="mt-3 flex items-center gap-2 text-xs text-slate-500">
              <FileText className="w-3.5 h-3.5" />
              <span className="truncate">{data.upcoming_assignments[0].title}</span>
            </div>
          )}
        </div>

        {/* Recommended Practice */}
        <div className="bg-white rounded-xl border border-primary-light p-5 flex flex-col">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-primary-dark">Recommended Practice</h3>
            <button
              onClick={() => navigate('/student/performance')}
              className="text-xs text-primary hover:underline"
            >
              View All Topics
            </button>
          </div>
          <div className="flex-1 space-y-2">
            {data?.enrolled_subjects?.map((subject, idx) => (
              <button
                key={idx}
                onClick={() => navigate('/student/assignments')}
                className="w-full flex items-center justify-between px-3 py-2.5 rounded-lg border border-primary-light hover:bg-primary-50 transition-colors group"
              >
                <div className="flex items-center gap-2">
                  <BookOpen className="w-4 h-4 text-primary" />
                  <span className="text-sm text-slate-700">{subject.subject_name}</span>
                </div>
                <ArrowRight className="w-4 h-4 text-slate-400 group-hover:text-primary transition-colors" />
              </button>
            ))}
            {(!data?.enrolled_subjects || data.enrolled_subjects.length === 0) && (
              <p className="text-sm text-slate-400 text-center py-4">No subjects enrolled</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
