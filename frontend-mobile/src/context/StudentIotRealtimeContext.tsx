import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import * as SecureStore from 'expo-secure-store';

import { getStudentIotWebSocketUrl } from '../utils/iotWsUrl';
import { useAppTheme } from './ThemeContext';
import type { IotTelemetryWsMessage } from '../utils/mergeIotTelemetry';

type TelemetryState = { tick: number; msg: IotTelemetryWsMessage } | null;

type PosturePayload = {
  message: string;
  distanceCm?: number | null;
};

type Ctx = {
  /** Increments on each `iot_telemetry` message — use in useEffect deps. */
  telemetryTick: number;
  lastTelemetry: IotTelemetryWsMessage | null;
  wsConnected: boolean;
};

const StudentIotRealtimeContext = createContext<Ctx | null>(null);

export function StudentIotRealtimeProvider({ children }: { children: React.ReactNode }) {
  const { theme } = useAppTheme();
  const [telemetryState, setTelemetryState] = useState<TelemetryState>(null);
  const [wsConnected, setWsConnected] = useState(false);
  const [postureOpen, setPostureOpen] = useState(false);
  const [posturePayload, setPosturePayload] = useState<PosturePayload | null>(null);

  useEffect(() => {
    let ws: WebSocket | null = null;
    let reconnectTimer: ReturnType<typeof setTimeout> | undefined;
    let cancelled = false;
    let pingTimer: ReturnType<typeof setInterval> | undefined;

    const connect = async () => {
      const token = await SecureStore.getItemAsync('access_token');
      const fallback = token ?? (await SecureStore.getItemAsync('auth_token'));
      if (cancelled || !fallback) return;

      const url = getStudentIotWebSocketUrl(fallback);
      try {
        ws = new WebSocket(url);
      } catch {
        reconnectTimer = setTimeout(connect, 5000);
        return;
      }

      ws.onopen = () => {
        setWsConnected(true);
        pingTimer = setInterval(() => {
          if (ws && ws.readyState === WebSocket.OPEN) {
            try {
              ws.send('ping');
            } catch {
              /* ignore */
            }
          }
        }, 25000);
      };

      ws.onmessage = (ev) => {
        let msg: Record<string, unknown>;
        try {
          msg = JSON.parse(String(ev.data)) as Record<string, unknown>;
        } catch {
          return;
        }
        const t = msg.type;
        if (t === 'connected' || t === 'pong') return;
        if (t === 'posture_alert') {
          setPosturePayload({
            message:
              typeof msg.message === 'string'
                ? msg.message
                : 'You are sitting too close to your screen. Move back for better posture and eye comfort.',
            distanceCm: typeof msg.distance_cm === 'number' ? msg.distance_cm : null,
          });
          setPostureOpen(true);
          return;
        }
        if (t === 'iot_telemetry') {
          const tm = msg as unknown as IotTelemetryWsMessage;
          setTelemetryState((prev) => ({ tick: (prev?.tick ?? 0) + 1, msg: tm }));
        }
      };

      ws.onerror = () => {};

      ws.onclose = () => {
        setWsConnected(false);
        if (pingTimer) clearInterval(pingTimer);
        pingTimer = undefined;
        ws = null;
        if (cancelled) return;
        reconnectTimer = setTimeout(connect, 4000);
      };
    };

    void connect();

    return () => {
      cancelled = true;
      if (pingTimer) clearInterval(pingTimer);
      if (reconnectTimer) clearTimeout(reconnectTimer);
      if (ws && ws.readyState === WebSocket.OPEN) ws.close();
    };
  }, []);

  const closePosture = useCallback(() => {
    setPostureOpen(false);
    setPosturePayload(null);
  }, []);

  const ctx = useMemo<Ctx>(
    () => ({
      telemetryTick: telemetryState?.tick ?? 0,
      lastTelemetry: telemetryState?.msg ?? null,
      wsConnected,
    }),
    [telemetryState, wsConnected]
  );

  const dm = posturePayload?.distanceCm;
  const distLine =
    dm != null && Number.isFinite(Number(dm))
      ? `Detected distance ~${Math.round(Number(dm))} cm (optimal is about 30–80 cm away).`
      : 'Optimal distance is about 30–80 cm from your screen.';

  const onPrimary = theme.key === 'dark' ? theme.colors.screen : theme.colors.surface;

  return (
    <StudentIotRealtimeContext.Provider value={ctx}>
      {children}
      <Modal visible={postureOpen} transparent animationType="fade" onRequestClose={closePosture}>
        <Pressable style={styles.modalBackdrop} onPress={closePosture}>
          <Pressable style={[styles.dialog, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]} onPress={(e) => e.stopPropagation()}>
            <View style={[styles.dialogHeader, { backgroundColor: theme.colors.primary }]}>
              <MaterialIcons name="shield" size={28} color={onPrimary} style={styles.dialogShield} />
              <View style={styles.dialogHeaderText}>
                <Text style={[styles.dialogKicker, { color: onPrimary, opacity: 0.9 }]}>Smart desk • Posture</Text>
                <Text style={[styles.dialogTitle, { color: onPrimary }]}>Too close to the screen</Text>
              </View>
              <Pressable onPress={closePosture} hitSlop={12}>
                <MaterialIcons name="close" size={22} color={onPrimary} />
              </Pressable>
            </View>
            <View style={styles.dialogBody}>
              <Text style={[styles.dialogMessage, { color: theme.colors.text }]}>{posturePayload?.message}</Text>
              <Text style={[styles.dialogHint, { color: theme.colors.muted, borderColor: theme.colors.border, backgroundColor: theme.colors.surfaceMuted }]}>
                {distLine}
              </Text>
              <Pressable
                style={[styles.dialogButton, { backgroundColor: theme.colors.primary }]}
                onPress={closePosture}
              >
                <Text style={[styles.dialogButtonText, { color: onPrimary }]}>I understand — I'll adjust</Text>
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </StudentIotRealtimeContext.Provider>
  );
}

export function useStudentIotRealtime(): Ctx {
  const v = useContext(StudentIotRealtimeContext);
  if (!v) {
    throw new Error('useStudentIotRealtime must be used inside StudentIotRealtimeProvider');
  }
  return v;
}

const styles = StyleSheet.create({
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.55)',
    justifyContent: 'center',
    padding: 20,
  },
  dialog: {
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 1,
    maxWidth: 400,
    alignSelf: 'center',
    width: '100%',
  },
  dialogHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  dialogShield: { marginTop: 2 },
  dialogHeaderText: { flex: 1, minWidth: 0 },
  dialogKicker: {
    fontSize: 10,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  dialogTitle: { fontSize: 17, fontWeight: '800', marginTop: 4 },
  dialogBody: { padding: 16, gap: 12 },
  dialogMessage: { fontSize: 14, lineHeight: 21 },
  dialogHint: {
    fontSize: 12,
    lineHeight: 18,
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  dialogButton: {
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
    marginTop: 4,
  },
  dialogButtonText: { fontSize: 14, fontWeight: '700' },
});
