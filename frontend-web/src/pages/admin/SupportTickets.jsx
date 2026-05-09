import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  TicketCheck,
  AlertCircle,
  ChevronDown,
  Search,
  Loader2,
  Paperclip,
  X,
  Send,
} from 'lucide-react';
import toast from 'react-hot-toast';
import useAuth from '../../hooks/useAuth';
import api from '../../services/api';

const PRIORITY_STYLES = {
  Low:      { badge: 'bg-slate-100 text-slate-700',  dot: 'bg-slate-400' },
  Medium:   { badge: 'bg-blue-100 text-blue-700',    dot: 'bg-blue-500' },
  High:     { badge: 'bg-primary/10 text-primary',   dot: 'bg-primary' },
  Critical: { badge: 'bg-red-100 text-red-700',      dot: 'bg-red-600' },
};

const STATUS_STYLES = {
  open:        { badge: 'bg-amber-100 text-amber-700',  label: 'Open' },
  in_progress: { badge: 'bg-blue-100 text-blue-700',    label: 'In Progress' },
  resolved:    { badge: 'bg-green-100 text-green-700',  label: 'Resolved' },
  closed:      { badge: 'bg-slate-100 text-slate-600',  label: 'Closed' },
};

const STATUS_OPTIONS = ['open', 'in_progress', 'resolved', 'closed'];

function PriorityBadge({ priority }) {
  const s = PRIORITY_STYLES[priority] || PRIORITY_STYLES.Medium;
  return (
    <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-semibold ${s.badge}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${s.dot}`} />
      {priority}
    </span>
  );
}

function StatusBadge({ status }) {
  const s = STATUS_STYLES[status] || STATUS_STYLES.open;
  return (
    <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${s.badge}`}>
      {s.label}
    </span>
  );
}

function TicketDetailModal({ ticket, onClose, onStatusChange, updating, adminName }) {
  const [selectedStatus, setSelectedStatus] = useState(ticket.status);
  const [replyText, setReplyText] = useState('');
  const [sending, setSending] = useState(false);
  const [openingAttachment, setOpeningAttachment] = useState(false);

  const handleSave = () => {
    if (selectedStatus !== ticket.status) {
      onStatusChange(ticket.ticket_id, selectedStatus);
    }
  };

  const handleSendReply = async () => {
    const msg = replyText.trim();
    if (!msg) { toast.error('Please write a reply message.'); return; }
    setSending(true);
    try {
      await api.post(`/api/support/admin/tickets/${ticket.ticket_id}/reply`, {
        message: msg,
        admin_name: adminName || undefined,
      });
      toast.success(`Reply sent to ${ticket.email}`);
      setReplyText('');
      // reflect status change to in_progress if it was open
      if (ticket.status === 'open') {
        onStatusChange(ticket.ticket_id, 'in_progress');
      }
    } catch (err) {
      toast.error(err?.response?.data?.detail || 'Failed to send reply');
    } finally {
      setSending(false);
    }
  };

  const formatDate = (iso) => {
    const hasOff = iso?.endsWith('Z') || /[+-]\d{2}:\d{2}$/.test(iso ?? '');
    return new Date(hasOff ? iso : (iso ?? '') + 'Z').toLocaleString(undefined, {
      year: 'numeric', month: 'short', day: 'numeric',
      hour: '2-digit', minute: '2-digit',
    });
  };

  const formatBytes = (bytes) => {
    if (!Number.isFinite(bytes) || bytes <= 0) return 'Unknown size';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  };

  const attachmentUrl = ticket.attachment_download_url || null;

  const handleOpenAttachment = async () => {
    if (!attachmentUrl) {
      toast.error('Attachment URL is missing');
      return;
    }
    setOpeningAttachment(true);
    try {
      const response = await api.get(attachmentUrl, { responseType: 'blob' });
      const blobUrl = window.URL.createObjectURL(response.data);
      const link = document.createElement('a');
      link.href = blobUrl;
      link.target = '_blank';
      link.rel = 'noreferrer';
      link.download = ticket.attachment_name || 'attachment';
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.setTimeout(() => window.URL.revokeObjectURL(blobUrl), 2000);
    } catch (err) {
      toast.error(err?.response?.data?.detail || 'Could not open attachment');
    } finally {
      setOpeningAttachment(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center p-4">
      <div className="fixed inset-0 bg-black/35 backdrop-blur-sm" onClick={onClose} />
      <div className="relative z-[121] bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 z-20 flex items-start justify-between p-6 border-b border-slate-200/70 bg-white/70 backdrop-blur-xl">
          <div>
            <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">
              Ticket #{String(ticket.ticket_id).slice(0, 8).toUpperCase()}
            </p>
            <h2 className="text-lg font-bold text-slate-900 leading-snug">{ticket.subject}</h2>
            <p className="text-xs text-slate-500 mt-1">
              Created {formatDate(ticket.created_at)}{ticket.updated_at ? ` • Updated ${formatDate(ticket.updated_at)}` : ''}
            </p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500 transition-colors ml-4 flex-shrink-0">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-5">
          {/* Metadata */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { label: 'Submitted by', value: ticket.full_name },
              { label: 'Email', value: ticket.email },
              { label: 'Role', value: ticket.role },
              { label: 'Category', value: ticket.category },
            ].map(({ label, value }) => (
              <div key={label} className="bg-slate-50 rounded-xl p-3">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">{label}</p>
                <p className="text-sm font-medium text-slate-800 break-all">{value}</p>
              </div>
            ))}
          </div>

          <div className="flex gap-3 flex-wrap">
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-500 font-medium">Priority:</span>
              <PriorityBadge priority={ticket.priority} />
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-500 font-medium">Status:</span>
              <StatusBadge status={ticket.status} />
            </div>
            <div className="flex items-center gap-2 ml-auto">
              <span className="text-xs text-slate-400">{formatDate(ticket.created_at)}</span>
            </div>
          </div>

          {/* Description */}
          <div>
            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Description</p>
            <div className="bg-slate-50 rounded-xl p-4 text-sm text-slate-700 leading-relaxed whitespace-pre-wrap">
              {ticket.description}
            </div>
          </div>

          {/* Attachment */}
          <div>
            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Attachment</p>
            {ticket.attachment_name ? (
              <div className="p-4 bg-blue-50 border border-blue-100 rounded-xl">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-lg bg-white text-blue-600 border border-blue-200 flex items-center justify-center">
                    <Paperclip className="w-4 h-4" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm text-blue-900 font-semibold truncate">{ticket.attachment_name}</p>
                    <p className="text-xs text-blue-700">
                      {formatBytes(ticket.attachment_size_bytes)}{ticket.attachment_content_type ? ` • ${ticket.attachment_content_type}` : ''}
                    </p>
                  </div>
                  {attachmentUrl ? (
                    <button
                      type="button"
                      onClick={() => void handleOpenAttachment()}
                      disabled={openingAttachment}
                      className="ml-auto inline-flex items-center rounded-lg bg-white border border-blue-200 px-3 py-1.5 text-xs font-semibold text-blue-700 hover:bg-blue-100 disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
                    >
                      {openingAttachment ? 'Opening…' : 'Open File'}
                    </button>
                  ) : (
                    <span className="ml-auto text-xs font-medium text-amber-600">File unavailable</span>
                  )}
                </div>
              </div>
            ) : (
              <div className="rounded-xl border border-dashed border-slate-200 p-4 text-sm text-slate-500">
                No attachment provided.
              </div>
            )}
          </div>

          {/* Reply */}
          <div className="border border-slate-200 rounded-xl overflow-hidden">
            <div className="bg-slate-50 px-4 py-3 border-b border-slate-200 flex items-center gap-2">
              <Send className="w-4 h-4 text-primary" />
              <p className="text-xs font-bold text-slate-700 uppercase tracking-wider">Reply to Submitter</p>
              <span className="ml-auto text-xs text-slate-400 font-mono truncate max-w-[180px]">{ticket.email}</span>
            </div>
            <div className="p-4 space-y-3">
              <textarea
                value={replyText}
                onChange={(e) => setReplyText(e.target.value)}
                rows={5}
                placeholder={`Write your reply to ${ticket.full_name}…`}
                className="w-full px-3 py-2.5 text-sm rounded-lg bg-white border border-slate-200 focus:outline-none focus:ring-2 focus:ring-primary/20 resize-none"
              />
              <div className="flex justify-end">
                <button
                  onClick={handleSendReply}
                  disabled={sending || !replyText.trim()}
                  className="flex items-center gap-2 bg-primary text-white px-5 py-2 rounded-lg text-sm font-semibold hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                >
                  {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                  {sending ? 'Sending…' : 'Send Reply'}
                </button>
              </div>
            </div>
          </div>

          {/* Status update */}
          <div className="bg-slate-50 rounded-xl p-4">
            <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">Update Status</p>
            <div className="flex gap-2 flex-wrap">
              {STATUS_OPTIONS.map((s) => (
                <button
                  key={s}
                  onClick={() => setSelectedStatus(s)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all border ${
                    selectedStatus === s
                      ? 'bg-primary text-white border-primary shadow-sm'
                      : 'bg-white text-slate-600 border-slate-200 hover:border-primary/40'
                  }`}
                >
                  {STATUS_STYLES[s]?.label || s}
                </button>
              ))}
            </div>
            <div className="mt-4 flex justify-end">
              <button
                onClick={handleSave}
                disabled={updating || selectedStatus === ticket.status}
                className="bg-primary text-white px-6 py-2 rounded-lg text-sm font-semibold hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center gap-2"
              >
                {updating && <Loader2 className="w-4 h-4 animate-spin" />}
                Save Changes
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function AdminSupportTickets() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [priorityFilter, setPriorityFilter] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [selectedTicket, setSelectedTicket] = useState(null);

  const params = new URLSearchParams();
  if (statusFilter) params.set('status_filter', statusFilter);
  if (priorityFilter) params.set('priority', priorityFilter);
  if (categoryFilter) params.set('category', categoryFilter);

  const { data: tickets = [], isLoading, isError } = useQuery({
    queryKey: ['admin', 'support-tickets', statusFilter, priorityFilter, categoryFilter],
    queryFn: async () => {
      const res = await api.get(`/api/support/admin/tickets?${params.toString()}&limit=200`);
      return res.data;
    },
    refetchInterval: 60000,
  });

  const updateMutation = useMutation({
    mutationFn: ({ ticketId, status }) =>
      api.patch(`/api/support/admin/tickets/${ticketId}`, { status }),
    onSuccess: (_, { status }) => {
      toast.success(`Ticket marked as "${STATUS_STYLES[status]?.label || status}"`);
      queryClient.invalidateQueries({ queryKey: ['admin', 'support-tickets'] });
      if (selectedTicket) {
        setSelectedTicket((prev) => ({ ...prev, status }));
      }
    },
    onError: () => toast.error('Failed to update ticket status'),
  });

  const filtered = tickets.filter((t) => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      t.full_name?.toLowerCase().includes(q) ||
      t.email?.toLowerCase().includes(q) ||
      t.subject?.toLowerCase().includes(q)
    );
  });

  const counts = {
    total: tickets.length,
    open: tickets.filter((t) => t.status === 'open').length,
    in_progress: tickets.filter((t) => t.status === 'in_progress').length,
    resolved: tickets.filter((t) => t.status === 'resolved' || t.status === 'closed').length,
  };

  const formatDate = (iso) => {
    const hasOff = iso?.endsWith('Z') || /[+-]\d{2}:\d{2}$/.test(iso ?? '');
    return new Date(hasOff ? iso : (iso ?? '') + 'Z').toLocaleDateString(undefined, {
      month: 'short', day: 'numeric', year: 'numeric',
    });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <TicketCheck className="w-6 h-6 text-primary" />
            Support Tickets
          </h1>
          <p className="text-sm text-slate-500 mt-0.5">Review and respond to user support requests</p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: 'Total', value: counts.total, color: 'text-slate-700', bg: 'bg-slate-50' },
          { label: 'Open', value: counts.open, color: 'text-amber-700', bg: 'bg-amber-50' },
          { label: 'In Progress', value: counts.in_progress, color: 'text-blue-700', bg: 'bg-blue-50' },
          { label: 'Resolved / Closed', value: counts.resolved, color: 'text-green-700', bg: 'bg-green-50' },
        ].map(({ label, value, color, bg }) => (
          <div key={label} className={`${bg} rounded-xl p-4`}>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">{label}</p>
            <p className={`text-3xl font-extrabold ${color}`}>{value}</p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl border border-slate-100 p-4 flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search by name, email, or subject…"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2.5 text-sm rounded-lg bg-slate-50 border border-slate-200 focus:outline-none focus:ring-2 focus:ring-primary/20"
          />
        </div>

        {[
          {
            value: statusFilter, setValue: setStatusFilter, placeholder: 'All Statuses',
            options: [['', 'All Statuses'], ...STATUS_OPTIONS.map((s) => [s, STATUS_STYLES[s]?.label || s])],
          },
          {
            value: priorityFilter, setValue: setPriorityFilter, placeholder: 'All Priorities',
            options: [['', 'All Priorities'], ['Low', 'Low'], ['Medium', 'Medium'], ['High', 'High'], ['Critical', 'Critical']],
          },
          {
            value: categoryFilter, setValue: setCategoryFilter, placeholder: 'All Categories',
            options: [
              ['', 'All Categories'],
              ['Technical Issue', 'Technical Issue'],
              ['Course Access', 'Course Access'],
              ['Billing & Payments', 'Billing & Payments'],
              ['Feature Request', 'Feature Request'],
              ['Report Content', 'Report Content'],
            ],
          },
        ].map(({ value, setValue, placeholder, options }) => (
          <div key={placeholder} className="relative">
            <select
              value={value}
              onChange={(e) => setValue(e.target.value)}
              className="appearance-none pl-3 pr-8 py-2.5 text-sm rounded-lg bg-slate-50 border border-slate-200 focus:outline-none focus:ring-2 focus:ring-primary/20 cursor-pointer"
            >
              {options.map(([v, label]) => (
                <option key={v} value={v}>{label}</option>
              ))}
            </select>
            <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
          </div>
        ))}
      </div>

      {/* Tickets Table */}
      <div className="bg-white rounded-xl border border-slate-100 overflow-hidden">
        {isLoading ? (
          <div className="flex items-center justify-center py-20 gap-3 text-slate-500">
            <Loader2 className="w-6 h-6 animate-spin text-primary" />
            <span className="text-sm">Loading tickets…</span>
          </div>
        ) : isError ? (
          <div className="flex flex-col items-center justify-center py-20 gap-3 text-red-500">
            <AlertCircle className="w-8 h-8" />
            <span className="text-sm font-medium">Failed to load tickets</span>
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 gap-3 text-slate-400">
            <TicketCheck className="w-10 h-10" />
            <p className="text-sm font-medium">No tickets found</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-100">
                  {['Ticket ID', 'Submitted By', 'Subject', 'Category', 'Priority', 'Status', 'Date', ''].map((h) => (
                    <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide whitespace-nowrap">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {filtered.map((ticket) => (
                  <tr
                    key={ticket.ticket_id}
                    className="hover:bg-slate-50/70 transition-colors cursor-pointer"
                    onClick={() => setSelectedTicket(ticket)}
                  >
                    <td className="px-4 py-3 font-mono text-xs text-slate-500 whitespace-nowrap">
                      #{String(ticket.ticket_id).slice(0, 8).toUpperCase()}
                    </td>
                    <td className="px-4 py-3">
                      <div className="font-medium text-slate-800 whitespace-nowrap">{ticket.full_name}</div>
                      <div className="text-xs text-slate-400">{ticket.email}</div>
                    </td>
                    <td className="px-4 py-3 max-w-[220px]">
                      <p className="truncate text-slate-700">{ticket.subject}</p>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-slate-600 text-xs">{ticket.category}</td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <PriorityBadge priority={ticket.priority} />
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <StatusBadge status={ticket.status} />
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-xs text-slate-400">{formatDate(ticket.created_at)}</td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      {ticket.attachment_name && (
                        <Paperclip className="w-3.5 h-3.5 text-slate-400" title={ticket.attachment_name} />
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Detail Modal */}
      {selectedTicket && (
        <TicketDetailModal
          ticket={selectedTicket}
          onClose={() => setSelectedTicket(null)}
          onStatusChange={(ticketId, newStatus) => updateMutation.mutate({ ticketId, status: newStatus })}
          updating={updateMutation.isPending}
          adminName={user?.full_name}
        />
      )}
    </div>
  );
}
