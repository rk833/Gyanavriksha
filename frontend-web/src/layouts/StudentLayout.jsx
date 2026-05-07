import { useState } from 'react';
import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard,
  BookOpen,
  ClipboardList,
  TrendingUp,
  Library,
  Cpu,
  Bot,
  HelpCircle,
  LogOut,
  Menu,
  Bell,
  Settings,
} from 'lucide-react';
import useAuth from '../hooks/useAuth';
import Footer from '../components/common/Footer';
import StudentGlobalIotAlerts from '../components/student/StudentGlobalIotAlerts';

const NAV_ITEMS = [
  { to: '/student/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/student/submissions', label: 'My Lessons', icon: BookOpen },
  { to: '/student/assignments', label: 'Assignments', icon: ClipboardList },
  { to: '/student/performance', label: 'Progress', icon: TrendingUp },
  { to: '/student/library', label: 'Library', icon: Library },
  { to: '/student/iot-status', label: 'IoT Status', icon: Cpu },
  { to: '/student/ai-tutor', label: 'AI Tutor', icon: Bot },
];

export default function StudentLayout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);

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
        <img src="/images/logo-icon.png" alt="Gyanavriksha" className="w-9 h-9 rounded-lg" />
        <div>
          <span className="font-bold text-primary-dark text-sm tracking-tight">Gyanavriksha</span>
          <p className="text-[10px] uppercase tracking-[0.12em] text-slate-500 font-medium">
            Student Portal
          </p>
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
          onClick={() => { navigate('/student/help'); setSidebarOpen(false); }}
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
              onClick={() => navigate('/student/notifications')}
              className="p-2 rounded-lg hover:bg-primary-light/50 text-slate-600 relative"
            >
              <Bell className="w-5 h-5" />
            </button>
            <button
              onClick={() => navigate('/student/settings')}
              className="p-2 rounded-lg hover:bg-primary-light/50 text-slate-600"
            >
              <Settings className="w-5 h-5" />
            </button>
            <button
              onClick={() => navigate('/student/profile')}
              className="w-8 h-8 rounded-full bg-primary-light border-2 border-primary/20 flex items-center justify-center text-primary font-semibold text-sm"
            >
              {user?.full_name?.charAt(0)?.toUpperCase() || 'S'}
            </button>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 p-4 lg:p-6">
          <Outlet />
        </main>

        <Footer />
      </div>

      <StudentGlobalIotAlerts />
    </div>
  );
}
