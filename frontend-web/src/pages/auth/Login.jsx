import { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { Mail, Lock, Eye, EyeOff, QrCode, Loader2, ArrowRight, User, GraduationCap, Settings } from 'lucide-react';
import toast from 'react-hot-toast';
import useAuth from '../../hooks/useAuth';

const ROLES = [
  { key: 'student', label: 'Student', icon: GraduationCap },
  { key: 'instructor', label: 'Instructor', icon: User },
  { key: 'admin', label: 'Admin', icon: Settings },
];

export default function Login() {
  const navigate = useNavigate();
  const location = useLocation();
  const { login, complete2FA, logout } = useAuth();

  const [selectedRole, setSelectedRole] = useState('student');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState({});

  const [needs2FA, setNeeds2FA] = useState(false);
  const [twoFACode, setTwoFACode] = useState('');
  const [twoFAUserId, setTwoFAUserId] = useState(null);

  const from = location.state?.from?.pathname;

  const getRoleDashboardPath = (role) => {
    const dashboards = {
      student: '/student/dashboard',
      instructor: '/instructor/dashboard',
      admin: '/admin/dashboard',
    };
    return dashboards[role] || '/login';
  };

  const getRedirectPath = (role) => {
    const dashboard = getRoleDashboardPath(role);
    if (!from) return dashboard;
    const rolePrefix = `/${role}`;
    // Only honor "from" when it belongs to the same role scope.
    return from.startsWith(rolePrefix) ? from : dashboard;
  };

  const validate = () => {
    const errs = {};
    if (!email.trim()) errs.email = 'Email is required';
    else if (!/\S+@\S+\.\S+/.test(email)) errs.email = 'Invalid email format';
    if (!password) errs.password = 'Password is required';
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validate()) return;

    setLoading(true);
    try {
      const data = await login(email, password);
      if (data.requires_2fa) {
        setNeeds2FA(true);
        setTwoFAUserId(data.user_id);
        toast('Enter your 2FA code to continue');
      } else {
        const actualRole = data.user?.role;
        if (!actualRole) {
          toast.error('Could not determine account role');
          await logout();
          return;
        }
        toast.success('Welcome back!');
        navigate(getRedirectPath(actualRole), { replace: true });
      }
    } catch (err) {
      const detail = err.response?.data?.detail || 'Login failed';
      toast.error(detail);
    } finally {
      setLoading(false);
    }
  };

  const handle2FASubmit = async (e) => {
    e.preventDefault();
    if (!twoFACode || twoFACode.length !== 6) {
      toast.error('Enter a valid 6-digit code');
      return;
    }
    setLoading(true);
    try {
      const data = await complete2FA(twoFAUserId, twoFACode);
      const actualRole = data.user?.role;
      if (!actualRole) {
        toast.error('Could not determine account role');
        await logout();
        setNeeds2FA(false);
        setTwoFACode('');
        return;
      }
      toast.success('Welcome back!');
      navigate(getRedirectPath(actualRole), { replace: true });
    } catch (err) {
      const detail = err.response?.data?.detail || 'Invalid code';
      toast.error(detail);
    } finally {
      setLoading(false);
    }
  };

  if (needs2FA) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center px-4 font-display">
        <div className="w-full max-w-md bg-white rounded-xl shadow-sm border border-primary-light p-8">
          <h2 className="text-2xl font-bold text-primary-dark mb-2">Two-Factor Authentication</h2>
          <p className="text-slate-500 mb-6">Enter the 6-digit code from your authenticator app.</p>
          <form onSubmit={handle2FASubmit} className="space-y-4">
            <input
              type="text"
              inputMode="numeric"
              maxLength={6}
              value={twoFACode}
              onChange={(e) => setTwoFACode(e.target.value.replace(/\D/g, ''))}
              placeholder="000000"
              className="w-full text-center text-2xl tracking-[0.5em] px-4 py-3 border border-primary-light rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none"
              autoFocus
            />
            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 bg-primary text-white rounded-lg font-semibold hover:bg-primary/90 transition disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Verify'}
            </button>
            <button
              type="button"
              onClick={() => { setNeeds2FA(false); setTwoFACode(''); }}
              className="w-full text-center text-sm text-slate-500 hover:text-primary-dark"
            >
              Back to login
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex font-display">
      {/* Left: Hero panel */}
      <div className="hidden lg:flex lg:w-1/2 bg-primary-dark items-center justify-center relative overflow-hidden">
        <div className="flex flex-col items-center justify-center text-white z-10">
          <img src="/images/logo.png" alt="Gyanavriksha" className="w-64 h-64 object-contain mb-6 drop-shadow-lg" />
          <h2 className="text-2xl font-bold tracking-tight">Smart Learning Ecosystem</h2>
          <p className="text-primary-light/80 mt-2 text-sm">AI-Powered Education for Nepal's Secondary Schools</p>
        </div>
        {/* Decorative circles */}
        <div className="absolute -top-20 -left-20 w-80 h-80 rounded-full bg-primary/20" />
        <div className="absolute -bottom-32 -right-32 w-96 h-96 rounded-full bg-primary/10" />

        {/* Bottom bar */}
        <div className="absolute bottom-0 left-0 right-0 bg-black/20 backdrop-blur-sm text-white px-6 py-3 flex items-center gap-3">
          <img src="/images/logo-icon.png" alt="" className="w-8 h-8" />
          <span className="font-bold uppercase tracking-wider text-sm">Gyanavriksha</span>
          <span className="text-primary-light/60 text-xs ml-auto uppercase tracking-wider">Learning Ecosystem for Secondary Education</span>
        </div>
      </div>

      {/* Right: Login form */}
      <div className="flex-1 bg-background flex items-center justify-center px-6 py-12">
        <div className="w-full max-w-md">
          {/* Mobile logo */}
          <div className="lg:hidden flex items-center gap-3 mb-8">
            <img src="/images/logo-icon.png" alt="Gyanavriksha" className="w-10 h-10" />
            <span className="font-bold text-primary-dark text-lg">Gyanavriksha</span>
          </div>

          <h1 className="text-3xl font-bold text-primary-dark mb-1">Welcome Back</h1>
          <p className="text-slate-500 mb-6">Select your role, then sign in to continue.</p>

          {/* Role selector */}
          <div className="mb-6">
            <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2 block">
              Select Role
            </label>
            <div className="grid grid-cols-3 gap-2">
              {ROLES.map(({ key, label, icon: Icon }) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setSelectedRole(key)}
                  className={`relative flex flex-col items-center gap-2 py-4 px-3 rounded-lg border-2 transition-all ${
                    selectedRole === key
                      ? 'border-primary bg-primary text-white shadow-md'
                      : 'border-primary-light bg-white text-slate-600 hover:border-primary/40'
                  }`}
                >
                  <Icon className="w-6 h-6" />
                  <span className="text-xs font-semibold uppercase tracking-wider">{label}</span>
                  {selectedRole === key && (
                    <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-white" />
                  )}
                </button>
              ))}
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Email */}
            <div>
              <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2 block">
                Email Address
              </label>
              <div className="relative">
                <div className="absolute left-0 top-0 bottom-0 w-12 flex items-center justify-center border-r border-primary-light text-slate-400">
                  <Mail className="w-4 h-4" />
                </div>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@gyanavriksha.edu.np"
                  className={`w-full pl-14 pr-4 py-3 border rounded-lg outline-none transition ${
                    errors.email ? 'border-red-400 focus:ring-red-200' : 'border-primary-light focus:ring-primary/20 focus:border-primary'
                  } focus:ring-2`}
                />
              </div>
              {errors.email && <p className="text-red-500 text-xs mt-1">{errors.email}</p>}
            </div>

            {/* Password */}
            <div>
              <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2 block">
                Password
              </label>
              <div className="relative">
                <div className="absolute left-0 top-0 bottom-0 w-12 flex items-center justify-center border-r border-primary-light text-slate-400">
                  <Lock className="w-4 h-4" />
                </div>
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className={`w-full pl-14 pr-12 py-3 border rounded-lg outline-none transition ${
                    errors.password ? 'border-red-400 focus:ring-red-200' : 'border-primary-light focus:ring-primary/20 focus:border-primary'
                  } focus:ring-2`}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-primary"
                >
                  {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
              <div className="flex justify-end mt-1">
                <Link to="/forgot-password" className="text-sm text-primary hover:underline">
                  Forgot password?
                </Link>
              </div>
              {errors.password && <p className="text-red-500 text-xs mt-1">{errors.password}</p>}
            </div>

            {/* Sign In button */}
            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 bg-primary-dark text-white rounded-lg font-semibold uppercase tracking-wider hover:bg-primary-dark/90 transition disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {loading ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <>
                  Sign In <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>

          {/* Divider */}
          <div className="flex items-center my-6">
            <div className="flex-1 border-t border-primary-light" />
            <span className="px-4 text-xs text-slate-400 uppercase tracking-wider">Alternative Access</span>
            <div className="flex-1 border-t border-primary-light" />
          </div>

          {/* QR Login */}
          <Link
            to="/qr-login"
            className="w-full flex items-center justify-center gap-2 py-3 border-2 border-primary-light rounded-lg text-primary-dark font-semibold uppercase tracking-wider text-sm hover:border-primary/40 hover:bg-primary-light/30 transition"
          >
            <QrCode className="w-5 h-5" />
            Login with QR Code (IoT Bridge)
          </Link>

          {/* Footer links */}
          <div className="mt-6 flex items-center justify-between text-sm text-slate-500">
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-primary inline-block" />
              2FA Active
            </span>
            <div className="space-x-4">
              <Link to="/privacy-policy" className="hover:text-primary-dark cursor-pointer">
                Privacy policy
              </Link>
              <Link to="/terms-of-service" className="hover:text-primary-dark cursor-pointer">
                Terms of Service
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
