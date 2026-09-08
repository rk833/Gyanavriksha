import React, { useCallback, useEffect, useRef, useState } from 'react';
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
import ScreenHeader from '../../components/ScreenHeader';

// ─── Types ─────────────────────────────────────────────────────────────────────

type ScoreDataPoint = {
  period: string;
  score: number;
  subject: string;
};

type TopicDifficulty = {
  topic: string;
  difficulty_score: number;
};

type ProgressGapItem = {
  gap_id: string;
  concept_name: string;
  topic_tag: string;
  subject_id: number;
  subject_name?: string | null;
  is_resolved: boolean;
};

type StudentProgressResponse = {
  average_score?: number | null;
  trend_percentage?: number | null;
  quizzes_completed?: number;
  active_streak?: number;
  score_progression?: ScoreDataPoint[];
  topic_difficulty?: TopicDifficulty[];
  at_risk_flag?: boolean;
  improvement_tips?: string[];
  recent_knowledge_gaps?: ProgressGapItem[];
};

type Period = 'weekly' | 'monthly';

// ─── Helpers ───────────────────────────────────────────────────────────────────

function parseApiError(error: unknown, fallback: string) {
  if (axios.isAxiosError(error)) {
    const d = error.response?.data?.detail;
    if (typeof d === 'string' && d.trim()) return d;
  }
  if (error instanceof Error && error.message.trim()) return error.message;
  return fallback;
}

function trendColor(trend?: number | null) {
  if (trend == null) return '#64748B';
  return trend >= 0 ? '#15803D' : '#B91C1C';
}

function trendIcon(trend?: number | null): keyof typeof MaterialIcons.glyphMap {
  if (trend == null) return 'remove';
  return trend >= 0 ? 'trending-up' : 'trending-down';
}

function scoreBarColor(score: number) {
  if (score >= 75) return '#15803D';
  if (score >= 50) return '#B45309';
  return '#B91C1C';
}

// ─── Skeleton ──────────────────────────────────────────────────────────────────

function Skeleton({ width, height, radius = 10 }: { width: number | `${number}%`; height: number; radius?: number }) {
  const pulse = useRef(new Animated.Value(0.3)).current;
  useEffect(() => {
    const a = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 0.7, duration: 800, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0.3, duration: 800, useNativeDriver: true }),
      ])
    );
    a.start();
    return () => a.stop();
  }, [pulse]);
  return <Animated.View style={[{ width, height, borderRadius: radius, backgroundColor: '#D9D6CF', opacity: pulse }]} />;
}

// ─── Mini bar chart ────────────────────────────────────────────────────────────

function MiniBarChart({ data, theme }: { data: ScoreDataPoint[]; theme: ReturnType<typeof useAppTheme>['theme'] }) {
  if (data.length === 0) {
    return (
      <View style={styles.emptyChart}>
        <MaterialIcons name="bar-chart" size={32} color={theme.colors.muted} />
        <Text style={[styles.emptyChartText, { color: theme.colors.muted }]}>No score data yet</Text>
      </View>
    );
  }

  const maxScore = Math.max(...data.map((d) => d.score), 1);

  return (
    <View style={styles.chartWrap}>
      {/* Y-axis labels */}
      <View style={styles.chartYAxis}>
        {[100, 75, 50, 25].map((v) => (
          <Text key={v} style={[styles.chartYLabel, { color: theme.colors.muted }]}>
            {v}
          </Text>
        ))}
      </View>
      {/* Bars */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chartBarsContent}>
        {data.map((point, idx) => {
          const barH = Math.max(4, (point.score / maxScore) * 120);
          const color = scoreBarColor(point.score);
          return (
            <View key={idx} style={styles.chartBarWrap}>
              <Text style={[styles.chartScore, { color }]}>{Math.round(point.score)}%</Text>
              <View style={[styles.chartBar, { height: barH, backgroundColor: color }]} />
              <Text style={[styles.chartPeriod, { color: theme.colors.muted }]} numberOfLines={1}>
                {point.period}
              </Text>
            </View>
          );
        })}
      </ScrollView>
    </View>
  );
}

// ─── Screen ────────────────────────────────────────────────────────────────────

export default function PerformanceScreen() {
  const { get } = useApi();
  const { theme } = useAppTheme();

  const [period, setPeriod] = useState<Period>('weekly');
  const [data, setData] = useState<StudentProgressResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(
    async (p: Period) => {
      setError(null);
      try {
        const res = await get<StudentProgressResponse>(`/api/students/progress?period=${p}`);
        setData(res);
      } catch (err) {
        setError(parseApiError(err, 'Could not load performance data.'));
      } finally {
        setIsLoading(false);
      }
    },
    [get]
  );

  useEffect(() => {
    setIsLoading(true);
    void load(period);
  }, [load, period]);

  const onRefresh = useCallback(async () => {
    setIsRefreshing(true);
    await load(period);
    setIsRefreshing(false);
  }, [load, period]);

  const scoreProgression = data?.score_progression ?? [];
  const topicDifficulty = data?.topic_difficulty ?? [];
  const gaps = data?.recent_knowledge_gaps ?? [];
  const tips = data?.improvement_tips ?? [];

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: theme.colors.screen }]} edges={['top', 'left', 'right']}>
      <ScreenHeader title="Performance" subtitle="Your Progress" showBack />
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={() => void onRefresh()} tintColor={theme.colors.primary} />}
      >
        {/* Period toggle */}
        <View style={[styles.periodRow, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
          {(['weekly', 'monthly'] as Period[]).map((p) => (
            <TouchableOpacity
              key={p}
              style={[styles.periodBtn, period === p && { backgroundColor: theme.colors.primary }]}
              activeOpacity={0.8}
              onPress={() => setPeriod(p)}
            >
              <Text style={[styles.periodBtnText, { color: period === p ? '#FFFFFF' : theme.colors.muted }]}>
                {p === 'weekly' ? 'Weekly' : 'Monthly'}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {isLoading ? (
          <View style={styles.skeletonStack}>
            <Skeleton width="100%" height={100} />
            <Skeleton width="100%" height={180} />
            <Skeleton width="100%" height={120} />
          </View>
        ) : error ? (
          <View style={styles.errorCard}>
            <MaterialIcons name="error-outline" size={28} color="#9F1239" />
            <Text style={styles.errorText}>{error}</Text>
            <TouchableOpacity style={[styles.retryBtn, { backgroundColor: theme.colors.primary }]} onPress={() => void load(period)}>
              <Text style={styles.retryBtnText}>Retry</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <>
            {/* Summary stats */}
            <View style={styles.statsGrid}>
              <View style={[styles.statCard, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
                <MaterialIcons name="grade" size={22} color={theme.colors.primary} />
                <Text style={[styles.statValue, { color: theme.colors.primary }]}>
                  {data?.average_score != null ? `${Math.round(data.average_score)}%` : '—'}
                </Text>
                <Text style={[styles.statLabel, { color: theme.colors.muted }]}>Avg Score</Text>
              </View>
              <View style={[styles.statCard, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
                <MaterialIcons name={trendIcon(data?.trend_percentage)} size={22} color={trendColor(data?.trend_percentage)} />
                <Text style={[styles.statValue, { color: trendColor(data?.trend_percentage) }]}>
                  {data?.trend_percentage != null ? `${data.trend_percentage > 0 ? '+' : ''}${Math.round(data.trend_percentage)}%` : '—'}
                </Text>
                <Text style={[styles.statLabel, { color: theme.colors.muted }]}>Trend</Text>
              </View>
              <View style={[styles.statCard, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
                <MaterialIcons name="quiz" size={22} color="#8B5E1A" />
                <Text style={[styles.statValue, { color: theme.colors.primary }]}>{data?.quizzes_completed ?? 0}</Text>
                <Text style={[styles.statLabel, { color: theme.colors.muted }]}>Quizzes</Text>
              </View>
              <View style={[styles.statCard, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
                <MaterialIcons name="local-fire-department" size={22} color="#DC2626" />
                <Text style={[styles.statValue, { color: theme.colors.primary }]}>{data?.active_streak ?? 0}</Text>
                <Text style={[styles.statLabel, { color: theme.colors.muted }]}>Streak (days)</Text>
              </View>
            </View>

            <View style={[styles.howCard, { backgroundColor: theme.colors.surfaceMuted, borderColor: theme.colors.border }]}>
              <Text style={[styles.howTitle, { color: theme.colors.primary }]}>How this is calculated</Text>
              <Text style={[styles.howBody, { color: theme.colors.text }]}>
                {`Average score: mean of all your graded assignment submissions.\n\n`}
                {`Trend: percent change between the last two ${
                  period === 'weekly' ? 'weeks' : 'months'
                } in the progression chart.\n\n`}
                {`Quizzes: micro-quizzes marked completed on the server.\n\n`}
                {`Streak: consecutive UTC calendar days with either a graded submission (status done) or a completed micro-quiz. If nothing is logged today yet, counting still starts from yesterday so your streak is not broken at the start of a new day.\n\n`}
                {`Score chart: weekly or monthly aggregates from stored progress snapshots; if those are missing, averages are computed from graded submissions by calendar week/month.`}
              </Text>
            </View>

            {/* At-risk flag */}
            {data?.at_risk_flag && (
              <View style={styles.atRiskBanner}>
                <MaterialIcons name="warning" size={18} color="#B45309" />
                <Text style={styles.atRiskText}>
                  You have been flagged as at-risk. Focus on your weakest topics to improve.
                </Text>
              </View>
            )}

            {/* Score progression chart */}
            <View style={[styles.card, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
              <Text style={[styles.cardTitle, { color: theme.colors.primary }]}>Score Progression</Text>
              <MiniBarChart data={scoreProgression} theme={theme} />
            </View>

            {/* Topic difficulty */}
            {topicDifficulty.length > 0 && (
              <View style={[styles.card, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
                <Text style={[styles.cardTitle, { color: theme.colors.primary }]}>Hardest Topics</Text>
                {topicDifficulty.slice(0, 6).map((t, idx) => {
                  const pct = Math.min(100, t.difficulty_score);
                  return (
                    <View key={idx} style={styles.topicRow}>
                      <Text style={[styles.topicName, { color: theme.colors.primary }]} numberOfLines={1}>{t.topic}</Text>
                      <View style={[styles.topicTrack, { backgroundColor: theme.colors.border }]}>
                        <View style={[styles.topicFill, { width: `${pct}%`, backgroundColor: scoreBarColor(100 - pct) }]} />
                      </View>
                      <Text style={[styles.topicPct, { color: theme.colors.muted }]}>{Math.round(pct)}%</Text>
                    </View>
                  );
                })}
              </View>
            )}

            {/* Improvement tips */}
            {tips.length > 0 && (
              <View style={[styles.card, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
                <Text style={[styles.cardTitle, { color: theme.colors.primary }]}>Improvement Tips</Text>
                {tips.map((tip, idx) => (
                  <View key={idx} style={styles.tipRow}>
                    <View style={[styles.tipDot, { backgroundColor: theme.colors.primary }]} />
                    <Text style={[styles.tipText, { color: theme.colors.text }]}>{tip}</Text>
                  </View>
                ))}
              </View>
            )}

            {/* Recent knowledge gaps */}
            {gaps.length > 0 && (
              <View style={[styles.card, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
                <Text style={[styles.cardTitle, { color: theme.colors.primary }]}>Recent Knowledge Gaps</Text>
                {gaps.map((gap) => (
                  <View key={gap.gap_id} style={[styles.gapRow, { borderTopColor: theme.colors.border }]}>
                    <View style={[styles.gapDot, { backgroundColor: gap.is_resolved ? '#DCFCE7' : '#FEE2E2' }]}>
                      <MaterialIcons name={gap.is_resolved ? 'check' : 'psychology'} size={14} color={gap.is_resolved ? '#15803D' : '#B91C1C'} />
                    </View>
                    <View style={styles.gapText}>
                      <Text style={[styles.gapConcept, { color: theme.colors.primary }]}>{gap.concept_name}</Text>
                      <Text style={[styles.gapMeta, { color: theme.colors.muted }]}>
                        {gap.topic_tag}{gap.subject_name ? ` • ${gap.subject_name}` : ''}
                      </Text>
                    </View>
                    {gap.is_resolved && (
                      <View style={styles.resolvedBadge}>
                        <Text style={styles.resolvedBadgeText}>Resolved</Text>
                      </View>
                    )}
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

const styles = StyleSheet.create({
  safe: { flex: 1 },
  content: { padding: 16, gap: 14, paddingBottom: 32 },
  periodRow: {
    flexDirection: 'row',
    borderWidth: 1,
    borderRadius: 12,
    overflow: 'hidden',
  },
  periodBtn: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
  },
  periodBtnText: { fontSize: 13, fontWeight: '700' },
  skeletonStack: { gap: 14 },
  errorCard: {
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
  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  statCard: {
    width: '47%',
    borderWidth: 1,
    borderRadius: 14,
    padding: 14,
    alignItems: 'center',
    gap: 6,
  },
  statValue: { fontSize: 24, fontWeight: '800' },
  statLabel: { fontSize: 10, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.6 },
  howCard: { borderWidth: 1, borderRadius: 14, padding: 14, gap: 8 },
  howTitle: { fontSize: 13, fontWeight: '800' },
  howBody: { fontSize: 12, lineHeight: 18 },
  atRiskBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    backgroundColor: '#FEF3C7',
    borderWidth: 1,
    borderColor: '#FDE68A',
    borderRadius: 12,
    padding: 12,
  },
  atRiskText: { flex: 1, color: '#B45309', fontSize: 13, lineHeight: 18 },
  card: { borderWidth: 1, borderRadius: 16, padding: 16, gap: 12 },
  cardTitle: { fontSize: 15, fontWeight: '800' },
  emptyChart: { alignItems: 'center', paddingVertical: 24, gap: 8 },
  emptyChartText: { fontSize: 13 },
  chartWrap: { flexDirection: 'row', gap: 6, height: 160 },
  chartYAxis: { justifyContent: 'space-between', paddingBottom: 22, paddingTop: 4 },
  chartYLabel: { fontSize: 9, fontWeight: '700', textAlign: 'right', width: 24 },
  chartBarsContent: { gap: 10, alignItems: 'flex-end', paddingBottom: 0 },
  chartBarWrap: { alignItems: 'center', gap: 4, width: 40 },
  chartScore: { fontSize: 9, fontWeight: '800' },
  chartBar: { width: 28, borderRadius: 6 },
  chartPeriod: { fontSize: 8, textAlign: 'center', fontWeight: '600' },
  topicRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  topicName: { width: 110, fontSize: 12, fontWeight: '600' },
  topicTrack: { flex: 1, height: 6, borderRadius: 999, overflow: 'hidden' },
  topicFill: { height: '100%', borderRadius: 999 },
  topicPct: { width: 30, fontSize: 11, fontWeight: '700', textAlign: 'right' },
  tipRow: { flexDirection: 'row', gap: 8, alignItems: 'flex-start' },
  tipDot: { width: 6, height: 6, borderRadius: 3, marginTop: 6, flexShrink: 0 },
  tipText: { flex: 1, fontSize: 13, lineHeight: 20 },
  gapRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingTop: 10, borderTopWidth: 1 },
  gapDot: { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  gapText: { flex: 1 },
  gapConcept: { fontSize: 13, fontWeight: '700' },
  gapMeta: { fontSize: 11, marginTop: 1 },
  resolvedBadge: { backgroundColor: '#DCFCE7', borderRadius: 999, paddingHorizontal: 8, paddingVertical: 3 },
  resolvedBadgeText: { color: '#15803D', fontSize: 10, fontWeight: '800' },
});
