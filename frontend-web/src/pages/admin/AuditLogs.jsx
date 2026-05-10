import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  ScrollText,
  Download,
  ChevronLeft,
  ChevronRight,
  AlertCircle,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { getAuditLogs, getSystemChanges, exportAuditLogs } from '../../services/adminService';

const EVENT_BADGE_STYLES = {
  LOGIN: 'bg-slate-100 text-slate-700',
  LOGIN_ATTEMPT: 'bg-orange-100 text-orange-700',
  CURRICULUM_UPLOAD: 'bg-blue-100 text-blue-700',
  ROLE_CHANGE: 'bg-purple-100 text-purple-700',
  ACCOUNT_SUSPENDED: 'bg-red-100 text-red-700',
  IOT_DEVICE_REGISTERED: 'bg-teal-100 text-teal-700',
  INTEGRITY_AUDIT_RUN: 'bg-green-100 text-green-700',
  FORCE_PASSWORD_RESET: 'bg-yellow-100 text-yellow-700',
};

const CATEGORY_STYLES = {
  INFRASTRUCTURE: 'bg-slate-100 text-slate-700',
  DATA_SCIENCE: 'bg-blue-100 text-blue-700',
  COMPLIANCE: 'bg-green-100 text-green-700',
  SYSTEM: 'bg-purple-100 text-purple-700',
};

function EventBadge({ type }) {
  const cls = EVENT_BADGE_STYLES[type] || 'bg-slate-100 text-slate-600';
  const label = type?.replace(/_/g, ' ') || 'UNKNOWN';
  return (
    <span className={`px-2 py-0.5 rounded text-xs font-semibold uppercase tracking-wide ${cls}`}>
      {label}
    </span>
  );
}

function StatusBadge({ status }) {
  const isSuccess = status === 'success';
  return (
    <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium ${
      isSuccess ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-600'
    }`}>
      <span className={`w-1.5 h-1.5 rounded-full ${isSuccess ? 'bg-green-500' : 'bg-red-500'}`} />
      {isSuccess ? 'Success' : 'Failed'}
    </span>
  );
}

function UserAvatar({ initials }) {
  return (
    <div className="w-7 h-7 rounded-full bg-primary-light flex items-center justify-center text-primary font-bold text-xs flex-shrink-0">
      {initials || '?'}
    </div>
  );
}

function Pagination({ page, totalPages, onChange }) {
  if (totalPages <= 1) return null;
  const pages = [];
  const start = Math.max(1, page - 2);
  const end = Math.min(totalPages, start + 4);
  for (let i = start; i <= end; i++) pages.push(i);

  return (
    <div className="flex items-center gap-1">
      <button
        onClick={() => onChange(page - 1)}
        disabled={page === 1}
        className="p-1.5 rounded hover:bg-primary-light/50 disabled:opacity-40 transition"
      >
        <ChevronLeft className="w-4 h-4 text-slate-600" />
      </button>
      {pages.map((p) => (
        <button
          key={p}
          onClick={() => onChange(p)}
          className={`w-8 h-8 rounded text-sm font-medium transition ${
            p === page ? 'bg-primary text-white' : 'text-slate-600 hover:bg-primary-light/50'
          }`}
        >
          {p}
        </button>
      ))}
      {end < totalPages && (
        <>
          <span className="text-slate-400 text-sm">…</span>
          <button
            onClick={() => onChange(totalPages)}
            className="w-8 h-8 rounded text-sm font-medium text-slate-600 hover:bg-primary-light/50 transition"
          >
            {totalPages}
          </button>
        </>
      )}
      <button
        onClick={() => onChange(page + 1)}
        disabled={page === totalPages}
        className="p-1.5 rounded hover:bg-primary-light/50 disabled:opacity-40 transition"
      >
        <ChevronRight className="w-4 h-4 text-slate-600" />
      </button>
    </div>
  );
}

function formatTimestamp(ts) {
  if (!ts) return '—';
  const hasOff = ts.endsWith('Z') || /[+-]\d{2}:\d{2}$/.test(ts);
  const d = new Date(hasOff ? ts : ts + 'Z');
  return {
    date: d.toLocaleDateString(undefined, { month: 'short', day: '2-digit', year: 'numeric' }),
    time: d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false }),
  };
}

function timeAgo(ts) {
  if (!ts) return '';
  const diff = Date.now() - new Date(ts).getTime();
  const h = Math.floor(diff / 3600000);
  if (h < 24) return `${h} HOURS AGO`;
  const d = Math.floor(h / 24);
  if (d === 1) return 'YESTERDAY';
  return `${d} DAYS AGO`;
}

function SystemChangeCard({ entry }) {
  const { date: dateStr, time: timeStr } = formatTimestamp(entry.timestamp);
  return (
    <div className="bg-white rounded-xl border border-primary-light p-5 shadow-sm flex-1 min-w-0">
      <div className="flex items-center justify-between mb-2">
        <span className="w-7 h-7 rounded-lg bg-primary-light flex items-center justify-center text-primary text-xs font-bold">
          {entry.category?.charAt(0)}
        </span>
        <span className="text-xs text-slate-400 font-semibold">{timeAgo(entry.timestamp)}</span>
      </div>
      <h3 className="text-sm font-bold text-primary-dark mb-1">{entry.event_type?.replace(/_/g, ' ')}</h3>
      <p className="text-xs text-slate-500 mb-3 line-clamp-3">{entry.description}</p>
      <span className={`px-2 py-0.5 rounded text-xs font-semibold uppercase ${CATEGORY_STYLES[entry.category] || 'bg-slate-100 text-slate-600'}`}>
        {entry.category}
      </span>
    </div>
  );
}

function FilterBar({ filters, onChange }) {
  const set = (k, v) => onChange({ ...filters, [k]: v, page: 1 });

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-4">
      <div>
        <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Event Type</label>
        <select
          value={filters.event_type}
          onChange={(e) => set('event_type', e.target.value)}
          className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-600 focus:outline-none focus:ring-2 focus:ring-primary/30"
        >
          <option value="all">All Events</option>
          <option value="LOGIN">Login</option>
          <option value="CURRICULUM_UPLOAD">Curriculum Upload</option>
          <option value="ROLE_CHANGE">Role Change</option>
          <option value="FORCE_PASSWORD_RESET">Password Reset</option>
          <option value="IOT_DEVICE_REGISTERED">IoT Device</option>
          <option value="INTEGRITY_AUDIT_RUN">Integrity Audit</option>
        </select>
      </div>
      <div>
        <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">User Search</label>
        <input
          type="text"
          value={filters.user_search}
          onChange={(e) => set('user_search', e.target.value)}
          placeholder="Search user ID or name..."
          className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-600 focus:outline-none focus:ring-2 focus:ring-primary/30"
        />
      </div>
      <div>
        <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Date Range</label>
        <div className="flex items-center gap-2">
          <input
            type="date"
            value={filters.date_from || ''}
            onChange={(e) => set('date_from', e.target.value || null)}
            className="flex-1 border border-slate-200 rounded-lg px-2 py-2 text-sm text-slate-600 focus:outline-none focus:ring-2 focus:ring-primary/30"
          />
          <span className="text-slate-400 text-xs">to</span>
          <input
            type="date"
            value={filters.date_to || ''}
            onChange={(e) => set('date_to', e.target.value || null)}
            className="flex-1 border border-slate-200 rounded-lg px-2 py-2 text-sm text-slate-600 focus:outline-none focus:ring-2 focus:ring-primary/30"
          />
        </div>
      </div>
    </div>
  );
}

function AuditLogTable({ logs, loading }) {
  if (loading) {
    return (
      <div className="space-y-2 py-4">
        {[...Array(6)].map((_, i) => (
          <div key={i} className="h-12 bg-slate-100 rounded-lg animate-pulse" />
        ))}
      </div>
    );
  }

  if (!logs?.length) {
    return (
      <div className="py-12 text-center text-sm text-slate-400">
        No audit log entries match the current filters.
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full">
        <thead>
          <tr className="border-b border-slate-100">
            {['Timestamp', 'User', 'Event Type', 'Description', 'IP Address', 'Status'].map((h) => (
              <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider whitespace-nowrap">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {logs.map((log) => {
            const ts = formatTimestamp(log.timestamp);
            return (
              <tr key={log.log_id} className="border-b border-slate-50 hover:bg-slate-50/50 transition">
                <td className="px-4 py-3 whitespace-nowrap">
                  <p className="text-sm font-semibold text-primary-dark">{ts.date}</p>
                  <p className="text-xs text-slate-400">{ts.time}</p>
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <UserAvatar initials={log.user_initials} />
                    <span className="text-sm text-slate-600 truncate max-w-[140px]">
                      {log.user_email || 'System'}
                    </span>
                  </div>
                </td>
                <td className="px-4 py-3">
                  <EventBadge type={log.event_type} />
                </td>
                <td className="px-4 py-3 text-sm text-slate-600 max-w-[220px] truncate">
                  {log.description || '—'}
                </td>
                <td className="px-4 py-3 text-sm font-mono text-slate-500 whitespace-nowrap">
                  {log.ip_address || '—'}
                </td>
                <td className="px-4 py-3">
                  <StatusBadge status={log.status} />
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export default function AuditLogs() {
  const perPage = 20;
  const [filters, setFilters] = useState({
    event_type: 'all',
    user_search: '',
    date_from: null,
    date_to: null,
    page: 1,
  });

  const queryParams = {
    ...(filters.event_type !== 'all' && { event_type: filters.event_type }),
    ...(filters.user_search && { user_search: filters.user_search }),
    ...(filters.date_from && { date_from: filters.date_from }),
    ...(filters.date_to && { date_to: filters.date_to }),
    page: filters.page,
    per_page: perPage,
  };

  const { data: logsData, isPending: logsLoading, error } = useQuery({
    queryKey: ['admin', 'audit-logs', queryParams],
    queryFn: async () => (await getAuditLogs(queryParams)).data,
    keepPreviousData: true,
  });

  const { data: systemChanges } = useQuery({
    queryKey: ['admin', 'system-changes'],
    queryFn: async () => (await getSystemChanges()).data,
  });

  const logs = logsData?.logs ?? [];
  const totalCount = logsData?.total_count ?? 0;
  const totalPages = Math.ceil(totalCount / perPage);

  const handleExport = async () => {
    try {
      const params = {};
      if (filters.event_type !== 'all') params.event_type = filters.event_type;
      if (filters.user_search) params.user_search = filters.user_search;
      if (filters.date_from) params.date_from = filters.date_from;
      if (filters.date_to) params.date_to = filters.date_to;
      const res = await exportAuditLogs(params);
      const url = URL.createObjectURL(new Blob([res.data], { type: 'text/csv' }));
      const a = document.createElement('a');
      a.href = url;
      a.download = `audit-logs-${new Date().toISOString().slice(0, 10)}.csv`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success('Audit log exported');
    } catch {
      toast.error('Export failed');
    }
  };

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <AlertCircle className="w-12 h-12 text-red-400 mb-4" />
        <h2 className="text-lg font-semibold text-primary-dark mb-2">Failed to Load Audit Logs</h2>
        <p className="text-slate-500 text-sm">{error?.response?.data?.detail || error?.message}</p>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-start justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-primary-light flex items-center justify-center">
            <ScrollText className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-primary-dark">System Audit Logs</h1>
            <p className="text-sm text-slate-500">
              Track every interaction, configuration change, and system event within the Gyanavriksha ecosystem.
            </p>
          </div>
        </div>
        <button
          onClick={handleExport}
          className="flex items-center gap-2 bg-primary-dark text-white text-sm font-medium px-4 py-2 rounded-lg hover:bg-primary-dark/90 transition"
        >
          <Download className="w-4 h-4" />
          Export CSV
        </button>
      </div>

      <FilterBar filters={filters} onChange={setFilters} />

      <div className="bg-white rounded-xl border border-primary-light shadow-sm overflow-hidden mb-8">
        <AuditLogTable logs={logs} loading={logsLoading} />

        <div className="flex items-center justify-between px-4 py-3 border-t border-slate-100">
          <p className="text-sm text-slate-500">
            Showing {logs.length > 0 ? (filters.page - 1) * perPage + 1 : 0} to {Math.min(filters.page * perPage, totalCount)} of {totalCount.toLocaleString()} logs
          </p>
          <Pagination
            page={filters.page}
            totalPages={totalPages}
            onChange={(p) => setFilters((f) => ({ ...f, page: p }))}
          />
        </div>
      </div>

      {systemChanges?.length > 0 && (
        <div>
          <h2 className="text-lg font-bold text-primary-dark mb-4">Recent System-Level Changes</h2>
          <div className="flex flex-col md:flex-row gap-4">
            {systemChanges.map((entry, i) => (
              <SystemChangeCard key={i} entry={entry} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
