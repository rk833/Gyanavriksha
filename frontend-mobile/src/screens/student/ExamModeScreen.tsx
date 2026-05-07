import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import Markdown from '@ronradtke/react-native-markdown-display';
import axios from 'axios';

import { useApi } from '../../hooks/useApi';
import { useAppTheme } from '../../context/ThemeContext';

// ─── Types ────────────────────────────────────────────────────────────────────

// Matches backend ExamSessionResponse
type ExamSessionStartResponse = {
  session_id: string;
  assignment_id: string;
  status: string;
  started_at?: string;
  ended_at?: string | null;
  exam_duration_minutes?: number | null;
  exam_duration_seconds?: number | null;
  pause_count?: number;
  total_paused_seconds?: number;
};

// Matches backend get_iot_status() response
type IoTDeviceRow = {
  status?: string;
  is_active?: boolean;
  device_label?: string | null;
  node_id?: string | null;
  latest_distance?: { distance_cm?: number | null; recorded_at?: string | null };
  latest_light?: { ldr_value?: number | null; recorded_at?: string | null };
};

type IoTStatusResponse = {
  devices: IoTDeviceRow[];
  device_count: number;
  latest_distance_cm?: number | null;
  latest_ldr_value?: number | null;
  latest_distance_at?: string | null;
  latest_ldr_at?: string | null;
};

type AssignmentExamDetail = {
  title?: string;
  description?: string | null;
  exam_duration_minutes?: number | null;
  exam_max_pauses?: number | null;
  exam_strict_proctor?: boolean;
  due_date?: string | null;
  subject_name?: string | null;
  grade_name?: string | null;
};

/** Canonical UI statuses (backend uses lowercase: active | paused | completed | terminated). */
type SessionStatus = 'starting' | 'ACTIVE' | 'PAUSED' | 'COMPLETED' | 'TERMINATED' | 'error';

type ExamModeScreenProps = {
  navigation: {
    navigate: (screen: string, params?: Record<string, unknown>) => void;
    goBack?: () => void;
  };
  route: {
    params?: {
      assignmentId?: string;
      assignmentTitle?: string;
    };
  };
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

function formatElapsed(seconds: number) {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

function normalizeExamSessionStatus(api: string | undefined | null): SessionStatus {
  const s = String(api ?? '').toLowerCase().trim();
  switch (s) {
    case 'active':
      return 'ACTIVE';
    case 'paused':
      return 'PAUSED';
    case 'completed':
      return 'COMPLETED';
    case 'terminated':
      return 'TERMINATED';
    default:
      return 'ACTIVE';
  }
}

function formatShortDate(iso?: string | null) {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString(undefined, { dateStyle: 'short', timeStyle: 'short' });
}

function sessionStatusLabel(s: SessionStatus, likelyDeskForfeit: boolean): string {
  switch (s) {
    case 'starting':
      return 'Starting…';
    case 'ACTIVE':
      return 'In Progress';
    case 'PAUSED':
      return 'Auto-Paused';
    case 'COMPLETED':
      return 'Completed';
    case 'TERMINATED':
      return likelyDeskForfeit ? 'Forfeited' : 'Ended';
    case 'error':
      return 'Error';
    default:
      return String(s);
  }
}

// ─── Pulse ring for status ────────────────────────────────────────────────────

function StatusRing({ color, active }: { color: string; active: boolean }) {
  const ring = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!active) return;
    const anim = Animated.loop(
      Animated.sequence([
        Animated.timing(ring, { toValue: 1, duration: 1200, useNativeDriver: true }),
        Animated.timing(ring, { toValue: 0, duration: 1200, useNativeDriver: true }),
      ])
    );
    anim.start();
    return () => anim.stop();
  }, [active, ring]);

  const scale = ring.interpolate({ inputRange: [0, 1], outputRange: [1, 1.5] });
  const opacity = ring.interpolate({ inputRange: [0, 1], outputRange: [0.6, 0] });

  return (
    <View style={styles.statusRingWrap}>
      {active && (
        <Animated.View
          style={[
            styles.statusRingOuter,
            { borderColor: color, transform: [{ scale }], opacity },
          ]}
        />
      )}
      <View style={[styles.statusRingInner, { backgroundColor: color }]} />
    </View>
  );
}

// ─── Screen ───────────────────────────────────────────────────────────────────

const IOT_POLL_MS = 5000;

export default function ExamModeScreen({ navigation, route }: ExamModeScreenProps) {
  const { post, get } = useApi();
  const { theme } = useAppTheme();

  const assignmentId = route.params?.assignmentId ?? '';
  const assignmentTitle = route.params?.assignmentTitle ?? 'Exam';

  const [sessionId, setSessionId] = useState<string | null>(null);
  const [sessionStatus, setSessionStatus] = useState<SessionStatus>('starting');
  const [pauseCount, setPauseCount] = useState(0);
  const [startError, setStartError] = useState<string | null>(null);
  const [assignmentDetail, setAssignmentDetail] = useState<AssignmentExamDetail | null>(null);
  const [assignmentLoadError, setAssignmentLoadError] = useState<string | null>(null);

  const examDurationMinutes = assignmentDetail?.exam_duration_minutes ?? null;
  const examMaxPauses = assignmentDetail?.exam_max_pauses ?? null;

  const isLikelyDeskForfeit = useMemo(() => {
    if (sessionStatus !== 'TERMINATED') return false;
    if (examMaxPauses != null && examMaxPauses >= 0) {
      return pauseCount >= examMaxPauses;
    }
    return false;
  }, [examMaxPauses, pauseCount, sessionStatus]);

  // Timer (wall-clock since session marked active/paused in this UI)
  const [elapsed, setElapsed] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // IoT
  const [iotConnected, setIotConnected] = useState<boolean | null>(null);
  const [deskStatus, setDeskStatus] = useState<string>('Unknown');
  const [distanceCm, setDistanceCm] = useState<number | null>(null);
  const [ldrValue, setLdrValue] = useState<number | null>(null);
  const [primaryDeviceLabel, setPrimaryDeviceLabel] = useState<string | null>(null);
  const prevSessionForTimer = useRef<string | null>(null);

  const loadAssignmentDetail = useCallback(async () => {
    if (!assignmentId) return;
    setAssignmentLoadError(null);
    try {
      const res = await get<AssignmentExamDetail>(`/api/students/assignments/${assignmentId}`);
      setAssignmentDetail(res);
    } catch {
      setAssignmentDetail(null);
      setAssignmentLoadError('Could not load exam rules for this assignment.');
    }
  }, [assignmentId, get]);

  // ── Start exam session ──

  const startSession = useCallback(async () => {
    if (!assignmentId) {
      setStartError('No assignment selected.');
      setSessionStatus('error');
      return;
    }

    setSessionStatus('starting');
    setStartError(null);

    try {
      const res = await post<ExamSessionStartResponse>(
        `/api/students/assignments/${assignmentId}/exam-session/start`
      );
      setSessionId(res.session_id);
      setSessionStatus(normalizeExamSessionStatus(res.status));
      if (res.pause_count != null) setPauseCount(res.pause_count);
    } catch (err) {
      setStartError(parseApiError(err, 'Could not start the exam session. Please try again.'));
      setSessionStatus('error');
    }
  }, [assignmentId, post]);

  // ── Poll IoT status ──

  const pollIoT = useCallback(async () => {
    try {
      const res = await get<IoTStatusResponse>('/api/students/iot/status');
      // Derive connection from device list
      const firstDevice = res.devices?.[0];
      setIotConnected(
        firstDevice?.is_active === true || firstDevice?.status === 'active' || res.device_count > 0
      );
      // Derive desk presence from distance: >80cm means away
      const dist = res.latest_distance_cm ?? null;
      setDistanceCm(dist);
      setDeskStatus(dist == null ? 'No data' : dist > 80 ? 'Away' : 'At Desk');
      const ldr = res.latest_ldr_value ?? null;
      setLdrValue(ldr);
      const prime = res.devices?.[0];
      const labelBits = [prime?.device_label, prime?.node_id].filter(Boolean);
      setPrimaryDeviceLabel(labelBits.length ? String(labelBits[0]) : null);
    } catch {
      setIotConnected(false);
      setPrimaryDeviceLabel(null);
    }
  }, [get]);

  // ── Lifecycle ──

  useEffect(() => {
    void Promise.all([loadAssignmentDetail(), startSession()]);
  }, [loadAssignmentDetail, startSession]);

  useEffect(() => {
    prevSessionForTimer.current = null;
  }, [assignmentId]);

  useEffect(() => {
    if (!sessionId) return;
    if (prevSessionForTimer.current !== sessionId) {
      prevSessionForTimer.current = sessionId;
      setElapsed(0);
    }
  }, [sessionId]);

  useEffect(() => {
    if (sessionStatus !== 'ACTIVE' && sessionStatus !== 'PAUSED') return undefined;

    timerRef.current = setInterval(() => {
      setElapsed((prev) => prev + 1);
    }, 1000);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [sessionStatus]);

  useEffect(() => {
    if (sessionStatus === 'error' || sessionStatus === 'starting') return;

    void pollIoT();
    const iotTimer = setInterval(() => void pollIoT(), IOT_POLL_MS);
    return () => clearInterval(iotTimer);
  }, [pollIoT, sessionStatus]);

  // ── Resume paused session ──

  const resumeSession = useCallback(async () => {
    if (!sessionId) return;
    try {
      const res = await post<ExamSessionStartResponse>(`/api/students/exam-sessions/${sessionId}/resume`);
      setSessionStatus(normalizeExamSessionStatus(res.status));
      if (res.pause_count != null) setPauseCount(res.pause_count);
    } catch (err) {
      Alert.alert('Resume failed', parseApiError(err, 'Could not resume the exam session.'));
    }
  }, [post, sessionId]);

  // ── Terminate session ──

  const terminateSession = useCallback(() => {
    Alert.alert(
      'Exit Exam',
      'Are you sure you want to exit this exam? Your progress will be recorded as terminated.',
      [
        { text: 'Stay', style: 'cancel' },
        {
          text: 'Exit',
          style: 'destructive',
          onPress: async () => {
            if (sessionId) {
              try {
                await post(`/api/students/exam-sessions/${sessionId}/terminate`);
              } catch {
                // Best effort
              }
            }
            if (navigation.goBack) {
              navigation.goBack();
            } else {
              navigation.navigate('Home');
            }
          },
        },
      ]
    );
  }, [navigation, post, sessionId]);

  // ── Go to camera ──

  const goToCamera = useCallback(() => {
    if (sessionStatus !== 'ACTIVE') {
      Alert.alert(
        'Cannot submit now',
        sessionStatus === 'PAUSED'
          ? 'Your exam is paused due to desk absence. Return to your desk to resume.'
          : 'The exam session is no longer active.'
      );
      return;
    }

    navigation.navigate('CameraScreen', {
      assignmentId,
      examSessionId: sessionId,
    });
  }, [assignmentId, navigation, sessionId, sessionStatus]);

  // ── Status helpers ──

  const statusColor: Record<SessionStatus, string> = {
    starting: '#64748B',
    ACTIVE: '#15803D',
    PAUSED: '#B45309',
    COMPLETED: '#15803D',
    TERMINATED: '#B91C1C',
    error: '#B91C1C',
  };

  const isActive = sessionStatus === 'ACTIVE';
  const isPaused = sessionStatus === 'PAUSED';
  const isEnded = sessionStatus === 'TERMINATED' || sessionStatus === 'COMPLETED' || sessionStatus === 'error';

  const deskColor =
    deskStatus.toLowerCase() === 'away' || deskStatus.toLowerCase() === 'absent'
      ? '#B91C1C'
      : '#15803D';

  return (
    <SafeAreaView
      style={[styles.safeArea, { backgroundColor: theme.colors.screen }]}
      edges={['top', 'left', 'right']}
    >
      {/* Header */}
      <View
        style={[
          styles.header,
          { backgroundColor: theme.colors.surface, borderBottomColor: theme.colors.border },
        ]}
      >
        <TouchableOpacity
          style={[styles.headerBack, { backgroundColor: theme.colors.primarySoft }]}
          onPress={terminateSession}
          activeOpacity={0.8}
        >
          <MaterialIcons name="close" size={18} color={theme.colors.primary} />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={[styles.headerTitle, { color: theme.colors.primary }]} numberOfLines={1}>
            {assignmentTitle}
          </Text>
          <Text style={[styles.headerSub, { color: theme.colors.muted }]}>Exam Mode</Text>
        </View>
        <View style={[styles.statusBadge, { backgroundColor: `${statusColor[sessionStatus] ?? '#64748B'}18` }]}>
          <StatusRing color={statusColor[sessionStatus] ?? '#64748B'} active={isActive} />
          <Text style={[styles.statusBadgeText, { color: statusColor[sessionStatus] ?? '#64748B' }]}>
            {sessionStatusLabel(sessionStatus, isLikelyDeskForfeit)}
          </Text>
        </View>
      </View>

      <ScrollView
        style={styles.bodyScroll}
        contentContainerStyle={styles.bodyScrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Starting / Error */}
        {sessionStatus === 'starting' && (
          <View style={styles.centerState}>
            <ActivityIndicator size="large" color={theme.colors.primary} />
            <Text style={[styles.centerStateText, { color: theme.colors.muted }]}>
              Starting your exam session…
            </Text>
          </View>
        )}

        {sessionStatus === 'error' && (
          <View style={styles.centerState}>
            <MaterialIcons name="error-outline" size={48} color="#B91C1C" />
            <Text style={styles.errorTitle}>Could not start exam</Text>
            <Text style={styles.errorBody}>{startError}</Text>
            <TouchableOpacity
              style={[styles.retryButton, { backgroundColor: theme.colors.primary }]}
              onPress={() => void startSession()}
              activeOpacity={0.85}
            >
              <Text style={styles.retryButtonText}>Try Again</Text>
            </TouchableOpacity>
          </View>
        )}

        {(isActive || isPaused || isEnded) && sessionStatus !== 'error' && (
          <>
            {assignmentLoadError ? (
              <Text style={[styles.warnInline, { color: theme.colors.muted }]}>{assignmentLoadError}</Text>
            ) : null}

            {/* Assignment exam rules — parity with frontend-web */}
            {(examDurationMinutes != null || examMaxPauses != null || assignmentDetail?.exam_strict_proctor) && (
              <View style={[styles.rulesChipsRow, { borderColor: theme.colors.border }]}>
                {examDurationMinutes != null ? (
                  <View style={[styles.ruleChip, { backgroundColor: theme.colors.primarySoft }]}>
                    <MaterialIcons name="schedule" size={14} color={theme.colors.primary} />
                    <Text style={[styles.ruleChipText, { color: theme.colors.primary }]}>
                      Time limit {examDurationMinutes} min
                    </Text>
                  </View>
                ) : null}
                {examMaxPauses != null ? (
                  <View style={[styles.ruleChip, { backgroundColor: theme.colors.primarySoft }]}>
                    <MaterialIcons name="pause-circle-outline" size={14} color={theme.colors.primary} />
                    <Text style={[styles.ruleChipText, { color: theme.colors.primary }]}>
                      Pauses allowed {examMaxPauses}
                    </Text>
                  </View>
                ) : null}
                {assignmentDetail?.exam_strict_proctor ? (
                  <View style={styles.ruleChipStrict}>
                    <MaterialIcons name="shield" size={14} color="#92400E" />
                    <Text style={styles.ruleChipStrictText}>Strict proctoring</Text>
                  </View>
                ) : null}
              </View>
            )}

            <View style={styles.beforeYouBegin}>
              <View style={styles.beforeYouBeginHead}>
                <MaterialIcons name="shield" size={18} color="#92400E" />
                <Text style={styles.beforeYouBeginTitle}>Before you begin</Text>
              </View>
              <Text style={styles.beforeYouBeginBullet}>• IoT desk monitor: staying away (&gt;80 cm) triggers auto-pause after consecutive readings.</Text>
              <Text style={styles.beforeYouBeginBullet}>
                • {examMaxPauses != null
                  ? `You can be auto-paused up to ${examMaxPauses} time${examMaxPauses === 1 ? '' : 's'} — then your attempt stops for integrity.`
                  : 'If your instructor capped pauses, additional absences end your attempt.'}
              </Text>
              <Text style={styles.beforeYouBeginBullet}>
                • Submit JPG, PNG, or PDF — max 5 files, 10 MB each (use camera flow below).
              </Text>
            </View>

            {assignmentDetail?.description?.trim() ? (
              <View style={[styles.instructionsCard, { borderColor: theme.colors.border, backgroundColor: theme.colors.surface }]}>
                <View style={styles.instructionsHeadingRow}>
                  <MaterialIcons name="format-list-numbered" size={16} color={theme.colors.primary} />
                  <Text style={[styles.instructionsHeading, { color: theme.colors.primary }]}>
                    Questions & instructions
                  </Text>
                </View>
                <Markdown style={{ body: { color: theme.colors.text, fontSize: 13, lineHeight: 20 } }}>
                  {assignmentDetail.description.trim()}
                </Markdown>
              </View>
            ) : null}

            {/* Timer */}
            <View style={[styles.timerCard, { backgroundColor: theme.colors.primary }]}>
              <View style={styles.timerGlow} />
              <Text style={styles.timerLabel}>Elapsed Time</Text>
              <Text style={styles.timerValue}>{formatElapsed(elapsed)}</Text>
              <View style={styles.timerFooterRow}>
                {examDurationMinutes != null ? (
                  <Text style={styles.timerFootnote}>Allowed: {examDurationMinutes} min</Text>
                ) : null}
                {examMaxPauses != null ? (
                  <Text style={styles.timerFootnote}>
                    Pauses used: {pauseCount}/{examMaxPauses}
                  </Text>
                ) : pauseCount > 0 ? (
                  <Text style={styles.timerFootnote}>Auto-pauses used: {pauseCount}</Text>
                ) : null}
              </View>
              {(assignmentDetail?.due_date ?? null) && sessionStatus !== 'TERMINATED' && sessionStatus !== 'COMPLETED' ? (
                <Text style={[styles.timerDue, { color: 'rgba(255,255,255,0.85)' }]}>
                  Due {formatShortDate(assignmentDetail.due_date)}
                </Text>
              ) : null}
            </View>

            {/* Pause banner */}
            {isPaused && (
              <View style={styles.pauseBanner}>
                <MaterialIcons name="warning" size={22} color="#B45309" />
                <View style={styles.pauseBannerText}>
                  <Text style={styles.pauseBannerTitle}>Exam Auto-Paused</Text>
                  <Text style={styles.pauseBannerBody}>
                    You were detected away from your desk. Return to your seat and tap Resume.
                  </Text>
                </View>
              </View>
            )}

            {/* Terminated / forfeit */}
            {sessionStatus === 'TERMINATED' && (
              <View style={styles.forfeitBanner}>
                <MaterialIcons name="block" size={22} color="#B91C1C" />
                <View style={styles.pauseBannerText}>
                  <Text style={styles.forfeitBannerTitle}>{isLikelyDeskForfeit ? 'Exam forfeited' : 'Exam ended'}</Text>
                  <Text style={styles.forfeitBannerBody}>
                    {isLikelyDeskForfeit
                      ? 'Desk monitoring reported repeated absence with no pauses remaining. This attempt stopped for academic integrity.'
                      : 'This session ended. If you exited early, your attempt may already count as used — ask your instructor if unsure.'}
                  </Text>
                </View>
              </View>
            )}

            {sessionStatus === 'COMPLETED' && (
              <View style={[styles.completeBanner, { borderColor: theme.colors.border }]}>
                <MaterialIcons name="task-alt" size={22} color="#15803D" />
                <View style={styles.pauseBannerText}>
                  <Text style={styles.completeBannerTitle}>Exam completed</Text>
                  <Text style={[styles.completeBannerBody, { color: theme.colors.muted }]}>
                    Submission received. You can leave this screen.
                  </Text>
                </View>
              </View>
            )}

            {/* IoT mini panel */}
            <View
              style={[
                styles.iotPanel,
                { backgroundColor: theme.colors.surface, borderColor: theme.colors.border },
              ]}
            >
              <View style={styles.iotPanelHeader}>
                <MaterialIcons name="sensors" size={16} color={theme.colors.primary} />
                <Text style={[styles.iotPanelTitle, { color: theme.colors.primary }]}>
                  Smart Desk Monitor
                </Text>
                <View
                  style={[
                    styles.iotConnBadge,
                    { backgroundColor: iotConnected === false ? '#FEE2E2' : '#DCFCE7' },
                  ]}
                >
                  <Text
                    style={[
                      styles.iotConnText,
                      { color: iotConnected === false ? '#B91C1C' : '#15803D' },
                    ]}
                  >
                    {iotConnected === false ? 'Offline' : 'Online'}
                  </Text>
                </View>
              </View>
              {primaryDeviceLabel ? (
                <Text style={[styles.iotDeviceCaption, { color: theme.colors.muted }]}>Device: {primaryDeviceLabel}</Text>
              ) : null}
              <View style={styles.iotPanelRow}>
                <View style={styles.iotStat}>
                  <MaterialIcons name="accessibility-new" size={16} color={deskColor} />
                  <View>
                    <Text style={[styles.iotStatLabel, { color: theme.colors.muted }]}>Presence</Text>
                    <Text style={[styles.iotStatValue, { color: deskColor }]}>{deskStatus}</Text>
                  </View>
                </View>
                {distanceCm != null && (
                  <View style={styles.iotStat}>
                    <MaterialIcons name="straighten" size={16} color={theme.colors.primary} />
                    <View>
                      <Text style={[styles.iotStatLabel, { color: theme.colors.muted }]}>Distance</Text>
                      <Text style={[styles.iotStatValue, { color: theme.colors.primary }]}>
                        {distanceCm} cm
                      </Text>
                    </View>
                  </View>
                )}
              </View>
              {ldrValue != null && (
                <View style={[styles.iotLdrRow, { borderTopColor: theme.colors.border }]}>
                  <MaterialIcons name="brightness-6" size={16} color={theme.colors.primary} />
                  <View>
                    <Text style={[styles.iotStatLabel, { color: theme.colors.muted }]}>Ambient (LDR)</Text>
                    <Text style={[styles.iotStatValue, { color: theme.colors.primary }]}>{ldrValue}</Text>
                  </View>
                </View>
              )}
              <Text style={[styles.iotHelp, { color: theme.colors.muted }]}>
                &gt;80 cm away consistently triggers auto-pause; further absences beyond your pause limit stop the exam.
              </Text>
            </View>

            {/* Action buttons */}
            <View style={styles.actions}>
              {isPaused && (
                <TouchableOpacity
                  style={[styles.resumeButton, { backgroundColor: '#15803D' }]}
                  activeOpacity={0.85}
                  onPress={() => void resumeSession()}
                >
                  <MaterialIcons name="play-arrow" size={22} color="#FFFFFF" />
                  <Text style={styles.resumeButtonText}>Resume Exam</Text>
                </TouchableOpacity>
              )}

              {isActive && (
                <TouchableOpacity
                  style={[styles.cameraButton, { backgroundColor: theme.colors.primary }]}
                  activeOpacity={0.85}
                  onPress={goToCamera}
                >
                  <MaterialIcons name="photo-camera" size={22} color="#FFFFFF" />
                  <Text style={styles.cameraButtonText}>Take Photo to Submit</Text>
                </TouchableOpacity>
              )}

              {isEnded && sessionStatus !== 'error' && (
                <TouchableOpacity
                  style={[styles.doneButton, { borderColor: theme.colors.border }]}
                  activeOpacity={0.85}
                  onPress={() => {
                    if (navigation.goBack) navigation.goBack();
                    else navigation.navigate('Home');
                  }}
                >
                  <Text style={[styles.doneButtonText, { color: theme.colors.primary }]}>
                    Return to Home
                  </Text>
                </TouchableOpacity>
              )}

              {(isActive || isPaused) && sessionStatus !== 'TERMINATED' && sessionStatus !== 'COMPLETED' && (
                <TouchableOpacity
                  style={[styles.exitButton, { borderColor: '#FECACA' }]}
                  activeOpacity={0.85}
                  onPress={terminateSession}
                >
                  <MaterialIcons name="exit-to-app" size={18} color="#B91C1C" />
                  <Text style={styles.exitButtonText}>Exit Exam</Text>
                </TouchableOpacity>
              )}
            </View>

            {sessionId && (
              <Text style={[styles.sessionIdText, { color: theme.colors.muted }]}>
                Session ID: {sessionId.slice(0, 12)}…
              </Text>
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
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderBottomWidth: 1,
    gap: 10,
  },
  headerBack: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerCenter: { flex: 1 },
  headerTitle: { fontSize: 15, fontWeight: '800' },
  headerSub: { fontSize: 11, marginTop: 1 },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  statusBadgeText: { fontSize: 11, fontWeight: '800' },
  statusRingWrap: {
    width: 10,
    height: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statusRingOuter: {
    position: 'absolute',
    width: 14,
    height: 14,
    borderRadius: 7,
    borderWidth: 1.5,
  },
  statusRingInner: { width: 8, height: 8, borderRadius: 4 },
  // Center states
  bodyScroll: { flex: 1 },
  bodyScrollContent: {
    flexGrow: 1,
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 36,
    gap: 14,
  },
  warnInline: { fontSize: 12, textAlign: 'center', lineHeight: 18 },
  rulesChipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    borderWidth: 1,
    borderRadius: 12,
    padding: 10,
  },
  ruleChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  ruleChipText: { fontSize: 11, fontWeight: '700' },
  ruleChipStrict: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: '#FEF3C7',
    borderWidth: 1,
    borderColor: '#FDE68A',
  },
  ruleChipStrictText: { fontSize: 11, fontWeight: '700', color: '#92400E' },
  beforeYouBegin: {
    backgroundColor: '#FFFBEB',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#FDE68A',
    padding: 14,
    gap: 8,
  },
  beforeYouBeginHead: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 2 },
  beforeYouBeginTitle: { fontSize: 15, fontWeight: '800', color: '#78350F' },
  beforeYouBeginBullet: { fontSize: 12, color: '#78350F', lineHeight: 18 },
  instructionsCard: { borderRadius: 14, borderWidth: 1, padding: 14, gap: 10 },
  instructionsHeadingRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  instructionsHeading: { fontSize: 12, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.6 },
  timerFooterRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 10,
    marginTop: 4,
  },
  timerFootnote: { color: 'rgba(255,255,255,0.82)', fontSize: 11, fontWeight: '600' },
  timerDue: { fontSize: 11, fontWeight: '600', marginTop: 6, textAlign: 'center' },
  completeBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    backgroundColor: '#F0FDF4',
    borderWidth: 1,
    borderRadius: 14,
    padding: 14,
  },
  completeBannerTitle: { fontSize: 14, fontWeight: '800', color: '#15803D' },
  completeBannerBody: { fontSize: 12, lineHeight: 18 },
  iotDeviceCaption: { fontSize: 11, fontWeight: '600', marginTop: -2 },
  iotLdrRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingTop: 10,
    borderTopWidth: 1,
  },
  iotHelp: { fontSize: 10, lineHeight: 14, marginTop: 4 },
  centerState: { minHeight: 280, alignItems: 'center', justifyContent: 'center', gap: 16 },
  centerStateText: { fontSize: 14 },
  errorTitle: { fontSize: 18, fontWeight: '800', color: '#B91C1C' },
  errorBody: { fontSize: 13, color: '#7C2D12', textAlign: 'center', lineHeight: 20 },
  retryButton: { borderRadius: 12, paddingVertical: 12, paddingHorizontal: 24 },
  retryButtonText: { color: '#FFFFFF', fontSize: 14, fontWeight: '800' },
  // Timer
  timerCard: {
    borderRadius: 18,
    padding: 22,
    alignItems: 'center',
    overflow: 'hidden',
    gap: 8,
  },
  timerGlow: {
    position: 'absolute',
    top: -40,
    left: -40,
    width: 140,
    height: 140,
    borderRadius: 70,
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  timerLabel: {
    color: 'rgba(255,255,255,0.75)',
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  timerValue: { color: '#FFFFFF', fontSize: 52, fontWeight: '800', letterSpacing: 2 },
  pausePillRow: { flexDirection: 'row', justifyContent: 'center' },
  pausePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  pausePillText: { color: 'rgba(255,255,255,0.85)', fontSize: 12, fontWeight: '600' },
  // Banners
  pauseBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    backgroundColor: '#FEF3C7',
    borderWidth: 1,
    borderColor: '#FDE68A',
    borderRadius: 14,
    padding: 14,
  },
  forfeitBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    backgroundColor: '#FEE2E2',
    borderWidth: 1,
    borderColor: '#FECACA',
    borderRadius: 14,
    padding: 14,
  },
  pauseBannerText: { flex: 1, gap: 4 },
  pauseBannerTitle: { fontSize: 14, fontWeight: '800', color: '#B45309' },
  pauseBannerBody: { fontSize: 12, color: '#92400E', lineHeight: 18 },
  forfeitBannerTitle: { fontSize: 14, fontWeight: '800', color: '#B91C1C' },
  forfeitBannerBody: { fontSize: 12, color: '#7F1D1D', lineHeight: 18 },
  // IoT panel
  iotPanel: {
    borderWidth: 1,
    borderRadius: 14,
    padding: 14,
    gap: 10,
  },
  iotPanelHeader: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  iotPanelTitle: { flex: 1, fontSize: 12, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.6 },
  iotConnBadge: { borderRadius: 999, paddingHorizontal: 8, paddingVertical: 3 },
  iotConnText: { fontSize: 10, fontWeight: '800' },
  iotPanelRow: { flexDirection: 'row', gap: 20 },
  iotStat: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  iotStatLabel: { fontSize: 10, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5 },
  iotStatValue: { fontSize: 16, fontWeight: '800', marginTop: 1 },
  // Actions
  actions: { gap: 10 },
  resumeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    borderRadius: 14,
    paddingVertical: 15,
  },
  resumeButtonText: { color: '#FFFFFF', fontSize: 16, fontWeight: '800' },
  cameraButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    borderRadius: 14,
    paddingVertical: 15,
  },
  cameraButtonText: { color: '#FFFFFF', fontSize: 16, fontWeight: '800' },
  doneButton: {
    borderWidth: 1,
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
  },
  doneButtonText: { fontSize: 15, fontWeight: '800' },
  exitButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderWidth: 1,
    borderRadius: 14,
    paddingVertical: 12,
  },
  exitButtonText: { color: '#B91C1C', fontSize: 14, fontWeight: '700' },
  sessionIdText: { fontSize: 10, textAlign: 'center', marginTop: 4 },
});
