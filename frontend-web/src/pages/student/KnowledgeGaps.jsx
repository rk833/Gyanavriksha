import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  AlertCircle,
  CheckCircle,
  Clock,
  BookOpen,
  BarChart3,
} from 'lucide-react';
import { getKnowledgeGaps, getKnowledgeGapSummary } from '../../services/studentService';

export default function StudentKnowledgeGaps() {
  const navigate = useNavigate();
  const [gaps, setGaps] = useState([]);
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all'); // all, pending, resolved

  useEffect(() => {
    const params = {};
    if (filter === 'pending') params.resolved = false;
    if (filter === 'resolved') params.resolved = true;

    Promise.all([
      getKnowledgeGaps(params).then((r) => setGaps(r.data.items || [])),
      getKnowledgeGapSummary().then((r) => setSummary(r.data)),
    ])
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [filter]);

  // Group gaps by subject
  const grouped = gaps.reduce((acc, g) => {
    const key = g.subject_name || 'Unknown';
    if (!acc[key]) acc[key] = [];
    acc[key].push(g);
    return acc;
  }, {});

  return (
    <div>
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-primary-dark">Knowledge Gap History</h1>
        <p className="text-sm text-slate-500">
          Review your identified learning gaps and track your progress as you master challenging concepts across your curriculum.
        </p>
      </div>

      {/* Summary cards */}
      {summary && (
        <div className="grid grid-cols-3 gap-4 mb-6">
          <div className="bg-white rounded-xl border border-primary-light p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center">
              <AlertCircle className="w-5 h-5 text-slate-500" />
            </div>
            <div>
              <p className="text-xs text-slate-500 uppercase tracking-wider">Total Gaps Detected</p>
              <p className="text-2xl font-bold text-primary-dark">{summary.total_gaps}</p>
            </div>
          </div>
          <div className="bg-white rounded-xl border border-primary-light p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center">
              <CheckCircle className="w-5 h-5 text-green-600" />
            </div>
            <div>
              <p className="text-xs text-slate-500 uppercase tracking-wider">Gaps Resolved</p>
              <p className="text-2xl font-bold text-green-600">{summary.gaps_resolved}</p>
            </div>
          </div>
          <div className="bg-white rounded-xl border border-primary-light p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-accent/10 flex items-center justify-center">
              <Clock className="w-5 h-5 text-accent" />
            </div>
            <div>
              <p className="text-xs text-slate-500 uppercase tracking-wider">Pending Gaps</p>
              <p className="text-2xl font-bold text-accent">{summary.gaps_pending}</p>
            </div>
          </div>
        </div>
      )}

      {/* Filter tabs */}
      <div className="flex gap-2 mb-5">
        {[
          { key: 'all', label: 'All' },
          { key: 'pending', label: 'Pending' },
          { key: 'resolved', label: 'Resolved' },
        ].map((tab) => (
          <button
            key={tab.key}
            onClick={() => setFilter(tab.key)}
            className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              filter === tab.key
                ? 'bg-primary-dark text-white'
                : 'bg-white border border-primary-light text-slate-600 hover:bg-primary-50'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Grouped gaps */}
      {loading ? (
        <div className="space-y-4">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="animate-pulse bg-white rounded-xl border border-primary-light p-5 h-20" />
          ))}
        </div>
      ) : Object.keys(grouped).length === 0 ? (
        <div className="text-center py-12 bg-white rounded-xl border border-primary-light">
          <CheckCircle className="w-12 h-12 text-green-300 mx-auto mb-3" />
          <p className="text-slate-500">
            {filter === 'all' ? 'No knowledge gaps detected yet.' : `No ${filter} gaps found.`}
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {Object.entries(grouped).map(([subject, subjectGaps]) => (
            <div key={subject}>
              <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">{subject}</h3>
              <div className="space-y-2">
                {subjectGaps.map((gap) => (
                  <div
                    key={gap.gap_id}
                    className="bg-white rounded-xl border border-primary-light p-4 flex items-center justify-between hover:shadow-sm transition-shadow"
                  >
                    <div className="flex items-center gap-3">
                      <div className={`w-2 h-2 rounded-full flex-shrink-0 ${gap.is_resolved ? 'bg-green-500' : 'bg-accent'}`} />
                      <div>
                        <p className="font-medium text-primary-dark text-sm">{gap.concept_name}</p>
                        <div className="flex items-center gap-3 mt-0.5">
                          <span className="text-xs text-slate-400">
                            {new Date(gap.detected_at).toLocaleDateString()}
                          </span>
                          <span className={`text-xs px-1.5 py-0.5 rounded ${
                            gap.recurrence_count > 2
                              ? 'bg-red-100 text-red-600'
                              : gap.recurrence_count > 1
                              ? 'bg-accent/10 text-accent'
                              : 'bg-slate-100 text-slate-500'
                          }`}>
                            {gap.recurrence_count}x detected
                          </span>
                        </div>
                      </div>
                    </div>
                    <button
                      onClick={() => {
                        if (gap.is_resolved) {
                          navigate('/student/submissions');
                        } else {
                          navigate(
                            `/student/micro-quiz?gap_id=${gap.gap_id}&concept=${encodeURIComponent(gap.concept_name)}&subject_id=${gap.subject_id || ''}`
                          );
                        }
                      }}
                      className="text-xs bg-primary-dark text-white px-3 py-1.5 rounded-lg hover:bg-primary transition-colors"
                    >
                      {gap.is_resolved ? 'Review Results' : 'Linked Quiz'}
                    </button>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Academic completion banner */}
      <div className="mt-8 bg-primary-dark rounded-xl p-5 flex items-center justify-between text-white">
        <div>
          <h3 className="font-bold text-lg">Academic Completion Progress</h3>
          <p className="text-sm text-white/70">
            You've resolved {summary?.gaps_resolved || 0} of {summary?.total_gaps || 0} identified knowledge gaps this semester. Keep going to reach your academic goals.
          </p>
        </div>
        <button
          onClick={() => navigate('/student/performance')}
          className="bg-white text-primary-dark px-4 py-2 rounded-lg text-sm font-semibold hover:bg-white/90 transition-colors flex-shrink-0"
        >
          <BarChart3 className="w-4 h-4 inline mr-1.5" />
          Detailed Analytics
        </button>
      </div>
    </div>
  );
}
