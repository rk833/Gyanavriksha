import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import * as SecureStore from 'expo-secure-store';
import * as ImageManipulator from 'expo-image-manipulator';
import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { useAppTheme } from '../../context/ThemeContext';
import { API_BASE_URL } from '../../config/api';

// ─── Types ────────────────────────────────────────────────────────────────────

type FileEntry = {
  id: string;
  uri: string;
  name: string;
  type: string; // MIME
  isPdf: boolean;
};

type UploadNavigation = {
  navigate: (screenName: string, params?: Record<string, unknown>) => void;
  goBack?: () => void;
};
type UploadRoute = { params?: { imageUri?: string; assignmentId?: string } };
type Props = { navigation: UploadNavigation; route?: UploadRoute };

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

async function optimiseImageUri(uri: string): Promise<string> {
  const getSize = (u: string) =>
    new Promise<{ width: number; height: number }>((res, rej) =>
      Image.getSize(u, (w, h) => res({ width: w, height: h }), rej)
    );
  const { width, height } = await getSize(uri);
  const maxEdge = Math.max(width, height);
  const scale = maxEdge > 1400 ? 1400 / maxEdge : 1;
  const actions = scale < 1
    ? [{ resize: { width: Math.round(width * scale), height: Math.round(height * scale) } }]
    : [];
  const result = await ImageManipulator.manipulateAsync(uri, actions, {
    compress: 0.75,
    format: ImageManipulator.SaveFormat.JPEG,
  });
  return result.uri;
}

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function UploadScreen({ navigation, route }: Props) {
  const { theme } = useAppTheme();
  const c = theme.colors;

  const assignmentId = route?.params?.assignmentId ?? '';
  const initialImageUri = route?.params?.imageUri ?? '';

  const xhrRef = useRef<XMLHttpRequest | null>(null);

  const [files, setFiles] = useState<FileEntry[]>([]);
  const [activeIdx, setActiveIdx] = useState(0);
  const [preparing, setPreparing] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [errorText, setErrorText] = useState<string | null>(null);

  const activeFile = files[activeIdx] ?? null;

  // ── Initialise with the photo from the camera ──
  useEffect(() => {
    if (!initialImageUri) return;
    let active = true;
    setPreparing(true);
    optimiseImageUri(initialImageUri)
      .then((uri) => {
        if (!active) return;
        setFiles([{ id: makeId(), uri, name: `photo-${Date.now()}.jpg`, type: 'image/jpeg', isPdf: false }]);
        setActiveIdx(0);
      })
      .catch(() => {
        if (active) setErrorText('Could not prepare the captured photo.');
      })
      .finally(() => { if (active) setPreparing(false); });
    return () => { active = false; };
  }, [initialImageUri]);

  // ── Pick from gallery ──
  const pickGallery = useCallback(async () => {
    if (isUploading) return;
    try {
      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm.granted) { setErrorText('Gallery permission required.'); return; }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsMultipleSelection: true,
        quality: 0.9,
      });
      if (result.canceled || !result.assets?.length) return;
      setPreparing(true);
      const newEntries: FileEntry[] = [];
      for (const asset of result.assets) {
        try {
          const uri = await optimiseImageUri(asset.uri);
          newEntries.push({ id: makeId(), uri, name: `photo-${Date.now()}.jpg`, type: 'image/jpeg', isPdf: false });
        } catch { /* skip bad asset */ }
      }
      if (newEntries.length) {
        setFiles((prev) => {
          const updated = [...prev, ...newEntries];
          setActiveIdx(updated.length - 1);
          return updated;
        });
      }
    } catch {
      setErrorText('Could not open gallery.');
    } finally {
      setPreparing(false);
    }
  }, [isUploading]);

  // ── Pick PDF / file ──
  const pickDocument = useCallback(async () => {
    if (isUploading) return;
    setErrorText(null);
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ['image/jpeg', 'image/jpg', 'image/png', 'application/pdf'],
        copyToCacheDirectory: true,
        multiple: true,
      });
      if (result.canceled || !result.assets?.length) return;
      const newEntries: FileEntry[] = result.assets.map((f) => {
        const lowerName = (f.name || '').toLowerCase();
        const isPdf = lowerName.endsWith('.pdf') || f.mimeType === 'application/pdf';
        return {
          id: makeId(),
          uri: f.uri,
          name: f.name || `file-${Date.now()}${isPdf ? '.pdf' : '.jpg'}`,
          type: isPdf ? 'application/pdf' : (f.mimeType || 'image/jpeg'),
          isPdf,
        };
      });
      setFiles((prev) => {
        const updated = [...prev, ...newEntries];
        setActiveIdx(updated.length - 1);
        return updated;
      });
    } catch {
      setErrorText('Could not open file picker.');
    }
  }, [isUploading]);

  // ── Remove a file ──
  const removeFile = useCallback((id: string) => {
    setFiles((prev) => {
      const updated = prev.filter((f) => f.id !== id);
      setActiveIdx((idx) => Math.min(idx, Math.max(0, updated.length - 1)));
      return updated;
    });
  }, []);

  // ── Upload all files ──
  const canUpload = useMemo(
    () => !preparing && files.length > 0 && !!assignmentId && !isUploading,
    [preparing, files.length, assignmentId, isUploading]
  );

  const uploadAll = useCallback(async () => {
    if (!canUpload) return;
    try {
      const token = (await SecureStore.getItemAsync('access_token'))
        ?? (await SecureStore.getItemAsync('auth_token'));
      if (!token) { setErrorText('Authentication error. Please log in again.'); return; }

      setIsUploading(true);
      setErrorText(null);
      setUploadProgress(0);

      const formData = new FormData();
      for (const f of files) {
        formData.append('files', { uri: f.uri, name: f.name, type: f.type } as unknown as Blob);
      }

      const url = `${API_BASE_URL}/api/students/submissions?assignment_id=${encodeURIComponent(assignmentId)}`;

      await new Promise<void>((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhrRef.current = xhr;
        xhr.open('POST', url);
        xhr.setRequestHeader('Authorization', `Bearer ${token}`);
        xhr.upload.onprogress = (e) => {
          if (e.lengthComputable) setUploadProgress(Math.min(99, Math.round((e.loaded / e.total) * 100)));
        };
        xhr.onload = () => {
          if (xhr.status !== 201) {
            try { reject(new Error((JSON.parse(xhr.responseText) as { detail?: string }).detail || 'Upload failed')); }
            catch { reject(new Error('Upload failed')); }
            return;
          }
          try {
            const payload = JSON.parse(xhr.responseText) as { submission_id?: string };
            if (!payload?.submission_id) { reject(new Error('Upload failed')); return; }
            setUploadProgress(100);
            navigation.navigate('SubmissionProgressScreen', { submissionId: payload.submission_id });
            resolve();
          } catch { reject(new Error('Upload failed')); }
        };
        xhr.onerror  = () => reject(new Error('Upload failed'));
        xhr.onabort  = () => reject(new Error('Upload cancelled'));
        xhr.send(formData);
      });
    } catch (err) {
      setErrorText(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setIsUploading(false);
    }
  }, [canUpload, files, assignmentId, navigation]);

  const progressSegments = 5;

  return (
    <SafeAreaView style={[s.container, { backgroundColor: c.screen }]} edges={['top', 'left', 'right', 'bottom']}>
      {/* ── Header ── */}
      <View style={[s.header, { backgroundColor: c.primary }]}>
        <View style={s.headerGlow} />
        <TouchableOpacity
          style={s.backBtn}
          onPress={() => (navigation.goBack ? navigation.goBack() : navigation.navigate('CameraScreen'))}
          disabled={isUploading}
          activeOpacity={0.8}
        >
          <MaterialIcons name={Platform.OS === 'ios' ? 'arrow-back-ios' : 'arrow-back'} size={20} color="#FFFFFF" />
        </TouchableOpacity>
        <View style={{ flex: 1, gap: 2 }}>
          <Text style={s.headerTitle}>Review & Submit</Text>
          <Text style={s.headerSub}>
            {files.length === 0 ? 'Add your work' : `${files.length} file${files.length > 1 ? 's' : ''} ready`}
          </Text>
        </View>
        {/* Add photo from gallery */}
        <TouchableOpacity
          style={s.headerAddBtn}
          onPress={() => void pickGallery()}
          disabled={isUploading || preparing}
          activeOpacity={0.8}
        >
          <MaterialIcons name="add-photo-alternate" size={20} color="#FFFFFF" />
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={[s.content]} showsVerticalScrollIndicator={false}>

        {/* ── Main preview ── */}
        <View style={[s.previewCard, { backgroundColor: c.surface, borderColor: c.border }]}>
          {preparing ? (
            <View style={s.previewCentre}>
              <ActivityIndicator size="large" color={c.primary} />
              <Text style={[s.previewMsg, { color: c.muted }]}>Optimising…</Text>
            </View>
          ) : activeFile && !activeFile.isPdf ? (
            <Image source={{ uri: activeFile.uri }} style={s.previewImage} resizeMode="contain" />
          ) : activeFile?.isPdf ? (
            <View style={s.previewCentre}>
              <View style={s.pdfIconWrap}>
                <MaterialIcons name="picture-as-pdf" size={42} color="#B91C1C" />
              </View>
              <Text style={[s.pdfName, { color: c.primary }]} numberOfLines={2}>{activeFile.name}</Text>
              <Text style={[s.pdfLabel, { color: c.muted }]}>PDF · ready to upload</Text>
            </View>
          ) : (
            <View style={s.previewCentre}>
              <MaterialIcons name="add-photo-alternate" size={48} color={c.inactive} />
              <Text style={[s.previewMsg, { color: c.muted }]}>Add photos or a PDF of your work</Text>
            </View>
          )}
        </View>

        {/* ── File strip ── */}
        {files.length > 0 && (
          <View>
            <Text style={[s.stripLabel, { color: c.muted }]}>
              {files.length} file{files.length > 1 ? 's' : ''} · tap to preview · ✕ to remove
            </Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.stripRow}>
              {files.map((f, idx) => (
                <TouchableOpacity
                  key={f.id}
                  style={[
                    s.thumb,
                    { borderColor: idx === activeIdx ? c.primary : c.border, backgroundColor: c.surface },
                    idx === activeIdx && { borderWidth: 2.5 },
                  ]}
                  activeOpacity={0.8}
                  onPress={() => setActiveIdx(idx)}
                >
                  {f.isPdf ? (
                    <View style={s.thumbPdf}>
                      <MaterialIcons name="picture-as-pdf" size={22} color="#B91C1C" />
                    </View>
                  ) : (
                    <Image source={{ uri: f.uri }} style={s.thumbImg} resizeMode="cover" />
                  )}
                  {/* Remove button */}
                  {!isUploading && (
                    <TouchableOpacity
                      style={s.thumbRemove}
                      onPress={() => removeFile(f.id)}
                      hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                    >
                      <MaterialIcons name="close" size={11} color="#FFFFFF" />
                    </TouchableOpacity>
                  )}
                  {/* Active indicator */}
                  {idx === activeIdx && (
                    <View style={[s.thumbActiveDot, { backgroundColor: c.primary }]} />
                  )}
                </TouchableOpacity>
              ))}

              {/* Add more tile */}
              {!isUploading && (
                <TouchableOpacity
                  style={[s.thumbAdd, { borderColor: c.border, backgroundColor: c.surfaceMuted ?? c.screen }]}
                  onPress={() => void pickGallery()}
                  activeOpacity={0.8}
                >
                  <MaterialIcons name="add" size={24} color={c.primary} />
                  <Text style={[s.thumbAddText, { color: c.primary }]}>Add</Text>
                </TouchableOpacity>
              )}
            </ScrollView>
          </View>
        )}

        {/* ── Upload progress ── */}
        {(isUploading || uploadProgress > 0) && (
          <View style={[s.progressCard, { backgroundColor: c.surface, borderColor: c.border }]}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              <Text style={[s.progressLabel, { color: c.primary }]}>Uploading</Text>
              <Text style={[s.progressLabel, { color: c.primary, fontWeight: '900' }]}>{uploadProgress}%</Text>
            </View>
            <View style={{ flexDirection: 'row', gap: 4 }}>
              {Array.from({ length: progressSegments }).map((_, i) => {
                const threshold = ((i + 1) / progressSegments) * 100;
                const filled = uploadProgress >= threshold;
                const partial = !filled && uploadProgress > (i / progressSegments) * 100;
                return (
                  <View
                    key={i}
                    style={[
                      s.segment,
                      { backgroundColor: filled ? c.primary : c.border },
                      partial && { backgroundColor: c.primary, opacity: 0.4 },
                    ]}
                  />
                );
              })}
            </View>
          </View>
        )}

        {/* ── Error ── */}
        {errorText && (
          <View style={s.errorBanner}>
            <MaterialIcons name="error-outline" size={16} color="#DC2626" />
            <Text style={s.errorText}>{errorText}</Text>
          </View>
        )}

        {/* ── Actions ── */}
        <View style={s.actions}>
          {/* Primary: Submit */}
          <TouchableOpacity
            style={[s.primaryBtn, { backgroundColor: c.primary, opacity: canUpload ? 1 : 0.5 }]}
            activeOpacity={0.85}
            onPress={() => void uploadAll()}
            disabled={!canUpload}
          >
            {isUploading
              ? <ActivityIndicator color="#FFFFFF" size="small" />
              : <>
                  <MaterialIcons name="cloud-upload" size={20} color="#FFFFFF" />
                  <Text style={s.primaryBtnText}>
                    {files.length > 1 ? `Submit ${files.length} files` : 'Submit assignment'}
                  </Text>
                </>
            }
          </TouchableOpacity>

          {/* Secondary row: gallery + doc picker */}
          <View style={s.secondaryRow}>
            <TouchableOpacity
              style={[s.secondaryBtn, { backgroundColor: c.surface, borderColor: c.border, flex: 1 }]}
              activeOpacity={0.85}
              onPress={() => void pickGallery()}
              disabled={isUploading}
            >
              <MaterialIcons name="photo-library" size={17} color={c.primary} />
              <Text style={[s.secondaryBtnText, { color: c.primary }]}>Gallery</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[s.secondaryBtn, { backgroundColor: c.surface, borderColor: c.border, flex: 1 }]}
              activeOpacity={0.85}
              onPress={() => void pickDocument()}
              disabled={isUploading}
            >
              <MaterialIcons name="folder-open" size={17} color={c.primary} />
              <Text style={[s.secondaryBtnText, { color: c.primary }]}>PDF / Files</Text>
            </TouchableOpacity>
          </View>

          {/* Cancel */}
          <TouchableOpacity
            style={[s.cancelBtn, { borderColor: c.border }]}
            activeOpacity={0.85}
            onPress={() => navigation.navigate('CameraScreen')}
            disabled={isUploading}
          >
            <MaterialIcons name="close" size={16} color={c.muted} />
            <Text style={[s.cancelBtnText, { color: c.muted }]}>Cancel</Text>
          </TouchableOpacity>
        </View>

      </ScrollView>
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  container: { flex: 1 },

  header: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 16, paddingVertical: 14, gap: 12, overflow: 'hidden',
  },
  headerGlow: {
    position: 'absolute', top: -30, right: -20, width: 100, height: 100,
    borderRadius: 50, backgroundColor: 'rgba(255,255,255,0.07)',
  },
  backBtn: {
    width: 38, height: 38, borderRadius: 11,
    backgroundColor: 'rgba(255,255,255,0.18)', alignItems: 'center', justifyContent: 'center',
  },
  headerTitle: { color: '#FFFFFF', fontSize: 17, fontWeight: '800', letterSpacing: -0.2 },
  headerSub:   { color: 'rgba(255,255,255,0.7)', fontSize: 11, fontWeight: '500' },
  headerAddBtn: {
    width: 38, height: 38, borderRadius: 11,
    backgroundColor: 'rgba(255,255,255,0.18)', alignItems: 'center', justifyContent: 'center',
  },

  content: { padding: 16, gap: 14, paddingBottom: 32 },

  // Preview
  previewCard: {
    borderRadius: 18, borderWidth: 1, overflow: 'hidden', minHeight: 220,
    shadowOpacity: 0.07, shadowRadius: 10, shadowOffset: { width: 0, height: 3 }, elevation: 3,
  },
  previewImage: { width: '100%', height: 260 },
  previewCentre: { height: 220, alignItems: 'center', justifyContent: 'center', gap: 12, padding: 20 },
  previewMsg: { fontSize: 13, fontWeight: '600', textAlign: 'center' },
  pdfIconWrap: {
    width: 72, height: 72, borderRadius: 20,
    backgroundColor: '#FEF2F2', alignItems: 'center', justifyContent: 'center',
  },
  pdfName:  { fontSize: 14, fontWeight: '700', textAlign: 'center' },
  pdfLabel: { fontSize: 12, fontWeight: '500' },

  // File strip
  stripLabel: { fontSize: 10, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 8 },
  stripRow: { gap: 8, paddingRight: 4 },
  thumb: {
    width: 68, height: 68, borderRadius: 12, overflow: 'hidden',
    borderWidth: 1.5, position: 'relative',
  },
  thumbImg:  { width: '100%', height: '100%' },
  thumbPdf:  { width: '100%', height: '100%', alignItems: 'center', justifyContent: 'center', backgroundColor: '#FFF1F2' },
  thumbRemove: {
    position: 'absolute', top: 3, right: 3, width: 16, height: 16, borderRadius: 8,
    backgroundColor: 'rgba(0,0,0,0.55)', alignItems: 'center', justifyContent: 'center',
  },
  thumbActiveDot: {
    position: 'absolute', bottom: 3, left: '50%', width: 6, height: 6, borderRadius: 3, marginLeft: -3,
  },
  thumbAdd: {
    width: 68, height: 68, borderRadius: 12, borderWidth: 1.5, borderStyle: 'dashed',
    alignItems: 'center', justifyContent: 'center', gap: 2,
  },
  thumbAddText: { fontSize: 9, fontWeight: '800' },

  // Progress
  progressCard: { borderRadius: 14, borderWidth: 1, padding: 14, gap: 10 },
  progressLabel: { fontSize: 13, fontWeight: '700' },
  segment: { flex: 1, height: 6, borderRadius: 3 },

  // Error
  errorBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: '#FEF2F2', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10,
  },
  errorText: { flex: 1, color: '#B91C1C', fontSize: 13, fontWeight: '600', lineHeight: 18 },

  // Actions
  actions: { gap: 10, marginTop: 4 },
  primaryBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    borderRadius: 14, paddingVertical: 15,
    shadowOpacity: 0.14, shadowRadius: 8, shadowOffset: { width: 0, height: 3 }, elevation: 3,
  },
  primaryBtnText: { color: '#FFFFFF', fontSize: 16, fontWeight: '800', letterSpacing: 0.1 },
  secondaryRow: { flexDirection: 'row', gap: 10 },
  secondaryBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 7, borderRadius: 14, paddingVertical: 13, borderWidth: 1,
  },
  secondaryBtnText: { fontSize: 14, fontWeight: '700' },
  cancelBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 6, borderRadius: 14, paddingVertical: 11, borderWidth: 1,
  },
  cancelBtnText: { fontSize: 13, fontWeight: '600' },
});
