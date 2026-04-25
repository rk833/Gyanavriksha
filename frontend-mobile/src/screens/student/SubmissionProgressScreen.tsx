import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Animated, Easing, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import axios from 'axios';
import { MaterialIcons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';

import { API_BASE_URL } from '../../config/api';

type SubmissionStatus = 'queued' | 'ocr' | 'grading' | 'done' | 'rejected';

type SubmissionDetailResponse = {
  submission_id: string;
  processing_status: SubmissionStatus;
};

type ProgressNavigation = {
  navigate: (screenName: string, params?: Record<string, unknown>) => void;
  goBack?: () => void;
};

type ProgressRoute = {
  params?: {
    submissionId?: string;
  };
};

type SubmissionProgressScreenProps = {
  navigation: ProgressNavigation;
  route?: ProgressRoute;
};

type StepDefinition = {
  key: SubmissionStatus;
  title: string;
  subtitle: string;
};

const STEP_FLOW: StepDefinition[] = [
  { key: 'queued', title: 'Queued', subtitle: 'Submission received' },
  { key: 'ocr', title: 'OCR', subtitle: 'Reading handwriting' },
  { key: 'grading', title: 'Grading', subtitle: 'AI feedback' },
  { key: 'done', title: 'Done', subtitle: 'Evaluation ready' },
];

const STATUS_INDEX: Record<SubmissionStatus, number> = {
  queued: 0,
  ocr: 1,
  grading: 2,
  done: 3,
  rejected: 3,
};

const PROGRESS_BLUE = '#2563EB';
const MUTED_GRAY = '#CBD5E1';
const ERROR_RED = '#B91C1C';

function getWebSocketBaseUrl() {
  if (API_BASE_URL.startsWith('https://')) {
    return API_BASE_URL.replace('https://', 'wss://');
  }

  if (API_BASE_URL.startsWith('http://')) {
    return API_BASE_URL.replace('http://', 'ws://');
  }

  return API_BASE_URL;
}

function tryExtractStatus(payload: unknown): SubmissionStatus | null {
  if (!payload || typeof payload !== 'object') {
    return null;
  }

  const record = payload as Record<string, unknown>;
  const candidates = [
    record.processing_status,
    record.status,
    (record.data as Record<string, unknown> | undefined)?.processing_status,
    (record.data as Record<string, unknown> | undefined)?.status,
  ];

  const normalized = candidates.find((value) => typeof value === 'string');
  if (!normalized) {
    return null;
  }

  const value = normalized.toLowerCase();
  if (value === 'queued' || value === 'ocr' || value === 'grading' || value === 'done' || value === 'rejected') {
    return value;
  }

  return null;
}

function tryExtractMessage(payload: unknown): string {
  if (!payload || typeof payload !== 'object') {
    return 'Submission was rejected.';
  }

  const record = payload as Record<string, unknown>;
  const candidates = [
    record.description,
    record.message,
    (record.data as Record<string, unknown> | undefined)?.description,
    (record.data as Record<string, unknown> | undefined)?.message,
  ];

  const message = candidates.find((value) => typeof value === 'string' && value.trim().length > 0);
  return typeof message === 'string' ? message : 'Submission was rejected.';
}

export default function SubmissionProgressScreen({ navigation, route }: SubmissionProgressScreenProps) {
  const submissionId = route?.params?.submissionId ?? '';

  const [status, setStatus] = useState<SubmissionStatus>('queued');
  const [bannerError, setBannerError] = useState<string | null>(null);
  const [isBusy, setIsBusy] = useState(true);
  const [hasTimedOut, setHasTimedOut] = useState(false);
  const [retrySeed, setRetrySeed] = useState(0);

  const pollIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const doneNavRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const statusRef = useRef<SubmissionStatus>('queued');
  const pulseAnim = useRef(new Animated.Value(0)).current;

  const activeIndex = useMemo(() => STATUS_INDEX[status], [status]);
  const activeStep = STEP_FLOW[Math.min(activeIndex, STEP_FLOW.length - 1)];
  const statusLabel =
    status === 'queued'
      ? 'Queued'
      : status === 'ocr'
      ? 'Reading'
      : status === 'grading'
      ? 'Processing'
      : status === 'done'
      ? 'Completed'
      : 'Rejected';

  const applyStatus = (next: SubmissionStatus, message?: string) => {
    statusRef.current = next;
    setStatus(next);
    setIsBusy(false);

    if (next === 'rejected') {
      setBannerError(message?.trim() || 'Submission was rejected.');
      return;
    }

    setBannerError(null);

    if (next === 'done') {
      if (doneNavRef.current) {
        clearTimeout(doneNavRef.current);
      }

      doneNavRef.current = setTimeout(() => {
        navigation.navigate('SubmissionResultScreen', { submissionId });
      }, 1000);
    }
  };

  useEffect(() => {
    if (status === 'done' || status === 'rejected') {
      pulseAnim.stopAnimation();
      pulseAnim.setValue(0);
      return;
    }

    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 700,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 0,
          duration: 700,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ])
    );

    loop.start();

    return () => {
      loop.stop();
    };
  }, [pulseAnim, status]);

  useEffect(() => {
    let cancelled = false;

    const stopWorkers = () => {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
        pollIntervalRef.current = null;
      }

      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }

      if (doneNavRef.current) {
        clearTimeout(doneNavRef.current);
        doneNavRef.current = null;
      }

      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
    };

    const fetchStatus = async (token: string) => {
      try {
        const response = await axios.get<SubmissionDetailResponse>(`${API_BASE_URL}/api/students/submissions/${submissionId}`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        if (cancelled) {
          return;
        }

        const nextStatus = response.data?.processing_status;
        if (nextStatus) {
          applyStatus(nextStatus);
        }
      } catch {
        if (!cancelled) {
          setIsBusy(false);
        }
      }
    };

    const start = async () => {
      if (!submissionId) {
        setBannerError('Invalid submission id.');
        setIsBusy(false);
        return;
      }

      const token = (await SecureStore.getItemAsync('access_token')) ?? (await SecureStore.getItemAsync('auth_token'));
      if (!token) {
        setBannerError('Upload failed');
        setIsBusy(false);
        return;
      }

      setBannerError(null);
      setHasTimedOut(false);
      setIsBusy(true);

      await fetchStatus(token);

      if (cancelled) {
        return;
      }

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
            const nextStatus = tryExtractStatus(payload);
            if (!nextStatus) {
              return;
            }

            const maybeMessage = nextStatus === 'rejected' ? tryExtractMessage(payload) : undefined;
            applyStatus(nextStatus, maybeMessage);
          } catch {
            // Ignore malformed events and rely on polling fallback.
          }
        };

        socket.onerror = () => {
          if (!allowFallback || cancelled) {
            return;
          }

          try {
            socket.close();
          } catch {
            // Ignore close errors while switching websocket candidate URLs.
          }

          const fallbackSocket = new WebSocket(wsCandidates[1]);
          bindSocket(fallbackSocket, false);
        };
      };

      bindSocket(new WebSocket(wsCandidates[0]), true);

      pollIntervalRef.current = setInterval(() => {
        if (statusRef.current === 'done' || statusRef.current === 'rejected') {
          return;
        }

        void fetchStatus(token);
      }, 5000);

      timeoutRef.current = setTimeout(() => {
        if (statusRef.current !== 'done') {
          setHasTimedOut(true);
          setBannerError('Processing timeout. Please retry.');
          setIsBusy(false);
        }
      }, 30000);
    };

    void start();

    return () => {
      cancelled = true;
      stopWorkers();
    };
  }, [navigation, retrySeed, submissionId]);

  const pulseScale = pulseAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 1.18],
  });

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.topBar}>
        <TouchableOpacity
          style={styles.topIconButton}
          activeOpacity={0.85}
          onPress={() => (navigation.goBack ? navigation.goBack() : navigation.navigate('CameraScreen'))}
        >
          <MaterialIcons name="close" size={20} color="#123A5F" />
        </TouchableOpacity>

        <Text style={styles.brand}>Gyanavriksha</Text>

        <View style={styles.topIconButtonMuted}>
          <MaterialIcons name="help-outline" size={20} color="#94A3B8" />
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <Text style={styles.subtitle}>Active Step</Text>
          <Text style={styles.title}>{status === 'rejected' ? 'Submission Rejected' : activeStep.title}</Text>
        </View>

        <View style={styles.card}>
          {STEP_FLOW.map((step, index) => {
            const isDone = index <= activeIndex;
            const isActive = index === activeIndex && status !== 'done' && status !== 'rejected';

            return (
              <View key={step.key} style={styles.stepRow}>
                <View style={styles.stepMarkerColumn}>
                  <View style={[styles.dot, isDone ? styles.dotDone : null]}>
                    {isDone ? <MaterialIcons name="check" size={14} color="#FFFFFF" /> : null}
                  </View>

                  {isActive ? <Animated.View style={[styles.pulseRing, { transform: [{ scale: pulseScale }] }]} /> : null}

                  {index < STEP_FLOW.length - 1 ? (
                    <View style={[styles.connector, activeIndex > index ? styles.connectorDone : null]} />
                  ) : null}
                </View>

                <View style={styles.stepContent}>
                  <Text style={[styles.stepTitle, isDone ? styles.stepTitleDone : null]}>{step.title}</Text>
                  <Text style={styles.stepSubtitle}>{step.subtitle}</Text>
                </View>
              </View>
            );
          })}
        </View>

        <View style={styles.heroCard}>
          <View style={styles.heroCircleOuter}>
            <View style={styles.heroCircleInner}>
              <Animated.View style={{ transform: [{ scale: pulseScale }] }}>
                <MaterialIcons name="auto-awesome" size={34} color="#123A5F" />
              </Animated.View>
            </View>
          </View>
          <Text style={styles.heroText}>AI is evaluating your answer...</Text>
          {isBusy ? (
            <View style={styles.busyRow}>
              <ActivityIndicator color={PROGRESS_BLUE} />
              <Text style={styles.busyText}>Waiting for update...</Text>
            </View>
          ) : null}
        </View>

        <View style={styles.statGrid}>
          <View style={styles.statCard}>
            <MaterialIcons name="speed" size={18} color="#64748B" />
            <Text style={styles.statLabel}>Status</Text>
            <Text style={styles.statValue}>{statusLabel}</Text>
          </View>
          <View style={styles.statCard}>
            <MaterialIcons name="history-edu" size={18} color="#64748B" />
            <Text style={styles.statLabel}>Current Stage</Text>
            <Text style={styles.statValue}>{activeStep.title}</Text>
          </View>
        </View>

        <View style={styles.tipCard}>
          <View style={styles.tipIconWrap}>
            <MaterialIcons name="lightbulb-outline" size={18} color="#123A5F" />
          </View>
          <View style={styles.tipTextWrap}>
            <Text style={styles.tipTitle}>Pro Tip</Text>
            <Text style={styles.tipText}>Evaluation can take around 15 to 30 seconds depending on handwriting complexity.</Text>
          </View>
        </View>

        {bannerError ? (
          <View style={styles.errorBanner}>
            <Text style={styles.errorText}>{bannerError}</Text>
            {status === 'rejected' ? (
              <TouchableOpacity style={styles.secondaryButton} activeOpacity={0.85} onPress={() => navigation.navigate('CameraScreen')}>
                <Text style={styles.secondaryButtonText}>Go back</Text>
              </TouchableOpacity>
            ) : null}

            {hasTimedOut ? (
              <TouchableOpacity
                style={styles.primaryButton}
                activeOpacity={0.85}
                onPress={() => {
                  setRetrySeed((current) => current + 1);
                }}
              >
                <Text style={styles.primaryButtonText}>Retry</Text>
              </TouchableOpacity>
            ) : null}
          </View>
        ) : null}
      </ScrollView>

      <View style={styles.bottomActionWrap}>
        <TouchableOpacity style={styles.cancelButton} activeOpacity={0.85} onPress={() => navigation.navigate('CameraScreen')}>
          <MaterialIcons name="cancel" size={18} color="#123A5F" />
          <Text style={styles.cancelButtonText}>Cancel Submission</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F3F1EB',
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 8,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  topIconButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#EEF2FF',
  },
  topIconButtonMuted: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F8FAFC',
  },
  brand: {
    color: '#123A5F',
    fontSize: 18,
    fontWeight: '800',
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 110,
  },
  header: {
    gap: 2,
    marginBottom: 12,
  },
  title: {
    fontSize: 24,
    fontWeight: '800',
    color: '#123A5F',
  },
  subtitle: {
    fontSize: 11,
    textTransform: 'uppercase',
    letterSpacing: 1,
    color: '#64748B',
    fontWeight: '700',
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 16,
    gap: 8,
    marginBottom: 12,
  },
  stepRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  stepMarkerColumn: {
    width: 32,
    alignItems: 'center',
    position: 'relative',
  },
  dot: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: MUTED_GRAY,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 2,
  },
  dotDone: {
    borderColor: PROGRESS_BLUE,
    backgroundColor: PROGRESS_BLUE,
  },
  pulseRing: {
    position: 'absolute',
    top: -4,
    width: 30,
    height: 30,
    borderRadius: 15,
    borderWidth: 2,
    borderColor: PROGRESS_BLUE,
    opacity: 0.35,
    zIndex: 1,
  },
  connector: {
    width: 2,
    height: 46,
    backgroundColor: MUTED_GRAY,
    marginTop: 2,
  },
  connectorDone: {
    backgroundColor: PROGRESS_BLUE,
  },
  stepContent: {
    flex: 1,
    paddingLeft: 8,
    paddingBottom: 10,
  },
  stepTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#334155',
  },
  stepTitleDone: {
    color: PROGRESS_BLUE,
  },
  stepSubtitle: {
    marginTop: 2,
    fontSize: 13,
    color: '#64748B',
  },
  busyRow: {
    marginTop: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    justifyContent: 'center',
  },
  busyText: {
    fontSize: 13,
    color: '#334155',
    fontWeight: '600',
  },
  heroCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    paddingVertical: 20,
    paddingHorizontal: 16,
    alignItems: 'center',
    marginBottom: 12,
  },
  heroCircleOuter: {
    width: 132,
    height: 132,
    borderRadius: 66,
    borderWidth: 5,
    borderColor: '#DCE6F6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroCircleInner: {
    width: 106,
    height: 106,
    borderRadius: 53,
    borderWidth: 5,
    borderColor: '#123A5F',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F8FAFC',
  },
  heroText: {
    marginTop: 14,
    color: '#64748B',
    fontSize: 13,
    fontWeight: '600',
  },
  statGrid: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 12,
  },
  statCard: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 12,
    gap: 4,
  },
  statLabel: {
    fontSize: 10,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    color: '#64748B',
    fontWeight: '700',
  },
  statValue: {
    fontSize: 15,
    color: '#123A5F',
    fontWeight: '800',
  },
  tipCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 12,
    flexDirection: 'row',
    gap: 10,
  },
  tipIconWrap: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: '#EEF2FF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  tipTextWrap: {
    flex: 1,
  },
  tipTitle: {
    color: '#123A5F',
    fontSize: 13,
    fontWeight: '800',
  },
  tipText: {
    marginTop: 2,
    color: '#64748B',
    fontSize: 12,
    lineHeight: 18,
    fontWeight: '500',
  },
  errorBanner: {
    marginTop: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#FCA5A5',
    backgroundColor: '#FEF2F2',
    padding: 12,
    gap: 10,
  },
  errorText: {
    color: ERROR_RED,
    fontSize: 14,
    fontWeight: '700',
  },
  primaryButton: {
    minHeight: 44,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: PROGRESS_BLUE,
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '800',
  },
  secondaryButton: {
    minHeight: 44,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#FCA5A5',
    backgroundColor: '#FFFFFF',
  },
  secondaryButtonText: {
    color: ERROR_RED,
    fontSize: 14,
    fontWeight: '800',
  },
  bottomActionWrap: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  cancelButton: {
    minHeight: 48,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  cancelButtonText: {
    color: '#123A5F',
    fontSize: 14,
    fontWeight: '800',
  },
});
