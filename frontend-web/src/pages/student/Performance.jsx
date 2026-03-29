import { useState, useEffect } from 'react';
import {
  TrendingUp,
  TrendingDown,
  Target,
  Zap,
  Download,
  Share2,
  BookOpen,
  AlertTriangle,
} from 'lucide-react';
import { getProgress } from '../../services/studentService';

export default function StudentPerformance() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState('weekly');

  useEffect(() => {
    setLoading(true);
    getProgress(period)
      .then((r) => setData(r.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [period]);

  if (loading) {
    return (
      <div className="animate-pulse space-y-4">
        <div className="h-8 bg-slate-200 rounded w-48" />
        <div className="grid grid-cols-3 gap-4">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="h-28 bg-slate-200 rounded-xl" />
          ))}
        </div>
        <div className="h-64 bg-slate-200 rounded-xl" />
      </div>
    );
  }

  const avgScore = data?.average_score;
  const trend = data?.trend_percentage;

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-primary-dark">My Performance</h1>
          <p className="text-sm text-slate-500">Detailed visualization of your academic progression.</p>
        </div>
        <div className="flex gap-2">
          <button className="flex items-center gap-1.5 px-3 py-2 border border-primary-light rounded-lg text-sm text-slate-600 hover:bg-primary-50 transition-colors">
            <Download className="w-4 h-4" />
            Download Report
          </button>
          <button className="flex items-center gap-1.5 px-3 py-2 bg-primary-dark text-white rounded-lg text-sm hover:bg-primary transition-colors">
            <Share2 className="w-4 h-4" />
            Share Data
          </button>
        </div>
      </div>

      {/* Stats cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className="bg-white rounded-xl border border-primary-light p-5">
          <p className="text-xs text-slate-500 uppercase tracking-wider mb-1">Average Score</p>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-bold text-primary-dark">
              {avgScore ? `${avgScore.toFixed(0)}%` : '—'}
            </span>
            {trend !== null && trend !== undefined && (
              <span className={`text-sm flex items-center gap-0.5 ${trend >= 0 ? 'text-green-600' : 'text-red-500'}`}>
                {trend >= 0 ? <TrendingUp className="w-3.5 h-3.5" /> : <TrendingDown className="w-3.5 h-3.5" />}
                {Math.abs(trend).toFixed(1)}%
              </span>
            )}
          </div>
          {/* Mini bar chart placeholder */}
          <div className="flex items-end gap-1 mt-3 h-10">
            {[40, 60, 45, 70, 55, 80, 65].map((h, i) => (
              <div
                key={i}
                className="flex-1 bg-primary-light rounded-t"
                style={{ height: `${h}%` }}
              />
            ))}
          </div>
        </div>

        <div className="bg-white rounded-xl border border-primary-light p-5">
          <p className="text-xs text-slate-500 uppercase tracking-wider mb-1">Quizzes Completed</p>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-bold text-primary-dark">{data?.quizzes_completed || 0}</span>
            <span className="text-sm text-slate-400">Target: 75</span>
          </div>
          <div className="mt-3">
            <div className="w-full bg-slate-100 rounded-full h-2">
              <div
                className="bg-primary rounded-full h-2 transition-all"
                style={{ width: `${Math.min(100, ((data?.quizzes_completed || 0) / 75) * 100)}%` }}
              />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-primary-light p-5">
          <p className="text-xs text-slate-500 uppercase tracking-wider mb-1">Active Streak</p>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-bold text-primary-dark flex items-center gap-1">
              <Zap className="w-6 h-6 text-accent" />
              {data?.active_streak || 0}
            </span>
            <span className="text-sm text-slate-400">days</span>
          </div>
          <p className="text-xs text-slate-400 mt-2">Best: 28 days</p>
        </div>
      </div>

      {/* Period selector */}
      <div className="flex gap-2 mb-4">
        {['weekly', 'monthly'].map((p) => (
          <button
            key={p}
            onClick={() => setPeriod(p)}
            className={`px-4 py-1.5 rounded-lg text-sm font-medium capitalize transition-colors ${
              period === p
                ? 'bg-primary-dark text-white'
                : 'bg-white border border-primary-light text-slate-600 hover:bg-primary-50'
            }`}
          >
            {p}
          </button>
        ))}
      </div>

      {/* Score Progression Chart placeholder */}
      <div className="bg-white rounded-xl border border-primary-light p-6 mb-6">
        <h3 className="font-semibold text-primary-dark mb-4">Score Progression</h3>
        {data?.score_progression?.length > 0 ? (
          <div className="h-48 flex items-end gap-2">
            {data.score_progression.map((point, i) => (
              <div key={i} className="flex-1 flex flex-col items-center gap-1">
                <span className="text-[10px] text-slate-500">{point.score}%</span>
                <div
                  className="w-full bg-primary rounded-t transition-all"
                  style={{ height: `${Math.max(10, point.score * 1.5)}px` }}
                />
                <span className="text-[10px] text-slate-400 truncate w-full text-center">{point.period}</span>
              </div>
            ))}
          </div>
        ) : (
          <div className="h-48 flex items-center justify-center text-slate-400">
            <div className="text-center">
              <Target className="w-10 h-10 mx-auto mb-2 text-slate-300" />
              <p className="text-sm">Score progression data will appear after AI grading is active.</p>
              <p className="text-xs text-slate-400 mt-1">Charts powered by submission data from Sprint 6.</p>
            </div>
          </div>
        )}
      </div>

      {/* Bottom row: Topic Difficulty + Improvement Tips */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Topic Difficulty */}
        <div className="bg-white rounded-xl border border-primary-light p-5">
          <h3 className="font-semibold text-primary-dark mb-4">Topic Difficulty</h3>
          {data?.topic_difficulty?.length > 0 ? (
            <div className="space-y-3">
              {data.topic_difficulty.map((t, i) => (
                <div key={i}>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-slate-600">{t.topic}</span>
                    <span className="text-slate-400">{(t.difficulty_score * 100).toFixed(0)}%</span>
                  </div>
                  <div className="w-full bg-slate-100 rounded-full h-2">
                    <div
                      className={`rounded-full h-2 transition-all ${
                        t.difficulty_score > 0.6 ? 'bg-red-400' : t.difficulty_score > 0.3 ? 'bg-accent' : 'bg-green-400'
                      }`}
                      style={{ width: `${t.difficulty_score * 100}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-slate-400">
              <BookOpen className="w-8 h-8 mx-auto mb-2 text-slate-300" />
              <p className="text-sm">Topic difficulty data will appear as you complete submissions.</p>
            </div>
          )}
        </div>

        {/* At Risk + Improvement Tips */}
        <div className="space-y-4">
          {data?.at_risk_flag && (
            <div className="bg-red-50 rounded-xl border border-red-200 p-4 flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-red-500 mt-0.5 flex-shrink-0" />
              <div>
                <p className="font-semibold text-red-700 text-sm">At Risk Status</p>
                <p className="text-xs text-red-600">
                  Score levels have decreased. Focus on weaker topics to improve.
                </p>
              </div>
            </div>
          )}

          <div className="bg-white rounded-xl border border-primary-light p-5">
            <h3 className="font-semibold text-primary-dark mb-3">Improvement Tips</h3>
            {data?.improvement_tips?.length > 0 ? (
              <div className="space-y-3">
                {data.improvement_tips.map((tip, i) => (
                  <div key={i} className="flex items-start gap-2">
                    <div className="w-5 h-5 rounded-full bg-primary-light flex items-center justify-center flex-shrink-0 mt-0.5">
                      <span className="text-xs font-semibold text-primary">{i + 1}</span>
                    </div>
                    <p className="text-sm text-slate-600">{tip}</p>
                  </div>
                ))}
              </div>
            ) : (
              <div className="space-y-3">
                <div className="flex items-start gap-2">
                  <div className="w-5 h-5 rounded-full bg-primary-light flex items-center justify-center flex-shrink-0 mt-0.5">
                    <span className="text-xs font-semibold text-primary">1</span>
                  </div>
                  <p className="text-sm text-slate-600">Revise Integration Methods for a refresher</p>
                </div>
                <div className="flex items-start gap-2">
                  <div className="w-5 h-5 rounded-full bg-primary-light flex items-center justify-center flex-shrink-0 mt-0.5">
                    <span className="text-xs font-semibold text-primary">2</span>
                  </div>
                  <p className="text-sm text-slate-600">Schedule a Mentor Session to discuss progress</p>
                </div>
                <div className="flex items-start gap-2">
                  <div className="w-5 h-5 rounded-full bg-primary-light flex items-center justify-center flex-shrink-0 mt-0.5">
                    <span className="text-xs font-semibold text-primary">3</span>
                  </div>
                  <p className="text-sm text-slate-600">Practice Quiz: Trig Identities to strengthen weak areas</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
