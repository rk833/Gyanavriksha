import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import axios from 'axios';

import { useApi } from '../../hooks/useApi';
import { useAppTheme } from '../../context/ThemeContext';

// ─── Types ────────────────────────────────────────────────────────────────────

// Matches backend QuizQuestionSchema
type QuizQuestion = {
  question_id: string;
  question_text: string;
  question_type?: string;
  options: string[] | null;
  correct_answer?: string;
  explanation?: string | null;
  difficulty?: string;
  order_num: number;
};

// Matches backend MicroQuizSchema
type QuizItem = {
  quiz_id: string;
  student_id?: string;
  subject_id?: number;
  subject_name?: string | null;
  concept_targeted?: string;
  total_questions?: number;
  status?: string;
  score_percentage?: number | null;
  completed_at?: string | null;
  created_at?: string;
  questions?: QuizQuestion[] | null;
};

type QuizListResponse = {
  items?: QuizItem[];
  quizzes?: QuizItem[];
  total?: number;
};

type QuizDetailResponse = QuizItem & {
  questions: QuizQuestion[];
};

// Matches backend QuizGenerateRequest (subject_id + concept required)
type GenerateResponse = QuizItem;

// Matches backend MicroQuizSubmitResponse
type SubmitResponse = {
  quiz: QuizItem;
  correct_count: number;
  total_questions: number;
  knowledge_gap_resolved: boolean;
};

// Matches backend KnowledgeGapResponse
type GapItem = {
  gap_id?: string;
  concept_name?: string;
  topic_tag?: string;
  recurrence_count?: number;
  is_resolved?: boolean;
  detected_at?: string;
  subject_id?: number;
  subject_name?: string | null;
  quiz_id?: string | null;
};

type GapsResponse = {
  items?: GapItem[];
  gaps?: GapItem[];
  total?: number;
};

// Matches backend KnowledgeGapSummary
type GapsSummaryResponse = {
  total_gaps?: number;
  gaps_resolved?: number;
  gaps_pending?: number;
};

// For enrollments / subject picker
type SubjectItem = {
  subject_id: number;
  subject_name: string;
};

type EnrollmentResponse = {
  items?: { subject_id: number; subject_name: string }[];
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function parseApiError(error: unknown, fallback: string) {
  if (axios.isAxiosError(error)) {
    const detail = error.response?.data?.detail;
    if (typeof detail === 'string' && detail.trim().length > 0) return detail;
  }
  if (error instanceof Error && error.message.trim().length > 0)
    return error.message;
  return fallback;
}

/** Backend `MicroQuizStatus`: ASSIGNED | IN_PROGRESS | COMPLETED (Pydantic emits uppercase strings). */
function isQuizCompleted(status?: string | null): boolean {
  if (!status || typeof status !== 'string') return false;
  const n = status.trim().toUpperCase();
  return n === 'COMPLETED' || n === 'SUBMITTED';
}

// Use recurrence_count as urgency: high ≥ 3, medium = 2, low = 1
function recurrenceBadgeStyle(count?: number) {
  if (!count || count <= 0) return { bg: '#DCFCE7', text: '#15803D', label: 'Resolved' };
  if (count >= 3) return { bg: '#FEE2E2', text: '#B91C1C', label: 'High' };
  if (count === 2) return { bg: '#FEF3C7', text: '#B45309', label: 'Medium' };
  return { bg: '#EDE9FE', text: '#7C3AED', label: 'Low' };
}

function scoreColor(pct: number) {
  if (pct >= 75) return '#15803D';
  if (pct >= 50) return '#B45309';
  return '#B91C1C';
}

// ─── Sub-screens ──────────────────────────────────────────────────────────────

// answers: qIdx → selected option index (0-based) within q.options
type QuizInProgressState = {
  quiz: QuizDetailResponse;
  answers: Record<number, number>;
  submitted: boolean;
  submitResult: SubmitResponse | null;
};

function QuizInProgressView({
  state,
  onAnswer,
  onSubmit,
  onBack,
  onRetry,
  isSubmitting,
  theme,
}: {
  state: QuizInProgressState;
  onAnswer: (qIdx: number, optionIdx: number) => void;
  onSubmit: () => void;
  onBack: () => void;
  onRetry: () => void;
  isSubmitting: boolean;
  theme: ReturnType<typeof useAppTheme>['theme'];
}) {
  const { quiz, answers, submitted, submitResult } = state;
  const questions = quiz.questions ?? [];
  const answeredCount = Object.keys(answers).length;

  if (submitted && submitResult) {
    const pct =
      submitResult.total_questions > 0
        ? Math.round((submitResult.correct_count / submitResult.total_questions) * 100)
        : 0;
    return (
      <ScrollView contentContainerStyle={styles.quizResultContent}>
        <View style={[styles.resultCard, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
          <View style={[styles.resultScoreBadge, { backgroundColor: theme.colors.primarySoft }]}>
            <Text style={[styles.resultScoreText, { color: theme.colors.primary }]}>
              {submitResult.correct_count}/{submitResult.total_questions}
            </Text>
            <Text style={[styles.resultPctText, { color: theme.colors.primary }]}>
              {pct}%
            </Text>
          </View>
          <Text style={[styles.resultTitle, { color: theme.colors.primary }]}>
            {pct >= 75 ? 'Great work!' : pct >= 50 ? 'Good effort!' : 'Keep practising!'}
          </Text>
          {submitResult.knowledge_gap_resolved ? (
            <Text style={[styles.resultFeedback, { color: '#15803D' }]}>
              A knowledge gap was resolved by this quiz.
            </Text>
          ) : null}
          <View style={styles.resultActions}>
            <TouchableOpacity
              style={[
                styles.retryButton,
                { borderColor: theme.colors.primary, backgroundColor: theme.colors.surface },
              ]}
              activeOpacity={0.85}
              onPress={onRetry}
            >
              <Text style={[styles.retryButtonText, { color: theme.colors.primary }]}>Retry Quiz</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.backButton, { backgroundColor: theme.colors.primary }]}
              activeOpacity={0.85}
              onPress={onBack}
            >
              <Text style={styles.backButtonText}>Back to Quizzes</Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.quizContent} showsVerticalScrollIndicator={false}>
      <View style={[styles.quizProgressBar, { backgroundColor: theme.colors.border }]}>
        <View
          style={[
            styles.quizProgressFill,
            {
              backgroundColor: theme.colors.primary,
              width: `${questions.length > 0 ? (answeredCount / questions.length) * 100 : 0}%`,
            },
          ]}
        />
      </View>
      <Text style={[styles.quizProgressLabel, { color: theme.colors.muted }]}>
        {answeredCount}/{questions.length} answered
      </Text>

      {questions.map((q, idx) => (
        <View
          key={q.question_id ?? idx}
          style={[styles.questionCard, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}
        >
          <Text style={[styles.questionNumber, { color: theme.colors.muted }]}>
            Q{idx + 1}
          </Text>
          <Text style={[styles.questionText, { color: theme.colors.primary }]}>
            {q.question_text}
          </Text>
          <View style={styles.optionsList}>
            {(q.options ?? []).map((opt, oIdx) => {
              const selected = answers[idx] === oIdx;
              return (
                <TouchableOpacity
                  key={oIdx}
                  style={[
                    styles.optionButton,
                    {
                      borderColor: selected ? theme.colors.primary : theme.colors.border,
                      backgroundColor: selected ? theme.colors.primarySoft : theme.colors.surface,
                    },
                  ]}
                  activeOpacity={0.8}
                  onPress={() => onAnswer(idx, oIdx)}
                >
                  <View
                    style={[
                      styles.optionDot,
                      {
                        borderColor: selected ? theme.colors.primary : theme.colors.border,
                        backgroundColor: selected ? theme.colors.primary : 'transparent',
                      },
                    ]}
                  />
                  <Text style={[styles.optionText, { color: selected ? theme.colors.primary : theme.colors.text }]}>
                    {opt}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>
      ))}

      <TouchableOpacity
        style={[
          styles.submitButton,
          {
            backgroundColor:
              answeredCount === questions.length && !isSubmitting
                ? theme.colors.primary
                : theme.colors.border,
          },
        ]}
        activeOpacity={0.85}
        onPress={onSubmit}
        disabled={answeredCount < questions.length || isSubmitting}
      >
        {isSubmitting ? (
          <ActivityIndicator color="#FFFFFF" />
        ) : (
          <Text style={styles.submitButtonText}>
            {answeredCount < questions.length
              ? `Answer all ${questions.length} questions to submit`
              : 'Submit Quiz'}
          </Text>
        )}
      </TouchableOpacity>
    </ScrollView>
  );
}

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function QuizAndGapsScreen() {
  const { get, post } = useApi();
  const { theme } = useAppTheme();

  type Tab = 'quizzes' | 'gaps';
  const [activeTab, setActiveTab] = useState<Tab>('quizzes');

  // Quizzes state
  const [quizzes, setQuizzes] = useState<QuizItem[]>([]);
  const [quizzesLoading, setQuizzesLoading] = useState(true);
  const [quizzesError, setQuizzesError] = useState<string | null>(null);
  const [generatingQuiz, setGeneratingQuiz] = useState(false);
  const [quizInProgress, setQuizInProgress] = useState<QuizInProgressState | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Generate quiz form
  const [subjects, setSubjects] = useState<SubjectItem[]>([]);
  const [genSubjectId, setGenSubjectId] = useState<number | null>(null);
  const [genConcept, setGenConcept] = useState('');
  const [showGenForm, setShowGenForm] = useState(false);

  // Gaps state
  const [gaps, setGaps] = useState<GapItem[]>([]);
  const [gapsSummary, setGapsSummary] = useState<GapsSummaryResponse | null>(null);
  const [gapsLoading, setGapsLoading] = useState(false);
  const [gapsError, setGapsError] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // ── Data fetching ──

  const loadQuizzes = useCallback(async () => {
    setQuizzesError(null);
    try {
      const res = await get<QuizListResponse>('/api/students/quizzes?page=1&per_page=100');
      setQuizzes(res.items ?? res.quizzes ?? []);
    } catch (err) {
      setQuizzesError(parseApiError(err, 'Could not load quizzes.'));
    } finally {
      setQuizzesLoading(false);
    }
  }, [get]);

  const loadGaps = useCallback(async () => {
    setGapsError(null);
    setGapsLoading(true);
    try {
      const [gapsRes, summaryRes] = await Promise.all([
        get<GapsResponse>('/api/students/knowledge-gaps'),
        get<GapsSummaryResponse>('/api/students/knowledge-gaps/summary').catch(() => null),
      ]);
      setGaps(gapsRes.items ?? gapsRes.gaps ?? []);
      if (summaryRes) setGapsSummary(summaryRes);
    } catch (err) {
      setGapsError(parseApiError(err, 'Could not load knowledge gaps.'));
    } finally {
      setGapsLoading(false);
    }
  }, [get]);

  const loadSubjects = useCallback(async () => {
    try {
      const res = await get<EnrollmentResponse>('/api/students/enrollments');
      const items = res.items ?? [];
      const mapped: SubjectItem[] = items.map((e) => ({
        subject_id: e.subject_id,
        subject_name: e.subject_name,
      }));
      setSubjects(mapped);
      if (mapped.length > 0 && genSubjectId === null) {
        setGenSubjectId(mapped[0].subject_id);
      }
    } catch {
      // Subjects are optional for the generate form
    }
  }, [genSubjectId, get]);

  useEffect(() => {
    void loadQuizzes();
    void loadSubjects();
  }, [loadQuizzes, loadSubjects]);

  const gapsLoadedRef = useRef(false);
  useEffect(() => {
    if (activeTab === 'gaps' && !gapsLoadedRef.current) {
      gapsLoadedRef.current = true;
      void loadGaps();
    }
  }, [activeTab, loadGaps]);

  const onRefresh = useCallback(async () => {
    setIsRefreshing(true);
    if (activeTab === 'quizzes') {
      await loadQuizzes();
    } else {
      await loadGaps();
    }
    setIsRefreshing(false);
  }, [activeTab, loadQuizzes, loadGaps]);

  // ── Quiz actions ──

  const openQuiz = useCallback(
    async (quizId: string) => {
      try {
        const detail = await get<QuizDetailResponse>(`/api/students/quizzes/${quizId}`);
        if (isQuizCompleted(detail.status) && detail.score_percentage != null) {
          const total =
            typeof detail.total_questions === 'number' && detail.total_questions > 0
              ? detail.total_questions
              : (detail.questions?.length ?? 0);
          const pct = detail.score_percentage;
          const approxCorrect =
            total > 0 ? Math.min(total, Math.max(0, Math.round((pct / 100) * total))) : 0;
          setQuizInProgress({
            quiz: detail,
            answers: {},
            submitted: true,
            submitResult: {
              quiz: detail,
              correct_count: approxCorrect,
              total_questions: Math.max(total, 1),
              knowledge_gap_resolved: false,
            },
          });
          return;
        }
        setQuizInProgress({
          quiz: detail,
          answers: {},
          submitted: false,
          submitResult: null,
        });
      } catch (err) {
        Alert.alert('Error', parseApiError(err, 'Could not load quiz questions.'));
      }
    },
    [get]
  );

  const generateQuiz = useCallback(async () => {
    if (!genSubjectId) {
      Alert.alert('Subject required', 'Please select a subject first.');
      return;
    }
    const concept = genConcept.trim();
    if (!concept) {
      Alert.alert('Concept required', 'Please enter a concept or topic to quiz on.');
      return;
    }

    setGeneratingQuiz(true);
    setShowGenForm(false);
    try {
      const res = await post<GenerateResponse>('/api/students/quizzes/generate', {
        subject_id: genSubjectId,
        concept,
        num_questions: 5,
      });
      const detail = await get<QuizDetailResponse>(`/api/students/quizzes/${res.quiz_id}`);
      setQuizInProgress({
        quiz: detail,
        answers: {},
        submitted: false,
        submitResult: null,
      });
      setGenConcept('');
      await loadQuizzes();
    } catch (err) {
      Alert.alert('Error', parseApiError(err, 'Could not generate a quiz right now.'));
    } finally {
      setGeneratingQuiz(false);
    }
  }, [genConcept, genSubjectId, get, loadQuizzes, post]);

  const handleAnswer = useCallback((qIdx: number, optionIdx: number) => {
    setQuizInProgress((prev) =>
      prev ? { ...prev, answers: { ...prev.answers, [qIdx]: optionIdx } } : prev
    );
  }, []);

  const handleSubmit = useCallback(async () => {
    if (!quizInProgress) return;
    const { quiz, answers } = quizInProgress;
    setIsSubmitting(true);
    try {
      // Backend expects answers: list[Optional[int]] — one selected option index per
      // question, sorted by order_num. null = skipped.
      const sortedQuestions = [...(quiz.questions ?? [])].sort(
        (a, b) => a.order_num - b.order_num
      );
      const answerList: (number | null)[] = sortedQuestions.map((_, idx) =>
        answers[idx] != null ? answers[idx] : null
      );
      const result = await post<SubmitResponse>(
        `/api/students/quizzes/${quiz.quiz_id}/submit`,
        { answers: answerList }
      );
      setQuizInProgress((prev) =>
        prev ? { ...prev, submitted: true, submitResult: result } : prev
      );
      await loadQuizzes();
    } catch (err) {
      Alert.alert('Submit failed', parseApiError(err, 'Could not submit the quiz.'));
    } finally {
      setIsSubmitting(false);
    }
  }, [loadQuizzes, post, quizInProgress]);

  const handleRetryQuiz = useCallback(() => {
    setQuizInProgress((prev) =>
      prev ? { ...prev, answers: {}, submitted: false, submitResult: null } : prev
    );
  }, []);

  // ── Computed ──

  const quizStats = useMemo(() => {
    const completed = quizzes.filter((q) => isQuizCompleted(q.status));
    const withScore = completed.filter((q) => q.score_percentage != null);
    const avgScore =
      withScore.length > 0
        ? withScore.reduce((sum, q) => sum + (q.score_percentage ?? 0), 0) / withScore.length
        : null;
    return { total: quizzes.length, completed: completed.length, avgScore };
  }, [quizzes]);

  // ── Render quiz in progress ──

  if (quizInProgress) {
    return (
      <SafeAreaView
        style={[styles.safeArea, { backgroundColor: theme.colors.screen }]}
        edges={['top', 'left', 'right']}
      >
        <View
          style={[
            styles.quizHeader,
            { backgroundColor: theme.colors.surface, borderBottomColor: theme.colors.border },
          ]}
        >
          <TouchableOpacity
            style={[styles.backChevron, { backgroundColor: theme.colors.primarySoft }]}
            activeOpacity={0.8}
            onPress={() => setQuizInProgress(null)}
          >
            <MaterialIcons name="arrow-back" size={18} color={theme.colors.primary} />
          </TouchableOpacity>
          <View style={styles.quizHeaderText}>
            <Text style={[styles.quizHeaderTitle, { color: theme.colors.primary }]} numberOfLines={1}>
              {quizInProgress.quiz.concept_targeted ?? 'Micro Quiz'}
            </Text>
            {quizInProgress.quiz.subject_name ? (
              <Text style={[styles.quizHeaderSub, { color: theme.colors.muted }]}>
                {quizInProgress.quiz.subject_name}
              </Text>
            ) : null}
          </View>
        </View>
        <QuizInProgressView
          state={quizInProgress}
          onAnswer={handleAnswer}
          onSubmit={() => void handleSubmit()}
          onBack={() => setQuizInProgress(null)}
          onRetry={handleRetryQuiz}
          isSubmitting={isSubmitting}
          theme={theme}
        />
      </SafeAreaView>
    );
  }

  // ── Render main screen ──

  return (
    <SafeAreaView
      style={[styles.safeArea, { backgroundColor: theme.colors.screen }]}
      edges={['top', 'left', 'right']}
    >
      {/* Page header */}
      <View
        style={[
          styles.pageHeader,
          { backgroundColor: theme.colors.surface, borderBottomColor: theme.colors.border },
        ]}
      >
        <View style={[styles.pageHeaderIcon, { backgroundColor: theme.colors.primarySoft }]}>
          <MaterialIcons name="quiz" size={20} color={theme.colors.primary} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[styles.pageHeaderSub, { color: theme.colors.muted }]}>Learn & Practice</Text>
          <Text style={[styles.pageHeaderTitle, { color: theme.colors.primary }]}>Quizzes & Gaps</Text>
        </View>
      </View>

      {/* Tab bar */}
      <View
        style={[
          styles.tabBar,
          { backgroundColor: theme.colors.surface, borderBottomColor: theme.colors.border },
        ]}
      >
        {(['quizzes', 'gaps'] as Tab[]).map((tab) => (
          <TouchableOpacity
            key={tab}
            style={[
              styles.tabBarItem,
              activeTab === tab
                ? [styles.tabBarItemActive, { borderBottomColor: theme.colors.primary }]
                : null,
            ]}
            activeOpacity={0.8}
            onPress={() => setActiveTab(tab)}
          >
            <MaterialIcons
              name={tab === 'quizzes' ? 'quiz' : 'psychology'}
              size={18}
              color={activeTab === tab ? theme.colors.primary : theme.colors.inactive}
            />
            <Text
              style={[
                styles.tabBarLabel,
                { color: activeTab === tab ? theme.colors.primary : theme.colors.muted },
              ]}
            >
              {tab === 'quizzes' ? 'Micro Quizzes' : 'Knowledge Gaps'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* ── Quizzes Tab ── */}
      {activeTab === 'quizzes' && (
        <ScrollView
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={isRefreshing} onRefresh={() => void onRefresh()} tintColor={theme.colors.primary} />
          }
        >
          {/* Stats row */}
          <View style={styles.statsRow}>
            <View style={[styles.statCard, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
              <Text style={[styles.statValue, { color: theme.colors.primary }]}>{quizStats.total}</Text>
              <Text style={[styles.statLabel, { color: theme.colors.muted }]}>Total</Text>
            </View>
            <View style={[styles.statCard, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
              <Text style={[styles.statValue, { color: '#15803D' }]}>{quizStats.completed}</Text>
              <Text style={[styles.statLabel, { color: theme.colors.muted }]}>Completed</Text>
            </View>
            <View style={[styles.statCard, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
              <Text style={[styles.statValue, { color: '#8B5E1A' }]}>
                {quizStats.avgScore != null ? `${Math.round(quizStats.avgScore)}%` : '—'}
              </Text>
              <Text style={[styles.statLabel, { color: theme.colors.muted }]}>Avg Score</Text>
            </View>
          </View>

          {/* Generate form / button */}
          {showGenForm ? (
            <View style={[styles.genForm, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
              <Text style={[styles.genFormTitle, { color: theme.colors.primary }]}>Generate AI Quiz</Text>

              {/* Subject picker */}
              {subjects.length > 0 && (
                <View style={styles.genFormField}>
                  <Text style={[styles.genFormLabel, { color: theme.colors.muted }]}>Subject</Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.subjectChips}>
                    {subjects.map((s) => (
                      <TouchableOpacity
                        key={s.subject_id}
                        style={[
                          styles.subjectChip,
                          {
                            backgroundColor: genSubjectId === s.subject_id ? theme.colors.primary : theme.colors.primarySoft,
                            borderColor: genSubjectId === s.subject_id ? theme.colors.primary : theme.colors.border,
                          },
                        ]}
                        activeOpacity={0.8}
                        onPress={() => setGenSubjectId(s.subject_id)}
                      >
                        <Text style={[styles.subjectChipText, { color: genSubjectId === s.subject_id ? '#FFFFFF' : theme.colors.primary }]}>
                          {s.subject_name}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                </View>
              )}

              {/* Concept input */}
              <View style={styles.genFormField}>
                <Text style={[styles.genFormLabel, { color: theme.colors.muted }]}>Concept / Topic</Text>
                <TextInput
                  style={[styles.genFormInput, { borderColor: theme.colors.border, color: theme.colors.text, backgroundColor: theme.colors.screen }]}
                  placeholder="e.g. Newton's Laws, Photosynthesis…"
                  placeholderTextColor={theme.colors.muted}
                  value={genConcept}
                  onChangeText={setGenConcept}
                  maxLength={100}
                />
              </View>

              <View style={styles.genFormActions}>
                <TouchableOpacity
                  style={[styles.genFormCancel, { borderColor: theme.colors.border }]}
                  onPress={() => setShowGenForm(false)}
                >
                  <Text style={[styles.genFormCancelText, { color: theme.colors.muted }]}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.genFormSubmit, { backgroundColor: theme.colors.primary }]}
                  activeOpacity={0.85}
                  onPress={() => void generateQuiz()}
                  disabled={generatingQuiz || !genConcept.trim()}
                >
                  {generatingQuiz ? (
                    <ActivityIndicator color="#FFFFFF" />
                  ) : (
                    <Text style={styles.genFormSubmitText}>Generate</Text>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          ) : (
            <TouchableOpacity
              style={[styles.generateButton, { backgroundColor: theme.colors.primary }]}
              activeOpacity={0.85}
              onPress={() => setShowGenForm(true)}
              disabled={generatingQuiz}
            >
              {generatingQuiz ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <>
                  <MaterialIcons name="auto-awesome" size={18} color="#FFFFFF" />
                  <Text style={styles.generateButtonText}>Generate AI Quiz</Text>
                </>
              )}
            </TouchableOpacity>
          )}

          {/* Quiz list */}
          {quizzesLoading ? (
            <ActivityIndicator color={theme.colors.primary} style={{ marginTop: 24 }} />
          ) : quizzesError ? (
            <View style={[styles.errorCard, { borderColor: '#FECACA', backgroundColor: '#FFF1F2' }]}>
              <Text style={styles.errorText}>{quizzesError}</Text>
              <TouchableOpacity onPress={() => void loadQuizzes()}>
                <Text style={[styles.retryText, { color: theme.colors.primary }]}>Retry</Text>
              </TouchableOpacity>
            </View>
          ) : quizzes.length === 0 ? (
            <View style={styles.emptyWrap}>
              <MaterialIcons name="quiz" size={40} color={theme.colors.muted} />
              <Text style={[styles.emptyTitle, { color: theme.colors.primary }]}>No quizzes yet</Text>
              <Text style={[styles.emptySubtitle, { color: theme.colors.muted }]}>
                Generate your first AI quiz to test your knowledge.
              </Text>
            </View>
          ) : (
            quizzes.map((quiz) => {
              const done = isQuizCompleted(quiz.status);
              return (
                <TouchableOpacity
                  key={quiz.quiz_id}
                  style={[
                    styles.quizCard,
                    { backgroundColor: theme.colors.surface, borderColor: theme.colors.border },
                  ]}
                  activeOpacity={0.85}
                  onPress={() => void openQuiz(quiz.quiz_id)}
                >
                  <View style={styles.quizCardLeft}>
                    <View
                      style={[
                        styles.quizCardIcon,
                        { backgroundColor: done ? '#DCFCE7' : theme.colors.primarySoft },
                      ]}
                    >
                      <MaterialIcons
                        name={done ? 'check-circle' : 'quiz'}
                        size={20}
                        color={done ? '#15803D' : theme.colors.primary}
                      />
                    </View>
                    <View style={styles.quizCardText}>
                      <Text
                        style={[styles.quizCardTitle, { color: theme.colors.primary }]}
                        numberOfLines={1}
                      >
                        {quiz.concept_targeted ?? `Quiz ${quiz.quiz_id.slice(0, 6)}`}
                      </Text>
                      <Text style={[styles.quizCardMeta, { color: theme.colors.muted }]}>
                        {quiz.total_questions ?? '?'} questions
                      </Text>
                      {done && quiz.score_percentage != null ? (
                        <Text
                          style={[
                            styles.quizCardScore,
                            { color: scoreColor(quiz.score_percentage) },
                          ]}
                        >
                          Score: {Math.round(quiz.score_percentage)}%
                        </Text>
                      ) : null}
                    </View>
                  </View>
                  <MaterialIcons
                    name={done ? 'replay' : 'play-arrow'}
                    size={22}
                    color={theme.colors.primary}
                  />
                </TouchableOpacity>
              );
            })
          )}
        </ScrollView>
      )}

      {/* ── Knowledge Gaps Tab ── */}
      {activeTab === 'gaps' && (
        <ScrollView
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={isRefreshing} onRefresh={() => void onRefresh()} tintColor={theme.colors.primary} />
          }
        >
          {/* Summary */}
          {gapsSummary && (
            <View
              style={[
                styles.summaryCard,
                { backgroundColor: theme.colors.primary },
              ]}
            >
              <View style={styles.summaryGlow} />
              <Text style={styles.summaryLabel}>Knowledge Gaps Summary</Text>
              <View style={styles.summaryRow}>
                <View style={styles.summaryStat}>
                  <Text style={styles.summaryStatValue}>{gapsSummary.total_gaps ?? gaps.length}</Text>
                  <Text style={styles.summaryStatLabel}>Total</Text>
                </View>
                {gapsSummary.gaps_pending != null && (
                  <View style={styles.summaryStat}>
                    <Text style={[styles.summaryStatValue, { color: '#FCA5A5' }]}>
                      {gapsSummary.gaps_pending}
                    </Text>
                    <Text style={styles.summaryStatLabel}>Pending</Text>
                  </View>
                )}
                {gapsSummary.gaps_resolved != null && (
                  <View style={styles.summaryStat}>
                    <Text style={[styles.summaryStatValue, { color: '#86EFAC' }]}>
                      {gapsSummary.gaps_resolved}
                    </Text>
                    <Text style={styles.summaryStatLabel}>Resolved</Text>
                  </View>
                )}
              </View>
            </View>
          )}

          {gapsLoading ? (
            <ActivityIndicator color={theme.colors.primary} style={{ marginTop: 24 }} />
          ) : gapsError ? (
            <View style={[styles.errorCard, { borderColor: '#FECACA', backgroundColor: '#FFF1F2' }]}>
              <Text style={styles.errorText}>{gapsError}</Text>
              <TouchableOpacity onPress={() => void loadGaps()}>
                <Text style={[styles.retryText, { color: theme.colors.primary }]}>Retry</Text>
              </TouchableOpacity>
            </View>
          ) : gaps.length === 0 ? (
            <View style={styles.emptyWrap}>
              <MaterialIcons name="psychology" size={40} color={theme.colors.muted} />
              <Text style={[styles.emptyTitle, { color: theme.colors.primary }]}>No gaps detected</Text>
              <Text style={[styles.emptySubtitle, { color: theme.colors.muted }]}>
                Submit assignments and take quizzes so the AI can identify areas to improve.
              </Text>
            </View>
          ) : (
            gaps.map((gap, idx) => {
              const badge = recurrenceBadgeStyle(gap.recurrence_count);
              const recurrenceBarPct = Math.min(100, ((gap.recurrence_count ?? 1) / 5) * 100);
              return (
                <View
                  key={gap.gap_id ?? idx}
                  style={[
                    styles.gapCard,
                    {
                      backgroundColor: theme.colors.surface,
                      borderColor: gap.is_resolved ? '#D1FAE5' : theme.colors.border,
                    },
                  ]}
                >
                  <View style={styles.gapCardHeader}>
                    <Text style={[styles.gapTopic, { color: theme.colors.primary }]} numberOfLines={2}>
                      {gap.concept_name ?? 'Untitled concept'}
                    </Text>
                    <View style={[styles.gapBadge, { backgroundColor: badge.bg }]}>
                      <Text style={[styles.gapBadgeText, { color: badge.text }]}>
                        {gap.is_resolved ? 'Resolved' : badge.label}
                      </Text>
                    </View>
                  </View>
                  {gap.topic_tag ? (
                    <Text style={[styles.gapSubject, { color: theme.colors.muted }]}>
                      {gap.topic_tag}
                      {gap.subject_name ? ` • ${gap.subject_name}` : ''}
                    </Text>
                  ) : (
                    <Text style={[styles.gapSubject, { color: theme.colors.muted }]}>
                      {gap.subject_name ?? 'General'}
                    </Text>
                  )}
                  {!gap.is_resolved && gap.recurrence_count != null && (
                    <View style={styles.gapProgress}>
                      <View
                        style={[styles.gapProgressTrack, { backgroundColor: theme.colors.border }]}
                      >
                        <View
                          style={[
                            styles.gapProgressFill,
                            { width: `${recurrenceBarPct}%`, backgroundColor: badge.text },
                          ]}
                        />
                      </View>
                      <Text style={[styles.gapProgressLabel, { color: badge.text }]}>
                        ×{gap.recurrence_count}
                      </Text>
                    </View>
                  )}
                </View>
              );
            })
          )}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  pageHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  pageHeaderIcon: {
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pageHeaderSub: { fontSize: 10, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.6 },
  pageHeaderTitle: { fontSize: 18, fontWeight: '900', marginTop: 1 },
  tabBar: {
    flexDirection: 'row',
    borderBottomWidth: 1,
  },
  tabBarItem: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 12,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  tabBarItemActive: { borderBottomWidth: 2 },
  tabBarLabel: { fontSize: 13, fontWeight: '700' },
  listContent: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 32,
    gap: 12,
  },
  statsRow: { flexDirection: 'row', gap: 10 },
  statCard: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 14,
    padding: 12,
    alignItems: 'center',
    gap: 4,
  },
  statValue: { fontSize: 22, fontWeight: '800' },
  statLabel: { fontSize: 10, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.6 },
  generateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderRadius: 14,
    paddingVertical: 14,
  },
  generateButtonText: { color: '#FFFFFF', fontSize: 15, fontWeight: '800' },
  quizCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderRadius: 14,
    padding: 14,
  },
  quizCardLeft: { flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 },
  quizCardIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  quizCardText: { flex: 1, gap: 2 },
  quizCardTitle: { fontSize: 14, fontWeight: '800' },
  quizCardMeta: { fontSize: 11 },
  quizCardScore: { fontSize: 12, fontWeight: '700', marginTop: 2 },
  emptyWrap: { alignItems: 'center', paddingVertical: 40, gap: 10 },
  emptyTitle: { fontSize: 18, fontWeight: '800' },
  emptySubtitle: { fontSize: 13, textAlign: 'center', lineHeight: 20 },
  errorCard: {
    borderWidth: 1,
    borderRadius: 14,
    padding: 14,
    gap: 8,
  },
  errorText: { color: '#9F1239', fontSize: 13 },
  retryText: { fontSize: 13, fontWeight: '700' },
  // Summary card
  summaryCard: {
    borderRadius: 14,
    padding: 18,
    overflow: 'hidden',
    gap: 12,
  },
  summaryGlow: {
    position: 'absolute',
    top: -30,
    right: -30,
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: 'rgba(255,255,255,0.14)',
  },
  summaryLabel: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  summaryRow: { flexDirection: 'row', gap: 24 },
  summaryStat: { gap: 2 },
  summaryStatValue: { color: '#FFFFFF', fontSize: 28, fontWeight: '800' },
  summaryStatLabel: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 11,
    fontWeight: '600',
  },
  // Generate form
  genForm: {
    borderWidth: 1,
    borderRadius: 16,
    padding: 16,
    gap: 14,
  },
  genFormTitle: { fontSize: 15, fontWeight: '800' },
  genFormField: { gap: 6 },
  genFormLabel: { fontSize: 10, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.8 },
  genFormInput: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
  },
  subjectChips: { gap: 8 },
  subjectChip: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  subjectChipText: { fontSize: 13, fontWeight: '700' },
  genFormActions: { flexDirection: 'row', gap: 10 },
  genFormCancel: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 10,
    paddingVertical: 11,
    alignItems: 'center',
  },
  genFormCancelText: { fontSize: 14, fontWeight: '700' },
  genFormSubmit: {
    flex: 1,
    borderRadius: 10,
    paddingVertical: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },
  genFormSubmitText: { color: '#FFFFFF', fontSize: 14, fontWeight: '800' },
  // Gap cards
  gapCard: {
    borderWidth: 1,
    borderRadius: 14,
    padding: 14,
    gap: 8,
  },
  gapCardHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  gapTopic: { flex: 1, fontSize: 15, fontWeight: '800', lineHeight: 21 },
  gapBadge: { borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 },
  gapBadgeText: { fontSize: 10, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.6 },
  gapSubject: { fontSize: 11, fontWeight: '600' },
  gapProgress: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  gapProgressTrack: { flex: 1, height: 6, borderRadius: 999, overflow: 'hidden' },
  gapProgressFill: { height: '100%', borderRadius: 999 },
  gapProgressLabel: { fontSize: 12, fontWeight: '700', width: 38, textAlign: 'right' },
  // Quiz in-progress
  quizHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderBottomWidth: 1,
    gap: 10,
  },
  backChevron: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
  },
  quizHeaderText: { flex: 1 },
  quizHeaderTitle: { fontSize: 16, fontWeight: '800' },
  quizHeaderSub: { fontSize: 11, marginTop: 1 },
  quizContent: { paddingHorizontal: 16, paddingTop: 14, paddingBottom: 32, gap: 14 },
  quizResultContent: {
    paddingHorizontal: 20,
    paddingTop: 40,
    paddingBottom: 32,
    alignItems: 'center',
  },
  resultCard: {
    width: '100%',
    borderWidth: 1,
    borderRadius: 20,
    padding: 24,
    alignItems: 'center',
    gap: 16,
  },
  resultScoreBadge: {
    borderRadius: 999,
    paddingHorizontal: 24,
    paddingVertical: 12,
    alignItems: 'center',
  },
  resultScoreText: { fontSize: 28, fontWeight: '800' },
  resultPctText: { fontSize: 14, fontWeight: '700' },
  resultTitle: { fontSize: 22, fontWeight: '800' },
  resultFeedback: { fontSize: 13, lineHeight: 20, textAlign: 'center' },
  resultActions: { width: '100%', gap: 12, marginTop: 4 },
  retryButton: {
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 28,
    borderWidth: 2,
    alignItems: 'center',
    width: '100%',
  },
  retryButtonText: { fontSize: 14, fontWeight: '800' },
  backButton: { borderRadius: 14, paddingVertical: 12, paddingHorizontal: 28, width: '100%', alignItems: 'center' },
  backButtonText: { color: '#FFFFFF', fontSize: 14, fontWeight: '800' },
  quizProgressBar: {
    height: 6,
    borderRadius: 999,
    overflow: 'hidden',
  },
  quizProgressFill: { height: '100%', borderRadius: 999 },
  quizProgressLabel: { fontSize: 11, fontWeight: '700', textAlign: 'right' },
  questionCard: {
    borderWidth: 1,
    borderRadius: 16,
    padding: 16,
    gap: 10,
  },
  questionNumber: { fontSize: 10, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.8 },
  questionText: { fontSize: 15, fontWeight: '700', lineHeight: 22 },
  optionsList: { gap: 8 },
  optionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderWidth: 1.5,
    borderRadius: 12,
    padding: 12,
  },
  optionDot: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 2,
    flexShrink: 0,
  },
  optionText: { flex: 1, fontSize: 14, lineHeight: 20 },
  submitButton: {
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  submitButtonText: { color: '#FFFFFF', fontSize: 15, fontWeight: '800' },
});
