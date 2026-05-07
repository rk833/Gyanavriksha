import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Outlet, NavLink, useNavigate, Link } from 'react-router-dom';
import {
  LayoutDashboard,
  Cpu,
  Database,
  ScrollText,
  ShieldCheck,
  Users,
  Upload,
  BookOpen,
  LogOut,
  Menu,
  Bell,
  Settings,
  TicketCheck,
} from 'lucide-react';
import useAuth from '../hooks/useAuth';
import { getAdminUnreadCount } from '../services/adminService';

const NAV_ITEMS = [
  { to: '/admin/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/admin/users', label: 'User Management', icon: Users },
  { to: '/admin/academic', label: 'Academic Management', icon: BookOpen },
  { to: '/admin/iot', label: 'IoT Management', icon: Cpu },
  { to: '/admin/vector-store', label: 'Vector Store', icon: Database },
  { to: '/admin/curriculum-ingestion', label: 'Curriculum Ingestion', icon: Upload },
  { to: '/admin/audit-logs', label: 'Audit Logs', icon: ScrollText },
  { to: '/admin/security', label: 'Security', icon: ShieldCheck },
  { to: '/admin/support-tickets', label: 'Support Tickets', icon: TicketCheck },
];

export default function AdminLayout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { data: unreadData } = useQuery({
    queryKey: ['admin', 'notifications', 'unread-count'],
    queryFn: async () => (await getAdminUnreadCount()).data,
    refetchInterval: 30000,
  });
  const unreadCount = unreadData?.count ?? 0;

  const handleLogout = async () => {
    await logout();
    navigate('/login', { replace: true });
  };

  const navLinkClass = ({ isActive }) =>
    `flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors ${
      isActive
        ? 'bg-primary text-white font-medium'
        : 'text-slate-600 hover:bg-primary-light/50'
    }`;

  const SidebarContent = () => (
    <>
      <div className="flex items-center gap-3 px-4 py-4 border-b border-primary-light">
        <img src="/images/logo-icon.png" alt="Gyanavriksha" className="w-8 h-8" />
        <div>
          <span className="font-bold text-primary-dark text-sm">Gyanavriksha</span>
          <p className="text-xs text-slate-500">ADMIN PORTAL</p>
        </div>
      </div>

      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        {NAV_ITEMS.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            className={navLinkClass}
            onClick={() => setSidebarOpen(false)}
          >
            <Icon className="w-5 h-5" />
            <span>{label}</span>
          </NavLink>
        ))}
      </nav>

      <div className="px-3 py-4 border-t border-primary-light space-y-1">
        <button
          onClick={handleLogout}
          className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-slate-600 hover:bg-red-50 hover:text-red-600 w-full transition-colors"
        >
          <LogOut className="w-5 h-5" />
          <span>Logout</span>
        </button>
      </div>
    </>
  );

  return (
    <div className="min-h-screen bg-background flex font-display">
      <aside className="hidden lg:flex lg:w-60 flex-col bg-white border-r border-primary-light fixed h-full z-20">
        <SidebarContent />
      </aside>

      {sidebarOpen && (
        <div className="fixed inset-0 z-30 lg:hidden">
          <div className="absolute inset-0 bg-black/30" onClick={() => setSidebarOpen(false)} />
          <aside className="absolute left-0 top-0 bottom-0 w-60 bg-white flex flex-col shadow-xl">
            <SidebarContent />
          </aside>
        </div>
      )}

      <div className="flex-1 lg:ml-60 flex flex-col min-h-screen">
        <header className="bg-white border-b border-primary-light px-4 lg:px-6 py-3 flex items-center justify-between sticky top-0 z-10">
          <button
            className="lg:hidden p-2 rounded-lg hover:bg-primary-light/50 text-slate-600"
            onClick={() => setSidebarOpen(true)}
          >
            <Menu className="w-5 h-5" />
          </button>

          <div className="flex-1" />

          <div className="flex items-center gap-2">
            <button
              onClick={() => navigate('/admin/notifications')}
              className="p-2 rounded-lg hover:bg-primary-light/50 text-slate-600 relative"
            >
              <Bell className="w-5 h-5" />
              {unreadCount > 0 && (
                <span className="absolute -top-1.5 -right-1.5 min-w-[18px] h-[18px] px-1 rounded-full bg-red-600 text-white text-[10px] leading-[18px] text-center font-bold shadow-sm ring-2 ring-white animate-pulse">
                  {unreadCount > 99 ? '99+' : unreadCount}
                </span>
              )}
            </button>
            <Link to="/admin/settings" className="p-2 rounded-lg hover:bg-primary-light/50 text-slate-600 inline-flex">
              <Settings className="w-5 h-5" />
            </Link>
            <div className="w-8 h-8 rounded-full bg-primary-light border-2 border-primary/20 flex items-center justify-center text-primary font-semibold text-sm">
              {user?.full_name?.charAt(0)?.toUpperCase() || 'A'}
            </div>
          </div>
        </header>

        <main className="flex-1 p-4 lg:p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}