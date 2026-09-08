import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Image, ScrollView, StyleSheet, Text, TouchableOpacity, View, RefreshControl } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import axios from 'axios';
import * as SecureStore from 'expo-secure-store';
import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { SafeAreaView } from 'react-native-safe-area-context';
import Markdown from '@ronradtke/react-native-markdown-display';

import ScreenHeader from '../../components/ScreenHeader';
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
  assignment_description?: string | null;
  uploaded_files?: Array<string | { name?: string; index?: number }>;
  feedback?: {
    graded_by?: string | null;
    overall_feedback?: string | null;
    strengths?: string | null;
    improvements?: string | null;
    ai_snapshot?: {
      score_percentage?: number | null;
      overall_feedback?: string | null;
      strengths?: string | null;
      improvements?: string | null;
    } | null;
  } | null;
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

/** Stored paths from DB (comma-separated); used only to count segments and guess extensions. */
function imagePathSegments(imagePath?: string | null): string[] {
  if (!imagePath?.trim()) return [];
  return imagePath.split(',').map((p) => p.trim()).filter(Boolean);
}

function basenameFromStoredPath(segment: string): string {
  const norm = segment.replace(/\\/g, '/').replace(/^[\\/]+/, '');
  const i = norm.lastIndexOf('/');
  return (i >= 0 ? norm.slice(i + 1) : norm) || 'file';
}

function extensionFromBasename(fileName: string): string | null {
  const m = /\.([a-z0-9]+)$/i.exec(fileName);
  return m ? `.${m[1].toLowerCase()}` : null;
}

function mimeFromBasename(fileName: string): string {
  const lower = fileName.toLowerCase();
  if (lower.endsWith('.pdf')) return 'application/pdf';
  if (lower.endsWith('.png')) return 'image/png';
  return 'image/jpeg';
}

async function fetchSubmissionAttachmentsToCache(submissionId: string, imagePath?: string | null): Promise<string[]> {
  const segments = imagePathSegments(imagePath);
  if (segments.length === 0) return [];

  const token =
    (await SecureStore.getItemAsync('access_token')) ?? (await SecureStore.getItemAsync('auth_token'));
  if (!token) return [];

  const out: string[] = [];
  for (let fileIndex = 0; fileIndex < segments.length; fileIndex++) {
    const base = basenameFromStoredPath(segments[fileIndex] ?? '');
    const ext = extensionFromBasename(base) ?? '.jpg';
    const cacheName = `sub_${submissionId.replace(/-/g, '')}_${fileIndex}${ext}`;
    const outfile = new File(Paths.cache, cacheName);
    const url = `${API_BASE_URL}/api/students/submissions/${submissionId}/files/${fileIndex}`;
    try {
      const downloaded = await File.downloadFileAsync(url, outfile, {
        headers: { Authorization: `Bearer ${token}` },
        idempotent: true,
      });
      out.push(downloaded.uri);
    } catch {
      // Skip missing or blocked files so other thumbnails still render
    }
  }
  return out;
}

function fileLabel(entry: string | { name?: string; index?: number }, fallbackIndex: number) {
  if (typeof entry === 'string') return entry;
  return entry.name ?? `file_${fallbackIndex + 1}`;
}

function fileEntryIndex(entry: string | { name?: string; index?: number } | undefined, fallbackIndex: number): number {
  if (entry && typeof entry === 'object' && typeof entry.index === 'number') return entry.index;
  return fallbackIndex;
}

function latexToReadableText(expr: string) {
  return expr
    .replace(/\\leftarrow/g, '←')
    .replace(/\\rightarrow/g, '→')
    .replace(/\\times/g, '×')
    .replace(/\\cdot/g, '·')
    .replace(/\\leq?/g, '≤')
    .replace(/\\geq?/g, '≥')
    .replace(/\\neq/g, '≠')
    .replace(/\\pm/g, '±')
    .replace(/\\div/g, '÷')
    .replace(/\\frac\s*\{([^{}]+)\}\s*\{([^{}]+)\}/g, '$1/$2')
    .replace(/\\sqrt\s*\{([^{}]+)\}/g, 'sqrt($1)')
    .replace(/\\left|\\right/g, '')
    .replace(/\\,/g, ' ')
    .replace(/[{}]/g, '')
    .replace(/\\([a-zA-Z]+)/g, '$1')
    .trim();
}

function normalizeMathMarkdown(text: string) {
  return text
    .replace(/\$\$([\s\S]+?)\$\$/g, (_m, expr: string) => `\n\n${latexToReadableText(expr)}\n\n`)
    .replace(/\$([^$\n]+)\$/g, (_m, expr: string) => latexToReadableText(expr));
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
  const [feedbackViewBySubmissionId, setFeedbackViewBySubmissionId] = useState<Record<string, 'official' | 'ai'>>({});
  const [cachedAttachmentUrisBySubmissionId, setCachedAttachmentUrisBySubmissionId] = useState<Record<string, string[]>>(
    {}
  );

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

  useEffect(() => {
    setSubmissionDetailsById({});
    setCachedAttachmentUrisBySubmissionId({});
    setExpandedSubmissionId(null);
  }, [assignmentId]);

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
      const localUris = await fetchSubmissionAttachmentsToCache(submissionId, detail.image_path);
      setCachedAttachmentUrisBySubmissionId((c) => ({ ...c, [submissionId]: localUris }));
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

  const downloadSubmissionFile = useCallback(async (submissionId: string, fileIndex: number, displayName: string) => {
    const token =
      (await SecureStore.getItemAsync('access_token')) ?? (await SecureStore.getItemAsync('auth_token'));
    if (!token) {
      Alert.alert('Session expired', 'Please log in again to download files.');
      return;
    }

    const ext = extensionFromBasename(displayName) ?? (/\.pdf$/i.test(displayName) ? '.pdf' : '.jpg');
    const cacheName = `dl_${submissionId.slice(0, 8)}_${fileIndex}_${Date.now()}${ext}`;
    const outfile = new File(Paths.cache, cacheName);
    const url = `${API_BASE_URL}/api/students/submissions/${submissionId}/files/${fileIndex}`;

    try {
      await File.downloadFileAsync(url, outfile, {
        headers: { Authorization: `Bearer ${token}` },
        idempotent: true,
      });
      const canShare = await Sharing.isAvailableAsync();
      const mime = mimeFromBasename(displayName);
      if (canShare) {
        await Sharing.shareAsync(outfile.uri, { mimeType: mime, dialogTitle: displayName });
      } else {
        Alert.alert('Saved', 'File saved to app cache.');
      }
    } catch {
      Alert.alert('Download failed', 'Could not download this file. Check connection and permissions.');
    }
  }, []);

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      <ScreenHeader
        showBack
        onBackPress={goBack}
        title={assignmentTitle}
        subtitle={!isLoading && submissions.length > 0 ? `Submission detail · ${submissions.length} attempt${submissions.length === 1 ? '' : 's'}` : 'Submission detail'}
      />

      {isLoading ? (
        <View style={styles.stateWrap}>
          <ActivityIndicator color="#123A5F" size="large" />
          <Text style={styles.stateText}>Loading submissions…</Text>
        </View>
      ) : errorMessage ? (
        <View style={styles.stateWrap}>
          <View style={styles.stateIconCircle}>
            <MaterialIcons name="error-outline" size={28} color="#B91C1C" />
          </View>
          <Text style={styles.errorText}>{errorMessage}</Text>
          <TouchableOpacity style={styles.retryButton} activeOpacity={0.85} onPress={() => void loadSubmissions()}>
            <Text style={styles.retryButtonText}>Retry</Text>
          </TouchableOpacity>
        </View>
      ) : submissions.length === 0 ? (
        <View style={styles.stateWrap}>
          <View style={styles.stateIconCircleMuted}>
            <MaterialIcons name="assignment-turned-in" size={28} color="#64748B" />
          </View>
          <Text style={styles.stateTitle}>Nothing submitted yet</Text>
          <Text style={styles.stateSub}>Use Submit again below after you capture your work.</Text>
        </View>
      ) : (
        <>
          <View style={styles.infoBar}>
            <MaterialIcons name="swipe-vertical" size={16} color="#1D4ED8" />
            <Text style={styles.infoBarText}>Pull down anytime to refresh status</Text>
          </View>
          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.content}
            refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={() => void onRefresh()} tintColor="#123A5F" />}
          >
            <View style={styles.summaryBanner}>
              <View style={styles.summaryBannerIcon}>
                <MaterialIcons name="assignment" size={22} color="#123A5F" />
              </View>
              <View style={styles.summaryBannerTextWrap}>
                <Text style={styles.summaryBannerTitle}>Your attempts</Text>
                <Text style={styles.summaryBannerSub}>
                  {submissions.length} submission{submissions.length === 1 ? '' : 's'} · Newest first
                </Text>
              </View>
            </View>

          {submissions.map((submission, index) => {
            const isExpanded = expandedSubmissionId === submission.submission_id;
            const detail = submissionDetailsById[submission.submission_id];
            const imageUris = cachedAttachmentUrisBySubmissionId[submission.submission_id] ?? [];
            const isLoadingPhotos = loadingSubmissionIds[submission.submission_id] === true;
            const feedbackView = feedbackViewBySubmissionId[submission.submission_id] ?? 'official';
            const attemptNum = submissions.length - index;
            const statusColor = statusColors[submission.processing_status] ?? '#64748B';

            return (
            <TouchableOpacity
              key={submission.submission_id}
              style={[
                styles.attemptCard,
                isExpanded && styles.attemptCardExpanded,
              ]}
              activeOpacity={0.88}
              onPress={() => toggleAttempt(submission.submission_id)}
            >
              <View style={[styles.attemptAccent, { backgroundColor: statusColor }]} />
              <View style={styles.attemptCardInner}>
              <View style={styles.attemptHeader}>
                <View style={styles.attemptHeaderLeft}>
                  <View style={styles.attemptNumBadge}>
                    <Text style={styles.attemptNumText}>{attemptNum}</Text>
                  </View>
                  <View style={styles.attemptTitleBlock}>
                    <Text style={styles.attemptTitle}>Attempt {attemptNum}</Text>
                    <Text style={styles.attemptTitleHint}>{isExpanded ? 'Tap to collapse' : 'Tap to expand'}</Text>
                  </View>
                  <MaterialIcons
                    name={isExpanded ? 'expand-less' : 'expand-more'}
                    size={26}
                    color="#94A3B8"
                  />
                </View>
                <View
                  style={[
                    styles.statusBadge,
                    { backgroundColor: statusColor },
                  ]}
                >
                  <MaterialIcons name="flag" size={10} color="#FFFFFF" style={{ marginRight: 4 }} />
                  <Text style={styles.statusBadgeText}>{statusLabels[submission.processing_status]}</Text>
                </View>
              </View>

              <View style={styles.attemptMetaRow}>
                <View style={styles.attemptMeta}>
                  <MaterialIcons name="event" size={15} color="#64748B" />
                  <Text style={styles.attemptMetaText}>
                    {(() => { const s = submission.submitted_at; const h = s.endsWith('Z') || /[+-]\d{2}:\d{2}$/.test(s); return new Date(h ? s : s + 'Z').toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }); })()}
                  </Text>
                </View>
                {submission.score_percentage !== null && submission.processing_status === 'done' ? (
                  <View style={styles.scorePill}>
                    <MaterialIcons name="stars" size={14} color="#15803D" />
                    <Text style={styles.scorePillText}>{submission.score_percentage.toFixed(0)}%</Text>
                  </View>
                ) : null}
              </View>

              {isExpanded ? (
                isLoadingPhotos ? (
                  <View style={styles.loadingPhotosBox}>
                    <ActivityIndicator size="small" color="#123A5F" />
                    <Text style={styles.loadingPhotosText}>Loading attachments…</Text>
                  </View>
                ) : imageUris.length > 0 ? (
                  <View style={styles.imagesSection}>
                    <View style={styles.sectionHeadingRow}>
                      <MaterialIcons name="photo-library" size={14} color="#475569" />
                      <Text style={styles.imagesSectionTitle}>
                        Photos ({imageUris.length})
                      </Text>
                    </View>
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
                    <MaterialIcons name="hide-image" size={20} color="#CBD5E1" />
                    <Text style={styles.noPhotosText}>No photos attached to this attempt.</Text>
                  </View>
                )
              ) : (
                <View style={styles.tapHintRow}>
                  <MaterialIcons name="touch-app" size={14} color="#94A3B8" />
                  <Text style={styles.tapHint}>Show photos, files & feedback</Text>
                </View>
              )}

              {isExpanded && detail?.uploaded_files && detail.uploaded_files.length > 0 ? (
                <View style={styles.uploadedSection}>
                  <View style={styles.sectionHeadingRow}>
                    <MaterialIcons name="folder-open" size={14} color="#475569" />
                    <Text style={styles.uploadedTitle}>Uploaded files</Text>
                  </View>
                  {detail.uploaded_files.map((entry, idx) => {
                    const label = fileLabel(entry, idx);
                    const lower = label.toLowerCase();
                    const isPdf = lower.endsWith('.pdf');
                    const isImage = /\.(png|jpe?g)$/.test(lower);
                    return (
                      <View key={`${label}-${idx}`} style={styles.uploadedRow}>
                        <View style={[styles.uploadedIconWrap, isPdf && styles.uploadedIconWrapPdf]}>
                          <MaterialIcons
                            name={isPdf ? 'picture-as-pdf' : isImage ? 'image' : 'description'}
                            size={18}
                            color={isPdf ? '#B91C1C' : '#334155'}
                          />
                        </View>
                        <Text style={styles.uploadedLabel} numberOfLines={2}>{label}</Text>
                        <View style={[styles.uploadedBadge, isPdf ? styles.uploadedBadgePdf : styles.uploadedBadgeDoc]}>
                          <Text style={styles.uploadedBadgeText}>{isPdf ? 'PDF' : isImage ? 'IMAGE' : 'DOC'}</Text>
                        </View>
                        <TouchableOpacity
                          style={styles.uploadedDownloadBtn}
                          activeOpacity={0.85}
                          onPress={() =>
                            void downloadSubmissionFile(
                              submission.submission_id,
                              fileEntryIndex(entry, idx),
                              label
                            )
                          }
                        >
                          <MaterialIcons name="download" size={18} color="#123A5F" />
                        </TouchableOpacity>
                      </View>
                    );
                  })}
                </View>
              ) : null}

              {isExpanded && detail?.assignment_description ? (
                <View style={styles.assignmentInfoBox}>
                  <View style={styles.sectionHeadingRow}>
                    <MaterialIcons name="menu-book" size={14} color="#475569" />
                    <Text style={styles.assignmentInfoTitle}>Assignment instructions</Text>
                  </View>
                  <Markdown
                    style={{
                      body: styles.assignmentInfoText,
                      paragraph: styles.assignmentInfoText,
                      strong: styles.assignmentInfoStrong,
                      code_inline: styles.assignmentInfoCode,
                      fence: styles.assignmentInfoCode,
                    }}
                  >
                    {normalizeMathMarkdown(detail.assignment_description)}
                  </Markdown>
                </View>
              ) : null}

              {isExpanded && detail?.feedback ? (
                <View style={styles.feedbackSection}>
                  <View style={styles.sectionHeadingRow}>
                    <MaterialIcons name="rate-review" size={14} color="#475569" />
                    <Text style={styles.feedbackTitle}>Feedback</Text>
                  </View>
                  {detail.feedback.graded_by && detail.feedback.ai_snapshot ? (
                    <>
                      <View style={styles.feedbackSwitchRow}>
                        <TouchableOpacity
                          style={[styles.feedbackSwitchBtn, feedbackView === 'official' && styles.feedbackSwitchBtnActive]}
                          activeOpacity={0.85}
                          onPress={() =>
                            setFeedbackViewBySubmissionId((c) => ({ ...c, [submission.submission_id]: 'official' }))
                          }
                        >
                          <Text style={[styles.feedbackSwitchText, feedbackView === 'official' && styles.feedbackSwitchTextActive]}>
                            Instructor
                          </Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={[styles.feedbackSwitchBtn, feedbackView === 'ai' && styles.feedbackSwitchBtnActive]}
                          activeOpacity={0.85}
                          onPress={() =>
                            setFeedbackViewBySubmissionId((c) => ({ ...c, [submission.submission_id]: 'ai' }))
                          }
                        >
                          <Text style={[styles.feedbackSwitchText, feedbackView === 'ai' && styles.feedbackSwitchTextActive]}>
                            Original AI
                          </Text>
                        </TouchableOpacity>
                      </View>
                      {feedbackView === 'official' ? (
                        <View style={styles.feedbackCardOfficial}>
                          {detail.feedback.overall_feedback ? <Text style={styles.feedbackBody}>{detail.feedback.overall_feedback}</Text> : null}
                          {detail.feedback.strengths ? <Text style={styles.feedbackMeta}><Text style={styles.feedbackMetaBold}>Strengths:</Text> {detail.feedback.strengths}</Text> : null}
                          {detail.feedback.improvements ? <Text style={styles.feedbackMeta}><Text style={styles.feedbackMetaBold}>To improve:</Text> {detail.feedback.improvements}</Text> : null}
                        </View>
                      ) : (
                        <View style={styles.feedbackCardAi}>
                          {detail.feedback.ai_snapshot.overall_feedback ? <Text style={styles.feedbackBody}>{detail.feedback.ai_snapshot.overall_feedback}</Text> : null}
                          {detail.feedback.ai_snapshot.strengths ? <Text style={styles.feedbackMeta}><Text style={styles.feedbackMetaBold}>Strengths:</Text> {detail.feedback.ai_snapshot.strengths}</Text> : null}
                          {detail.feedback.ai_snapshot.improvements ? <Text style={styles.feedbackMeta}><Text style={styles.feedbackMetaBold}>To improve:</Text> {detail.feedback.ai_snapshot.improvements}</Text> : null}
                        </View>
                      )}
                    </>
                  ) : (
                    <View style={styles.feedbackCardOfficial}>
                      {detail.feedback.overall_feedback ? <Text style={styles.feedbackBody}>{detail.feedback.overall_feedback}</Text> : null}
                      {detail.feedback.strengths ? <Text style={styles.feedbackMeta}><Text style={styles.feedbackMetaBold}>Strengths:</Text> {detail.feedback.strengths}</Text> : null}
                      {detail.feedback.improvements ? <Text style={styles.feedbackMeta}><Text style={styles.feedbackMetaBold}>To improve:</Text> {detail.feedback.improvements}</Text> : null}
                    </View>
                  )}
                </View>
              ) : null}
              </View>
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
              <MaterialIcons name="add-a-photo" size={20} color="#FFFFFF" />
              <Text style={styles.submitButtonText}>Submit again</Text>
            </TouchableOpacity>
            <Text style={styles.footerHint}>Opens camera / upload for this assignment</Text>
          </View>
        </>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F1F5F9',
  },
  infoBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#E0E7FF',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginHorizontal: 16,
    marginTop: 6,
    marginBottom: 4,
    borderWidth: 1,
    borderColor: '#C7D2FE',
  },
  infoBarText: {
    color: '#312E81',
    fontSize: 12,
    fontWeight: '600',
    flex: 1,
  },
  summaryBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 14,
    marginBottom: 4,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  summaryBannerIcon: {
    width: 48,
    height: 48,
    borderRadius: 14,
    backgroundColor: '#E0E7FF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  summaryBannerTextWrap: { flex: 1 },
  summaryBannerTitle: {
    color: '#0F172A',
    fontSize: 15,
    fontWeight: '800',
  },
  summaryBannerSub: {
    color: '#64748B',
    fontSize: 12,
    fontWeight: '600',
    marginTop: 2,
  },
  content: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 120,
    gap: 14,
  },
  attemptCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    overflow: 'hidden',
    flexDirection: 'row',
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.07,
    shadowRadius: 12,
    elevation: 3,
  },
  attemptCardExpanded: {
    borderColor: '#BFDBFE',
    shadowOpacity: 0.1,
  },
  attemptAccent: {
    width: 4,
  },
  attemptCardInner: {
    flex: 1,
    padding: 16,
    gap: 12,
  },
  attemptHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 8,
  },
  attemptHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
    minWidth: 0,
  },
  attemptNumBadge: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  attemptNumText: {
    color: '#123A5F',
    fontSize: 15,
    fontWeight: '800',
  },
  attemptTitleBlock: { flex: 1, minWidth: 0 },
  attemptTitle: {
    color: '#0F172A',
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: -0.2,
  },
  attemptTitleHint: {
    color: '#94A3B8',
    fontSize: 11,
    fontWeight: '600',
    marginTop: 2,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
  },
  statusBadgeText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '800',
  },
  attemptMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    flexWrap: 'wrap',
  },
  attemptMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flex: 1,
  },
  attemptMetaText: {
    color: '#64748B',
    fontSize: 12,
    fontWeight: '600',
  },
  scorePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#DCFCE7',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#BBF7D0',
  },
  scorePillText: {
    color: '#15803D',
    fontSize: 13,
    fontWeight: '800',
  },
  sectionHeadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 8,
  },
  imagesSection: {
    gap: 0,
    paddingTop: 4,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#E2E8F0',
    paddingBottom: 4,
  },
  imagesSectionTitle: {
    color: '#334155',
    fontSize: 12,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  imagesScroll: {
    paddingRight: 8,
    gap: 10,
    paddingBottom: 4,
  },
  loadingPhotosBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#F8FAFC',
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  loadingPhotosText: {
    color: '#475569',
    fontSize: 13,
    fontWeight: '600',
  },
  tapHintRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 4,
  },
  tapHint: {
    color: '#64748B',
    fontSize: 12,
    fontWeight: '600',
  },
  noPhotosBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#F8FAFC',
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 14,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: '#CBD5E1',
  },
  noPhotosText: {
    color: '#64748B',
    fontSize: 13,
    fontWeight: '600',
    flex: 1,
  },
  imageThumbnailWrap: {
    position: 'relative',
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  imageThumbnail: {
    width: 108,
    height: 148,
    borderRadius: 12,
    backgroundColor: '#F1F5F9',
  },
  imageThumbnailNumber: {
    position: 'absolute',
    bottom: 6,
    right: 6,
    backgroundColor: 'rgba(15, 23, 42, 0.72)',
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '800',
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 6,
  },
  stateWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
    gap: 12,
  },
  stateIconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#FEE2E2',
    alignItems: 'center',
    justifyContent: 'center',
  },
  stateIconCircleMuted: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  stateText: {
    color: '#475569',
    fontSize: 15,
    textAlign: 'center',
    fontWeight: '600',
  },
  stateTitle: {
    color: '#0F172A',
    fontSize: 18,
    fontWeight: '800',
    textAlign: 'center',
  },
  stateSub: {
    color: '#64748B',
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 20,
    fontWeight: '500',
  },
  errorText: {
    color: '#B91C1C',
    fontSize: 14,
    textAlign: 'center',
    fontWeight: '600',
    lineHeight: 20,
  },
  retryButton: {
    marginTop: 4,
    backgroundColor: '#123A5F',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 999,
  },
  retryButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '800',
  },
  footer: {
    backgroundColor: '#F8FAFC',
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 22,
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
    gap: 8,
  },
  submitButton: {
    backgroundColor: '#123A5F',
    borderRadius: 14,
    paddingVertical: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    shadowColor: '#123A5F',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 4,
  },
  submitButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: 0.2,
  },
  footerHint: {
    textAlign: 'center',
    color: '#64748B',
    fontSize: 11,
    fontWeight: '600',
  },
  assignmentInfoBox: {
    marginTop: 4,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#E2E8F0',
    paddingTop: 14,
    gap: 4,
    backgroundColor: '#F8FAFC',
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingBottom: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  assignmentInfoTitle: {
    color: '#334155',
    fontSize: 12,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  assignmentInfoText: {
    color: '#1E293B',
    fontSize: 13,
    lineHeight: 20,
  },
  assignmentInfoStrong: {
    color: '#0F172A',
    fontWeight: '800',
  },
  assignmentInfoCode: {
    color: '#0F172A',
    backgroundColor: '#E2E8F0',
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
    fontSize: 12,
  },
  uploadedSection: {
    marginTop: 4,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#E2E8F0',
    paddingTop: 14,
    gap: 8,
  },
  uploadedTitle: {
    color: '#334155',
    fontSize: 12,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  uploadedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  uploadedIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  uploadedIconWrapPdf: {
    backgroundColor: '#FEE2E2',
  },
  uploadedLabel: {
    flex: 1,
    color: '#0F172A',
    fontSize: 13,
    fontWeight: '600',
  },
  uploadedBadge: {
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  uploadedBadgePdf: {
    backgroundColor: '#FEE2E2',
  },
  uploadedBadgeDoc: {
    backgroundColor: '#E2E8F0',
  },
  uploadedBadgeText: {
    color: '#334155',
    fontSize: 9,
    fontWeight: '800',
  },
  uploadedDownloadBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#BFDBFE',
    backgroundColor: '#EFF6FF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  feedbackSection: {
    marginTop: 4,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#E2E8F0',
    paddingTop: 14,
    gap: 10,
  },
  feedbackTitle: {
    color: '#334155',
    fontSize: 12,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  feedbackSwitchRow: {
    flexDirection: 'row',
    backgroundColor: '#F1F5F9',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 3,
    gap: 4,
  },
  feedbackSwitchBtn: {
    flex: 1,
    borderRadius: 10,
    paddingVertical: 9,
    alignItems: 'center',
  },
  feedbackSwitchBtnActive: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#93C5FD',
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 2,
    elevation: 1,
  },
  feedbackSwitchText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#64748B',
  },
  feedbackSwitchTextActive: {
    color: '#123A5F',
  },
  feedbackCardOfficial: {
    backgroundColor: '#F0FDF4',
    borderWidth: 1,
    borderColor: '#86EFAC',
    borderRadius: 14,
    padding: 14,
    gap: 8,
  },
  feedbackCardAi: {
    backgroundColor: '#EFF6FF',
    borderWidth: 1,
    borderColor: '#93C5FD',
    borderRadius: 14,
    padding: 14,
    gap: 8,
  },
  feedbackBody: {
    color: '#1E293B',
    fontSize: 13,
    lineHeight: 20,
  },
  feedbackMeta: {
    color: '#334155',
    fontSize: 13,
    lineHeight: 20,
  },
  feedbackMetaBold: {
    fontWeight: '800',
    color: '#0F172A',
  },
});
