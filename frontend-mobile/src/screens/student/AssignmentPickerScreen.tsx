import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, RefreshControl, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import axios from 'axios';

import { useApi } from '../../hooks/useApi';

type AssignmentItem = {
  assignment_id: string;
  title: string;
  subject_name?: string | null;
  due_date?: string | null;
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

function getStatusColor(status: string): string {
  switch (status) {
    case 'done':
      return '#16A34A';
    case 'grading':
    case 'ocr':
      return '#2563EB';
    case 'queued':
      return '#CA8A04';
    case 'rejected':
      return '#DC2626';
    default:
      return '#64748B';
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

export default function AssignmentPickerScreen({ navigation }: AssignmentPickerScreenProps) {
  const { get } = useApi();
  const [items, setItems] = useState<AssignmentWithSubmissions[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const loadSubmissions = useCallback(
    async (assignmentIds: string[]): Promise<Map<string, { count: number; latest: Submission | null }>> => {
      const result = new Map<string, { count: number; latest: Submission | null }>();

      try {
        const response = await get<PaginatedSubmissionsResponse>('/api/students/submissions?page=1&per_page=100');
        const allSubmissions: Submission[] = response.items ?? [];

        // Group submissions by assignment_id
        const byAssignment = new Map<string, Submission[]>();
        allSubmissions.forEach((sub) => {
          if (!byAssignment.has(sub.assignment_id)) {
            byAssignment.set(sub.assignment_id, []);
          }
          byAssignment.get(sub.assignment_id)!.push(sub);
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

  const loadAssignments = useCallback(async () => {
    setErrorMessage(null);

    try {
      const response = await get<PaginatedAssignmentsResponse>('/api/students/assignments?status=open&page=1&per_page=50');
      const assignments = response.items ?? [];

      // Fetch submissions for all assignments
      const submissionMap = await loadSubmissions(assignments.map((a) => a.assignment_id));

      // Merge assignments with submission data
      const enriched: AssignmentWithSubmissions[] = assignments.map((assignment) => ({
        ...assignment,
        submissionCount: submissionMap.get(assignment.assignment_id)?.count ?? 0,
        latestSubmission: submissionMap.get(assignment.assignment_id)?.latest ?? null,
      }));

      setItems(enriched);
      return;
    } catch {
      // If status filtering is not supported, fall back to plain list endpoint.
    }

    try {
      const fallbackResponse = await get<PaginatedAssignmentsResponse>('/api/students/assignments?page=1&per_page=50');
      const assignments = fallbackResponse.items ?? [];

      // Fetch submissions for all assignments
      const submissionMap = await loadSubmissions(assignments.map((a) => a.assignment_id));

      // Merge assignments with submission data
      const enriched: AssignmentWithSubmissions[] = assignments.map((assignment) => ({
        ...assignment,
        submissionCount: submissionMap.get(assignment.assignment_id)?.count ?? 0,
        latestSubmission: submissionMap.get(assignment.assignment_id)?.latest ?? null,
      }));

      setItems(enriched);
    } catch (error) {
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
    }
  }, [get, loadSubmissions]);

  useEffect(() => {
    let active = true;

    const bootstrap = async () => {
      setIsLoading(true);
      await loadAssignments();
      if (active) {
        setIsLoading(false);
      }
    };

    void bootstrap();

    return () => {
      active = false;
    };
  }, [loadAssignments]);

  const onRefresh = useCallback(async () => {
    setIsRefreshing(true);
    await loadAssignments();
    setIsRefreshing(false);
  }, [loadAssignments]);

  const hasItems = useMemo(() => items.length > 0, [items.length]);

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

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Choose Assignment</Text>
        <Text style={styles.subtitle}>Pick the assignment before capturing pages.</Text>
      </View>

      {isLoading ? (
        <View style={styles.stateWrap}>
          <ActivityIndicator color="#123A5F" />
          <Text style={styles.stateText}>Loading assignments...</Text>
        </View>
      ) : errorMessage ? (
        <View style={styles.stateWrap}>
          <MaterialIcons name="error-outline" size={22} color="#B91C1C" />
          <Text style={styles.errorText}>{errorMessage}</Text>
          <TouchableOpacity style={styles.retryButton} activeOpacity={0.85} onPress={() => void onRefresh()}>
            <Text style={styles.retryButtonText}>Retry</Text>
          </TouchableOpacity>
        </View>
      ) : hasItems ? (
        <FlatList
          data={items}
          keyExtractor={(item) => item.assignment_id}
          contentContainerStyle={styles.listContent}
          refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={() => void onRefresh()} tintColor="#123A5F" />}
          renderItem={({ item }) => (
            <TouchableOpacity style={styles.card} activeOpacity={0.86} onPress={() => item.submissionCount > 0 ? openSubmissionDetails(item) : openCameraForAssignment(item)}>
              <View style={styles.cardHeader}>
                <View style={styles.cardTitleWrap}>
                  <Text style={styles.cardTitle}>{item.title}</Text>
                  {item.submissionCount > 0 && (
                    <View style={styles.submissionBadge}>
                      <Text style={styles.submissionBadgeText}>{item.submissionCount}</Text>
                    </View>
                  )}
                </View>
              </View>
              <Text style={styles.cardMeta}>{item.subject_name || 'Subject unavailable'}</Text>
              <Text style={styles.cardMeta}>Due: {formatDueDate(item.due_date)}</Text>
              {item.latestSubmission && (
                <View style={styles.submissionStatus}>
                  <MaterialIcons name="check-circle" size={14} color={getStatusColor(item.latestSubmission.processing_status)} />
                  <Text style={[styles.submissionStatusText, { color: getStatusColor(item.latestSubmission.processing_status) }]}>
                    {item.latestSubmission.processing_status === 'done'
                      ? `Submitted • ${item.latestSubmission.score_percentage !== null ? `${item.latestSubmission.score_percentage.toFixed(0)}%` : 'Graded'}`
                      : item.latestSubmission.processing_status === 'queued'
                        ? 'Submitted'
                        : getPrettyStatusLabel(item.latestSubmission.processing_status)}
                  </Text>
                </View>
              )}
            </TouchableOpacity>
          )}
        />
      ) : (
        <View style={styles.stateWrap}>
          <MaterialIcons name="assignment" size={24} color="#64748B" />
          <Text style={styles.stateText}>No assignments available for submission.</Text>
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F3F1EB',
  },
  header: {
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 8,
  },
  title: {
    color: '#123A5F',
    fontSize: 22,
    fontWeight: '800',
  },
  subtitle: {
    marginTop: 4,
    color: '#64748B',
    fontSize: 13,
  },
  listContent: {
    paddingHorizontal: 16,
    paddingBottom: 24,
    gap: 12,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 14,
    gap: 8,
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
    color: '#0F172A',
    fontSize: 16,
    fontWeight: '800',
  },
  submissionBadge: {
    backgroundColor: '#123A5F',
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 3,
    minWidth: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  submissionBadgeText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
  cardMeta: {
    color: '#64748B',
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
    borderTopColor: '#F1F5F9',
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
    color: '#475569',
    fontSize: 14,
    textAlign: 'center',
  },
  errorText: {
    color: '#B91C1C',
    fontSize: 14,
    textAlign: 'center',
  },
  retryButton: {
    marginTop: 6,
    backgroundColor: '#123A5F',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 999,
  },
  retryButtonText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '800',
  },
});
