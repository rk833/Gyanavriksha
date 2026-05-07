import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  Easing,
  Image,
  PanResponder,
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
import { appTypography } from '../../theme/typography';

// ─── Types ─────────────────────────────────────────────────────────────────────

type DashboardRecord = Record<string, unknown>;

type DashboardResponse = {
  student_name: string;
  current_subject: DashboardRecord | null;
  enrolled_subjects: DashboardRecord[];
  recent_submissions: DashboardRecord[];
  total_submissions: number;
  average_score: number | null;
  knowledge_gaps_count: number;
  upcoming_assignments: DashboardRecord[];
  notifications_unread_count: number;
};

type DeskVitals = {
  ldr: string;
  posture: string;
  distance: string;
  isOnline: boolean;
};

type Props = {
  navigation?: {
    navigate: (screenName: string, params?: Record<string, unknown>) => void;
    getState?: () => { routeNames?: string[] };
  };
};

// ─── Helpers ───────────────────────────────────────────────────────────────────

function getString(record: DashboardRecord | null | undefined, keys: string[], fallback = '') {
  if (!record) return fallback;
  for (const key of keys) {
    const v = record[key];
    if (typeof v === 'string' && v.trim()) return v;
  }
  return fallback;
}

function getNumber(record: DashboardRecord | null | undefined, keys: string[], fallback = 0): number {
  if (!record) return fallback;
  for (const key of keys) {
    const v = record[key];
    if (typeof v === 'number' && !Number.isNaN(v)) return v;
    if (typeof v === 'string' && v.trim() !== '') {
      const n = Number(v);
      if (!Number.isNaN(n)) return n;
    }
  }
  return fallback;
}

function getSubjectId(record: DashboardRecord): number | null {
  const v = record.subject_id;
  if (typeof v === 'number' && !Number.isNaN(v)) return v;
  if (typeof v === 'string' && v.trim() !== '') {
    const n = parseInt(v, 10);
    return Number.isNaN(n) ? null : n;
  }
  return null;
}

function formatDue(rawValue: unknown) {
  if (typeof rawValue !== 'string' || !rawValue) return '';
  const d = new Date(rawValue);
  if (isNaN(d.getTime())) return rawValue;
  const diff = Math.ceil((d.getTime() - Date.now()) / 86400000);
  if (diff === 0) return 'Due today';
  if (diff === 1) return 'Due tomorrow';
  if (diff < 0) return 'Overdue';
  return `Due in ${diff} days`;
}

function greetingByHour() {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}

function scoreColor(score: number | null) {
  if (score == null) return '#64748B';
  if (score >= 75) return '#15803D';
  if (score >= 50) return '#B45309';
  return '#B91C1C';
}

// ─── Skeleton ──────────────────────────────────────────────────────────────────

function Skeleton({ width, height, radius = 8 }: { width: number | `${number}%`; height: number; radius?: number }) {
  const { theme } = useAppTheme();
  const pulse = useRef(new Animated.Value(0.4)).current;
  useEffect(() => {
    const anim = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 0.85, duration: 800, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0.4, duration: 800, useNativeDriver: true }),
      ])
    );
    anim.start();
    return () => anim.stop();
  }, []);
  return <Animated.View style={{ width, height, borderRadius: radius, backgroundColor: theme.colors.border, opacity: pulse }} />;
}

// ─── Animated stat counter ─────────────────────────────────────────────────────

function AnimatedNumber({ value, suffix = '', color }: { value: number; suffix?: string; color: string }) {
  const anim = useRef(new Animated.Value(0)).current;
  const [display, setDisplay] = useState(0);
  useEffect(() => {
    anim.setValue(0);
    Animated.timing(anim, {
      toValue: value,
      duration: 900,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start();
    const id = anim.addListener(({ value: v }) => setDisplay(Math.round(v)));
    return () => anim.removeListener(id);
  }, [value]);
  return (
    <Text style={[appTypography.statNumber, { color }]}>
      {display}
      {suffix}
    </Text>
  );
}

// ─── Screen ────────────────────────────────────────────────────────────────────

export default function DashboardScreen({ navigation }: Props) {
  const { get } = useApi();
  const { theme } = useAppTheme();
  const { telemetryTick, lastTelemetry } = useStudentIotRealtime();

  const [dashboard, setDashboard] = useState<DashboardResponse | null>(null);
  const [deskVitals, setDeskVitals] = useState<DeskVitals>({ ldr: '—', posture: '—', distance: '—', isOnline: false });
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [selectedSubjectId, setSelectedSubjectId] = useState<number | null>(null);

  /** Match web dashboard: prioritize subjects with the most remaining work first. */
  const sortedSubjects = useMemo(() => {
    const subs = (dashboard?.enrolled_subjects ?? []) as DashboardRecord[];
    return [...subs].sort(
      (a, b) => getNumber(a, ['completion_percentage'], 0) - getNumber(b, ['completion_percentage'], 0),
    );
  }, [dashboard?.enrolled_subjects]);

  useEffect(() => {
    if (!sortedSubjects.length) {
      setSelectedSubjectId(null);
      return;
    }
    const ids = sortedSubjects.map(getSubjectId).filter((id): id is number => id != null);
    setSelectedSubjectId((prev) => {
      if (prev != null && ids.includes(prev)) return prev;
      return ids[0] ?? null;
    });
  }, [sortedSubjects]);

  const selectedSubject = useMemo(() => {
    if (selectedSubjectId == null) return null;
    return sortedSubjects.find((s) => getSubjectId(s) === selectedSubjectId) ?? null;
  }, [sortedSubjects, selectedSubjectId]);

  const subjectCount = sortedSubjects.length;
  const activeSubjectDotIndex = useMemo(() => {
    if (!subjectCount || selectedSubjectId == null) return 0;
    const i = sortedSubjects.findIndex((s) => getSubjectId(s) === selectedSubjectId);
    return Math.min(subjectCount - 1, Math.max(0, i));
  }, [sortedSubjects, selectedSubjectId, subjectCount]);

  const bumpSubjectBySwipe = useCallback(
    (direction: 1 | -1) => {
      if (subjectCount <= 1) return;
      const ids = sortedSubjects.map(getSubjectId).filter((id): id is number => id != null);
      if (!ids.length) return;
      setSelectedSubjectId((prev) => {
        const i = prev == null ? 0 : ids.indexOf(prev);
        const base = i < 0 ? 0 : i;
        const next = (base + direction + ids.length) % ids.length;
        return ids[next] ?? prev;
      });
    },
    [sortedSubjects, subjectCount],
  );

  const heroSubjectSwipePan = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => false,
        onMoveShouldSetPanResponder: (_, g) =>
          subjectCount > 1 &&
          Math.abs(g.dx) > 14 &&
          Math.abs(g.dx) > Math.abs(g.dy) + 8,
        onPanResponderTerminationRequest: () => true,
        onPanResponderRelease: (_, g) => {
          if (subjectCount <= 1) return;
          const t = 36;
          if (g.dx < -t) bumpSubjectBySwipe(1);
          else if (g.dx > t) bumpSubjectBySwipe(-1);
        },
      }),
    [bumpSubjectBySwipe, subjectCount],
  );

  const contentOpacity = useRef(new Animated.Value(0)).current;
  const contentY = useRef(new Animated.Value(20)).current;

  const runEntrance = useCallback(() => {
    Animated.parallel([
      Animated.timing(contentOpacity, { toValue: 1, duration: 600, useNativeDriver: true }),
      Animated.timing(contentY, { toValue: 0, duration: 600, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
    ]).start();
  }, []);

  // Live unread count — polls every 30 s so the bell badge updates after grading
  const [liveUnread, setLiveUnread] = useState<number | null>(null);
  useEffect(() => {
    let cancelled = false;
    const poll = async () => {
      try {
        const res = await get<{ count: number }>('/api/students/notifications/unread-count');
        if (!cancelled) setLiveUnread(res.count ?? 0);
      } catch { /* silent */ }
    };
    void poll();
    const id = setInterval(() => void poll(), 30_000);
    return () => { cancelled = true; clearInterval(id); };
  }, [get]);

  const loadDashboard = useCallback(async () => {
    try {
      const res = await get<DashboardResponse>('/api/students/dashboard');
      setDashboard(res);
      setErrorMessage(null);
    } catch (err) {
      if (axios.isAxiosError(err)) {
        setErrorMessage(err.response?.data?.detail ?? 'Could not load dashboard.');
      } else {
        setErrorMessage('Could not load dashboard.');
      }
    }
  }, [get]);

  const loadDeskVitals = useCallback(async () => {
    try {
      const res = await get<Record<string, unknown>>('/api/students/iot/status');
      const devices = (res.devices as Record<string, unknown>[]) ?? [];
      const first = devices[0] ?? {};
      const dist = res.latest_distance_cm ?? first.distance_cm ?? null;
      const ldr = res.latest_ldr_value ?? first.ldr_value ?? null;
      const online = devices.some((d) => d.status === 'online');
      setDeskVitals({
        ldr: ldr != null ? String(ldr) : '—',
        posture: dist == null ? 'No data' : (dist as number) > 80 ? 'Away' : 'At Desk',
        distance: dist != null ? `${dist} cm` : '—',
        isOnline: online,
      });
    } catch {
      // optional
    }
  }, [get]);

  useEffect(() => {
    if (telemetryTick === 0 || !lastTelemetry || lastTelemetry.type !== 'iot_telemetry') return;
    setDeskVitals((v) => {
      const m = lastTelemetry;
      let distStr = v.distance;
      let posture = v.posture;
      if (m.latest_distance_cm != null && Number.isFinite(Number(m.latest_distance_cm))) {
        const d = Number(m.latest_distance_cm);
        distStr = `${Math.round(d)} cm`;
        posture = d > 80 ? 'Away' : 'At Desk';
      }
      let ldrStr = v.ldr;
      if (m.latest_ldr_value != null && Number.isFinite(Number(m.latest_ldr_value))) {
        ldrStr = String(Math.round(Number(m.latest_ldr_value)));
      }
      return { ...v, distance: distStr, posture, ldr: ldrStr, isOnline: true };
    });
  }, [telemetryTick, lastTelemetry]);

  useEffect(() => {
    const init = async () => {
      setIsLoading(true);
      await Promise.all([loadDashboard(), loadDeskVitals()]);
      setIsLoading(false);
      runEntrance();
    };
    void init();
  }, [loadDashboard, loadDeskVitals, runEntrance]);

  const onRefresh = useCallback(async () => {
    setIsRefreshing(true);
    await Promise.all([loadDashboard(), loadDeskVitals()]);
    setIsRefreshing(false);
  }, [loadDashboard, loadDeskVitals]);

  const goTo = useCallback(
    (screen: string) => {
      navigation?.navigate(screen);
    },
    [navigation]
  );

  const recentSubmission = dashboard?.recent_submissions?.[0] ?? null;
  const upcomingAssignment = dashboard?.upcoming_assignments?.[0] ?? null;
  const focusSubjectName = selectedSubject
    ? getString(selectedSubject, ['subject_name', 'name', 'title'], 'Subject')
    : getString(dashboard?.current_subject, ['subject_name', 'name', 'title'], 'Your studies');
  const focusGrade = selectedSubject ? getString(selectedSubject, ['grade_name', 'grade'], '') : '';
  const focusCompletion = selectedSubject
    ? getNumber(selectedSubject, ['completion_percentage', 'completion'], 0)
    : dashboard?.current_subject
      ? getNumber(dashboard?.current_subject, ['completion_percentage', 'completion'], 0)
      : 0;
  const greetingName = (dashboard?.student_name ?? 'Student').split(' ')[0];
  const avgScore = dashboard?.average_score ?? null;
  const gapsCount = dashboard?.knowledge_gaps_count ?? 0;
  const totalSubs = dashboard?.total_submissions ?? 0;
  const enrolledCount = dashboard?.enrolled_subjects?.length ?? 0;
  // Prefer the live-polled count; fall back to the dashboard snapshot
  const unread = liveUnread ?? dashboard?.notifications_unread_count ?? 0;

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: theme.colors.screen }]} edges={['top', 'left', 'right']}>
      {/* ── Single, unified header ── */}
      <View style={[styles.header, { backgroundColor: theme.colors.surface, borderBottomColor: theme.colors.border }]}>
        <View style={styles.headerLeft}>
          <Image source={require('../../../assets/logo-icon.png')} style={styles.headerLogo} resizeMode="contain" />
          <View style={styles.headerText}>
            <Text style={[styles.headerGreeting, { color: theme.colors.muted }]}>{greetingByHour()},</Text>
            <Text style={[styles.headerName, { color: theme.colors.primary }]} numberOfLines={1}>
              {greetingName}
            </Text>
          </View>
        </View>
        <View style={styles.headerActions}>
          <TouchableOpacity
            style={[styles.headerIconBtn, { backgroundColor: theme.colors.primarySoft }]}
            activeOpacity={0.85}
            onPress={() => goTo('QRLoginScreen')}
            accessibilityLabel="Scan QR to sign in on the web"
          >
            <MaterialIcons name="qr-code-scanner" size={20} color={theme.colors.primary} />
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.bellBtn, { backgroundColor: theme.colors.primarySoft }]}
            activeOpacity={0.85}
            onPress={() => goTo('NotificationsScreen')}
          >
            <MaterialIcons name="notifications-none" size={20} color={theme.colors.primary} />
            {unread > 0 && (
              <View style={styles.bellBadge}>
                <Text style={styles.bellBadgeText}>{unread > 9 ? '9+' : unread}</Text>
              </View>
            )}
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={isRefreshing} onRefresh={() => void onRefresh()} tintColor={theme.colors.primary} />
        }
      >
        <Animated.View style={{ opacity: contentOpacity, transform: [{ translateY: contentY }], gap: 14 }}>
          {/* ─── Hero card ─── */}
          <View style={[styles.heroCard, { backgroundColor: theme.colors.primary, shadowColor: theme.colors.primary }]}>
            <View style={styles.heroOrb1} />
            <View style={styles.heroOrb2} />
            <View style={styles.heroOrb3} />

            <View style={styles.heroContent}>
              <View style={styles.heroTopRow}>
                <View style={styles.heroBadge}>
                  <View style={styles.heroBadgeDot} />
                  <Text style={styles.heroBadgeText}>My subjects</Text>
                </View>
                {avgScore != null && !isLoading && (
                  <View style={styles.heroScorePill}>
                    <MaterialIcons name="trending-up" size={11} color="#86EFAC" />
                    <Text style={styles.heroScoreText}>{Math.round(avgScore)}%</Text>
                  </View>
                )}
              </View>

              {!isLoading && enrolledCount === 0 ? (
                <>
                  <Text style={[styles.heroSubject, { marginTop: 10 }]} numberOfLines={2}>
                    No subjects yet
                  </Text>
                  <Text style={styles.heroMeta}>When you are enrolled in a subject, your progress appears here.</Text>
                </>
              ) : null}

              {isLoading ? (
                <View style={{ gap: 10, marginTop: 10 }}>
                  <Skeleton width="65%" height={28} radius={6} />
                  <Skeleton width="40%" height={14} radius={4} />
                </View>
              ) : enrolledCount > 0 ? (
                <View
                  style={styles.heroSwipeZone}
                  {...heroSubjectSwipePan.panHandlers}
                  accessible
                  accessibilityLabel="Subject carousel"
                  accessibilityHint="Swipe left or right with one finger to change subject. Tap a dot to jump."
                >
                  <View style={styles.heroSubjectRow}>
                    <Text style={styles.heroSubject} numberOfLines={2}>
                      {focusSubjectName}
                    </Text>
                    <Text style={styles.heroCompletionPct}>{Math.min(100, Math.round(focusCompletion))}%</Text>
                  </View>
                  {focusGrade ? <Text style={styles.heroGradeLine}>{focusGrade}</Text> : null}
                  <View style={styles.heroProgressTrack}>
                    <View
                      style={[
                        styles.heroProgressFill,
                        { width: `${Math.min(100, Math.max(0, focusCompletion))}%` },
                      ]}
                    />
                  </View>
                  <Text style={styles.heroMeta}>
                    {enrolledCount} subject{enrolledCount !== 1 ? 's' : ''} enrolled
                    {totalSubs > 0 && ` • ${totalSubs} submission${totalSubs !== 1 ? 's' : ''}`}
                  </Text>
                  {subjectCount > 1 ? (
                    <View style={styles.subjectDotsRow}>
                      {sortedSubjects.map((row, idx) => {
                        const sid = getSubjectId(row);
                        if (sid == null) return null;
                        const active = idx === activeSubjectDotIndex;
                        return (
                          <TouchableOpacity
                            key={sid}
                            style={styles.subjectDotBtn}
                            activeOpacity={0.75}
                            onPress={() => setSelectedSubjectId(sid)}
                            accessibilityRole="button"
                            accessibilityLabel={`Show ${getString(row, ['subject_name', 'name', 'title'], 'Subject')}`}
                            accessibilityState={{ selected: active }}
                          >
                            <View style={[styles.subjectDotInner, active && styles.subjectDotInnerActive]} />
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                  ) : null}
                </View>
              ) : null}

              {enrolledCount > 0 ? (
                <View style={styles.heroActions}>
                  <TouchableOpacity
                    style={styles.heroPrimary}
                    activeOpacity={0.88}
                    onPress={() => goTo('LibraryScreen')}
                  >
                    <MaterialIcons name="menu-book" size={16} color={theme.colors.primary} />
                    <Text style={[styles.heroPrimaryText, { color: theme.colors.primary }]}>Resume learning</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.heroSecondary}
                    activeOpacity={0.88}
                    onPress={() => goTo('Submit')}
                  >
                    <MaterialIcons name="assignment" size={16} color="#FFFFFF" />
                    <Text style={styles.heroSecondaryText}>Assignments</Text>
                  </TouchableOpacity>
                </View>
              ) : null}
            </View>
          </View>

          {/* ─── Stats row ─── */}
          <View style={styles.statsRow}>
            {[
              {
                label: 'Submissions',
                value: totalSubs,
                icon: 'assignment-turned-in' as const,
                color: '#2563EB',
                bg: '#EFF6FF',
                onPress: () => goTo('SubmissionsListScreen'),
              },
              {
                label: 'Avg Score',
                value: Math.round(avgScore ?? 0),
                suffix: '%',
                icon: 'grade' as const,
                color: scoreColor(avgScore),
                bg: avgScore && avgScore >= 75 ? '#F0FDF4' : avgScore && avgScore >= 50 ? '#FFFBEB' : '#FFF1F2',
                onPress: () => goTo('PerformanceScreen'),
              },
              {
                label: 'Knowledge Gaps',
                value: gapsCount,
                icon: 'psychology' as const,
                color: gapsCount > 0 ? '#DC2626' : '#15803D',
                bg: gapsCount > 0 ? '#FFF1F2' : '#F0FDF4',
                onPress: () => navigation?.navigate('History'),
              },
            ].map((s) => (
              <TouchableOpacity
                key={s.label}
                style={[styles.statCard, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}
                activeOpacity={0.85}
                onPress={s.onPress}
              >
                <View style={[styles.statIcon, { backgroundColor: s.bg }]}>
                  <MaterialIcons name={s.icon} size={18} color={s.color} />
                </View>
                {isLoading ? (
                  <Skeleton width={36} height={22} radius={5} />
                ) : (
                  <AnimatedNumber value={s.value} suffix={s.suffix ?? ''} color={theme.colors.text} />
                )}
                <Text style={[appTypography.statLabel, { color: theme.colors.caption }]} numberOfLines={1}>
                  {s.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* ─── IoT Smart Desk ─── */}
          <TouchableOpacity style={[styles.iotCard, { backgroundColor: theme.colors.primary, shadowColor: theme.colors.primary }]} activeOpacity={0.88} onPress={() => goTo('IoTStatusScreen')}>
            <View style={styles.iotHeader}>
              <View style={styles.iotIconRing}>
                <View style={styles.iotIconCenter}>
                  <MaterialIcons name="sensors" size={18} color="#FFFFFF" />
                </View>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.iotTitle}>Smart Desk</Text>
                <View style={styles.iotStatusRow}>
                  <View style={[styles.iotPulse, { backgroundColor: deskVitals.isOnline ? '#22C55E' : '#94A3B8' }]} />
                  <Text style={styles.iotStatusText}>{deskVitals.isOnline ? 'Live' : 'Offline'}</Text>
                </View>
              </View>
              <MaterialIcons name="chevron-right" size={22} color="rgba(255,255,255,0.5)" />
            </View>

            <View style={styles.iotMetricsRow}>
              <View style={styles.iotMetric}>
                <Text style={styles.iotMetricLabel}>Distance</Text>
                <Text style={styles.iotMetricValue}>{deskVitals.distance}</Text>
              </View>
              <View style={styles.iotVDivider} />
              <View style={styles.iotMetric}>
                <Text style={styles.iotMetricLabel}>Light (LDR)</Text>
                <Text style={styles.iotMetricValue}>{deskVitals.ldr}</Text>
              </View>
              <View style={styles.iotVDivider} />
              <View style={styles.iotMetric}>
                <Text style={styles.iotMetricLabel}>Presence</Text>
                <Text style={[styles.iotMetricValue, deskVitals.posture === 'Away' && { color: '#FCA5A5' }]}>
                  {deskVitals.posture}
                </Text>
              </View>
            </View>
          </TouchableOpacity>

          {/* ─── Recent Submission + Upcoming side by side ─── */}
          <View style={styles.dualRow}>
            <TouchableOpacity
              style={[styles.dualCard, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}
              activeOpacity={0.88}
              onPress={() => goTo('SubmissionsListScreen')}
            >
              <View style={styles.dualHeader}>
                <View style={[styles.dualIcon, { backgroundColor: '#EFF6FF' }]}>
                  <MaterialIcons name="history" size={14} color="#2563EB" />
                </View>
                <Text style={[styles.dualTitle, { color: theme.colors.muted }]}>Recent</Text>
              </View>

              {isLoading ? (
                <View style={{ gap: 6, marginTop: 4 }}>
                  <Skeleton width="100%" height={14} />
                  <Skeleton width="60%" height={11} />
                </View>
              ) : recentSubmission ? (
                <>
                  <Text style={[styles.dualName, { color: theme.colors.primary }]} numberOfLines={2}>
                    {getString(recentSubmission, ['assignment_title', 'title', 'name'], 'Submission')}
                  </Text>
                  <View style={styles.dualMetaRow}>
                    {recentSubmission.score_percentage != null ? (
                      <Text style={[styles.dualScore, { color: scoreColor(recentSubmission.score_percentage as number) }]}>
                        {Math.round(recentSubmission.score_percentage as number)}%
                      </Text>
                    ) : null}
                    <Text style={[styles.dualMeta, { color: theme.colors.muted }]} numberOfLines={1}>
                      {getString(recentSubmission, ['processing_status', 'status'], 'pending')}
                    </Text>
                  </View>
                </>
              ) : (
                <Text style={[styles.dualEmpty, { color: theme.colors.muted }]}>No submissions yet</Text>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.dualCard, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}
              activeOpacity={0.88}
              onPress={() => goTo('Submit')}
            >
              <View style={styles.dualHeader}>
                <View style={[styles.dualIcon, { backgroundColor: '#FEF3C7' }]}>
                  <MaterialIcons name="event" size={14} color="#B45309" />
                </View>
                <Text style={[styles.dualTitle, { color: theme.colors.muted }]}>Upcoming</Text>
              </View>

              {isLoading ? (
                <View style={{ gap: 6, marginTop: 4 }}>
                  <Skeleton width="100%" height={14} />
                  <Skeleton width="60%" height={11} />
                </View>
              ) : upcomingAssignment ? (
                <>
                  <Text style={[styles.dualName, { color: theme.colors.primary }]} numberOfLines={2}>
                    {getString(upcomingAssignment, ['title', 'assignment_title', 'name'], 'Assignment')}
                  </Text>
                  <Text style={[styles.dualMeta, { color: '#B45309', fontWeight: '700' }]} numberOfLines={1}>
                    {upcomingAssignment.due_date ? formatDue(upcomingAssignment.due_date) : 'No due date'}
                  </Text>
                </>
              ) : (
                <Text style={[styles.dualEmpty, { color: theme.colors.muted }]}>All caught up!</Text>
              )}
            </TouchableOpacity>
          </View>

          {/* ─── Quick Access ─── */}
          <View style={styles.sectionHeader}>
            <Text style={[styles.sectionLabel, { color: theme.colors.muted }]}>Explore</Text>
            <View style={[styles.sectionDivider, { backgroundColor: theme.colors.border }]} />
          </View>

          <View style={styles.quickGrid}>
            {[
              { label: 'AI Tutor', icon: 'auto-awesome', color: '#7C3AED', bg: '#F5F3FF', screen: 'Chat' },
              { label: 'Quizzes', icon: 'quiz', color: '#0369A1', bg: '#F0F9FF', screen: 'History' },
              { label: 'Performance', icon: 'insights', color: '#15803D', bg: '#F0FDF4', screen: 'PerformanceScreen' },
              { label: 'Library', icon: 'menu-book', color: '#B45309', bg: '#FFFBEB', screen: 'LibraryScreen' },
              { label: 'My Work', icon: 'folder-open', color: '#0891B2', bg: '#ECFEFF', screen: 'SubmissionsListScreen' },
              { label: 'Help', icon: 'help-outline', color: '#64748B', bg: '#F8FAFC', screen: 'HelpScreen' },
            ].map((item) => (
              <TouchableOpacity
                key={item.label}
                style={[styles.quickCard, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}
                activeOpacity={0.85}
                onPress={() => goTo(item.screen)}
              >
                <View style={[styles.quickIcon, { backgroundColor: item.bg }]}>
                  <MaterialIcons name={item.icon as keyof typeof MaterialIcons.glyphMap} size={22} color={item.color} />
                </View>
                <Text style={[styles.quickLabel, { color: theme.colors.primary }]}>{item.label}</Text>
              </TouchableOpacity>
            ))}
          </View>

          {errorMessage && (
            <View style={styles.errorCard}>
              <MaterialIcons name="wifi-off" size={18} color="#9F1239" />
              <Text style={styles.errorText}>{errorMessage}</Text>
              <TouchableOpacity onPress={() => void onRefresh()}>
                <Text style={[styles.retryText, { color: theme.colors.primary }]}>Retry</Text>
              </TouchableOpacity>
            </View>
          )}

          <View style={{ height: 16 }} />
        </Animated.View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 },
  headerLogo: { width: 38, height: 38 },
  headerText: { flex: 1, minWidth: 0 },
  headerGreeting: { fontSize: 11, fontWeight: '600' },
  headerName: { fontSize: 18, fontWeight: '900', marginTop: 1 },
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  headerIconBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bellBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  bellBadge: {
    position: 'absolute',
    top: -2,
    right: -2,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: '#DC2626',
    borderWidth: 1.5,
    borderColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 2,
  },
  bellBadgeText: { color: '#FFFFFF', fontSize: 9, fontWeight: '900' },

  scroll: { flex: 1 },
  scrollContent: { paddingHorizontal: 14, paddingTop: 14, paddingBottom: 28 },

  // Hero
  heroCard: {
    borderRadius: 22,
    overflow: 'hidden',
    minHeight: 200,
    shadowOpacity: 0.25,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 6,
  },
  heroOrb1: {
    position: 'absolute',
    top: -60,
    right: -40,
    width: 220,
    height: 220,
    borderRadius: 110,
    backgroundColor: 'rgba(99,179,237,0.18)',
  },
  heroOrb2: {
    position: 'absolute',
    bottom: -80,
    left: -60,
    width: 200,
    height: 200,
    borderRadius: 100,
    backgroundColor: 'rgba(168,85,247,0.12)',
  },
  heroOrb3: {
    position: 'absolute',
    top: 30,
    left: -30,
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  heroContent: { padding: 22, gap: 6 },
  heroTopRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  heroBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.18)',
  },
  heroBadgeDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#86EFAC' },
  heroBadgeText: {
    color: 'rgba(255,255,255,0.9)',
    fontSize: 10,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  heroScorePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(34,197,94,0.18)',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: 'rgba(134,239,172,0.4)',
  },
  heroScoreText: { color: '#86EFAC', fontSize: 12, fontWeight: '900' },
  heroSwipeZone: { marginTop: 2 },
  subjectDotsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 10,
    paddingVertical: 4,
  },
  subjectDotBtn: {
    padding: 6,
    minWidth: 24,
    minHeight: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  subjectDotInner: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: 'rgba(255,255,255,0.35)',
  },
  subjectDotInnerActive: {
    width: 22,
    height: 7,
    borderRadius: 4,
    backgroundColor: '#FFFFFF',
  },
  heroSubjectRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 10,
    marginTop: 10,
  },
  heroCompletionPct: {
    fontSize: 13,
    fontWeight: '800',
    color: 'rgba(255,255,255,0.9)',
    marginTop: 4,
    fontVariant: ['tabular-nums'],
  },
  heroGradeLine: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.52)',
    fontWeight: '600',
    marginTop: 4,
  },
  heroProgressTrack: {
    height: 6,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.15)',
    overflow: 'hidden',
    marginTop: 10,
  },
  heroProgressFill: {
    height: '100%',
    borderRadius: 999,
    backgroundColor: '#FFFFFF',
  },
  heroSubject: {
    flex: 1,
    fontSize: 26,
    fontWeight: '900',
    color: '#FFFFFF',
    lineHeight: 30,
    letterSpacing: -0.3,
  },
  heroMeta: { fontSize: 12, color: 'rgba(255,255,255,0.65)', fontWeight: '600', marginTop: 8 },
  heroActions: { flexDirection: 'row', gap: 8, marginTop: 16 },
  heroPrimary: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#FFFFFF',
    borderRadius: 13,
    paddingVertical: 12,
  },
  heroPrimaryText: { fontSize: 13, fontWeight: '900' },
  heroSecondary: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderRadius: 13,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  heroSecondaryText: { color: '#FFFFFF', fontSize: 13, fontWeight: '800' },

  // Stats
  statsRow: { flexDirection: 'row', gap: 8 },
  statCard: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 16,
    paddingVertical: 14,
    paddingHorizontal: 8,
    alignItems: 'center',
    gap: 6,
  },
  statIcon: { width: 38, height: 38, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },

  // IoT
  iotCard: {
    borderRadius: 18,
    padding: 16,
    gap: 14,
    shadowOpacity: 0.18,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 4,
  },
  iotHeader: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  iotIconRing: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.18)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  iotIconCenter: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(99,179,237,0.3)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  iotTitle: { color: '#FFFFFF', fontSize: 15, fontWeight: '900' },
  iotStatusRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 2 },
  iotPulse: { width: 7, height: 7, borderRadius: 3.5 },
  iotStatusText: { color: 'rgba(255,255,255,0.65)', fontSize: 11, fontWeight: '700' },
  iotMetricsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.18)',
    borderRadius: 12,
    paddingVertical: 10,
  },
  iotMetric: { flex: 1, alignItems: 'center', gap: 3 },
  iotMetricLabel: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 9,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  iotMetricValue: { color: '#FFFFFF', fontSize: 13, fontWeight: '900' },
  iotVDivider: { width: 1, height: 26, backgroundColor: 'rgba(255,255,255,0.12)' },

  // Dual cards
  dualRow: { flexDirection: 'row', gap: 10 },
  dualCard: { flex: 1, borderWidth: 1, borderRadius: 16, padding: 14, gap: 8, minHeight: 110 },
  dualHeader: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  dualIcon: { width: 24, height: 24, borderRadius: 7, alignItems: 'center', justifyContent: 'center' },
  dualTitle: { fontSize: 10, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.5 },
  dualName: { fontSize: 13, fontWeight: '800', lineHeight: 17 },
  dualMetaRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  dualScore: { fontSize: 14, fontWeight: '900' },
  dualMeta: { fontSize: 11, fontWeight: '600' },
  dualEmpty: { fontSize: 12, fontWeight: '600', marginTop: 4 },

  // Section
  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 4 },
  sectionLabel: { fontSize: 10, fontWeight: '900', textTransform: 'uppercase', letterSpacing: 1 },
  sectionDivider: { flex: 1, height: 1 },

  // Quick grid
  quickGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  quickCard: {
    width: '31.5%',
    borderWidth: 1,
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 6,
    alignItems: 'center',
    gap: 8,
  },
  quickIcon: { width: 44, height: 44, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  quickLabel: { fontSize: 11, fontWeight: '800', textAlign: 'center' },

  // Error
  errorCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#FFF1F2',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#FECACA',
    padding: 12,
  },
  errorText: { flex: 1, color: '#9F1239', fontSize: 12, fontWeight: '600' },
  retryText: { fontSize: 12, fontWeight: '900' },
});
