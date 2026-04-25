import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Cpu, MapPin, Copy, ChevronRight, ChevronLeft, MoreVertical,
  Plus, RefreshCw, Shield, Activity, Loader2, AlertCircle, X,
  Eye, Pencil, Wifi, WifiOff, RotateCcw,
} from 'lucide-react';
import toast from 'react-hot-toast';
import {
  listIotDevices, registerDevice, getIotHealth, getIotDevice, updateIotDevice,
  decommissionDevice, regenerateDeviceKey, updateDeviceStatus,
} from '../../services/adminService';

const DEVICE_TYPE_BADGE = {
  ESP32: 'bg-teal-100 text-teal-700',
  'Arduino MKR': 'bg-blue-100 text-blue-700',
  'Raspberry Pi 4': 'bg-purple-100 text-purple-700',
  'ESP32-CAM': 'bg-orange-100 text-orange-700',
};

const STATUS_BADGE = {
  online: 'bg-green-100 text-green-700',
  offline: 'bg-red-100 text-red-700',
  syncing: 'bg-blue-100 text-blue-700',
};

function DeviceTypeBadge({ type }) {
  const cls = DEVICE_TYPE_BADGE[type] ?? 'bg-slate-100 text-slate-600';
  return <span className={`text-xs font-semibold px-2 py-0.5 rounded ${cls}`}>{type ?? '—'}</span>;
}

function StatusBadge({ status }) {
  const cls = STATUS_BADGE[status] ?? 'bg-slate-100 text-slate-600';
  return (
    <span className={`inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full ${cls}`}>
      <span className="w-1.5 h-1.5 rounded-full bg-current" />
      {status?.toUpperCase() ?? 'UNKNOWN'}
    </span>
  );
}

function MaskedKey({ apiKeyHint }) {
  const masked = apiKeyHint ?? '••••••••••••????';

  const copyKey = () => {
    toast.success('Key hint copied');
    navigator.clipboard.writeText(masked);
  };

  return (
    <span className="flex items-center gap-1 font-mono text-xs text-slate-500">
      {masked}
      <button onClick={copyKey} className="text-slate-400 hover:text-primary">
        <Copy className="w-3.5 h-3.5" />
      </button>
    </span>
  );
}

function ActionsMenu({ device, onDecommission, onRegenerate, onViewDetail, onEdit }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="relative">
      <button onClick={() => setOpen(!open)} className="p-1 rounded hover:bg-slate-100">
        <MoreVertical className="w-4 h-4 text-slate-500" />
      </button>
      {open && (
        <div className="absolute right-0 top-7 z-10 bg-white border border-slate-200 rounded-lg shadow-lg w-48 py-1">
          <button
            onClick={() => { setOpen(false); onViewDetail(device); }}
            className="w-full text-left px-4 py-2 text-sm hover:bg-slate-50 flex items-center gap-2 text-slate-700"
          >
            <Eye className="w-4 h-4" /> View Details
          </button>
          <button
            onClick={() => { setOpen(false); onEdit(device); }}
            className="w-full text-left px-4 py-2 text-sm hover:bg-slate-50 flex items-center gap-2 text-slate-700"
          >
            <Pencil className="w-4 h-4" /> Edit
          </button>
          <button
            onClick={() => { setOpen(false); onRegenerate(device); }}
            className="w-full text-left px-4 py-2 text-sm hover:bg-slate-50 flex items-center gap-2 text-slate-700"
          >
            <RefreshCw className="w-4 h-4" /> Regenerate Key
          </button>
          <div className="border-t border-slate-100 my-1" />
          <button
            onClick={() => { setOpen(false); onDecommission(device); }}
            className="w-full text-left px-4 py-2 text-sm hover:bg-red-50 flex items-center gap-2 text-red-600"
          >
            <X className="w-4 h-4" /> Decommission
          </button>
        </div>
      )}
    </div>
  );
}

function EditDeviceModal({ device, onClose, onSuccess }) {
  const [form, setForm] = useState({ location: device.location ?? '', description: device.description ?? '' });
  const [saving, setSaving] = useState(false);
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await updateIotDevice(device.device_id, form);
      toast.success('Device updated');
      onSuccess();
    } catch (err) {
      toast.error(err?.response?.data?.detail ?? 'Failed to update device');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-md mx-4">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold text-primary-dark">Edit Device</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600"><X className="w-5 h-5" /></button>
        </div>
        <p className="text-xs text-slate-500 mb-4">Node: <span className="font-mono font-semibold text-primary-dark">{device.node_id}</span></p>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">Location</label>
            <input
              value={form.location}
              onChange={(e) => set('location', e.target.value)}
              placeholder="e.g. Room 402"
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">Description</label>
            <textarea
              value={form.description}
              onChange={(e) => set('description', e.target.value)}
              rows={2}
              placeholder="Optional notes..."
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 resize-none"
            />
          </div>
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="flex-1 border border-slate-200 text-slate-600 rounded-lg py-2 text-sm font-semibold hover:bg-slate-50">
              Cancel
            </button>
            <button type="submit" disabled={saving} className="flex-1 bg-primary-dark text-white rounded-lg py-2 text-sm font-semibold hover:bg-primary disabled:opacity-50 flex items-center justify-center gap-2">
              {saving && <Loader2 className="w-4 h-4 animate-spin" />} Save
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function DeviceDetailModal({ deviceId, onClose }) {
  const queryClient = useQueryClient();
  const [statusChanging, setStatusChanging] = useState(false);

  const { data: detail, isLoading } = useQuery({
    queryKey: ['admin', 'iot-device-detail', deviceId],
    queryFn: async () => (await getIotDevice(deviceId)).data,
  });

  const handleStatusChange = async (newStatus) => {
    setStatusChanging(true);
    try {
      await updateDeviceStatus(deviceId, { status: newStatus });
      toast.success(`Status set to ${newStatus}`);
      queryClient.invalidateQueries({ queryKey: ['admin', 'iot-devices'] });
      queryClient.invalidateQueries({ queryKey: ['admin', 'iot-device-detail', deviceId] });
    } catch {
      toast.error('Failed to update status');
    } finally {
      setStatusChanging(false);
    }
  };

  const telemetry = detail?.recent_telemetry ?? [];

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40">
      <div className="bg-white rounded-t-2xl sm:rounded-xl shadow-xl w-full sm:max-w-2xl mx-0 sm:mx-4 max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <Cpu className="w-5 h-5 text-primary" />
            <h2 className="text-lg font-bold text-primary-dark">{detail?.node_id ?? 'Device Detail'}</h2>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600"><X className="w-5 h-5" /></button>
        </div>

        {isLoading ? (
          <div className="flex-1 flex items-center justify-center py-20">
            <Loader2 className="w-6 h-6 text-primary animate-spin" />
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto">
            <div className="p-6 grid grid-cols-2 gap-4 text-sm border-b border-slate-100">
              <div>
                <p className="text-xs text-slate-400 uppercase tracking-wider mb-0.5">Type</p>
                <p className="font-medium text-primary-dark">{detail?.device_type ?? '—'}</p>
              </div>
              <div>
                <p className="text-xs text-slate-400 uppercase tracking-wider mb-0.5">Location</p>
                <p className="font-medium text-primary-dark">{detail?.location ?? '—'}</p>
              </div>
              <div>
                <p className="text-xs text-slate-400 uppercase tracking-wider mb-0.5">MAC Address</p>
                <p className="font-mono text-slate-600">{detail?.device_mac ?? '—'}</p>
              </div>
              <div>
                <p className="text-xs text-slate-400 uppercase tracking-wider mb-0.5">Firmware</p>
                <p className="text-slate-600">{detail?.firmware_version ?? '—'}</p>
              </div>
              <div>
                <p className="text-xs text-slate-400 uppercase tracking-wider mb-0.5">Last Seen</p>
                <p className="text-slate-600">{detail?.last_seen_at ? new Date(detail.last_seen_at).toLocaleString() : 'Never'}</p>
              </div>
              <div>
                <p className="text-xs text-slate-400 uppercase tracking-wider mb-0.5">Status</p>
                <div className="flex items-center gap-2">
                  <StatusBadge status={detail?.status} />
                  <div className="flex gap-1">
                    {['online', 'offline', 'syncing'].map((s) => (
                      <button
                        key={s}
                        onClick={() => handleStatusChange(s)}
                        disabled={statusChanging || detail?.status === s}
                        className="text-xs px-2 py-0.5 rounded border border-slate-200 text-slate-500 hover:border-primary hover:text-primary disabled:opacity-40 transition-colors"
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {detail?.description && (
              <div className="px-6 py-3 border-b border-slate-100">
                <p className="text-xs text-slate-400 uppercase tracking-wider mb-1">Description</p>
                <p className="text-sm text-slate-600">{detail.description}</p>
              </div>
            )}

            <div className="px-6 py-4">
              <div className="flex items-center gap-2 mb-3">
                <Activity className="w-4 h-4 text-primary" />
                <h3 className="font-semibold text-primary-dark text-sm">Recent Telemetry</h3>
                <span className="text-xs text-slate-400">({telemetry.length} entries)</span>
              </div>
              {telemetry.length === 0 ? (
                <div className="text-center py-6 text-slate-400 text-sm">No telemetry data available</div>
              ) : (
                <div className="overflow-x-auto rounded-lg border border-slate-100">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-100">
                        <th className="text-left px-3 py-2 font-semibold text-slate-500">Timestamp</th>
                        <th className="text-left px-3 py-2 font-semibold text-slate-500">Temperature</th>
                        <th className="text-left px-3 py-2 font-semibold text-slate-500">Humidity</th>
                        <th className="text-left px-3 py-2 font-semibold text-slate-500">Raw Data</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                      {telemetry.map((t, i) => (
                        <tr key={i} className="hover:bg-slate-50/50">
                          <td className="px-3 py-2 text-slate-500">{t.logged_at ? new Date(t.logged_at).toLocaleString() : '—'}</td>
                          <td className="px-3 py-2 font-mono text-primary-dark">{t.temperature_c != null ? `${t.temperature_c}°C` : '—'}</td>
                          <td className="px-3 py-2 font-mono text-slate-600">{t.humidity_pct != null ? `${t.humidity_pct}%` : '—'}</td>
                          <td className="px-3 py-2 text-slate-400 max-w-xs truncate">{t.raw_payload ?? '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function RegisterDeviceModal({ onClose, onRegistered }) {
  const [form, setForm] = useState({ node_id: '', device_type: 'ESP32', location: '' });
  const [saving, setSaving] = useState(false);
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await registerDevice(form);
      onRegistered(res.data);
    } catch (err) {
      toast.error(err?.response?.data?.detail ?? 'Registration failed');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-md mx-4">
        <h2 className="text-lg font-bold text-primary-dark mb-4">Register New Device</h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">Node ID</label>
            <input
              required
              value={form.node_id}
              onChange={(e) => set('node_id', e.target.value)}
              placeholder="e.g. ESP-WROOM-32"
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">Device Type</label>
            <select
              value={form.device_type}
              onChange={(e) => set('device_type', e.target.value)}
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
            >
              <option>ESP32</option>
              <option>Arduino MKR</option>
              <option>Raspberry Pi 4</option>
              <option>ESP32-CAM</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">Location</label>
            <input
              value={form.location}
              onChange={(e) => set('location', e.target.value)}
              placeholder="e.g. Room 402"
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
            />
          </div>
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="flex-1 border border-slate-200 text-slate-600 rounded-lg py-2 text-sm font-semibold hover:bg-slate-50">
              Cancel
            </button>
            <button type="submit" disabled={saving} className="flex-1 bg-primary-dark text-white rounded-lg py-2 text-sm font-semibold hover:bg-primary disabled:opacity-50 flex items-center justify-center gap-2">
              {saving && <Loader2 className="w-4 h-4 animate-spin" />} Register
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function ApiKeyModal({ apiKey, nodeId, onClose }) {
  const copyKey = () => {
    navigator.clipboard.writeText(apiKey);
    toast.success('API key copied');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-md mx-4">
        <h2 className="text-lg font-bold text-primary-dark mb-1">Device Registered: {nodeId}</h2>
        <p className="text-sm text-slate-500 mb-4">Save this API key securely — it will not be shown again.</p>
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-sm text-amber-800 mb-4">
          ⚠ Store this key in a secure location. Once you close this dialog it cannot be recovered.
        </div>
        <div className="flex items-center gap-2 bg-slate-100 rounded-lg p-3 font-mono text-sm break-all">
          <span className="flex-1">{apiKey}</span>
          <button onClick={copyKey} className="text-slate-500 hover:text-primary shrink-0">
            <Copy className="w-4 h-4" />
          </button>
        </div>
        <button
          onClick={onClose}
          className="mt-4 w-full bg-primary-dark text-white rounded-lg py-2.5 text-sm font-semibold hover:bg-primary transition-colors"
        >
          I've saved the key
        </button>
      </div>
    </div>
  );
}

function ConfirmDialog({ title, message, onConfirm, onCancel }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-sm mx-4">
        <div className="flex items-start gap-3 mb-4">
          <AlertCircle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
          <div>
            <h2 className="font-bold text-primary-dark">{title}</h2>
            <p className="text-sm text-slate-500 mt-1">{message}</p>
          </div>
        </div>
        <div className="flex gap-3">
          <button onClick={onCancel} className="flex-1 border border-slate-200 text-slate-600 rounded-lg py-2 text-sm font-semibold hover:bg-slate-50">
            Cancel
          </button>
          <button onClick={onConfirm} className="flex-1 bg-red-600 text-white rounded-lg py-2 text-sm font-semibold hover:bg-red-700">
            Decommission
          </button>
        </div>
      </div>
    </div>
  );
}

function HealthCard({ label, value, sub, icon: Icon }) {
  return (
    <div className="bg-white rounded-xl border border-primary-light p-5 flex items-center justify-between shadow-sm">
      <div>
        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">{label}</p>
        <p className="text-2xl font-bold text-primary-dark mt-1">{value}</p>
        <p className="text-xs text-slate-400 mt-0.5">{sub}</p>
      </div>
      <div className="w-10 h-10 rounded-full bg-primary-light flex items-center justify-center">
        <Icon className="w-5 h-5 text-primary" />
      </div>
    </div>
  );
}

const PAGE_SIZE = 10;

export default function DeviceManagement() {
  const [page, setPage] = useState(1);
  const [showRegister, setShowRegister] = useState(false);
  const [newApiKey, setNewApiKey] = useState(null);
  const [confirmDevice, setConfirmDevice] = useState(null);
  const [detailDevice, setDetailDevice] = useState(null);
  const [editDevice, setEditDevice] = useState(null);
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ['admin', 'iot-devices', page],
    queryFn: async () => (await listIotDevices({ page, page_size: PAGE_SIZE })).data,
  });

  const { data: health } = useQuery({
    queryKey: ['admin', 'iot-health'],
    queryFn: async () => (await getIotHealth()).data,
  });

  const decommissionMutation = useMutation({
    mutationFn: (id) => decommissionDevice(id),
    onSuccess: () => {
      toast.success('Device decommissioned');
      queryClient.invalidateQueries({ queryKey: ['admin', 'iot-devices'] });
      setConfirmDevice(null);
    },
    onError: () => toast.error('Failed to decommission'),
  });

  const regenMutation = useMutation({
    mutationFn: (id) => regenerateDeviceKey(id),
    onSuccess: (res) => {
      const key = res.data?.api_key;
      if (key) setNewApiKey({ key, nodeId: res.data?.node_id ?? 'Device' });
      queryClient.invalidateQueries({ queryKey: ['admin', 'iot-devices'] });
    },
    onError: () => toast.error('Key regeneration failed'),
  });

  const handleRegistered = (data) => {
    setShowRegister(false);
    if (data?.api_key) setNewApiKey({ key: data.api_key, nodeId: data.node_id ?? 'New Device' });
    queryClient.invalidateQueries({ queryKey: ['admin', 'iot-devices'] });
  };

  const devices = data?.devices ?? [];
  const total = data?.total_count ?? 0;
  const totalPages = Math.ceil(total / PAGE_SIZE) || 1;
  const activeNodes = health?.active_device_count ?? data?.active_nodes ?? 0;
  const offlineNodes = health?.offline_device_count ?? 0;

  return (
    <div>
      <div className="mb-1 flex items-center gap-1 text-xs text-slate-400">
        <span>IoT Management</span>
        <ChevronRight className="w-3 h-3" />
        <span className="text-slate-600 font-medium">Device Management</span>
      </div>

      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-primary-dark">Device Management</h1>
          <p className="text-sm text-slate-500 mt-0.5">Manage and monitor connected hardware nodes across the campus.</p>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1.5 text-xs font-semibold text-green-600 bg-green-50 border border-green-200 rounded-full px-3 py-1">
              <span className="w-1.5 h-1.5 rounded-full bg-green-500" /> Active Nodes: {activeNodes}
            </span>
            <span className="flex items-center gap-1.5 text-xs font-semibold text-red-600 bg-red-50 border border-red-200 rounded-full px-3 py-1">
              <span className="w-1.5 h-1.5 rounded-full bg-red-500" /> Offline: {offlineNodes}
            </span>
          </div>
          <button
            onClick={() => setShowRegister(true)}
            className="flex items-center gap-2 bg-primary-dark text-white text-sm font-semibold px-4 py-2 rounded-lg hover:bg-primary transition-colors"
          >
            <Plus className="w-4 h-4" /> Register New Device
          </button>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-primary-light shadow-sm mb-6 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-primary-light bg-slate-50">
              {['Node ID', 'Device Type', 'Location', 'API Key', 'Status', 'Last Seen', 'Actions'].map((h) => (
                <th key={h} className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wider px-4 py-3">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {isLoading && (
              <tr>
                <td colSpan={7} className="text-center py-12">
                  <Loader2 className="w-6 h-6 text-primary animate-spin mx-auto" />
                </td>
              </tr>
            )}
            {!isLoading && devices.length === 0 && (
              <tr>
                <td colSpan={7} className="text-center py-12 text-slate-400 text-sm">No devices registered</td>
              </tr>
            )}
            {devices.map((d) => (
              <tr key={d.device_id} className="hover:bg-slate-50/60 transition-colors">
                <td className="px-4 py-3 font-medium text-primary-dark flex items-center gap-2">
                  <Cpu className="w-4 h-4 text-primary shrink-0" />
                  {d.node_id ?? d.device_id?.slice(0, 8)}
                </td>
                <td className="px-4 py-3"><DeviceTypeBadge type={d.device_type} /></td>
                <td className="px-4 py-3 text-slate-500 flex items-center gap-1">
                  <MapPin className="w-3.5 h-3.5 shrink-0" />
                  {d.location ?? '—'}
                </td>
                <td className="px-4 py-3"><MaskedKey apiKeyHint={d.api_key_hint ?? ''} /></td>
                <td className="px-4 py-3"><StatusBadge status={d.status} /></td>
                <td className="px-4 py-3 text-slate-400 text-xs">{d.last_seen_at ? new Date(d.last_seen_at).toLocaleString() : 'Never'}</td>
                <td className="px-4 py-3">
                  <ActionsMenu
                    device={d}
                    onDecommission={setConfirmDevice}
                    onRegenerate={(dev) => regenMutation.mutate(dev.device_id)}
                    onViewDetail={(dev) => setDetailDevice(dev.device_id)}
                    onEdit={setEditDevice}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="flex items-center justify-between px-4 py-3 border-t border-slate-100 text-xs text-slate-500">
          <span>Showing {devices.length ? `${(page - 1) * PAGE_SIZE + 1}–${(page - 1) * PAGE_SIZE + devices.length}` : '0'} of {total} devices</span>
          <div className="flex items-center gap-1">
            <button disabled={page === 1} onClick={() => setPage((p) => p - 1)} className="p-1 rounded hover:bg-slate-100 disabled:opacity-40">
              <ChevronLeft className="w-4 h-4" />
            </button>
            {[...Array(Math.min(totalPages, 3))].map((_, i) => (
              <button
                key={i + 1}
                onClick={() => setPage(i + 1)}
                className={`w-6 h-6 rounded text-xs font-medium ${page === i + 1 ? 'bg-primary text-white' : 'hover:bg-slate-100 text-slate-600'}`}
              >
                {i + 1}
              </button>
            ))}
            <button disabled={page === totalPages} onClick={() => setPage((p) => p + 1)} className="p-1 rounded hover:bg-slate-100 disabled:opacity-40">
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <HealthCard label="Health Check" value={`${health?.health_check_pct ?? 98.2}%`} sub={health?.uptime_status ?? 'Stable uptime this week'} icon={Shield} />
        <HealthCard label="Data Throughput" value={`${health?.data_throughput_gbps ?? 1.2} GB/s`} sub="Real-time aggregate stream" icon={Activity} />
        <HealthCard label="Network Security" value={health?.network_security_protocol ?? 'TLS 1.3'} sub="AES-256 Encrypted channel" icon={Shield} />
      </div>

      {showRegister && <RegisterDeviceModal onClose={() => setShowRegister(false)} onRegistered={handleRegistered} />}

      {newApiKey && (
        <ApiKeyModal
          apiKey={newApiKey.key}
          nodeId={newApiKey.nodeId}
          onClose={() => setNewApiKey(null)}
        />
      )}

      {editDevice && (
        <EditDeviceModal
          device={editDevice}
          onClose={() => setEditDevice(null)}
          onSuccess={() => {
            setEditDevice(null);
            queryClient.invalidateQueries({ queryKey: ['admin', 'iot-devices'] });
          }}
        />
      )}

      {detailDevice && (
        <DeviceDetailModal
          deviceId={detailDevice}
          onClose={() => setDetailDevice(null)}
        />
      )}

      {confirmDevice && (
        <ConfirmDialog
          title="Decommission Device"
          message={`Are you sure you want to decommission "${confirmDevice.node_id}"? This action cannot be undone.`}
          onConfirm={() => decommissionMutation.mutate(confirmDevice.device_id)}
          onCancel={() => setConfirmDevice(null)}
        />
      )}
    </div>
  );
}
