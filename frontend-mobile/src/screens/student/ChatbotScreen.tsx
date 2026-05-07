import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  Easing,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import axios from 'axios';
import * as DocumentPicker from 'expo-document-picker';
import Markdown from '@ronradtke/react-native-markdown-display';
import Constants from 'expo-constants';

import { useApi } from '../../hooks/useApi';
import { useAppTheme, type ThemePalette } from '../../context/ThemeContext';

// ─── Types ────────────────────────────────────────────────────────────────────

type Role = 'user' | 'assistant';

type Message = {
  id: string;
  role: Role;
  content: string;
  citation?: string | null;
  timestamp: Date;
  thinking?: boolean;
};

type ChatResponse = {
  answer: string;
  sources?: string[];
  history_id?: string | null;
  persisted?: boolean;
};

type SessionItem = {
  history_id: string;
  subject_id?: number;
  subject_name?: string;
  preview?: string;
  updated_at?: string | null;
};

type SessionsResponse = {
  items?: SessionItem[];
};
type SessionDetailResponse = {
  history_id: string;
  subject_id: number;
  subject_name: string;
  messages: Array<{
    role?: string;
    text?: string;
    citation?: string | null;
    timestamp?: string | null;
  }>;
};

type Subject = {
  subject_id: number;
  subject_name: string;
};

type EnrollmentResponse = {
  items?: Subject[];
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function formatTime(date: Date) {
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function formatDate(iso?: string | null) {
  if (!iso) return 'Recently';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return 'Recently';
  return d.toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function parseApiError(error: unknown, fallback: string) {
  if (axios.isAxiosError(error)) {
    const detail = error.response?.data?.detail;
    if (typeof detail === 'string' && detail.trim().length > 0) return detail;
    if (error.code === 'ECONNABORTED') return 'Request timed out. Please try again.';
    if (!error.response) return 'Could not reach the server. Check your connection.';
  }
  if (error instanceof Error && error.message.trim().length > 0) return error.message;
  return fallback;
}

// ─── Animated thinking dots ───────────────────────────────────────────────────

function ThinkingDots({ dotColor }: { dotColor: string }) {
  const dots = [useRef(new Animated.Value(0.3)).current, useRef(new Animated.Value(0.3)).current, useRef(new Animated.Value(0.3)).current];

  useEffect(() => {
    const animations = dots.map((dot, i) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(i * 150),
          Animated.timing(dot, { toValue: 1, duration: 400, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
          Animated.timing(dot, { toValue: 0.3, duration: 400, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
        ])
      )
    );
    animations.forEach((a) => a.start());
    return () => animations.forEach((a) => a.stop());
  }, []);

  return (
    <View style={styles.thinkingDotsRow}>
      {dots.map((d, i) => (
        <Animated.View key={i} style={[styles.thinkingDot, { backgroundColor: dotColor, opacity: d, transform: [{ scale: d }] }]} />
      ))}
    </View>
  );
}

// ─── Bubble ───────────────────────────────────────────────────────────────────

function Bubble({ message, theme, userLabel }: { message: Message; theme: ThemePalette; userLabel: string }) {
  const isUser = message.role === 'user';
  const userInitial =
    userLabel.trim().length > 0 ? userLabel.trim().charAt(0).toUpperCase() : 'U';
  const c = theme.colors;

  const botBubbleStyle = {
    backgroundColor: c.surface,
    borderColor: c.border,
    shadowColor: c.shadow,
  };
  const codeSty = {
    color: c.primary,
    backgroundColor: c.primarySoft,
    borderRadius: 4,
    paddingHorizontal: 5 as const,
    paddingVertical: 1 as const,
    fontSize: 12,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : ('monospace' as string),
  };

  return (
    <View style={[styles.row, isUser ? styles.rowEnd : styles.rowStart]}>
      {!isUser && (
        <View style={styles.botAvatarWrap}>
          <View style={[styles.botAvatarRing, { backgroundColor: c.primary, borderColor: c.primarySoft }]}>
            <MaterialIcons name="auto-awesome" size={12} color={c.surface} />
          </View>
        </View>
      )}

      <View style={[styles.bubbleWrap, isUser ? styles.bubbleWrapUser : styles.bubbleWrapBot]}>
        {!isUser && message.citation ? (
          <View style={[styles.citationRow, { borderLeftColor: c.border }]}>
            <MaterialIcons name="description" size={10} color={c.muted} />
            <Text style={[styles.citationText, { color: c.muted }]} numberOfLines={1}>
              Source: {message.citation}
            </Text>
          </View>
        ) : null}

        <View
          style={[
            styles.bubble,
            isUser
              ? [styles.bubbleUser, { backgroundColor: c.primary, shadowColor: c.shadow }]
              : [styles.bubbleBot, botBubbleStyle],
          ]}
        >
          {!isUser ? (
            <Text style={[styles.senderLabel, { color: c.muted }]}>✦ AI Tutor</Text>
          ) : null}
          {message.thinking ? (
            <ThinkingDots dotColor={c.inactive} />
          ) : (
            isUser ? (
              <Text style={[styles.bubbleText, { color: c.surface }]}>{message.content}</Text>
            ) : (
              <Markdown
                style={{
                  body: { color: c.text, fontSize: 14, lineHeight: 22 },
                  paragraph: { color: c.text, fontSize: 14, lineHeight: 22 },
                  text: { color: c.text, fontSize: 14, lineHeight: 22 },
                  strong: { color: c.text, fontWeight: '800' as const },
                  em: { color: c.text, fontSize: 14, lineHeight: 22 },
                  code_inline: codeSty,
                  code_block: codeSty,
                  fence: codeSty,
                  bullet_list: styles.bubbleList,
                  ordered_list: styles.bubbleList,
                  list_item: { color: c.text, fontSize: 14, lineHeight: 22 },
                }}
              >
                {message.content}
              </Markdown>
            )
          )}
        </View>

        {!message.thinking && (
          <Text style={[styles.timestamp, { color: c.inactive }, isUser ? styles.timestampUser : styles.timestampBot]}>
            {formatTime(message.timestamp)}
          </Text>
        )}
      </View>

      {isUser && (
        <View style={[styles.userAvatar, { backgroundColor: c.primary }]}>
          <Text style={[styles.userAvatarText, { color: c.surface }]}>{userInitial}</Text>
        </View>
      )}
    </View>
  );
}

// ─── Screen ───────────────────────────────────────────────────────────────────

const WELCOME = "Namaste! I'm your AI Tutor. Ask me anything about your curriculum — units, lessons, or concepts you'd like to understand better.";

export default function ChatbotScreen() {
  const { get, post } = useApi();
  const { theme } = useAppTheme();
  const flatListRef = useRef<FlatList<Message>>(null);

  const [messages, setMessages] = useState<Message[]>([
    { id: 'welcome', role: 'assistant', content: WELCOME, timestamp: new Date() },
  ]);
  const [inputText, setInputText] = useState('');
  const [sending, setSending] = useState(false);
  const [historyId, setHistoryId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Subjects + selection
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [selectedSubject, setSelectedSubject] = useState<number | null>(null);
  const [showSubjectPicker, setShowSubjectPicker] = useState(false);

  // History panel
  const [sessions, setSessions] = useState<SessionItem[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historySearch, setHistorySearch] = useState('');
  const [loadingSessionId, setLoadingSessionId] = useState<string | null>(null);
  const [uploadingNote, setUploadingNote] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [speechAvailable, setSpeechAvailable] = useState(false);
  const [profileId, setProfileId] = useState<string>('');
  const [profileName, setProfileName] = useState<string>('Student');
  const speechModuleRef = useRef<{
    requestPermissionsAsync: () => Promise<{ granted: boolean }>;
    start: (options: Record<string, unknown>) => void;
    stop: () => void;
    addListener?: (eventName: string, cb: (event: unknown) => void) => { remove: () => void };
  } | null>(null);

  // Suggestions
  const showSuggestions = messages.length === 1;
  const suggestions = [
    { icon: 'lightbulb', label: 'Explain a concept', prompt: 'Explain photosynthesis in simple terms.' },
    { icon: 'help-outline', label: 'Solve a problem', prompt: 'Help me solve a quadratic equation step by step.' },
    { icon: 'menu-book', label: 'Summarize a topic', prompt: 'Summarize the French Revolution in 5 bullet points.' },
    { icon: 'quiz', label: 'Practice question', prompt: 'Give me a practice question on Newton\'s laws of motion.' },
  ];

  // ── Load subjects once ──
  useEffect(() => {
    const loadSubjects = async () => {
      try {
        const res = await get<EnrollmentResponse>('/api/students/enrollments');
        setSubjects(res.items ?? []);
      } catch {
        // optional
      }
    };
    void loadSubjects();
  }, [get]);
  useEffect(() => {
    const loadProfile = async () => {
      try {
        const profile = await get<Record<string, unknown>>('/api/students/profile');
        if (typeof profile.user_id === 'string') setProfileId(profile.user_id);
        const fullName = typeof profile.full_name === 'string' ? profile.full_name.trim() : '';
        const firstName = typeof profile.first_name === 'string' ? profile.first_name.trim() : '';
        if (fullName) setProfileName(fullName);
        else if (firstName) setProfileName(firstName);
      } catch {
        // optional
      }
    };
    void loadProfile();
  }, [get]);

  useEffect(() => {
    let mounted = true;
    let cleanup: Array<() => void> = [];
    const initSpeech = async () => {
      const isExpoGo =
        Constants.appOwnership === 'expo' ||
        Constants.executionEnvironment === 'storeClient';

      if (isExpoGo) {
        // Expo Go (store client) does not include this native module.
        setSpeechAvailable(false);
        return;
      }
      try {
        const speechPkg = await import('expo-speech-recognition');
        const speech = speechPkg.ExpoSpeechRecognitionModule;
        speechModuleRef.current = speech;
        if (!mounted) return;
        setSpeechAvailable(true);
        // Register native listeners when available (dev build). In Expo Go this module is absent.
        if (typeof speech.addListener === 'function') {
          const onStart = speech.addListener('start', () => setIsListening(true));
          const onEnd = speech.addListener('end', () => setIsListening(false));
          const onError = speech.addListener('error', () => {
            setIsListening(false);
            setError('Microphone error. Please try again.');
          });
          const onResult = speech.addListener('result', (event: unknown) => {
            const first = (event as { results?: Array<{ transcript?: string }> }).results?.[0];
            const transcript = first?.transcript ?? '';
            if (transcript) setInputText(transcript);
          });
          cleanup = [
            () => onStart?.remove?.(),
            () => onEnd?.remove?.(),
            () => onError?.remove?.(),
            () => onResult?.remove?.(),
          ];
        }
      } catch {
        if (mounted) setSpeechAvailable(false);
      }
    };
    void initSpeech();
    return () => {
      mounted = false;
      cleanup.forEach((fn) => fn());
    };
  }, []);

  // ── Send message ──
  const sendMessage = useCallback(
    async (overrideText?: string) => {
      const text = (overrideText ?? inputText).trim();
      if (!text || sending) return;

      setError(null);
      setInputText('');

      const userMsg: Message = {
        id: makeId(),
        role: 'user',
        content: text,
        timestamp: new Date(),
      };
      const thinkingId = makeId();
      const thinkingMsg: Message = {
        id: thinkingId,
        role: 'assistant',
        content: '',
        timestamp: new Date(),
        thinking: true,
      };
      setMessages((prev) => [...prev, userMsg, thinkingMsg]);
      setSending(true);

      try {
        const body: Record<string, unknown> = { query: text };
        if (historyId) body.history_id = historyId;
        if (selectedSubject) body.subject_id = selectedSubject;

        const res = await post<ChatResponse>('/api/students/ai-tutor/chat', body);
        const answer = res.answer || 'I had trouble producing a response.';
        const citation = res.sources?.[0] ?? null;

        setMessages((prev) =>
          prev.map((m) =>
            m.id === thinkingId
              ? { id: thinkingId, role: 'assistant', content: answer, citation, timestamp: new Date() }
              : m
          )
        );
        if (res.history_id) setHistoryId(res.history_id);
      } catch (err) {
        setMessages((prev) => prev.filter((m) => m.id !== thinkingId));
        setError(parseApiError(err, 'Could not get a response. Please try again.'));
      } finally {
        setSending(false);
      }
    },
    [historyId, inputText, post, selectedSubject, sending]
  );

  // ── Auto-scroll on new messages ──
  useEffect(() => {
    if (messages.length > 0) {
      const t = setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);
      return () => clearTimeout(t);
    }
  }, [messages.length]);

  // ── Sessions ──
  const loadSessions = useCallback(async () => {
    setHistoryLoading(true);
    try {
      const params = new URLSearchParams();
      params.set('page', '1');
      params.set('per_page', '20');
      if (historySearch.trim()) params.set('search', historySearch.trim());
      if (selectedSubject != null) params.set('subject_id', String(selectedSubject));
      const res = await get<SessionsResponse>(`/api/students/ai-tutor/sessions?${params.toString()}`);
      setSessions(res.items ?? []);
    } catch {
      // silent
    } finally {
      setHistoryLoading(false);
    }
  }, [get, historySearch, selectedSubject]);

  const toggleHistory = useCallback(() => {
    if (!showHistory) void loadSessions();
    setShowHistory((v) => !v);
  }, [loadSessions, showHistory]);
  useEffect(() => {
    if (showHistory) void loadSessions();
  }, [historySearch, loadSessions, showHistory]);

  const loadPastSession = useCallback(
    async (session: SessionItem) => {
      setLoadingSessionId(session.history_id);
      try {
        const detail = await get<SessionDetailResponse>(`/api/students/ai-tutor/sessions/${session.history_id}`);
        const loaded = (detail.messages ?? [])
          .map((m, idx) => {
            const role = m.role === 'user' ? 'user' : 'assistant';
            const rawTs = m.timestamp ? new Date(m.timestamp) : new Date();
            return {
              id: `loaded-${session.history_id}-${idx}`,
              role,
              content: m.text ?? '',
              citation: m.citation ?? null,
              timestamp: Number.isNaN(rawTs.getTime()) ? new Date() : rawTs,
            } as Message;
          })
          .filter((m) => m.content.trim().length > 0);
        setMessages(loaded.length ? loaded : [{ id: 'welcome', role: 'assistant', content: WELCOME, timestamp: new Date() }]);
        setHistoryId(detail.history_id);
        setSelectedSubject(detail.subject_id ?? null);
        setShowHistory(false);
        setError(null);
      } catch (err) {
        setError(parseApiError(err, 'Could not load this chat session.'));
      } finally {
        setLoadingSessionId(null);
      }
    },
    [get]
  );

  const startNewChat = useCallback(() => {
    setHistoryId(null);
    setMessages([{ id: 'welcome', role: 'assistant', content: WELCOME, timestamp: new Date() }]);
    setError(null);
    setShowHistory(false);
  }, []);

  const selectedSubjectName = selectedSubject != null
    ? subjects.find((s) => s.subject_id === selectedSubject)?.subject_name
    : null;
  const filteredSessions = sessions.filter((s) => {
    const q = historySearch.trim().toLowerCase();
    if (!q) return true;
    const preview = (s.preview ?? '').toLowerCase();
    const subject = (s.subject_name ?? '').toLowerCase();
    return preview.includes(q) || subject.includes(q) || s.history_id.toLowerCase().includes(q);
  });

  const handleVoiceInput = useCallback(async () => {
    const speech = speechModuleRef.current;
    if (!speech) {
      setError('Microphone is available in dev build, not Expo Go.');
      return;
    }
    if (isListening) {
      speech.stop();
      return;
    }
    try {
      const perm = await speech.requestPermissionsAsync();
      if (!perm.granted) {
        setError('Microphone permission is required for voice input.');
        return;
      }
      speech.start({
        lang: 'en-US',
        interimResults: true,
        continuous: false,
      });
    } catch {
      setError('Voice input is unavailable on this build. Use text input.');
    }
  }, [isListening]);

  const uploadPersonalNote = useCallback(async () => {
    if (uploadingNote) return;
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: [
          'application/pdf',
          'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
          'text/plain',
          'image/jpeg',
          'image/png',
        ],
        copyToCacheDirectory: true,
        multiple: false,
      });
      if (result.canceled || !result.assets?.length) return;
      const asset = result.assets[0];
      setUploadingNote(true);
      const formData = new FormData();
      formData.append('file', {
        uri: asset.uri,
        name: asset.name || `note-${Date.now()}.pdf`,
        type: asset.mimeType || 'application/pdf',
      } as unknown as Blob);
      formData.append('user_type', 'student');
      formData.append('submitted_by', profileId || 'student');
      if (profileId) formData.append('student_id', profileId);
      if (selectedSubjectName) formData.append('subject', selectedSubjectName);

      await post('/api/rag/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
        timeout: 120000,
      });
      setMessages((prev) => [
        ...prev,
        {
          id: makeId(),
          role: 'assistant',
          content: `Your note **${asset.name || 'document'}** has been uploaded and indexed. You can now ask questions from it.`,
          timestamp: new Date(),
        },
      ]);
      setError(null);
    } catch (err) {
      setError(parseApiError(err, 'Could not upload note.'));
    } finally {
      setUploadingNote(false);
    }
  }, [post, profileId, selectedSubjectName, uploadingNote]);

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: theme.colors.screen }]} edges={['top', 'left', 'right']}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 24}
      >
        {/* ── Header ── */}
        <View style={[styles.header, { backgroundColor: theme.colors.surface, borderBottomColor: theme.colors.border }]}>
          <View style={styles.headerInner}>
            <View style={[styles.botBadgeRing, { backgroundColor: theme.colors.primary, shadowColor: theme.colors.shadow }]}>
              <MaterialIcons name="auto-awesome" size={18} color={theme.colors.surface} />
              <View style={[styles.botBadgePulseRing, { borderColor: theme.colors.primarySoft }]} />
            </View>
            <View style={styles.headerText}>
              <Text style={[styles.headerTitle, { color: theme.colors.primary }]} numberOfLines={1}>
                AI Study Tutor
              </Text>
              <View style={styles.headerStatusRow}>
                <View style={[styles.headerPulse, { backgroundColor: theme.colors.muted }]} />
                <Text style={[styles.headerStatusText, { color: theme.colors.muted }]}>Always available</Text>
              </View>
            </View>

            <View style={styles.headerActions}>
              <TouchableOpacity
                style={[styles.headerIconBtn, { backgroundColor: theme.colors.primarySoft }]}
                activeOpacity={0.75}
                onPress={toggleHistory}
              >
                <MaterialIcons name="history" size={18} color={theme.colors.primary} />
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.headerIconBtn, { backgroundColor: theme.colors.primarySoft }]}
                activeOpacity={0.75}
                onPress={() => void uploadPersonalNote()}
                disabled={uploadingNote}
              >
                {uploadingNote ? (
                  <ActivityIndicator size="small" color={theme.colors.primary} />
                ) : (
                  <MaterialIcons name="attach-file" size={18} color={theme.colors.primary} />
                )}
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.headerIconBtn, styles.headerNewBtn, { backgroundColor: theme.colors.primary }]}
                activeOpacity={0.75}
                onPress={startNewChat}
              >
                <MaterialIcons name="add" size={20} color={theme.colors.surface} />
              </TouchableOpacity>
            </View>
          </View>
          {/* Subject pill inline */}
          {subjects.length > 0 && (
            <View style={styles.headerSubjectRow}>
              <Pressable
                style={[
                  styles.subjectPill,
                  { backgroundColor: theme.colors.surfaceMuted, borderColor: theme.colors.border },
                  selectedSubject != null && { backgroundColor: theme.colors.primarySoft, borderColor: theme.colors.primary },
                ]}
                onPress={() => setShowSubjectPicker((v) => !v)}
              >
                <MaterialIcons name="school" size={11} color={selectedSubject != null ? theme.colors.primary : theme.colors.muted} />
                <Text style={[styles.subjectPillText, { color: selectedSubject != null ? theme.colors.primary : theme.colors.muted }]} numberOfLines={1}>
                  {selectedSubjectName ?? 'All subjects'}
                </Text>
                <MaterialIcons name={showSubjectPicker ? 'expand-less' : 'expand-more'} size={14} color={selectedSubject != null ? theme.colors.primary : theme.colors.muted} />
              </Pressable>
              {historyId && (
                <View style={[styles.sessionChip, { backgroundColor: theme.colors.primarySoft, borderColor: theme.colors.border }]}>
                  <View style={[styles.sessionChipDot, { backgroundColor: theme.colors.primary }]} />
                  <Text style={[styles.sessionChipText, { color: theme.colors.primary }]} numberOfLines={1}>Session active</Text>
                </View>
              )}
            </View>
          )}
        </View>

        {/* ── Subject picker dropdown ── */}
        {showSubjectPicker && subjects.length > 0 && (
          <View style={[styles.dropdownPanel, { backgroundColor: theme.colors.surface, borderBottomColor: theme.colors.border }]}>
            <TouchableOpacity
              style={styles.dropdownItem}
              onPress={() => {
                setSelectedSubject(null);
                setShowSubjectPicker(false);
              }}
            >
              <MaterialIcons
                name={selectedSubject == null ? 'radio-button-checked' : 'radio-button-unchecked'}
                size={16}
                color={selectedSubject == null ? theme.colors.primary : theme.colors.muted}
              />
              <Text style={[styles.dropdownItemText, { color: theme.colors.text }]}>All subjects</Text>
            </TouchableOpacity>
            {subjects.map((s) => (
              <TouchableOpacity
                key={s.subject_id}
                style={styles.dropdownItem}
                onPress={() => {
                  setSelectedSubject(s.subject_id);
                  setShowSubjectPicker(false);
                  setHistoryId(null);
                }}
              >
                <MaterialIcons
                  name={selectedSubject === s.subject_id ? 'radio-button-checked' : 'radio-button-unchecked'}
                  size={16}
                  color={selectedSubject === s.subject_id ? theme.colors.primary : theme.colors.muted}
                />
                <Text style={[styles.dropdownItemText, { color: theme.colors.text }]}>{s.subject_name}</Text>
              </TouchableOpacity>
            ))}
          </View>
        )}

        {/* ── History panel ── */}
        {showHistory && (
          <View style={[styles.historyPanel, { backgroundColor: theme.colors.surface, borderBottomColor: theme.colors.border }]}>
            <View style={styles.historyPanelHeader}>
              <Text style={[styles.historyPanelTitle, { color: theme.colors.primary }]}>Recent chats</Text>
              <TouchableOpacity onPress={() => setShowHistory(false)}>
                <MaterialIcons name="close" size={18} color={theme.colors.muted} />
              </TouchableOpacity>
            </View>
            <View style={[styles.historySearchWrap, { backgroundColor: theme.colors.surfaceMuted, borderColor: theme.colors.border }]}>
              <MaterialIcons name="search" size={14} color={theme.colors.muted} />
              <TextInput
                style={[styles.historySearchInput, { color: theme.colors.text }]}
                placeholder="Search sessions..."
                placeholderTextColor={theme.colors.muted}
                value={historySearch}
                onChangeText={setHistorySearch}
              />
              {historySearch.length > 0 ? (
                <TouchableOpacity onPress={() => setHistorySearch('')}>
                  <MaterialIcons name="close" size={14} color={theme.colors.muted} />
                </TouchableOpacity>
              ) : null}
            </View>
            {historyLoading ? (
              <View style={styles.historyLoading}>
                <ThinkingDots dotColor={theme.colors.inactive} />
              </View>
            ) : filteredSessions.length === 0 ? (
              <View style={styles.historyEmpty}>
                <MaterialIcons name="forum" size={26} color={theme.colors.inactive} />
                <Text style={[styles.historyEmptyText, { color: theme.colors.muted }]}>
                  No matching chats
                </Text>
              </View>
            ) : (
              filteredSessions.slice(0, 10).map((s) => (
                <TouchableOpacity
                  key={s.history_id}
                  style={[styles.historyItem, { borderTopColor: theme.colors.border }]}
                  activeOpacity={0.85}
                  onPress={() => void loadPastSession(s)}
                >
                  <View style={[styles.historyItemIcon, { backgroundColor: theme.colors.primarySoft }]}>
                    <MaterialIcons name="chat-bubble-outline" size={14} color={theme.colors.primary} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.historyItemPreview, { color: theme.colors.primary }]} numberOfLines={1}>
                      {s.preview ?? s.subject_name ?? `Session ${s.history_id.slice(0, 8)}`}
                    </Text>
                    <Text style={[styles.historyItemDate, { color: theme.colors.muted }]}>
                      {formatDate(s.updated_at)}
                    </Text>
                  </View>
                  <MaterialIcons name="chevron-right" size={18} color={theme.colors.inactive} />
                </TouchableOpacity>
              ))
            )}
          </View>
        )}
        {loadingSessionId ? (
          <View style={[styles.sessionLoadingBanner, { backgroundColor: theme.colors.primarySoft, borderColor: theme.colors.border }]}>
            <ActivityIndicator size="small" color={theme.colors.primary} />
            <Text style={[styles.sessionLoadingText, { color: theme.colors.primary }]}>Loading saved session…</Text>
          </View>
        ) : null}

        {/* ── Messages ── */}
        <FlatList
          ref={flatListRef}
          style={styles.messages}
          contentContainerStyle={styles.messagesContent}
          data={messages}
          keyExtractor={(m) => m.id}
          renderItem={({ item }) => <Bubble message={item} theme={theme} userLabel={profileName} />}
          showsVerticalScrollIndicator={false}
          ListFooterComponent={
            showSuggestions ? (
              <View style={styles.suggestionsWrap}>
                <View style={styles.welcomeBranding}>
                  <View style={[styles.welcomeIconWrap, { backgroundColor: theme.colors.primarySoft, shadowColor: theme.colors.shadow }]}>
                    <MaterialIcons name="auto-awesome" size={32} color={theme.colors.primary} />
                  </View>
                  <Text style={[styles.welcomeTitle, { color: theme.colors.primary }]}>What can I help you with?</Text>
                  <Text style={[styles.welcomeSub, { color: theme.colors.muted }]}>
                    I can explain concepts, solve problems, quiz you, and more.
                  </Text>
                </View>
                <Text style={[styles.suggestionsLabel, { color: theme.colors.muted }]}>Try a prompt</Text>
                <View style={styles.suggestionsGrid}>
                  {suggestions.map((s) => (
                    <TouchableOpacity
                      key={s.label}
                      style={[styles.suggestionCard, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}
                      activeOpacity={0.82}
                      onPress={() => void sendMessage(s.prompt)}
                    >
                      <View style={[styles.suggestionIcon, { backgroundColor: theme.colors.primarySoft }]}>
                        <MaterialIcons name={s.icon as keyof typeof MaterialIcons.glyphMap} size={17} color={theme.colors.primary} />
                      </View>
                      <Text style={[styles.suggestionText, { color: theme.colors.text }]} numberOfLines={2}>
                        {s.label}
                      </Text>
                      <MaterialIcons name="arrow-forward" size={13} color={theme.colors.inactive} style={styles.suggestionArrow} />
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            ) : null
          }
        />

        {/* ── Error banner ── */}
        {error && (
          <View style={[styles.errorBanner, { backgroundColor: theme.colors.surfaceMuted, borderColor: theme.colors.border }]}>
            <MaterialIcons name="error-outline" size={14} color={theme.colors.muted} />
            <Text style={[styles.errorText, { color: theme.colors.text }]} numberOfLines={2}>{error}</Text>
            <TouchableOpacity onPress={() => setError(null)}>
              <MaterialIcons name="close" size={14} color={theme.colors.muted} />
            </TouchableOpacity>
          </View>
        )}

        {/* ── Input bar ── */}
        <View style={[styles.inputBarWrap, { backgroundColor: theme.colors.screen, borderTopColor: theme.colors.border }]}>
          <View style={[styles.inputRow, { backgroundColor: theme.colors.surface, borderColor: inputText.trim() ? theme.colors.primary : theme.colors.border }]}>
            <TouchableOpacity
              style={[styles.voiceBtn, isListening && { backgroundColor: theme.colors.primarySoft, borderRadius: 20 }]}
              activeOpacity={0.75}
              onPress={() => void handleVoiceInput()}
            >
              <MaterialIcons
                name={isListening ? 'mic-off' : 'mic'}
                size={17}
                color={!speechAvailable ? theme.colors.inactive : isListening ? theme.colors.primary : theme.colors.muted}
              />
            </TouchableOpacity>
            <TextInput
              style={[styles.input, { color: theme.colors.text }]}
              placeholder="Ask your AI Tutor…"
              placeholderTextColor={theme.colors.muted}
              value={inputText}
              onChangeText={setInputText}
              multiline
              maxLength={1000}
              editable={!sending}
              returnKeyType="default"
            />
            {sending ? (
              <View style={[styles.sendBtn, { backgroundColor: theme.colors.primarySoft }]}>
                <ActivityIndicator size="small" color={theme.colors.primary} />
              </View>
            ) : (
              <TouchableOpacity
                style={[
                  styles.sendBtn,
                  { backgroundColor: inputText.trim() ? theme.colors.primary : theme.colors.primarySoft },
                ]}
                activeOpacity={0.85}
                onPress={() => void sendMessage()}
                disabled={!inputText.trim()}
              >
                <MaterialIcons
                  name="arrow-upward"
                  size={18}
                  color={inputText.trim() ? theme.colors.surface : theme.colors.inactive}
                />
              </TouchableOpacity>
            )}
          </View>
          <Text style={[styles.disclaimer, { color: theme.colors.muted }]}>
            AI responses may be inaccurate — verify with textbooks.
          </Text>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  safe: { flex: 1 },
  flex: { flex: 1 },

  // ── Header ────────────────────────────────────────────────────────────────
  header: {
    paddingBottom: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    shadowOpacity: 0.08,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 },
    elevation: 4,
  },
  headerInner: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 8,
    gap: 12,
  },
  botBadgeRing: {
    width: 42,
    height: 42,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    shadowOpacity: 0.2,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 4,
  },
  botBadgePulseRing: {
    position: 'absolute',
    width: 42,
    height: 42,
    borderRadius: 14,
    borderWidth: 2,
  },
  headerText: { flex: 1, minWidth: 0 },
  headerTitle: { fontSize: 16, fontWeight: '800', letterSpacing: -0.3 },
  headerStatusRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 3 },
  headerPulse: { width: 6, height: 6, borderRadius: 3 },
  headerStatusText: { fontSize: 11, fontWeight: '700' },
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  headerIconBtn: {
    width: 34,
    height: 34,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerNewBtn: {},

  // Subject pill inside header
  headerSubjectRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    gap: 8,
    paddingBottom: 2,
  },
  subjectPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    borderWidth: 1,
    maxWidth: 220,
  },
  subjectPillText: { fontSize: 11, fontWeight: '700' },
  sessionChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
    borderWidth: 1,
  },
  sessionChipDot: { width: 5, height: 5, borderRadius: 2.5 },
  sessionChipText: { fontSize: 10, fontWeight: '800' },

  // ── Dropdown ──────────────────────────────────────────────────────────────
  dropdownPanel: {
    paddingVertical: 4,
    borderBottomWidth: 1,
    maxHeight: 240,
  },
  dropdownItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 16,
    paddingVertical: 11,
  },
  dropdownItemText: { fontSize: 13, fontWeight: '600' },

  // ── History panel ─────────────────────────────────────────────────────────
  historyPanel: {
    borderBottomWidth: 1,
    paddingVertical: 4,
    maxHeight: 320,
  },
  historyPanelHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  historyPanelTitle: {
    fontSize: 11,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 0.7,
  },
  historyLoading: { paddingVertical: 16, alignItems: 'center' },
  historyEmpty: { alignItems: 'center', paddingVertical: 24, gap: 6 },
  historyEmptyText: { fontSize: 12, fontWeight: '600' },
  historyItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 16,
    paddingVertical: 11,
    borderTopWidth: 1,
  },
  historyItemIcon: {
    width: 30,
    height: 30,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  historyItemPreview: { fontSize: 13, fontWeight: '700' },
  historyItemDate: { fontSize: 10, marginTop: 1, fontWeight: '600' },
  sessionLoadingBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginHorizontal: 14,
    marginTop: 8,
    marginBottom: 2,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  sessionLoadingText: { fontSize: 12, fontWeight: '700' },
  historySearchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginHorizontal: 14,
    marginBottom: 6,
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 9,
    minHeight: 36,
  },
  historySearchInput: {
    flex: 1,
    fontSize: 12,
    paddingVertical: 6,
  },

  // ── Messages list ─────────────────────────────────────────────────────────
  messages: { flex: 1 },
  messagesContent: { paddingHorizontal: 14, paddingTop: 18, paddingBottom: 16, gap: 16 },

  // ── Bubbles ───────────────────────────────────────────────────────────────
  row: { flexDirection: 'row', alignItems: 'flex-end', gap: 8 },
  rowEnd: { justifyContent: 'flex-end' },
  rowStart: { justifyContent: 'flex-start' },

  botAvatarWrap: { flexShrink: 0, marginBottom: 2 },
  botAvatarRing: {
    width: 30,
    height: 30,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
  },
  userAvatar: {
    width: 30,
    height: 30,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    marginBottom: 2,
  },
  userAvatarText: { fontSize: 12, fontWeight: '800' },

  bubbleWrap: { maxWidth: '80%' },
  bubbleWrapBot: { alignItems: 'flex-start' },
  bubbleWrapUser: { alignItems: 'flex-end' },

  citationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingLeft: 8,
    marginBottom: 5,
    borderLeftWidth: 2,
  },
  citationText: { fontSize: 9, fontWeight: '600', maxWidth: 200 },

  bubble: {
    paddingHorizontal: 14,
    paddingVertical: 11,
    borderRadius: 20,
  },
  bubbleUser: {
    borderBottomRightRadius: 5,
    shadowOpacity: 0.15,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 4,
  },
  bubbleBot: {
    borderWidth: 1,
    borderBottomLeftRadius: 5,
    shadowOpacity: 0.05,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  bubbleText: { fontSize: 14, lineHeight: 22 },
  bubbleList: { marginTop: 4, marginBottom: 4 },
  senderLabel: {
    fontSize: 10,
    fontWeight: '800',
    marginBottom: 5,
    letterSpacing: 0.5,
  },

  thinkingDotsRow: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingVertical: 4 },
  thinkingDot: { width: 7, height: 7, borderRadius: 3.5 },

  timestamp: { fontSize: 10, fontWeight: '500', marginTop: 5, paddingHorizontal: 2 },
  timestampUser: { textAlign: 'right' },
  timestampBot: { textAlign: 'left' },

  // ── Welcome branding + Suggestions ────────────────────────────────────────
  suggestionsWrap: { paddingTop: 8, gap: 16 },
  welcomeBranding: { alignItems: 'center', paddingVertical: 20, gap: 10 },
  welcomeIconWrap: {
    width: 72,
    height: 72,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
    shadowOpacity: 0.12,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  welcomeTitle: { fontSize: 18, fontWeight: '800', textAlign: 'center', letterSpacing: -0.3 },
  welcomeSub: { fontSize: 13, textAlign: 'center', lineHeight: 19, paddingHorizontal: 16, fontWeight: '500' },
  suggestionsLabel: {
    fontSize: 10,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 1,
    paddingHorizontal: 2,
  },
  suggestionsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  suggestionCard: {
    width: '48%',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 12,
    paddingVertical: 14,
    borderRadius: 16,
    borderWidth: 1,
    shadowOpacity: 0.04,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
  },
  suggestionIcon: {
    width: 32,
    height: 32,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  suggestionText: { flex: 1, fontSize: 12, fontWeight: '700', lineHeight: 17 },
  suggestionArrow: { flexShrink: 0 },

  // ── Error ─────────────────────────────────────────────────────────────────
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginHorizontal: 14,
    marginBottom: 6,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 9,
  },
  errorText: { flex: 1, fontSize: 11, fontWeight: '600', lineHeight: 16 },

  // ── Input bar ────────────────────────────────────────────────────────────
  inputBarWrap: {
    paddingHorizontal: 12,
    paddingTop: 10,
    paddingBottom: Platform.OS === 'ios' ? 16 : 12,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingRight: 6,
    paddingLeft: 6,
    paddingVertical: 6,
    borderRadius: 26,
    borderWidth: 1.5,
    gap: 6,
    shadowOpacity: 0.05,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: -2 },
    elevation: 3,
  },
  input: {
    flex: 1,
    fontSize: 15,
    paddingVertical: 9,
    paddingHorizontal: 6,
    maxHeight: 120,
    minHeight: 28,
    lineHeight: 21,
  },
  sendBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    shadowOpacity: 0.2,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3,
  },
  voiceBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  disclaimer: {
    fontSize: 10,
    textAlign: 'center',
    paddingHorizontal: 16,
    paddingTop: 6,
    fontWeight: '500',
  },
});
