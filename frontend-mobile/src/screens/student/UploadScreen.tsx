import React, { useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import axios from 'axios';
import * as SecureStore from 'expo-secure-store';
import { SafeAreaView } from 'react-native-safe-area-context';

import { API_BASE_URL } from '../../config/api';

type UploadNavigation = {
  navigate: (screenName: string, params?: Record<string, unknown>) => void;
  goBack?: () => void;
};

type UploadRoute = {
  params?: {
    imageUri?: string;
    imageUris?: string[];
    assignmentId?: string;
  };
};

type UploadScreenProps = {
  navigation: UploadNavigation;
  route?: UploadRoute;
};

export default function UploadScreen({ navigation, route }: UploadScreenProps) {
  const imageUri = route?.params?.imageUri ?? '';
  const imageUris = route?.params?.imageUris?.length ? route.params.imageUris : imageUri ? [imageUri] : [];
  const previewUri = imageUris[0] ?? '';
  const assignmentId = route?.params?.assignmentId ?? '';
  const [isUploading, setIsUploading] = useState(false);
  const [statusText, setStatusText] = useState(imageUris.length ? `Ready to upload ${imageUris.length} image(s)` : 'Ready to upload');

  const canUpload = useMemo(() => Boolean(imageUris.length && assignmentId && !isUploading), [assignmentId, imageUris.length, isUploading]);

  const uploadSubmission = async () => {
    if (!assignmentId) {
      Alert.alert('Missing assignment', 'Assignment ID is required to upload this submission.');
      return;
    }

    if (!imageUris.length) {
      Alert.alert('Missing image', 'No captured image is available for upload.');
      return;
    }

    setIsUploading(true);
    setStatusText('Uploading...');

    try {
      const accessToken = await SecureStore.getItemAsync('access_token');
      const authToken = accessToken ?? (await SecureStore.getItemAsync('auth_token'));

      if (!authToken) {
        throw new Error('You are not authenticated. Please log in again.');
      }

      const formData = new FormData();
      imageUris.forEach((uri, index) => {
        formData.append('files', {
          uri,
          name: `submission-${Date.now()}-${index + 1}.jpg`,
          type: 'image/jpeg',
        } as unknown as Blob);
      });

      await axios.post(`${API_BASE_URL}/api/students/submissions`, formData, {
        params: { assignment_id: assignmentId },
        headers: {
          Authorization: `Bearer ${authToken}`,
          'Content-Type': 'multipart/form-data',
        },
      });

      setStatusText('Upload successful');
      Alert.alert('Submitted', 'Your submission has been uploaded successfully. You can submit again.', [
        {
          text: 'Submit Another',
          onPress: () => navigation.navigate('AssignmentPickerScreen'),
        },
        {
          text: 'Go Home',
          onPress: () => navigation.navigate('Home'),
        },
      ]);
    } catch (error) {
      const fallbackMessage = 'Upload failed. Please try again.';
      const message = axios.isAxiosError(error)
        ? (error.response?.data as { detail?: string } | undefined)?.detail ?? error.message ?? fallbackMessage
        : fallbackMessage;
      setStatusText('Upload failed');
      Alert.alert('Upload failed', message);
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} activeOpacity={0.85} onPress={() => (navigation.goBack ? navigation.goBack() : navigation.navigate('Home'))}>
          <MaterialIcons name="arrow-back" size={20} color="#123A5F" />
        </TouchableOpacity>
        <Text style={styles.title}>Upload Assignment</Text>
        <View style={styles.placeholder} />
      </View>

      <View style={styles.content}>
        {previewUri ? <Image source={{ uri: previewUri }} style={styles.preview} /> : <View style={styles.previewFallback}><MaterialIcons name="image" size={34} color="#94A3B8" /></View>}
        <View style={styles.card}>
          <Text style={styles.label}>Submission</Text>
          <Text style={styles.valueSecondary}>Images: {imageUris.length}</Text>
          <Text style={styles.helper}>{statusText}</Text>
          <TouchableOpacity style={[styles.uploadButton, !canUpload ? styles.uploadButtonDisabled : null]} activeOpacity={0.85} onPress={() => void uploadSubmission()} disabled={!canUpload}>
            {isUploading ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.uploadButtonText}>Upload Submission</Text>}
          </TouchableOpacity>
        </View>
      </View>
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
  },
  placeholder: {
    width: 40,
    height: 40,
  },
  content: {
    flex: 1,
    padding: 16,
    gap: 16,
  },
  preview: {
    width: '100%',
    height: 360,
    borderRadius: 20,
    backgroundColor: '#FFFFFF',
  },
  previewFallback: {
    width: '100%',
    height: 360,
    borderRadius: 20,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    gap: 8,
  },
  label: {
    color: '#64748B',
    fontSize: 11,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  valueSecondary: {
    color: '#334155',
    fontSize: 13,
    fontWeight: '700',
  },
  helper: {
    color: '#64748B',
    fontSize: 13,
    lineHeight: 19,
  },
  uploadButton: {
    marginTop: 8,
    backgroundColor: '#123A5F',
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 46,
  },
  uploadButtonDisabled: {
    opacity: 0.6,
  },
  uploadButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '800',
  },
});
