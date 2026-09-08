import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
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
import { MaterialIcons } from '@expo/vector-icons';
import axios from 'axios';
import { File, Paths } from 'expo-file-system';
import * as SecureStore from 'expo-secure-store';
import * as Sharing from 'expo-sharing';
import WebView from 'react-native-webview';

import { useApi } from '../../hooks/useApi';
import { useAppTheme } from '../../context/ThemeContext';
import { API_BASE_URL } from '../../config/api';
import ScreenHeader from '../../components/ScreenHeader';

// ─── Types ─────────────────────────────────────────────────────────────────────

type DocType = 'pdf' | 'image' | 'docx' | 'txt' | string;

type LibraryDoc = {
  doc_id: string;
  file_name: string;
  file_path?: string;
  file_size_bytes?: number | null;
  doc_type: DocType;
  embedding_status?: string;
  subject_id?: number;
  subject_name?: string | null;
  grade_name?: string | null;
  uploaded_by_name?: string | null;
  created_at?: string;
};

type PaginatedResponse = {
  items: LibraryDoc[];
  total: number;
  page: number;
  per_page: number;
  total_pages: number;
};

// ─── Helpers ───────────────────────────────────────────────────────────────────

function parseApiError(error: unknown, fallback: string) {
  if (axios.isAxiosError(error)) {
    const d = error.response?.data?.detail;
    if (typeof d === 'string' && d.trim()) return d;
  }
  if (error instanceof Error && error.message.trim()) return error.message;
  return fallback;
}

function formatSize(bytes?: number | null) {
  if (bytes == null) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function docTypeIcon(type: DocType): keyof typeof MaterialIcons.glyphMap {
  const t = (type ?? '').toLowerCase();
  if (t === 'pdf') return 'picture-as-pdf';
  if (t === 'image' || t === 'jpg' || t === 'png') return 'image';
  if (t === 'docx' || t === 'doc') return 'description';
  return 'insert-drive-file';
}

function docTypeColor(type: DocType) {
  const t = (type ?? '').toLowerCase();
  if (t === 'pdf') return '#B91C1C';
  if (t === 'image' || t === 'jpg' || t === 'png') return '#2563EB';
  if (t === 'docx' || t === 'doc') return '#1D4ED8';
  return '#64748B';
}

function extensionFromFileName(fileName: string) {
  const match = /\.([a-z0-9]+)$/i.exec(fileName.trim());
  return match ? match[1].toLowerCase() : '';
}

/** Cache file extension for download + viewer */
function resolvePreviewExtension(doc: LibraryDoc): string {
  const fromName = extensionFromFileName(doc.file_name);
  if (fromName) return fromName === 'jpeg' ? 'jpg' : fromName;

  const t = (doc.doc_type ?? '').toLowerCase();
  if (t === 'pdf') return 'pdf';
  if (t === 'image' || t === 'jpg' || t === 'jpeg') return 'jpg';
  if (t === 'png') return 'png';
  if (t === 'txt') return 'txt';

  return 'bin';
}

function previewKindFromExtension(ext: string): 'pdf' | 'image' | 'text' | null {
  if (ext === 'pdf') return 'pdf';
  if (['png', 'jpg', 'jpeg', 'webp', 'gif'].includes(ext)) return 'image';
  if (ext === 'txt') return 'text';
  return null;
}

/** Pdf.js CDN (embedded in WebView HTML). Native Android WebView does not render PDF from file URIs — this renders client-side instead. */
const PDFJS_VER = '3.11.174';

function buildPdfViewerHtml(base64Data: string): string {
  const clean = base64Data.replace(/\s+/g, '');
  const pdfJsUrl = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${PDFJS_VER}/pdf.min.js`;
  const pdfWorkerUrl = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${PDFJS_VER}/pdf.worker.min.js`;
  const b64Json = JSON.stringify(clean);

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=5,user-scalable=yes"/>
<style>
  html,body{margin:0;padding:0;background:#3d3d3d;color:#f1f5f9;font-family:sans-serif}
  #pageWrap{display:flex;flex-direction:column;align-items:center;padding:14px;padding-bottom:40px}
  canvas{background:#fff;box-shadow:0 2px 12px rgba(0,0,0,.35);max-width:100%;height:auto}
  canvas + canvas{margin-top:12px}
  #err{padding:26px;color:#fca5a5;text-align:center;max-width:96vw;display:none;line-height:1.5;font-size:15px}
</style>
</head>
<body>
<p id="err"></p>
<div id="pageWrap"></div>
<script>
(async function(){
  var PDFJS_URL=${JSON.stringify(pdfJsUrl)};
  var WORKER_URL=${JSON.stringify(pdfWorkerUrl)};
  var B64=${b64Json};
  var errEl=document.getElementById('err');
  function fail(m){ errEl.style.display='block'; errEl.textContent=m; if(window.ReactNativeWebView){ window.ReactNativeWebView.postMessage('PDF_ERR:'+m); }}
  function log(s){ if(window.ReactNativeWebView){ window.ReactNativeWebView.postMessage('PDF_LOG:'+s); } }
  function makeBlobWorker(){ var src='importScripts('+JSON.stringify(WORKER_URL)+');'; var blob=new Blob([src],{type:'application/javascript'}); var url=URL.createObjectURL(blob); return { worker:new Worker(url), url:url }; }
  async function loadPdfJs(){
    try{
      var res=await fetch(PDFJS_URL,{cache:'force-cache'});
      if(!res.ok) throw new Error('HTTP '+res.status);
      var code=await res.text();
      (0,eval)(code);
    }catch(e1){
      log('fetch-eval failed '+e1.message+', retry script tag');
      await new Promise(function(resolve,rej){
        var sc=document.createElement('script');
        sc.src=PDFJS_URL;
        sc.onload=function(){ resolve(null); };
        sc.onerror=function(){ rej(new Error('Could not download PDF viewer. Check internet and try again.')); };
        document.head.appendChild(sc);
      });
    }
    var lib=window.pdfjsLib;
    if(!lib) throw new Error('PDF viewer failed to initialise (offline or blocked)');
    return lib;
  }
  async function renderAll(pdf,wrapper){
    var vw=(window.visualViewport&&window.visualViewport.width)||window.innerWidth||360;
    for(var pn=1; pn<=pdf.numPages; pn++){
      var page=await pdf.getPage(pn);
      var unit=page.getViewport({scale:1});
      var scale=Math.min(Math.max(vw/unit.width*.98,.6),2.25);
      var viewport=page.getViewport({scale:scale});
      var canvas=document.createElement('canvas'), ctx=canvas.getContext('2d');
      canvas.width=viewport.width;
      canvas.height=viewport.height;
      var task=page.render({canvasContext:ctx,viewport:viewport});
      await (task.promise||task);
      canvas.style.cssText='width:'+Math.round(viewport.width)+'px;max-width:100%;height:auto;display:block';
      wrapper.appendChild(canvas);
    }
  }
  var wp=null;
  try{
    var pdfjsLib=await loadPdfJs();
    try{
      wp=makeBlobWorker();
      pdfjsLib.GlobalWorkerOptions.workerPort=wp.worker;
    }catch(we){ log('blob worker fallback: '+we.message); pdfjsLib.GlobalWorkerOptions.workerPort=null; pdfjsLib.GlobalWorkerOptions.workerSrc=WORKER_URL; }
    var bin=atob(B64.replace(/-/g,'+').replace(/_/g,'/'));
    var bytes=new Uint8Array(bin.length);
    for(var i=0;i<bin.length;i++) bytes[i]=bin.charCodeAt(i);
    var pdf=await pdfjsLib.getDocument({data:bytes,useWorkerFetch:false}).promise;
    await renderAll(pdf,document.getElementById('pageWrap'));
  }catch(e){ fail(e&&e.message?e.message:'Unexpected PDF error'); }
  finally{
    try{ if(wp&&wp.url) URL.revokeObjectURL(wp.url); }catch(_){}
  }
})();
</script>
</body></html>`;
}

// ─── Screen ────────────────────────────────────────────────────────────────────

const PAGE_SIZE = 20;

export default function LibraryScreen() {
  const { get } = useApi();
  const { theme } = useAppTheme();

  const [docs, setDocs] = useState<LibraryDoc[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [filterSubject, setFilterSubject] = useState<string | null>(null);
  const [subjects, setSubjects] = useState<string[]>([]);
  const [downloading, setDownloading] = useState<string | null>(null);
  const [previewing, setPreviewing] = useState<string | null>(null);
  const [viewer, setViewer] = useState<{
    visible: boolean;
    title: string;
    kind: 'pdf' | 'image' | 'text';
    uri: string;
    /** Raw PDF bytes as base64 for WebView + PDF.js (Android cannot show file:// PDF in WebView). */
    pdfBase64?: string;
    textContent?: string;
  } | null>(null);

  const pdfViewerHtml = useMemo(() => {
    if (viewer?.kind !== 'pdf' || !viewer.pdfBase64) return '';
    return buildPdfViewerHtml(viewer.pdfBase64);
  }, [viewer?.kind, viewer?.pdfBase64]);

  const load = useCallback(
    async (pageNum: number, replace: boolean) => {
      setError(null);
      try {
        const res = await get<PaginatedResponse>(
          `/api/students/library?page=${pageNum}&per_page=${PAGE_SIZE}`
        );
        const items = res.items ?? [];
        setTotal(res.total ?? 0);
        setDocs((prev) => (replace ? items : [...prev, ...items]));

        // Extract unique subjects
        if (replace) {
          const subs = Array.from(
            new Set(items.map((d) => d.subject_name).filter(Boolean))
          ) as string[];
          setSubjects(subs);
        }
      } catch (err) {
        setError(parseApiError(err, 'Could not load library documents.'));
      } finally {
        setIsLoading(false);
        setIsRefreshing(false);
        setIsLoadingMore(false);
      }
    },
    [get]
  );

  useEffect(() => {
    void load(1, true);
  }, [load]);

  const onRefresh = useCallback(async () => {
    setIsRefreshing(true);
    setPage(1);
    setFilterSubject(null);
    await load(1, true);
  }, [load]);

  const loadMore = useCallback(() => {
    const totalPages = Math.ceil(total / PAGE_SIZE);
    if (page >= totalPages || isLoadingMore) return;
    const next = page + 1;
    setPage(next);
    setIsLoadingMore(true);
    void load(next, false);
  }, [isLoadingMore, load, page, total]);

  const downloadDoc = useCallback(async (doc: LibraryDoc) => {
    setDownloading(doc.doc_id);
    try {
      const token = await SecureStore.getItemAsync('access_token');
      if (!token) {
        Alert.alert('Session expired', 'Please log in again.');
        return;
      }

      const canShare = await Sharing.isAvailableAsync();
      if (!canShare) {
        Alert.alert('Not supported', 'Sharing/saving files is not available on this device.');
        return;
      }

      const ext = resolvePreviewExtension(doc);
      const safeExt = ext === 'jpeg' ? 'jpg' : ext;
      const url = `${API_BASE_URL}/api/students/library/${doc.doc_id}/download`;
      const outfile = new File(Paths.cache, `dl_${doc.doc_id}.${safeExt}`);

      const downloaded = await File.downloadFileAsync(url, outfile, {
        headers: { Authorization: `Bearer ${token}` },
        idempotent: false,
      });

      await Sharing.shareAsync(downloaded.uri, {
        dialogTitle: `Save ${doc.file_name}`,
        UTI: safeExt === 'pdf' ? 'com.adobe.pdf' : undefined,
      });
    } catch (err) {
      Alert.alert('Download failed', parseApiError(err, 'Could not download this document.'));
    } finally {
      setDownloading(null);
    }
  }, []);

  const viewDoc = useCallback(async (doc: LibraryDoc) => {
    if (Platform.OS === 'web') {
      Alert.alert('Preview', 'Document preview is not available in the web build. Use the Android/iOS app.');
      return;
    }

    const ext = resolvePreviewExtension(doc);
    const kind = previewKindFromExtension(ext === 'jpeg' ? 'jpg' : ext);
    if (!kind) {
      Alert.alert(
        'Preview unavailable',
        'This file type cannot be previewed in-app yet. Use Download to open it elsewhere.'
      );
      return;
    }

    const token = await SecureStore.getItemAsync('access_token');
    if (!token) {
      Alert.alert('Session expired', 'Please log in again to view this document.');
      return;
    }

    setPreviewing(doc.doc_id);
    try {
      const url = `${API_BASE_URL}/api/students/library/${doc.doc_id}/download`;
      const safeExt = ext === 'jpeg' ? 'jpg' : ext;
      const outfile = new File(Paths.cache, `library_${doc.doc_id}.${safeExt}`);
      const downloaded = await File.downloadFileAsync(url, outfile, {
        headers: { Authorization: `Bearer ${token}` },
        idempotent: true,
      });

      let pdfBase64: string | undefined;
      if (kind === 'pdf') {
        pdfBase64 = await downloaded.base64();
      }

      let textContent: string | undefined;
      if (kind === 'text') {
        textContent = await downloaded.text();
      }

      setViewer({
        visible: true,
        title: doc.file_name,
        kind,
        uri: downloaded.uri,
        pdfBase64,
        textContent,
      });
    } catch (err) {
      Alert.alert('Could not open', parseApiError(err, 'Unable to load this document for preview.'));
    } finally {
      setPreviewing(null);
    }
  }, []);

  // Client-side filter by search + subject
  const filtered = docs.filter((d) => {
    const matchSearch =
      !search.trim() ||
      d.file_name.toLowerCase().includes(search.toLowerCase()) ||
      (d.subject_name ?? '').toLowerCase().includes(search.toLowerCase()) ||
      (d.grade_name ?? '').toLowerCase().includes(search.toLowerCase());
    const matchSubject = !filterSubject || d.subject_name === filterSubject;
    return matchSearch && matchSubject;
  });

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: theme.colors.screen }]} edges={['top', 'left', 'right']}>
      <ScreenHeader title="Library" subtitle="Curriculum Documents" showBack />
      {/* Search bar */}
      <View style={[styles.searchBar, { backgroundColor: theme.colors.surface, borderBottomColor: theme.colors.border }]}>
        <View style={[styles.searchInputWrap, { backgroundColor: theme.colors.screen, borderColor: theme.colors.border }]}>
          <MaterialIcons name="search" size={18} color={theme.colors.muted} />
          <TextInput
            style={[styles.searchInput, { color: theme.colors.text }]}
            placeholder="Search documents…"
            placeholderTextColor={theme.colors.muted}
            value={search}
            onChangeText={setSearch}
          />
          {search.length > 0 && (
            <TouchableOpacity onPress={() => setSearch('')}>
              <MaterialIcons name="close" size={16} color={theme.colors.muted} />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Subject chips */}
      {subjects.length > 0 && (
        <View style={[styles.chipsRow, { borderBottomColor: theme.colors.border }]}>
          <TouchableOpacity
            style={[styles.chip, !filterSubject && { backgroundColor: theme.colors.primary }]}
            onPress={() => setFilterSubject(null)}
          >
            <Text style={[styles.chipText, { color: !filterSubject ? '#FFFFFF' : theme.colors.muted }]}>All</Text>
          </TouchableOpacity>
          {subjects.map((s) => (
            <TouchableOpacity
              key={s}
              style={[styles.chip, filterSubject === s && { backgroundColor: theme.colors.primary }]}
              onPress={() => setFilterSubject(filterSubject === s ? null : s)}
            >
              <Text style={[styles.chipText, { color: filterSubject === s ? '#FFFFFF' : theme.colors.muted }]}>
                {s}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      )}

      {isLoading ? (
        <ActivityIndicator color={theme.colors.primary} style={{ marginTop: 40 }} />
      ) : error ? (
        <View style={styles.errorCard}>
          <MaterialIcons name="library-books" size={32} color="#9F1239" />
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity style={[styles.retryBtn, { backgroundColor: theme.colors.primary }]} onPress={() => void load(1, true)}>
            <Text style={styles.retryBtnText}>Retry</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(item) => item.doc_id}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={() => void onRefresh()} tintColor={theme.colors.primary} />}
          onEndReached={loadMore}
          onEndReachedThreshold={0.4}
          ListEmptyComponent={
            <View style={styles.emptyWrap}>
              <MaterialIcons name="library-books" size={40} color={theme.colors.muted} />
              <Text style={[styles.emptyTitle, { color: theme.colors.primary }]}>No documents found</Text>
              <Text style={[styles.emptySubtitle, { color: theme.colors.muted }]}>
                {search || filterSubject ? 'Try a different search or filter.' : 'No library documents available yet.'}
              </Text>
            </View>
          }
          ListFooterComponent={isLoadingMore ? <ActivityIndicator color={theme.colors.primary} style={{ marginVertical: 16 }} /> : null}
          renderItem={({ item }) => {
            const color = docTypeColor(item.doc_type);
            const isDown = downloading === item.doc_id;
            const isPreview = previewing === item.doc_id;
            return (
              <View style={[styles.docCard, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
                <View style={[styles.docIconWrap, { backgroundColor: `${color}18` }]}>
                  <MaterialIcons name={docTypeIcon(item.doc_type)} size={24} color={color} />
                </View>
                <View style={styles.docInfo}>
                  <Text style={[styles.docName, { color: theme.colors.primary }]} numberOfLines={2}>
                    {item.file_name}
                  </Text>
                  <Text style={[styles.docMeta, { color: theme.colors.muted }]}>
                    {[item.subject_name, item.grade_name, formatSize(item.file_size_bytes)]
                      .filter(Boolean)
                      .join(' • ')}
                  </Text>
                  {item.doc_type && (
                    <View style={[styles.docTypeBadge, { backgroundColor: `${color}18` }]}>
                      <Text style={[styles.docTypeText, { color }]}>{item.doc_type.toUpperCase()}</Text>
                    </View>
                  )}
                  <View style={styles.docActionsRow}>
                    <TouchableOpacity
                      style={[styles.actionBtn, { backgroundColor: theme.colors.primary }]}
                      activeOpacity={0.85}
                      onPress={() => void viewDoc(item)}
                      disabled={isPreview}
                    >
                      {isPreview ? (
                        <ActivityIndicator size="small" color="#FFFFFF" />
                      ) : (
                        <>
                          <MaterialIcons name="visibility" size={14} color="#FFFFFF" />
                          <Text style={styles.actionBtnText}>View</Text>
                        </>
                      )}
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.actionBtnSecondary, { backgroundColor: theme.colors.primarySoft }]}
                      activeOpacity={0.85}
                      onPress={() => void downloadDoc(item)}
                      disabled={isDown}
                    >
                      {isDown ? (
                        <ActivityIndicator size="small" color={theme.colors.primary} />
                      ) : (
                        <>
                          <MaterialIcons name="download" size={14} color={theme.colors.primary} />
                          <Text style={[styles.actionBtnSecondaryText, { color: theme.colors.primary }]}>Download</Text>
                        </>
                      )}
                    </TouchableOpacity>
                  </View>
                </View>
              </View>
            );
          }}
        />
      )}

      <Modal
        visible={viewer?.visible === true}
        animationType="slide"
        onRequestClose={() => setViewer(null)}
      >
        <SafeAreaView style={styles.viewerSafe} edges={['top', 'left', 'right', 'bottom']}>
          <View style={styles.viewerHeader}>
            <Text style={styles.viewerTitle} numberOfLines={1}>
              {viewer?.title ?? 'Document'}
            </Text>
            <TouchableOpacity style={styles.viewerCloseBtn} onPress={() => setViewer(null)} activeOpacity={0.85}>
              <MaterialIcons name="close" size={20} color="#123A5F" />
            </TouchableOpacity>
          </View>
          {viewer && viewer.kind === 'pdf' && pdfViewerHtml ? (
            <WebView
              key={viewer.uri}
              style={styles.viewerWeb}
              source={{ html: pdfViewerHtml }}
              originWhitelist={['*']}
              javaScriptEnabled
              domStorageEnabled
              mixedContentMode="always"
              setBuiltInZoomControls
              nestedScrollEnabled
              startInLoadingState
              onMessage={(e) => {
                const msg = e.nativeEvent.data ?? '';
                if (__DEV__ && msg.startsWith('PDF_LOG:')) console.log('[PdfViewer]', msg.slice(8));
                if (msg.startsWith('PDF_ERR:')) console.warn('[PdfViewer]', msg.slice(8));
              }}
              renderLoading={() => (
                <View style={styles.viewerLoading}>
                  <ActivityIndicator color="#123A5F" />
                  <Text style={styles.viewerLoadingText}>Loading PDF…</Text>
                </View>
              )}
            />
          ) : null}
          {viewer && viewer.kind === 'image' ? (
            <ScrollView contentContainerStyle={styles.imageScroll}>
              <Image source={{ uri: viewer.uri }} style={styles.previewImage} resizeMode="contain" />
            </ScrollView>
          ) : null}
          {viewer && viewer.kind === 'text' ? (
            <ScrollView style={styles.textScroll} contentContainerStyle={styles.textScrollInner}>
              <Text style={styles.previewText}>{viewer.textContent ?? ''}</Text>
            </ScrollView>
          ) : null}
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  searchBar: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderBottomWidth: 1,
  },
  searchInputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 8,
    gap: 8,
  },
  searchInput: { flex: 1, fontSize: 14 },
  chipsRow: {
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderBottomWidth: 1,
    flexWrap: 'wrap',
  },
  chip: {
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 5,
    backgroundColor: '#F3F1EB',
  },
  chipText: { fontSize: 12, fontWeight: '700' },
  list: { paddingHorizontal: 14, paddingTop: 10, paddingBottom: 32, gap: 10 },
  emptyWrap: { alignItems: 'center', paddingVertical: 48, gap: 10 },
  emptyTitle: { fontSize: 17, fontWeight: '800' },
  emptySubtitle: { fontSize: 13, textAlign: 'center', lineHeight: 20 },
  errorCard: {
    margin: 16,
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
  docCard: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 14,
    padding: 12,
    gap: 12,
  },
  docIconWrap: {
    width: 48,
    height: 48,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  docInfo: { flex: 1, gap: 3 },
  docName: { fontSize: 14, fontWeight: '700', lineHeight: 19 },
  docMeta: { fontSize: 11 },
  docTypeBadge: { alignSelf: 'flex-start', borderRadius: 4, paddingHorizontal: 6, paddingVertical: 2 },
  docTypeText: { fontSize: 9, fontWeight: '800', letterSpacing: 0.6 },
  docActionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 8,
  },
  actionBtn: {
    height: 32,
    borderRadius: 999,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  actionBtnText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '800',
  },
  actionBtnSecondary: {
    height: 32,
    borderRadius: 999,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  actionBtnSecondaryText: {
    fontSize: 12,
    fontWeight: '800',
  },
  viewerSafe: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  viewerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
    backgroundColor: '#FFFFFF',
  },
  viewerTitle: {
    flex: 1,
    marginRight: 10,
    color: '#123A5F',
    fontSize: 14,
    fontWeight: '800',
  },
  viewerCloseBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#E2E8F0',
  },
  viewerLoading: {
    position: 'absolute',
    top: 0,
    right: 0,
    left: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: '#F8FAFC',
  },
  viewerLoadingText: {
    color: '#475569',
    fontSize: 13,
    fontWeight: '600',
  },
  viewerWeb: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  imageScroll: {
    flexGrow: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 12,
    backgroundColor: '#0F172A',
  },
  previewImage: {
    width: '100%',
    minHeight: 360,
    backgroundColor: '#0F172A',
  },
  textScroll: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  textScrollInner: {
    padding: 16,
    paddingBottom: 32,
  },
  previewText: {
    fontSize: 14,
    lineHeight: 22,
    color: '#1E293B',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
});
