import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
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
import ScreenHeader from '../../components/ScreenHeader';

// ─── Types ─────────────────────────────────────────────────────────────────────

type NotificationItem = {
  notification_id: string;
  title: string;
  body: string;
  type: string;
  channel?: string;
  is_read: boolean;
  related_resource_id?: string | null;
  created_at: string;
};

// ─── Constants ─────────────────────────────────────────────────────────────────

const TABS = [
  { key: '', label: 'All' },
  { key: 'unread', label: 'Unread' },
  { key: 'grading_done', label: 'Grading' },
  { key: 'quiz_assigned', label: 'Quizzes' },
  { key: 'posture_alert', label: 'IoT' },
] as const;

// ─── Helpers ───────────────────────────────────────────────────────────────────

function parseApiError(error: unknown, fallback: string) {
  if (axios.isAxiosError(error)) {
    const d = error.response?.data?.detail;
    if (typeof d === 'string' && d.trim()) return d;
  }
  if (error instanceof Error && error.message.trim()) return error.message;
  return fallback;
}

function timeAgo(dateStr: string) {
  // Bare ISO strings from the API have no timezone suffix — treat them as UTC.
  const hasOffset = dateStr.endsWith('Z') || /[+-]\d{2}:\d{2}$/.test(dateStr);
  const normalized = hasOffset ? dateStr : dateStr + 'Z';
  const ms = new Date(normalized).getTime();
  if (isNaN(ms)) return '';
  const diff = Date.now() - ms;
  if (diff < 60000) return 'Just now';   // covers 0 and slight negative (clock skew)
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return days === 1 ? 'Yesterday' : `${days}d ago`;
}

function notifIcon(type: string): keyof typeof MaterialIcons.glyphMap {
  const t = (type ?? '').toLowerCase();
  if (t === 'grading_done' || t.includes('grade') || t.includes('result')) return 'grading';
  if (t === 'submission_received' || t.includes('submission')) return 'assignment-turned-in';
  if (t.includes('quiz')) return 'quiz';
  if (t.includes('assignment')) return 'assignment';
  if (t.includes('iot') || t.includes('desk') || t.includes('absence') || t.includes('posture')) return 'sensors';
  if (t.includes('announce') || t.includes('broadcast')) return 'campaign';
  if (t.includes('alert') || t.includes('warn') || t.includes('risk')) return 'warning';
  return 'notifications';
}

function notifColor(type: string) {
  const t = (type ?? '').toLowerCase();
  if (t === 'grading_done' || t.includes('grade') || t.includes('result')) return '#15803D';
  if (t === 'submission_received' || t.includes('submission')) return '#2563EB';
  if (t.includes('quiz')) return '#7C3AED';
  if (t.includes('assignment')) return '#0369A1';
  if (t.includes('iot') || t.includes('desk') || t.includes('absence') || t.includes('posture')) return '#DC2626';
  if (t.includes('risk')) return '#B91C1C';
  if (t.includes('announce')) return '#B45309';
  return '#64748B';
}

// ─── Screen ────────────────────────────────────────────────────────────────────

export default function NotificationsScreen() {
  const { get, patch } = useApi();
  const { theme } = useAppTheme();

  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [markingAll, setMarkingAll] = useState(false);
  const [activeTab, setActiveTab] = useState<string>('');
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const activeTabRef = useRef(activeTab);
  activeTabRef.current = activeTab;

  const fetchPage = useCallback(
    async (tab: string, pg: number, append = false) => {
      if (pg === 1) setError(null);
      try {
        const params: Record<string, string | number | boolean> = { page: pg, per_page: 20 };
        if (tab === 'unread') params.read = false;
        else if (tab) params.type = tab;

        const res = await get<
          NotificationItem[] | { items?: NotificationItem[]; notifications?: NotificationItem[]; total_pages?: number }
        >('/api/students/notifications', { params });

        let items: NotificationItem[];
        let totalPages = 1;
        if (Array.isArray(res)) {
          items = res;
        } else {
          items = res.items ?? res.notifications ?? [];
          totalPages = res.total_pages ?? 1;
        }
        setHasMore(pg < totalPages);
        setNotifications((prev) => (append ? [...prev, ...items] : items));
      } catch (err) {
        setError(parseApiError(err, 'Could not load notifications.'));
      } finally {
        setIsLoading(false);
        setIsRefreshing(false);
        setIsLoadingMore(false);
      }
    },
    [get]
  );

  useEffect(() => {
    setPage(1);
    setIsLoading(true);
    void fetchPage(activeTab, 1);
  }, [activeTab, fetchPage]);

  const onRefresh = useCallback(() => {
    setIsRefreshing(true);
    setPage(1);
    void fetchPage(activeTab, 1);
  }, [activeTab, fetchPage]);

  const loadMore = useCallback(() => {
    if (isLoadingMore || !hasMore) return;
    const next = page + 1;
    setPage(next);
    setIsLoadingMore(true);
    void fetchPage(activeTab, next, true);
  }, [isLoadingMore, hasMore, page, activeTab, fetchPage]);

  const markRead = useCallback(
    async (id: string) => {
      try {
        await patch(`/api/students/notifications/${id}/read`, {});
        setNotifications((prev) => prev.map((n) => (n.notification_id === id ? { ...n, is_read: true } : n)));
      } catch { /* silent */ }
    },
    [patch]
  );

  const markAllRead = useCallback(async () => {
    setMarkingAll(true);
    try {
      await patch('/api/students/notifications/read-all', {});
      setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
    } catch { /* no-op */ } finally {
      setMarkingAll(false);
    }
  }, [patch]);

  const unreadCount = notifications.filter((n) => !n.is_read).length;

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: theme.colors.screen }]} edges={['top', 'left', 'right']}>
      <ScreenHeader title="Notifications" subtitle="Your inbox" showBack />

      {/* ── Tab bar ── */}
      <View style={[styles.tabWrap, { backgroundColor: theme.colors.surface, borderBottomColor: theme.colors.border }]}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabScroll}>
          {TABS.map((t) => {
            const active = activeTab === t.key;
            return (
              <TouchableOpacity
                key={t.key}
                onPress={() => setActiveTab(t.key)}
                style={[
                  styles.tab,
                  active
                    ? { backgroundColor: theme.colors.primary }
                    : { backgroundColor: theme.colors.screen, borderColor: theme.colors.border, borderWidth: 1 },
                ]}
                activeOpacity={0.8}
              >
                <Text style={[styles.tabText, { color: active ? '#FFFFFF' : theme.colors.muted }]}>
                  {t.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {/* ── Mark-all bar ── */}
      {unreadCount > 0 && (
        <View style={[styles.headerBar, { backgroundColor: theme.colors.surface, borderBottomColor: theme.colors.border }]}>
          <Text style={[styles.unreadCount, { color: theme.colors.primary }]}>
            {unreadCount} unread
          </Text>
          <TouchableOpacity
            style={[styles.markAllBtn, { borderColor: theme.colors.primary }]}
            activeOpacity={0.8}
            onPress={() => void markAllRead()}
            disabled={markingAll}
          >
            {markingAll ? (
              <ActivityIndicator size="small" color={theme.colors.primary} />
            ) : (
              <Text style={[styles.markAllText, { color: theme.colors.primary }]}>Mark all read</Text>
            )}
          </TouchableOpacity>
        </View>
      )}

      {isLoading ? (
        <ActivityIndicator color={theme.colors.primary} style={{ marginTop: 40 }} />
      ) : error ? (
        <View style={styles.errorCard}>
          <MaterialIcons name="notifications-off" size={32} color="#9F1239" />
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity style={[styles.retryBtn, { backgroundColor: theme.colors.primary }]} onPress={() => { setIsLoading(true); void fetchPage(activeTab, 1); }}>
            <Text style={styles.retryBtnText}>Retry</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={notifications}
          keyExtractor={(item) => item.notification_id}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={isRefreshing}
              onRefresh={() => void onRefresh()}
              tintColor={theme.colors.primary}
            />
          }
          onEndReached={loadMore}
          onEndReachedThreshold={0.3}
          ListEmptyComponent={
            <View style={styles.emptyWrap}>
              <MaterialIcons name="notifications" size={44} color={theme.colors.muted} />
              <Text style={[styles.emptyTitle, { color: theme.colors.primary }]}>All caught up!</Text>
              <Text style={[styles.emptySubtitle, { color: theme.colors.muted }]}>
                {activeTab === 'unread' ? 'No unread notifications.' : 'No notifications yet.'}
              </Text>
            </View>
          }
          ListFooterComponent={
            isLoadingMore ? (
              <ActivityIndicator color={theme.colors.primary} style={{ marginVertical: 16 }} />
            ) : null
          }
          renderItem={({ item }) => {
            const color = notifColor(item.type);
            return (
              <TouchableOpacity
                activeOpacity={item.is_read ? 1 : 0.85}
                onPress={() => !item.is_read && void markRead(item.notification_id)}
              >
                <View
                  style={[
                    styles.notifCard,
                    {
                      backgroundColor: item.is_read ? theme.colors.surface : `${color}0D`,
                      borderColor: item.is_read ? theme.colors.border : `${color}40`,
                    },
                  ]}
                >
                  <View style={[styles.notifIconWrap, { backgroundColor: `${color}18` }]}>
                    <MaterialIcons name={notifIcon(item.type)} size={20} color={color} />
                  </View>
                  <View style={styles.notifBody}>
                    <View style={styles.notifTitleRow}>
                      <Text style={[styles.notifTitle, { color: theme.colors.primary }]} numberOfLines={1}>
                        {item.title}
                      </Text>
                      {!item.is_read && <View style={[styles.unreadDot, { backgroundColor: color }]} />}
                    </View>
                    <Text style={[styles.notifText, { color: theme.colors.text }]} numberOfLines={2}>
                      {item.body}
                    </Text>
                    <View style={styles.notifFooter}>
                      <Text style={[styles.notifTime, { color: theme.colors.muted }]}>
                        {timeAgo(item.created_at)}
                      </Text>
                      {item.type && (
                        <View style={[styles.typeBadge, { backgroundColor: `${color}18` }]}>
                          <Text style={[styles.typeBadgeText, { color }]}>
                            {item.type.replace(/_/g, ' ')}
                          </Text>
                        </View>
                      )}
                    </View>
                  </View>
                </View>
              </TouchableOpacity>
            );
          }}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  tabWrap: { borderBottomWidth: 1 },
  tabScroll: { paddingHorizontal: 12, paddingVertical: 8, gap: 8 },
  tab: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 20,
  },
  tabText: { fontSize: 12, fontWeight: '700' },
  headerBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 1,
  },
  unreadCount: { fontSize: 13, fontWeight: '700' },
  markAllBtn: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  markAllText: { fontSize: 12, fontWeight: '700' },
  list: { paddingHorizontal: 14, paddingTop: 10, paddingBottom: 32, gap: 8 },
  emptyWrap: { alignItems: 'center', paddingVertical: 56, gap: 12 },
  emptyTitle: { fontSize: 18, fontWeight: '800' },
  emptySubtitle: { fontSize: 14 },
  errorCard: {
    margin: 16,
    borderWidth: 1,
    borderColor: '#FECACA',
    backgroundColor: '#FFF1F2',
    borderRadius: 16,
    padding: 20,
    alignItems: 'center',
    gap: 10,
  },
  errorText: { color: '#9F1239', fontSize: 13, textAlign: 'center' },
  retryBtn: { borderRadius: 10, paddingHorizontal: 20, paddingVertical: 10 },
  retryBtnText: { color: '#FFFFFF', fontSize: 13, fontWeight: '700' },
  notifCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    borderWidth: 1,
    borderRadius: 14,
    padding: 12,
    gap: 12,
  },
  notifIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  notifBody: { flex: 1, gap: 3 },
  notifTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  notifTitle: { flex: 1, fontSize: 13, fontWeight: '800' },
  unreadDot: { width: 8, height: 8, borderRadius: 4, flexShrink: 0 },
  notifText: { fontSize: 12, lineHeight: 17 },
  notifFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 2,
  },
  notifTime: { fontSize: 10, fontWeight: '600' },
  typeBadge: { borderRadius: 4, paddingHorizontal: 6, paddingVertical: 2 },
  typeBadgeText: {
    fontSize: 9,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
});
