import { useState } from 'react';
import {
  Bell,
  CheckCircle2,
  FileText,
  AlertTriangle,
  Users,
  Upload,
  Info,
} from 'lucide-react';

const TYPE_ICONS = {
  submission: FileText,
  at_risk: AlertTriangle,
  enrollment: Users,
  document: Upload,
  system: Info,
};

const TYPE_COLORS = {
  submission: 'bg-green-100 text-green-600',
  at_risk: 'bg-red-100 text-red-600',
  enrollment: 'bg-blue-100 text-blue-600',
  document: 'bg-purple-100 text-purple-600',
  system: 'bg-slate-100 text-slate-600',
};

export default function InstructorNotifications() {
  const [notifications, setNotifications] = useState([]);

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
        {notifications.length > 0 && (
          <button className="text-sm text-primary hover:underline flex items-center gap-1">
            <CheckCircle2 className="w-4 h-4" />
            Mark All as Read
          </button>
        )}
      </div>
      <p className="text-sm text-slate-500 mb-6">
        Stay updated on submissions, at-risk alerts, and system events.
      </p>

      {notifications.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-xl border border-primary-light">
          <Bell className="w-16 h-16 text-slate-200 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-primary-dark mb-2">No Notifications Yet</h3>
          <p className="text-slate-500 text-sm max-w-sm mx-auto">
            You'll receive notifications here when students submit work, at-risk alerts are triggered, or system events occur.
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
              <Users className="w-5 h-5 text-blue-500 mx-auto mb-1" />
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
                key={n.id}
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
    </div>
  );
}
