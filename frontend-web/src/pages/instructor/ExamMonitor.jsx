import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { fmtDateTime, fmtTime } from '../../utils/dateUtils';
import { useQuery } from '@tanstack/react-query';
import {
  Monitor, Users, PauseCircle, FileCheck, Clock, ChevronDown, Radio,
  Sun, Shield, Cpu, Loader2, ListFilter,
} from 'lucide-react';
import { getExamMonitor } from '../../services/instructorService';

function formatSeconds(sec) {
  if (sec == null || Number.isNaN(sec)) return '—';
  const s = Math.max(0, Math.floor(Number(sec)));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${String(m).padStart(2, '0')}:${String(r).padStart(2, '0')}`;
}

function sessionStatusLabel(code) {
  const map = {
    active: 'ACTIVE',
    paused: 'PAUSED',
    submitted: 'SUBMITTED',
    not_started: 'NOT STARTED',
    ended: 'ENDED',
  };
  return map[code] ?? code?.toUpperCase() ?? '—';
}

const STATUS_CARD = {
  active: 'bg-emerald-50 text-emerald-800 ring-1 ring-emerald-100',
  paused: 'bg-amber-50 text-amber-900 ring-1 ring-amber-100',
  submitted: 'bg-slate-100 text-slate-700 ring-1 ring-slate-200',
  not_started: 'bg-slate-50 text-slate-500 ring-1 ring-slate-100',
  ended: 'bg-red-50 text-red-700 ring-1 ring-red-100',
};

export default function ExamMonitorPage() {
  const [selectedId, setSelectedId] = useState('');
  const [logStudentId, setLogStudentId] = useState('');
  const [logKind, setLogKind] = useState('all');
  const [logQuery, setLogQuery] = useState('');

  const { data, isPending, isError, refetch, isFetching } = useQuery({
    queryKey: ['instructor', 'exam-monitor', selectedId || '__auto__'],
    queryFn: async () => {
      const params =
        selectedId && selectedId.trim() !== '' ? { assignment_id: selectedId } : {};
      const res = await getExamMonitor(params);
      return res.data;
    },
    retry: 1,
    refetchInterval: 8000,
  });

  useEffect(() => {
    if (!data?.assignments?.length) return;
    const first = String(data.assignments[0].assignment_id);
    if (!selectedId) setSelectedId(first);
    else if (!data.assignments.some((a) => String(a.assignment_id) === selectedId)) {
      setSelectedId(first);
    }
  }, [data?.assignments, selectedId]);

  useEffect(() => {
    setLogStudentId('');
    setLogKind('all');
    setLogQuery('');
  }, [selectedId]);

  const filteredDeskEvents = useMemo(() => {
    const evs = data?.events ?? [];
    const q = logQuery.trim().toLowerCase();
    return evs.filter((ev) => {
      const kind = ev.event_kind ?? 'auto_pause';
      if (logStudentId && String(ev.student_id) !== logStudentId) return false;
      if (logKind !== 'all' && kind !== logKind) return false;
      if (q) {
        const blob = `${ev.student_name ?? ''} ${ev.description ?? ''} ${ev.category ?? ''}`.toLowerCase();
        if (!blob.includes(q)) return false;
      }
      return true;
    });
  }, [data?.events, logStudentId, logKind, logQuery]);

  const submissionsLink = data?.selected_assignment_id
    ? `/instructor/submissions?assignment_id=${data.selected_assignment_id}`
    : '/instructor/submissions';

  const liveNow = useMemo(() => (data?.active_count ?? 0) > 0, [data?.active_count]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className="w-11 h-11 rounded-xl bg-primary-light flex items-center justify-center flex-shrink-0">
            <Monitor className="w-5 h-5 text-primary" />
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-2xl font-bold text-primary-dark">Live Exam Monitor</h1>
              <span
                className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide border ${
                  liveNow ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-slate-50 text-slate-500 border-slate-200'
                }`}
              >
                <Radio className={`w-3 h-3 ${liveNow ? 'animate-pulse text-emerald-600' : ''}`} />
                {liveNow ? 'Live session' : 'Standby'}
              </span>
            </div>
            <p className="text-sm text-slate-500 mt-0.5">
              Live roster with desk absence signals, ambient light, and session outcomes for exams you publish.
            </p>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 lg:justify-end">
          <div className="relative min-w-[240px]">
            <select
              value={selectedId}
              disabled={isPending || !data?.assignments?.length}
              onChange={(e) => setSelectedId(e.target.value)}
              className="w-full appearance-none border border-primary-light rounded-lg pl-3 pr-9 py-2.5 text-sm font-medium bg-white text-primary-dark shadow-sm focus:ring-2 focus:ring-primary/25 focus:border-primary outline-none disabled:opacity-50"
            >
              {!data?.assignments?.length ? (
                <option value="">No published exams</option>
              ) : (
                data.assignments.map((a) => (
                  <option key={a.assignment_id} value={a.assignment_id}>
                    {a.title} ({a.subject_name})
                  </option>
                ))
              )}
            </select>
            <ChevronDown className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          </div>
          <button
            type="button"
            disabled
            title="Bulk termination is planned for a later release."
            className="px-4 py-2.5 rounded-lg text-sm font-medium border border-slate-200 text-slate-400 bg-slate-50 cursor-not-allowed whitespace-nowrap"
          >
            End exam for all
          </button>
        </div>
      </div>

      {isError && (
        <div className="p-4 rounded-xl bg-red-50 border border-red-100 text-red-700 text-sm">
          Could not load exam monitor data. Confirm you have a published exam assignment with exam mode enabled.
        </div>
      )}

      {/* Selected exam meta */}
      {data?.selected_assignment_id && (
        <div className="bg-white border border-primary-light rounded-xl px-5 py-4 flex flex-wrap gap-x-10 gap-y-2 text-sm">
          <div>
            <span className="text-slate-400 text-xs uppercase font-semibold">Assignment</span>
            <p className="font-semibold text-primary-dark">{data.assignment_title}</p>
          </div>
          <div>
            <span className="text-slate-400 text-xs uppercase font-semibold">Grade</span>
            <p className="font-medium text-slate-700">{data.grade_name ?? '—'}</p>
          </div>
          <div>
            <span className="text-slate-400 text-xs uppercase font-semibold">Subject</span>
            <p className="font-medium text-slate-700">{data.subject_name}</p>
          </div>
          <div>
            <span className="text-slate-400 text-xs uppercase font-semibold">Due</span>
            <p className="font-medium text-slate-700">
              {fmtDateTime(data.due_date)}
            </p>
          </div>
          <div className="flex items-center gap-2 text-xs text-slate-400 ml-auto">
            {isFetching && !isPending && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
            <button type="button" className="text-primary hover:underline" onClick={() => refetch()}>
              Refresh
            </button>
          </div>
        </div>
      )}

      {/* Aggregate stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 lg:gap-4">
        {[
          {
            label: 'Students active',
            value: `${data?.active_count ?? 0}`,
            suffix: `/ ${data?.enrolled_total ?? 0}`,
            icon: Users,
            tone: 'text-emerald-600',
          },
          {
            label: 'Paused / away',
            value: String(data?.paused_count ?? 0),
            icon: PauseCircle,
            tone: 'text-amber-600',
          },
          {
            label: 'Submissions',
            value: String(data?.submitted_count ?? 0),
            icon: FileCheck,
            tone: 'text-blue-600',
          },
          {
            label: 'Avg. time left',
            value: formatSeconds(data?.avg_seconds_remaining),
            icon: Clock,
            tone: 'text-purple-600',
          },
        ].map(({ label, value, suffix, icon: Icon, tone }) => (
          <div
            key={label}
            className="rounded-2xl border border-primary-light bg-white p-4 shadow-sm"
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">{label}</span>
              <Icon className={`w-5 h-5 ${tone}`} />
            </div>
            <p className="text-2xl font-bold text-primary-dark">
              {value}
              {suffix && <span className="text-base font-semibold text-slate-400">{suffix}</span>}
            </p>
          </div>
        ))}
      </div>

      {isPending && (
        <div className="flex justify-center py-20">
          <Loader2 className="w-8 h-8 text-primary animate-spin" />
        </div>
      )}

      {/* Student roster */}
      {!isPending && data?.students?.length === 0 && (
        <div className="text-center py-16 bg-white rounded-2xl border border-dashed border-primary-light">
          <Users className="w-12 h-12 text-slate-200 mx-auto mb-3" />
          <p className="font-medium text-slate-600">No enrolled students</p>
          <p className="text-sm text-slate-400 mt-1">Enroll learners in this subject to populate the roster.</p>
        </div>
      )}

      {!isPending && data?.students && data.students.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-2 gap-4">
          {data.students.map((s) => {
            const st = STATUS_CARD[s.session_status] ?? STATUS_CARD.not_started;
            return (
              <div
                key={s.student_id}
                className="rounded-2xl border border-primary-light bg-white p-5 shadow-sm hover:shadow-md transition-shadow"
              >
                <div className="flex items-start justify-between gap-3 mb-4">
                  <div>
                    <p className="font-semibold text-primary-dark">{s.full_name}</p>
                    <span className={`mt-2 inline-flex text-[10px] font-bold uppercase tracking-wide px-2 py-1 rounded-full ${st}`}>
                      {sessionStatusLabel(s.session_status)}
                    </span>
                    {s.session_end_reason &&
                      (s.session_status === 'ended' || s.session_status === 'submitted') ? (
                      <p className="mt-2 text-xs text-slate-600 leading-snug max-w-prose border-l-2 border-slate-200 pl-2">
                        {s.session_end_reason}
                      </p>
                    ) : null}
                  </div>
                  <div className={`text-xs font-semibold px-2 py-1 rounded-lg ${st}`}>
                    {s.progress_pct}&nbsp;% done
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-2 text-[11px] mb-4">
                  <div className="rounded-lg bg-slate-50 p-2">
                    <span className="text-slate-400 flex items-center gap-1">
                      <Shield className="w-3 h-3" /> Presence
                    </span>
                    <span
                      className={
                        s.presence_label === 'Absent'
                          ? 'text-red-600 font-semibold'
                          : 'text-emerald-700 font-semibold'
                      }
                    >
                      {s.presence_label}
                      {s.device_online !== undefined && (
                        <span className={`ml-1 mt-1 block text-[10px] font-normal text-slate-400`}>
                          Desk {s.device_online ? 'online' : 'offline'}
                        </span>
                      )}
                    </span>
                  </div>
                  <div className="rounded-lg bg-slate-50 p-2">
                    <span className="text-slate-400 flex items-center gap-1">
                      <Sun className="w-3 h-3" /> Light
                    </span>
                    <span className="text-slate-800 font-semibold">
                      {s.light_raw != null ? `${Math.round(s.light_raw)}` : '—'}
                      <span className="font-normal text-slate-400"> raw</span>
                    </span>
                  </div>
                  <div className="rounded-lg bg-slate-50 p-2">
                    <span className="text-slate-400 flex items-center gap-1">
                      <Cpu className="w-3 h-3" /> Desk (away)
                    </span>
                    <span
                      className={
                        s.posture_label === 'Away'
                          ? 'text-red-600 font-semibold'
                          : 'font-semibold text-slate-700'
                      }
                    >
                      {s.posture_label === 'N/A' ? '—' : (s.posture_label || '—')}
                    </span>
                  </div>
                </div>

                <div className="flex items-center justify-between text-xs border-t border-slate-100 pt-3">
                  <div className="text-slate-500">
                    {s.seconds_remaining != null &&
                      (s.session_status === 'active' || s.session_status === 'paused') ? (
                      <span className="font-semibold text-slate-700">
                        Time left {formatSeconds(s.seconds_remaining)}
                      </span>
                    ) : (
                      <span>Pauses: {s.pause_count ?? '—'} · IoT alarms: {s.absence_alerts ?? '—'}</span>
                    )}
                  </div>
                  <Link
                    to={submissionsLink}
                    className="text-primary font-medium hover:underline"
                  >
                    {s.session_status === 'submitted' ? 'Review paper' : 'View roster'}
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Desk absence log */}
      {!isPending && data?.selected_assignment_id && (
        <div className="bg-white rounded-2xl border border-primary-light shadow-sm overflow-hidden">
          <div className="px-5 py-3 border-b border-slate-100">
            <h2 className="font-semibold text-primary-dark text-sm">Desk absence log</h2>
            <p className="text-xs text-slate-500">
              Auto-pauses and forfeits from ultrasonic “away” detection for this roster—near-distance posture is not tracked here.
            </p>
          </div>
          {(data?.events?.length ?? 0) === 0 ? (
            <p className="px-5 py-8 text-sm text-slate-500 text-center">
              No desk absence events in the last 7 days for this class.
            </p>
          ) : (
            <>
              <div className="px-5 py-3 bg-slate-50/80 border-b border-slate-100 flex flex-col sm:flex-row flex-wrap items-stretch sm:items-center gap-2 sm:gap-3">
                <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-500 uppercase tracking-wide shrink-0">
                  <ListFilter className="w-3.5 h-3.5" />
                  Filter
                </div>
                <select
                  value={logStudentId}
                  onChange={(e) => setLogStudentId(e.target.value)}
                  className="flex-1 min-w-[140px] sm:max-w-[200px] border border-primary-light rounded-lg px-2.5 py-2 text-sm bg-white text-primary-dark focus:ring-2 focus:ring-primary/25 focus:border-primary outline-none"
                  aria-label="Filter by student"
                >
                  <option value="">All students</option>
                  {(data?.students ?? [])
                    .slice()
                    .sort((a, b) => (a.full_name || '').localeCompare(b.full_name || ''))
                    .map((s) => (
                      <option key={s.student_id} value={s.student_id}>
                        {s.full_name}
                      </option>
                    ))}
                </select>
                <select
                  value={logKind}
                  onChange={(e) => setLogKind(e.target.value)}
                  className="flex-1 min-w-[120px] sm:max-w-[180px] border border-primary-light rounded-lg px-2.5 py-2 text-sm bg-white text-primary-dark focus:ring-2 focus:ring-primary/25 focus:border-primary outline-none"
                  aria-label="Filter by outcome"
                >
                  <option value="all">All outcomes</option>
                  <option value="auto_pause">Auto-pause only</option>
                  <option value="exam_ended">Attempt ended only</option>
                </select>
                <input
                  type="search"
                  value={logQuery}
                  onChange={(e) => setLogQuery(e.target.value)}
                  placeholder="Search description…"
                  className="flex-1 min-w-[160px] border border-primary-light rounded-lg px-3 py-2 text-sm bg-white text-primary-dark placeholder:text-slate-400 focus:ring-2 focus:ring-primary/25 focus:border-primary outline-none"
                  aria-label="Search log description"
                />
                {(logStudentId || logKind !== 'all' || logQuery.trim()) ? (
                  <button
                    type="button"
                    onClick={() => {
                      setLogStudentId('');
                      setLogKind('all');
                      setLogQuery('');
                    }}
                    className="text-xs font-medium text-primary hover:underline whitespace-nowrap px-1 py-2 sm:py-0"
                  >
                    Clear filters
                  </button>
                ) : null}
              </div>
              <div className="overflow-x-auto">
                {filteredDeskEvents.length === 0 ? (
                  <p className="px-5 py-8 text-sm text-slate-500 text-center">
                    No rows match your filters.
                  </p>
                ) : (
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-left text-[10px] uppercase tracking-wider text-slate-500 border-b border-slate-100">
                        <th className="px-5 py-2">Time</th>
                        <th className="px-5 py-2">Student</th>
                        <th className="px-5 py-2">Category</th>
                        <th className="px-5 py-2">Description</th>
                        <th className="px-5 py-2">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredDeskEvents.map((ev, i) => (
                        <tr
                          key={`${ev.student_id}-${ev.sent_at}-${i}`}
                          className="border-b border-slate-50 hover:bg-slate-50/60"
                        >
                          <td className="px-5 py-2.5 whitespace-nowrap text-slate-600 tabular-nums">
                            {fmtTime(ev.sent_at, { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                          </td>
                          <td className="px-5 py-2.5 font-medium text-slate-800">{ev.student_name}</td>
                          <td className="px-5 py-2.5 text-slate-600">{ev.category}</td>
                          <td className="px-5 py-2.5 text-slate-600 max-w-md truncate" title={ev.description}>{ev.description}</td>
                          <td className="px-5 py-2.5"><span className="text-[10px] font-bold uppercase text-amber-700 bg-amber-50 px-2 py-0.5 rounded">{ev.status_label}</span></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
              <div className="px-5 py-2 border-t border-slate-100 text-[11px] text-slate-400">
                Showing {filteredDeskEvents.length} of {data.events.length} event{data.events.length === 1 ? '' : 's'}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
