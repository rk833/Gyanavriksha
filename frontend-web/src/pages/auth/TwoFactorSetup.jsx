import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Shield, Loader2, ArrowRight, ArrowLeft, Copy, CheckCircle } from 'lucide-react';
import toast from 'react-hot-toast';
import authService from '../../services/authService';
import AuthLayout from '../../layouts/AuthLayout';

export default function TwoFactorSetup() {
  const navigate = useNavigate();

  const [step, setStep] = useState('loading'); // loading | setup | verify | done
  const [qrBase64, setQrBase64] = useState('');
  const [secret, setSecret] = useState('');
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  // Fetch 2FA setup on first render
  useState(() => {
    const fetchSetup = async () => {
      try {
        const data = await authService.setup2FA();
        setQrBase64(data.qr_code_base64);
        setSecret(data.secret);
        setStep('setup');
      } catch (err) {
        toast.error('Failed to load 2FA setup. Make sure you are logged in.');
        setStep('error');
      }
    };
    fetchSetup();
  });

  const copySecret = () => {
    navigator.clipboard.writeText(secret);
    setCopied(true);
    toast.success('Secret copied to clipboard');
    setTimeout(() => setCopied(false), 2000);
  };

  const handleVerify = async (e) => {
    e.preventDefault();
    if (!code || code.length !== 6) {
      toast.error('Enter a valid 6-digit code');
      return;
    }

    setLoading(true);
    try {
      await authService.verify2FASetup(secret, code);
      setStep('done');
      toast.success('2FA enabled successfully');
    } catch (err) {
      const detail = err.response?.data?.detail || 'Invalid code';
      toast.error(detail);
    } finally {
      setLoading(false);
    }
  };

  if (step === 'loading') {
    return (
      <AuthLayout>
        <div className="w-full max-w-md bg-white rounded-lg shadow-sm border border-gray-200 p-8 text-center">
          <Loader2 className="w-12 h-12 text-gray-400 mx-auto animate-spin" />
          <p className="mt-4 text-gray-600">Setting up two-factor authentication...</p>
        </div>
      </AuthLayout>
    );
  }

  if (step === 'error') {
    return (
      <AuthLayout>
        <div className="w-full max-w-md bg-white rounded-lg shadow-sm border border-gray-200 p-8 text-center">
          <Shield className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-gray-900 mb-2">Setup Failed</h2>
          <p className="text-gray-600 mb-4">Could not initialize 2FA setup. Please log in first.</p>
          <button
            onClick={() => navigate('/login')}
            className="text-blue-600 hover:underline text-sm"
          >
            Go to Login
          </button>
        </div>
      </AuthLayout>
    );
  }

  if (step === 'done') {
    return (
      <AuthLayout>
        <div className="w-full max-w-md bg-white rounded-lg shadow-sm border border-gray-200 p-8 text-center">
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <CheckCircle className="w-8 h-8 text-green-600" />
          </div>
          <h2 className="text-xl font-bold text-gray-900 mb-2">2FA Enabled!</h2>
          <p className="text-gray-600 mb-6">
            Your account is now secured with two-factor authentication.
            You'll need your authenticator app each time you sign in.
          </p>
          <button
            onClick={() => navigate('/login')}
            className="inline-flex items-center gap-2 px-6 py-3 bg-gray-900 text-white rounded-lg font-semibold hover:bg-gray-800 transition"
          >
            Continue <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout>
      <div className="w-full max-w-md bg-white rounded-lg shadow-sm border border-gray-200 p-8">
        {/* Header */}
        <div className="text-center mb-6">
          <div className="w-14 h-14 bg-gray-100 rounded-lg flex items-center justify-center mx-auto mb-4">
            <Shield className="w-7 h-7 text-gray-700" />
          </div>
          <h2 className="text-2xl font-bold text-gray-900">Two-Factor Authentication</h2>
          <p className="text-gray-600 mt-1">Scan this QR code with your authenticator app</p>
        </div>

        {/* QR Code */}
        <div className="flex justify-center mb-6">
          <div className="p-3 border-2 border-gray-200 rounded-lg">
            <img
              src={`data:image/png;base64,${qrBase64}`}
              alt="2FA QR Code"
              className="w-48 h-48"
            />
          </div>
        </div>

        {/* Manual secret */}
        <div className="mb-6">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
            Or enter this code manually
          </p>
          <div className="flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-lg p-3">
            <code className="flex-1 text-sm font-mono text-gray-700 break-all">{secret}</code>
            <button
              onClick={copySecret}
              className="flex-shrink-0 text-gray-400 hover:text-gray-600"
            >
              {copied ? <CheckCircle className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
            </button>
          </div>
        </div>

        {/* Instructions */}
        <div className="bg-gray-50 rounded-lg p-4 mb-6 text-sm text-gray-600">
          <p className="font-medium text-gray-900 mb-2">Compatible apps:</p>
          <ul className="space-y-1 list-disc list-inside">
            <li>Google Authenticator</li>
            <li>Authy</li>
            <li>Microsoft Authenticator</li>
          </ul>
        </div>

        {/* Verification */}
        <form onSubmit={handleVerify} className="space-y-4">
          <div>
            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2 block">
              Verification Code
            </label>
            <input
              type="text"
              inputMode="numeric"
              maxLength={6}
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
              placeholder="Enter 6-digit code"
              className="w-full text-center text-xl tracking-[0.3em] px-4 py-3 border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-gray-200 transition"
              autoFocus
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 bg-gray-900 text-white rounded-lg font-semibold hover:bg-gray-800 transition disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {loading ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <>
                Verify and Enable <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </form>

        <div className="mt-4 text-center">
          <button
            onClick={() => navigate(-1)}
            className="inline-flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900"
          >
            <ArrowLeft className="w-4 h-4" /> Go Back
          </button>
        </div>

        <div className="mt-6 pt-4 border-t border-gray-200 text-center">
          <p className="text-xs text-gray-400">Secured with 2FA &middot; Gyanavriksha</p>
        </div>
      </div>
    </AuthLayout>
  );
}
