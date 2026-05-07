import { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { Mail, Lock, Eye, EyeOff, QrCode, Loader2, ArrowRight, User, GraduationCap, Settings, Shield, Smartphone, KeyRound } from 'lucide-react';
import toast from 'react-hot-toast';
import useAuth from '../../hooks/useAuth';
import authService from '../../services/authService';

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
  const [twoFactorMethods, setTwoFactorMethods] = useState([]);
  const [verifyMethod, setVerifyMethod] = useState('totp');
  const [emailSendBusy, setEmailSendBusy] = useState(false);
  const [rememberDevice3Days, setRememberDevice3Days] = useState(false);

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

  const suggestTwoFactorIfDisabled = (user) => {
    const has2fa = user?.totp_enabled === true || user?.email_2fa_enabled === true;
    if (!has2fa) {
      const role = user?.role || 'student';
      const settingsPath = `/${role}/settings`;
      toast.custom((t) => (
        <div
          className={`max-w-sm w-[92vw] rounded-2xl border border-primary-light bg-white shadow-xl p-4 ${
            t.visible ? 'animate-enter' : 'animate-leave'
          }`}
        >
          <div className="flex items-start gap-3">
            <div className="w-9 h-9 rounded-xl bg-primary-light/40 flex items-center justify-center text-lg">
              🛡️
            </div>
            <div className="flex-1">
              <p className="text-sm font-bold text-primary-dark">Security recommendation</p>
              <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                Enable Two-Factor Auth for stronger account protection.
              </p>
              <div className="mt-3 flex gap-2">
                <button
                  type="button"
                  className="px-3 py-1.5 text-xs font-semibold rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50"
                  onClick={() => toast.dismiss(t.id)}
                >
                  Later
                </button>
                <button
                  type="button"
                  className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-primary text-white hover:bg-primary/90"
                  onClick={() => {
                    toast.dismiss(t.id);
                    navigate(settingsPath);
                  }}
                >
                  Set up now
                </button>
              </div>
            </div>
          </div>
        </div>
      ), { duration: 6500 });
    }
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
        const methods =
          Array.isArray(data.two_factor_methods) && data.two_factor_methods.length > 0
            ? data.two_factor_methods
            : ['totp'];
        setTwoFactorMethods(methods);
        const initial = methods.includes('totp') ? 'totp' : 'email';
        setVerifyMethod(initial);
        setNeeds2FA(true);
        setTwoFAUserId(data.user_id);
        toast.success('Enter a verification code to continue');
      } else {
        const actualRole = data.user?.role;
        if (!actualRole) {
          toast.error('Could not determine account role');
          await logout();
          return;
        }
        if (data.user?.must_change_password) {
          toast('Please set a new password to continue.', { icon: '🔐' });
          navigate('/force-change-password', { replace: true });
          return;
        }
        suggestTwoFactorIfDisabled(data.user);
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
      const data = await complete2FA(email.trim(), twoFAUserId, twoFACode, verifyMethod, rememberDevice3Days);
      const actualRole = data.user?.role;
      if (!actualRole) {
        toast.error('Could not determine account role');
        await logout();
        setNeeds2FA(false);
        setTwoFACode('');
        return;
      }
      if (data.user?.must_change_password) {
        toast('Please set a new password to continue.', { icon: '🔐' });
        navigate('/force-change-password', { replace: true });
        return;
      }
      suggestTwoFactorIfDisabled(data.user);
      toast.success('Welcome back!');
      navigate(getRedirectPath(actualRole), { replace: true });
    } catch (err) {
      const detail = err.response?.data?.detail || 'Invalid code';
      toast.error(detail);
    } finally {
      setLoading(false);
    }
  };

  const sendEmailCode = async () => {
    if (!twoFAUserId) return;
    setEmailSendBusy(true);
    try {
      await authService.send2FAEmailCode(twoFAUserId);
      toast.success('If email sign-in is enabled, a code was sent to your inbox');
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Could not send email code');
    } finally {
      setEmailSendBusy(false);
    }
  };

  if (needs2FA) {
    const showTotp = twoFactorMethods.includes('totp');
    const showEmail = twoFactorMethods.includes('email');

    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-primary-light/30 flex items-center justify-center px-4 py-10 font-display">
        <div className="w-full max-w-md">
          <div className="bg-white rounded-2xl shadow-lg shadow-primary/5 border border-primary-light/80 overflow-hidden">
            <div className="bg-gradient-to-r from-primary-dark to-primary px-6 py-8 text-white">
              <div className="w-12 h-12 rounded-xl bg-white/15 flex items-center justify-center mb-4">
                <Shield className="w-6 h-6" />
              </div>
              <h2 className="text-2xl font-bold tracking-tight">Verify it&apos;s you</h2>
              <p className="text-primary-light/90 text-sm mt-2 leading-relaxed">
                Your account has two-step verification. Choose how you want to sign in.
              </p>
            </div>

            <div className="p-6">
              {(showTotp && showEmail) && (
                <div className="grid grid-cols-2 gap-2 p-1 bg-slate-100 rounded-xl mb-6">
                  <button
                    type="button"
                    onClick={() => { setVerifyMethod('totp'); setTwoFACode(''); }}
                    className={`flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-semibold transition ${
                      verifyMethod === 'totp' ? 'bg-white text-primary-dark shadow-sm' : 'text-slate-600 hover:text-primary-dark'
                    }`}
                  >
                    <Smartphone className="w-4 h-4" />
                    App
                  </button>
                  <button
                    type="button"
                    onClick={() => { setVerifyMethod('email'); setTwoFACode(''); }}
                    className={`flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-semibold transition ${
                      verifyMethod === 'email' ? 'bg-white text-primary-dark shadow-sm' : 'text-slate-600 hover:text-primary-dark'
                    }`}
                  >
                    <Mail className="w-4 h-4" />
                    Email
                  </button>
                </div>
              )}

              {verifyMethod === 'totp' && (
                <p className="text-sm text-slate-600 mb-4 flex items-start gap-2">
                  <KeyRound className="w-4 h-4 text-primary mt-0.5 shrink-0" />
                  Open your authenticator app (Google Authenticator, Authy, etc.) and enter the 6-digit code.
                </p>
              )}

              {verifyMethod === 'email' && (
                <div className="mb-4 space-y-3">
                  <p className="text-sm text-slate-600 flex items-start gap-2">
                    <Mail className="w-4 h-4 text-primary mt-0.5 shrink-0" />
                    We&apos;ll email you a one-time code. Check your inbox (and spam) after tapping send.
                  </p>
                  <button
                    type="button"
                    onClick={() => void sendEmailCode()}
                    disabled={emailSendBusy}
                    className="w-full py-2.5 rounded-xl border-2 border-primary/30 text-primary-dark font-semibold text-sm hover:bg-primary-light/20 transition disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    {emailSendBusy ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                    Send code to email
                  </button>
                </div>
              )}

              <form onSubmit={handle2FASubmit} className="space-y-4">
                <div>
                  <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider block mb-2">
                    {verifyMethod === 'email' ? 'Email code' : 'Authenticator code'}
                  </label>
                  <input
                    type="text"
                    inputMode="numeric"
                    maxLength={6}
                    value={twoFACode}
                    onChange={(e) => setTwoFACode(e.target.value.replace(/\D/g, ''))}
                    placeholder="• • • • • •"
                    className="w-full text-center text-2xl tracking-[0.4em] px-4 py-4 border-2 border-primary-light rounded-xl focus:ring-2 focus:ring-primary/25 focus:border-primary outline-none transition"
                    autoFocus
                  />
                </div>
                <label className="flex items-start gap-3 cursor-pointer rounded-xl border border-primary-light/80 bg-slate-50/80 px-4 py-3">
                  <input
                    type="checkbox"
                    checked={rememberDevice3Days}
                    onChange={(e) => setRememberDevice3Days(e.target.checked)}
                    className="mt-0.5 rounded border-primary-light text-primary focus:ring-primary"
                  />
                  <span className="text-sm text-slate-600 leading-snug">
                    Don&apos;t ask for a second step on this device for <span className="font-semibold text-slate-800">3 days</span> (this browser only).
                  </span>
                </label>
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-3.5 bg-gradient-to-r from-primary-dark to-primary text-white rounded-xl font-semibold hover:opacity-95 transition disabled:opacity-50 flex items-center justify-center gap-2 shadow-md shadow-primary/20"
                >
                  {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Continue'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setNeeds2FA(false);
                    setTwoFACode('');
                    setTwoFAUserId(null);
                    setRememberDevice3Days(false);
                  }}
                  className="w-full text-center text-sm text-slate-500 hover:text-primary-dark font-medium"
                >
                  Back to login
                </button>
              </form>
            </div>
          </div>
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

          {/* Divider — student QR + optional spacing */}
          {selectedRole === 'student' && (
            <div className="flex items-center my-6">
              <div className="flex-1 border-t border-primary-light" />
              <span className="px-4 text-xs text-slate-400 uppercase tracking-wider">Alternative Access</span>
              <div className="flex-1 border-t border-primary-light" />
            </div>
          )}

          {/* QR login — students only */}
          {selectedRole === 'student' && (
            <Link
              to="/qr-login"
              className="w-full flex items-center justify-center gap-2 py-3 border-2 border-primary-light rounded-lg text-primary-dark font-semibold uppercase tracking-wider text-sm hover:border-primary/40 hover:bg-primary-light/30 transition"
            >
              <QrCode className="w-5 h-5" />
              Login with QR code (web via mobile)
            </Link>
          )}

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
