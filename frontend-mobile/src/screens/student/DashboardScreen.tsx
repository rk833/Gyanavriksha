import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
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

type NotificationItem = {
  notification_id: string;
  title: string;
  body: string;
  is_read: boolean;
  created_at: string;
};

type PaginatedNotificationsResponse = {
  items: NotificationItem[];
  total: number;
  page: number;
  per_page: number;
  total_pages: number;
};

type DeskVitals = {
  lightLux: number;
  postureStatus: string;
};

type DashboardScreenProps = {
  navigation?: {
    navigate: (screenName: string, params?: Record<string, unknown>) => void;
    getState?: () => { routeNames?: string[] };
  };
};

const MAX_RECENT_SUBMISSIONS = 3;

function getStringValue(record: DashboardRecord | null | undefined, keys: string[], fallback = '') {
  if (!record) {
    return fallback;
  }

  for (const key of keys) {
    const value = record[key];
    if (typeof value === 'string' && value.trim().length > 0) {
      return value;
    }
  }

  return fallback;
}

function getNumberValue(record: DashboardRecord | null | undefined, keys: string[]) {
  if (!record) {
    return null;
  }

  for (const key of keys) {
    const value = record[key];
    if (typeof value === 'number' && Number.isFinite(value)) {
      return value;
    }
  }

  return null;
}

function formatDateLabel(rawValue: unknown) {
  if (typeof rawValue !== 'string' || rawValue.length === 0) {
    return '';
  }

  const parsedDate = new Date(rawValue);
  if (Number.isNaN(parsedDate.getTime())) {
    return rawValue;
  }

  return parsedDate.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
  });
}

function SkeletonBlock({
  width,
  height,
  radius = 16,
}: {
  width: number | `${number}%` | 'auto';
  height: number;
  radius?: number;
}) {
  const pulse = useRef(new Animated.Value(0.35)).current;

  useEffect(() => {
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 0.75,
          duration: 900,
          useNativeDriver: true,
        }),
        Animated.timing(pulse, {
          toValue: 0.35,
          duration: 900,
          useNativeDriver: true,
        }),
      ])
    );

    animation.start();

    return () => {
      animation.stop();
    };
  }, [pulse]);

  return <Animated.View style={[styles.skeleton, { width, height, borderRadius: radius, opacity: pulse }]} />;
}

export default function DashboardScreen({ navigation }: DashboardScreenProps) {
  const { get } = useApi();
  const [dashboard, setDashboard] = useState<DashboardResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [deskVitals, setDeskVitals] = useState<DeskVitals>({ lightLux: 450, postureStatus: 'Optimal' });

  const loadDashboard = useCallback(async () => {
    setErrorMessage(null);

    try {
      const response = await get<DashboardResponse>('/api/students/dashboard');
      setDashboard(response);
    } catch (error) {
      let message = 'Unable to load dashboard right now. Pull to refresh and try again.';

      if (axios.isAxiosError(error)) {
        const detail = error.response?.data?.detail;
        if (typeof detail === 'string' && detail.trim().length > 0) {
          message = detail;
        }
      } else if (error instanceof Error && error.message.trim().length > 0) {
        message = error.message;
      }

      setErrorMessage(message);
    }
  }, [get]);

  const loadDeskVitals = useCallback(async () => {
    const candidateEndpoints = ['/api/students/iot/status', '/api/iot/status'];

    for (const endpoint of candidateEndpoints) {
      try {
        const response = await get<Record<string, unknown>>(endpoint);
        const lightLux = getNumberValue(response, ['light_lux', 'light_level', 'lux']) ?? 450;
        const postureStatus = getStringValue(response, ['posture_status', 'posture', 'status'], 'Optimal');

        setDeskVitals({ lightLux, postureStatus });
        return;
      } catch {
        // Endpoint may not exist yet. Keep default values.
      }
    }
  }, [get]);

  const refreshDashboard = useCallback(async () => {
    setIsRefreshing(true);
    try {
      await Promise.all([loadDashboard(), loadDeskVitals()]);
    } finally {
      setIsRefreshing(false);
    }
  }, [loadDashboard, loadDeskVitals]);

  const goToPlaceholder = useCallback(
    (screenName: string, label: string) => {
      if (!navigation) {
        return;
      }

      const routeNames = navigation.getState?.().routeNames ?? [];
      if (routeNames.includes(screenName)) {
        navigation.navigate(screenName);
        return;
      }

      Alert.alert('Coming soon', `${label} page placeholder: ${screenName}`);
    },
    [navigation]
  );

  useEffect(() => {
    let active = true;

    const bootstrap = async () => {
      setIsLoading(true);
      await Promise.all([loadDashboard(), loadDeskVitals()]);
      if (active) {
        setIsLoading(false);
      }
    };

    void bootstrap();

    return () => {
      active = false;
    };
  }, [loadDashboard, loadDeskVitals]);

  const recentSubmissions = useMemo(
    () => dashboard?.recent_submissions.slice(0, MAX_RECENT_SUBMISSIONS) ?? [],
    [dashboard?.recent_submissions]
  );

  const recentSubmission = recentSubmissions[0] ?? null;
  const upcomingAssignments = dashboard?.upcoming_assignments ?? [];
  const upcomingAssignment = upcomingAssignments[0] ?? null;
  const greetingName = dashboard?.student_name ?? 'Student';
  const currentSubjectName = getStringValue(
    dashboard?.current_subject,
    ['subject_name', 'name', 'title'],
    'Secondary Physics: Fluid Dynamics'
  );

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView
        style={styles.flex}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl refreshing={isRefreshing} onRefresh={refreshDashboard} tintColor="#123A5F" />
        }
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.greetingRow}>
          <View>
            <Text style={styles.greetingLabel}>Welcome back, {greetingName}</Text>
            <Text style={styles.greetingTitle}>Namaste!</Text>
          </View>
          <View style={styles.xpPill}>
            <MaterialIcons name="local-fire-department" size={14} color="#8B5E1A" />
            <Text style={styles.xpText}>12 XP</Text>
          </View>
        </View>

        <View style={styles.focusCard}>
          <View style={styles.focusGlow} />
          <Text style={styles.focusTag}>Current Focus</Text>
          {isLoading ? (
            <View style={styles.skeletonList}>
              <SkeletonBlock width="74%" height={24} radius={12} />
              <SkeletonBlock width="40%" height={14} radius={8} />
              <SkeletonBlock width="100%" height={6} radius={999} />
              <SkeletonBlock width="100%" height={48} radius={12} />
            </View>
          ) : (
            <>
              <Text style={styles.focusTitle}>{currentSubjectName}</Text>
              <Text style={styles.focusSubtitle}>Chapter 4 • Module 2 of 5</Text>
              <View style={styles.progressWrap}>
                <View style={styles.progressHeader}>
                  <Text style={styles.progressLabel}>Progress</Text>
                  <Text style={styles.progressLabel}>64%</Text>
                </View>
                <View style={styles.progressTrack}>
                  <View style={styles.progressFill} />
                </View>
              </View>
              <TouchableOpacity
                style={styles.resumeButton}
                activeOpacity={0.9}
                onPress={() => goToPlaceholder('LessonPlayerScreen', 'Resume lesson')}
              >
                <Text style={styles.resumeButtonText}>Resume Lesson</Text>
                <MaterialIcons name="play-arrow" size={16} color="#123A5F" />
              </TouchableOpacity>
            </>
          )}
        </View>

        <View style={styles.iotGrid}>
          <View style={styles.iotCard}>
            <View style={styles.iotIconWrap}>
              <MaterialIcons name="light-mode" size={18} color="#123A5F" />
            </View>
            <View>
              <Text style={styles.iotLabel}>Light</Text>
              <Text style={styles.iotValue}>{deskVitals.lightLux} Lux</Text>
            </View>
          </View>

          <View style={styles.iotCard}>
            <View style={styles.iotIconWrap}>
              <MaterialIcons name="accessibility-new" size={18} color="#123A5F" />
            </View>
            <View>
              <Text style={styles.iotLabel}>Posture</Text>
              <Text style={styles.iotValueHighlight}>{deskVitals.postureStatus}</Text>
            </View>
          </View>
        </View>

        <TouchableOpacity
          style={styles.whiteCard}
          activeOpacity={0.9}
          onPress={() => goToPlaceholder('SubmissionDetailScreen', 'Recent submission')}
        >
          <View style={styles.cardHeaderRow}>
            <Text style={styles.cardTitle}>Recent Submission</Text>
            <Text style={styles.cardArrow}>›</Text>
          </View>

          {isLoading ? (
            <View style={styles.skeletonList}>
              <SkeletonBlock width="100%" height={56} radius={12} />
            </View>
          ) : recentSubmission ? (
            <View style={styles.recentRow}>
              <View style={styles.previewThumb} />
              <View style={styles.recentTextWrap}>
                <Text style={styles.recentTitle} numberOfLines={1}>
                  Placeholder Submission Card
                </Text>
                <Text style={styles.recentMeta}>Placeholder status • Placeholder score</Text>
              </View>
            </View>
          ) : (
            <Text style={styles.emptyState}>No submissions yet.</Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.whiteCard}
          activeOpacity={0.9}
          onPress={() => goToPlaceholder('UpcomingClassScreen', 'Upcoming class')}
        >
          <View style={styles.upcomingRow}>
            <View style={styles.upcomingIconWrap}>
              <MaterialIcons name="event" size={18} color="#123A5F" />
            </View>
            <View style={styles.upcomingTextWrap}>
              <Text style={styles.iotLabel}>Upcoming Class</Text>
              {isLoading ? (
                <View style={styles.skeletonList}>
                  <SkeletonBlock width="90%" height={16} radius={8} />
                  <SkeletonBlock width="70%" height={14} radius={8} />
                </View>
              ) : upcomingAssignment ? (
                <>
                  <Text style={styles.recentTitle} numberOfLines={1}>
                    {getStringValue(upcomingAssignment, ['title', 'assignment_title', 'name'], 'Untitled class')}
                  </Text>
                  <Text style={styles.upcomingMeta}>
                    {`Due ${formatDateLabel(upcomingAssignment['due_date'] ?? upcomingAssignment['due_at'] ?? upcomingAssignment['deadline'])}`}
                  </Text>
                </>
              ) : (
                <Text style={styles.emptyState}>No upcoming classes</Text>
              )}
            </View>
          </View>
        </TouchableOpacity>

        {errorMessage ? (
          <View style={styles.errorCard}>
            <Text style={styles.errorTitle}>Could not refresh dashboard</Text>
            <Text style={styles.errorText}>{errorMessage}</Text>
            <TouchableOpacity style={styles.retryButton} activeOpacity={0.85} onPress={refreshDashboard}>
              <Text style={styles.retryButtonText}>Try again</Text>
            </TouchableOpacity>
          </View>
        ) : null}

        <View style={styles.footerSpace} />
      </ScrollView>

    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#F3F1EB',
  },
  flex: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 18,
    paddingTop: 14,
    paddingBottom: 28,
    gap: 14,
  },
  greetingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
  },
  greetingLabel: {
    color: '#64748B',
    fontSize: 11,
    textTransform: 'uppercase',
    letterSpacing: 1,
    fontWeight: '700',
  },
  greetingTitle: {
    color: '#123A5F',
    fontSize: 28,
    fontWeight: '800',
    marginTop: 4,
  },
  xpPill: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E1D2B6',
    backgroundColor: '#F1E8D8',
    paddingHorizontal: 10,
    paddingVertical: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  xpText: {
    color: '#123A5F',
    fontSize: 12,
    fontWeight: '800',
  },
  focusCard: {
    borderRadius: 14,
    padding: 18,
    backgroundColor: '#123A5F',
    overflow: 'hidden',
    gap: 12,
  },
  focusGlow: {
    position: 'absolute',
    top: -40,
    right: -40,
    width: 130,
    height: 130,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.16)',
  },
  focusTag: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderColor: 'rgba(255,255,255,0.2)',
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
    color: 'rgba(255,255,255,0.88)',
    fontSize: 10,
    textTransform: 'uppercase',
    letterSpacing: 1,
    fontWeight: '700',
  },
  focusTitle: {
    color: '#FFFFFF',
    fontSize: 23,
    lineHeight: 30,
    fontWeight: '800',
  },
  focusSubtitle: {
    color: 'rgba(255,255,255,0.72)',
    fontSize: 12,
    fontWeight: '500',
  },
  progressWrap: {
    gap: 6,
  },
  progressHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  progressLabel: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 12,
    fontWeight: '700',
  },
  progressTrack: {
    width: '100%',
    height: 6,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.2)',
    overflow: 'hidden',
  },
  progressFill: {
    width: '64%',
    height: '100%',
    backgroundColor: '#FFFFFF',
  },
  resumeButton: {
    marginTop: 4,
    borderRadius: 10,
    backgroundColor: '#FFFFFF',
    minHeight: 46,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  resumeButtonText: {
    color: '#123A5F',
    fontSize: 14,
    fontWeight: '800',
  },
  iotGrid: {
    flexDirection: 'row',
    gap: 10,
  },
  iotCard: {
    flex: 1,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E6E1D8',
    backgroundColor: '#FFFFFF',
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  iotIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#F3F1EB',
    alignItems: 'center',
    justifyContent: 'center',
  },
  iotLabel: {
    color: '#64748B',
    fontSize: 10,
    textTransform: 'uppercase',
    letterSpacing: 1,
    fontWeight: '700',
  },
  iotValue: {
    color: '#123A5F',
    fontSize: 14,
    fontWeight: '800',
    marginTop: 2,
  },
  iotValueHighlight: {
    color: '#8B5E1A',
    fontSize: 14,
    fontWeight: '800',
    marginTop: 2,
  },
  whiteCard: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E6E1D8',
    backgroundColor: '#FFFFFF',
    padding: 14,
    gap: 10,
  },
  cardHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  cardTitle: {
    color: '#123A5F',
    fontSize: 17,
    fontWeight: '800',
  },
  cardArrow: {
    color: '#64748B',
    fontSize: 22,
    lineHeight: 22,
  },
  recentRow: {
    flexDirection: 'row',
    gap: 10,
    alignItems: 'center',
  },
  previewThumb: {
    width: 56,
    height: 56,
    borderRadius: 10,
    backgroundColor: '#F3F1EB',
  },
  recentTextWrap: {
    flex: 1,
    gap: 2,
  },
  recentTitle: {
    color: '#123A5F',
    fontSize: 14,
    fontWeight: '800',
  },
  recentMeta: {
    color: '#64748B',
    fontSize: 12,
    fontWeight: '600',
  },
  upcomingRow: {
    flexDirection: 'row',
    gap: 10,
    alignItems: 'center',
  },
  upcomingIconWrap: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: '#F3F1EB',
    alignItems: 'center',
    justifyContent: 'center',
  },
  upcomingTextWrap: {
    flex: 1,
    gap: 1,
  },
  upcomingMeta: {
    color: '#123A5F',
    fontSize: 12,
    fontWeight: '700',
    marginTop: 2,
  },
  errorCard: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#F6C9C0',
    backgroundColor: '#FFF4F2',
    padding: 12,
    gap: 8,
  },
  errorTitle: {
    color: '#9A3412',
    fontSize: 14,
    fontWeight: '800',
  },
  errorText: {
    color: '#7C2D12',
    fontSize: 13,
    lineHeight: 18,
  },
  retryButton: {
    alignSelf: 'flex-start',
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: '#123A5F',
  },
  retryButtonText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
  emptyState: {
    color: '#64748B',
    fontSize: 13,
    lineHeight: 20,
  },
  skeletonList: {
    gap: 10,
  },
  skeleton: {
    backgroundColor: '#D9D6CF',
  },
  footerSpace: {
    height: 10,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(17, 24, 39, 0.35)',
    justifyContent: 'flex-end',
  },
  modalDismissArea: {
    flex: 1,
  },
  modalSheet: {
    maxHeight: '72%',
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 18,
    paddingTop: 16,
    paddingBottom: 28,
    borderTopWidth: 1,
    borderColor: '#E6E1D8',
    gap: 12,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  modalTitle: {
    color: '#123A5F',
    fontSize: 18,
    fontWeight: '800',
  },
  modalCloseButton: {
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: '#F3F1EB',
  },
  modalCloseText: {
    color: '#123A5F',
    fontSize: 12,
    fontWeight: '700',
  },
  notificationsList: {
    gap: 10,
    paddingBottom: 8,
  },
  notificationItem: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E6E1D8',
    backgroundColor: '#F8F6F1',
    padding: 12,
    gap: 6,
  },
  notificationTitle: {
    color: '#123A5F',
    fontSize: 14,
    fontWeight: '800',
  },
  notificationBody: {
    color: '#334155',
    fontSize: 13,
    lineHeight: 18,
  },
  notificationDate: {
    color: '#64748B',
    fontSize: 11,
    fontWeight: '600',
  },
  notificationsErrorCard: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#F6C9C0',
    backgroundColor: '#FFF4F2',
    padding: 12,
    gap: 10,
  },
  notificationsErrorText: {
    color: '#7C2D12',
    fontSize: 13,
    lineHeight: 18,
  },
  notificationsRetryButton: {
    alignSelf: 'flex-start',
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: '#123A5F',
  },
  notificationsRetryButtonText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
});