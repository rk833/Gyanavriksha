import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Shield, Loader2, ArrowRight, ArrowLeft, Copy, CheckCircle, Smartphone, Mail, Lock, Eye, EyeOff } from 'lucide-react';
import toast from 'react-hot-toast';
import authService from '../../services/authService';
import AuthLayout from '../../layouts/AuthLayout';
import useAuth from '../../hooks/useAuth';

export default function TwoFactorSetup() {
  const navigate = useNavigate();
  const { user, fetchUser } = useAuth();

  const [setupTab, setSetupTab] = useState('app');
  const [step, setStep] = useState('loading');
  const [qrBase64, setQrBase64] = useState('');
  const [secret, setSecret] = useState('');
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  const [emailPassword, setEmailPassword] = useState('');
  const [showEmailPw, setShowEmailPw] = useState(false);
  const [emailBusy, setEmailBusy] = useState(false);

  const loadAuthenticatorSetup = useCallback(async () => {
    try {
      const data = await authService.setup2FA();
      setQrBase64(data.qr_code_base64);
      setSecret(data.secret);
      setStep('setup');
    } catch {
      toast.error('Failed to load authenticator setup. Make sure you are logged in.');
      setStep('error');
    }
  }, []);

  useEffect(() => {
    if (setupTab === 'app' && step === 'loading') {
      void loadAuthenticatorSetup();
    }
  }, [setupTab, step, loadAuthenticatorSetup]);

  const copySecret = () => {
    navigator.clipboard.writeText(secret);
    setCopied(true);
    toast.success('Secret copied');
    setTimeout(() => setCopied(false), 2000);
  };

  const handleVerifyApp = async (e) => {
    e.preventDefault();
    if (!code || code.length !== 6) {
      toast.error('Enter a valid 6-digit code');
      return;
    }
    setLoading(true);
    try {
      await authService.verify2FASetup(secret, code);
      setStep('done');
      toast.success('Authenticator linked');
      await fetchUser();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Invalid code');
    } finally {
      setLoading(false);
    }
  };

  const handleEnableEmail = async (e) => {
    e.preventDefault();
    if (!emailPassword) {
      toast.error('Enter your password');
      return;
    }
    if (!user?.is_email_verified) {
      toast.error('Verify your email address before enabling email codes');
      return;
    }
    setEmailBusy(true);
    try {
      await authService.enableEmail2FA(emailPassword);
      setEmailPassword('');
      setStep('done');
      toast.success('Email sign-in codes enabled');
      await fetchUser();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Could not enable');
    } finally {
      setEmailBusy(false);
    }
  };

  if (step === 'error') {
    return (
      <AuthLayout>
        <div className="w-full max-w-md bg-white rounded-xl shadow-sm border border-primary-light p-8 text-center">
          <Shield className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-primary-dark mb-2">Setup Failed</h2>
          <p className="text-slate-500 mb-4">Could not initialize. Please log in first.</p>
          <button type="button" onClick={() => navigate('/login')} className="text-primary hover:underline text-sm">
            Go to Login
          </button>
        </div>
      </AuthLayout>
    );
  }

  if (step === 'done') {
    return (
      <AuthLayout>
        <div className="w-full max-w-md bg-white rounded-xl shadow-sm border border-primary-light p-8 text-center">
          <div className="w-16 h-16 bg-emerald-50 rounded-full flex items-center justify-center mx-auto mb-4">
            <CheckCircle className="w-8 h-8 text-emerald-600" />
          </div>
          <h2 className="text-xl font-bold text-primary-dark mb-2">Updated</h2>
          <p className="text-slate-500 mb-6 leading-relaxed">
            Your two-step verification options are updated. You can use both methods at sign-in when enabled.
          </p>
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="inline-flex items-center gap-2 px-6 py-3 bg-primary-dark text-white rounded-xl font-semibold hover:bg-primary-dark/90 transition"
          >
            Done <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout>
      <div className="w-full max-w-lg bg-white rounded-2xl shadow-lg border border-primary-light/80 overflow-hidden">
        <div className="p-6 border-b border-primary-light/60 bg-gradient-to-br from-slate-50 to-white">
          <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center mb-3">
            <Shield className="w-6 h-6 text-primary" />
          </div>
          <h2 className="text-2xl font-bold text-primary-dark">Two-step verification</h2>
          <p className="text-slate-500 text-sm mt-1 leading-relaxed">
            Add an extra layer to your account. You can enable an authenticator app, email codes, or both.
          </p>
        </div>

        <div className="p-2">
          <div className="grid grid-cols-2 gap-1 p-1 mx-4 mt-4 bg-slate-100 rounded-xl">
            <button
              type="button"
              onClick={() => {
                setSetupTab('app');
                setStep('loading');
                setCode('');
              }}
              className={`flex items-center justify-center gap-2 py-3 rounded-lg text-sm font-semibold transition ${
                setupTab === 'app' ? 'bg-white text-primary-dark shadow-sm' : 'text-slate-600'
              }`}
            >
              <Smartphone className="w-4 h-4" />
              Authenticator
            </button>
            <button
              type="button"
              onClick={() => {
                setSetupTab('email');
                setStep('setup');
                setCode('');
              }}
              className={`flex items-center justify-center gap-2 py-3 rounded-lg text-sm font-semibold transition ${
                setupTab === 'email' ? 'bg-white text-primary-dark shadow-sm' : 'text-slate-600'
              }`}
            >
              <Mail className="w-4 h-4" />
              Email
            </button>
          </div>
        </div>

        <div className="px-6 pb-8 pt-2">
          {setupTab === 'app' ? (
            <>
              <div className="flex justify-center my-4">
                <div className="p-3 border-2 border-primary-light rounded-2xl bg-white">
                  {step === 'loading' ? (
                    <div className="w-48 h-48 flex items-center justify-center">
                      <Loader2 className="w-10 h-10 text-primary animate-spin" />
                    </div>
                  ) : (
                    <img src={`data:image/png;base64,${qrBase64}`} alt="Authenticator QR" className="w-48 h-48" />
                  )}
                </div>
              </div>

              <div className="mb-5">
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Manual entry</p>
                <div className="flex items-center gap-2 bg-slate-50 border border-primary-light rounded-xl p-3">
                  <code className="flex-1 text-sm font-mono text-primary-dark break-all">{secret}</code>
                  <button type="button" onClick={copySecret} className="text-slate-400 hover:text-primary">
                    {copied ? <CheckCircle className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <form onSubmit={handleVerifyApp} className="space-y-4">
                <div>
                  <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider block mb-2">
                    Code from app
                  </label>
                  <input
                    type="text"
                    inputMode="numeric"
                    maxLength={6}
                    value={code}
                    onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
                    placeholder="000000"
                    className="w-full text-center text-xl tracking-[0.35em] px-4 py-3 border-2 border-primary-light rounded-xl outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                  />
                </div>
                <button
                  type="submit"
                  disabled={loading || step === 'loading'}
                  className="w-full py-3.5 bg-primary-dark text-white rounded-xl font-semibold hover:bg-primary-dark/90 transition disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Verify & enable app'}
                </button>
              </form>
            </>
          ) : (
            <form onSubmit={handleEnableEmail} className="space-y-4 pt-2">
              <div className="rounded-xl bg-blue-50/80 border border-blue-100 p-4 text-sm text-slate-700 leading-relaxed">
                <p className="font-medium text-primary-dark mb-1">How it works</p>
                <p>At login, you can choose to receive a short code by email. Your email must be verified first.</p>
              </div>
              {!user?.is_email_verified && (
                <p className="text-sm text-amber-700 bg-amber-50 border border-amber-100 rounded-lg px-3 py-2">
                  Verify your email from your inbox before enabling this option.
                </p>
              )}
              <div>
                <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider block mb-2">
                  Confirm password
                </label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input
                    type={showEmailPw ? 'text' : 'password'}
                    value={emailPassword}
                    onChange={(e) => setEmailPassword(e.target.value)}
                    className="w-full pl-10 pr-10 py-3 border-2 border-primary-light rounded-xl outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                    placeholder="Your account password"
                  />
                  <button
                    type="button"
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400"
                    onClick={() => setShowEmailPw((v) => !v)}
                  >
                    {showEmailPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
              <button
                type="submit"
                disabled={emailBusy || !user?.is_email_verified}
                className="w-full py-3.5 bg-primary-dark text-white rounded-xl font-semibold hover:bg-primary-dark/90 transition disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {emailBusy ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Enable email codes'}
              </button>
            </form>
          )}

          <div className="mt-6 text-center">
            <button
              type="button"
              onClick={() => navigate(-1)}
              className="inline-flex items-center gap-2 text-sm text-slate-500 hover:text-primary-dark"
            >
              <ArrowLeft className="w-4 h-4" /> Back
            </button>
          </div>
        </div>
      </div>
    </AuthLayout>
  );
}
