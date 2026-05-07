import { useState } from 'react';
import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  LayoutDashboard,
  ClipboardList,
  BookOpen,
  FileText,
  TrendingUp,
  AlertTriangle,
  Grid3X3,
  Upload,
  Monitor,
  HelpCircle,
  LogOut,
  Menu,
  Bell,
  Settings,
} from 'lucide-react';
import useAuth from '../hooks/useAuth';
import Footer from '../components/common/Footer';
import { getUnreadCount } from '../services/instructorService';

const NAV_ITEMS = [
  { to: '/instructor/dashboard', label: 'Intelligence', icon: LayoutDashboard },
  { to: '/instructor/subjects', label: 'My Subjects', icon: BookOpen },
  { to: '/instructor/assignments', label: 'Assignments', icon: ClipboardList },
  { to: '/instructor/submissions', label: 'Submissions', icon: FileText },
  { to: '/instructor/velocity-analytics', label: 'Velocity Analytics', icon: TrendingUp },
  { to: '/instructor/at-risk-students', label: 'At-Risk Students', icon: AlertTriangle },
  { to: '/instructor/concept-heatmap', label: 'Concept Heatmap', icon: Grid3X3 },
  { to: '/instructor/knowledge-base', label: 'Knowledge Base', icon: Upload },
  { to: '/instructor/exam-monitor', label: 'Exam', icon: Monitor },
];

export default function InstructorLayout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const { data: unreadData } = useQuery({
    queryKey: ['instructor', 'notifications', 'unread-count'],
    queryFn: async () => (await getUnreadCount()).data,
    refetchInterval: 30_000,
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
      {/* Logo */}
      <div className="flex items-center gap-3 px-4 py-4 border-b border-primary-light">
        <img src="/images/logo-icon.png" alt="Gyanavriksha" className="w-8 h-8" />
        <div>
          <span className="font-bold text-primary-dark text-sm">Gyanavriksha</span>
          {user && (
            <p className="text-xs text-slate-500 truncate max-w-[140px]">{user.full_name}</p>
          )}
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        {NAV_ITEMS.map(({ to, label, icon: Icon, disabled }) =>
          disabled ? (
            <div
              key={to}
              className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-slate-400 cursor-not-allowed"
              title="Coming soon"
            >
              <Icon className="w-5 h-5" />
              <span>{label}</span>
            </div>
          ) : (
            <NavLink
              key={to}
              to={to}
              className={navLinkClass}
              onClick={() => setSidebarOpen(false)}
            >
              <Icon className="w-5 h-5" />
              <span>{label}</span>
            </NavLink>
          )
        )}
      </nav>

      {/* Footer */}
      <div className="px-3 py-4 border-t border-primary-light space-y-1">
        <button
          onClick={() => { navigate('/instructor/help'); setSidebarOpen(false); }}
          className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-slate-600 hover:bg-primary-light/50 w-full transition-colors"
        >
          <HelpCircle className="w-5 h-5" />
          <span>Help</span>
        </button>
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
      {/* Desktop sidebar */}
      <aside className="hidden lg:flex lg:w-60 flex-col bg-white border-r border-primary-light fixed h-full z-20">
        <SidebarContent />
      </aside>

      {/* Mobile sidebar overlay */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-30 lg:hidden">
          <div className="absolute inset-0 bg-black/30" onClick={() => setSidebarOpen(false)} />
          <aside className="absolute left-0 top-0 bottom-0 w-60 bg-white flex flex-col shadow-xl">
            <SidebarContent />
          </aside>
        </div>
      )}

      {/* Main content */}
      <div className="flex-1 lg:ml-60 flex flex-col min-h-screen">
        {/* Top bar */}
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
              onClick={() => navigate('/instructor/notifications')}
              className="p-2 rounded-lg hover:bg-primary-light/50 text-slate-600 relative"
            >
              <Bell className="w-5 h-5" />
              {unreadCount > 0 && (
                <span className="absolute top-1 right-1 min-w-[16px] h-4 px-0.5 bg-red-500 text-white text-[9px] font-bold rounded-full flex items-center justify-center leading-none">
                  {unreadCount > 99 ? '99+' : unreadCount}
                </span>
              )}
            </button>
            <button
              onClick={() => navigate('/instructor/settings')}
              className="p-2 rounded-lg hover:bg-primary-light/50 text-slate-600"
            >
              <Settings className="w-5 h-5" />
            </button>
            <button
              onClick={() => navigate('/instructor/settings')}
              className="w-8 h-8 rounded-full bg-primary-light border-2 border-primary/20 flex items-center justify-center text-primary font-semibold text-sm"
            >
              {user?.full_name?.charAt(0)?.toUpperCase() || 'I'}
            </button>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 p-4 lg:p-6">
          <Outlet />
        </main>

        <Footer />
      </div>
    </div>
  );
}
