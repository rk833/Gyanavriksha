import { useState, useEffect, useRef } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Cpu, Wifi, WifiOff, Sun, Activity, Shield,
  RefreshCw, MoreVertical, PlusCircle, AlertTriangle,
  CheckCircle2, Circle, X, Info, Zap,
} from 'lucide-react';
import { getIotStatus } from '../../services/studentService';
import { getWebSocketOrigin } from '../../lib/wsOrigin';

const POLL_INTERVAL_MS = 15_000;
const DEVICE_STALE_MS = 30_000;

const QUERY_KEY_IOT_STATUS = ['student', 'iot-status'];

/** Merge server-pushed MQTT snapshot into REST-shaped IoT cache. */
function mergeIotTelemetryCache(prev, msg) {
  if (!prev || !msg || msg.type !== 'iot_telemetry') return prev;
  const next = { ...prev };
  if (msg.latest_distance_cm !== undefined && msg.latest_distance_cm !== null) {
    next.latest_distance_cm = msg.latest_distance_cm;
    if (msg.latest_distance_at) next.latest_distance_at = msg.latest_distance_at;
  }
  if (msg.latest_ldr_value !== undefined && msg.latest_ldr_value !== null) {
    next.latest_ldr_value = msg.latest_ldr_value;
    if (msg.latest_ldr_at) next.latest_ldr_at = msg.latest_ldr_at;
  }
  if (msg.latest_led_activated !== undefined && msg.latest_led_activated !== null) {
    next.latest_led_activated = msg.latest_led_activated;
  }
  if (msg.device_id && Array.isArray(next.devices)) {
    next.devices = next.devices.map((d) => {
      if (String(d.device_id) !== String(msg.device_id)) return { ...d };
      const u = { ...d };
      if (msg.node_status != null) u.status = msg.node_status;
      if (msg.last_seen_at) u.last_seen_at = msg.last_seen_at;
      if (msg.latest_distance_cm != null || msg.latest_distance_at) {
        u.latest_distance = {
          ...(u.latest_distance || {}),
          ...(msg.latest_distance_cm != null ? { distance_cm: msg.latest_distance_cm } : {}),
          ...(msg.latest_distance_at ? { recorded_at: msg.latest_distance_at } : {}),
        };
      }
      if (msg.latest_ldr_value != null || msg.latest_ldr_at) {
        u.latest_light = {
          ...(u.latest_light || {}),
          ...(msg.latest_ldr_value != null ? { ldr_value: msg.latest_ldr_value } : {}),
          ...(msg.latest_led_activated !== undefined && msg.latest_led_activated !== null
            ? { led_activated: msg.latest_led_activated }
            : {}),
          ...(msg.latest_ldr_at ? { recorded_at: msg.latest_ldr_at } : {}),
        };
      }
      return u;
    });
  }
  return next;
}

function formatRelative(isoStr) {
  if (!isoStr) return '—';
  const hasOff = isoStr.endsWith('Z') || /[+-]\d{2}:\d{2}$/.test(isoStr);
  const d = new Date(hasOff ? isoStr : isoStr + 'Z');
  const diff = (Date.now() - d.getTime()) / 1000;
  if (diff < 5) return 'just now';
  if (diff < 60) return `${Math.floor(diff)}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function isFreshHeartbeat(isoStr) {
  if (!isoStr) return false;
  const hasOff = isoStr.endsWith('Z') || /[+-]\d{2}:\d{2}$/.test(isoStr);
  const d = new Date(hasOff ? isoStr : `${isoStr}Z`);
  const ms = d.getTime();
  if (Number.isNaN(ms)) return false;
  return Date.now() - ms <= DEVICE_STALE_MS;
}

function getPostureLabel(cm) {
  if (cm == null) return { label: 'No data', color: 'text-slate-400', bg: 'bg-slate-100' };
  if (cm < 30) return { label: 'Too close', color: 'text-red-600', bg: 'bg-red-50' };
  if (cm <= 80) return { label: 'Optimal alignment', color: 'text-emerald-600', bg: 'bg-emerald-50' };
  return { label: 'Too far', color: 'text-amber-600', bg: 'bg-amber-50' };
}

function getPresenceLabel(cm) {
  if (cm == null) return { label: 'Unknown', color: 'text-slate-400' };
  if (cm <= 150) return { label: 'Present', color: 'text-emerald-600' };
  return { label: 'Away', color: 'text-red-500' };
}

function SensorCard({ icon: Icon, iconBg, title, value, unit, label, labelColor, labelBg, sub, loading }) {
  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-5 flex flex-col gap-3 shadow-sm">
      <div className="flex items-center justify-between">
        <span className={`w-9 h-9 rounded-xl flex items-center justify-center ${iconBg}`}>
          <Icon className="w-5 h-5" />
        </span>
        {label && (
          <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${labelBg} ${labelColor}`}>
            {label}
          </span>
        )}
      </div>
      <div>
        <p className="text-xs text-slate-500 font-medium mb-0.5">{title}</p>
        {loading ? (
          <div className="h-7 w-24 bg-slate-100 rounded-lg animate-pulse" />
        ) : (
          <p className="text-2xl font-bold text-slate-900">
            {value ?? '—'}
            {value != null && unit && <span className="text-base font-medium text-slate-500 ml-1">{unit}</span>}
          </p>
        )}
        {sub && <p className="text-xs text-slate-400 mt-1">{sub}</p>}
      </div>
    </div>
  );
}

function DeviceStatusBadge({ status }) {
  const map = {
    online: { bg: 'bg-emerald-50', text: 'text-emerald-700', dot: 'bg-emerald-500', label: 'Online' },
    offline: { bg: 'bg-slate-100', text: 'text-slate-500', dot: 'bg-slate-400', label: 'Offline' },
    standby: { bg: 'bg-amber-50', text: 'text-amber-700', dot: 'bg-amber-400', label: 'Standby' },
  };
  const s = map[status] || map.offline;
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${s.bg} ${s.text}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${s.dot}`} />
      {s.label}
    </span>
  );
}

export default function IoTStatus() {
  const queryClient = useQueryClient();
  const [openMenu, setOpenMenu] = useState(null);
  const [showRegisterModal, setShowRegisterModal] = useState(false);
  const [liveWs, setLiveWs] = useState(false);
  const [lastWsPushAt, setLastWsPushAt] = useState(null);
  const menuRef = useRef(null);

  const { data, isPending, isError, refetch, dataUpdatedAt } = useQuery({
    queryKey: QUERY_KEY_IOT_STATUS,
    queryFn: async () => {
      const res = await getIotStatus();
      return res.data;
    },
    refetchInterval: POLL_INTERVAL_MS,
    retry: 1,
  });

  useEffect(() => {
    let ws;
    let reconnectTimer;
    let cancelled = false;

    const connect = () => {
      const token = localStorage.getItem('access_token');
      if (!token || cancelled) return;

      const origin = getWebSocketOrigin();
      try {
        ws = new WebSocket(`${origin}/api/students/ws/iot-session?token=${encodeURIComponent(token)}`);
      } catch {
        reconnectTimer = setTimeout(connect, 4000);
        return;
      }

      ws.onmessage = (e) => {
        let msg;
        try {
          msg = JSON.parse(e.data);
        } catch {
          return;
        }
        if (msg.type === 'connected') {
          setLiveWs(true);
          return;
        }
        if (msg.type !== 'iot_telemetry') return;
        queryClient.setQueryData(QUERY_KEY_IOT_STATUS, (prev) => mergeIotTelemetryCache(prev, msg));
        setLastWsPushAt(Date.now());
      };

      ws.onerror = () => {};

      ws.onclose = () => {
        setLiveWs(false);
        ws = undefined;
        if (cancelled) return;
        reconnectTimer = setTimeout(connect, 3500);
      };
    };

    connect();

    return () => {
      cancelled = true;
      clearTimeout(reconnectTimer);
      if (ws && ws.readyState === WebSocket.OPEN) ws.close();
    };
  }, [queryClient]);

  // Close action menu on outside click
  useEffect(() => {
    const handler = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) setOpenMenu(null);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const devices = (data?.devices || []).map((d) => ({
    ...d,
    status: d.status === 'online' && !isFreshHeartbeat(d.last_seen_at) ? 'offline' : d.status,
  }));
  const distCm = data?.latest_distance_cm ?? null;
  const ldrVal = data?.latest_ldr_value ?? null;
  const ledOn = data?.latest_led_activated ?? null;
  const distAt = data?.latest_distance_at;
  const ldrAt = data?.latest_ldr_at;
  const connected = devices.some((d) => d.status === 'online');
  const hasRegisteredDevice = devices.length > 0;

  const posture = getPostureLabel(distCm);
  const presence = getPresenceLabel(distCm);

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <h1 className="text-2xl font-bold text-slate-900">Smart Desk — IoT Status</h1>
            <span
              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border ${
                connected
                  ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                  : 'bg-slate-100 text-slate-500 border-slate-200'
              }`}
            >
              {connected ? <Wifi className="w-3.5 h-3.5" /> : <WifiOff className="w-3.5 h-3.5" />}
              {connected ? 'Device connected' : 'No device connected'}
            </span>
          </div>
          <p className="text-sm text-slate-500">
            Sensor stream over WebSocket; full reconciliation about every {Math.round(POLL_INTERVAL_MS / 1000)}s.
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap justify-end">
          {liveWs && (
            <span className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wide bg-emerald-50 text-emerald-700 border border-emerald-100">
              <Zap className="w-3 h-3" />
              Live WS
            </span>
          )}
          {lastWsPushAt != null && (
            <span className="text-xs text-slate-400">
              Stream {formatRelative(new Date(lastWsPushAt).toISOString())}
            </span>
          )}
          {dataUpdatedAt > 0 && (
            <span className="text-xs text-slate-400">
              HTTP sync {formatRelative(new Date(dataUpdatedAt).toISOString())}
            </span>
          )}
          <button
            onClick={() => refetch()}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-medium text-slate-600 border border-slate-200 hover:bg-slate-50 transition-colors"
          >
            <RefreshCw className="w-4 h-4" />
            Refresh
          </button>
        </div>
      </div>

      {/* Error banner */}
      {isError && (
        <div className="flex items-center gap-3 p-4 rounded-2xl bg-amber-50 border border-amber-200 text-amber-800 text-sm">
          <AlertTriangle className="w-5 h-5 flex-shrink-0" />
          <span>Could not load IoT data. Make sure your device is connected and try refreshing.</span>
        </div>
      )}

      {/* Device disconnected banner */}
      {!isPending && !isError && hasRegisteredDevice && !connected && (
        <div className="flex items-center gap-3 p-4 rounded-2xl bg-orange-50 border border-orange-200 text-orange-800 text-sm">
          <AlertTriangle className="w-5 h-5 flex-shrink-0" />
          <span>
            Physical IoT device is disconnected (offline). Power on your ESP32 and reconnect to Wi-Fi/MQTT.
          </span>
        </div>
      )}

      {/* Sensor cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <SensorCard
          icon={Sun}
          iconBg="bg-amber-100 text-amber-600"
          title="Ambient Light"
          value={ldrVal != null ? Math.round(ldrVal) : null}
          unit="lux"
          label={ldrVal != null ? (ledOn ? 'LED on' : 'LED off') : undefined}
          labelColor={ledOn ? 'text-amber-700' : 'text-slate-500'}
          labelBg={ledOn ? 'bg-amber-100' : 'bg-slate-100'}
          sub={ldrAt ? `Last: ${formatRelative(ldrAt)}` : undefined}
          loading={isPending}
        />
        <SensorCard
          icon={Shield}
          iconBg={`${posture.bg} ${posture.color}`}
          title="Posture Guard"
          value={distCm != null ? Math.round(distCm) : null}
          unit="cm"
          label={distCm != null ? posture.label : undefined}
          labelColor={posture.color}
          labelBg={posture.bg}
          sub={distAt ? `Last: ${formatRelative(distAt)}` : undefined}
          loading={isPending}
        />
        <SensorCard
          icon={Activity}
          iconBg="bg-primary-light text-primary"
          title="Presence Detection"
          value={distCm != null ? (distCm <= 150 ? '✓' : '✗') : null}
          unit=""
          label={distCm != null ? presence.label : undefined}
          labelColor={presence.color}
          labelBg={distCm != null && distCm <= 150 ? 'bg-emerald-50' : 'bg-red-50'}
          sub={distAt ? `Last: ${formatRelative(distAt)}` : undefined}
          loading={isPending}
        />
        <SensorCard
          icon={Cpu}
          iconBg="bg-blue-100 text-blue-600"
          title="Connected Devices"
          value={isPending ? null : devices.length}
          unit={devices.length === 1 ? 'device' : 'devices'}
          label={connected ? 'Active' : 'Standby'}
          labelColor={connected ? 'text-emerald-600' : 'text-slate-500'}
          labelBg={connected ? 'bg-emerald-50' : 'bg-slate-100'}
          loading={isPending}
        />
      </div>

      {/* Connected devices table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
          <h2 className="font-semibold text-slate-900">Connected Devices</h2>
          <span className="text-xs text-slate-400 bg-slate-100 rounded-full px-2.5 py-1">
            {devices.length} device{devices.length !== 1 ? 's' : ''}
          </span>
        </div>

        {isPending ? (
          <div className="p-8 space-y-3">
            {[1, 2].map((i) => (
              <div key={i} className="h-14 bg-slate-100 rounded-xl animate-pulse" />
            ))}
          </div>
        ) : devices.length === 0 ? (
          <div className="py-16 px-6 text-center">
            <div className="w-14 h-14 rounded-2xl bg-slate-100 flex items-center justify-center mx-auto mb-4">
              <Cpu className="w-7 h-7 text-slate-400" />
            </div>
            <p className="text-slate-600 font-medium mb-1">No devices registered</p>
            <p className="text-sm text-slate-400">
              Register your ESP32 device to enable smart desk features.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100" ref={menuRef}>
            {devices.map((device) => (
              <div key={device.device_id} className="flex items-center gap-3 px-5 py-4 hover:bg-slate-50 transition-colors">
                <div className="w-9 h-9 rounded-xl bg-primary-light flex items-center justify-center flex-shrink-0">
                  <Cpu className="w-5 h-5 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-slate-900 truncate">
                    {device.device_label || device.node_id || `Device ${device.device_id.slice(0, 8)}`}
                  </p>
                  <p className="text-xs text-slate-400 mt-0.5">
                    {device.device_type || 'ESP32'} · ID: {(device.node_id || device.device_id).slice(0, 12)}
                    {device.location ? ` · ${device.location}` : ''}
                  </p>
                </div>
                <div className="flex items-center gap-3 flex-shrink-0">
                  <DeviceStatusBadge status={device.status} />
                  <div className="text-right hidden sm:block">
                    <p className="text-xs text-slate-500">Last ping</p>
                    <p className="text-xs font-medium text-slate-700">
                      {formatRelative(device.last_seen_at)}
                    </p>
                  </div>
                  <div className="relative">
                    <button
                      onClick={() => setOpenMenu(openMenu === device.device_id ? null : device.device_id)}
                      className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 transition-colors"
                    >
                      <MoreVertical className="w-4 h-4" />
                    </button>
                    {openMenu === device.device_id && (
                      <div className="absolute right-0 top-8 bg-white border border-slate-200 rounded-xl shadow-lg z-10 min-w-[140px] py-1">
                        <button
                          className="w-full text-left px-4 py-2 text-sm text-slate-700 hover:bg-slate-50 flex items-center gap-2"
                          onClick={() => setOpenMenu(null)}
                        >
                          <CheckCircle2 className="w-4 h-4 text-primary" />
                          View detail
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Register button */}
        <div className="px-5 py-4 border-t border-slate-100 bg-slate-50/50">
          <button
            className="flex items-center gap-2 text-sm font-medium text-primary hover:text-primary-dark transition-colors"
            onClick={() => setShowRegisterModal(true)}
          >
            <PlusCircle className="w-4 h-4" />
            Register new device
          </button>
        </div>
      </div>

      {/* Info callout */}
      <div className="rounded-2xl bg-primary-light/40 border border-primary/20 px-5 py-4 text-sm text-primary-dark">
        <p className="font-semibold mb-1 flex items-center gap-2">
          <Circle className="w-3.5 h-3.5 fill-primary text-primary" />
          How smart desk works
        </p>
        <ul className="text-xs text-primary-dark/80 space-y-1 ml-5 list-disc">
          <li>The ultrasonic sensor detects your distance. Staying 30–80 cm is optimal.</li>
          <li>During exams, if you move away (&gt;80 cm) for 3 readings, your exam is auto-paused.</li>
          <li>After all allowed pauses, the exam is forfeited for academic integrity.</li>
          <li>The LDR sensor adjusts the LED light automatically based on ambient brightness.</li>
        </ul>
      </div>

      {/* Register new device modal */}
      {showRegisterModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6">
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center gap-3">
                <span className="w-10 h-10 rounded-xl bg-primary-light flex items-center justify-center">
                  <Cpu className="w-5 h-5 text-primary" />
                </span>
                <div>
                  <h3 className="font-semibold text-slate-900">Register New Device</h3>
                  <p className="text-xs text-slate-500">ESP32 Smart Desk</p>
                </div>
              </div>
              <button
                onClick={() => setShowRegisterModal(false)}
                className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="rounded-xl bg-blue-50 border border-blue-200 px-4 py-3 mb-5 flex gap-3 text-sm text-blue-800">
              <Info className="w-4 h-4 flex-shrink-0 mt-0.5" />
              <span>Device registration is managed by your institution's admin. Follow the steps below to get your ESP32 set up.</span>
            </div>

            <ol className="space-y-3 text-sm text-slate-700 mb-6">
              <li className="flex gap-3">
                <span className="w-6 h-6 rounded-full bg-primary text-white text-xs font-bold flex items-center justify-center flex-shrink-0">1</span>
                <span>Request an ESP32 smart desk device from your institution's IT or admin team.</span>
              </li>
              <li className="flex gap-3">
                <span className="w-6 h-6 rounded-full bg-primary text-white text-xs font-bold flex items-center justify-center flex-shrink-0">2</span>
                <span>Ask the admin to register the device in <strong>Admin → Device Management</strong> and assign it to your account.</span>
              </li>
              <li className="flex gap-3">
                <span className="w-6 h-6 rounded-full bg-primary text-white text-xs font-bold flex items-center justify-center flex-shrink-0">3</span>
                <span>Flash the Gyanavriksha firmware onto the ESP32 and connect it to the MQTT broker using the credentials provided by your admin.</span>
              </li>
              <li className="flex gap-3">
                <span className="w-6 h-6 rounded-full bg-primary text-white text-xs font-bold flex items-center justify-center flex-shrink-0">4</span>
                <span>Once online, your device appears here; readings stream live over WebSocket with periodic REST sync.</span>
              </li>
            </ol>

            <button
              onClick={() => setShowRegisterModal(false)}
              className="w-full py-2.5 rounded-xl bg-primary text-white text-sm font-semibold hover:bg-primary-dark transition-colors"
            >
              Got it
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
