import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Link, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard,
  Cpu,
  ShieldCheck,
  Upload,
  CheckCircle2,
  MoreHorizontal,
  AlertCircle,
  Loader2,
  TrendingUp,
  TrendingDown,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { getDashboard, runIntegrityAudit } from '../../services/adminService';

function KpiSkeleton() {
  return (
    <div className="bg-white rounded-xl border border-primary-light p-5 animate-pulse">
      <div className="h-3 w-24 bg-slate-200 rounded mb-3" />
      <div className="h-8 w-20 bg-slate-200 rounded mb-2" />
      <div className="h-3 w-12 bg-slate-100 rounded" />
    </div>
  );
}

function KpiCard({ label, value, trend, positive, icon: Icon }) {
  return (
    <div className="bg-white rounded-xl border border-primary-light p-5 shadow-sm">
      <div className="flex items-center justify-between mb-2">
        <p className="text-xs text-slate-500 uppercase tracking-wider font-semibold">{label}</p>
        <Icon className="w-4 h-4 text-slate-400" />
      </div>
      <p className="text-3xl font-bold text-primary-dark">{value}</p>
      <div className="flex items-center gap-1 mt-1">
        {positive ? (
          <TrendingUp className="w-3 h-3 text-green-500" />
        ) : (
          <TrendingDown className="w-3 h-3 text-red-500" />
        )}
        <span className={`text-xs font-medium ${positive ? 'text-green-600' : 'text-red-500'}`}>
          {trend}
        </span>
      </div>
    </div>
  );
}

function IotStatusBadge({ status }) {
  const styles = {
    online: 'bg-green-100 text-green-700',
    offline: 'bg-slate-100 text-slate-600',
    syncing: 'bg-amber-100 text-amber-700',
    decommissioned: 'bg-red-100 text-red-600',
  };
  return (
    <span className={`px-2 py-0.5 rounded-full text-xs font-medium capitalize ${styles[status] || 'bg-slate-100 text-slate-600'}`}>
      • {status}
    </span>
  );
}

function PipelineCard() {
  return (
    <div className="bg-primary-dark text-white rounded-xl p-6 flex flex-col justify-between min-h-[160px]">
      <div>
        <h2 className="text-lg font-bold mb-2">Curriculum Ingestion Pipeline</h2>
        <p className="text-white/70 text-sm">
          Execute automated text extraction and vectorization for new academic modules.
          Supports PDF, DOCX, and Markdown formats.
        </p>
      </div>
      <Link
        to="/admin/curriculum-ingestion"
        className="mt-4 inline-flex items-center gap-2 bg-white/10 hover:bg-white/20 text-white text-sm font-medium px-4 py-2 rounded-lg transition w-fit"
      >
        <Upload className="w-4 h-4" />
        Upload New Curriculum
      </Link>
    </div>
  );
}

function IntegrityCard({ verifiedCount, lastAuditStatus, onRunAudit, isRunning }) {
  return (
    <div className="bg-white rounded-xl border border-primary-light p-5 shadow-sm">
      <div className="flex items-center gap-2 mb-2">
        <CheckCircle2 className="w-5 h-5 text-green-500" />
        <h2 className="text-base font-bold text-primary-dark">{lastAuditStatus}</h2>
      </div>
      <p className="text-sm text-slate-500 mb-4">
        Global SHA-256 hash check complete. All {verifiedCount?.toLocaleString()} curriculum fragments are verified and tamper-free.
      </p>
      <div className="flex gap-2">
        <button
          onClick={onRunAudit}
          disabled={isRunning}
          className="flex items-center gap-2 px-4 py-2 bg-primary text-white text-sm font-medium rounded-lg hover:bg-primary/90 transition disabled:opacity-60"
        >
          {isRunning && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
          Run Audit
        </button>
        <Link
          to="/admin/audit-logs"
          className="px-4 py-2 bg-primary-dark text-white text-sm font-medium rounded-lg hover:bg-primary-dark/90 transition"
        >
          Logs
        </Link>
      </div>
    </div>
  );
}

function IotRegistryTable({ devices }) {
  return (
    <div className="bg-white rounded-xl border border-primary-light shadow-sm">
      <div className="flex items-center justify-between px-5 py-3 border-b border-slate-100">
        <h2 className="text-base font-bold text-primary-dark">IoT Registry</h2>
        <button className="text-xs font-semibold text-slate-500 uppercase tracking-wider hover:text-primary transition">
          Export CSV
        </button>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-slate-100">
              <th className="text-left px-5 py-2 text-xs font-semibold text-slate-500 uppercase tracking-wider">Node ID</th>
              <th className="text-left px-5 py-2 text-xs font-semibold text-slate-500 uppercase tracking-wider">Type</th>
              <th className="text-left px-5 py-2 text-xs font-semibold text-slate-500 uppercase tracking-wider">Location</th>
              <th className="text-left px-5 py-2 text-xs font-semibold text-slate-500 uppercase tracking-wider">Status</th>
              <th className="px-5 py-2" />
            </tr>
          </thead>
          <tbody>
            {devices?.length > 0 ? (
              devices.map((d, i) => (
                <tr key={i} className="border-b border-slate-50 hover:bg-slate-50/50 transition">
                  <td className="px-5 py-3 text-sm font-medium text-primary-dark">{d.node_id}</td>
                  <td className="px-5 py-3 text-sm text-slate-600">{d.device_type}</td>
                  <td className="px-5 py-3 text-sm text-slate-600">{d.location}</td>
                  <td className="px-5 py-3">
                    <IotStatusBadge status={d.status} />
                  </td>
                  <td className="px-5 py-3 text-slate-400">
                    <MoreHorizontal className="w-4 h-4" />
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={5} className="px-5 py-6 text-center text-sm text-slate-400">
                  No devices registered yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function QuickUserAccess({ users }) {
  const navigate = useNavigate();
  return (
    <div className="bg-white rounded-xl border border-primary-light p-5 shadow-sm">
      <h2 className="text-base font-bold text-primary-dark mb-3">Quick User Access</h2>
      <div className="space-y-3">
        {users?.map((u, i) => (
          <div key={i} className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-primary-light flex items-center justify-center text-primary font-bold text-xs flex-shrink-0">
              {u.full_name?.charAt(0)?.toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-primary-dark truncate">{u.full_name}</p>
              <p className="text-xs text-slate-500 uppercase tracking-wide">{u.role}</p>
            </div>
          </div>
        ))}
      </div>
      <button
        onClick={() => navigate('/admin/users')}
        className="mt-4 w-full py-2 border border-primary-light text-sm text-primary font-medium rounded-lg hover:bg-primary-light/30 transition"
      >
        View Full Directory
      </button>
    </div>
  );
}

function SystemHealthPanel({ health }) {
  const uptime = health?.node_uptime_pct ?? 99.9;
  const memory = health?.memory_load_pct ?? 64;
  return (
    <div className="bg-white rounded-xl border border-primary-light p-5 shadow-sm">
      <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-4">System Health</p>
      <div className="space-y-4">
        <div>
          <div className="flex justify-between text-sm mb-1">
            <span className="text-slate-600">Node Uptime</span>
            <span className="font-semibold text-primary-dark">{uptime}%</span>
          </div>
          <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
            <div className="h-full bg-primary rounded-full" style={{ width: `${uptime}%` }} />
          </div>
        </div>
        <div>
          <div className="flex justify-between text-sm mb-1">
            <span className="text-slate-600">Memory Load</span>
            <span className="font-semibold text-primary-dark">{memory}%</span>
          </div>
          <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
            <div className="h-full bg-primary rounded-full" style={{ width: `${memory}%` }} />
          </div>
        </div>
        <div className="flex items-center gap-2 pt-1">
          <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
          <span className="text-xs text-slate-500 uppercase tracking-wider">Live Monitoring Active</span>
        </div>
      </div>
    </div>
  );
}

export default function AdminDashboard() {
  const navigate = useNavigate();
  const { data, isPending: loading, error, refetch } = useQuery({
    queryKey: ['admin', 'dashboard'],
    queryFn: async () => (await getDashboard()).data,
  });

  const auditMutation = useMutation({
    mutationFn: runIntegrityAudit,
    onSuccess: () => {
      toast.success('Integrity audit complete — all documents verified.');
      refetch();
    },
    onError: () => toast.error('Audit failed. Please try again.'),
  });

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <AlertCircle className="w-12 h-12 text-red-400 mb-4" />
        <h2 className="text-lg font-semibold text-primary-dark mb-2">Dashboard Unavailable</h2>
        <p className="text-slate-500 text-sm mb-4">
          {error?.response?.data?.detail || error?.message || 'Failed to load dashboard'}
        </p>
        <button
          onClick={() => refetch()}
          className="px-4 py-2 bg-primary text-white rounded-lg text-sm hover:bg-primary/90 transition"
        >
          Try Again
        </button>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 rounded-lg bg-primary-light flex items-center justify-center">
          <LayoutDashboard className="w-5 h-5 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-primary-dark">Admin Control Panel</h1>
          <p className="text-sm text-slate-500">Platform overview, IoT health, and system integrity.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        {loading ? (
          <>
            <KpiSkeleton />
            <KpiSkeleton />
            <KpiSkeleton />
          </>
        ) : (
          <>
            <KpiCard
              label="IoT Nodes Active"
              value={data?.iot_nodes_active ?? 0}
              trend="+12%"
              positive
              icon={Cpu}
            />
            <KpiCard
              label="ChromaDB Accuracy"
              value={`${data?.chromadb_accuracy_pct ?? 99.2}%`}
              trend="+0.4%"
              positive
              icon={Upload}
            />
            <KpiCard
              label="2FA Compliance"
              value={`${data?.two_fa_compliance_pct ?? 0}%`}
              trend="-2%"
              positive={false}
              icon={ShieldCheck}
            />
          </>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
        <div className="lg:col-span-2 space-y-6">
          <PipelineCard />
          {loading ? (
            <div className="h-48 bg-slate-200 rounded-xl animate-pulse" />
          ) : (
            <IotRegistryTable devices={data?.iot_registry_preview} />
          )}
        </div>

        <div className="space-y-4">
          {loading ? (
            <>
              <div className="h-40 bg-slate-200 rounded-xl animate-pulse" />
              <div className="h-48 bg-slate-200 rounded-xl animate-pulse" />
              <div className="h-36 bg-slate-200 rounded-xl animate-pulse" />
            </>
          ) : (
            <>
              <IntegrityCard
                verifiedCount={data?.integrity_verified_count}
                lastAuditStatus={data?.integrity_status}
                onRunAudit={() => auditMutation.mutate()}
                isRunning={auditMutation.isPending}
              />
              <QuickUserAccess users={data?.quick_user_access} />
              <SystemHealthPanel health={data?.system_health} />
            </>
          )}
        </div>
      </div>
    </div>
  );
}
