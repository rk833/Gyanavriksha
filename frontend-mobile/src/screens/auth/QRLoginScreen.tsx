import React, { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import axios from 'axios';
import * as SecureStore from 'expo-secure-store';
import { CameraView, useCameraPermissions } from 'expo-camera';

const API_BASE_URL = 'http://localhost:8000';

type QRLoginScreenProps = {
  navigation?: {
    navigate: (screenName: string, params?: Record<string, string>) => void;
    goBack?: () => void;
  };
};

export default function QRLoginScreen({ navigation }: QRLoginScreenProps) {
  const [permission, requestPermission] = useCameraPermissions();
  const [isLoading, setIsLoading] = useState(false);
  const [scanError, setScanError] = useState<string | null>(null);
  const [hasScanned, setHasScanned] = useState(false);

  const scannerEnabled = useMemo(
    () => permission?.granted === true && !isLoading && !hasScanned,
    [permission?.granted, isLoading, hasScanned]
  );

  const handleScanResult = useCallback(
    async ({ data }: { data: string }) => {
      if (!scannerEnabled) {
        return;
      }

      setHasScanned(true);
      setScanError(null);
      setIsLoading(true);

      try {
        let parsedUrl: URL;
        let allowedOrigin: string;

        try {
          parsedUrl = new URL(data);
          allowedOrigin = new URL(API_BASE_URL).origin;
        } catch {
          throw new Error('Scanned QR is not a valid URL.');
        }

        if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
          throw new Error('Scanned QR URL must use HTTP or HTTPS.');
        }

        if (parsedUrl.origin !== allowedOrigin) {
          throw new Error('Scanned QR URL is not from the expected server.');
        }

        const response = await axios.get(parsedUrl.toString());
        const token =
          response.data?.token ??
          response.data?.access_token ??
          response.data?.jwt ??
          response.data?.auth_token;

        if (typeof token !== 'string' || token.length === 0) {
          throw new Error('Token missing from QR login response.');
        }

        await SecureStore.setItemAsync('auth_token', token);

        if (navigation) {
          navigation.navigate('TwoFactorScreen', { token });
        }
      } catch {
        setScanError('Scan failed. Please try again.');
        setHasScanned(false);
      } finally {
        setIsLoading(false);
      }
    },
    [navigation, scannerEnabled]
  );

  const retryScan = () => {
    setScanError(null);
    setHasScanned(false);
  };

  const goToEmailLogin = () => {
    if (navigation?.goBack) {
      navigation.goBack();
      return;
    }

    if (navigation) {
      navigation.navigate('LoginScreen');
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        <Text style={styles.title}>Scan QR Login</Text>
        <Text style={styles.subtitle}>Scan the QR code shown on the web app to continue.</Text>

        <View style={styles.scannerFrame}>
          {permission == null ? (
            <View style={styles.centerContent}>
              <ActivityIndicator color="#112D4E" />
              <Text style={styles.helperText}>Requesting camera permission...</Text>
            </View>
          ) : null}

          {permission?.granted === false ? (
            <View style={styles.centerContent}>
              <Text style={styles.permissionText}>Camera access is required to scan QR codes.</Text>
              <TouchableOpacity style={styles.primaryButton} onPress={requestPermission} activeOpacity={0.85}>
                <Text style={styles.primaryButtonText}>Allow Camera</Text>
              </TouchableOpacity>
            </View>
          ) : null}

          {permission?.granted === true ? (
            <CameraView
              onBarcodeScanned={scannerEnabled ? handleScanResult : undefined}
              barcodeScannerSettings={{
                barcodeTypes: ['qr'],
              }}
              style={StyleSheet.absoluteFillObject}
            />
          ) : null}

          <View style={styles.overlayCorners} pointerEvents="none">
            <View style={[styles.corner, styles.topLeft]} />
            <View style={[styles.corner, styles.topRight]} />
            <View style={[styles.corner, styles.bottomLeft]} />
            <View style={[styles.corner, styles.bottomRight]} />
          </View>
        </View>

        {scanError ? <Text style={styles.errorText}>{scanError}</Text> : null}

        {scanError ? (
          <TouchableOpacity style={styles.primaryButton} onPress={retryScan} activeOpacity={0.85}>
            <Text style={styles.primaryButtonText}>Try again</Text>
          </TouchableOpacity>
        ) : null}

        <TouchableOpacity style={styles.linkButton} onPress={goToEmailLogin} activeOpacity={0.8}>
          <Text style={styles.linkText}>Login with email instead</Text>
        </TouchableOpacity>
      </View>

      {isLoading ? (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator size="large" color="#FFFFFF" />
          <Text style={styles.loadingText}>Verifying QR session...</Text>
        </View>
      ) : null}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#F9F7F7',
  },
  container: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 20,
  },
  title: {
    fontSize: 28,
    fontWeight: '800',
    color: '#112D4E',
  },
  subtitle: {
    marginTop: 6,
    color: '#64748B',
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 18,
  },
  scannerFrame: {
    height: 360,
    borderRadius: 20,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#DBE2EF',
    backgroundColor: '#E9EEF5',
    justifyContent: 'center',
  },
  centerContent: {
    paddingHorizontal: 24,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  helperText: {
    color: '#64748B',
    fontSize: 13,
  },
  permissionText: {
    color: '#112D4E',
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
  },
  overlayCorners: {
    ...StyleSheet.absoluteFillObject,
    margin: 24,
  },
  corner: {
    position: 'absolute',
    width: 28,
    height: 28,
    borderColor: '#FFFFFF',
  },
  topLeft: {
    top: 0,
    left: 0,
    borderTopWidth: 3,
    borderLeftWidth: 3,
  },
  topRight: {
    top: 0,
    right: 0,
    borderTopWidth: 3,
    borderRightWidth: 3,
  },
  bottomLeft: {
    bottom: 0,
    left: 0,
    borderBottomWidth: 3,
    borderLeftWidth: 3,
  },
  bottomRight: {
    bottom: 0,
    right: 0,
    borderBottomWidth: 3,
    borderRightWidth: 3,
  },
  errorText: {
    marginTop: 14,
    color: '#D92D20',
    fontWeight: '600',
    textAlign: 'center',
  },
  primaryButton: {
    marginTop: 16,
    backgroundColor: '#112D4E',
    borderRadius: 14,
    paddingVertical: 13,
    alignItems: 'center',
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 14,
    letterSpacing: 0.3,
  },
  linkButton: {
    marginTop: 16,
    alignSelf: 'center',
  },
  linkText: {
    color: '#3F72AF',
    fontWeight: '700',
    textDecorationLine: 'underline',
    textDecorationColor: '#3F72AF',
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(17, 45, 78, 0.72)',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,
  },
  loadingText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
});