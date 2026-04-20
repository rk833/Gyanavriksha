import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  User, ShieldCheck, Bell, Settings, Palette, Link2, HardDrive, Info,
  Database, Cloud, RefreshCw, Loader2, Eye, Check,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { getSettings, updateSettings, reindexStore } from '../../services/adminService';

const SIDEBAR_ITEMS = [
  { id: 'profile', label: 'Profile', icon: User },
  { id: 'security', label: 'Security', icon: ShieldCheck },
  { id: 'notifications', label: 'Notifications', icon: Bell },
  { id: 'system', label: 'System Configuration', icon: Settings },
  { id: 'appearance', label: 'Appearance', icon: Palette },
  { id: 'api', label: 'API and Integration', icon: Link2 },
  { id: 'backup', label: 'Backup and Maintenance', icon: HardDrive },
  { id: 'about', label: 'About', icon: Info },
];

const OCR_OPTIONS = [
  'Tesseract 5.0 Optimized',
  'Google Vision',
  'PaddleOCR',
];

function SettingsSidebar({ active, onSelect }) {
  return (
    <aside className="w-52 shrink-0">
      <nav className="space-y-0.5">
        {SIDEBAR_ITEMS.map((item) => (
          <button
            key={item.id}
            onClick={() => onSelect(item.id)}
            className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm transition-colors ${active === item.id ? 'bg-primary-light text-primary-dark font-semibold border-l-2 border-primary' : 'text-slate-600 hover:bg-slate-100'}`}
          >
            <item.icon className="w-4 h-4 shrink-0" />
            {item.label}
          </button>
        ))}
      </nav>
    </aside>
  );
}

function SystemCoreSection({ form, onChange }) {
  const queryClient = useQueryClient();
  const reindexMutation = useMutation({
    mutationFn: () => reindexStore(),
    onSuccess: () => toast.success('Re-index triggered'),
    onError: () => toast.error('Re-index failed'),
  });

  const totalEmbeddings = 42904;

  return (
    <div>
      <p className="text-xs font-semibold text-slate-400 uppercase tracking-widest mb-4">System Core</p>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-4">
        <div>
          <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-2">OCR Engine Selector</label>
          <select
            value={form.ocr_engine ?? OCR_OPTIONS[0]}
            onChange={(e) => onChange('ocr_engine', e.target.value)}
            className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-primary/30"
          >
            {OCR_OPTIONS.map((o) => <option key={o}>{o}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-2">RAG Chunk Settings</label>
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-400">206</span>
            <input
              type="range" min={206} max={1024} step={1}
              value={form.rag_chunk_size ?? 512}
              onChange={(e) => onChange('rag_chunk_size', parseInt(e.target.value))}
              className="flex-1 accent-primary"
            />
            <span className="text-xs text-slate-400">1024</span>
          </div>
          <p className="text-center text-xs font-semibold text-primary-dark mt-1">{form.rag_chunk_size ?? 512} tokens</p>
        </div>
      </div>
      <div className="bg-primary-dark text-white rounded-xl px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-primary-light/20 flex items-center justify-center">
            <Database className="w-4 h-4 text-primary-light" />
          </div>
          <div>
            <p className="font-bold text-white">ChromaDB Vector Store</p>
            <p className="text-xs text-primary-light">Operational · {totalEmbeddings.toLocaleString()} Embeddings stored</p>
          </div>
        </div>
        <button
          onClick={() => reindexMutation.mutate()}
          disabled={reindexMutation.isPending}
          className="border border-white/40 text-white text-xs font-bold px-4 py-2 rounded-lg hover:bg-white/10 transition-colors flex items-center gap-1.5 disabled:opacity-50"
        >
          {reindexMutation.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
          RE-INDEX STORE
        </button>
      </div>
    </div>
  );
}

function IntegrationCard({ title, badge, badgeColor, placeholder, value, onChange, buttonLabel, buttonDark, onAction }) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 p-5">
      <div className="flex items-center justify-between mb-4">
        <p className="font-semibold text-slate-800">{title}</p>
        <span className={`text-xs font-bold px-2.5 py-0.5 rounded-full ${badgeColor}`}>{badge}</span>
      </div>
      <input
        type="text"
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-600 focus:outline-none focus:ring-2 focus:ring-primary/30 mb-4 font-mono"
      />
      <button
        onClick={onAction}
        className={`w-full text-sm font-bold rounded-lg py-2.5 transition-colors ${buttonDark ? 'bg-primary-dark text-white hover:bg-primary' : 'border border-slate-300 text-slate-700 hover:bg-slate-50'}`}
      >
        {buttonLabel}
      </button>
    </div>
  );
}

function MqttCard({ serverAddress, onServerChange, credentials, onCredentialsChange }) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 p-5">
      <div className="flex items-center justify-between mb-4">
        <p className="font-semibold text-slate-800">MQTT Broker</p>
        <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-blue-100 text-blue-700">REAL-TIME</span>
      </div>
      <input
        type="text"
        value={serverAddress}
        onChange={onServerChange}
        placeholder="Server Address"
        className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-600 focus:outline-none focus:ring-2 focus:ring-primary/30 mb-2"
      />
      <input
        type="password"
        value={credentials}
        onChange={onCredentialsChange}
        placeholder="Credentials"
        className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-600 focus:outline-none focus:ring-2 focus:ring-primary/30 mb-4"
      />
      <button className="w-full bg-primary-dark text-white text-sm font-bold rounded-lg py-2.5 hover:bg-primary transition-colors">
        TEST STREAM
      </button>
    </div>
  );
}

function ResilienceSection({ form, onChange, onMaintenanceToggle }) {
  return (
    <div>
      <p className="text-xs font-semibold text-slate-400 uppercase tracking-widest mb-4">Resilience &amp; Health</p>
      <div className="bg-white rounded-xl border border-slate-200 p-5 flex items-start justify-between mb-4">
        <div className="flex items-start gap-3">
          <div className="w-9 h-9 rounded-full bg-primary-light flex items-center justify-center shrink-0 mt-0.5">
            <Cloud className="w-5 h-5 text-primary" />
          </div>
          <div>
            <p className="font-semibold text-slate-800">Automatic Backups</p>
            <p className="text-sm text-slate-500 mt-0.5">System state and database snapshots are stored every 6 hours on a redundant encrypted volume.</p>
            <p className="text-sm font-semibold text-slate-700 mt-1">Last successful backup was 42 minutes ago.</p>
          </div>
        </div>
        <button className="shrink-0 border border-slate-300 text-slate-700 text-sm font-semibold px-4 py-2 rounded-lg hover:bg-slate-50 whitespace-nowrap ml-4">
          TRIGGER MANUAL BACKUP
        </button>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 px-5 py-4 flex items-center justify-between">
        <div className="flex items-start gap-3">
          <Settings className="w-4 h-4 text-slate-500 mt-0.5 shrink-0" />
          <div>
            <div className="flex items-center gap-2">
              <p className="text-sm font-semibold text-slate-800 uppercase tracking-wide">Maintenance Mode</p>
              <span className="text-xs font-bold bg-slate-100 text-slate-500 px-2 py-0.5 rounded">CONFIRMATION REQUIRED</span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">When enabled, only administrators can access the dashboard. All public-facing nodes will display a service interruption notice.</p>
          </div>
        </div>
        <button
          onClick={onMaintenanceToggle}
          className={`relative shrink-0 ml-6 w-11 h-6 rounded-full transition-colors ${form.maintenance_mode ? 'bg-primary' : 'bg-slate-200'}`}
        >
          <span className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-all ${form.maintenance_mode ? 'left-5' : 'left-0.5'}`} />
        </button>
      </div>
    </div>
  );
}

function MaintenanceConfirmDialog({ onConfirm, onCancel }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-sm mx-4">
        <h2 className="font-bold text-primary-dark mb-2">Enable Maintenance Mode?</h2>
        <p className="text-sm text-slate-600 mb-5">
          When enabled, only administrators can access the dashboard. All public-facing nodes will display a service interruption notice.
        </p>
        <div className="flex gap-3">
          <button onClick={onCancel} className="flex-1 border border-slate-200 text-slate-600 rounded-lg py-2 text-sm font-semibold hover:bg-slate-50">
            Cancel
          </button>
          <button onClick={onConfirm} className="flex-1 bg-red-600 text-white rounded-lg py-2 text-sm font-semibold hover:bg-red-700">
            Enable
          </button>
        </div>
      </div>
    </div>
  );
}

export default function AdminSettings() {
  const [activeSection, setActiveSection] = useState('system');
  const [form, setForm] = useState({});
  const [pendingMaintenance, setPendingMaintenance] = useState(false);
  const [saved, setSaved] = useState(false);
  const queryClient = useQueryClient();

  const { data: settingsData } = useQuery({
    queryKey: ['admin', 'settings'],
    queryFn: async () => (await getSettings()).data,
  });

  useEffect(() => {
    if (settingsData) setForm(settingsData);
  }, [settingsData]);

  const saveMutation = useMutation({
    mutationFn: () => updateSettings(form),
    onSuccess: () => {
      queryClient.invalidateQueries(['admin', 'settings']);
      toast.success('Settings saved successfully');
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    },
    onError: () => toast.error('Failed to save settings'),
  });

  const handleChange = (key, value) => setForm((f) => ({ ...f, [key]: value }));

  const handleMaintenanceToggle = () => {
    if (!form.maintenance_mode) {
      setPendingMaintenance(true);
    } else {
      handleChange('maintenance_mode', false);
    }
  };

  const confirmMaintenance = () => {
    handleChange('maintenance_mode', true);
    setPendingMaintenance(false);
  };

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-primary-dark">Settings</h1>
        <p className="text-sm text-slate-500 mt-0.5">Orchestrate your knowledge sanctuary's core infrastructure.</p>
      </div>

      <div className="flex gap-8">
        <SettingsSidebar active={activeSection} onSelect={setActiveSection} />

        <div className="flex-1 space-y-8">
          {activeSection === 'system' && (
            <>
              <SystemCoreSection form={form} onChange={handleChange} />

              <div>
                <p className="text-xs font-semibold text-slate-400 uppercase tracking-widest mb-4">Integrations Pipeline</p>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <IntegrationCard
                    title="Google Vision"
                    badge="CONNECTED"
                    badgeColor="bg-green-100 text-green-700"
                    placeholder="••••••••••••1234"
                    value={form.google_vision_key ?? ''}
                    onChange={(e) => handleChange('google_vision_key', e.target.value)}
                    buttonLabel="TEST CONNECTION"
                    buttonDark
                    onAction={() => toast.success('Connection tested')}
                  />
                  <IntegrationCard
                    title="Gemini AI"
                    badge="INACTIVE"
                    badgeColor="bg-slate-100 text-slate-500"
                    placeholder="Enter API key"
                    value={form.gemini_key ?? ''}
                    onChange={(e) => handleChange('gemini_key', e.target.value)}
                    buttonLabel="ACTIVATE"
                    buttonDark={false}
                    onAction={() => toast.success('Gemini AI activation requested')}
                  />
                  <MqttCard
                    serverAddress={form.mqtt_server ?? ''}
                    onServerChange={(e) => handleChange('mqtt_server', e.target.value)}
                    credentials={form.mqtt_credentials ?? ''}
                    onCredentialsChange={(e) => handleChange('mqtt_credentials', e.target.value)}
                  />
                </div>
              </div>

              <ResilienceSection
                form={form}
                onChange={handleChange}
                onMaintenanceToggle={handleMaintenanceToggle}
              />

              <div className="flex justify-end pb-4">
                <button
                  onClick={() => saveMutation.mutate()}
                  disabled={saveMutation.isPending}
                  className="flex items-center gap-2 bg-primary-dark text-white text-sm font-semibold px-6 py-2.5 rounded-lg hover:bg-primary transition-colors disabled:opacity-50"
                >
                  {saveMutation.isPending ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : saved ? (
                    <Check className="w-4 h-4" />
                  ) : null}
                  {saved ? 'Saved' : 'Save Settings'}
                </button>
              </div>
            </>
          )}

          {activeSection !== 'system' && (
            <div className="flex flex-col items-center justify-center py-20 text-slate-400">
              <Settings className="w-10 h-10 mb-3 opacity-30" />
              <p className="text-sm font-medium">This section is coming soon</p>
            </div>
          )}
        </div>
      </div>

      {pendingMaintenance && (
        <MaintenanceConfirmDialog
          onConfirm={confirmMaintenance}
          onCancel={() => setPendingMaintenance(false)}
        />
      )}
    </div>
  );
}
