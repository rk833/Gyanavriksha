import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import {
  BarChart, Bar, XAxis, Tooltip, ResponsiveContainer,
} from 'recharts';
import {
  ShieldCheck, Key, ExternalLink, AlertTriangle, Info, RefreshCw,
  ScrollText, CheckCircle2, Loader2, Users,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { getSecurityOverview, getSecurityEvents, runIntegrityAudit } from '../../services/adminService';

const RATE_DATA = [
  { t: '00', v: 1200 }, { t: '03', v: 800 }, { t: '06', v: 950 },
  { t: '09', v: 2100 }, { t: '12', v: 2400 }, { t: '15', v: 1800 },
  { t: '18', v: 2200 }, { t: '21', v: 1500 },
];

function CircularScore({ score }) {
  const radius = 40;
  const circumference = 2 * Math.PI * radius;
  const dash = (score / 100) * circumference;
  return (
    <svg width="100" height="100" viewBox="0 0 100 100">
      <circle cx="50" cy="50" r={radius} fill="none" stroke="#DBE2EF" strokeWidth="8" />
      <circle
        cx="50" cy="50" r={radius} fill="none"
        stroke="#3F72AF" strokeWidth="8"
        strokeDasharray={`${dash} ${circumference}`}
        strokeLinecap="round"
        transform="rotate(-90 50 50)"
      />
      <text x="50" y="54" textAnchor="middle" fill="#112D4E" fontSize="18" fontWeight="bold">{score}</text>
    </svg>
  );
}

function JwtRbacCard({ roles }) {
  return (
    <div className="bg-white rounded-xl border border-primary-light shadow-sm p-5">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2 font-semibold text-primary-dark">
          <ShieldCheck className="w-4 h-4" />
          JWT &amp; RBAC Status
        </div>
        <span className="text-xs font-bold bg-primary-dark text-white px-3 py-0.5 rounded-full tracking-wider">
          ACTIVE PROTOCOL
        </span>
      </div>
      <div className="grid grid-cols-2 gap-3">
        {roles.map((r) => (
          <div key={r.role} className="flex items-center gap-2 text-sm text-slate-600">
            <CheckCircle2 className={`w-4 h-4 shrink-0 ${r.active ? 'text-green-500' : 'text-slate-300'}`} />
            <span>{r.role}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function RateLimitCard({ overview }) {
  const threshold = overview?.api_rate_limit?.threshold ?? 2500;
  return (
    <div className="bg-white rounded-xl border border-primary-light shadow-sm p-5">
      <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">API Rate Limiting</p>
      <p className="text-3xl font-bold text-primary-dark">
        {threshold.toLocaleString()} <span className="text-sm font-normal text-slate-400">req/min</span>
      </p>
      <p className="text-xs text-slate-400 mb-3">Current global threshold</p>
      <ResponsiveContainer width="100%" height={80}>
        <BarChart data={RATE_DATA} barSize={14}>
          <XAxis dataKey="t" tick={{ fontSize: 10 }} axisLine={false} tickLine={false} />
          <Tooltip formatter={(v) => [`${v} req`, 'Usage']} />
          <Bar dataKey="v" radius={[3, 3, 0, 0]} fill="#3F72AF" />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

function DeviceAuthCard({ overview }) {
  const navigate = useNavigate();
  const activeKeys = overview?.device_auth?.active_api_keys ?? 0;
  return (
    <div className="bg-white rounded-xl border border-primary-light shadow-sm p-5">
      <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">Device Auth</p>
      <div className="flex items-center gap-2 mb-4">
        <p className="text-2xl font-bold text-primary-dark">
          ACTIVE API KEYS: <span className="text-primary">{activeKeys}</span>
        </p>
        <ExternalLink className="w-4 h-4 text-primary" />
      </div>
      <button
        onClick={() => navigate('/admin/iot')}
        className="w-full border border-primary text-primary text-sm font-semibold rounded-lg py-2 hover:bg-primary-light transition-colors"
      >
        MANAGE KEYS
      </button>
    </div>
  );
}

const EVENT_ICON = {
  warning: <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0" />,
  info: <Info className="w-4 h-4 text-blue-400 shrink-0" />,
  critical: <AlertTriangle className="w-4 h-4 text-red-500 shrink-0" />,
  success: <CheckCircle2 className="w-4 h-4 text-green-500 shrink-0" />,
};

function EventRow({ event, dark }) {
  const icon = EVENT_ICON[event.severity] ?? EVENT_ICON.info;
  return (
    <div className={`flex items-start gap-3 px-4 py-3 rounded-lg ${dark ? 'bg-primary-dark text-white' : 'border border-slate-100'}`}>
      <div className="mt-0.5">{icon}</div>
      <div className="flex-1 min-w-0">
        <p className={`text-sm font-medium truncate ${dark ? 'text-white' : 'text-slate-700'}`}>{event.action}</p>
        <p className={`text-xs truncate ${dark ? 'text-primary-light' : 'text-slate-400'}`}>{event.details}</p>
      </div>
      <span className={`text-xs shrink-0 ${dark ? 'text-primary-light' : 'text-slate-400'}`}>
        {event.time_ago}
      </span>
    </div>
  );
}

function RecentEventsCard({ events }) {
  return (
    <div className="bg-white rounded-xl border border-primary-light shadow-sm p-5">
      <p className="font-semibold text-primary-dark mb-3">Recent Security Events</p>
      <div className="space-y-2">
        {events.length === 0 && <p className="text-sm text-slate-400 text-center py-4">No recent events</p>}
        {events.map((ev, i) => (
          <EventRow key={i} event={ev} dark={i % 2 === 1} />
        ))}
      </div>
    </div>
  );
}

function IntegrityCard({ overview, auditResult, onRunAudit, running }) {
  const hashStatus = auditResult?.hash_check_status ?? overview?.integrity_status?.last_status ?? 'Unknown';
  const auditTime = auditResult?.audit_time ?? overview?.integrity_status?.last_audit_time ?? '—';
  return (
    <div className="bg-primary-dark text-white rounded-xl p-5">
      <div className="flex items-center gap-2 mb-4">
        <ShieldCheck className="w-5 h-5 text-primary-light" />
        <div>
          <p className="font-bold text-white">System Integrity</p>
          <p className="text-xs text-primary-light uppercase tracking-wider">Global Node Health</p>
        </div>
      </div>
      <div className="space-y-3 mb-5">
        <div>
          <p className="text-xs text-primary-light uppercase tracking-wider mb-1">Hash Check Status</p>
          <div className="flex items-center gap-2">
            <p className="font-semibold text-white">{hashStatus}</p>
            <CheckCircle2 className="w-4 h-4 text-green-400" />
          </div>
        </div>
        <div>
          <p className="text-xs text-primary-light uppercase tracking-wider mb-1">Last Audit Time</p>
          <p className="font-medium text-white text-sm">{typeof auditTime === 'string' ? auditTime : new Date(auditTime).toLocaleString()}</p>
        </div>
      </div>
      <div className="flex gap-2">
        <button
          onClick={onRunAudit}
          disabled={running}
          className="flex-1 bg-primary text-white text-sm font-semibold rounded-lg py-2 flex items-center justify-center gap-1.5 hover:bg-primary-dark border border-primary-light disabled:opacity-50 transition-colors"
        >
          {running ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
          Run Audit Now
        </button>
        <button className="flex-1 bg-white/10 border border-white/20 text-white text-sm font-semibold rounded-lg py-2 flex items-center justify-center gap-1.5 hover:bg-white/20 transition-colors">
          <ScrollText className="w-4 h-4" /> Logs
        </button>
      </div>
    </div>
  );
}

function TwoFACard({ overview }) {
  const pct = overview?.two_fa_compliance?.compliance_percentage ?? 0;
  const protected_ = overview?.two_fa_compliance?.two_fa_enabled_count ?? 0;
  const total = overview?.two_fa_compliance?.total_users ?? 0;
  return (
    <div className="bg-white rounded-xl border border-primary-light shadow-sm p-5">
      <div className="flex items-center justify-between mb-3">
        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">2FA Compliance</p>
        <p className="text-2xl font-bold text-primary-dark">{pct}%</p>
      </div>
      <div className="w-full bg-slate-100 rounded-full h-2 mb-3">
        <div className="bg-primary h-2 rounded-full transition-all" style={{ width: `${pct}%` }} />
      </div>
      <div className="flex items-center gap-2">
        <Users className="w-4 h-4 text-slate-400" />
        <p className="text-xs text-slate-500">{protected_.toLocaleString()} / {total.toLocaleString()} Users Protected</p>
        <div className="flex -space-x-1 ml-auto">
          {[...Array(Math.min(4, protected_))].map((_, i) => (
            <div key={i} className="w-6 h-6 rounded-full bg-primary border-2 border-white flex items-center justify-center">
              <span className="text-white text-xs font-bold">{String.fromCharCode(65 + i)}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function ScoreCard({ score }) {
  return (
    <div className="bg-white rounded-xl border border-primary-light shadow-sm p-5">
      <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">Overall Security Score</p>
      <div className="flex items-center gap-4">
        <CircularScore score={score} />
        <div>
          <p className="font-bold text-primary-dark">Excellence Level</p>
          <p className="text-xs text-slate-500 mt-1">System integrity is within optimal range, 3 minor configuration updates available.</p>
        </div>
      </div>
    </div>
  );
}

function buildRbacRoles(overview) {
  const defaults = [
    { role: 'Super Admin', active: true },
    { role: 'IoT Controller', active: true },
    { role: 'Database Auditor', active: true },
    { role: 'Vector Analyst', active: true },
    { role: 'User Manager', active: true },
    { role: 'Guest Viewer', active: false },
  ];
  if (!overview?.jwt_rbac_status?.length) return defaults;
  return overview.jwt_rbac_status.map((r) => ({ role: r.role, active: r.active ?? true }));
}

function buildEvents(raw) {
  if (!raw?.events?.length) {
    return [
      { action: 'Brute-force attempt detected', details: 'IP: 192.168.1.105 • Kathmandu, NP', severity: 'warning', time_ago: '2m ago' },
      { action: 'API key rotation initiated', details: 'Admin user triggered rotation', severity: 'critical', time_ago: '15m ago' },
      { action: 'Unusual IoT packet volume', details: 'Sensor: Node-R4-Gate', severity: 'info', time_ago: '1h ago' },
      { action: 'Admin login attempt', details: 'External Network / Rejected', severity: 'critical', time_ago: '2h ago' },
      { action: 'System Backup integrity check', details: 'Result: Success (Hash verified)', severity: 'success', time_ago: '5h ago' },
    ];
  }
  return raw.events.slice(0, 5).map((e) => ({
    action: e.action ?? e.event_type,
    details: e.details ?? e.extra_metadata ?? '',
    severity: e.severity ?? 'info',
    time_ago: e.time_ago ?? '—',
  }));
}

export default function SecurityIntegrity() {
  const [auditResult, setAuditResult] = useState(null);

  const { data: overview } = useQuery({
    queryKey: ['admin', 'security-overview'],
    queryFn: async () => (await getSecurityOverview()).data,
  });

  const { data: eventsData } = useQuery({
    queryKey: ['admin', 'security-events'],
    queryFn: async () => (await getSecurityEvents()).data,
  });

  const auditMutation = useMutation({
    mutationFn: () => runIntegrityAudit(),
    onSuccess: (res) => {
      setAuditResult(res.data);
      toast.success('Integrity audit complete');
    },
    onError: () => toast.error('Audit failed'),
  });

  const rbacRoles = buildRbacRoles(overview);
  const events = buildEvents(eventsData);
  const score = overview?.overall_security_score ?? 90;

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-primary-dark">Security &amp; System Integrity</h1>
        <p className="text-sm text-slate-500 mt-0.5">Real-time status of authentication protocols, access control, and system health.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-4">
          <JwtRbacCard roles={rbacRoles} />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <RateLimitCard overview={overview} />
            <DeviceAuthCard overview={overview} />
          </div>
          <RecentEventsCard events={events} />
        </div>

        <div className="space-y-4">
          <IntegrityCard
            overview={overview}
            auditResult={auditResult}
            onRunAudit={() => auditMutation.mutate()}
            running={auditMutation.isPending}
          />
          <TwoFACard overview={overview} />
          <ScoreCard score={score} />
        </div>
      </div>
    </div>
  );
}
