import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Mail, ArrowRight, ArrowLeft, KeyRound, Loader2, CheckCircle } from 'lucide-react';
import toast from 'react-hot-toast';
import authService from '../../services/authService';
import AuthLayout from '../../layouts/AuthLayout';

export default function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!email.trim() || !/\S+@\S+\.\S+/.test(email)) {
      toast.error('Enter a valid email address');
      return;
    }

    setLoading(true);
    try {
      await authService.forgotPassword(email);
      setSent(true);
    } catch {
      setSent(true);
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthLayout>
      <div className="w-full max-w-md bg-white rounded-xl shadow-sm border border-primary-light p-8">
        {/* Step indicator */}
        <div className="flex items-center justify-center mb-8">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-full bg-primary text-white flex items-center justify-center text-xs">
              <CheckCircle className="w-4 h-4" />
            </div>
            <span className="text-sm text-slate-500">Login</span>
          </div>
          <div className="w-12 h-px bg-primary-light mx-2" />
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-full bg-primary-dark text-white flex items-center justify-center text-xs font-semibold">
              2
            </div>
            <span className="text-sm font-medium text-primary-dark">Reset</span>
          </div>
          <div className="w-12 h-px bg-primary-light mx-2" />
          <div className="flex items-center gap-2">
            <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-semibold ${
              sent ? 'bg-primary-dark text-white' : 'bg-primary-light text-slate-500'
            }`}>
              3
            </div>
            <span className="text-sm text-slate-500">Done</span>
          </div>
        </div>

        {sent ? (
          <div className="text-center">
            <CheckCircle className="w-12 h-12 text-green-500 mx-auto mb-4" />
            <h2 className="text-2xl font-bold text-primary-dark mb-2">Check Your Email</h2>
            <p className="text-slate-500 mb-6">
              If an account exists for <strong>{email}</strong>, we've sent a password reset link.
            </p>
            <Link
              to="/login"
              className="inline-flex items-center gap-2 text-sm text-slate-500 hover:text-primary-dark"
            >
              <ArrowLeft className="w-4 h-4" /> Back to Login
            </Link>
          </div>
        ) : (
          <>
            <div className="w-12 h-12 bg-primary-light rounded-lg flex items-center justify-center mb-4">
              <KeyRound className="w-6 h-6 text-primary" />
            </div>

            <h2 className="text-2xl font-bold text-primary-dark mb-2">Forgot your password?</h2>
            <p className="text-slate-500 mb-6">
              No worries. Enter the email address linked to your account and we'll send a secure reset link.
            </p>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2 block">
                  Registered Email
                </label>
                <div className="relative">
                  <div className="absolute left-0 top-0 bottom-0 w-10 flex items-center justify-center border-r border-primary-light text-slate-400">
                    <Mail className="w-4 h-4" />
                  </div>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@gyanavriksha.edu.np"
                    className="w-full pl-12 pr-4 py-3 border border-primary-light rounded-lg outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition"
                    autoFocus
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 bg-primary-dark text-white rounded-lg font-semibold hover:bg-primary-dark/90 transition disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {loading ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <>
                    Send Reset Link <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </form>

            <div className="mt-4 text-center">
              <Link
                to="/login"
                className="inline-flex items-center gap-2 text-sm text-slate-500 hover:text-primary-dark"
              >
                <ArrowLeft className="w-4 h-4" /> Back to Login
              </Link>
            </div>

            <div className="mt-6 pt-4 border-t border-primary-light text-center">
              <p className="text-xs text-slate-400">Secured with 2FA &middot; Gyanavriksha</p>
            </div>
          </>
        )}
      </div>
    </AuthLayout>
  );
}
