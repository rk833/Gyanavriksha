import { useEffect, useState } from 'react';
import { Bell, CheckCircle2, AlertTriangle, ShieldCheck, Cpu, UserCog, TicketCheck } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import {
  getAdminNotifications,
  markAdminNotificationRead,
  markAllAdminNotificationsRead,
} from '../../services/adminService';

const TYPE_ICONS = {
  iot_integrity_violation: AlertTriangle,
  iot_device_registered: Cpu,
  iot_key_regenerated: ShieldCheck,
  user_created: UserCog,
  role_change: UserCog,
  support_ticket: TicketCheck,
};

const TYPE_COLORS = {
  iot_integrity_violation: 'bg-red-100 text-red-600',
  iot_device_registered: 'bg-blue-100 text-blue-600',
  iot_key_regenerated: 'bg-amber-100 text-amber-600',
  user_created: 'bg-green-100 text-green-600',
  role_change: 'bg-purple-100 text-purple-600',
  support_ticket: 'bg-violet-100 text-violet-600',
};

const TABS = [
  { key: '', label: 'All' },
  { key: 'unread', label: 'Unread' },
  { key: 'support', label: 'Support Tickets' },
  { key: 'iot', label: 'IoT Alerts' },
  { key: 'security', label: 'Security/System' },
];

export default function AdminNotifications() {
  const navigate = useNavigate();
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);

  const fetchNotifications = () => {
    setLoading(true);
    const params = { page, per_page: 20 };
    if (tab === 'unread') params.read = false;

    getAdminNotifications(params)
      .then((r) => {
        setNotifications(r.data.items || []);
        setTotalPages(r.data.total_pages || 0);
      })
      .catch(() => {
        toast.error('Failed to load notifications');
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchNotifications();
  }, [tab, page]);

  const filteredNotifications = notifications.filter((n) => {
    if (tab === 'support') {
      return String(n.type || '').toLowerCase() === 'support_ticket';
    }
    if (tab === 'iot') {
      const t = String(n.type || '').toLowerCase();
      return t.includes('posture') || (n.title || '').toLowerCase().includes('iot');
    }
    if (tab === 'security') {
      const t = String(n.type || '').toLowerCase();
      const title = (n.title || '').toLowerCase();
      return t.includes('at_risk') || title.includes('security') || title.includes('maintenance') || title.includes('backup');
    }
    return true;
  });

  const handleMarkRead = async (id) => {
    try {
      await markAdminNotificationRead(id);
      setNotifications((prev) =>
        prev.map((n) => (n.notification_id === id ? { ...n, is_read: true } : n))
      );
    } catch {
      toast.error('Failed to mark as read');
    }
  };

  const handleMarkAllRead = async () => {
    try {
      await markAllAdminNotificationsRead();
      setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
      toast.success('All notifications marked as read');
    } catch {
      toast.error('Failed to mark all as read');
    }
  };

  const formatTime = (dateStr) => {
    const d = new Date(dateStr);
    const now = new Date();
    const diff = (now - d) / 1000;
    if (diff < 60) return 'Just now';
    if (diff < 3600) return `${Math.floor(diff / 60)} minutes ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)} hours ago`;
    return d.toLocaleDateString();
  };

  return (
    <div className="max-w-3xl">
      <div className="flex items-center justify-between mb-1">
        <h1 className="text-2xl font-bold text-primary-dark">Notifications</h1>
        <button
          onClick={handleMarkAllRead}
          className="text-sm text-primary hover:underline flex items-center gap-1"
        >
          <CheckCircle2 className="w-4 h-4" />
          Mark All as Read
        </button>
      </div>
      <p className="text-sm text-slate-500 mb-6">
        Monitor admin events, support requests, IoT integrity signals, and security-related activity.
      </p>

      <div className="flex gap-2 mb-5 overflow-x-auto">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => { setTab(t.key); setPage(1); }}
            className={`px-4 py-1.5 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${
              tab === t.key
                ? 'bg-primary-dark text-white'
                : 'bg-white border border-primary-light text-slate-600 hover:bg-primary-50'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="space-y-3">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="animate-pulse bg-white rounded-xl border border-primary-light p-5 h-20" />
          ))}
        </div>
      ) : filteredNotifications.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-xl border border-primary-light">
          <Bell className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <p className="text-slate-500">No notifications</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filteredNotifications.map((n) => {
            const typeKey = String(n.type || '').toLowerCase();
            const Icon = TYPE_ICONS[typeKey] || Bell;
            const color = TYPE_COLORS[typeKey] || 'bg-slate-100 text-slate-600';
            const typeLabel = typeKey === 'support_ticket'
              ? 'Support'
              : typeKey === 'posture_alert'
                ? 'IoT'
                : typeKey === 'at_risk_flag'
                  ? 'Security'
                  : typeKey === 'heatmap_updated'
                    ? 'System'
                    : typeKey === 'quiz_assigned'
                      ? 'User'
                      : 'General';
            const handleClick = () => {
              if (!n.is_read) handleMarkRead(n.notification_id);
              if (typeKey === 'support_ticket') navigate('/admin/support-tickets');
            };
            return (
              <div
                key={n.notification_id}
                onClick={handleClick}
                className={`bg-white rounded-xl border p-4 flex items-start gap-3 transition-all cursor-pointer hover:shadow-sm ${
                  n.is_read ? 'border-primary-light' : 'border-primary/30 bg-primary-50/30'
                }`}
              >
                <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${color}`}>
                  <Icon className="w-5 h-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="font-semibold text-primary-dark text-sm">
                      {n.title}
                      {!n.is_read && <span className="ml-2 inline-block w-2 h-2 rounded-full bg-primary" />}
                    </p>
                    <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">
                      {typeLabel}
                    </span>
                  </div>
                  <p className="text-sm text-slate-600 mt-0.5">{n.body}</p>
                  <p className="text-xs text-slate-400 mt-1">{formatTime(n.created_at)}</p>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {totalPages > 1 && page < totalPages && (
        <div className="text-center mt-6">
          <button
            onClick={() => setPage((p) => p + 1)}
            className="text-sm text-primary hover:underline font-medium"
          >
            Load Older Notifications
          </button>
        </div>
      )}
    </div>
  );
}
