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

import ScreenHeader from '../../components/ScreenHeader';
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
      <ScreenHeader
        title="Choose Assignment"
        subtitle="Pick work to submit"
      />

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
          <ActivityIndicator color={theme.colors.primary} />
          <Text style={[styles.stateText, { color: theme.colors.muted }]}>Loading assignments...</Text>
        </View>
      ) : errorMessage ? (
        <View style={styles.stateWrap}>
          <MaterialIcons name="error-outline" size={22} color={theme.colors.primary} />
          <Text style={[styles.errorText, { color: theme.colors.primary }]}>{errorMessage}</Text>
          <TouchableOpacity
            style={[styles.retryButton, { backgroundColor: theme.colors.primary }]}
            activeOpacity={0.85}
            onPress={() => void onRefresh()}
          >
            <Text style={[styles.retryButtonText, { color: theme.colors.surface }]}>Retry</Text>
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
            <RefreshControl
              refreshing={isRefreshing}
              onRefresh={() => void onRefresh()}
              tintColor={theme.colors.primary}
            />
          }
          onEndReached={handleLoadMore}
          onEndReachedThreshold={0.35}
          ListHeaderComponent={
            <View style={styles.filtersWrap}>
              <View style={[styles.summaryBar, { backgroundColor: theme.colors.primarySoft, borderColor: theme.colors.border }]}>
                <MaterialIcons name="assignment" size={16} color={theme.colors.primary} />
                <Text style={[styles.summaryBarText, { color: theme.colors.primary }]}>
                  {filteredItems.length} assignment{filteredItems.length === 1 ? '' : 's'} shown
                  {pagination.totalPages > 1 ? ` · page ${pagination.lastPage}/${pagination.totalPages}` : ''}
                </Text>
              </View>
              <View style={[styles.searchWrap, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
                <MaterialIcons name="search" size={17} color={theme.colors.muted} />
                <TextInput
                  style={[styles.searchInput, { color: theme.colors.text }]}
                  placeholder="Search assignment or subject..."
                  placeholderTextColor={theme.colors.inactive}
                  value={search}
                  onChangeText={setSearch}
                />
                {search.length > 0 ? (
                  <TouchableOpacity onPress={() => setSearch('')}>
                    <MaterialIcons name="close" size={15} color={theme.colors.muted} />
                  </TouchableOpacity>
                ) : null}
              </View>
              <View style={styles.filterGroup}>
                <Text style={[styles.filterLabel, { color: theme.colors.muted }]}>Subject</Text>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  nestedScrollEnabled
                  keyboardShouldPersistTaps="handled"
                  contentContainerStyle={styles.chipsRow}
                >
                  <TouchableOpacity
                    key="__all_subjects"
                    style={[
                      styles.chip,
                      { backgroundColor: theme.colors.surfaceMuted, borderWidth: 1, borderColor: theme.colors.border },
                      selectedSubjectId === null && { backgroundColor: theme.colors.primary, borderColor: theme.colors.primary },
                    ]}
                    onPress={() => setSelectedSubjectId(null)}
                    activeOpacity={0.85}
                  >
                    <Text
                      style={[
                        styles.chipText,
                        { color: theme.colors.text },
                        selectedSubjectId === null && { color: theme.colors.surface },
                      ]}
                      numberOfLines={1}
                    >
                      All
                    </Text>
                  </TouchableOpacity>
                  {subjectOptions.map((s) => (
                    <TouchableOpacity
                      key={s.subject_id}
                      style={[
                        styles.chip,
                        { backgroundColor: theme.colors.surfaceMuted, borderWidth: 1, borderColor: theme.colors.border },
                        selectedSubjectId === s.subject_id && { backgroundColor: theme.colors.primary, borderColor: theme.colors.primary },
                      ]}
                      onPress={() => setSelectedSubjectId(s.subject_id)}
                      activeOpacity={0.85}
                    >
                      <Text
                        style={[
                          styles.chipText,
                          { color: theme.colors.text },
                          selectedSubjectId === s.subject_id && { color: theme.colors.surface },
                        ]}
                        numberOfLines={1}
                      >
                        {s.subject_name}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>
              <View style={styles.filterGroup}>
                <Text style={[styles.filterLabel, { color: theme.colors.muted }]}>Due on</Text>
                <View style={styles.dueRow}>
                  <TouchableOpacity
                    style={[styles.dueChip, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}
                    onPress={openDueDatePicker}
                    activeOpacity={0.85}
                  >
                    <MaterialIcons name="event" size={16} color={theme.colors.primary} />
                    <Text style={[styles.dueChipText, { color: theme.colors.text }]}>
                      {dueDateFilter.trim() ? dueDateFilter : 'Any due date'}
                    </Text>
                  </TouchableOpacity>
                  {dueDateFilter.trim() ? (
                    <TouchableOpacity
                      style={[styles.dueClear, { backgroundColor: theme.colors.surfaceMuted }]}
                      onPress={() => setDueDateFilter('')}
                      activeOpacity={0.85}
                    >
                      <MaterialIcons name="close" size={16} color={theme.colors.muted} />
                    </TouchableOpacity>
                  ) : null}
                </View>
                {Platform.OS === 'android' && showDuePicker ? (
                  <DateTimePicker
                    value={pickerScratch}
                    mode="date"
                    display="default"
                    onChange={onDuePickerChange}
                  />
                ) : null}
              </View>
              <View style={styles.filterGroup}>
                <Text style={[styles.filterLabel, { color: theme.colors.muted }]}>Status</Text>
                <View style={styles.chipsRow}>
                  {(['All', 'Open', 'Submitted', 'Exam'] as const).map((s) => (
                    <TouchableOpacity
                      key={s}
                      style={[
                        styles.chip,
                        { backgroundColor: theme.colors.surfaceMuted, borderWidth: 1, borderColor: theme.colors.border },
                        statusFilter === s && { backgroundColor: theme.colors.primary, borderColor: theme.colors.primary },
                      ]}
                      onPress={() => setStatusFilter(s)}
                      activeOpacity={0.85}
                    >
                      <Text
                        style={[styles.chipText, { color: theme.colors.text }, statusFilter === s && { color: theme.colors.surface }]}
                      >
                        {s}
                      </Text>
                    </TouchableOpacity>
                  ))}
                  {hasActiveFilters ? (
                    <TouchableOpacity
                      style={[styles.clearChip, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}
                      onPress={() => {
                        setSearch('');
                        setSelectedSubjectId(null);
                        setDueDateFilter('');
                        setStatusFilter('All');
                      }}
                      activeOpacity={0.85}
                    >
                      <MaterialIcons name="refresh" size={12} color={theme.colors.muted} />
                      <Text style={[styles.clearChipText, { color: theme.colors.muted }]}>Reset</Text>
                    </TouchableOpacity>
                  ) : null}
                </View>
              </View>
            </View>
          }
          ListEmptyComponent={
            <View style={styles.listEmptyWrap}>
              <MaterialIcons name="assignment" size={24} color={theme.colors.inactive} />
              <Text style={[styles.stateText, { color: theme.colors.muted }]}>
                {items.length === 0
                  ? 'No assignments available for submission.'
                  : 'No assignments match your filters.'}
              </Text>
              {items.length > 0 && pagination.lastPage < pagination.totalPages ? (
                <Text style={[styles.listEmptyHint, { color: theme.colors.muted }]}>
                  More assignments may be on the next pages.
                </Text>
              ) : null}
              {pagination.lastPage < pagination.totalPages && pagination.totalPages > 0 ? (
                <TouchableOpacity
                  style={[styles.loadMoreInline, { backgroundColor: theme.colors.primary }]}
                  activeOpacity={0.85}
                  disabled={isLoadingMore}
                  onPress={() => void fetchAssignmentsPage(pagination.lastPage + 1, true)}
                >
                  {isLoadingMore ? (
                    <ActivityIndicator color={theme.colors.surface} />
                  ) : (
                    <Text style={[styles.loadMoreInlineText, { color: theme.colors.surface }]}>Load more assignments</Text>
                  )}
                </TouchableOpacity>
              ) : null}
            </View>
          }
          ListFooterComponent={
            isLoadingMore ? (
              <View style={styles.listFooterLoading}>
                <ActivityIndicator color={theme.colors.primary} />
              </View>
            ) : null
          }
          renderItem={({ item }) => {
            const examMode = isExamAssignment(item);
            const st = item.latestSubmission?.processing_status;
            const statusCol =
              st != null
                ? getStatusColor(st, theme.colors.primary, theme.colors.muted, theme.colors.inactive)
                : theme.colors.muted;
            return (
              <TouchableOpacity
                style={[
                  styles.card,
                  {
                    backgroundColor: theme.colors.surface,
                    borderColor: theme.colors.border,
                    shadowColor: theme.colors.shadow,
                  },
                ]}
                activeOpacity={0.86}
                onPress={() =>
                  item.submissionCount > 0
                    ? openSubmissionDetails(item)
                    : examMode
                      ? openExamMode(item)
                      : openCameraForAssignment(item)
                }
              >
                <View style={[styles.cardAccent, { backgroundColor: examMode ? theme.colors.primary : theme.colors.muted }]} />
                <View style={styles.cardHeader}>
                  <View style={styles.cardTitleWrap}>
                    <Text style={[styles.cardTitle, { color: theme.colors.text }]}>{item.title}</Text>
                    {examMode && (
                      <View style={[styles.examBadge, { backgroundColor: theme.colors.primarySoft }]}>
                        <MaterialIcons name="assignment" size={10} color={theme.colors.primary} />
                        <Text style={[styles.examBadgeText, { color: theme.colors.primary }]}>Exam</Text>
                      </View>
                    )}
                    {item.submissionCount > 0 && (
                      <View style={[styles.submissionBadge, { backgroundColor: theme.colors.primary }]}>
                        <Text style={[styles.submissionBadgeText, { color: theme.colors.surface }]}>{item.submissionCount}</Text>
                      </View>
                    )}
                  </View>
                </View>
                <Text style={[styles.cardMeta, { color: theme.colors.muted }]}>{item.subject_name || 'Subject unavailable'}</Text>
                <Text style={[styles.cardMeta, { color: theme.colors.muted }]}>Due: {formatDueDate(item.due_date)}</Text>
                {examMode && (item.exam_duration_minutes != null || item.exam_max_pauses != null) && (
                  <View style={styles.examRulesRow}>
                    {item.exam_duration_minutes != null && (
                      <View style={[styles.examRulePill, { backgroundColor: theme.colors.primarySoft, borderColor: theme.colors.border }]}>
                        <MaterialIcons name="schedule" size={12} color={theme.colors.primary} />
                        <Text style={[styles.examRuleText, { color: theme.colors.primary }]}>
                          Time limit: {item.exam_duration_minutes} min
                        </Text>
                      </View>
                    )}
                    {item.exam_max_pauses != null && (
                      <View style={[styles.examRulePill, { backgroundColor: theme.colors.primarySoft, borderColor: theme.colors.border }]}>
                        <MaterialIcons name="pause-circle-outline" size={12} color={theme.colors.primary} />
                        <Text style={[styles.examRuleText, { color: theme.colors.primary }]}>
                          Pauses allowed: {item.exam_max_pauses}
                        </Text>
                      </View>
                    )}
                  </View>
                )}
                {item.latestSubmission && (
                  <View style={[styles.submissionStatus, { borderTopColor: theme.colors.border }]}>
                    <MaterialIcons name="check-circle" size={14} color={statusCol} />
                    <Text style={[styles.submissionStatusText, { color: statusCol }]}>
                      {item.latestSubmission.processing_status === 'done'
                        ? `Submitted • ${
                            item.latestSubmission.score_percentage !== null
                              ? `${item.latestSubmission.score_percentage.toFixed(0)}%`
                              : 'Graded'
                          }`
                        : item.latestSubmission.processing_status === 'queued'
                          ? 'Submitted'
                          : getPrettyStatusLabel(item.latestSubmission.processing_status)}
                    </Text>
                  </View>
                )}
                {examMode && item.submissionCount === 0 && (
                  <View style={[styles.examActionRow, { borderTopColor: theme.colors.border }]}>
                    <MaterialIcons name="lock-clock" size={14} color={theme.colors.primary} />
                    <Text style={[styles.examActionText, { color: theme.colors.primary }]}>Tap to enter exam mode</Text>
                  </View>
                )}
                <View style={[styles.cardCtaRow, { borderTopColor: theme.colors.border }]}>
                  <Text style={[styles.cardCtaText, { color: theme.colors.primary }]}>
                    {item.submissionCount > 0 ? 'View previous submissions' : examMode ? 'Start exam mode' : 'Capture and submit'}
                  </Text>
                  <MaterialIcons name="chevron-right" size={18} color={theme.colors.primary} />
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
  container: {
    flex: 1,
  },
  listFlex: {
    flex: 1,
  },
  listContent: {
    paddingHorizontal: 16,
    paddingBottom: 24,
    gap: 12,
  },
  listContentEmpty: {
    flexGrow: 1,
  },
  filtersWrap: {
    paddingHorizontal: 16,
    paddingBottom: 8,
    gap: 8,
  },
  listEmptyWrap: {
    alignItems: 'center',
    paddingVertical: 32,
    paddingHorizontal: 24,
    gap: 10,
  },
  listEmptyHint: {
    fontSize: 13,
    textAlign: 'center',
  },
  listFooterLoading: {
    paddingVertical: 20,
  },
  loadMoreInline: {
    marginTop: 4,
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderRadius: 999,
    minWidth: 200,
    alignItems: 'center',
  },
  loadMoreInlineText: {
    fontSize: 13,
    fontWeight: '800',
  },
  summaryBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 9,
  },
  summaryBarText: {
    fontSize: 12,
    fontWeight: '700',
  },
  searchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 10,
    gap: 8,
    minHeight: 42,
  },
  searchInput: {
    flex: 1,
    fontSize: 13,
    paddingVertical: 8,
  },
  chipsRow: {
    flexDirection: 'row',
    gap: 8,
    flexWrap: 'wrap',
    paddingRight: 8,
  },
  dueRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
  },
  dueChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  dueChipText: {
    fontSize: 13,
    fontWeight: '600',
  },
  dueClear: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pickerBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(15,23,42,0.45)',
    justifyContent: 'flex-end',
  },
  pickerSheet: {
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    paddingBottom: 16,
    overflow: 'hidden',
  },
  pickerToolbar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  pickerToolbarTitle: {
    fontSize: 14,
    fontWeight: '700',
  },
  pickerToolbarBtn: {
    fontSize: 15,
    fontWeight: '600',
  },
  filterGroup: {
    gap: 6,
  },
  filterLabel: {
    fontSize: 11,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  chip: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
    maxWidth: 140,
  },
  chipText: {
    fontSize: 11,
    fontWeight: '700',
  },
  clearChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  clearChipText: {
    fontSize: 11,
    fontWeight: '700',
  },
  card: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 14,
    gap: 8,
    position: 'relative',
    overflow: 'hidden',
    shadowOpacity: 0.06,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  cardAccent: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: 4,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
  },
  cardTitleWrap: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  cardTitle: {
    flex: 1,
    fontSize: 16,
    fontWeight: '800',
  },
  submissionBadge: {
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 3,
    minWidth: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  submissionBadgeText: {
    fontSize: 12,
    fontWeight: '700',
  },
  cardMeta: {
    fontSize: 12,
    fontWeight: '600',
  },
  submissionStatus: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 4,
    paddingTop: 8,
    borderTopWidth: 1,
  },
  submissionStatusText: {
    fontSize: 12,
    fontWeight: '600',
  },
  stateWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
    gap: 10,
  },
  stateText: {
    fontSize: 14,
    textAlign: 'center',
  },
  errorText: {
    fontSize: 14,
    textAlign: 'center',
  },
  retryButton: {
    marginTop: 6,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 999,
  },
  retryButtonText: {
    fontSize: 13,
    fontWeight: '800',
  },
  examBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  examBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  examActionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingTop: 6,
    borderTopWidth: 1,
  },
  examActionText: {
    fontSize: 12,
    fontWeight: '600',
  },
  examRulesRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 2,
  },
  examRulePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
  },
  examRuleText: {
    fontSize: 11,
    fontWeight: '600',
  },
  cardCtaRow: {
    marginTop: 2,
    paddingTop: 8,
    borderTopWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  cardCtaText: {
    fontSize: 12,
    fontWeight: '700',
  },
});
