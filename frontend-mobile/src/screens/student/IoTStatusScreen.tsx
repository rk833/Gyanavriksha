import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import axios from 'axios';

import { useApi } from '../../hooks/useApi';
import { useAppTheme } from '../../context/ThemeContext';
import { useStudentIotRealtime } from '../../context/StudentIotRealtimeContext';
import { mergeIotTelemetryIntoStatus } from '../../utils/mergeIotTelemetry';
import ScreenHeader from '../../components/ScreenHeader';

// ─── Types ────────────────────────────────────────────────────────────────────

// Matches backend get_iot_status() response
type DeviceEntry = {
  device_id: string;
  node_id?: string;
  device_label?: string;
  device_type?: string;
  status?: string;
  is_active?: boolean;
  last_seen_at?: string | null;
  firmware_version?: string | null;
  location?: string | null;
  latest_distance?: { distance_cm: number | null; recorded_at: string | null } | null;
  latest_light?: { ldr_value: number | null; led_activated: boolean | null; recorded_at: string | null } | null;
};

type IoTStatusResponse = {
  devices: DeviceEntry[];
  device_count: number;
  latest_distance_cm?: number | null;
  latest_ldr_value?: number | null;
  latest_led_activated?: boolean | null;
  latest_distance_at?: string | null;
  latest_ldr_at?: string | null;
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function parseApiError(error: unknown, fallback: string) {
  if (axios.isAxiosError(error)) {
    const detail = error.response?.data?.detail;
    if (typeof detail === 'string' && detail.trim().length > 0) return detail;
  }
  if (error instanceof Error && error.message.trim().length > 0) return error.message;
  return fallback;
}

function formatTs(raw?: string) {
  if (!raw) return '—';
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) return raw;
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

// Derive desk presence from distance: >80cm means away
function deskPresenceLabel(distanceCm: number | null | undefined) {
  if (distanceCm == null) return 'No data';
  return distanceCm > 80 ? 'Away' : 'At Desk';
}

function postureColor(label: string) {
  const l = label.toLowerCase();
  if (l === 'at desk') return '#15803D';
  if (l === 'away') return '#B91C1C';
  return '#64748B';
}

function isDeviceConnected(data: IoTStatusResponse | null) {
  if (!data || data.device_count === 0) return false;
  return data.devices.some((d) => d.status === 'online');
}

// ─── Pulse Dot ────────────────────────────────────────────────────────────────

function PulseDot({ color }: { color: string }) {
  const pulse = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const anim = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1.6, duration: 800, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 1, duration: 800, useNativeDriver: true }),
      ])
    );
    anim.start();
    return () => anim.stop();
  }, [pulse]);

  return (
    <View style={styles.pulseDotWrap}>
      <Animated.View
        style={[
          styles.pulseDotRing,
          { borderColor: color, transform: [{ scale: pulse }] },
        ]}
      />
      <View style={[styles.pulseDot, { backgroundColor: color }]} />
    </View>
  );
}

// ─── Gauge ────────────────────────────────────────────────────────────────────

function SensorGauge({
  label,
  value,
  unit,
  icon,
  max,
  fillColor,
  theme,
}: {
  label: string;
  value: number | null;
  unit: string;
  icon: keyof typeof MaterialIcons.glyphMap;
  max: number;
  fillColor: string;
  theme: ReturnType<typeof useAppTheme>['theme'];
}) {
  const pct = value != null ? Math.min(100, (value / max) * 100) : 0;

  return (
    <View
      style={[styles.gaugeCard, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}
    >
      <View style={[styles.gaugeIconWrap, { backgroundColor: theme.colors.primarySoft }]}>
        <MaterialIcons name={icon} size={20} color={theme.colors.primary} />
      </View>
      <Text style={[styles.gaugeLabel, { color: theme.colors.muted }]}>{label}</Text>
      <Text style={[styles.gaugeValue, { color: theme.colors.primary }]}>
        {value != null ? `${value}` : '—'}
        <Text style={styles.gaugeUnit}> {unit}</Text>
      </Text>
      <View style={[styles.gaugeTrack, { backgroundColor: theme.colors.border }]}>
        <View style={[styles.gaugeFill, { width: `${pct}%`, backgroundColor: fillColor }]} />
      </View>
    </View>
  );
}

// ─── Screen ───────────────────────────────────────────────────────────────────

const POLL_MS = 10000; // 10s refresh

export default function IoTStatusScreen() {
  const { get } = useApi();
  const { theme } = useAppTheme();
  const { telemetryTick, lastTelemetry, wsConnected } = useStudentIotRealtime();

  const [data, setData] = useState<IoTStatusResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const res = await get<IoTStatusResponse>('/api/students/iot/status');
      setData(res);
      setLastUpdated(new Date());
    } catch (err) {
      setError(parseApiError(err, 'Could not load IoT status. The desk sensor may be offline.'));
    } finally {
      setIsLoading(false);
    }
  }, [get]);

  const onRefresh = useCallback(async () => {
    setIsRefreshing(true);
    await load();
    setIsRefreshing(false);
  }, [load]);

  useEffect(() => {
    void load();
    const timer = setInterval(() => void load(), POLL_MS);
    return () => clearInterval(timer);
  }, [load]);

  useEffect(() => {
    if (telemetryTick === 0 || !lastTelemetry || lastTelemetry.type !== 'iot_telemetry') return;
    setData((prev) => mergeIotTelemetryIntoStatus(prev, lastTelemetry));
    setLastUpdated(new Date());
  }, [telemetryTick, lastTelemetry]);

  const connected = isDeviceConnected(data);
  const distance = data?.latest_distance_cm ?? null;
  const ldrValue = data?.latest_ldr_value ?? null;
  const presenceLabel = deskPresenceLabel(distance);
  const postureC = postureColor(presenceLabel);
  const guard = useMemo(() => {
    if (distance == null) return { label: 'No data', color: theme.colors.muted };
    if (distance < 30) return { label: 'Too close', color: theme.colors.primary };
    if (distance <= 80) return { label: 'Optimal alignment', color: theme.colors.muted };
    return { label: 'Too far', color: theme.colors.primary };
  }, [distance, theme.colors.muted, theme.colors.primary]);
  const primaryDevice = data?.devices[0] ?? null;

  return (
    <SafeAreaView
      style={[styles.safeArea, { backgroundColor: theme.colors.screen }]}
      edges={['top', 'left', 'right']}
    >
      <ScreenHeader title="Smart Desk" subtitle="IoT Status" showBack />
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={isRefreshing} onRefresh={() => void onRefresh()} tintColor={theme.colors.primary} />
        }
      >
        {/* Device status hero */}
        <View
          style={[
            styles.heroCard,
            { backgroundColor: theme.colors.primary },
          ]}
        >
          <View style={styles.heroGlow} />
            <View style={styles.heroTop}>
            <View style={styles.heroLeft}>
              <Text style={styles.heroLabel}>Smart Desk Sensor</Text>
              <Text style={styles.heroTitle}>
                {primaryDevice?.device_label ?? 'IoT Desk Unit'}
              </Text>
              {primaryDevice?.node_id ? (
                <Text style={styles.heroId}>Node: {primaryDevice.node_id}</Text>
              ) : null}
              <Text style={styles.heroId}>{data?.device_count ?? 0} device(s) linked</Text>
              {wsConnected ? (
                <View style={styles.liveWsRow}>
                  <MaterialIcons name="bolt" size={14} color="rgba(255,255,255,0.95)" />
                  <Text style={styles.liveWsText}>Live sensor stream</Text>
                </View>
              ) : null}
            </View>
            <View style={styles.heroBadge}>
              <PulseDot color={connected ? '#4ADE80' : '#F87171'} />
              <Text style={[styles.heroBadgeText, { color: connected ? '#4ADE80' : '#F87171' }]}>
                {connected ? 'Connected' : 'Offline'}
              </Text>
            </View>
          </View>
          {lastUpdated && (
            <Text style={styles.heroUpdated}>
              Last updated {lastUpdated.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
            </Text>
          )}
        </View>

        {isLoading && !data ? (
          <ActivityIndicator color={theme.colors.primary} style={{ marginTop: 32 }} />
        ) : error ? (
          <View style={styles.errorCard}>
            <MaterialIcons name="sensors-off" size={28} color="#9F1239" />
            <Text style={styles.errorTitle}>Sensor Unavailable</Text>
            <Text style={styles.errorBody}>{error}</Text>
            <TouchableOpacity
              style={[styles.retryButton, { backgroundColor: theme.colors.primary }]}
              onPress={() => void load()}
              activeOpacity={0.85}
            >
              <Text style={styles.retryButtonText}>Retry</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <>
            {/* Desk presence derived from distance */}
            <View
              style={[
                styles.postureCard,
                { backgroundColor: theme.colors.surface, borderColor: theme.colors.border },
              ]}
            >
              <View style={styles.postureCardLeft}>
                <Text style={[styles.sectionTitle, { color: theme.colors.primary }]}>
                  Desk Presence
                </Text>
                <Text style={[styles.postureValue, { color: postureC }]}>{presenceLabel}</Text>
                <Text style={[styles.postureHint, { color: theme.colors.muted }]}>
                  {presenceLabel === 'Away'
                    ? 'Distance > 80 cm — student not at workstation'
                    : distance != null
                    ? `Distance ${distance} cm — student at workstation`
                    : 'No distance reading available'}
                </Text>
                <Text style={[styles.postureHint, { color: theme.colors.muted, marginTop: 6 }]}>
                  Posture guard:{' '}
                  <Text style={{ color: guard.color, fontWeight: '800' }}>{guard.label}</Text>
                  {' — '}
                  {distance != null && distance < 30
                    ? 'Move back to about 30–80 cm from the screen.'
                    : distance != null && distance > 80
                      ? 'Move closer so the desk can track you reliably.'
                      : 'Ideal reading distance is about 30–80 cm.'}
                </Text>
              </View>
              <View
                style={[
                  styles.postureIconCircle,
                  { backgroundColor: `${postureC}18`, borderColor: `${postureC}40` },
                ]}
              >
                <MaterialIcons
                  name={presenceLabel === 'Away' ? 'person-off' : 'accessibility-new'}
                  size={32}
                  color={postureC}
                />
              </View>
            </View>

            {/* Sensor gauges */}
            <View style={styles.gaugeRow}>
              <SensorGauge
                label="Distance"
                value={distance}
                unit="cm"
                icon="straighten"
                max={200}
                fillColor={distance == null ? theme.colors.primary : distance > 80 ? '#B91C1C' : '#15803D'}
                theme={theme}
              />
              <SensorGauge
                label="Light (LDR)"
                value={ldrValue}
                unit=""
                icon="light-mode"
                max={1024}
                fillColor={ldrValue == null ? theme.colors.primary : ldrValue < 200 ? '#B45309' : '#15803D'}
                theme={theme}
              />
            </View>

            {/* LED status */}
            {data?.latest_led_activated != null && (
              <View
                style={[
                  styles.noSessionCard,
                  { backgroundColor: theme.colors.surface, borderColor: theme.colors.border },
                ]}
              >
                <MaterialIcons
                  name={data.latest_led_activated ? 'light-mode' : 'light-mode'}
                  size={20}
                  color={data.latest_led_activated ? '#B45309' : theme.colors.muted}
                />
                <Text style={[styles.noSessionText, { color: theme.colors.muted }]}>
                  LED auto-assist: {data.latest_led_activated ? 'Active (low light detected)' : 'Off'}
                </Text>
              </View>
            )}

            {/* Per-device list */}
            {(data?.devices ?? []).length > 0 && (
              <View>
                <Text style={[styles.sectionHeading, { color: theme.colors.primary }]}>
                  Linked Devices
                </Text>
                {data!.devices.map((d) => (
                  <View
                    key={d.device_id}
                    style={[
                      styles.absenceRow,
                      {
                        borderTopColor: theme.colors.border,
                        backgroundColor: theme.colors.surface,
                      },
                    ]}
                  >
                    <View
                      style={[
                        styles.absenceDotWrap,
                        { backgroundColor: d.is_active ? '#DCFCE7' : '#FEE2E2' },
                      ]}
                    >
                      <MaterialIcons
                        name="sensors"
                        size={16}
                        color={d.is_active ? '#15803D' : '#B91C1C'}
                      />
                    </View>
                    <View style={styles.absenceText}>
                      <Text style={[styles.absenceDesc, { color: theme.colors.primary }]}>
                        {d.device_label ?? d.node_id ?? d.device_id.slice(0, 12)}
                      </Text>
                      <Text style={[styles.absenceTs, { color: theme.colors.muted }]}>
                        {d.device_type ?? 'IoT'} • {d.status ?? 'Unknown'}{d.location ? ` • ${d.location}` : ''}
                        {d.last_seen_at ? `\nLast seen: ${formatTs(d.last_seen_at)}` : ''}
                      </Text>
                    </View>
                  </View>
                ))}
              </View>
            )}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  content: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 40,
    gap: 14,
  },
  // Hero
  heroCard: {
    borderRadius: 18,
    padding: 20,
    overflow: 'hidden',
    gap: 10,
  },
  heroGlow: {
    position: 'absolute',
    top: -30,
    right: -30,
    width: 110,
    height: 110,
    borderRadius: 55,
    backgroundColor: 'rgba(255,255,255,0.12)',
  },
  heroTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  heroLeft: { gap: 4 },
  heroLabel: {
    color: 'rgba(255,255,255,0.72)',
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  heroTitle: { color: '#FFFFFF', fontSize: 22, fontWeight: '800' },
  heroId: { color: 'rgba(255,255,255,0.55)', fontSize: 11 },
  liveWsRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 8 },
  liveWsText: { fontSize: 11, fontWeight: '800', letterSpacing: 0.3, color: 'rgba(255,255,255,0.92)' },
  heroBadge: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  heroBadgeText: { fontSize: 12, fontWeight: '800' },
  heroUpdated: {
    color: 'rgba(255,255,255,0.55)',
    fontSize: 11,
  },
  pulseDotWrap: { width: 14, height: 14, alignItems: 'center', justifyContent: 'center' },
  pulseDotRing: {
    position: 'absolute',
    width: 14,
    height: 14,
    borderRadius: 7,
    borderWidth: 1.5,
  },
  pulseDot: { width: 8, height: 8, borderRadius: 4 },
  // Error
  errorCard: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#FECACA',
    backgroundColor: '#FFF1F2',
    padding: 20,
    alignItems: 'center',
    gap: 10,
  },
  errorTitle: { fontSize: 16, fontWeight: '800', color: '#9F1239' },
  errorBody: { fontSize: 13, color: '#7C2D12', lineHeight: 18, textAlign: 'center' },
  retryButton: {
    borderRadius: 10,
    paddingHorizontal: 20,
    paddingVertical: 10,
  },
  retryButtonText: { color: '#FFFFFF', fontSize: 13, fontWeight: '700' },
  // Posture
  postureCard: {
    borderWidth: 1,
    borderRadius: 16,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  postureCardLeft: { flex: 1, gap: 4 },
  sectionTitle: { fontSize: 11, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.8 },
  postureValue: { fontSize: 26, fontWeight: '800', marginTop: 4 },
  postureHint: { fontSize: 12, lineHeight: 16, marginTop: 2 },
  postureIconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // Gauges
  gaugeRow: { flexDirection: 'row', gap: 12 },
  gaugeCard: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 16,
    padding: 14,
    gap: 8,
  },
  gaugeIconWrap: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
  },
  gaugeLabel: { fontSize: 10, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.8 },
  gaugeValue: { fontSize: 20, fontWeight: '800' },
  gaugeUnit: { fontSize: 12, fontWeight: '600' },
  gaugeTrack: { height: 6, borderRadius: 999, overflow: 'hidden' },
  gaugeFill: { height: '100%', borderRadius: 999 },
  noSessionCard: {
    borderWidth: 1,
    borderRadius: 16,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  noSessionText: { fontSize: 13 },
  // Device + absence section
  sectionHeading: { fontSize: 15, fontWeight: '800', marginBottom: 4 },
  absenceRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderTopWidth: 1,
  },
  absenceRowFirst: { borderTopLeftRadius: 14, borderTopRightRadius: 14, borderWidth: 1, borderTopWidth: 1 },
  absenceDotWrap: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  absenceText: { flex: 1, gap: 3 },
  absenceDesc: { fontSize: 13, fontWeight: '600', lineHeight: 18 },
  absenceTs: { fontSize: 11 },
});
