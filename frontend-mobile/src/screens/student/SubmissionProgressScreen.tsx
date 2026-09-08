import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Animated, Easing, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import axios from 'axios';
import { MaterialIcons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';

import { API_BASE_URL } from '../../config/api';
import { useAppTheme } from '../../context/ThemeContext';

type SubmissionStatus = 'queued' | 'ocr' | 'grading' | 'done' | 'rejected';

type SubmissionDetailResponse = {
  submission_id: string;
  processing_status: SubmissionStatus;
  feedback?: { overall_feedback?: string } | null;
};

type ProgressNavigation = {
  navigate: (screenName: string, params?: Record<string, unknown>) => void;
  goBack?: () => void;
};
type ProgressRoute = { params?: { submissionId?: string } };
type Props = { navigation: ProgressNavigation; route?: ProgressRoute };

type StepDefinition = {
  key: SubmissionStatus;
  title: string;
  subtitle: string;
  icon: keyof typeof MaterialIcons.glyphMap;
};

const STEP_FLOW: StepDefinition[] = [
  { key: 'queued',  title: 'Queued',   subtitle: 'Submission received',  icon: 'cloud-upload' },
  { key: 'ocr',     title: 'OCR',      subtitle: 'Reading handwriting',   icon: 'document-scanner' },
  { key: 'grading', title: 'Grading',  subtitle: 'AI writing feedback',   icon: 'auto-awesome' },
  { key: 'done',    title: 'Done',     subtitle: 'Evaluation ready',      icon: 'check-circle' },
];

const STATUS_INDEX: Record<SubmissionStatus, number> = {
  queued: 0, ocr: 1, grading: 2, done: 3, rejected: 2,
};

const HERO_INFO: Record<SubmissionStatus, { title: string; sub: string; icon: keyof typeof MaterialIcons.glyphMap }> = {
  queued:   { title: 'Submission received',   sub: 'Your work is in the queue. Grading will start shortly.',      icon: 'hourglass-empty' },
  ocr:      { title: 'Reading your work',     sub: 'AI is scanning your handwriting and extracting the text.',    icon: 'document-scanner' },
  grading:  { title: 'AI is evaluating…',     sub: 'Gyani is analysing your answers and preparing feedback.',      icon: 'auto-awesome' },
  done:     { title: 'Evaluation complete!',  sub: 'Your results are ready. Taking you to the report…',           icon: 'check-circle' },
  rejected: { title: 'Submission rejected',   sub: 'There was a problem with your submission. Please re-upload.', icon: 'cancel' },
};

// Grading can take 30-120s depending on handwriting complexity + AI load.
const TIMEOUT_MS = 120_000;

function getWebSocketBaseUrl() {
  if (API_BASE_URL.startsWith('https://')) return API_BASE_URL.replace('https://', 'wss://');
  if (API_BASE_URL.startsWith('http://'))  return API_BASE_URL.replace('http://',  'ws://');
  return API_BASE_URL;
}

function tryExtractStatus(payload: unknown): SubmissionStatus | null {
  if (!payload || typeof payload !== 'object') return null;
  const r = payload as Record<string, unknown>;
  const candidates = [
    r.processing_status, r.status,
    (r.data as Record<string, unknown> | undefined)?.processing_status,
    (r.data as Record<string, unknown> | undefined)?.status,
  ];
  const v = (candidates.find((c) => typeof c === 'string') as string | undefined)?.toLowerCase();
  if (v === 'queued' || v === 'ocr' || v === 'grading' || v === 'done' || v === 'rejected') return v;
  return null;
}

function tryExtractMessage(payload: unknown): string {
  if (!payload || typeof payload !== 'object') return 'Submission was rejected.';
  const r = payload as Record<string, unknown>;
  const candidates = [
    r.description, r.message,
    (r.data as Record<string, unknown> | undefined)?.description,
    (r.data as Record<string, unknown> | undefined)?.message,
  ];
  const m = candidates.find((c) => typeof c === 'string' && (c as string).trim().length > 0);
  return typeof m === 'string' ? m : 'Submission was rejected.';
}

export default function SubmissionProgressScreen({ navigation, route }: Props) {
  const submissionId = route?.params?.submissionId ?? '';
  const { theme } = useAppTheme();
  const c = theme.colors;

  const [status, setStatus] = useState<SubmissionStatus>('queued');
  const [bannerError, setBannerError] = useState<string | null>(null);
  const [isBusy, setIsBusy] = useState(true);
  const [hasTimedOut, setHasTimedOut] = useState(false);
  const [retrySeed, setRetrySeed] = useState(0);
  const [elapsed, setElapsed] = useState(0);

  const pollIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const timeoutRef     = useRef<ReturnType<typeof setTimeout>  | null>(null);
  const doneNavRef     = useRef<ReturnType<typeof setTimeout>  | null>(null);
  const elapsedRef     = useRef<ReturnType<typeof setInterval> | null>(null);
  const wsRef          = useRef<WebSocket | null>(null);
  const statusRef      = useRef<SubmissionStatus>('queued');
  const pulseAnim      = useRef(new Animated.Value(0)).current;
  const fadeAnim       = useRef(new Animated.Value(0)).current;

  const activeIndex = useMemo(() => STATUS_INDEX[status], [status]);
  const heroInfo    = HERO_INFO[status];

  // ── Entrance fade ──
  useEffect(() => {
    Animated.timing(fadeAnim, { toValue: 1, duration: 500, useNativeDriver: true }).start();
  }, []);

  // ── Pulse ring animation ──
  useEffect(() => {
    if (status === 'done' || status === 'rejected') {
      pulseAnim.stopAnimation(); pulseAnim.setValue(0); return;
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1, duration: 800, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 0, duration: 800, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [pulseAnim, status]);

  const applyStatus = (next: SubmissionStatus, message?: string) => {
    statusRef.current = next;
    setStatus(next);
    setIsBusy(false);
    setHasTimedOut(false);

    if (next === 'rejected') {
      if (timeoutRef.current)  { clearTimeout(timeoutRef.current);  timeoutRef.current  = null; }
      if (elapsedRef.current)  { clearInterval(elapsedRef.current); elapsedRef.current  = null; }
      setBannerError(message?.trim() || 'Submission was rejected. Please review and re-upload.');
      return;
    }

    setBannerError(null);

    if (next === 'done') {
      if (timeoutRef.current)  { clearTimeout(timeoutRef.current);  timeoutRef.current  = null; }
      if (elapsedRef.current)  { clearInterval(elapsedRef.current); elapsedRef.current  = null; }
      if (doneNavRef.current)  clearTimeout(doneNavRef.current);
      doneNavRef.current = setTimeout(() => {
        navigation.navigate('SubmissionResultScreen', { submissionId });
      }, 1500);
    }
  };

  useEffect(() => {
    let cancelled = false;

    const stopWorkers = () => {
      if (pollIntervalRef.current) { clearInterval(pollIntervalRef.current); pollIntervalRef.current = null; }
      if (timeoutRef.current)      { clearTimeout(timeoutRef.current);       timeoutRef.current      = null; }
      if (doneNavRef.current)      { clearTimeout(doneNavRef.current);        doneNavRef.current      = null; }
      if (elapsedRef.current)      { clearInterval(elapsedRef.current);       elapsedRef.current      = null; }
      if (wsRef.current)           { wsRef.current.close(); wsRef.current = null; }
    };

    const fetchStatus = async (token: string) => {
      try {
        const res = await axios.get<SubmissionDetailResponse>(
          `${API_BASE_URL}/api/students/submissions/${submissionId}`,
          { headers: { Authorization: `Bearer ${token}` } }
        );
        if (cancelled) return;
        const next = res.data?.processing_status;
        if (next) {
          const rejMsg = next === 'rejected' ? res.data?.feedback?.overall_feedback : undefined;
          applyStatus(next, rejMsg);
        }
      } catch {
        if (!cancelled) setIsBusy(false);
      }
    };

    const start = async () => {
      if (!submissionId) { setBannerError('Invalid submission id.'); setIsBusy(false); return; }
      const token = (await SecureStore.getItemAsync('access_token')) ?? (await SecureStore.getItemAsync('auth_token'));
      if (!token) { setBannerError('Authentication error. Please log in again.'); setIsBusy(false); return; }

      setBannerError(null);
      setHasTimedOut(false);
      setIsBusy(true);
      setElapsed(0);

      await fetchStatus(token);
      if (cancelled) return;

      // Elapsed timer
      elapsedRef.current = setInterval(() => setElapsed((e) => e + 1), 1000);

      // WebSocket (best-effort — polling is the guaranteed fallback)
      const wsBase = getWebSocketBaseUrl();
      const wsCandidates = [
        `${wsBase}/api/students/submissions/${submissionId}/ws?token=${encodeURIComponent(token)}`,
        `${wsBase}/api/students/ws/submissions/${submissionId}?token=${encodeURIComponent(token)}`,
      ];
      const bindSocket = (socket: WebSocket, allowFallback: boolean) => {
        wsRef.current = socket;
        socket.onmessage = (event) => {
          try {
            const payload = JSON.parse(event.data as string) as unknown;
            const next = tryExtractStatus(payload);
            if (!next) return;
            applyStatus(next, next === 'rejected' ? tryExtractMessage(payload) : undefined);
          } catch { /* rely on polling */ }
        };
        socket.onerror = () => {
          if (!allowFallback || cancelled) return;
          try { socket.close(); } catch { /**/ }
          bindSocket(new WebSocket(wsCandidates[1]), false);
        };
      };
      bindSocket(new WebSocket(wsCandidates[0]), true);

      // Poll every 5 s
      pollIntervalRef.current = setInterval(() => {
        if (statusRef.current === 'done' || statusRef.current === 'rejected') return;
        void fetchStatus(token);
      }, 5000);

      // Extended timeout — grading can take up to 2 min
      timeoutRef.current = setTimeout(() => {
        if (statusRef.current !== 'done' && statusRef.current !== 'rejected') {
          setHasTimedOut(true);
          setBannerError('Processing is taking longer than expected. You can wait or retry.');
          setIsBusy(false);
        }
      }, TIMEOUT_MS);
    };

    void start();
    return () => { cancelled = true; stopWorkers(); };
  }, [navigation, retrySeed, submissionId]);

  const pulseScale = pulseAnim.interpolate({ inputRange: [0, 1], outputRange: [1, 1.22] });
  const pulseOpacity = pulseAnim.interpolate({ inputRange: [0, 1], outputRange: [0.25, 0.6] });

  const elapsedStr = elapsed < 60 ? `${elapsed}s` : `${Math.floor(elapsed / 60)}m ${elapsed % 60}s`;

  return (
    <SafeAreaView style={[s.container, { backgroundColor: c.screen }]}>
      {/* ── Top bar ── */}
      <View style={[s.topBar, { backgroundColor: c.surface, borderBottomColor: c.border }]}>
        <TouchableOpacity
          style={[s.topIconBtn, { backgroundColor: c.primarySoft }]}
          activeOpacity={0.85}
          onPress={() => (navigation.goBack ? navigation.goBack() : navigation.navigate('CameraScreen'))}
        >
          <MaterialIcons name="close" size={20} color={c.primary} />
        </TouchableOpacity>
        <Text style={[s.brand, { color: c.primary }]}>Gyanavriksha</Text>
        <View style={[s.topIconBtn, { backgroundColor: c.surfaceMuted }]}>
          <MaterialIcons name="help-outline" size={20} color={c.muted} />
        </View>
      </View>

      <Animated.ScrollView
        style={{ opacity: fadeAnim }}
        contentContainerStyle={[s.scrollContent]}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Hero card ── */}
        <View style={[s.heroCard, { backgroundColor: c.primary }]}>
          <View style={s.heroOrb1} />
          <View style={s.heroOrb2} />
          <View style={s.heroInner}>
            {/* Animated icon circle */}
            <View style={s.heroIconWrap}>
              <Animated.View
                style={[
                  s.heroPulseRing,
                  { borderColor: 'rgba(255,255,255,0.35)', opacity: pulseOpacity, transform: [{ scale: pulseScale }] },
                ]}
              />
              <View style={[s.heroIconCircle, { backgroundColor: 'rgba(255,255,255,0.15)' }]}>
                <MaterialIcons
                  name={heroInfo.icon}
                  size={36}
                  color={status === 'done' ? '#4ADE80' : status === 'rejected' ? '#FCA5A5' : '#FFFFFF'}
                />
              </View>
            </View>
            <Text style={s.heroTitle}>{heroInfo.title}</Text>
            <Text style={s.heroSub}>{heroInfo.sub}</Text>
            {isBusy && status !== 'done' && (
              <View style={s.heroBusyRow}>
                <ActivityIndicator size="small" color="rgba(255,255,255,0.8)" />
                <Text style={s.heroBusyText}>Processing · {elapsedStr}</Text>
              </View>
            )}
            {!isBusy && status !== 'done' && status !== 'rejected' && (
              <Text style={s.heroBusyText}>{elapsedStr} elapsed</Text>
            )}
          </View>
        </View>

        {/* ── Step tracker ── */}
        <View style={[s.stepCard, { backgroundColor: c.surface, borderColor: c.border }]}>
          <Text style={[s.stepCardLabel, { color: c.muted }]}>Progress</Text>
          {STEP_FLOW.map((step, index) => {
            const isDone   = index < activeIndex || status === 'done';
            const isActive = index === activeIndex && status !== 'done' && status !== 'rejected';
            const isPending = index > activeIndex;

            return (
              <View key={step.key} style={s.stepRow}>
                {/* Marker column */}
                <View style={s.markerCol}>
                  <View
                    style={[
                      s.dot,
                      isDone  && { backgroundColor: c.primary, borderColor: c.primary },
                      isActive && { borderColor: c.primary, borderWidth: 2.5 },
                      isPending && { borderColor: c.border },
                    ]}
                  >
                    {isDone ? (
                      <MaterialIcons name="check" size={13} color="#FFFFFF" />
                    ) : isActive ? (
                      <Animated.View
                        style={[s.activeDot, { backgroundColor: c.primary, transform: [{ scale: pulseScale }] }]}
                      />
                    ) : null}
                  </View>
                  {/* Pulse ring on active step */}
                  {isActive && (
                    <Animated.View
                      style={[
                        s.stepPulseRing,
                        { borderColor: c.primary, opacity: pulseOpacity, transform: [{ scale: pulseScale }] },
                      ]}
                    />
                  )}
                  {index < STEP_FLOW.length - 1 && (
                    <View style={[s.connector, isDone && { backgroundColor: c.primary }, isPending && { backgroundColor: c.border }]} />
                  )}
                </View>

                {/* Content */}
                <View style={s.stepContent}>
                  <View style={s.stepTitleRow}>
                    <View style={[
                      s.stepIconCircle,
                      isDone  && { backgroundColor: `${c.primary}18` },
                      isActive && { backgroundColor: `${c.primary}22` },
                      isPending && { backgroundColor: c.surfaceMuted },
                    ]}>
                      <MaterialIcons
                        name={step.icon}
                        size={14}
                        color={isDone || isActive ? c.primary : c.inactive}
                      />
                    </View>
                    <Text style={[
                      s.stepTitle,
                      { color: isDone || isActive ? c.primary : c.muted },
                      isActive && { fontWeight: '900' },
                    ]}>
                      {step.title}
                    </Text>
                    {isDone && (
                      <View style={[s.donePill, { backgroundColor: `${c.primary}18` }]}>
                        <Text style={[s.donePillText, { color: c.primary }]}>Done</Text>
                      </View>
                    )}
                    {isActive && (
                      <View style={[s.activePill, { backgroundColor: `${c.primary}18` }]}>
                        <View style={[s.activePillDot, { backgroundColor: c.primary }]} />
                        <Text style={[s.activePillText, { color: c.primary }]}>Active</Text>
                      </View>
                    )}
                  </View>
                  <Text style={[s.stepSub, { color: c.muted }]}>{step.subtitle}</Text>
                </View>
              </View>
            );
          })}
        </View>

        {/* ── Stat row ── */}
        <View style={s.statRow}>
          {[
            { label: 'Status', value: status.charAt(0).toUpperCase() + status.slice(1), icon: 'speed' as const },
            { label: 'Stage', value: STEP_FLOW[Math.min(activeIndex, STEP_FLOW.length - 1)].title, icon: 'history-edu' as const },
            { label: 'Elapsed', value: elapsedStr, icon: 'timer' as const },
          ].map((stat) => (
            <View key={stat.label} style={[s.statCard, { backgroundColor: c.surface, borderColor: c.border }]}>
              <MaterialIcons name={stat.icon} size={16} color={c.muted} />
              <Text style={[s.statLabel, { color: c.caption }]}>{stat.label}</Text>
              <Text style={[s.statValue, { color: c.primary }]}>{stat.value}</Text>
            </View>
          ))}
        </View>

        {/* ── Pro tip ── */}
        <View style={[s.tipCard, { backgroundColor: c.surface, borderColor: c.border }]}>
          <View style={[s.tipIcon, { backgroundColor: c.primarySoft }]}>
            <MaterialIcons name="lightbulb-outline" size={18} color={c.primary} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[s.tipTitle, { color: c.primary }]}>Pro Tip</Text>
            <Text style={[s.tipText, { color: c.muted }]}>
              Grading typically takes 15–60 seconds. Complex handwriting or large files may take up to 2 minutes.
            </Text>
          </View>
        </View>

        {/* ── Error / timeout banner ── */}
        {bannerError && (
          <View style={s.errorBanner}>
            <MaterialIcons name="error-outline" size={18} color="#B91C1C" />
            <Text style={s.errorText}>{bannerError}</Text>
            {status === 'rejected' && (
              <TouchableOpacity style={s.retryBtn} activeOpacity={0.85} onPress={() => navigation.navigate('CameraScreen')}>
                <MaterialIcons name="camera-alt" size={15} color="#FFFFFF" />
                <Text style={s.retryBtnText}>Re-upload</Text>
              </TouchableOpacity>
            )}
            {hasTimedOut && (
              <TouchableOpacity
                style={[s.retryBtn, { backgroundColor: c.primary }]}
                activeOpacity={0.85}
                onPress={() => {
                  setStatus('queued'); statusRef.current = 'queued';
                  setBannerError(null); setIsBusy(true); setHasTimedOut(false); setElapsed(0);
                  setRetrySeed((n) => n + 1);
                }}
              >
                <MaterialIcons name="refresh" size={15} color="#FFFFFF" />
                <Text style={s.retryBtnText}>Retry</Text>
              </TouchableOpacity>
            )}
          </View>
        )}
      </Animated.ScrollView>

      {/* ── Bottom action ── */}
      <View style={[s.bottomBar, { backgroundColor: c.surface, borderTopColor: c.border }]}>
        <TouchableOpacity
          style={[s.cancelBtn, { borderColor: c.border }]}
          activeOpacity={0.85}
          onPress={() => navigation.navigate('CameraScreen')}
        >
          <MaterialIcons name="cancel" size={18} color={c.primary} />
          <Text style={[s.cancelBtnText, { color: c.primary }]}>Cancel Submission</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1 },

  topBar: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1,
  },
  topIconBtn: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  brand: { fontSize: 17, fontWeight: '900' },

  scrollContent: { paddingHorizontal: 16, paddingTop: 18, paddingBottom: 120, gap: 14 },

  // Hero
  heroCard: {
    borderRadius: 22, overflow: 'hidden', minHeight: 210,
    shadowOpacity: 0.22, shadowRadius: 16, shadowOffset: { width: 0, height: 8 }, elevation: 6,
  },
  heroOrb1: {
    position: 'absolute', top: -50, right: -50, width: 180, height: 180, borderRadius: 90,
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  heroOrb2: {
    position: 'absolute', bottom: -60, left: -40, width: 160, height: 160, borderRadius: 80,
    backgroundColor: 'rgba(0,0,0,0.08)',
  },
  heroInner: { flex: 1, alignItems: 'center', paddingVertical: 30, paddingHorizontal: 20, gap: 10 },
  heroIconWrap: { width: 100, height: 100, alignItems: 'center', justifyContent: 'center' },
  heroPulseRing: {
    position: 'absolute', width: 100, height: 100, borderRadius: 50, borderWidth: 2.5,
  },
  heroIconCircle: {
    width: 76, height: 76, borderRadius: 38, alignItems: 'center', justifyContent: 'center',
  },
  heroTitle: { color: '#FFFFFF', fontSize: 20, fontWeight: '900', textAlign: 'center', letterSpacing: -0.3 },
  heroSub: { color: 'rgba(255,255,255,0.72)', fontSize: 13, textAlign: 'center', lineHeight: 19, fontWeight: '500', paddingHorizontal: 8 },
  heroBusyRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 4 },
  heroBusyText: { color: 'rgba(255,255,255,0.65)', fontSize: 12, fontWeight: '700' },

  // Step card
  stepCard: {
    borderRadius: 18, borderWidth: 1, paddingHorizontal: 16, paddingTop: 12, paddingBottom: 16, gap: 6,
  },
  stepCardLabel: { fontSize: 10, fontWeight: '900', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 4 },

  stepRow: { flexDirection: 'row', alignItems: 'flex-start' },
  markerCol: { width: 32, alignItems: 'center', position: 'relative', paddingTop: 2 },
  dot: {
    width: 24, height: 24, borderRadius: 12, borderWidth: 2,
    alignItems: 'center', justifyContent: 'center', zIndex: 2,
    backgroundColor: 'transparent',
  },
  activeDot: { width: 10, height: 10, borderRadius: 5 },
  stepPulseRing: {
    position: 'absolute', top: -2, width: 28, height: 28, borderRadius: 14, borderWidth: 2, zIndex: 1,
  },
  connector: { width: 2, height: 48, marginTop: 4, backgroundColor: '#CBD5E1' },

  stepContent: { flex: 1, paddingLeft: 10, paddingBottom: 14, gap: 4 },
  stepTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  stepIconCircle: { width: 26, height: 26, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  stepTitle: { fontSize: 15, fontWeight: '700' },
  stepSub: { fontSize: 12, fontWeight: '500' },
  donePill: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 999 },
  donePillText: { fontSize: 10, fontWeight: '800' },
  activePill: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 2, borderRadius: 999 },
  activePillDot: { width: 5, height: 5, borderRadius: 2.5 },
  activePillText: { fontSize: 10, fontWeight: '800' },

  // Stats
  statRow: { flexDirection: 'row', gap: 10 },
  statCard: {
    flex: 1, borderWidth: 1, borderRadius: 14, padding: 12, gap: 4, alignItems: 'center',
  },
  statLabel: { fontSize: 9, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.6 },
  statValue: { fontSize: 14, fontWeight: '900' },

  // Tip
  tipCard: {
    borderWidth: 1, borderRadius: 14, padding: 14, flexDirection: 'row', gap: 12, alignItems: 'flex-start',
  },
  tipIcon: { width: 36, height: 36, borderRadius: 11, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  tipTitle: { fontSize: 13, fontWeight: '900', marginBottom: 3 },
  tipText: { fontSize: 12, lineHeight: 18, fontWeight: '500' },

  // Error
  errorBanner: {
    borderRadius: 14, borderWidth: 1, borderColor: '#FCA5A5', backgroundColor: '#FEF2F2',
    padding: 14, gap: 10, alignItems: 'flex-start',
  },
  errorText: { color: '#B91C1C', fontSize: 13, fontWeight: '700', flex: 1 },
  retryBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: '#B91C1C', borderRadius: 10, paddingHorizontal: 14, paddingVertical: 9,
  },
  retryBtnText: { color: '#FFFFFF', fontSize: 13, fontWeight: '800' },

  // Bottom bar
  bottomBar: {
    position: 'absolute', left: 0, right: 0, bottom: 0,
    borderTopWidth: 1, paddingHorizontal: 16, paddingVertical: 12,
  },
  cancelBtn: {
    minHeight: 48, borderRadius: 14, borderWidth: 1,
    alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 8,
  },
  cancelBtnText: { fontSize: 14, fontWeight: '800' },
});
