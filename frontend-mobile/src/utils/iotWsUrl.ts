import { API_BASE_URL } from '../config/api';

/** Build ws(s):// base from HTTP API_BASE_URL (no trailing slash). */
export function getStudentIotWebSocketUrl(token: string): string {
  const base = API_BASE_URL.replace(/\/+$/, '');
  const wsBase = base.startsWith('https://') ? base.replace(/^https/, 'wss') : base.replace(/^http/, 'ws');
  return `${wsBase}/api/students/ws/iot-session?token=${encodeURIComponent(token)}`;
}
