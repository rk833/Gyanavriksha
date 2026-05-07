/**
 * WebSocket origin derived from VITE_API_URL (http→ws, https→wss).
 */
export function getWebSocketOrigin() {
  const api = import.meta.env.VITE_API_URL || 'http://localhost:8000';
  try {
    const u = new URL(api);
    u.protocol = u.protocol === 'https:' ? 'wss:' : 'ws:';
    return u.origin;
  } catch {
    return 'ws://localhost:8000';
  }
}
