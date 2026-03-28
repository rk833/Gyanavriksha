import { useState, useEffect, useRef, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { QrCode, Loader2, ArrowLeft, RefreshCw, CheckCircle } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../../services/api';
import AuthLayout from '../../layouts/AuthLayout';

export default function QRLogin() {
  const navigate = useNavigate();
  const pollRef = useRef(null);

  const [sessionId, setSessionId] = useState('');
  const [qrData, setQrData] = useState('');
  const [status, setStatus] = useState('loading'); // loading | pending | scanned | authenticated | expired | error
  const [timeLeft, setTimeLeft] = useState(120);

  const createSession = useCallback(async () => {
    setStatus('loading');
    try {
      const { data } = await api.post('/api/auth/qr/create');
      setSessionId(data.session_id);
      setQrData(data.qr_data);
      setTimeLeft(data.expires_in || 120);
      setStatus('pending');
    } catch {
      setStatus('error');
      toast.error('Failed to create QR session');
    }
  }, []);

  useEffect(() => {
    createSession();
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [createSession]);

  // Poll for status updates
  useEffect(() => {
    if (!sessionId || status === 'authenticated' || status === 'expired' || status === 'error') return;

    pollRef.current = setInterval(async () => {
      try {
        const { data } = await api.get(`/api/auth/qr/status/${sessionId}`);
        if (data.status === 'scanned') {
          setStatus('scanned');
        } else if (data.status === 'authenticated') {
          clearInterval(pollRef.current);
          setStatus('authenticated');
          // Store tokens if returned
          if (data.access_token) {
            localStorage.setItem('access_token', data.access_token);
            localStorage.setItem('refresh_token', data.refresh_token);
          }
          toast.success('Signed in successfully');
          setTimeout(() => navigate('/student/dashboard', { replace: true }), 1000);
        } else if (data.status === 'expired') {
          clearInterval(pollRef.current);
          setStatus('expired');
        }
      } catch {
        // Ignore polling errors
      }
    }, 2000);

    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [sessionId, status, navigate]);

  // Countdown timer
  useEffect(() => {
    if (status !== 'pending' && status !== 'scanned') return;

    const timer = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          setStatus('expired');
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [status]);

  const formatTime = (seconds) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  const handleRegenerate = () => {
    if (pollRef.current) clearInterval(pollRef.current);
    createSession();
  };

  const statusIndicator = () => {
    switch (status) {
      case 'pending':
        return (
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-gray-900 text-white rounded-full text-sm font-mono">
            <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
            QR expires in {formatTime(timeLeft)}
          </div>
        );
      case 'scanned':
        return (
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-blue-50 text-blue-700 rounded-full text-sm">
            <Loader2 className="w-4 h-4 animate-spin" />
            Scanned! Waiting for confirmation...
          </div>
        );
      case 'authenticated':
        return (
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-green-50 text-green-700 rounded-full text-sm">
            <CheckCircle className="w-4 h-4" />
            Authenticated! Redirecting...
          </div>
        );
      case 'expired':
        return (
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-red-50 text-red-700 rounded-full text-sm">
            QR code expired
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <AuthLayout>
      <div className="w-full max-w-md bg-white rounded-lg shadow-sm border border-gray-200 p-8">
        {/* Header */}
        <div className="text-center mb-6">
          <h2 className="text-2xl font-bold text-gray-900">Scan to Sign In</h2>
          <p className="text-gray-600 mt-1">
            Use the Gyanavriksha mobile app to scan this QR code and log in instantly.
          </p>
        </div>

        {/* QR Code area */}
        <div className="flex justify-center mb-4">
          {status === 'loading' ? (
            <div className="w-56 h-56 flex items-center justify-center border-2 border-dashed border-gray-200 rounded-lg">
              <Loader2 className="w-8 h-8 text-gray-400 animate-spin" />
            </div>
          ) : status === 'error' ? (
            <div className="w-56 h-56 flex flex-col items-center justify-center border-2 border-dashed border-gray-200 rounded-lg text-gray-400">
              <QrCode className="w-12 h-12 mb-2" />
              <p className="text-sm">Failed to load</p>
            </div>
          ) : (
            <div className="relative">
              <div className="p-2 border-2 border-gray-200 rounded-lg">
                {/* QR code from qr_data — render as text-based QR placeholder */}
                <div className="w-52 h-52 bg-white flex items-center justify-center">
                  <QrCode className="w-32 h-32 text-gray-800" />
                </div>
              </div>
              {/* Corner brackets */}
              <div className="absolute -top-1 -left-1 w-4 h-4 border-t-2 border-l-2 border-gray-400 rounded-tl" />
              <div className="absolute -top-1 -right-1 w-4 h-4 border-t-2 border-r-2 border-gray-400 rounded-tr" />
              <div className="absolute -bottom-1 -left-1 w-4 h-4 border-b-2 border-l-2 border-gray-400 rounded-bl" />
              <div className="absolute -bottom-1 -right-1 w-4 h-4 border-b-2 border-r-2 border-gray-400 rounded-br" />
            </div>
          )}
        </div>

        {/* Status */}
        <div className="text-center mb-6">{statusIndicator()}</div>

        {/* Instructions */}
        <div className="border border-gray-200 rounded-lg divide-y divide-gray-200 mb-6">
          <div className="flex items-center gap-3 p-3">
            <span className="w-6 h-6 bg-gray-100 rounded text-xs font-semibold flex items-center justify-center text-gray-500">
              1
            </span>
            <p className="text-sm text-gray-600">
              Open the <strong>Gyanavriksha</strong> mobile app on your device
            </p>
          </div>
          <div className="flex items-center gap-3 p-3">
            <span className="w-6 h-6 bg-gray-100 rounded text-xs font-semibold flex items-center justify-center text-gray-500">
              2
            </span>
            <p className="text-sm text-gray-600">
              Tap <strong>Scan QR</strong> from the app home screen
            </p>
          </div>
          <div className="flex items-center gap-3 p-3">
            <span className="w-6 h-6 bg-gray-100 rounded text-xs font-semibold flex items-center justify-center text-gray-500">
              3
            </span>
            <p className="text-sm text-gray-600">
              Point your camera at this code
              <br />
              <span className="text-gray-400 text-xs">You'll be signed in automatically</span>
            </p>
          </div>
        </div>

        {/* Regenerate / expired */}
        {status === 'expired' && (
          <button
            onClick={handleRegenerate}
            className="w-full flex items-center justify-center gap-2 py-3 mb-3 bg-gray-900 text-white rounded-lg font-semibold hover:bg-gray-800 transition"
          >
            <RefreshCw className="w-4 h-4" /> Regenerate QR Code
          </button>
        )}

        {/* Divider */}
        <div className="flex items-center my-4">
          <div className="flex-1 border-t border-gray-200" />
          <span className="px-4 text-xs text-gray-400 uppercase tracking-wider">Or sign in another way</span>
          <div className="flex-1 border-t border-gray-200" />
        </div>

        {/* Back to login */}
        <Link
          to="/login"
          className="w-full flex items-center justify-center gap-2 py-3 bg-gray-900 text-white rounded-lg font-semibold hover:bg-gray-800 transition"
        >
          <ArrowLeft className="w-4 h-4" /> Sign In with Email
        </Link>
        <Link
          to="/login"
          className="w-full flex items-center justify-center py-3 mt-2 border border-gray-200 rounded-lg text-gray-600 text-sm hover:bg-gray-50 transition"
        >
          Cancel
        </Link>

        <div className="mt-6 pt-4 border-t border-gray-200 text-center">
          <p className="text-xs text-gray-400">Secured with 2FA &middot; Gyanavriksha</p>
        </div>
      </div>
    </AuthLayout>
  );
}
