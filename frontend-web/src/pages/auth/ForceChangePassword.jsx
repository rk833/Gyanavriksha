import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Lock, Eye, EyeOff, Loader2, KeyRound, ArrowRight, Check, X } from 'lucide-react';
import toast from 'react-hot-toast';
import useAuth from '../../hooks/useAuth';
import api from '../../services/api';

const RULES = [
  { label: 'At least 8 characters', test: (v) => v.length >= 8 },
  { label: 'One uppercase letter', test: (v) => /[A-Z]/.test(v) },
  { label: 'One lowercase letter', test: (v) => /[a-z]/.test(v) },
  { label: 'One number',           test: (v) => /\d/.test(v) },
];

const STRENGTH_LABELS = ['', 'Weak', 'Fair', 'Good', 'Strong'];
const STRENGTH_COLORS = ['', '#EF4444', '#F97316', '#EAB308', '#22C55E'];
const STRENGTH_BG     = ['', 'bg-red-500', 'bg-orange-400', 'bg-yellow-400', 'bg-green-500'];

export default function ForceChangePassword() {
  const navigate  = useNavigate();
  const { user, logout } = useAuth();

  const [newPassword,     setNewPassword]     = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showNew,         setShowNew]         = useState(false);
  const [showConfirm,     setShowConfirm]     = useState(false);
  const [loading,         setLoading]         = useState(false);
  const [error,           setError]           = useState('');

  const strength   = RULES.filter((r) => r.test(newPassword)).length;
  const isMatch    = confirmPassword.length > 0 && confirmPassword === newPassword;
  const isMismatch = confirmPassword.length > 0 && confirmPassword !== newPassword;
  const firstName  = user?.full_name?.split(' ')[0] ?? null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (strength < 4)            { setError('Password does not meet all requirements.'); return; }
    if (newPassword !== confirmPassword) { setError('Passwords do not match.'); return; }
    setLoading(true);
    try {
      await api.post('/api/auth/force-change-password', { new_password: newPassword });
      toast.success('Password set! Sign in with your new credentials.');
      await logout();
      navigate('/login', { replace: true });
    } catch (err) {
      setError(err.response?.data?.detail || 'Could not update password. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex font-display">
      {/* ── Left decorative panel ── */}
      <div className="hidden lg:flex lg:w-5/12 xl:w-1/2 bg-primary-dark flex-col items-center justify-center relative overflow-hidden px-12">
        {/* Blobs */}
        <div className="absolute -top-24 -left-24 w-96 h-96 rounded-full bg-white/5" />
        <div className="absolute -bottom-40 -right-40 w-[28rem] h-[28rem] rounded-full bg-white/5" />

        <div className="relative z-10 text-white text-center max-w-xs">
          <div className="w-20 h-20 rounded-2xl bg-white/10 border border-white/15 flex items-center justify-center mx-auto mb-8 shadow-xl">
            <KeyRound className="w-9 h-9 text-white" />
          </div>
          <h2 className="text-3xl font-extrabold tracking-tight leading-tight">
            Secure your<br />account today
          </h2>
          <p className="text-primary-light/75 text-sm mt-4 leading-relaxed">
            Admin-created accounts use a temporary password. Setting your own keeps your data private and safe.
          </p>

          {/* Feature pills */}
          <div className="mt-8 flex flex-col gap-3 text-left">
            {[
              { icon: '🔐', text: 'End-to-end encrypted storage' },
              { icon: '🛡️', text: 'Optional two-factor authentication' },
              { icon: '🔑', text: 'Only you know your password' },
            ].map((f) => (
              <div key={f.text} className="flex items-center gap-3 bg-white/8 border border-white/10 rounded-xl px-4 py-3">
                <span className="text-lg">{f.icon}</span>
                <span className="text-sm text-white/80">{f.text}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Bottom bar */}
        <div className="absolute bottom-0 left-0 right-0 bg-black/20 backdrop-blur-sm px-8 py-3 flex items-center gap-3">
          <img src="/images/logo-icon.png" alt="" className="w-7 h-7" />
          <span className="text-white font-bold text-sm uppercase tracking-widest">Gyanavriksha</span>
        </div>
      </div>

      {/* ── Right form panel ── */}
      <div className="flex-1 bg-slate-50 flex items-center justify-center px-6 py-12">
        <div className="w-full max-w-md">

          {/* Mobile logo */}
          <div className="lg:hidden flex items-center gap-3 mb-8">
            <img src="/images/logo-icon.png" alt="Gyanavriksha" className="w-9 h-9" />
            <span className="font-bold text-primary-dark text-base">Gyanavriksha</span>
          </div>

          {/* Greeting */}
          <div className="mb-8">
            <div className="inline-flex items-center gap-2 bg-amber-50 border border-amber-200 text-amber-700 text-xs font-semibold px-3 py-1.5 rounded-full mb-4">
              <KeyRound className="w-3.5 h-3.5" />
              First-time setup
            </div>
            <h1 className="text-3xl font-extrabold text-primary-dark tracking-tight leading-tight">
              {firstName ? `Hi ${firstName}, set` : 'Set'} your<br />new password
            </h1>
            <p className="text-slate-500 text-sm mt-2 leading-relaxed">
              Your account was created by an administrator. Choose a personal password to get started.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">

            {/* ── New password ── */}
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-500 uppercase tracking-widest block">
                New Password
              </label>
              <div className="relative">
                <div className="absolute left-0 inset-y-0 w-11 flex items-center justify-center border-r border-slate-200 text-slate-400 pointer-events-none">
                  <Lock className="w-4 h-4" />
                </div>
                <input
                  type={showNew ? 'text' : 'password'}
                  value={newPassword}
                  onChange={(e) => { setNewPassword(e.target.value); setError(''); }}
                  placeholder="Choose a strong password"
                  className="w-full pl-12 pr-11 py-3.5 bg-white border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition"
                  autoFocus
                  required
                />
                <button type="button" onClick={() => setShowNew((p) => !p)}
                  className="absolute right-3 inset-y-0 flex items-center text-slate-400 hover:text-primary transition">
                  {showNew ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>

              {/* Strength meter */}
              {newPassword.length > 0 && (
                <div className="space-y-2 pt-1">
                  <div className="flex items-center gap-2">
                    <div className="flex gap-1 flex-1 h-1.5">
                      {[0, 1, 2, 3].map((i) => (
                        <div key={i} className={`flex-1 rounded-full transition-all duration-300 ${i < strength ? STRENGTH_BG[strength] : 'bg-slate-200'}`} />
                      ))}
                    </div>
                    <span className="text-xs font-bold" style={{ color: STRENGTH_COLORS[strength] }}>
                      {STRENGTH_LABELS[strength]}
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-x-4 gap-y-1.5">
                    {RULES.map((r) => {
                      const ok = r.test(newPassword);
                      return (
                        <div key={r.label} className={`flex items-center gap-1.5 text-xs font-medium transition-colors ${ok ? 'text-green-600' : 'text-slate-400'}`}>
                          <div className={`w-4 h-4 rounded-full flex items-center justify-center flex-shrink-0 transition-colors ${ok ? 'bg-green-100' : 'bg-slate-100'}`}>
                            {ok ? <Check className="w-2.5 h-2.5" /> : <X className="w-2.5 h-2.5" />}
                          </div>
                          {r.label}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            {/* ── Confirm password ── */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-500 uppercase tracking-widest block">
                Confirm Password
              </label>
              <div className="relative">
                <div className="absolute left-0 inset-y-0 w-11 flex items-center justify-center border-r border-slate-200 text-slate-400 pointer-events-none">
                  <Lock className="w-4 h-4" />
                </div>
                <input
                  type={showConfirm ? 'text' : 'password'}
                  value={confirmPassword}
                  onChange={(e) => { setConfirmPassword(e.target.value); setError(''); }}
                  placeholder="Repeat your new password"
                  className={`w-full pl-12 pr-11 py-3.5 bg-white border rounded-xl text-sm outline-none focus:ring-2 transition ${
                    isMismatch
                      ? 'border-red-300 focus:ring-red-100 focus:border-red-400'
                      : isMatch
                      ? 'border-green-300 focus:ring-green-100 focus:border-green-400'
                      : 'border-slate-200 focus:ring-primary/20 focus:border-primary'
                  }`}
                  required
                />
                <button type="button" onClick={() => setShowConfirm((p) => !p)}
                  className="absolute right-3 inset-y-0 flex items-center text-slate-400 hover:text-primary transition">
                  {showConfirm ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
                {/* Match indicator icon */}
                {confirmPassword.length > 0 && (
                  <div className={`absolute right-9 inset-y-0 flex items-center transition-opacity ${confirmPassword.length > 0 ? 'opacity-100' : 'opacity-0'}`}>
                    {isMatch
                      ? <Check className="w-4 h-4 text-green-500" />
                      : <X className="w-4 h-4 text-red-400" />}
                  </div>
                )}
              </div>
              {isMismatch && (
                <p className="text-red-500 text-xs font-medium flex items-center gap-1">
                  <X className="w-3 h-3" /> Passwords do not match
                </p>
              )}
              {isMatch && (
                <p className="text-green-600 text-xs font-medium flex items-center gap-1">
                  <Check className="w-3 h-3" /> Passwords match
                </p>
              )}
            </div>

            {/* Error */}
            {error && (
              <div className="flex items-start gap-3 bg-red-50 border border-red-200 rounded-xl px-4 py-3">
                <X className="w-4 h-4 text-red-500 mt-0.5 flex-shrink-0" />
                <p className="text-red-700 text-sm">{error}</p>
              </div>
            )}

            {/* Submit */}
            <button
              type="submit"
              disabled={loading || strength < 4 || !isMatch}
              className="w-full py-3.5 bg-gradient-to-r from-primary-dark to-primary text-white rounded-xl font-semibold text-sm hover:opacity-95 active:scale-[0.99] transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-md shadow-primary/25 mt-2"
            >
              {loading
                ? <><Loader2 className="w-4 h-4 animate-spin" /> Setting password…</>
                : <><KeyRound className="w-4 h-4" /> Set Password <ArrowRight className="w-4 h-4" /></>
              }
            </button>
          </form>

          <p className="text-xs text-slate-400 text-center mt-5">
            After setting your password you will be redirected to sign in again.
          </p>
        </div>
      </div>
    </div>
  );
}
