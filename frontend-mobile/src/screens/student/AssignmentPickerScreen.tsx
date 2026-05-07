import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Modal,
  Platform,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import DateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { MaterialIcons } from '@expo/vector-icons';
import axios from 'axios';

import { useApi } from '../../hooks/useApi';
import { useAppTheme } from '../../context/ThemeContext';

type SubjectOption = {
  subject_id: number;
  subject_name: string;
};

type AssignmentItem = {
  assignment_id: string;
  title: string;
  subject_id?: number;
  subject_name?: string | null;
  due_date?: string | null;
  /** API field for exam assignments (student list). */
  is_exam_mode?: boolean | null;
  is_exam?: boolean | null;
  exam_mode?: boolean | null;
  grading_mode?: string | null;
  exam_duration_minutes?: number | null;
  exam_max_pauses?: number | null;
};

type PaginatedAssignmentsResponse = {
  items: AssignmentItem[];
  total: number;
  page: number;
  per_page: number;
  total_pages: number;
};

type Submission = {
  submission_id: string;
  assignment_id: string;
  submitted_at: string;
  processing_status: 'queued' | 'ocr' | 'grading' | 'done' | 'rejected';
  score_percentage: number | null;
};

type PaginatedSubmissionsResponse = {
  items: Submission[];
  total: number;
  page: number;
  per_page: number;
  total_pages: number;
};

type AssignmentWithSubmissions = AssignmentItem & {
  submissionCount: number;
  latestSubmission: Submission | null;
};

type AssignmentPickerNavigation = {
  navigate: (screenName: string, params?: Record<string, unknown>) => void;
};

type AssignmentPickerScreenProps = {
  navigation: AssignmentPickerNavigation;
};

const ASSIGNMENTS_PER_PAGE = 20;

function formatLocalYMD(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function parseDueYmd(value: string): Date {
  const d = new Date(`${value}T12:00:00`);
  return Number.isNaN(d.getTime()) ? new Date() : d;
}

function formatDueDate(value?: string | null) {
  if (!value) {
    return 'No due date';
  }

  const parsedDate = new Date(value);
  if (Number.isNaN(parsedDate.getTime())) {
    return value;
  }

  return parsedDate.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
  });
}

function getStatusColor(status: string, primary: string, muted: string, inactive: string): string {
  switch (status) {
    case 'done':
      return primary;
    case 'grading':
    case 'ocr':
      return primary;
    case 'queued':
      return muted;
    case 'rejected':
      return primary;
    default:
      return inactive;
  }
}

function getPrettyStatusLabel(status: string): string {
  switch (status) {
    case 'queued':
      return 'Submitted';
    case 'ocr':
      return 'Processing';
    case 'grading':
      return 'Grading';
    default:
      return status;
  }
}

function isExamAssignment(assignment: AssignmentItem) {
  return (
    assignment.is_exam_mode === true ||
    assignment.is_exam === true ||
    assignment.exam_mode === true ||
    assignment.grading_mode === 'exam'
  );
}

export default function AssignmentPickerScreen({ navigation }: AssignmentPickerScreenProps) {
  const { get } = useApi();
  const { theme } = useAppTheme();
  const [items, setItems] = useState<AssignmentWithSubmissions[]>([]);
  const [subjectOptions, setSubjectOptions] = useState<SubjectOption[]>([]);
  const [selectedSubjectId, setSelectedSubjectId] = useState<number | null>(null);
  const [dueDateFilter, setDueDateFilter] = useState('');
  const [showDuePicker, setShowDuePicker] = useState(false);
  const [pickerScratch, setPickerScratch] = useState(() => new Date());
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [pagination, setPagination] = useState({ lastPage: 0, totalPages: 0 });
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'All' | 'Open' | 'Submitted' | 'Exam'>('All');
  const loadingMoreRef = useRef(false);

  const loadSubjectOptions = useCallback(async () => {
    try {
      const list = await get<SubjectOption[]>('/api/students/subjects');
      setSubjectOptions(Array.isArray(list) ? list : []);
    } catch {
      setSubjectOptions([]);
    }
  }, [get]);

  const loadSubmissions = useCallback(
    async (assignmentIds: string[]): Promise<Map<string, { count: number; latest: Submission | null }>> => {
      const result = new Map<string, { count: number; latest: Submission | null }>();

      try {
        const response = await get<PaginatedSubmissionsResponse>('/api/students/submissions?page=1&per_page=100');
        const allSubmissions: Submission[] = response.items ?? [];

        // Group submissions by assignment_id
        const byAssignment = new Map<string, Submission[]>();
        allSubmissions.forEach((sub) => {
          const aid = sub?.assignment_id;
          if (typeof aid !== 'string' || aid.length === 0) {
            return;
          }
          if (!byAssignment.has(aid)) {
            byAssignment.set(aid, []);
          }
          byAssignment.get(aid)!.push(sub);
        });

        // Sort by submitted_at descending to get latest first
        byAssignment.forEach((submissions) => {
          submissions.sort((a, b) => new Date(b.submitted_at).getTime() - new Date(a.submitted_at).getTime());
        });

        // Build result map
        assignmentIds.forEach((id) => {
          const subs = byAssignment.get(id) || [];
          result.set(id, {
            count: subs.length,
            latest: subs[0] || null,
          });
        });
      } catch (error) {
        console.warn('Failed to load submissions:', error);
        // Continue without submission data
      }

      return result;
    },
    [get]
  );

  const enrichAssignments = useCallback(
    async (assignments: AssignmentItem[]): Promise<AssignmentWithSubmissions[]> => {
      const valid = assignments.filter(
        (a): a is AssignmentItem =>
          a != null &&
          typeof a.assignment_id === 'string' &&
          a.assignment_id.length > 0
      );
      const submissionMap = await loadSubmissions(valid.map((a) => a.assignment_id));
      return valid.map((assignment) => ({
        ...assignment,
        submissionCount: submissionMap.get(assignment.assignment_id)?.count ?? 0,
        latestSubmission: submissionMap.get(assignment.assignment_id)?.latest ?? null,
      }));
    },
    [loadSubmissions]
  );

  const fetchAssignmentsPage = useCallback(
    async (page: number, append: boolean) => {
      if (append) {
        if (loadingMoreRef.current) return;
        loadingMoreRef.current = true;
        setIsLoadingMore(true);
      } else {
        setErrorMessage(null);
      }

      try {
        const params = new URLSearchParams();
        params.set('page', String(page));
        params.set('per_page', String(ASSIGNMENTS_PER_PAGE));
        // Match web student UI: load all statuses so exams and past-window items stay visible unless user filters locally.
        params.set('status', 'all');
        if (selectedSubjectId !== null) {
          params.set('subject_id', String(selectedSubjectId));
        }
        const dueTrim = dueDateFilter.trim();
        if (/^\d{4}-\d{2}-\d{2}$/.test(dueTrim)) {
          params.set('due_on', dueTrim);
        }

        const response = await get<PaginatedAssignmentsResponse>(
          `/api/students/assignments?${params.toString()}`
        );
        const raw = response.items ?? [];
        const assignments = raw.filter(
          (a): a is AssignmentItem =>
            a != null &&
            typeof (a as AssignmentItem).assignment_id === 'string' &&
            String((a as AssignmentItem).assignment_id).length > 0
        );
        const enriched = await enrichAssignments(assignments);

        setItems((prev) => {
          if (!append) {
            return enriched;
          }
          const seen = new Set(prev.map((x) => x.assignment_id));
          const merged = [...prev];
          for (const row of enriched) {
            if (!seen.has(row.assignment_id)) {
              seen.add(row.assignment_id);
              merged.push(row);
            }
          }
          return merged;
        });
        setPagination({
          lastPage: response.page,
          totalPages: response.total_pages,
        });
      } catch (error) {
        if (!append) {
          let message = 'Unable to load assignments right now.';

          if (axios.isAxiosError(error)) {
            const detail = error.response?.data?.detail;
            if (typeof detail === 'string' && detail.trim().length > 0) {
              message = detail;
            }
          } else if (error instanceof Error && error.message.trim().length > 0) {
            message = error.message;
          }

          setErrorMessage(message);
          setItems([]);
          setPagination({ lastPage: 0, totalPages: 0 });
        }
      } finally {
        if (append) {
          loadingMoreRef.current = false;
          setIsLoadingMore(false);
        }
      }
    },
    [get, enrichAssignments, selectedSubjectId, dueDateFilter]
  );

  const loadAssignments = useCallback(async () => {
    await fetchAssignmentsPage(1, false);
  }, [fetchAssignmentsPage]);

  const subjectsHydratedRef = useRef(false);
  useEffect(() => {
    if (subjectsHydratedRef.current) return;
    subjectsHydratedRef.current = true;
    void loadSubjectOptions();
  }, [loadSubjectOptions]);

  const isFirstAssignmentsFetchRef = useRef(true);
  useEffect(() => {
    let active = true;

    const bootstrap = async () => {
      if (isFirstAssignmentsFetchRef.current) {
        setIsLoading(true);
      }
      await loadAssignments();
      if (!active) return;
      setIsLoading(false);
      isFirstAssignmentsFetchRef.current = false;
    };

    void bootstrap();

    return () => {
      active = false;
    };
  }, [loadAssignments]);

  const onRefresh = useCallback(async () => {
    setIsRefreshing(true);
    await Promise.all([loadSubjectOptions(), loadAssignments()]);
    setIsRefreshing(false);
  }, [loadSubjectOptions, loadAssignments]);

  const openDueDatePicker = useCallback(() => {
    setPickerScratch(dueDateFilter ? parseDueYmd(dueDateFilter) : new Date());
    setShowDuePicker(true);
  }, [dueDateFilter]);

  const onDuePickerChange = useCallback((event: DateTimePickerEvent, date?: Date) => {
    if (Platform.OS === 'android') {
      setShowDuePicker(false);
    }
    if (event.type === 'dismissed') {
      return;
    }
    if (Platform.OS === 'android' && date) {
      setDueDateFilter(formatLocalYMD(date));
      return;
    }
    if (Platform.OS === 'ios' && date) {
      setPickerScratch(date);
    }
  }, []);

  const applyIosDuePicker = useCallback(() => {
    setDueDateFilter(formatLocalYMD(pickerScratch));
    setShowDuePicker(false);
  }, [pickerScratch]);

  const hasActiveFilters = useMemo(
    () =>
      search.trim().length > 0 ||
      selectedSubjectId !== null ||
      dueDateFilter.trim().length > 0 ||
      statusFilter !== 'All',
    [search, dueDateFilter, selectedSubjectId, statusFilter]
  );
  const filteredItems = useMemo(() => {
    return items.filter((item) => {
      const q = search.trim().toLowerCase();
      const matchesSearch =
        !q ||
        item.title.toLowerCase().includes(q) ||
        (item.subject_name ?? '').toLowerCase().includes(q);
      const matchesSubject =
        selectedSubjectId === null || item.subject_id === selectedSubjectId;
      const matchesStatus =
        statusFilter === 'All' ||
        (statusFilter === 'Submitted' && item.submissionCount > 0) ||
        (statusFilter === 'Open' && item.submissionCount === 0 && !isExamAssignment(item)) ||
        (statusFilter === 'Exam' && isExamAssignment(item));
      return matchesSearch && matchesSubject && matchesStatus;
    });
  }, [items, search, selectedSubjectId, statusFilter]);

  const handleLoadMore = useCallback(() => {
    if (isLoading || isRefreshing || errorMessage) return;
    if (isLoadingMore || loadingMoreRef.current) return;
    const { lastPage, totalPages } = pagination;
    if (totalPages <= 0 || lastPage >= totalPages) return;
    void fetchAssignmentsPage(lastPage + 1, true);
  }, [
    isLoading,
    isRefreshing,
    errorMessage,
    isLoadingMore,
    pagination,
    fetchAssignmentsPage,
  ]);

  const openCameraForAssignment = useCallback(
    (assignment: AssignmentItem) => {
      if (!assignment.assignment_id) {
        Alert.alert('Invalid assignment', 'The selected assignment is missing an ID.');
        return;
      }

      navigation.navigate('CameraScreen', {
        assignmentId: assignment.assignment_id,
      });
    },
    [navigation]
  );

  const openSubmissionDetails = useCallback(
    (assignment: AssignmentWithSubmissions) => {
      if (!assignment.assignment_id) {
        Alert.alert('Invalid assignment', 'The selected assignment is missing an ID.');
        return;
      }

      navigation.navigate('SubmissionDetailsScreen', {
        assignmentId: assignment.assignment_id,
        assignmentTitle: assignment.title,
      });
    },
    [navigation]
  );

  const openExamMode = useCallback(
    (assignment: AssignmentItem) => {
      if (!assignment.assignment_id) {
        Alert.alert('Invalid assignment', 'The selected assignment is missing an ID.');
        return;
      }

      navigation.navigate('ExamModeScreen', {
        assignmentId: assignment.assignment_id,
        assignmentTitle: assignment.title,
      });
    },
    [navigation]
  );

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.screen }]} edges={['top', 'left', 'right']}>
      {/* ── Branded header ── */}
      <View style={[styles.header, { backgroundColor: theme.colors.primary }]}>
        <View style={styles.headerGlow} />
        <View style={styles.headerRow}>
          <View style={styles.headerIconWrap}>
            <MaterialIcons name="assignment" size={22} color="#FFFFFF" />
          </View>
          <View style={styles.headerTextWrap}>
            <Text style={styles.headerTitle}>Pick Work to Submit</Text>
            <Text style={styles.headerSub}>
              {isLoading ? 'Loading…' : `${items.length} assignment${items.length !== 1 ? 's' : ''} available`}
            </Text>
          </View>
        </View>
      </View>

      {Platform.OS === 'ios' ? (
        <Modal visible={showDuePicker} transparent animationType="fade">
          <View style={styles.pickerBackdrop}>
            <View style={[styles.pickerSheet, { backgroundColor: theme.colors.surface }]}>
              <View style={[styles.pickerToolbar, { borderBottomColor: theme.colors.border }]}>
                <TouchableOpacity onPress={() => setShowDuePicker(false)}>
                  <Text style={[styles.pickerToolbarBtn, { color: theme.colors.muted }]}>Cancel</Text>
                </TouchableOpacity>
                <Text style={[styles.pickerToolbarTitle, { color: theme.colors.primary }]}>Due date</Text>
                <TouchableOpacity onPress={applyIosDuePicker}>
                  <Text style={[styles.pickerToolbarBtn, { color: theme.colors.primary }]}>Apply</Text>
                </TouchableOpacity>
              </View>
              <DateTimePicker value={pickerScratch} mode="date" display="spinner" onChange={onDuePickerChange} />
            </View>
          </View>
        </Modal>
      ) : null}

      {isLoading ? (
        <View style={styles.stateWrap}>
          <View style={[styles.stateIconWrap, { backgroundColor: theme.colors.primarySoft }]}>
            <ActivityIndicator color={theme.colors.primary} size="large" />
          </View>
          <Text style={[styles.stateTitle, { color: theme.colors.primary }]}>Loading assignments</Text>
          <Text style={[styles.stateText, { color: theme.colors.muted }]}>Fetching your coursework…</Text>
        </View>
      ) : errorMessage ? (
        <View style={styles.stateWrap}>
          <View style={[styles.stateIconWrap, { backgroundColor: '#FEF2F2' }]}>
            <MaterialIcons name="error-outline" size={32} color="#DC2626" />
          </View>
          <Text style={[styles.stateTitle, { color: theme.colors.primary }]}>Could not load</Text>
          <Text style={[styles.stateText, { color: theme.colors.muted }]}>{errorMessage}</Text>
          <TouchableOpacity
            style={[styles.retryButton, { backgroundColor: theme.colors.primary }]}
            activeOpacity={0.85}
            onPress={() => void onRefresh()}
          >
            <MaterialIcons name="refresh" size={16} color="#FFFFFF" />
            <Text style={styles.retryButtonText}>Try again</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          style={styles.listFlex}
          data={filteredItems}
          keyExtractor={(item, index) =>
            item.assignment_id && item.assignment_id.length > 0 ? item.assignment_id : `assignment-${index}`
          }
          contentContainerStyle={[styles.listContent, filteredItems.length === 0 ? styles.listContentEmpty : null]}
          refreshControl={
            <RefreshControl refreshing={isRefreshing} onRefresh={() => void onRefresh()} tintColor={theme.colors.primary} />
          }
          onEndReached={handleLoadMore}
          onEndReachedThreshold={0.35}

          ListHeaderComponent={
            <View style={styles.filtersWrap}>
              {/* Search bar */}
              <View style={[styles.searchWrap, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
                <MaterialIcons name="search" size={18} color={theme.colors.muted} />
                <TextInput
                  style={[styles.searchInput, { color: theme.colors.text }]}
                  placeholder="Search assignment or subject…"
                  placeholderTextColor={theme.colors.inactive}
                  value={search}
                  onChangeText={setSearch}
                />
                {search.length > 0 ? (
                  <TouchableOpacity onPress={() => setSearch('')} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                    <MaterialIcons name="close" size={16} color={theme.colors.muted} />
                  </TouchableOpacity>
                ) : null}
              </View>

              {/* Status tab row */}
              <View style={[styles.statusTabsWrap, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
                {([
                  { key: 'All', icon: 'apps', label: 'All' },
                  { key: 'Open', icon: 'edit', label: 'Open' },
                  { key: 'Submitted', icon: 'check-circle', label: 'Done' },
                  { key: 'Exam', icon: 'lock-clock', label: 'Exam' },
                ] as { key: 'All' | 'Open' | 'Submitted' | 'Exam'; icon: keyof typeof MaterialIcons.glyphMap; label: string }[]).map((tab) => (
                  <TouchableOpacity
                    key={tab.key}
                    style={[styles.statusTab, statusFilter === tab.key && { backgroundColor: theme.colors.primary }]}
                    onPress={() => setStatusFilter(tab.key)}
                    activeOpacity={0.85}
                  >
                    <MaterialIcons name={tab.icon} size={13} color={statusFilter === tab.key ? '#FFFFFF' : theme.colors.muted} />
                    <Text style={[styles.statusTabText, { color: statusFilter === tab.key ? '#FFFFFF' : theme.colors.muted }]}>
                      {tab.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              {/* Subject chips */}
              {subjectOptions.length > 0 ? (
                <ScrollView horizontal showsHorizontalScrollIndicator={false} nestedScrollEnabled keyboardShouldPersistTaps="handled" contentContainerStyle={styles.chipsRow}>
                  <TouchableOpacity
                    style={[styles.chip, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }, selectedSubjectId === null && { backgroundColor: theme.colors.primary, borderColor: theme.colors.primary }]}
                    onPress={() => setSelectedSubjectId(null)}
                    activeOpacity={0.85}
                  >
                    <Text style={[styles.chipText, { color: selectedSubjectId === null ? '#FFFFFF' : theme.colors.muted }]}>All subjects</Text>
                  </TouchableOpacity>
                  {subjectOptions.map((s) => (
                    <TouchableOpacity
                      key={s.subject_id}
                      style={[styles.chip, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }, selectedSubjectId === s.subject_id && { backgroundColor: theme.colors.primary, borderColor: theme.colors.primary }]}
                      onPress={() => setSelectedSubjectId(s.subject_id)}
                      activeOpacity={0.85}
                    >
                      <Text style={[styles.chipText, { color: selectedSubjectId === s.subject_id ? '#FFFFFF' : theme.colors.muted }]} numberOfLines={1}>
                        {s.subject_name}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              ) : null}

              {/* Due date + reset row */}
              <View style={styles.dueResetRow}>
                <TouchableOpacity
                  style={[styles.dueChip, { backgroundColor: theme.colors.surface, borderColor: dueDateFilter ? theme.colors.primary : theme.colors.border }]}
                  onPress={openDueDatePicker}
                  activeOpacity={0.85}
                >
                  <MaterialIcons name="event" size={15} color={dueDateFilter ? theme.colors.primary : theme.colors.muted} />
                  <Text style={[styles.dueChipText, { color: dueDateFilter ? theme.colors.primary : theme.colors.muted }]}>
                    {dueDateFilter.trim() ? dueDateFilter : 'Any due date'}
                  </Text>
                  {dueDateFilter.trim() ? (
                    <TouchableOpacity hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }} onPress={() => setDueDateFilter('')}>
                      <MaterialIcons name="close" size={13} color={theme.colors.primary} />
                    </TouchableOpacity>
                  ) : null}
                </TouchableOpacity>
                {hasActiveFilters ? (
                  <TouchableOpacity
                    style={[styles.resetBtn, { borderColor: theme.colors.border }]}
                    onPress={() => { setSearch(''); setSelectedSubjectId(null); setDueDateFilter(''); setStatusFilter('All'); }}
                    activeOpacity={0.85}
                  >
                    <MaterialIcons name="refresh" size={14} color={theme.colors.muted} />
                    <Text style={[styles.resetBtnText, { color: theme.colors.muted }]}>Reset</Text>
                  </TouchableOpacity>
                ) : null}
              </View>

              {Platform.OS === 'android' && showDuePicker ? (
                <DateTimePicker value={pickerScratch} mode="date" display="default" onChange={onDuePickerChange} />
              ) : null}

              <Text style={[styles.resultsCount, { color: theme.colors.muted }]}>
                {filteredItems.length} result{filteredItems.length !== 1 ? 's' : ''}
                {pagination.totalPages > 1 ? ` · page ${pagination.lastPage}/${pagination.totalPages}` : ''}
              </Text>
            </View>
          }

          ListEmptyComponent={
            <View style={styles.listEmptyWrap}>
              <View style={[styles.stateIconWrap, { backgroundColor: theme.colors.primarySoft }]}>
                <MaterialIcons name="assignment-late" size={32} color={theme.colors.primary} />
              </View>
              <Text style={[styles.stateTitle, { color: theme.colors.primary }]}>
                {items.length === 0 ? 'No assignments yet' : 'No matches'}
              </Text>
              <Text style={[styles.stateText, { color: theme.colors.muted }]}>
                {items.length === 0
                  ? 'Your instructor hasn\u2019t posted any assignments for submission.'
                  : 'Try adjusting your search or filters.'}
              </Text>
              {pagination.lastPage < pagination.totalPages && pagination.totalPages > 0 ? (
                <TouchableOpacity
                  style={[styles.retryButton, { backgroundColor: theme.colors.primary }]}
                  activeOpacity={0.85}
                  disabled={isLoadingMore}
                  onPress={() => void fetchAssignmentsPage(pagination.lastPage + 1, true)}
                >
                  {isLoadingMore ? <ActivityIndicator color="#FFFFFF" size="small" /> : (
                    <>
                      <MaterialIcons name="expand-more" size={16} color="#FFFFFF" />
                      <Text style={styles.retryButtonText}>Load more</Text>
                    </>
                  )}
                </TouchableOpacity>
              ) : null}
            </View>
          }

          ListFooterComponent={isLoadingMore ? <View style={styles.listFooterLoading}><ActivityIndicator color={theme.colors.primary} /></View> : null}

          renderItem={({ item }) => {
            const examMode = isExamAssignment(item);
            const st = item.latestSubmission?.processing_status;
            const isSubmitted = item.submissionCount > 0;
            const isDone = st === 'done';
            const isProcessing = st === 'ocr' || st === 'grading' || st === 'queued';

            const cardIcon = (isSubmitted ? (isDone ? 'check-circle' : 'hourglass-top') : examMode ? 'lock-clock' : 'description') as keyof typeof MaterialIcons.glyphMap;
            const iconBg = examMode ? '#FEF3C7' : isDone ? '#DCFCE7' : isProcessing ? '#FEF3C7' : `${theme.colors.primary}1A`;
            const iconColor = examMode ? '#B45309' : isDone ? '#15803D' : isProcessing ? '#B45309' : theme.colors.primary;

            const ctaLabel = isSubmitted ? 'View submissions' : examMode ? 'Enter exam mode' : 'Capture & submit';
            const ctaBg = isSubmitted ? 'transparent' : examMode ? '#D97706' : theme.colors.primary;
            const ctaColor = isSubmitted ? theme.colors.primary : '#FFFFFF';
            const ctaIcon = (isSubmitted ? 'visibility' : examMode ? 'lock-open' : 'camera-alt') as keyof typeof MaterialIcons.glyphMap;

            const statusPillBg = isDone ? '#DCFCE7' : isProcessing ? '#FEF3C7' : `${theme.colors.primary}18`;
            const statusPillColor = isDone ? '#15803D' : isProcessing ? '#B45309' : theme.colors.primary;
            const statusLabel = isDone
              ? item.latestSubmission!.score_percentage !== null
                ? `${item.latestSubmission!.score_percentage.toFixed(0)}%`
                : 'Graded'
              : st ? getPrettyStatusLabel(st) : '';

            return (
              <TouchableOpacity
                style={[styles.card, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border, shadowColor: theme.colors.shadow }]}
                activeOpacity={0.88}
                onPress={() => isSubmitted ? openSubmissionDetails(item) : examMode ? openExamMode(item) : openCameraForAssignment(item)}
              >
                {/* Top row: icon + title + meta */}
                <View style={styles.cardTopRow}>
                  <View style={[styles.cardIconCircle, { backgroundColor: iconBg }]}>
                    <MaterialIcons name={cardIcon} size={22} color={iconColor} />
                  </View>
                  <View style={styles.cardTitleBlock}>
                    <Text style={[styles.cardTitle, { color: theme.colors.text }]} numberOfLines={2}>{item.title}</Text>
                    <View style={styles.cardMetaRow}>
                      <MaterialIcons name="book" size={11} color={theme.colors.inactive} />
                      <Text style={[styles.cardMetaText, { color: theme.colors.muted }]} numberOfLines={1}>
                        {item.subject_name || 'No subject'}
                      </Text>
                      {item.due_date ? (
                        <>
                          <View style={[styles.metaDot, { backgroundColor: theme.colors.inactive }]} />
                          <MaterialIcons name="event" size={11} color={theme.colors.inactive} />
                          <Text style={[styles.cardMetaText, { color: theme.colors.muted }]}>{formatDueDate(item.due_date)}</Text>
                        </>
                      ) : null}
                    </View>
                  </View>
                  {isSubmitted ? (
                    <View style={[styles.subCountBubble, { backgroundColor: isDone ? '#DCFCE7' : theme.colors.primarySoft }]}>
                      <Text style={[styles.subCountText, { color: isDone ? '#15803D' : theme.colors.primary }]}>{item.submissionCount}</Text>
                    </View>
                  ) : null}
                </View>

                {/* Exam rule pills */}
                {examMode && (item.exam_duration_minutes != null || item.exam_max_pauses != null) ? (
                  <View style={styles.examPillsRow}>
                    {item.exam_duration_minutes != null ? (
                      <View style={styles.examPill}>
                        <MaterialIcons name="schedule" size={11} color="#B45309" />
                        <Text style={styles.examPillText}>{item.exam_duration_minutes} min</Text>
                      </View>
                    ) : null}
                    {item.exam_max_pauses != null ? (
                      <View style={styles.examPill}>
                        <MaterialIcons name="pause-circle-outline" size={11} color="#B45309" />
                        <Text style={styles.examPillText}>{item.exam_max_pauses} pauses</Text>
                      </View>
                    ) : null}
                  </View>
                ) : null}

                {/* Status pill for submitted */}
                {item.latestSubmission ? (
                  <View style={styles.submissionStatusRow}>
                    <View style={[styles.statusPill, { backgroundColor: statusPillBg }]}>
                      <MaterialIcons name={isDone ? 'check-circle' : 'hourglass-top'} size={12} color={statusPillColor} />
                      <Text style={[styles.statusPillText, { color: statusPillColor }]}>
                        {isDone ? `Graded${statusLabel ? ` · ${statusLabel}` : ''}` : statusLabel}
                      </Text>
                    </View>
                    <Text style={[styles.subDateText, { color: theme.colors.inactive }]}>
                      {(() => { const s = item.latestSubmission.submitted_at; const h = s.endsWith('Z') || /[+-]\d{2}:\d{2}$/.test(s); return new Date(h ? s : s + 'Z').toLocaleDateString(undefined, { month: 'short', day: 'numeric' }); })()}
                    </Text>
                  </View>
                ) : null}

                {/* CTA button */}
                <View style={[styles.ctaBtn, { backgroundColor: ctaBg, borderColor: isSubmitted ? theme.colors.border : 'transparent', borderWidth: isSubmitted ? 1 : 0 }]}>
                  <MaterialIcons name={ctaIcon} size={15} color={ctaColor} />
                  <Text style={[styles.ctaBtnText, { color: ctaColor }]}>{ctaLabel}</Text>
                  <MaterialIcons name="arrow-forward" size={15} color={ctaColor} style={styles.ctaArrow} />
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
  container: { flex: 1 },
  listFlex: { flex: 1 },

  /* Header */
  header: {
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 16,
    overflow: 'hidden',
  },
  headerGlow: {
    position: 'absolute',
    top: -30,
    right: -20,
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: 'rgba(255,255,255,0.07)',
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  headerIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 13,
    backgroundColor: 'rgba(255,255,255,0.18)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTextWrap: { gap: 2 },
  headerTitle: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: -0.2,
  },
  headerSub: {
    color: 'rgba(255,255,255,0.72)',
    fontSize: 12,
    fontWeight: '500',
  },

  /* List */
  listContent: {
    paddingHorizontal: 16,
    paddingBottom: 28,
    gap: 12,
  },
  listContentEmpty: { flexGrow: 1 },
  listFooterLoading: { paddingVertical: 20, alignItems: 'center' },

  /* Filters */
  filtersWrap: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 8,
    gap: 10,
  },
  searchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    gap: 8,
    minHeight: 44,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    paddingVertical: 8,
  },
  statusTabsWrap: {
    flexDirection: 'row',
    borderWidth: 1,
    borderRadius: 12,
    overflow: 'hidden',
  },
  statusTab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingVertical: 9,
    borderRadius: 11,
    marginHorizontal: 2,
    marginVertical: 2,
  },
  statusTabText: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.2,
  },
  chipsRow: {
    flexDirection: 'row',
    gap: 8,
    paddingRight: 8,
  },
  chip: {
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  chipText: {
    fontSize: 12,
    fontWeight: '700',
  },
  dueResetRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  dueChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 8,
    flex: 1,
  },
  dueChipText: {
    flex: 1,
    fontSize: 13,
    fontWeight: '600',
  },
  resetBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  resetBtnText: {
    fontSize: 12,
    fontWeight: '700',
  },
  resultsCount: {
    fontSize: 11,
    fontWeight: '600',
    paddingHorizontal: 2,
  },

  /* Date picker modal */
  pickerBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(15,23,42,0.45)',
    justifyContent: 'flex-end',
  },
  pickerSheet: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingBottom: 20,
    overflow: 'hidden',
  },
  pickerToolbar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
  },
  pickerToolbarTitle: { fontSize: 15, fontWeight: '700' },
  pickerToolbarBtn: { fontSize: 15, fontWeight: '600' },

  /* State views */
  stateWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
    gap: 12,
  },
  stateIconWrap: {
    width: 72,
    height: 72,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stateTitle: {
    fontSize: 17,
    fontWeight: '800',
    textAlign: 'center',
    letterSpacing: -0.2,
  },
  stateText: {
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 19,
  },
  retryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 4,
    paddingHorizontal: 20,
    paddingVertical: 11,
    borderRadius: 999,
  },
  retryButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '800',
  },
  listEmptyWrap: {
    alignItems: 'center',
    paddingVertical: 40,
    paddingHorizontal: 32,
    gap: 12,
  },

  /* Assignment card */
  card: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 14,
    gap: 10,
    shadowOpacity: 0.07,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  cardTopRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  cardIconCircle: {
    width: 44,
    height: 44,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  cardTitleBlock: {
    flex: 1,
    gap: 4,
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: '800',
    letterSpacing: -0.1,
    lineHeight: 20,
  },
  cardMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    flexWrap: 'wrap',
  },
  cardMetaText: {
    fontSize: 11,
    fontWeight: '500',
  },
  metaDot: {
    width: 3,
    height: 3,
    borderRadius: 2,
    marginHorizontal: 2,
  },
  subCountBubble: {
    minWidth: 26,
    height: 26,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
    flexShrink: 0,
  },
  subCountText: {
    fontSize: 12,
    fontWeight: '900',
  },
  examPillsRow: {
    flexDirection: 'row',
    gap: 8,
    flexWrap: 'wrap',
  },
  examPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#FEF3C7',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  examPillText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#B45309',
  },
  submissionStatusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  statusPillText: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.2,
  },
  subDateText: {
    fontSize: 11,
    fontWeight: '500',
  },
  ctaBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderRadius: 11,
    paddingVertical: 11,
    paddingHorizontal: 14,
  },
  ctaBtnText: {
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 0.1,
  },
  ctaArrow: {
    marginLeft: 'auto' as unknown as number,
  },
});
