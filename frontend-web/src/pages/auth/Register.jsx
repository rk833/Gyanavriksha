import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Mail, Lock, Eye, EyeOff, User, Loader2, ArrowRight, CheckCircle } from 'lucide-react';
import toast from 'react-hot-toast';
import useAuth from '../../hooks/useAuth';
import AuthLayout from '../../layouts/AuthLayout';

function getPasswordStrength(password) {
  if (!password) return { level: 0, label: '', color: '' };
  let score = 0;
  if (password.length >= 8) score++;
  if (/[A-Z]/.test(password)) score++;
  if (/[a-z]/.test(password)) score++;
  if (/[0-9]/.test(password)) score++;
  if (/[^A-Za-z0-9]/.test(password)) score++;

  if (score <= 2) return { level: 1, label: 'Weak', color: 'bg-red-500' };
  if (score <= 3) return { level: 2, label: 'Medium', color: 'bg-yellow-500' };
  return { level: 3, label: 'Strong', color: 'bg-green-500' };
}

export default function Register() {
  const navigate = useNavigate();
  const { register } = useAuth();

  const [form, setForm] = useState({
    full_name: '',
    email: '',
    password: '',
    confirmPassword: '',
    role: 'student',
    termsAccepted: false,
  });
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState({});
  const [registered, setRegistered] = useState(false);

  const strength = getPasswordStrength(form.password);

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setForm((prev) => ({ ...prev, [name]: type === 'checkbox' ? checked : value }));
    if (errors[name]) setErrors((prev) => ({ ...prev, [name]: '' }));
  };

  const validate = () => {
    const errs = {};
    if (!form.full_name.trim()) errs.full_name = 'Full name is required';
    if (!form.email.trim()) errs.email = 'Email is required';
    else if (!/\S+@\S+\.\S+/.test(form.email)) errs.email = 'Invalid email format';
    if (!form.password) errs.password = 'Password is required';
    else if (form.password.length < 8) errs.password = 'Password must be at least 8 characters';
    else if (strength.level < 2) errs.password = 'Password is too weak';
    if (form.password !== form.confirmPassword) errs.confirmPassword = 'Passwords do not match';
    if (!form.termsAccepted) errs.termsAccepted = 'You must accept the terms';
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validate()) return;

    setLoading(true);
    try {
      await register({
        full_name: form.full_name,
        email: form.email,
        password: form.password,
        role: form.role,
      });
      setRegistered(true);
    } catch (err) {
      const detail = err.response?.data?.detail || 'Registration failed';
      toast.error(detail);
    } finally {
      setLoading(false);
    }
  };

  // Success state
  if (registered) {
    return (
      <AuthLayout>
        <div className="w-full max-w-md bg-white rounded-lg shadow-sm border border-gray-200 p-8 text-center">
          <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Check Your Email</h2>
          <p className="text-gray-600 mb-6">
            We've sent a verification link to <strong>{form.email}</strong>.
            Please check your inbox and click the link to activate your account.
          </p>
          <Link
            to="/login"
            className="inline-flex items-center gap-2 px-6 py-3 bg-gray-900 text-white rounded-lg font-semibold hover:bg-gray-800 transition"
          >
            Go to Login <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout>
      <div className="w-full max-w-md bg-white rounded-lg shadow-sm border border-gray-200 p-8">
        <h2 className="text-2xl font-bold text-gray-900 mb-1">Create Account</h2>
        <p className="text-gray-600 mb-6">Join Gyanavriksha to start learning.</p>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Full Name */}
          <div>
            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5 block">
              Full Name
            </label>
            <div className="relative">
              <div className="absolute left-0 top-0 bottom-0 w-10 flex items-center justify-center text-gray-400">
                <User className="w-4 h-4" />
              </div>
              <input
                name="full_name"
                value={form.full_name}
                onChange={handleChange}
                placeholder="Your full name"
                className={`w-full pl-10 pr-4 py-2.5 border rounded-lg outline-none transition text-sm ${
                  errors.full_name ? 'border-red-400' : 'border-gray-300'
                } focus:ring-2 focus:ring-gray-200`}
              />
            </div>
            {errors.full_name && <p className="text-red-500 text-xs mt-1">{errors.full_name}</p>}
          </div>

          {/* Email */}
          <div>
            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5 block">
              Email Address
            </label>
            <div className="relative">
              <div className="absolute left-0 top-0 bottom-0 w-10 flex items-center justify-center text-gray-400">
                <Mail className="w-4 h-4" />
              </div>
              <input
                name="email"
                type="email"
                value={form.email}
                onChange={handleChange}
                placeholder="you@gyanavriksha.edu.np"
                className={`w-full pl-10 pr-4 py-2.5 border rounded-lg outline-none transition text-sm ${
                  errors.email ? 'border-red-400' : 'border-gray-300'
                } focus:ring-2 focus:ring-gray-200`}
              />
            </div>
            {errors.email && <p className="text-red-500 text-xs mt-1">{errors.email}</p>}
          </div>

          {/* Role */}
          <div>
            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5 block">
              Role
            </label>
            <select
              name="role"
              value={form.role}
              onChange={handleChange}
              className="w-full px-4 py-2.5 border border-gray-300 rounded-lg outline-none text-sm focus:ring-2 focus:ring-gray-200"
            >
              <option value="student">Student</option>
              <option value="instructor">Instructor</option>
            </select>
          </div>

          {/* Password */}
          <div>
            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5 block">
              Password
            </label>
            <div className="relative">
              <div className="absolute left-0 top-0 bottom-0 w-10 flex items-center justify-center text-gray-400">
                <Lock className="w-4 h-4" />
              </div>
              <input
                name="password"
                type={showPassword ? 'text' : 'password'}
                value={form.password}
                onChange={handleChange}
                placeholder="Min 8 characters"
                className={`w-full pl-10 pr-12 py-2.5 border rounded-lg outline-none transition text-sm ${
                  errors.password ? 'border-red-400' : 'border-gray-300'
                } focus:ring-2 focus:ring-gray-200`}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            {form.password && (
              <div className="mt-2 flex items-center gap-2">
                <div className="flex-1 flex gap-1">
                  {[1, 2, 3].map((i) => (
                    <div
                      key={i}
                      className={`h-1.5 flex-1 rounded-full ${
                        i <= strength.level ? strength.color : 'bg-gray-200'
                      }`}
                    />
                  ))}
                </div>
                <span className="text-xs text-gray-500">{strength.label}</span>
              </div>
            )}
            {errors.password && <p className="text-red-500 text-xs mt-1">{errors.password}</p>}
          </div>

          {/* Confirm Password */}
          <div>
            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5 block">
              Confirm Password
            </label>
            <div className="relative">
              <div className="absolute left-0 top-0 bottom-0 w-10 flex items-center justify-center text-gray-400">
                <Lock className="w-4 h-4" />
              </div>
              <input
                name="confirmPassword"
                type="password"
                value={form.confirmPassword}
                onChange={handleChange}
                placeholder="Repeat your password"
                className={`w-full pl-10 pr-4 py-2.5 border rounded-lg outline-none transition text-sm ${
                  errors.confirmPassword ? 'border-red-400' : 'border-gray-300'
                } focus:ring-2 focus:ring-gray-200`}
              />
            </div>
            {errors.confirmPassword && <p className="text-red-500 text-xs mt-1">{errors.confirmPassword}</p>}
          </div>

          {/* Terms */}
          <div>
            <label className="flex items-start gap-2 text-sm">
              <input
                name="termsAccepted"
                type="checkbox"
                checked={form.termsAccepted}
                onChange={handleChange}
                className="mt-0.5 rounded border-gray-300"
              />
              <span className="text-gray-600">
                I agree to the{' '}
                <span className="text-blue-600 hover:underline cursor-pointer">Terms & Conditions</span>
                {' '}and{' '}
                <span className="text-blue-600 hover:underline cursor-pointer">Privacy Policy</span>
              </span>
            </label>
            {errors.termsAccepted && <p className="text-red-500 text-xs mt-1">{errors.termsAccepted}</p>}
          </div>

          {/* Submit */}
          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 bg-gray-900 text-white rounded-lg font-semibold uppercase tracking-wider hover:bg-gray-800 transition disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {loading ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <>
                Create Account <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </form>

        <p className="mt-4 text-center text-sm text-gray-600">
          Already have an account?{' '}
          <Link to="/login" className="text-blue-600 font-medium hover:underline">
            Log in
          </Link>
        </p>
      </div>
    </AuthLayout>
  );
}
