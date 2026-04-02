import { useState, useEffect } from 'react';
import {
  Grid3X3,
  Loader2,
  Lightbulb,
  AlertCircle,
  Users,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { getConceptHeatmap, getSubjects } from '../../services/instructorService';

function SeverityCell({ percentage }) {
  const intensity =
    percentage >= 60 ? 'bg-red-500 text-white' :
    percentage >= 40 ? 'bg-red-300 text-white' :
    percentage >= 20 ? 'bg-amber-300 text-amber-900' :
    percentage > 0 ? 'bg-amber-100 text-amber-800' :
    'bg-slate-100 text-slate-500';
  return (
    <div className={`rounded-lg p-4 text-center min-h-[100px] flex flex-col justify-between ${intensity}`}>
      <span className="text-2xl font-bold">{percentage.toFixed(0)}%</span>
    </div>
  );
}

export default function ConceptHeatmapPage() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [subjects, setSubjects] = useState([]);
  const [subjectId, setSubjectId] = useState('');
  const [timeframe, setTimeframe] = useState('all');

  useEffect(() => {
    getSubjects().then((r) => setSubjects(r.data || [])).catch(() => {});
  }, []);

  useEffect(() => {
    setLoading(true);
    const params = { timeframe };
    if (subjectId) params.subject_id = Number(subjectId);
    getConceptHeatmap(params)
      .then((res) => setData(res.data))
      .catch(() => toast.error('Failed to load heatmap'))
      .finally(() => setLoading(false));
  }, [subjectId, timeframe]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-primary-light flex items-center justify-center">
            <Grid3X3 className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-primary-dark">Concept Heatmap</h1>
            <p className="text-sm text-slate-500">Identify topic areas where students struggle most.</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <select
            value={timeframe}
            onChange={(e) => setTimeframe(e.target.value)}
            className="px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
          >
            <option value="all">All Time</option>
            <option value="30d">Last 30 Days</option>
            <option value="7d">Last 7 Days</option>
          </select>
          <select
            value={subjectId}
            onChange={(e) => setSubjectId(e.target.value)}
            className="px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
          >
            <option value="">All Subjects</option>
            {subjects.map((s) => (
              <option key={s.subject_id} value={s.subject_id}>{s.subject_name}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Teaching Insight */}
      {data?.teaching_insight && (
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 mb-6 flex items-start gap-3">
          <Lightbulb className="w-5 h-5 text-blue-600 mt-0.5 shrink-0" />
          <div>
            <p className="text-sm font-medium text-blue-800">Teaching Insight</p>
            <p className="text-sm text-blue-700 mt-1">{data.teaching_insight}</p>
          </div>
        </div>
      )}

      {/* Emerging Friction */}
      {data?.emerging_friction?.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
          {data.emerging_friction.map((item, idx) => (
            <div key={idx} className="bg-primary-dark rounded-xl p-5 text-white">
              <span className="text-3xl font-bold">{item.percentage.toFixed(0)}%</span>
              <p className="text-white/90 text-sm font-medium mt-2">{item.topic}</p>
              <p className="text-white/50 text-xs">{item.subject}</p>
            </div>
          ))}
        </div>
      )}

      {/* Heatmap Grid */}
      {data?.heatmap_entries?.length > 0 ? (
        <div className="bg-white rounded-xl border border-primary-light p-6">
          <h2 className="text-lg font-bold text-primary-dark mb-4">All Concept Areas</h2>

          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-primary-light">
                  <th className="text-left py-2 px-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Topic</th>
                  <th className="text-left py-2 px-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Concept</th>
                  <th className="text-left py-2 px-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Subject</th>
                  <th className="text-center py-2 px-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Struggle %</th>
                  <th className="text-center py-2 px-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Affected</th>
                  <th className="text-center py-2 px-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Avg Score</th>
                </tr>
              </thead>
              <tbody>
                {data.heatmap_entries.map((entry, idx) => {
                  const rowColor =
                    entry.struggle_percentage >= 60 ? 'bg-red-50' :
                    entry.struggle_percentage >= 40 ? 'bg-amber-50' :
                    '';
                  return (
                    <tr key={idx} className={`border-b border-slate-50 hover:bg-slate-50/50 ${rowColor}`}>
                      <td className="py-3 px-3">
                        <span className="text-sm font-semibold text-primary-dark">{entry.topic_tag}</span>
                      </td>
                      <td className="py-3 px-3 text-sm text-slate-600">{entry.concept_name}</td>
                      <td className="py-3 px-3 text-sm text-slate-500">{entry.subject_name}</td>
                      <td className="py-3 px-3 text-center">
                        <div className="flex items-center justify-center gap-2">
                          <div className="w-16 h-2 bg-slate-100 rounded-full overflow-hidden">
                            <div
                              className={`h-full rounded-full ${
                                entry.struggle_percentage >= 60 ? 'bg-red-500' :
                                entry.struggle_percentage >= 40 ? 'bg-amber-500' :
                                'bg-yellow-400'
                              }`}
                              style={{ width: `${Math.min(entry.struggle_percentage, 100)}%` }}
                            />
                          </div>
                          <span className="text-xs font-semibold text-slate-600">{entry.struggle_percentage.toFixed(1)}%</span>
                        </div>
                      </td>
                      <td className="py-3 px-3 text-center">
                        <span className="flex items-center justify-center gap-1 text-sm text-slate-600">
                          <Users className="w-3.5 h-3.5" /> {entry.affected_student_count}
                        </span>
                      </td>
                      <td className="py-3 px-3 text-center text-sm font-semibold text-primary-dark">
                        {entry.avg_score != null ? `${entry.avg_score}%` : '—'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="bg-white border border-primary-light rounded-xl p-12 text-center">
          <Grid3X3 className="w-12 h-12 text-slate-300 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-primary-dark mb-2">No Heatmap Data</h3>
          <p className="text-slate-500 text-sm">Concept struggle areas will appear after students submit graded work.</p>
        </div>
      )}
    </div>
  );
}
