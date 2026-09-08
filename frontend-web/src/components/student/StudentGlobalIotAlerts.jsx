import { useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { ShieldAlert, X } from 'lucide-react';
import useAuth from '../../hooks/useAuth';
import { getWebSocketOrigin } from '../../lib/wsOrigin';

/**
 * Listens for IoT `posture_alert` over the student WebSocket and shows a blocking
 * dialog on any student route. Exam auto-pause/forfeit stay on Assignments.jsx.
 */
export default function StudentGlobalIotAlerts() {
  const { user } = useAuth();
  const [postureOpen, setPostureOpen] = useState(false);
  const [posturePayload, setPosturePayload] = useState(null);

  const showPosture = useCallback((msg) => {
    setPosturePayload({
      message: msg?.message || 'You are sitting too close to your screen. Move back for better posture and eye comfort.',
      distanceCm: msg?.distance_cm,
    });
    setPostureOpen(true);
  }, []);

  useEffect(() => {
    if (user?.role !== 'student') return undefined;

    let ws;
    let reconnectTimer;
    let cancelled = false;

    const connect = () => {
      const token = localStorage.getItem('access_token');
      if (cancelled || !token) return;

      const origin = getWebSocketOrigin();
      try {
        ws = new WebSocket(`${origin}/api/students/ws/iot-session?token=${encodeURIComponent(token)}`);
      } catch {
        reconnectTimer = setTimeout(connect, 5000);
        return;
      }

      ws.onmessage = (e) => {
        let msg;
        try {
          msg = JSON.parse(e.data);
        } catch {
          return;
        }
        if (msg.type === 'connected' || msg.type === 'pong') return;
        if (msg.type === 'posture_alert') showPosture(msg);
      };

      ws.onerror = () => {};

      ws.onclose = () => {
        ws = undefined;
        if (cancelled) return;
        reconnectTimer = setTimeout(connect, 4000);
      };
    };

    connect();

    return () => {
      cancelled = true;
      clearTimeout(reconnectTimer);
      if (ws && ws.readyState === WebSocket.OPEN) ws.close();
    };
  }, [user?.role, showPosture]);

  useEffect(() => {
    if (!postureOpen) return undefined;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (e) => {
      if (e.key === 'Escape') setPostureOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener('keydown', onKey);
    };
  }, [postureOpen]);

  const closePosture = () => setPostureOpen(false);

  if (!postureOpen || typeof document === 'undefined') return null;

  const dm = posturePayload?.distanceCm;
  const distLine =
    dm != null && Number.isFinite(Number(dm))
      ? `Detected distance ~${Math.round(Number(dm))} cm (optimal is about 30–80 cm away).`
      : 'Optimal distance is about 30–80 cm from your screen.';

  return createPortal(
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 pointer-events-auto">
      <button
        type="button"
        className="absolute inset-0 bg-slate-900/55 backdrop-blur-[2px]"
        aria-label="Close dialog backdrop"
        onClick={closePosture}
      />
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="posture-dialog-title"
        className="relative w-full max-w-md rounded-2xl bg-white shadow-2xl border border-amber-200/80 overflow-hidden"
      >
        <div className="bg-gradient-to-r from-amber-500 to-orange-500 px-5 py-4 flex items-start gap-3 text-white">
          <div className="w-11 h-11 rounded-xl bg-white/20 flex items-center justify-center flex-shrink-0">
            <ShieldAlert className="w-6 h-6 text-white" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold uppercase tracking-wide text-white/90">Smart desk • Posture</p>
            <h2 id="posture-dialog-title" className="text-lg font-bold leading-tight mt-0.5">
              Too close to the screen
            </h2>
          </div>
          <button
            type="button"
            onClick={closePosture}
            className="p-1.5 rounded-lg hover:bg-white/15 transition-colors text-white"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="px-5 py-4 space-y-3">
          <p className="text-sm text-slate-700 leading-relaxed">{posturePayload?.message}</p>
          <p className="text-xs text-slate-500 bg-amber-50 border border-amber-100 rounded-lg px-3 py-2">{distLine}</p>
          <button
            type="button"
            onClick={closePosture}
            className="w-full py-2.5 rounded-xl bg-[#001256] text-white text-sm font-semibold hover:bg-primary transition-colors"
          >
            I understand — I&apos;ll adjust
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
