import { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { fmtDate } from '../../utils/dateUtils';
import {
  TrendingUp,
  TrendingDown,
  Target,
  Zap,
  Download,
  Share2,
  BookOpen,
  AlertTriangle,
  GraduationCap,
  Radio,
} from 'lucide-react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  Cell,
} from 'recharts';
import { jsPDF } from 'jspdf';
import toast from 'react-hot-toast';
import { getProgress } from '../../services/studentService';

function httpToWsOrigin(apiBase) {
  try {
    const u = new URL(apiBase.startsWith('http') ? apiBase : `http://${apiBase}`);
    u.protocol = u.protocol === 'https:' ? 'wss:' : 'ws:';
    return u.origin;
  } catch {
    return 'ws://localhost:8000';
  }
}

const PDF_NAVY = [15, 46, 92];
const PDF_SLATE = [71, 85, 105];
const PDF_LINE = [226, 232, 240];

function buildPerformanceText(data, periodLabel) {
  const lines = [];
  lines.push(`Period: ${periodLabel}`);
  lines.push(`Average score: ${data?.average_score != null ? `${Number(data.average_score).toFixed(1)}%` : '—'}`);
  lines.push(`Trend vs prior period: ${data?.trend_percentage != null ? `${data.trend_percentage >= 0 ? '+' : ''}${data.trend_percentage}%` : '—'}`);
  lines.push(`Quizzes completed: ${data?.quizzes_completed ?? 0}`);
  lines.push(`Active streak: ${data?.active_streak ?? 0} days`);
  lines.push('');
  if (data?.score_progression?.length) {
    lines.push('Score progression (snapshot):');
    data.score_progression.slice(-8).forEach((p) => {
      lines.push(`  • ${p.period}: ${p.score}% (${p.subject || '—'})`);
    });
    lines.push('');
  }
  if (data?.topic_difficulty?.length) {
    lines.push('Topic difficulty (from gap tags):');
    data.topic_difficulty.forEach((t) => {
      lines.push(`  • ${t.topic}: ${(Number(t.difficulty_score) * 100).toFixed(0)}%`);
    });
    lines.push('');
  }
  if (data?.recent_knowledge_gaps?.length) {
    lines.push('Recent knowledge gaps:');
    data.recent_knowledge_gaps.slice(0, 8).forEach((g) => {
      lines.push(`  • ${g.concept_name} — ${g.subject_name || 'Subject'} (${g.is_resolved ? 'resolved' : 'open'})`);
    });
    lines.push('');
  }
  if (data?.improvement_tips?.length) {
    lines.push('Improvement tips:');
    data.improvement_tips.forEach((tip, i) => lines.push(`  ${i + 1}. ${tip}`));
  }
  return lines.join('\n');
}

function downloadPerformancePdf(data, periodLabel) {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const margin = 16;
  const contentW = pageW - margin * 2;
  let y = 0;

  const ensureSpace = (mm) => {
    if (y + mm > pageH - 14) {
      doc.setFontSize(8);
      doc.setTextColor(...PDF_SLATE);
      doc.text('Gyanavriksha · Confidential student report', margin, pageH - 8);
      doc.addPage();
      y = margin;
      doc.setTextColor(0, 0, 0);
      return true;
    }
    return false;
  };

  const sectionTitle = (title) => {
    ensureSpace(12);
    doc.setDrawColor(...PDF_LINE);
    doc.setLineWidth(0.3);
    doc.line(margin, y, pageW - margin, y);
    y += 6;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(...PDF_NAVY);
    doc.text(title, margin, y);
    y += 6;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9.5);
    doc.setTextColor(...PDF_SLATE);
  };

  const paragraph = (text, indent = 0) => {
    const wrapped = doc.splitTextToSize(text, contentW - indent);
    wrapped.forEach((row) => {
      ensureSpace(6);
      doc.text(row, margin + indent, y);
      y += 4.5;
    });
  };

  // Header band
  doc.setFillColor(...PDF_NAVY);
  doc.rect(0, 0, pageW, 28, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(20);
  doc.text('Gyanavriksha', margin, 18);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10.5);
  doc.text('Student performance report', margin, 24);
  doc.setTextColor(0, 0, 0);
  y = 36;

  doc.setFontSize(9);
  doc.setTextColor(...PDF_SLATE);
  doc.text(`View: ${periodLabel}`, margin, y);
  doc.text(`Generated ${new Date().toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })}`, margin + 78, y);
  y += 10;

  sectionTitle('Overview');
  const avg = data?.average_score != null ? `${Number(data.average_score).toFixed(1)}%` : '—';
  const trend =
    data?.trend_percentage != null
      ? `${data.trend_percentage >= 0 ? '+' : ''}${Number(data.trend_percentage).toFixed(1)}% vs prior`
      : '—';
  const metrics = [
    ['Average score', avg],
    ['Trend (last vs prior period)', trend],
    ['Quizzes completed', String(data?.quizzes_completed ?? 0)],
    ['Active streak', `${data?.active_streak ?? 0} days`],
  ];
  metrics.forEach(([k, v]) => {
    ensureSpace(8);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(...PDF_SLATE);
    doc.text(k, margin, y);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...PDF_NAVY);
    doc.text(v, margin + 72, y);
    y += 6;
  });
  y += 6;

  if (data?.at_risk_flag) {
    doc.setFillColor(254, 242, 242);
    doc.rect(margin, y - 2, contentW, 14, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(185, 28, 28);
    doc.text('At-risk flag: recent scores suggest focusing on weaker topics.', margin + 3, y + 4);
    y += 18;
  }

  const prog = data?.score_progression || [];
  sectionTitle('Score progression');
  if (prog.length) {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(...PDF_NAVY);
    doc.text('Period', margin, y);
    doc.text('Score', margin + 58, y);
    doc.text('Subject', margin + 82, y);
    y += 5;
    doc.setDrawColor(...PDF_LINE);
    doc.line(margin, y, pageW - margin, y);
    y += 4;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    prog.slice(-12).forEach((p) => {
      ensureSpace(8);
      doc.setTextColor(...PDF_SLATE);
      doc.text(String(p.period || '—'), margin, y);
      doc.setTextColor(...PDF_NAVY);
      doc.text(`${p.score}%`, margin + 58, y);
      doc.setTextColor(...PDF_SLATE);
      const sub = doc.splitTextToSize(String(p.subject || '—'), 72);
      doc.text(sub[0], margin + 82, y);
      y += 5;
    });
    y += 4;
  } else {
    paragraph(
      'No score progression snapshots in this export. Average score still uses graded submissions; the live dashboard may derive weekly/monthly bars from graded work when rollup rows are missing.',
    );
    y += 2;
  }

  const topics = data?.topic_difficulty || [];
  sectionTitle('Topic difficulty (from gap patterns)');
  if (topics.length) {
    topics.slice(0, 10).forEach((t) => {
      ensureSpace(7);
      doc.setTextColor(...PDF_SLATE);
      doc.text(`${t.topic}`, margin, y);
      doc.setTextColor(...PDF_NAVY);
      doc.text(`${(Number(t.difficulty_score) * 100).toFixed(0)}%`, pageW - margin, y, { align: 'right' });
      y += 6;
    });
  } else {
    paragraph('No topic breakdown yet — gaps will populate topic estimates over time.');
  }

  const gaps = data?.recent_knowledge_gaps || [];
  sectionTitle('Knowledge gaps (recent)');
  if (gaps.length) {
    gaps.slice(0, 10).forEach((g) => {
      ensureSpace(8);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9);
      doc.setTextColor(...PDF_NAVY);
      doc.text(String(g.concept_name || ''), margin, y);
      y += 4;
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      doc.setTextColor(...PDF_SLATE);
      doc.text(
        `${g.subject_name || ''} · ${g.is_resolved ? 'Resolved' : 'Open'}${g.quiz_status ? ` · Quiz: ${g.quiz_status}` : ''}`,
        margin,
        y,
      );
      y += 6;
    });
  } else {
    paragraph('No knowledge gaps recorded.');
  }

  const tips = data?.improvement_tips || [];
  sectionTitle('Improvement suggestions');
  if (tips.length) {
    tips.forEach((tip, i) => {
      paragraph(`${i + 1}. ${tip}`, 0);
      y += 1;
    });
  } else {
    paragraph('Keep using Micro Quizzes on open gaps and submit work for AI grading to unlock tailored tips.');
  }

  ensureSpace(12);
  doc.setDrawColor(...PDF_LINE);
  doc.line(margin, y, pageW - margin, y);
  y += 6;
  doc.setFontSize(8);
  doc.setTextColor(...PDF_SLATE);
  doc.text('gyanavriksha · Learning analytics export', margin, y);

  const totalPages = doc.getNumberOfPages();
  for (let i = 1; i <= totalPages; i += 1) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(180, 180, 180);
    doc.text(`Page ${i} / ${totalPages}`, pageW - margin - 18, pageH - 8);
  }

  doc.save(`gyanavriksha-performance-${periodLabel}.pdf`);
}

async function sharePerformanceSummary(data, periodLabel) {
  const text = buildPerformanceText(data, periodLabel);
  const title = 'My Gyanavriksha performance';
  try {
    if (navigator.share) {
      await navigator.share({ title, text });
      return;
    }
  } catch (e) {
    if (e?.name === 'AbortError') return;
  }
  try {
    await navigator.clipboard.writeText(`${title}\n\n${text}`);
    toast.success('Summary copied to clipboard');
  } catch {
    toast.error('Could not copy — select text manually');
  }
}

export default function StudentPerformance() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [backgroundRefreshing, setBackgroundRefreshing] = useState(false);
  const [period, setPeriod] = useState('weekly');
  const [wsState, setWsState] = useState(() =>
    typeof window !== 'undefined' && localStorage.getItem('access_token') ? 'idle' : 'closed'
  );

  const periodRef = useRef(period);
  useEffect(() => {
    periodRef.current = period;
  }, [period]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      await Promise.resolve();
      if (cancelled) return;
      setLoading(true);
      try {
        const r = await getProgress(period);
        if (!cancelled) setData(r.data);
      } catch {
        /* ignore */
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [period]);

  useEffect(() => {
    const token = localStorage.getItem('access_token');
    if (!token) {
      return undefined;
    }
    const apiBase = import.meta.env.VITE_API_URL || 'http://localhost:8000';
    const wsOrigin = httpToWsOrigin(apiBase);
    const url = `${wsOrigin}/api/students/ws/performance?token=${encodeURIComponent(token)}`;
    const ws = new WebSocket(url);
    queueMicrotask(() => setWsState('connecting'));
    ws.onopen = () => setWsState('open');
    ws.onclose = () => setWsState('closed');
    ws.onerror = () => setWsState('error');
    ws.onmessage = (ev) => {
      try {
        const msg = JSON.parse(ev.data);
        if (msg.type === 'refresh_performance') {
          (async () => {
            setBackgroundRefreshing(true);
            try {
              const r = await getProgress(periodRef.current);
              setData(r.data);
            } catch {
              /* ignore */
            } finally {
              setBackgroundRefreshing(false);
            }
          })();
        }
      } catch {
        /* ignore non-JSON */
      }
    };
    return () => {
      ws.close();
    };
  }, []);

  const chartData = (data?.score_progression || []).map((p) => ({
    name: p.period,
    score: Math.min(100, Math.max(0, Number(p.score) || 0)),
    subject: p.subject,
  }));

  const miniBars = (() => {
    const series = (data?.score_progression || []).slice(-7);
    if (!series.length) return null;
    const max = Math.max(20, ...series.map((p) => Number(p.score) || 0), 1);
    return series.map((p, i) => ({
      key: i,
      h: Math.round(((Number(p.score) || 0) / max) * 100),
    }));
  })();

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
    <div className="relative">
      {backgroundRefreshing && (
        <div
          className="pointer-events-none fixed top-0 left-0 right-0 z-40 h-0.5 bg-primary/80 animate-pulse"
          aria-hidden
        />
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-2xl font-bold text-primary-dark">My Performance</h1>
            <span
              className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full border ${
                wsState === 'open'
                  ? 'border-green-200 bg-green-50 text-green-700'
                  : wsState === 'connecting'
                    ? 'border-slate-200 bg-slate-50 text-slate-600'
                    : 'border-slate-200 bg-white text-slate-500'
              }`}
              title="Live sync uses a WebSocket to refresh this page when new grades or gaps arrive."
            >
              <Radio className={`w-3 h-3 ${wsState === 'open' ? 'text-green-600' : ''}`} />
              {wsState === 'open'
                ? 'Live sync on'
                : wsState === 'connecting'
                  ? 'Connecting…'
                  : 'Live sync off'}
            </span>
          </div>
          <p className="text-sm text-slate-500 mt-1">
            Trends, gaps, and tips update as you submit work. Keep this page open for automatic refreshes.
          </p>
        </div>
        <div className="flex gap-2 flex-shrink-0">
          <button
            type="button"
            onClick={() => {
              try {
                downloadPerformancePdf(data, period);
                toast.success('Report downloaded');
              } catch {
                toast.error('Could not generate PDF');
              }
            }}
            className="flex items-center gap-1.5 px-3 py-2 border border-primary-light rounded-lg text-sm text-slate-600 hover:bg-primary-50 transition-colors"
          >
            <Download className="w-4 h-4" />
            Download Report
          </button>
          <button
            type="button"
            onClick={() => sharePerformanceSummary(data, period)}
            className="flex items-center gap-1.5 px-3 py-2 bg-primary-dark text-white rounded-lg text-sm hover:bg-primary transition-colors"
          >
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
              {avgScore != null ? `${Number(avgScore).toFixed(0)}%` : '—'}
            </span>
            {trend != null && trend !== undefined && (
              <span className={`text-sm flex items-center gap-0.5 ${trend >= 0 ? 'text-green-600' : 'text-red-500'}`}>
                {trend >= 0 ? <TrendingUp className="w-3.5 h-3.5" /> : <TrendingDown className="w-3.5 h-3.5" />}
                {Math.abs(trend).toFixed(1)}%
              </span>
            )}
          </div>
          <div className="flex items-end gap-1 mt-3 h-10">
            {miniBars ? (
              miniBars.map((b) => (
                <div
                  key={b.key}
                  className="flex-1 bg-primary-light rounded-t transition-all"
                  style={{ height: `${b.h}%` }}
                  title="Recent period scores"
                />
              ))
            ) : (
              [...Array(7)].map((_, i) => (
                <div
                  key={i}
                  className="flex-1 bg-slate-100 rounded-t"
                  style={{ height: `${15 + (i % 3) * 5}%` }}
                />
              ))
            )}
          </div>
          <p className="text-[11px] text-slate-400 mt-1">
            {miniBars
              ? 'Last periods (rollup or averages from graded submissions)'
              : avgScore != null
                ? 'Bars use rolled-up snapshots when present; otherwise the API builds weekly/monthly averages from graded work.'
                : 'Sparkline appears once graded assignments exist across at least two calendar periods.'}
          </p>
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
          <p className="text-xs text-slate-400 mt-2 leading-relaxed">
            Consecutive UTC days with a graded submission or a completed micro-quiz. If you have nothing logged yet
            today, yesterday still counts so the streak continues into the morning.
          </p>
        </div>
      </div>

      {/* Period selector */}
      <div className="flex gap-2 mb-4">
        {['weekly', 'monthly'].map((p) => (
          <button
            key={p}
            type="button"
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

      {/* Knowledge gaps */}
      <div className="bg-white rounded-xl border border-primary-light p-6 mb-6">
        <div className="flex items-start justify-between gap-4 mb-4">
          <div>
            <h3 className="font-semibold text-primary-dark">Knowledge gaps</h3>
            <p className="text-xs text-slate-500 mt-1 max-w-2xl">
              Weak areas are detected when AI grading flags a gap, or when a chat session is scanned for
              misconceptions. Targeted micro-quizzes are created when you do not already have one in progress
              for the same gap.
            </p>
          </div>
          <Link
            to="/student/knowledge-gaps"
            className="text-sm font-medium text-primary whitespace-nowrap hover:underline"
          >
            View all
          </Link>
        </div>
        {data?.recent_knowledge_gaps?.length > 0 ? (
          <ul className="divide-y divide-slate-100">
            {data.recent_knowledge_gaps.map((g) => {
              const microQuizHref = g.quiz_id
                ? `/student/micro-quiz?quiz_id=${g.quiz_id}`
                : `/student/micro-quiz?gap_id=${g.gap_id}&concept=${encodeURIComponent(g.concept_name)}&subject_id=${g.subject_id ?? ''}`;
              const detected =
                g.detected_at != null
                  ? fmtDate(g.detected_at, {
                      month: 'short',
                      day: 'numeric',
                      year: 'numeric',
                    })
                  : null;
              const quizLabel =
                g.quiz_status === 'ASSIGNED'
                  ? 'Quiz ready'
                  : g.quiz_status === 'IN_PROGRESS'
                    ? 'Quiz in progress'
                    : g.quiz_status === 'COMPLETED'
                      ? 'Quiz completed'
                      : null;
              return (
                <li key={g.gap_id} className="py-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                  <div className="flex items-start gap-3 min-w-0">
                    <GraduationCap className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" />
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-slate-800 truncate">{g.concept_name}</p>
                      <p className="text-xs text-slate-500">
                        {g.subject_name}
                        {detected ? ` · ${detected}` : ''}
                        {g.recurrence_count > 1 ? ` · ×${g.recurrence_count}` : ''}
                      </p>
                      <p className="text-[11px] text-slate-400 font-mono mt-0.5 truncate">{g.topic_tag}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <span
                      className={`text-xs px-2 py-0.5 rounded-full ${
                        g.is_resolved ? 'bg-green-50 text-green-700' : 'bg-amber-50 text-amber-800'
                      }`}
                    >
                      {g.is_resolved ? 'Resolved' : 'Open'}
                    </span>
                    {quizLabel && (
                      <span className="text-xs text-slate-500 hidden sm:inline">{quizLabel}</span>
                    )}
                    <Link
                      to={microQuizHref}
                      className="text-sm px-3 py-1.5 rounded-lg bg-primary-dark text-white hover:bg-primary transition-colors"
                    >
                      Micro Quiz
                    </Link>
                  </div>
                </li>
              );
            })}
          </ul>
        ) : (
          <div className="text-center py-8 text-slate-400">
            <BookOpen className="w-8 h-8 mx-auto mb-2 text-slate-300" />
            <p className="text-sm">No knowledge gaps recorded yet.</p>
            <p className="text-xs mt-1">Submit work for AI grading or use the tutor with gap detection enabled.</p>
          </div>
        )}
      </div>

      {/* Score Progression */}
      <div className="bg-white rounded-xl border border-primary-light p-6 mb-6">
        <h3 className="font-semibold text-primary-dark mb-1">Score Progression</h3>
        <p className="text-xs text-slate-500 mb-4">
          Bars show your <strong>average score per calendar {period === 'weekly' ? 'week' : 'month'}</strong>, usually from
          rolled-up progress records. When those snapshots are missing, the server derives the same buckets from graded
          submission dates (overall line shown as subject &quot;Overall&quot;).
        </p>
        {chartData.length > 0 ? (
          <div className="h-56 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-slate-200" />
                <XAxis dataKey="name" tick={{ fontSize: 10 }} className="text-slate-500" />
                <YAxis domain={[0, 100]} tick={{ fontSize: 10 }} width={32} unit="%" />
                <Tooltip
                  formatter={(value) => [`${value}%`, 'Score']}
                  labelFormatter={(label, items) =>
                    items?.[0]?.payload?.subject ? `${label} · ${items[0].payload.subject}` : label
                  }
                />
                <Bar dataKey="score" radius={[4, 4, 0, 0]}>
                  {chartData.map((entry, index) => (
                    <Cell
                      key={`cell-${index}`}
                      fill={
                        entry.score >= 70 ? '#22c55e' : entry.score >= 50 ? '#f59e0b' : '#ef4444'
                      }
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <div className="min-h-[12rem] flex items-center justify-center text-slate-400 px-4">
            <div className="text-center max-w-md space-y-3">
              <Target className="w-10 h-10 mx-auto text-slate-300" />
              <p className="text-sm text-slate-600 font-medium">No weekly/monthly bars yet</p>
              <p className="text-sm text-slate-600">
                <strong>Why the chart might still be empty:</strong> you need graded assignments with scores. The API
                will build buckets from graded submission timestamps when rollup rows don&apos;t exist yet.
              </p>
              <p className="text-sm text-slate-600">
                <strong>To see bars:</strong> submit work until at least one piece is graded. Multiple weeks/months produce
                several bars when you choose the matching period toggle.
              </p>
              <Link
                to="/student/submissions"
                className="inline-flex items-center justify-center text-sm font-medium text-primary hover:underline"
              >
                View submissions &amp; grading status
              </Link>
            </div>
          </div>
        )}
      </div>

      {/* Topic Difficulty + Improvement Tips */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-white rounded-xl border border-primary-light p-5">
          <h3 className="font-semibold text-primary-dark mb-1">Topic Difficulty</h3>
          <p className="text-xs text-slate-500 mb-4">
            Estimated from how often each topic tag appears in your knowledge gaps (higher means more recurring
            difficulty).
          </p>
          {data?.topic_difficulty?.length > 0 ? (
            <div className="space-y-3">
              {data.topic_difficulty.map((t, i) => (
                <div key={i}>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-slate-600 truncate pr-2">{t.topic}</span>
                    <span className="text-slate-400 flex-shrink-0">
                      {(Number(t.difficulty_score) * 100).toFixed(0)}%
                    </span>
                  </div>
                  <div className="w-full bg-slate-100 rounded-full h-2">
                    <div
                      className={`rounded-full h-2 transition-all ${
                        t.difficulty_score > 0.6 ? 'bg-red-400' : t.difficulty_score > 0.3 ? 'bg-accent' : 'bg-green-400'
                      }`}
                      style={{ width: `${Math.min(100, Number(t.difficulty_score) * 100)}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-slate-400 px-2">
              <BookOpen className="w-8 h-8 mx-auto mb-2 text-slate-300" />
              <p className="text-sm text-slate-600 font-medium">No topic breakdown yet</p>
              <p className="text-sm mt-2">
                Topics are inferred from your knowledge-gap tags. Complete graded submissions or chat sessions that
                trigger gap detection, then reopen this page (or wait for live sync).
              </p>
            </div>
          )}
        </div>

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
            <h3 className="font-semibold text-primary-dark mb-1">Improvement Tips</h3>
            <p className="text-xs text-slate-500 mb-3">
              Suggestions are built from your open knowledge gaps and linked subjects.
            </p>
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
              <ul className="text-sm text-slate-600 space-y-2 list-disc list-inside marker:text-primary">
                <li>Open any gap shown above and use Micro Quiz when a quiz is linked.</li>
                <li>Check Submissions after upload so AI grading can finish and refresh your scores.</li>
                <li>Use the AI tutor; scanned chats can surface new gaps and practice quizzes.</li>
              </ul>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
