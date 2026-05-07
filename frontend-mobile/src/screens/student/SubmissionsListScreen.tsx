import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import axios from 'axios';

import { useApi } from '../../hooks/useApi';
import { useAppTheme } from '../../context/ThemeContext';
import ScreenHeader from '../../components/ScreenHeader';

// ─── Types ─────────────────────────────────────────────────────────────────────

type SubmissionListItem = {
  submission_id: string;
  assignment_id: string;
  assignment_title?: string | null;
  subject_name?: string | null;
  submitted_at: string;
  processing_status: string;
  grade_classification?: string | null;
  score_percentage?: number | null;
};

type NavParams = {
  SubmissionDetails: { submissionId: string };
  SubmissionResult: { submissionId: string };
  [key: string]: object | undefined;
};

// ─── Helpers ───────────────────────────────────────────────────────────────────

function parseApiError(error: unknown, fallback: string) {
  if (axios.isAxiosError(error)) {
    const d = error.response?.data?.detail;
    if (typeof d === 'string' && d.trim()) return d;
  }
  if (error instanceof Error && error.message.trim()) return error.message;
  return fallback;
}

function statusColor(status: string) {
  const s = (status ?? '').toLowerCase();
  if (s === 'done' || s === 'completed' || s === 'graded') return '#15803D';
  if (s === 'queued' || s === 'ocr' || s === 'grading' || s === 'processing' || s === 'pending') return '#B45309';
  if (s === 'rejected' || s === 'failed' || s === 'error') return '#B91C1C';
  return '#64748B';
}

function statusLabel(status: string) {
  const s = (status ?? '').toLowerCase();
  if (s === 'done' || s === 'completed') return 'Graded';
  if (s === 'queued' || s === 'pending') return 'Queued';
  if (s === 'ocr' || s === 'grading' || s === 'processing') return 'Grading';
  if (s === 'rejected' || s === 'failed') return 'Rejected';
  return status.replace(/_/g, ' ');
}

function gradeColor(gc?: string | null) {
  if (!gc) return '#64748B';
  const g = gc.toUpperCase();
  if (g === 'A' || g === 'A+') return '#15803D';
  if (g === 'B' || g === 'B+') return '#2563EB';
  if (g === 'C') return '#B45309';
  return '#B91C1C';
}

function formatDate(dateStr: string) {
  const d = new Date(dateStr);
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

const STATUS_OPTIONS = ['All', 'Graded', 'Queued', 'Grading', 'Rejected'];

// ─── Screen ────────────────────────────────────────────────────────────────────

export default function SubmissionsListScreen() {
  const { get } = useApi();
  const { theme } = useAppTheme();
  const navigation = useNavigation<NativeStackNavigationProp<NavParams>>();

  const [submissions, setSubmissions] = useState<SubmissionListItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');

  const load = useCallback(async () => {
    setError(null);
    try {
      const res = await get<SubmissionListItem[] | { items?: SubmissionListItem[] }>('/api/students/submissions');
      if (Array.isArray(res)) {
        setSubmissions(res);
      } else {
        setSubmissions(res.items ?? []);
      }
    } catch (err) {
      setError(parseApiError(err, 'Could not load submissions.'));
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [get]);

  useEffect(() => {
    void load();
  }, [load]);

  const onRefresh = useCallback(async () => {
    setIsRefreshing(true);
    await load();
  }, [load]);

  const openSubmission = useCallback(
    (item: SubmissionListItem) => {
      const done = ['completed', 'graded', 'done'].includes((item.processing_status ?? '').toLowerCase());
      if (done) {
        navigation.navigate('SubmissionResultScreen', { submissionId: item.submission_id });
      } else {
        navigation.navigate('SubmissionDetailsScreen', {
          assignmentId: item.assignment_id,
          assignmentTitle: item.assignment_title ?? 'Assignment',
        });
      }
    },
    [navigation]
  );

  const filtered = submissions.filter((s) => {
    const matchSearch =
      !search.trim() ||
      (s.assignment_title ?? '').toLowerCase().includes(search.toLowerCase()) ||
      (s.subject_name ?? '').toLowerCase().includes(search.toLowerCase());
    const matchStatus =
      statusFilter === 'All' ||
      statusLabel(s.processing_status).toLowerCase() === statusFilter.toLowerCase();
    return matchSearch && matchStatus;
  });

  const hasResults = filtered.length > 0;

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: theme.colors.screen }]} edges={['top', 'left', 'right']}>
      <ScreenHeader title="My Submissions" subtitle="History" showBack />
      {/* Search */}
      <View style={[styles.toolbar, { backgroundColor: theme.colors.surface, borderBottomColor: theme.colors.border }]}>
        <View style={[styles.searchWrap, { backgroundColor: theme.colors.screen, borderColor: theme.colors.border }]}>
          <MaterialIcons name="search" size={18} color={theme.colors.muted} />
          <TextInput
            style={[styles.searchInput, { color: theme.colors.text }]}
            placeholder="Search submissions…"
            placeholderTextColor={theme.colors.muted}
            value={search}
            onChangeText={setSearch}
          />
          {search.length > 0 && (
            <TouchableOpacity onPress={() => setSearch('')}>
              <MaterialIcons name="close" size={16} color={theme.colors.muted} />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Status filter chips */}
      <View style={[styles.chipsRow, { borderBottomColor: theme.colors.border }]}>
        {STATUS_OPTIONS.map((opt) => (
          <TouchableOpacity
            key={opt}
            style={[styles.chip, statusFilter === opt && { backgroundColor: theme.colors.primary }]}
            onPress={() => setStatusFilter(opt)}
          >
            <Text style={[styles.chipText, { color: statusFilter === opt ? '#FFFFFF' : theme.colors.muted }]}>
              {opt}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {isLoading ? (
        <ActivityIndicator color={theme.colors.primary} style={{ marginTop: 40 }} />
      ) : error ? (
        <View style={styles.errorCard}>
          <MaterialIcons name="error-outline" size={32} color="#9F1239" />
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity style={[styles.retryBtn, { backgroundColor: theme.colors.primary }]} onPress={() => void load()}>
            <Text style={styles.retryBtnText}>Retry</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(item) => item.submission_id}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={() => void onRefresh()} tintColor={theme.colors.primary} />}
          ListHeaderComponent={
            hasResults ? (
              <Text style={[styles.countText, { color: theme.colors.muted }]}>
                {filtered.length} submission{filtered.length !== 1 ? 's' : ''}
              </Text>
            ) : null
          }
          ListEmptyComponent={
            <View style={styles.emptyWrap}>
              <MaterialIcons name="assignment-turned-in" size={44} color={theme.colors.muted} />
              <Text style={[styles.emptyTitle, { color: theme.colors.primary }]}>No submissions found</Text>
              <Text style={[styles.emptySubtitle, { color: theme.colors.muted }]}>
                {search || statusFilter !== 'All'
                  ? 'Try a different search or filter.'
                  : "You haven't submitted any assignments yet."}
              </Text>
            </View>
          }
          renderItem={({ item }) => {
            const sColor = statusColor(item.processing_status);
            const gColor = gradeColor(item.grade_classification);
            const done = ['completed', 'graded'].includes((item.processing_status ?? '').toLowerCase());
            return (
              <TouchableOpacity activeOpacity={0.82} onPress={() => openSubmission(item)}>
                <View style={[styles.card, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
                  {/* Left color strip */}
                  <View style={[styles.strip, { backgroundColor: sColor }]} />

                  <View style={styles.cardBody}>
                    {/* Title row */}
                    <View style={styles.titleRow}>
                      <Text style={[styles.assignTitle, { color: theme.colors.primary }]} numberOfLines={2}>
                        {item.assignment_title ?? 'Untitled Assignment'}
                      </Text>
                      {item.score_percentage != null && (
                        <Text style={[styles.scoreText, { color: gColor }]}>
                          {Math.round(item.score_percentage)}%
                        </Text>
                      )}
                    </View>

                    {/* Meta */}
                    <View style={styles.metaRow}>
                      {item.subject_name && (
                        <View style={[styles.subjectBadge, { backgroundColor: theme.colors.primarySoft }]}>
                          <MaterialIcons name="book" size={11} color={theme.colors.primary} />
                          <Text style={[styles.subjectText, { color: theme.colors.primary }]}>{item.subject_name}</Text>
                        </View>
                      )}
                      {item.grade_classification && (
                        <View style={[styles.gradeBadge, { backgroundColor: `${gColor}18` }]}>
                          <Text style={[styles.gradeText, { color: gColor }]}>Grade {item.grade_classification}</Text>
                        </View>
                      )}
                    </View>

                    {/* Footer */}
                    <View style={styles.footerRow}>
                      <Text style={[styles.dateText, { color: theme.colors.muted }]}>
                        {formatDate(item.submitted_at)}
                      </Text>
                      <View style={[styles.statusBadge, { backgroundColor: `${sColor}18` }]}>
                        <View style={[styles.statusDot, { backgroundColor: sColor }]} />
                        <Text style={[styles.statusText, { color: sColor }]}>
                          {statusLabel(item.processing_status)}
                        </Text>
                      </View>
                    </View>
                  </View>

                  {done && (
                    <MaterialIcons name="chevron-right" size={20} color={theme.colors.muted} style={{ alignSelf: 'center' }} />
                  )}
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
  toolbar: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderBottomWidth: 1,
  },
  searchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 8,
    gap: 8,
  },
  searchInput: { flex: 1, fontSize: 14 },
  chipsRow: {
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderBottomWidth: 1,
    flexWrap: 'wrap',
  },
  chip: {
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 5,
    backgroundColor: '#F3F1EB',
  },
  chipText: { fontSize: 12, fontWeight: '700' },
  countText: { fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 },
  list: { paddingHorizontal: 14, paddingTop: 10, paddingBottom: 32, gap: 10 },
  emptyWrap: { alignItems: 'center', paddingVertical: 56, gap: 12 },
  emptyTitle: { fontSize: 17, fontWeight: '800' },
  emptySubtitle: { fontSize: 13, textAlign: 'center', lineHeight: 20 },
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
  card: {
    flexDirection: 'row',
    borderWidth: 1,
    borderRadius: 14,
    overflow: 'hidden',
  },
  strip: { width: 4, flexShrink: 0 },
  cardBody: { flex: 1, padding: 12, gap: 8 },
  titleRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  assignTitle: { flex: 1, fontSize: 14, fontWeight: '700', lineHeight: 19 },
  scoreText: { fontSize: 20, fontWeight: '900', flexShrink: 0 },
  metaRow: { flexDirection: 'row', gap: 6, flexWrap: 'wrap' },
  subjectBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  subjectText: { fontSize: 11, fontWeight: '700' },
  gradeBadge: { borderRadius: 999, paddingHorizontal: 8, paddingVertical: 3 },
  gradeText: { fontSize: 11, fontWeight: '800' },
  footerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  dateText: { fontSize: 11 },
  statusBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, borderRadius: 999, paddingHorizontal: 8, paddingVertical: 3 },
  statusDot: { width: 6, height: 6, borderRadius: 3 },
  statusText: { fontSize: 11, fontWeight: '700' },
});
