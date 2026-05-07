import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import * as ImageManipulator from 'expo-image-manipulator';
import * as DocumentPicker from 'expo-document-picker';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';

import { API_BASE_URL } from '../../config/api';

type UploadNavigation = {
  navigate: (screenName: string, params?: Record<string, unknown>) => void;
  goBack?: () => void;
};

type UploadRoute = {
  params?: {
    imageUri?: string;
    assignmentId?: string;
  };
};

type UploadScreenProps = {
  navigation: UploadNavigation;
  route?: UploadRoute;
};

export default function UploadScreen({ navigation, route }: UploadScreenProps) {
  const imageUri = route?.params?.imageUri ?? '';
  const assignmentId = route?.params?.assignmentId ?? '';

  const xhrRef = useRef<XMLHttpRequest | null>(null);
  const [processedUri, setProcessedUri] = useState<string>('');
  const [selectedFileName, setSelectedFileName] = useState<string>('');
  const [selectedFileType, setSelectedFileType] = useState<string>('image/jpeg');
  const [isPreparingImage, setIsPreparingImage] = useState(true);
  const [isUploading, setIsUploading] = useState(false);
  const [errorText, setErrorText] = useState<string | null>(null);
  const [uploadProgress, setUploadProgress] = useState(0);

  const canUpload = useMemo(
    () => Boolean(!isPreparingImage && processedUri && assignmentId && !isUploading),
    [assignmentId, isPreparingImage, isUploading, processedUri]
  );

  useEffect(() => {
    let isActive = true;

    const getImageDimensions = (uri: string): Promise<{ width: number; height: number }> =>
      new Promise((resolve, reject) => {
        Image.getSize(
          uri,
          (width, height) => resolve({ width, height }),
          (error) => reject(error)
        );
      });

    const prepareImage = async () => {
      if (!imageUri) {
        setErrorText('Upload failed');
        setIsPreparingImage(false);
        return;
      }

      setIsPreparingImage(true);
      setErrorText(null);

      try {
        const { width, height } = await getImageDimensions(imageUri);
        const maxEdge = Math.max(width, height);
        const scale = maxEdge > 1200 ? 1200 / maxEdge : 1;

        const resizeAction =
          scale < 1
            ? [{ resize: { width: Math.round(width * scale), height: Math.round(height * scale) } }]
            : [];

        const result = await ImageManipulator.manipulateAsync(imageUri, resizeAction, {
          compress: 0.7,
          format: ImageManipulator.SaveFormat.JPEG,
        });

        if (!isActive) {
          return;
        }

        setProcessedUri(result.uri);
        setSelectedFileName(`submission-${Date.now()}.jpg`);
        setSelectedFileType('image/jpeg');
      } catch {
        if (!isActive) {
          return;
        }

        setErrorText('Upload failed');
      } finally {
        if (isActive) {
          setIsPreparingImage(false);
        }
      }
    };

    void prepareImage();

    return () => {
      isActive = false;
      xhrRef.current?.abort();
    };
  }, [imageUri]);

  const uploadSubmission = async () => {
    if (!assignmentId) {
      setErrorText('Upload failed');
      return;
    }

    if (!processedUri) {
      setErrorText('Upload failed');
      return;
    }

    try {
      const accessToken = await SecureStore.getItemAsync('access_token');
      const authToken = accessToken ?? (await SecureStore.getItemAsync('auth_token'));

      if (!authToken) {
        setErrorText('Upload failed');
        return;
      }

      setIsUploading(true);
      setErrorText(null);
      setUploadProgress(0);

      const formData = new FormData();
      formData.append('files', {
        uri: processedUri,
        name: selectedFileName || `submission-${Date.now()}.jpg`,
        type: selectedFileType || 'image/jpeg',
      } as unknown as Blob);

      const uploadUrl = `${API_BASE_URL}/api/students/submissions?assignment_id=${encodeURIComponent(assignmentId)}`;

      await new Promise<void>((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhrRef.current = xhr;

        xhr.open('POST', uploadUrl);
        xhr.setRequestHeader('Authorization', `Bearer ${authToken}`);

        xhr.upload.onprogress = (event) => {
          if (!event.lengthComputable) {
            return;
          }

          const percent = Math.min(100, Math.round((event.loaded / event.total) * 100));
          setUploadProgress(percent);
        };

        xhr.onload = () => {
          if (xhr.status !== 201) {
            try {
              const payload = JSON.parse(xhr.responseText) as { detail?: string };
              reject(new Error(payload.detail || 'Upload failed'));
            } catch {
              reject(new Error('Upload failed'));
            }
            return;
          }

          try {
            const payload = JSON.parse(xhr.responseText) as { submission_id?: string };
            const submissionId = payload?.submission_id;

            if (!submissionId) {
              reject(new Error('Upload failed'));
              return;
            }

            setUploadProgress(100);
            navigation.navigate('SubmissionProgressScreen', { submissionId });
            resolve();
          } catch {
            reject(new Error('Upload failed'));
          }
        };

        xhr.onerror = () => {
          reject(new Error('Upload failed'));
        };

        xhr.onabort = () => {
          reject(new Error('Upload failed'));
        };

        xhr.send(formData);
      });
    } catch (error) {
      setErrorText(error instanceof Error ? error.message : 'Upload failed');
    } finally {
      setIsUploading(false);
    }
  };

  const pickDocument = async () => {
    if (isUploading) return;
    setErrorText(null);
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ['image/jpeg', 'image/jpg', 'image/png', 'application/pdf'],
        copyToCacheDirectory: true,
        multiple: false,
      });
      if (result.canceled || !result.assets?.length) return;
      const file = result.assets[0];
      const lowerName = (file.name || '').toLowerCase();
      const isPdf = lowerName.endsWith('.pdf') || file.mimeType === 'application/pdf';
      setProcessedUri(file.uri);
      setSelectedFileName(file.name || `submission-${Date.now()}${isPdf ? '.pdf' : '.jpg'}`);
      setSelectedFileType(isPdf ? 'application/pdf' : file.mimeType || 'image/jpeg');
      setIsPreparingImage(false);
      setUploadProgress(0);
    } catch {
      setErrorText('Could not open file picker');
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <Text style={styles.title}>Upload Assignment</Text>

        <View style={styles.thumbnailWrap}>
          {processedUri && selectedFileType !== 'application/pdf' ? (
            <Image source={{ uri: processedUri }} style={styles.thumbnail} />
          ) : processedUri ? (
            <View style={[styles.thumbnailFallback, styles.pdfPreview]}>
              <MaterialIcons name="picture-as-pdf" size={42} color="#B91C1C" />
              <Text style={styles.pdfText} numberOfLines={2}>{selectedFileName || 'PDF selected'}</Text>
            </View>
          ) : (
            <View style={styles.thumbnailFallback} />
          )}
        </View>

        {isPreparingImage ? (
          <View style={styles.statusRow}>
            <ActivityIndicator color="#123A5F" />
            <Text style={styles.statusText}>Preparing image...</Text>
          </View>
        ) : null}

        <View style={styles.progressTrack}>
          <View style={[styles.progressFill, { width: `${uploadProgress}%` }]} />
        </View>

        <Text style={styles.progressText}>{uploadProgress}%</Text>

        {errorText ? <Text style={styles.errorText}>{errorText}</Text> : null}

        <TouchableOpacity
          style={styles.secondaryButton}
          activeOpacity={0.85}
          onPress={() => {
            void pickDocument();
          }}
          disabled={isUploading}
        >
          <Text style={styles.secondaryButtonText}>Pick PDF / PNG / JPG</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.primaryButton, !canUpload ? styles.buttonDisabled : null]}
          activeOpacity={0.85}
          onPress={() => {
            void uploadSubmission();
          }}
          disabled={!canUpload}
        >
          {isUploading ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.primaryButtonText}>{errorText ? 'Retry' : 'Upload'}</Text>}
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.secondaryButton}
          activeOpacity={0.85}
          onPress={() => navigation.navigate('CameraScreen')}
          disabled={isUploading}
        >
          <Text style={styles.secondaryButtonText}>Cancel</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F3F1EB',
  },
  content: {
    flex: 1,
    padding: 16,
    justifyContent: 'center',
    gap: 14,
  },
  title: {
    color: '#123A5F',
    fontSize: 20,
    fontWeight: '800',
    textAlign: 'center',
  },
  thumbnailWrap: {
    borderRadius: 20,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  thumbnail: {
    width: '100%',
    height: 280,
    backgroundColor: '#FFFFFF',
  },
  thumbnailFallback: {
    width: '100%',
    height: 280,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 18,
  },
  pdfPreview: {
    gap: 8,
  },
  pdfText: {
    color: '#334155',
    fontSize: 13,
    fontWeight: '600',
    textAlign: 'center',
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  statusText: {
    color: '#334155',
    fontSize: 14,
    fontWeight: '600',
  },
  progressTrack: {
    height: 12,
    borderRadius: 999,
    backgroundColor: '#E2E8F0',
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#123A5F',
  },
  progressText: {
    color: '#334155',
    textAlign: 'center',
    fontSize: 13,
    fontWeight: '700',
  },
  errorText: {
    color: '#B91C1C',
    textAlign: 'center',
    fontSize: 14,
    fontWeight: '700',
  },
  primaryButton: {
    backgroundColor: '#123A5F',
    borderRadius: 12,
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '800',
  },
  secondaryButton: {
    borderRadius: 12,
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#CBD5E1',
  },
  secondaryButtonText: {
    color: '#123A5F',
    fontSize: 15,
    fontWeight: '800',
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  helperText: {
    color: '#64748B',
    fontSize: 13,
    textAlign: 'center',
  },
});
