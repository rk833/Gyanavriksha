import { useState, useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import {
  Bell, CheckCircle2, FileText, AlertTriangle,
  Users, Upload, Info, Award, Loader2,
} from 'lucide-react';
import toast from 'react-hot-toast';
import {
  getNotifications,
  markNotificationRead,
  markAllNotificationsRead,
} from '../../services/instructorService';

const TYPE_ICONS = {
  submission_received: FileText,
  grading_done: Award,
  at_risk_flag: AlertTriangle,
  posture_alert: AlertTriangle,
  enrollment: Users,
  document: Upload,
  heatmap_updated: Upload,
  system: Info,
};

const TYPE_COLORS = {
  submission_received: 'bg-green-100 text-green-600',
  grading_done: 'bg-blue-100 text-blue-600',
  at_risk_flag: 'bg-red-100 text-red-600',
  posture_alert: 'bg-orange-100 text-orange-600',
  enrollment: 'bg-teal-100 text-teal-600',
  document: 'bg-purple-100 text-purple-600',
  heatmap_updated: 'bg-indigo-100 text-indigo-600',
  system: 'bg-slate-100 text-slate-600',
};

const TABS = [
  { key: '', label: 'All' },
  { key: 'unread', label: 'Unread' },
  { key: 'submission_received', label: 'Submissions' },
  { key: 'at_risk_flag', label: 'At-Risk' },
];

export default function InstructorNotifications() {
  const queryClient = useQueryClient();
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('');
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(0);

  const fetchNotifications = () => {
    setLoading(true);
    const params = { page, per_page: 20 };
    if (tab === 'unread') params.read = false;
    else if (tab) params.type = tab;

    getNotifications(params)
      .then((r) => {
        setNotifications(r.data.items || []);
        setTotal(r.data.total || 0);
        setTotalPages(r.data.total_pages || 0);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetchNotifications(); }, [tab, page]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleMarkRead = async (id) => {
    try {
      await markNotificationRead(id);
      setNotifications((prev) =>
        prev.map((n) => (n.notification_id === id ? { ...n, is_read: true } : n))
      );
      queryClient.invalidateQueries({ queryKey: ['instructor', 'notifications', 'unread-count'] });
    } catch {
      toast.error('Failed to mark as read');
    }
  };

  const handleMarkAllRead = async () => {
    try {
      await markAllNotificationsRead();
      setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
      queryClient.invalidateQueries({ queryKey: ['instructor', 'notifications', 'unread-count'] });
      toast.success('All notifications marked as read');
    } catch {
      toast.error('Failed to mark all as read');
    }
  };

  const formatTime = (dateStr) => {
    const hasOffset = dateStr?.endsWith('Z') || /[+-]\d{2}:\d{2}$/.test(dateStr ?? '');
    const d = new Date(hasOffset ? dateStr : (dateStr ?? '') + 'Z');
    const diff = (Date.now() - d.getTime()) / 1000;
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
        Stay updated on submissions, at-risk alerts, and system events.
      </p>

      {/* Tabs */}
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
      ) : notifications.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-xl border border-primary-light">
          <Bell className="w-16 h-16 text-slate-200 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-primary-dark mb-2">No Notifications Yet</h3>
          <p className="text-slate-500 text-sm max-w-sm mx-auto">
            You'll be notified when students submit work, at-risk alerts are triggered, or system events occur.
          </p>
          <div className="mt-6 grid grid-cols-1 sm:grid-cols-3 gap-3 max-w-md mx-auto">
            <div className="bg-slate-50 rounded-lg p-3 text-center">
              <FileText className="w-5 h-5 text-green-500 mx-auto mb-1" />
              <p className="text-xs text-slate-600">New Submissions</p>
            </div>
            <div className="bg-slate-50 rounded-lg p-3 text-center">
              <AlertTriangle className="w-5 h-5 text-red-500 mx-auto mb-1" />
              <p className="text-xs text-slate-600">At-Risk Alerts</p>
            </div>
            <div className="bg-slate-50 rounded-lg p-3 text-center">
              <Users className="w-5 h-5 text-teal-500 mx-auto mb-1" />
              <p className="text-xs text-slate-600">Enrollments</p>
            </div>
          </div>
        </div>
      ) : (
        <div className="space-y-2">
          {notifications.map((n) => {
            const Icon = TYPE_ICONS[n.type] || Bell;
            const color = TYPE_COLORS[n.type] || 'bg-slate-100 text-slate-600';
            return (
              <div
                key={n.notification_id}
                onClick={() => !n.is_read && handleMarkRead(n.notification_id)}
                className={`bg-white rounded-xl border p-4 flex items-start gap-3 transition-all cursor-pointer hover:shadow-sm ${
                  n.is_read ? 'border-primary-light' : 'border-primary/30 bg-primary-50/30'
                }`}
              >
                <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${color}`}>
                  <Icon className="w-5 h-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-primary-dark text-sm">
                    {n.title}
                    {!n.is_read && (
                      <span className="ml-2 inline-block w-2 h-2 rounded-full bg-primary" />
                    )}
                  </p>
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
