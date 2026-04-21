import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Image, ScrollView, StyleSheet, Text, TouchableOpacity, View, RefreshControl } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import axios from 'axios';
import { SafeAreaView } from 'react-native-safe-area-context';

import { API_BASE_URL } from '../../config/api';
import { useApi } from '../../hooks/useApi';

type Submission = {
  submission_id: string;
  assignment_id: string;
  submitted_at: string;
  processing_status: 'queued' | 'ocr' | 'grading' | 'done' | 'rejected';
  score_percentage: number | null;
  images?: string[];
};

type SubmissionDetail = Submission & {
  image_path?: string;
};

type SubmissionDetailsNavigation = {
  navigate: (screenName: string, params?: Record<string, unknown>) => void;
  goBack?: () => void;
};

type SubmissionDetailsRoute = {
  params?: {
    assignmentId?: string;
    assignmentTitle?: string;
  };
};

type SubmissionDetailsScreenProps = {
  navigation: SubmissionDetailsNavigation;
  route?: SubmissionDetailsRoute;
};

const statusLabels: Record<string, string> = {
  queued: 'Yet to be graded',
  ocr: 'Processing',
  grading: 'Grading',
  done: 'Graded',
  rejected: 'Rejected',
};

const statusColors: Record<string, string> = {
  queued: '#CA8A04',
  ocr: '#2563EB',
  grading: '#8B5CF6',
  done: '#16A34A',
  rejected: '#DC2626',
};

function parseSubmissionImages(imagePath?: string | null): string[] {
  if (!imagePath) {
    return [];
  }

  return imagePath
    .split(',')
    .map((path) => path.trim())
    .filter((path) => path.length > 0)
    .map((path) => `${API_BASE_URL}/uploads/${path.replace(/^[\\/]+/, '').replace(/\\/g, '/')}`);
}

export default function SubmissionDetailsScreen({ navigation, route }: SubmissionDetailsScreenProps) {
  const { get } = useApi();
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [expandedSubmissionId, setExpandedSubmissionId] = useState<string | null>(null);
  const [submissionDetailsById, setSubmissionDetailsById] = useState<Record<string, SubmissionDetail>>({});
  const [loadingSubmissionIds, setLoadingSubmissionIds] = useState<Record<string, boolean>>({});

  const assignmentId = route?.params?.assignmentId ?? '';
  const assignmentTitle = route?.params?.assignmentTitle ?? 'Assignment';

  const loadSubmissions = useCallback(async () => {
    if (!assignmentId) {
      setErrorMessage('Assignment ID is missing');
      return;
    }

    setErrorMessage(null);
    setIsLoading(true);

    try {
      // Fetch all submissions and filter by assignment_id
      const response = await get<{ items: Submission[] }>('/api/students/submissions?page=1&per_page=100');
      const allSubmissions: Submission[] = response.items ?? [];
      
      // Filter submissions for this assignment and sort by date descending
      const filtered = allSubmissions
        .filter((sub) => sub.assignment_id === assignmentId)
        .sort((a, b) => new Date(b.submitted_at).getTime() - new Date(a.submitted_at).getTime());
      
      setSubmissions(filtered);
    } catch (error) {
      let message = 'Unable to load submissions right now.';

      if (axios.isAxiosError(error)) {
        const detail = error.response?.data?.detail;
        if (typeof detail === 'string' && detail.trim().length > 0) {
          message = detail;
        }
      } else if (error instanceof Error && error.message.trim().length > 0) {
        message = error.message;
      }

      setErrorMessage(message);
      setSubmissions([]);
    } finally {
      setIsLoading(false);
    }
  }, [assignmentId, get]);

  useEffect(() => {
    void loadSubmissions();
  }, [loadSubmissions]);

  const onRefresh = useCallback(async () => {
    setIsRefreshing(true);
    await loadSubmissions();
    setIsRefreshing(false);
  }, [loadSubmissions]);

  const loadSubmissionDetail = useCallback(async (submissionId: string) => {
    setLoadingSubmissionIds((current) => ({ ...current, [submissionId]: true }));

    try {
      const detail = await get<SubmissionDetail>(`/api/students/submissions/${submissionId}`);
      setSubmissionDetailsById((current) => ({
        ...current,
        [submissionId]: detail,
      }));
    } catch (error) {
      let message = 'Unable to load attempt photos.';

      if (axios.isAxiosError(error)) {
        const detail = error.response?.data?.detail;
        if (typeof detail === 'string' && detail.trim().length > 0) {
          message = detail;
        }
      } else if (error instanceof Error && error.message.trim().length > 0) {
        message = error.message;
      }

      setErrorMessage(message);
    } finally {
      setLoadingSubmissionIds((current) => ({ ...current, [submissionId]: false }));
    }
  }, [get]);

  const toggleAttempt = useCallback((submissionId: string) => {
    setExpandedSubmissionId((current) => {
      const next = current === submissionId ? null : submissionId;

      if (
        next === submissionId &&
        !submissionDetailsById[submissionId] &&
        !loadingSubmissionIds[submissionId]
      ) {
        void loadSubmissionDetail(submissionId);
      }

      return next;
    });
  }, [loadSubmissionDetail, loadingSubmissionIds, submissionDetailsById]);

  // Auto-refresh when screen comes back into focus (e.g., after upload)
  useFocusEffect(
    useCallback(() => {
      // Only auto-refresh if we already have submissions (not on first load)
      if (submissions.length > 0) {
        void onRefresh();
      }
    }, [submissions.length, onRefresh])
  );

  const goBack = useCallback(() => {
    if (navigation.goBack) {
      navigation.goBack();
    } else {
      navigation.navigate('Submit');
    }
  }, [navigation]);

  const submitAgain = useCallback(() => {
    navigation.navigate('CameraScreen', {
      assignmentId,
    });
  }, [assignmentId, navigation]);

  const clearExpandedAttempt = useCallback(() => {
    setExpandedSubmissionId(null);
  }, []);

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} activeOpacity={0.85} onPress={goBack}>
          <MaterialIcons name="arrow-back" size={20} color="#123A5F" />
        </TouchableOpacity>
        <Text style={styles.title}>{assignmentTitle}</Text>
        <View style={styles.placeholder} />
      </View>

      {isLoading ? (
        <View style={styles.stateWrap}>
          <ActivityIndicator color="#123A5F" />
          <Text style={styles.stateText}>Loading submissions...</Text>
        </View>
      ) : errorMessage ? (
        <View style={styles.stateWrap}>
          <MaterialIcons name="error-outline" size={22} color="#B91C1C" />
          <Text style={styles.errorText}>{errorMessage}</Text>
          <TouchableOpacity style={styles.retryButton} activeOpacity={0.85} onPress={() => void loadSubmissions()}>
            <Text style={styles.retryButtonText}>Retry</Text>
          </TouchableOpacity>
        </View>
      ) : submissions.length === 0 ? (
        <View style={styles.stateWrap}>
          <MaterialIcons name="upload-file" size={24} color="#64748B" />
          <Text style={styles.stateText}>No submissions yet.</Text>
        </View>
      ) : (
        <>
          <View style={styles.infoBar}>
            <MaterialIcons name="info" size={14} color="#2563EB" />
            <Text style={styles.infoBarText}>Pull down to refresh submission status</Text>
          </View>
          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.content}
            refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={() => void onRefresh()} tintColor="#123A5F" />}
          >
          {submissions.map((submission, index) => {
            const isExpanded = expandedSubmissionId === submission.submission_id;
            const detail = submissionDetailsById[submission.submission_id];
            const imageUris = parseSubmissionImages(detail?.image_path);
            const isLoadingPhotos = loadingSubmissionIds[submission.submission_id] === true;

            return (
            <TouchableOpacity
              key={submission.submission_id}
              style={styles.attemptCard}
              activeOpacity={0.88}
              onPress={() => toggleAttempt(submission.submission_id)}
            >
              <View style={styles.attemptHeader}>
                <View style={styles.attemptHeaderLeft}>
                  <Text style={styles.attemptTitle}>Attempt {submissions.length - index}</Text>
                  <MaterialIcons
                    name={isExpanded ? 'keyboard-arrow-up' : 'keyboard-arrow-down'}
                    size={22}
                    color="#64748B"
                  />
                </View>
                <View
                  style={[
                    styles.statusBadge,
                    { backgroundColor: statusColors[submission.processing_status] },
                  ]}
                >
                  <Text style={styles.statusBadgeText}>{statusLabels[submission.processing_status]}</Text>
                </View>
              </View>

              <View style={styles.attemptMeta}>
                <MaterialIcons name="schedule" size={14} color="#64748B" />
                <Text style={styles.attemptMetaText}>
                  {new Date(submission.submitted_at).toLocaleDateString(undefined, {
                    month: 'short',
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </Text>
              </View>

              {submission.score_percentage !== null && submission.processing_status === 'done' && (
                <View style={styles.scoreRow}>
                  <Text style={styles.scoreLabel}>Score:</Text>
                  <Text style={styles.scoreValue}>{submission.score_percentage.toFixed(0)}%</Text>
                </View>
              )}

              {isExpanded ? (
                isLoadingPhotos ? (
                  <View style={styles.loadingPhotosBox}>
                    <ActivityIndicator size="small" color="#123A5F" />
                    <Text style={styles.loadingPhotosText}>Loading photos...</Text>
                  </View>
                ) : imageUris.length > 0 ? (
                  <View style={styles.imagesSection}>
                    <Text style={styles.imagesSectionTitle}>
                      Photos in this attempt ({imageUris.length})
                    </Text>
                    <ScrollView
                      horizontal
                      showsHorizontalScrollIndicator={false}
                      contentContainerStyle={styles.imagesScroll}
                    >
                      {imageUris.map((imageUri, imgIndex) => (
                        <View key={imgIndex} style={styles.imageThumbnailWrap}>
                          <Image
                            source={{ uri: imageUri }}
                            style={styles.imageThumbnail}
                            resizeMode="cover"
                          />
                          <Text style={styles.imageThumbnailNumber}>{imgIndex + 1}</Text>
                        </View>
                      ))}
                    </ScrollView>
                  </View>
                ) : (
                  <View style={styles.noPhotosBox}>
                    <MaterialIcons name="image-not-supported" size={18} color="#94A3B8" />
                    <Text style={styles.noPhotosText}>No photos available for this attempt.</Text>
                  </View>
                )
              ) : (
                <Text style={styles.tapHint}>Tap to view the photos from this attempt.</Text>
              )}
            </TouchableOpacity>
          );
          })}
        </ScrollView>
          <View style={styles.footer}>
            <TouchableOpacity
              style={styles.submitButton}
              activeOpacity={0.85}
              onPress={() => void submitAgain()}
            >
              <MaterialIcons name="photo-camera" size={18} color="#FFFFFF" />
              <Text style={styles.submitButtonText}>Submit Again</Text>
            </TouchableOpacity>
          </View>
        </>
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
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 8,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  title: {
    color: '#123A5F',
    fontSize: 18,
    fontWeight: '800',
    flex: 1,
    marginLeft: 12,
  },
  placeholder: {
    width: 40,
    height: 40,
  },
  infoBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#DBEAFE',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginHorizontal: 16,
    marginTop: 12,
    marginBottom: 8,
  },
  infoBarText: {
    color: '#1E40AF',
    fontSize: 12,
    fontWeight: '500',
  },
  content: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 100,
    gap: 12,
  },
  attemptCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 14,
    gap: 10,
  },
  attemptHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  attemptHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flex: 1,
  },
  attemptTitle: {
    color: '#0F172A',
    fontSize: 15,
    fontWeight: '800',
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
  },
  statusBadgeText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '700',
  },
  attemptMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  attemptMetaText: {
    color: '#64748B',
    fontSize: 12,
  },
  scoreRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingTop: 6,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  scoreLabel: {
    color: '#64748B',
    fontSize: 12,
    fontWeight: '600',
  },
  scoreValue: {
    color: '#16A34A',
    fontSize: 13,
    fontWeight: '700',
  },
  imagesSection: {
    gap: 8,
    paddingTop: 6,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  imagesSectionTitle: {
    color: '#64748B',
    fontSize: 12,
    fontWeight: '600',
  },
  imagesScroll: {
    paddingRight: 8,
    gap: 8,
  },
  loadingPhotosBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#F8FAFC',
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  loadingPhotosText: {
    color: '#475569',
    fontSize: 12,
  },
  tapHint: {
    color: '#64748B',
    fontSize: 12,
    fontStyle: 'italic',
  },
  noPhotosBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#F8FAFC',
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  noPhotosText: {
    color: '#64748B',
    fontSize: 12,
  },
  imageThumbnailWrap: {
    position: 'relative',
  },
  imageThumbnail: {
    width: 100,
    height: 140,
    borderRadius: 8,
    backgroundColor: '#F1F5F9',
  },
  imageThumbnailNumber: {
    position: 'absolute',
    bottom: 4,
    right: 4,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '700',
    paddingHorizontal: 5,
    paddingVertical: 2,
    borderRadius: 4,
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
  footer: {
    backgroundColor: '#F3F1EB',
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 20,
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
  },
  submitButton: {
    backgroundColor: '#123A5F',
    borderRadius: 12,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  submitButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '800',
  },
});
