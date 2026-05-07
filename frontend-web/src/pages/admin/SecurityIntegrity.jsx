import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import {
  ShieldCheck, Key, ExternalLink, AlertTriangle, Info, RefreshCw,
  ScrollText, CheckCircle2, Loader2, Users, Activity,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { getSecurityOverview, getSecurityEvents, runIntegrityAudit } from '../../services/adminService';

const SEVERITY_BY_EVENT = {
  LOGIN_FAILED: 'warning',
  ACCOUNT_LOCKED: 'warning',
  FORCE_PASSWORD_RESET: 'critical',
  IOT_KEY_REGENERATED: 'critical',
  IOT_DEVICE_DECOMMISSIONED: 'critical',
  ROLE_CHANGE: 'info',
  AUDIT_LOG_EXPORTED: 'info',
};

function timeAgo(timestamp) {
  if (!timestamp) return '—';
  const mins = Math.floor((Date.now() - new Date(timestamp).getTime()) / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

function buildRbacRoles(overview) {
  if (!overview?.jwt_rbac_status) return [];
  return overview.jwt_rbac_status.map((r) => ({
    role: r.role,
    active: r.active ?? true,
    user_count: r.user_count ?? null,
  }));
}

function buildEvents(raw) {
  const list = Array.isArray(raw) ? raw : [];
  return list.slice(0, 5).map((e) => ({
    action: e.event_type ?? '—',
    details: e.description
      ? e.description
      : e.ip_address
        ? `IP: ${e.ip_address}`
        : '—',
    severity: SEVERITY_BY_EVENT[e.event_type] ?? 'info',
    time_ago: timeAgo(e.timestamp),
  }));
}

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
      {roles.length === 0 ? (
        <p className="text-sm text-slate-400 text-center py-2">No active roles found</p>
      ) : (
        <div className="grid grid-cols-2 gap-3">
          {roles.map((r) => (
            <div key={r.role} className="flex items-center gap-2 text-sm text-slate-600">
              <CheckCircle2 className={`w-4 h-4 shrink-0 ${r.active ? 'text-green-500' : 'text-slate-300'}`} />
              <span className="flex-1">{r.role}</span>
              {r.user_count != null && (
                <span className="text-xs text-slate-400 font-medium">{r.user_count}</span>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function RateLimitCard({ overview }) {
  const threshold = overview?.api_rate_limit?.threshold_per_min ?? 0;
  const usagePct = overview?.api_rate_limit?.current_usage_pct;
  return (
    <div className="bg-white rounded-xl border border-primary-light shadow-sm p-5">
      <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">API Rate Limiting</p>
      <p className="text-3xl font-bold text-primary-dark">
        {threshold.toLocaleString()} <span className="text-sm font-normal text-slate-400">req/min max</span>
      </p>
      <p className="text-xs text-slate-400 mb-3">Configured global threshold</p>
      {usagePct != null ? (
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs text-slate-500">
            <span>Current load</span>
            <span className="font-semibold text-primary-dark">{usagePct}%</span>
          </div>
          <div className="w-full bg-slate-100 rounded-full h-2.5">
            <div
              className={`h-2.5 rounded-full transition-all ${usagePct > 80 ? 'bg-red-500' : usagePct > 60 ? 'bg-amber-400' : 'bg-primary'}`}
              style={{ width: `${Math.min(usagePct, 100)}%` }}
            />
          </div>
        </div>
      ) : (
        <p className="text-xs text-slate-400 flex items-center gap-1">
          <Activity className="w-3 h-3" /> Live usage monitoring not configured
        </p>
      )}
    </div>
  );
}

function DeviceAuthCard({ overview }) {
  const navigate = useNavigate();
  const activeKeys = overview?.device_auth?.active_api_keys_count ?? 0;
  return (
    <div className="bg-white rounded-xl border border-primary-light shadow-sm p-5">
      <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">Device Auth</p>
      <div className="flex items-center gap-2 mb-4">
        <Key className="w-5 h-5 text-primary" />
        <p className="text-2xl font-bold text-primary-dark">
          {activeKeys} <span className="text-sm font-normal text-slate-400">active API keys</span>
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

function RecentEventsCard({ events, loading }) {
  return (
    <div className="bg-white rounded-xl border border-primary-light shadow-sm p-5">
      <p className="font-semibold text-primary-dark mb-3">Recent Security Events</p>
      {loading && (
        <div className="flex justify-center py-4">
          <Loader2 className="w-5 h-5 text-primary animate-spin" />
        </div>
      )}
      {!loading && events.length === 0 && (
        <p className="text-sm text-slate-400 text-center py-4">No security events on record</p>
      )}
      <div className="space-y-2">
        {events.map((ev, i) => (
          <EventRow key={i} event={ev} dark={i % 2 === 1} />
        ))}
      </div>
    </div>
  );
}

function IntegrityCard({ overview, auditResult, onRunAudit, running, onViewLogs }) {
  const hashStatus = auditResult?.hash_check_status ?? overview?.integrity_status?.hash_check_status ?? 'No audit run yet';
  const auditTime = auditResult?.audit_time ?? overview?.integrity_status?.audit_time ?? '—';
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
          <p className="font-medium text-white text-sm">
            {typeof auditTime === 'string' ? (() => { const h = auditTime.endsWith('Z') || /[+-]\d{2}:\d{2}$/.test(auditTime); return new Date(h ? auditTime : auditTime + 'Z').toLocaleString(); })() : new Date(auditTime).toLocaleString()}
          </p>
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
        <button
          onClick={onViewLogs}
          className="flex-1 bg-white/10 border border-white/20 text-white text-sm font-semibold rounded-lg py-2 flex items-center justify-center gap-1.5 hover:bg-white/20 transition-colors"
        >
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
  const level = score >= 80 ? 'Excellent' : score >= 60 ? 'Good' : 'Needs Attention';
  const description = score >= 80
    ? 'System integrity is within optimal range.'
    : score >= 60
      ? 'Some security configurations need review.'
      : 'Multiple security issues require immediate attention.';
  return (
    <div className="bg-white rounded-xl border border-primary-light shadow-sm p-5">
      <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">Overall Security Score</p>
      <div className="flex items-center gap-4">
        <CircularScore score={score} />
        <div>
          <p className="font-bold text-primary-dark">{level}</p>
          <p className="text-xs text-slate-500 mt-1">{description}</p>
        </div>
      </div>
    </div>
  );
}

export default function SecurityIntegrity() {
  const navigate = useNavigate();
  const [auditResult, setAuditResult] = useState(null);

  const { data: overview } = useQuery({
    queryKey: ['admin', 'security-overview'],
    queryFn: async () => (await getSecurityOverview()).data,
  });

  const { data: eventsRaw, isLoading: eventsLoading } = useQuery({
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
  const events = buildEvents(eventsRaw);
  const score = overview?.overall_security_score ?? 0;

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
          <RecentEventsCard events={events} loading={eventsLoading} />
        </div>

        <div className="space-y-4">
          <IntegrityCard
            overview={overview}
            auditResult={auditResult}
            onRunAudit={() => auditMutation.mutate()}
            running={auditMutation.isPending}
            onViewLogs={() => navigate('/admin/audit-logs')}
          />
          <TwoFACard overview={overview} />
          <ScoreCard score={score} />
        </div>
      </div>
    </div>
  );
}
