import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, RefreshControl, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import axios from 'axios';

import ScreenHeader from '../../components/ScreenHeader';
import { useApi } from '../../hooks/useApi';

type ResultNavigation = {
  navigate: (screenName: string, params?: Record<string, unknown>) => void;
  goBack?: () => void;
};

type ResultRoute = {
  params?: {
    submissionId?: string;
  };
};

type SubmissionResultScreenProps = {
  navigation: ResultNavigation;
  route?: ResultRoute;
};

type SubmissionDetail = {
  submission_id: string;
  assignment_id?: string;
  assignment_title?: string;
  subject_name?: string;
  processing_status?: string;
  score_percentage?: number | null;
  grade_classification?: string | null;
  feedback?: {
    overall_feedback?: string | null;
    strengths?: string | null;
    improvements?: string | null;
    step_by_step_corrections?: Array<Record<string, unknown>>;
  } | null;
};

type GradingResult = {
  processing_status?: string;
  score_percentage?: number | null;
  max_score?: number | null;
  feedback?: {
    overall_feedback?: string | null;
    step_by_step_corrections?: Array<Record<string, unknown>>;
  } | null;
  mentor_tip?: string | null;
  knowledge_gap?: {
    gap_id?: string;
    concept_name?: string;
    description?: string;
    subject_id?: number;
  } | null;
};

function statusUi(status: string) {
  const s = status.toLowerCase();
  if (s === 'done' || s === 'completed') return { label: 'Graded', bg: '#DCFCE7', fg: '#166534' };
  if (s === 'rejected') return { label: 'Rejected', bg: '#FEE2E2', fg: '#991B1B' };
  if (s === 'grading' || s === 'ocr' || s === 'queued') return { label: 'Grading', bg: '#DBEAFE', fg: '#1D4ED8' };
  return { label: status || 'Pending', bg: '#E2E8F0', fg: '#334155' };
}

export default function SubmissionResultScreen({ navigation, route }: SubmissionResultScreenProps) {
  const { get, post } = useApi();
  const submissionId = route?.params?.submissionId ?? '';

  const [detail, setDetail] = useState<SubmissionDetail | null>(null);
  const [grading, setGrading] = useState<GradingResult | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isTriggering, setIsTriggering] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!submissionId) return;
    setIsLoading(true);
    setError(null);
    try {
      const [detailRes, gradingRes] = await Promise.allSettled([
        get<SubmissionDetail>(`/api/students/submissions/${submissionId}`),
        get<GradingResult>(`/api/grading/submissions/${submissionId}/result`),
      ]);
      if (detailRes.status === 'fulfilled') {
        setDetail(detailRes.value);
      }
      if (gradingRes.status === 'fulfilled') {
        setGrading(gradingRes.value);
      }
      if (detailRes.status === 'rejected' && gradingRes.status === 'rejected') {
        setError('Could not load grading result.');
      }
    } catch {
      setError('Could not load grading result.');
    } finally {
      setIsLoading(false);
    }
  }, [get, submissionId]);

  useEffect(() => {
    void load();
  }, [load]);

  const processingStatus = (grading?.processing_status ?? detail?.processing_status ?? '').toLowerCase();
  const status = statusUi(processingStatus);
  const score = grading?.score_percentage ?? detail?.score_percentage ?? null;
  const assignmentId = detail?.assignment_id ?? '';
  const assignmentTitle = detail?.assignment_title ?? 'Assignment';
  const subjectName = detail?.subject_name ?? '';
  const aiSummary =
    grading?.feedback?.overall_feedback ??
    detail?.feedback?.overall_feedback ??
    null;
  const mentorTip = grading?.mentor_tip ?? null;
  const knowledgeGap = grading?.knowledge_gap ?? null;
  const steps = useMemo(() => {
    const src = grading?.feedback?.step_by_step_corrections ?? detail?.feedback?.step_by_step_corrections ?? [];
    return Array.isArray(src) ? src : [];
  }, [detail?.feedback?.step_by_step_corrections, grading?.feedback?.step_by_step_corrections]);

  const triggerGrading = useCallback(async () => {
    if (!submissionId || isTriggering) return;
    setIsTriggering(true);
    try {
      await post(`/api/grading/submissions/${submissionId}/process`);
      await load();
    } catch (err) {
      if (axios.isAxiosError(err)) {
        setError((err.response?.data as { detail?: string } | undefined)?.detail ?? 'Could not trigger grading.');
      } else {
        setError('Could not trigger grading.');
      }
    } finally {
      setIsTriggering(false);
    }
  }, [isTriggering, load, post, submissionId]);

  const onRefresh = useCallback(async () => {
    setIsRefreshing(true);
    try {
      await load();
    } finally {
      setIsRefreshing(false);
    }
  }, [load]);

  const goBack = useCallback(() => {
    if (navigation.goBack) {
      navigation.goBack();
    } else {
      navigation.navigate('SubmissionsListScreen');
    }
  }, [navigation]);

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      <ScreenHeader
        showBack
        onBackPress={goBack}
        title="Submission Result"
        subtitle={subjectName ? `${subjectName} · ${assignmentTitle}` : assignmentTitle}
      />
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={() => void onRefresh()}
            tintColor="#2563EB"
          />
        }
      >
        {isLoading ? (
          <View style={styles.loadingWrap}>
            <ActivityIndicator color="#2563EB" size="large" />
            <Text style={styles.loadingText}>Loading result...</Text>
          </View>
        ) : (
          <>
            <View style={styles.heroCard}>
              <View style={[styles.statusBadge, { backgroundColor: status.bg, borderColor: status.fg }]}>
                <MaterialIcons name="flag" size={12} color={status.fg} />
                <Text style={[styles.statusText, { color: status.fg }]}>{status.label}</Text>
              </View>
              <Text style={styles.scoreLabel}>Final score</Text>
              <View style={styles.scoreRow}>
                <Text style={styles.scoreValue}>{score != null ? `${Math.round(score)}%` : 'Pending'}</Text>
                {detail?.grade_classification ? (
                  <View style={styles.gradePill}>
                    <Text style={styles.gradePillText}>{detail.grade_classification}</Text>
                  </View>
                ) : null}
              </View>
              <Text style={styles.metaLine}>Submission ID: {submissionId.slice(0, 8)}...</Text>
            </View>

            {['queued', 'ocr', 'grading', ''].includes(processingStatus) ? (
              <View style={styles.pendingCard}>
                <View style={styles.sectionTitleRow}>
                  <MaterialIcons name="hourglass-top" size={16} color="#1E3A8A" />
                  <Text style={styles.pendingTitle}>Grading in progress</Text>
                </View>
                <Text style={styles.pendingBody}>Your submission is being processed. You can refresh or trigger processing now.</Text>
                <View style={styles.rowBtns}>
                  <TouchableOpacity style={styles.secondaryButton} activeOpacity={0.85} onPress={() => void load()}>
                    <Text style={styles.secondaryButtonText}>Refresh</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.primaryButton} activeOpacity={0.85} onPress={() => void triggerGrading()} disabled={isTriggering}>
                    <Text style={styles.primaryButtonText}>{isTriggering ? 'Processing...' : 'Process Now'}</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ) : null}

            {aiSummary ? (
              <View style={styles.card}>
                <View style={styles.sectionTitleRow}>
                  <MaterialIcons name="summarize" size={16} color="#0F172A" />
                  <Text style={styles.sectionTitle}>AI Feedback Summary</Text>
                </View>
                <Text style={styles.bodyText}>{aiSummary}</Text>
                {mentorTip ? <Text style={styles.tipText}>Tip: {mentorTip}</Text> : null}
              </View>
            ) : null}

            {steps.length > 0 ? (
              <View style={styles.card}>
                <View style={styles.sectionTitleRow}>
                  <MaterialIcons name="checklist" size={16} color="#0F172A" />
                  <Text style={styles.sectionTitle}>Step-by-Step Feedback</Text>
                </View>
                {steps.map((s, i) => {
                  const label = typeof s.step === 'string' ? s.step : typeof s.label === 'string' ? s.label : `Step ${i + 1}`;
                  const comment = typeof s.comment === 'string' ? s.comment : typeof s.description === 'string' ? s.description : '';
                  const correction = typeof s.correction === 'string' ? s.correction : '';
                  return (
                    <View key={`${label}-${i}`} style={styles.stepRow}>
                      <Text style={styles.stepLabel}>{i + 1}. {label}</Text>
                      {comment ? <Text style={styles.stepComment}>{comment}</Text> : null}
                      {correction ? <Text style={styles.stepCorrection}>Correction: {correction}</Text> : null}
                    </View>
                  );
                })}
              </View>
            ) : null}

            {knowledgeGap?.concept_name ? (
              <View style={styles.gapCard}>
                <Text style={styles.gapTitle}>Knowledge Gap Detected</Text>
                <Text style={styles.gapConcept}>{knowledgeGap.concept_name}</Text>
                {knowledgeGap.description ? <Text style={styles.gapDesc}>{knowledgeGap.description}</Text> : null}
                <TouchableOpacity
                  style={styles.gapBtn}
                  activeOpacity={0.85}
                  onPress={() => navigation.navigate('History')}
                >
                  <Text style={styles.gapBtnText}>Start Quiz</Text>
                </TouchableOpacity>
              </View>
            ) : null}

            {error ? <Text style={styles.error}>{error}</Text> : null}

            <View style={styles.rowBtns}>
              <TouchableOpacity
                style={styles.primaryButton}
                activeOpacity={0.85}
                onPress={() =>
                  navigation.navigate('SubmissionDetailsScreen', {
                    assignmentId,
                    assignmentTitle,
                  })
                }
                disabled={!assignmentId}
              >
                <Text style={styles.primaryButtonText}>View Submissions</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.secondaryButton} activeOpacity={0.85} onPress={() => navigation.navigate('Home')}>
                <Text style={styles.secondaryButtonText}>Back Home</Text>
              </TouchableOpacity>
            </View>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F1F5F9',
  },
  content: { padding: 16, gap: 14, paddingBottom: 30 },
  loadingWrap: { paddingVertical: 36, alignItems: 'center', gap: 10 },
  loadingText: { color: '#64748B', fontSize: 13, fontWeight: '600' },
  heroCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 18,
    gap: 8,
    shadowColor: '#0F172A',
    shadowOpacity: 0.08,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 10,
    elevation: 3,
  },
  statusBadge: {
    alignSelf: 'flex-start',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 5,
    alignItems: 'center',
  },
  statusText: { fontSize: 11, fontWeight: '800' },
  scoreLabel: { fontSize: 11, color: '#64748B', textTransform: 'uppercase', letterSpacing: 0.5, marginTop: 4 },
  scoreRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  scoreValue: { fontSize: 34, fontWeight: '900', color: '#0F172A' },
  gradePill: {
    backgroundColor: '#EFF6FF',
    borderColor: '#BFDBFE',
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  gradePillText: { color: '#1D4ED8', fontSize: 11, fontWeight: '800' },
  metaLine: { color: '#94A3B8', fontSize: 11, fontWeight: '600' },
  pendingCard: {
    backgroundColor: '#FFFFFF', borderRadius: 16, borderWidth: 1, borderColor: '#BFDBFE', padding: 16, gap: 10,
  },
  sectionTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  pendingTitle: { fontSize: 16, fontWeight: '800', color: '#1E3A8A' },
  pendingBody: { fontSize: 13, color: '#475569', lineHeight: 19 },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 16,
    gap: 12,
  },
  sectionTitle: { fontSize: 14, fontWeight: '800', color: '#0F172A' },
  bodyText: { fontSize: 13, color: '#334155', lineHeight: 20, marginTop: 2 },
  tipText: { marginTop: 8, fontSize: 12, color: '#1E3A8A', fontWeight: '600' },
  stepRow: { borderTopWidth: 1, borderTopColor: '#F1F5F9', paddingTop: 10, marginTop: 4 },
  stepLabel: { fontSize: 13, fontWeight: '700', color: '#0F172A' },
  stepComment: { marginTop: 3, fontSize: 12, color: '#475569' },
  stepCorrection: { marginTop: 4, fontSize: 12, color: '#B45309', fontWeight: '600' },
  gapCard: {
    backgroundColor: '#0F172A', borderRadius: 16, padding: 16, gap: 6,
  },
  gapTitle: { color: '#FDBA74', fontSize: 11, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.6 },
  gapConcept: { color: '#FFFFFF', fontSize: 16, fontWeight: '800' },
  gapDesc: { color: '#CBD5E1', fontSize: 12, lineHeight: 18 },
  gapBtn: {
    marginTop: 8, backgroundColor: '#1D4ED8', borderRadius: 10, paddingVertical: 10, alignItems: 'center',
  },
  gapBtnText: { color: '#FFFFFF', fontSize: 13, fontWeight: '800' },
  title: {
    fontSize: 20,
    fontWeight: '800',
    color: '#0F172A',
  },
  subtitle: {
    fontSize: 12,
    color: '#475569',
    lineHeight: 18,
  },
  primaryButton: {
    flex: 1,
    minHeight: 46,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#123A5F',
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '800',
  },
  secondaryButton: {
    flex: 1,
    minHeight: 46,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    backgroundColor: '#FFFFFF',
  },
  secondaryButtonText: {
    color: '#0F172A',
    fontSize: 14,
    fontWeight: '700',
  },
  rowBtns: { flexDirection: 'row', gap: 8, marginTop: 2 },
  error: { color: '#9F1239', fontSize: 12, fontWeight: '600', marginTop: 2 },
});
