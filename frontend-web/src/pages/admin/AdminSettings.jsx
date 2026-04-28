import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  User, ShieldCheck, Bell, Settings, Palette, Link2, HardDrive, Info,
  Database, Cloud, RefreshCw, Loader2, Check, Copy, Eye, EyeOff,
  Lock, Zap, AlertTriangle, Monitor,
} from 'lucide-react';
import toast from 'react-hot-toast';
import useAuth from '../../hooks/useAuth';
import { getSettings, updateSettings, reindexStore, getVectorStats, testIntegrationConnection, triggerManualBackup } from '../../services/adminService';
import { applyTheme, applyDensity } from '../../lib/theme';

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

const OCR_OPTIONS = ['Tesseract 5.0 Optimized', 'Google Vision', 'PaddleOCR'];

const DEFAULT_NOTIFICATION_PREFS = {
  login_alert: true, user_created: true, audit_alert: true,
  iot_alert: true, backup_done: false, integrity_fail: true,
  email_digest: false, push_all: true,
};

const DEFAULT_APPEARANCE_PREFS = {
  lang: 'en',
  tz: 'Asia/Kathmandu',
  density: 'comfortable',
  theme: 'system',
};

function SettingsSidebar({ active, onSelect }) {
  return (
    <aside className="w-52 shrink-0">
      <nav className="space-y-0.5">
        {SIDEBAR_ITEMS.map((item) => (
          <button
            key={item.id}
            onClick={() => onSelect(item.id)}
            className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm transition-colors ${
              active === item.id
                ? 'bg-primary-light text-primary-dark font-semibold border-l-2 border-primary'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <item.icon className="w-4 h-4 shrink-0" />
            {item.label}
          </button>
        ))}
      </nav>
    </aside>
  );
}

function SectionLabel({ children }) {
  return <p className="text-xs font-semibold text-slate-400 uppercase tracking-widest mb-4">{children}</p>;
}

function FieldRow({ label, children }) {
  return (
    <div>
      <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-1.5">{label}</label>
      {children}
    </div>
  );
}

function ToggleRow({ label, description, checked, onChange }) {
  return (
    <div className="flex items-center justify-between py-3 border-b border-slate-100 last:border-0">
      <div>
        <p className="text-sm font-semibold text-slate-700">{label}</p>
        {description && <p className="text-xs text-slate-400 mt-0.5">{description}</p>}
      </div>
      <button
        onClick={() => onChange(!checked)}
        className={`relative w-10 h-5 rounded-full transition-colors shrink-0 ml-6 ${checked ? 'bg-primary' : 'bg-slate-200'}`}
      >
        <span className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-all ${checked ? 'left-5' : 'left-0.5'}`} />
      </button>
    </div>
  );
}

function SaveBar({ onSave, saving, saved }) {
  return (
    <div className="flex justify-end pt-2 pb-4">
      <button
        onClick={onSave}
        disabled={saving}
        className="flex items-center gap-2 bg-primary-dark text-white text-sm font-semibold px-6 py-2.5 rounded-lg hover:bg-primary transition-colors disabled:opacity-50"
      >
        {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : saved ? <Check className="w-4 h-4" /> : null}
        {saved ? 'Saved' : 'Save Changes'}
      </button>
    </div>
  );
}

function ProfileSection({ user }) {
  const [name, setName] = useState(user?.full_name ?? '');
  const email = user?.email ?? '—';
  const role = user?.role ?? 'admin';

  return (
    <div className="space-y-6">
      <SectionLabel>Profile Information</SectionLabel>
      <div className="flex items-center gap-5 p-5 bg-white rounded-xl border border-slate-200">
        <div className="w-16 h-16 rounded-full bg-primary-dark flex items-center justify-center text-white text-2xl font-bold shrink-0">
          {(user?.full_name ?? 'A').charAt(0).toUpperCase()}
        </div>
        <div>
          <p className="font-bold text-primary-dark text-lg">{user?.full_name ?? '—'}</p>
          <p className="text-sm text-slate-500">{email}</p>
          <span className="mt-1 inline-block text-xs font-bold bg-primary-dark text-white px-2.5 py-0.5 rounded-full uppercase tracking-wider">
            {role}
          </span>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 p-5 space-y-4">
        <FieldRow label="Full Name">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
          />
        </FieldRow>
        <FieldRow label="Email Address">
          <input
            value={email}
            disabled
            className="w-full border border-slate-100 bg-slate-50 rounded-lg px-3 py-2 text-sm text-slate-400 cursor-not-allowed"
          />
        </FieldRow>
        <FieldRow label="Role">
          <input
            value={role.charAt(0).toUpperCase() + role.slice(1)}
            disabled
            className="w-full border border-slate-100 bg-slate-50 rounded-lg px-3 py-2 text-sm text-slate-400 cursor-not-allowed"
          />
        </FieldRow>
      </div>

      <div className="bg-primary-light/40 rounded-xl border border-primary-light p-4 flex items-start gap-3">
        <AlertTriangle className="w-4 h-4 text-primary mt-0.5 shrink-0" />
        <p className="text-xs text-primary-dark">Profile name changes take effect on next login. Contact your system owner to change your email address.</p>
      </div>
    </div>
  );
}

function SecuritySection({ user }) {
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [twoFa, setTwoFa] = useState(user?.is_2fa_enabled ?? false);
  const [form, setForm] = useState({ current: '', newPass: '', confirm: '' });
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const handleChangePassword = () => {
    if (!form.current || !form.newPass) { toast.error('Fill in all password fields'); return; }
    if (form.newPass !== form.confirm) { toast.error('New passwords do not match'); return; }
    toast.success('Password updated successfully');
    setForm({ current: '', newPass: '', confirm: '' });
  };

  return (
    <div className="space-y-6">
      <SectionLabel>Change Password</SectionLabel>
      <div className="bg-white rounded-xl border border-slate-200 p-5 space-y-4">
        <FieldRow label="Current Password">
          <div className="relative">
            <input
              type={showCurrent ? 'text' : 'password'}
              value={form.current}
              onChange={(e) => set('current', e.target.value)}
              className="w-full border border-slate-200 rounded-lg px-3 py-2 pr-10 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
            />
            <button onClick={() => setShowCurrent(!showCurrent)} className="absolute right-3 top-2.5 text-slate-400">
              {showCurrent ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
        </FieldRow>
        <FieldRow label="New Password">
          <div className="relative">
            <input
              type={showNew ? 'text' : 'password'}
              value={form.newPass}
              onChange={(e) => set('newPass', e.target.value)}
              className="w-full border border-slate-200 rounded-lg px-3 py-2 pr-10 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
            />
            <button onClick={() => setShowNew(!showNew)} className="absolute right-3 top-2.5 text-slate-400">
              {showNew ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
        </FieldRow>
        <FieldRow label="Confirm New Password">
          <input
            type="password"
            value={form.confirm}
            onChange={(e) => set('confirm', e.target.value)}
            className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
          />
        </FieldRow>
        <button
          onClick={handleChangePassword}
          className="flex items-center gap-2 bg-primary-dark text-white text-sm font-semibold px-5 py-2 rounded-lg hover:bg-primary transition-colors"
        >
          <Lock className="w-4 h-4" /> Update Password
        </button>
      </div>

      <SectionLabel>Two-Factor Authentication</SectionLabel>
      <div className="bg-white rounded-xl border border-slate-200 p-5">
        <ToggleRow
          label="Enable 2FA"
          description="Require a TOTP code on every admin login for enhanced security."
          checked={twoFa}
          onChange={setTwoFa}
        />
        {twoFa && (
          <div className="mt-4 p-3 bg-green-50 border border-green-200 rounded-lg text-sm text-green-700 flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 shrink-0" />
            2FA is enabled. Scan the QR code in your authenticator app on next login.
          </div>
        )}
      </div>

      <SectionLabel>Current Session</SectionLabel>
      <div className="bg-white rounded-xl border border-slate-200 px-5 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Monitor className="w-4 h-4 text-slate-400 shrink-0" />
          <div>
            <p className="text-sm font-medium text-slate-700">{user?.email ?? '—'}</p>
            <p className="text-xs text-slate-400">Logged in as {user?.role ?? 'admin'} · Active now</p>
          </div>
        </div>
        <span className="text-xs bg-green-100 text-green-700 font-semibold px-2 py-0.5 rounded-full">Current</span>
      </div>
    </div>
  );
}

function NotificationsSection({ prefs, onSave, saving, saved }) {
  const [local, setLocal] = useState({ ...DEFAULT_NOTIFICATION_PREFS, ...prefs });
  const toggle = (k) => setLocal((p) => ({ ...p, [k]: !p[k] }));

  useEffect(() => {
    setLocal({ ...DEFAULT_NOTIFICATION_PREFS, ...prefs });
  }, [prefs]);

  const groups = [
    {
      label: 'Security Alerts',
      items: [
        { key: 'login_alert', label: 'Failed login attempts', description: 'Alert when 5+ consecutive failures occur' },
        { key: 'audit_alert', label: 'Admin audit events', description: 'Notify on sensitive admin operations' },
        { key: 'integrity_fail', label: 'Integrity audit failures', description: 'Alert when hash check fails' },
      ],
    },
    {
      label: 'System Events',
      items: [
        { key: 'user_created', label: 'New user registrations', description: 'When a new account is created' },
        { key: 'iot_alert', label: 'IoT device alerts', description: 'Unusual traffic or device offline events' },
        { key: 'backup_done', label: 'Backup completed', description: 'Confirmation after each scheduled backup' },
      ],
    },
    {
      label: 'Delivery Preferences',
      items: [
        { key: 'email_digest', label: 'Daily email digest', description: 'Receive a summary email every morning' },
        { key: 'push_all', label: 'In-app notifications', description: 'Show bell icon alerts in the dashboard' },
      ],
    },
  ];

  return (
    <div className="space-y-6">
      {groups.map((g) => (
        <div key={g.label}>
          <SectionLabel>{g.label}</SectionLabel>
          <div className="bg-white rounded-xl border border-slate-200 px-5">
            {g.items.map((item) => (
              <ToggleRow
                key={item.key}
                label={item.label}
                description={item.description}
                checked={local[item.key] ?? false}
                onChange={() => toggle(item.key)}
              />
            ))}
          </div>
        </div>
      ))}
      <SaveBar onSave={() => onSave({ notification_prefs: local })} saving={saving} saved={saved} />
    </div>
  );
}

function AppearanceSection({ prefs, onSave, saving, saved }) {
  const [local, setLocal] = useState({ ...DEFAULT_APPEARANCE_PREFS, ...prefs });
  const set = (k, v) => setLocal((p) => ({ ...p, [k]: v }));

  useEffect(() => {
    setLocal({ ...DEFAULT_APPEARANCE_PREFS, ...prefs });
  }, [prefs]);

  useEffect(() => {
    applyTheme(local.theme || 'system');
  }, [local.theme]);

  useEffect(() => {
    applyDensity(local.density || 'comfortable');
  }, [local.density]);

  return (
    <div className="space-y-6">
      <SectionLabel>Display Preferences</SectionLabel>
      <div className="bg-white rounded-xl border border-slate-200 p-5 space-y-5">
        <FieldRow label="Language">
          <select
            value={local.lang}
            onChange={(e) => set('lang', e.target.value)}
            className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
          >
            <option value="en">English</option>
            <option value="ne">Nepali</option>
          </select>
        </FieldRow>
        <FieldRow label="Timezone">
          <select
            value={local.tz}
            onChange={(e) => set('tz', e.target.value)}
            className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
          >
            <option value="Asia/Kathmandu">Asia/Kathmandu (UTC+5:45)</option>
            <option value="UTC">UTC</option>
            <option value="Asia/Kolkata">Asia/Kolkata (UTC+5:30)</option>
          </select>
        </FieldRow>
        <FieldRow label="Table Density">
          <div className="flex gap-3">
            {['compact', 'comfortable', 'spacious'].map((d) => (
              <button
                key={d}
                onClick={() => set('density', d)}
                className={`flex-1 py-2 rounded-lg text-sm font-semibold border transition-colors capitalize ${local.density === d ? 'bg-primary-dark text-white border-primary-dark' : 'border-slate-200 text-slate-600 hover:bg-slate-50'}`}
              >
                {d}
              </button>
            ))}
          </div>
        </FieldRow>
      </div>

      <SectionLabel>Theme</SectionLabel>
      <div className="bg-white rounded-xl border border-slate-200 p-5">
        <div className="grid grid-cols-3 gap-3">
          {[
            { id: 'light', label: 'Light', bg: 'bg-white border-2 border-slate-300', dot: 'bg-primary-dark' },
            { id: 'dark', label: 'Dark', bg: 'bg-slate-800', dot: 'bg-primary-light' },
            { id: 'system', label: 'System', bg: 'bg-gradient-to-r from-white to-slate-800', dot: 'bg-primary' },
          ].map((t) => (
            <button
              key={t.id}
              onClick={() => set('theme', t.id)}
              className={`rounded-xl h-16 flex flex-col items-center justify-center gap-1 border-2 transition ${t.bg} ${
                local.theme === t.id ? 'ring-2 ring-primary ring-offset-2' : 'border-transparent'
              }`}
            >
              <div className={`w-3 h-3 rounded-full ${t.dot}`} />
              <span className={`text-xs font-semibold ${t.id === 'dark' ? 'text-white' : 'text-slate-700'}`}>{t.label}</span>
            </button>
          ))}
        </div>
      </div>

      <SaveBar onSave={() => onSave({ appearance_prefs: local })} saving={saving} saved={saved} />
    </div>
  );
}

function ApiSection({ form, onChange, onSave, saving, saved }) {
  const [showKey, setShowKey] = useState(false);
  const webhookUrl = form.webhook_url ?? '';
  const googleHint = form._google_hint ?? '';
  const geminiHint = form._gemini_hint ?? '';

  const copyWebhook = () => {
    if (!webhookUrl) { toast.error('No webhook URL configured'); return; }
    navigator.clipboard.writeText(webhookUrl);
    toast.success('Webhook URL copied');
  };

  const testMutation = useMutation({
    mutationFn: (payload) => testIntegrationConnection(payload),
    onSuccess: (res) => {
      const data = res.data;
      if (data.ok) toast.success(data.message || 'Connection successful');
      else toast.error(data.message || 'Connection failed');
    },
    onError: (err) => {
      toast.error(err?.response?.data?.detail ?? 'Connection test failed');
    },
  });

  return (
    <div className="space-y-6">
      <SectionLabel>Integration API Keys</SectionLabel>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-white rounded-xl border border-slate-200 p-5 space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold text-slate-700">Google Vision API Key</p>
            <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${googleHint ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-500'}`}>
              {googleHint ? 'CONNECTED' : 'NOT SET'}
            </span>
          </div>
          {googleHint && (
            <p className="text-xs font-mono text-slate-500 bg-slate-50 border border-slate-200 rounded px-3 py-2">
              Current key: {googleHint}
            </p>
          )}
          <input
            type={showKey ? 'text' : 'password'}
            value={form.google_vision_api_key ?? ''}
            onChange={(e) => onChange('google_vision_api_key', e.target.value)}
            placeholder={googleHint ? 'Enter new key to replace' : 'Enter API key'}
            className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 font-mono"
          />
          <button
            onClick={() => setShowKey(!showKey)}
            className="text-xs text-slate-400 hover:text-primary flex items-center gap-1"
          >
            {showKey ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
            {showKey ? 'Hide' : 'Show'} input
          </button>
          <button
            onClick={() => testMutation.mutate({ target: 'google_vision', google_vision_api_key: form.google_vision_api_key || undefined })}
            disabled={testMutation.isPending}
            className="text-xs font-semibold text-primary hover:underline"
          >
            Test Connection
          </button>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-5 space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold text-slate-700">Gemini AI API Key</p>
            <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${geminiHint ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-500'}`}>
              {geminiHint ? 'CONNECTED' : 'NOT SET'}
            </span>
          </div>
          {geminiHint && (
            <p className="text-xs font-mono text-slate-500 bg-slate-50 border border-slate-200 rounded px-3 py-2">
              Current key: {geminiHint}
            </p>
          )}
          <input
            type="password"
            value={form.gemini_api_key ?? ''}
            onChange={(e) => onChange('gemini_api_key', e.target.value)}
            placeholder={geminiHint ? 'Enter new key to replace' : 'Enter API key'}
            className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 font-mono"
          />
          <button
            onClick={() => testMutation.mutate({ target: 'gemini', gemini_api_key: form.gemini_api_key || undefined })}
            disabled={testMutation.isPending}
            className="text-xs font-semibold text-primary hover:underline"
          >
            Test Connection
          </button>
        </div>
      </div>

      <SectionLabel>MQTT Broker</SectionLabel>
      <div className="bg-white rounded-xl border border-slate-200 p-5 space-y-3">
        <FieldRow label="Broker Host">
          <input
            type="text"
            value={form.mqtt_broker_host ?? ''}
            onChange={(e) => onChange('mqtt_broker_host', e.target.value)}
            placeholder="e.g. mqtt://broker.gyanavriksha.edu.np:1883"
            className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
          />
        </FieldRow>
        <FieldRow label="Broker Credentials">
          <input
            type="password"
            value={form.mqtt_broker_credentials ?? ''}
            onChange={(e) => onChange('mqtt_broker_credentials', e.target.value)}
            placeholder="username:password"
            className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
          />
        </FieldRow>
        <button
          onClick={() => testMutation.mutate({ target: 'mqtt', mqtt_broker_host: form.mqtt_broker_host || undefined })}
          disabled={testMutation.isPending}
          className="text-xs font-semibold text-primary hover:underline"
        >
          Test MQTT Connection
        </button>
      </div>

      <SectionLabel>Webhook Endpoint</SectionLabel>
      <div className="bg-white rounded-xl border border-slate-200 p-5 space-y-3">
        <FieldRow label="Webhook URL">
          <div className="flex gap-2">
            <input
              type="text"
              value={webhookUrl}
              onChange={(e) => onChange('webhook_url', e.target.value)}
              placeholder="https://your-endpoint.com/webhooks/admin"
              className="flex-1 border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
            />
            <button onClick={copyWebhook} className="px-3 border border-slate-200 rounded-lg text-slate-500 hover:bg-slate-50">
              <Copy className="w-4 h-4" />
            </button>
          </div>
        </FieldRow>
        <p className="text-xs text-slate-400">Events forwarded: user.created · audit.flagged · iot.alert · integrity.fail</p>
        <button
          onClick={() => testMutation.mutate({ target: 'webhook', webhook_url: form.webhook_url || undefined })}
          disabled={testMutation.isPending}
          className="text-xs font-semibold text-primary hover:underline"
        >
          Test Webhook
        </button>
      </div>

      <SaveBar onSave={onSave} saving={saving} saved={saved} />
    </div>
  );
}

function BackupSection({ form, onChange, onMaintenanceToggle, onSave, onTriggerBackup, saving, saved }) {
  const [triggering, setTriggering] = useState(false);

  const backupLastSuccess = form.backup_last_success
    ? new Date(form.backup_last_success).toLocaleString()
    : null;

  const handleTriggerBackup = async () => {
    setTriggering(true);
    try {
      const res = await onTriggerBackup();
      const now = new Date().toISOString();
      onChange('backup_last_success', now);
      toast.success(res?.data?.message ?? 'Manual backup triggered successfully');
    } catch (err) {
      toast.error(err?.response?.data?.detail ?? 'Failed to trigger manual backup');
    }
    setTriggering(false);
  };

  return (
    <div className="space-y-6">
      <SectionLabel>Backup Configuration</SectionLabel>
      <div className="bg-white rounded-xl border border-slate-200 p-5 flex items-start justify-between">
        <div className="flex items-start gap-3">
          <div className="w-9 h-9 rounded-full bg-primary-light flex items-center justify-center shrink-0">
            <Cloud className="w-5 h-5 text-primary" />
          </div>
          <div>
            <p className="font-semibold text-slate-800">Automatic Backups</p>
            <p className="text-sm text-slate-500 mt-0.5">System state and database snapshots stored every 6 hours on a redundant encrypted volume.</p>
            <p className="text-sm font-semibold text-slate-700 mt-1">
              {backupLastSuccess
                ? `Last backup: ${backupLastSuccess}`
                : 'No backup on record yet.'}
            </p>
          </div>
        </div>
        <button
          onClick={handleTriggerBackup}
          disabled={triggering}
          className="shrink-0 bg-primary text-white text-sm font-semibold px-4 py-2 rounded-lg hover:bg-primary-dark transition-colors whitespace-nowrap ml-4 flex items-center gap-2 disabled:opacity-70"
        >
          {triggering ? <Loader2 className="w-4 h-4 animate-spin" /> : <Cloud className="w-4 h-4" />}
          {triggering ? 'Triggering…' : 'TRIGGER MANUAL BACKUP'}
        </button>
      </div>

      <SectionLabel>Maintenance Mode</SectionLabel>
      <div className="bg-white rounded-xl border border-slate-200 px-5 py-4 flex items-center justify-between">
        <div className="flex items-start gap-3">
          <Settings className="w-4 h-4 text-slate-500 mt-0.5 shrink-0" />
          <div>
            <div className="flex items-center gap-2">
              <p className="text-sm font-semibold text-slate-800 uppercase tracking-wide">Maintenance Mode</p>
              <span className="text-xs font-bold bg-slate-100 text-slate-500 px-2 py-0.5 rounded">CONFIRMATION REQUIRED</span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              When enabled, only administrators can access the dashboard. All public-facing nodes will display a service interruption notice.
            </p>
            <p className="text-xs mt-1 font-semibold">
              Status:{' '}
              <span className={form.maintenance_mode ? 'text-red-600' : 'text-green-600'}>
                {form.maintenance_mode ? 'MAINTENANCE ACTIVE' : 'Normal operation'}
              </span>
            </p>
          </div>
        </div>
        <button
          onClick={onMaintenanceToggle}
          className={`relative shrink-0 ml-6 w-11 h-6 rounded-full transition-colors ${form.maintenance_mode ? 'bg-primary' : 'bg-slate-200'}`}
        >
          <span className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-all ${form.maintenance_mode ? 'left-5' : 'left-0.5'}`} />
        </button>
      </div>

      <SaveBar onSave={() => onSave({ maintenance_mode: form.maintenance_mode })} saving={saving} saved={saved} />
    </div>
  );
}

function AboutSection() {
  const { data: settingsData } = useQuery({
    queryKey: ['admin', 'settings'],
    queryFn: async () => (await getSettings()).data,
    staleTime: 60000,
  });

  const { data: vectorStats } = useQuery({
    queryKey: ['admin', 'vector-stats'],
    queryFn: async () => (await getVectorStats()).data,
    staleTime: 60000,
  });

  const ocrEngine = settingsData?.ocr_engine ?? '—';
  const chunkSize = settingsData?.rag_chunk_size ?? '—';
  const maintenanceMode = settingsData?.maintenance_mode ? 'ACTIVE' : 'Off';
  const totalChunks = vectorStats?.total_chunks?.toLocaleString() ?? '—';
  const namespaces = vectorStats?.total_namespaces ?? '—';

  const staticInfo = [
    { label: 'Application', value: 'Gyanavriksha Admin Portal' },
    { label: 'Version', value: 'v1.5.0 (Sprint 5)' },
    { label: 'Backend', value: 'FastAPI 0.115 · Python 3.12' },
    { label: 'Database', value: 'PostgreSQL 16' },
    { label: 'Frontend', value: 'React 19 · Vite 7 · TailwindCSS 3' },
    { label: 'License', value: 'Academic Use — Group 4, Batch 2025' },
  ];

  const dynamicInfo = [
    { label: 'OCR Engine', value: ocrEngine },
    { label: 'RAG Chunk Size', value: `${chunkSize} tokens` },
    { label: 'Vector Store', value: `ChromaDB · ${totalChunks} chunks · ${namespaces} namespaces` },
    { label: 'Maintenance Mode', value: maintenanceMode },
  ];

  return (
    <div className="space-y-6">
      <SectionLabel>System Information</SectionLabel>
      <div className="bg-white rounded-xl border border-slate-200 divide-y divide-slate-100">
        {staticInfo.map((row) => (
          <div key={row.label} className="flex items-center justify-between px-5 py-3">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">{row.label}</span>
            <span className="text-sm font-medium text-slate-700">{row.value}</span>
          </div>
        ))}
      </div>

      <SectionLabel>Live Configuration</SectionLabel>
      <div className="bg-white rounded-xl border border-slate-200 divide-y divide-slate-100">
        {dynamicInfo.map((row) => (
          <div key={row.label} className="flex items-center justify-between px-5 py-3">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">{row.label}</span>
            <span className="text-sm font-medium text-slate-700">{row.value}</span>
          </div>
        ))}
      </div>

      <div className="bg-primary-dark rounded-xl p-5 text-white flex items-center gap-4">
        <Zap className="w-8 h-8 text-primary-light shrink-0" />
        <div>
          <p className="font-bold">Gyanavriksha Knowledge Sanctuary</p>
          <p className="text-sm text-primary-light mt-0.5">AI-powered adaptive learning platform with IoT integration and vector-based curriculum delivery.</p>
          <p className="text-xs text-primary-light/60 mt-2">© 2025 Group 4 — System Development Project, Level 5 Sem 2</p>
        </div>
      </div>
    </div>
  );
}

function SystemCoreSection({ form, onChange }) {
  const reindexMutation = useMutation({
    mutationFn: () => reindexStore(),
    onSuccess: () => toast.success('Re-index triggered'),
    onError: () => toast.error('Re-index failed'),
  });

  const { data: vectorStats } = useQuery({
    queryKey: ['admin', 'vector-stats'],
    queryFn: async () => (await getVectorStats()).data,
    staleTime: 30000,
  });

  const totalChunks = vectorStats?.total_chunks?.toLocaleString() ?? '—';
  const successRate = vectorStats?.embedding_success_rate != null
    ? `${Math.round(vectorStats.embedding_success_rate * 100)}% accuracy`
    : 'Operational';

  return (
    <div>
      <SectionLabel>System Core</SectionLabel>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-4">
        <FieldRow label="OCR Engine Selector">
          <select
            value={form.ocr_engine ?? OCR_OPTIONS[0]}
            onChange={(e) => onChange('ocr_engine', e.target.value)}
            className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-primary/30"
          >
            {OCR_OPTIONS.map((o) => <option key={o}>{o}</option>)}
          </select>
        </FieldRow>
        <div>
          <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-2">RAG Chunk Settings</label>
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-400">64</span>
            <input
              type="range" min={64} max={2048} step={1}
              value={parseInt(form.rag_chunk_size ?? 512)}
              onChange={(e) => onChange('rag_chunk_size', parseInt(e.target.value))}
              className="flex-1 accent-primary"
            />
            <span className="text-xs text-slate-400">2048</span>
          </div>
          <p className="text-center text-xs font-semibold text-primary-dark mt-1">{parseInt(form.rag_chunk_size ?? 512)} tokens</p>
        </div>
      </div>
      <div className="bg-primary-dark text-white rounded-xl px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-primary-light/20 flex items-center justify-center">
            <Database className="w-4 h-4 text-primary-light" />
          </div>
          <div>
            <p className="font-bold text-white">ChromaDB Vector Store</p>
            <p className="text-xs text-primary-light">{successRate} · {totalChunks} embeddings stored</p>
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

function MaintenanceConfirmDialog({ onConfirm, onCancel }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-sm mx-4">
        <h2 className="font-bold text-primary-dark mb-2">Enable Maintenance Mode?</h2>
        <p className="text-sm text-slate-600 mb-5">
          When enabled, only administrators can access the dashboard. All public-facing nodes will display a service interruption notice.
        </p>
        <div className="flex gap-3">
          <button onClick={onCancel} className="flex-1 border border-slate-200 text-slate-600 rounded-lg py-2 text-sm font-semibold hover:bg-slate-50">Cancel</button>
          <button onClick={onConfirm} className="flex-1 bg-red-600 text-white rounded-lg py-2 text-sm font-semibold hover:bg-red-700">Enable</button>
        </div>
      </div>
    </div>
  );
}

export default function AdminSettings() {
  const [activeSection, setActiveSection] = useState('profile');
  const [form, setForm] = useState({});
  const [pendingMaintenance, setPendingMaintenance] = useState(false);
  const [saved, setSaved] = useState(false);
  const queryClient = useQueryClient();
  const { user } = useAuth();

  const { data: settingsData } = useQuery({
    queryKey: ['admin', 'settings'],
    queryFn: async () => (await getSettings()).data,
  });

  useEffect(() => {
    if (!settingsData) return;
    setForm({
      ocr_engine: settingsData.ocr_engine ?? 'Tesseract 5.0 Optimized',
      rag_chunk_size: settingsData.rag_chunk_size ?? 512,
      mqtt_broker_host: settingsData.mqtt_broker_host ?? '',
      maintenance_mode: settingsData.maintenance_mode ?? false,
      backup_last_success: settingsData.backup_last_success ?? null,
      google_vision_api_key: '',
      gemini_api_key: '',
      mqtt_broker_credentials: '',
      webhook_url: settingsData.webhook_url ?? '',
      _google_hint: settingsData.google_vision_key_hint ?? '',
      _gemini_hint: settingsData.gemini_key_hint ?? '',
    });
  }, [settingsData]);

  const saveMutation = useMutation({
    mutationFn: (payload) => updateSettings(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'settings'] });
      toast.success('Settings saved successfully');
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    },
    onError: () => toast.error('Failed to save settings'),
  });

  const backupMutation = useMutation({
    mutationFn: () => triggerManualBackup(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'settings'] });
    },
  });

  const buildSystemPayload = () => {
    const p = {
      ocr_engine: form.ocr_engine,
      rag_chunk_size: parseInt(form.rag_chunk_size),
      mqtt_broker_host: form.mqtt_broker_host || undefined,
      maintenance_mode: form.maintenance_mode,
    };
    if (form.google_vision_api_key) p.google_vision_api_key = form.google_vision_api_key;
    if (form.gemini_api_key) p.gemini_api_key = form.gemini_api_key;
    if (form.mqtt_broker_credentials) p.mqtt_broker_credentials = form.mqtt_broker_credentials;
    return p;
  };

  const buildApiPayload = () => {
    const p = { webhook_url: form.webhook_url || undefined };
    if (form.google_vision_api_key) p.google_vision_api_key = form.google_vision_api_key;
    if (form.gemini_api_key) p.gemini_api_key = form.gemini_api_key;
    if (form.mqtt_broker_host) p.mqtt_broker_host = form.mqtt_broker_host;
    if (form.mqtt_broker_credentials) p.mqtt_broker_credentials = form.mqtt_broker_credentials;
    return p;
  };

  const handleChange = (key, value) => setForm((f) => ({ ...f, [key]: value }));

  const handleSave = (payload) => saveMutation.mutate(payload ?? buildSystemPayload());

  const handleMaintenanceToggle = () => {
    if (!form.maintenance_mode) { setPendingMaintenance(true); }
    else { handleChange('maintenance_mode', false); }
  };

  const confirmMaintenance = () => {
    handleChange('maintenance_mode', true);
    setPendingMaintenance(false);
  };

  const notifPrefs = settingsData?.notification_prefs ?? {};
  const appearancePrefs = settingsData?.appearance_prefs ?? {};

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-primary-dark">Settings</h1>
        <p className="text-sm text-slate-500 mt-0.5">Orchestrate your knowledge sanctuary's core infrastructure.</p>
      </div>

      <div className="flex gap-8">
        <SettingsSidebar active={activeSection} onSelect={setActiveSection} />

        <div className="flex-1 space-y-8">
          {activeSection === 'profile' && <ProfileSection user={user} />}

          {activeSection === 'security' && <SecuritySection user={user} />}

          {activeSection === 'notifications' && (
            <NotificationsSection
              prefs={notifPrefs}
              onSave={handleSave}
              saving={saveMutation.isPending}
              saved={saved}
            />
          )}

          {activeSection === 'system' && (
            <>
              <SystemCoreSection form={form} onChange={handleChange} />
              <SaveBar onSave={() => handleSave(buildSystemPayload())} saving={saveMutation.isPending} saved={saved} />
            </>
          )}

          {activeSection === 'appearance' && (
            <AppearanceSection
              prefs={appearancePrefs}
              onSave={handleSave}
              saving={saveMutation.isPending}
              saved={saved}
            />
          )}

          {activeSection === 'api' && (
            <ApiSection
              form={form}
              onChange={handleChange}
              onSave={() => handleSave(buildApiPayload())}
              saving={saveMutation.isPending}
              saved={saved}
            />
          )}

          {activeSection === 'backup' && (
            <BackupSection
              form={form}
              onChange={handleChange}
              onMaintenanceToggle={handleMaintenanceToggle}
              onSave={handleSave}
              onTriggerBackup={() => backupMutation.mutateAsync()}
              saving={saveMutation.isPending}
              saved={saved}
            />
          )}

          {activeSection === 'about' && <AboutSection />}
        </div>
      </div>

      {pendingMaintenance && (
        <MaintenanceConfirmDialog onConfirm={confirmMaintenance} onCancel={() => setPendingMaintenance(false)} />
      )}
    </div>
  );
}
