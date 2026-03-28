import { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { Mail, Lock, Eye, EyeOff, QrCode, User, GraduationCap, Settings, Loader2, ArrowRight } from 'lucide-react';
import toast from 'react-hot-toast';
import useAuth from '../../hooks/useAuth';

const ROLES = [
  { value: 'student', label: 'STUDENT', icon: GraduationCap },
  { value: 'instructor', label: 'INSTRUCTOR', icon: User },
  { value: 'admin', label: 'ADMIN', icon: Settings },
];

export default function Login() {
  const navigate = useNavigate();
  const location = useLocation();
  const { login, complete2FA } = useAuth();

  const [selectedRole, setSelectedRole] = useState('student');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState({});

  // 2FA state
  const [needs2FA, setNeeds2FA] = useState(false);
  const [twoFACode, setTwoFACode] = useState('');
  const [twoFAUserId, setTwoFAUserId] = useState(null);

  const from = location.state?.from?.pathname;

  const getRedirectPath = (role) => {
    const dashboards = {
      student: '/student/dashboard',
      instructor: '/instructor/dashboard',
      admin: '/admin/dashboard',
    };
    return from || dashboards[role] || '/login';
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
        toast.success('Welcome back!');
        navigate(getRedirectPath(selectedRole), { replace: true });
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
      await complete2FA(twoFAUserId, twoFACode);
      toast.success('Welcome back!');
      navigate(getRedirectPath(selectedRole), { replace: true });
    } catch (err) {
      const detail = err.response?.data?.detail || 'Invalid code';
      toast.error(detail);
    } finally {
      setLoading(false);
    }
  };

  // 2FA input screen
  if (needs2FA) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
        <div className="w-full max-w-md bg-white rounded-lg shadow-sm border border-gray-200 p-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Two-Factor Authentication</h2>
          <p className="text-gray-600 mb-6">Enter the 6-digit code from your authenticator app.</p>
          <form onSubmit={handle2FASubmit} className="space-y-4">
            <input
              type="text"
              inputMode="numeric"
              maxLength={6}
              value={twoFACode}
              onChange={(e) => setTwoFACode(e.target.value.replace(/\D/g, ''))}
              placeholder="000000"
              className="w-full text-center text-2xl tracking-[0.5em] px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-900 focus:border-gray-900 outline-none"
              autoFocus
            />
            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 bg-gray-900 text-white rounded-lg font-semibold uppercase tracking-wider hover:bg-gray-800 transition disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Verify'}
            </button>
            <button
              type="button"
              onClick={() => { setNeeds2FA(false); setTwoFACode(''); }}
              className="w-full text-center text-sm text-gray-500 hover:text-gray-700"
            >
              Back to login
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex">
      {/* Left: Hero image placeholder */}
      <div className="hidden lg:flex lg:w-1/2 bg-gray-100 items-center justify-center relative">
        <div className="border-2 border-dashed border-gray-300 w-3/4 h-3/4 flex flex-col items-center justify-center text-gray-400">
          <div className="w-12 h-12 border border-gray-300 mb-4" />
          <p className="text-sm uppercase tracking-wider">Hero / Campaign Image</p>
          <p className="text-sm uppercase tracking-wider">Replace with actual asset</p>
          <p className="text-xs mt-2">Recommended: 880 x 660 px</p>
        </div>
        {/* Bottom bar */}
        <div className="absolute bottom-0 left-0 right-0 bg-gray-900 text-white px-6 py-3 flex items-center gap-3">
          <div className="w-8 h-8 border border-white rounded flex items-center justify-center">
            <ArrowRight className="w-4 h-4" />
          </div>
          <span className="font-bold uppercase tracking-wider">Gyanavriksha</span>
          <span className="text-gray-400 text-sm ml-auto uppercase tracking-wider">Smart Learning Ecosystem</span>
        </div>
      </div>

      {/* Right: Login form */}
      <div className="flex-1 flex items-center justify-center px-6 py-12">
        <div className="w-full max-w-md">
          <h1 className="text-3xl font-bold text-gray-900 mb-1">Welcome Back</h1>
          <p className="text-gray-600 mb-8">Select your role, then sign in to continue.</p>

          {/* Role selector */}
          <div className="mb-8">
            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3 block">
              Select Role
            </label>
            <div className="grid grid-cols-3 gap-3">
              {ROLES.map(({ value, label, icon: Icon }) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setSelectedRole(value)}
                  className={`relative flex flex-col items-center gap-2 py-4 rounded-lg border-2 transition ${
                    selectedRole === value
                      ? 'bg-gray-900 text-white border-gray-900'
                      : 'bg-white text-gray-600 border-gray-200 hover:border-gray-400'
                  }`}
                >
                  <Icon className="w-5 h-5" />
                  <span className="text-xs font-semibold uppercase tracking-wider">{label}</span>
                  {selectedRole === value && (
                    <div className="absolute -top-1 -right-1 w-3 h-3 bg-gray-900 border-2 border-white rounded-full" />
                  )}
                </button>
              ))}
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Email */}
            <div>
              <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2 block">
                Email Address
              </label>
              <div className="relative">
                <div className="absolute left-0 top-0 bottom-0 w-12 flex items-center justify-center border-r border-gray-300 text-gray-400">
                  <Mail className="w-4 h-4" />
                </div>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@gyanavriksha.edu.np"
                  className={`w-full pl-14 pr-4 py-3 border rounded-lg outline-none transition ${
                    errors.email ? 'border-red-400 focus:ring-red-200' : 'border-gray-300 focus:ring-gray-200'
                  } focus:ring-2`}
                />
              </div>
              {errors.email && <p className="text-red-500 text-xs mt-1">{errors.email}</p>}
            </div>

            {/* Password */}
            <div>
              <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2 block">
                Password
              </label>
              <div className="relative">
                <div className="absolute left-0 top-0 bottom-0 w-12 flex items-center justify-center border-r border-gray-300 text-gray-400">
                  <Lock className="w-4 h-4" />
                </div>
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className={`w-full pl-14 pr-12 py-3 border rounded-lg outline-none transition ${
                    errors.password ? 'border-red-400 focus:ring-red-200' : 'border-gray-300 focus:ring-gray-200'
                  } focus:ring-2`}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
              <div className="flex justify-end mt-1">
                <Link to="/forgot-password" className="text-sm text-blue-600 hover:underline">
                  Forgot password?
                </Link>
              </div>
              {errors.password && <p className="text-red-500 text-xs mt-1">{errors.password}</p>}
            </div>

            {/* Sign In button */}
            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 bg-gray-900 text-white rounded-lg font-semibold uppercase tracking-wider hover:bg-gray-800 transition disabled:opacity-50 flex items-center justify-center gap-2"
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
            <div className="flex-1 border-t border-gray-200" />
            <span className="px-4 text-xs text-gray-400 uppercase tracking-wider">Alternative Access</span>
            <div className="flex-1 border-t border-gray-200" />
          </div>

          {/* QR Login */}
          <Link
            to="/qr-login"
            className="w-full flex items-center justify-center gap-2 py-3 border-2 border-gray-200 rounded-lg text-gray-700 font-semibold uppercase tracking-wider text-sm hover:border-gray-400 transition"
          >
            <QrCode className="w-5 h-5" />
            Login with QR Code (IoT Bridge)
          </Link>

          {/* Footer links */}
          <div className="mt-6 flex items-center justify-between text-sm text-gray-500">
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-gray-400 inline-block" />
              2FA Active
            </span>
            <div className="space-x-4">
              <span className="hover:text-gray-700 cursor-pointer">Privacy policy</span>
              <span className="hover:text-gray-700 cursor-pointer">Terms of Service</span>
            </div>
          </div>

          {/* Sign up link */}
          <p className="mt-6 text-center text-sm text-gray-600">
            Don't have an account?{' '}
            <Link to="/register" className="text-blue-600 font-medium hover:underline">
              Sign up
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
