import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Linking, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useIsFocused } from '@react-navigation/native';
import { CameraType, CameraView, useCameraPermissions } from 'expo-camera';
import * as ImageManipulator from 'expo-image-manipulator';
import { MaterialIcons } from '@expo/vector-icons';
import * as jpeg from 'jpeg-js';
import { SafeAreaView } from 'react-native-safe-area-context';

const BRIGHTNESS_THRESHOLD = 55;
const BLUR_SHARPNESS_THRESHOLD = 12;

type CameraNavigation = {
  navigate: (screenName: string, params?: Record<string, unknown>) => void;
  goBack?: () => void;
  addListener?: (event: string, callback: () => void) => (() => void) | undefined;
};

type CameraRoute = {
  params?: {
    assignmentId?: string;
  };
};

type CameraScreenProps = {
  navigation: CameraNavigation;
  route?: CameraRoute;
};

type QualityCheckResult = {
  averageLuminance: number;
  sharpness: number;
};

function base64ToUint8Array(base64: string) {
  const binaryString = globalThis.atob(base64);
  const output = new Uint8Array(binaryString.length);

  for (let index = 0; index < binaryString.length; index += 1) {
    output[index] = binaryString.charCodeAt(index);
  }

  return output;
}

async function analyzeImageQuality(imageUri: string): Promise<QualityCheckResult> {
  const resizedImage = await ImageManipulator.manipulateAsync(
    imageUri,
    [{ resize: { width: 240 } }],
    {
      compress: 1,
      format: ImageManipulator.SaveFormat.JPEG,
      base64: true,
    }
  );

  if (!resizedImage.base64) {
    throw new Error('Could not analyze the captured image.');
  }

  const decoded = jpeg.decode(base64ToUint8Array(resizedImage.base64), { useTArray: true }) as {
    data: Uint8Array;
    width: number;
    height: number;
  };

  let luminanceSum = 0;
  const { width, height } = decoded;
  const luminanceValues = new Float32Array(width * height);

  let pixelCount = 0;

  for (let index = 0; index < decoded.data.length; index += 4) {
    const red = decoded.data[index];
    const green = decoded.data[index + 1];
    const blue = decoded.data[index + 2];
    const luminance = 0.299 * red + 0.587 * green + 0.114 * blue;

    luminanceSum += luminance;
    luminanceValues[pixelCount] = luminance;
    pixelCount += 1;
  }

  const averageLuminance = luminanceSum / pixelCount;

  // Edge-based sharpness score. Lower values usually indicate blur.
  let gradientSum = 0;
  let gradientCount = 0;

  for (let y = 0; y < height - 1; y += 1) {
    for (let x = 0; x < width - 1; x += 1) {
      const current = y * width + x;
      const right = current + 1;
      const below = current + width;

      const dx = Math.abs(luminanceValues[current] - luminanceValues[right]);
      const dy = Math.abs(luminanceValues[current] - luminanceValues[below]);
      gradientSum += dx + dy;
      gradientCount += 2;
    }
  }

  const sharpness = gradientCount > 0 ? gradientSum / gradientCount : 0;

  return { averageLuminance, sharpness };
}

export default function CameraScreen({ navigation, route }: CameraScreenProps) {
  const cameraRef = useRef<CameraView | null>(null);
  const [facing] = useState<CameraType>('back');
  const [torchEnabled, setTorchEnabled] = useState(false);
  const [bannerMessage, setBannerMessage] = useState<string | null>(null);
  const [capturedImageUris, setCapturedImageUris] = useState<string[]>([]);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isCameraReady, setIsCameraReady] = useState(false);
  const [permission, requestPermission] = useCameraPermissions();
  const isScreenFocused = useIsFocused();

  useEffect(() => {
    if (isScreenFocused && (!permission || permission.status === 'undetermined' || (permission.canAskAgain && !permission.granted))) {
      void requestPermission();
    }

    return () => {
      setTorchEnabled(false);
    };
  }, [isScreenFocused, permission, requestPermission]);

  const assignmentId = route?.params?.assignmentId;

  const openSettings = useCallback(() => {
    void Linking.openSettings();
  }, []);

  const goBack = useCallback(() => {
    setTorchEnabled(false);

    if (navigation.goBack) {
      navigation.goBack();
      return;
    }

    navigation.navigate('Home');
  }, [navigation]);

  const continueToUpload = useCallback(() => {
    if (!capturedImageUris.length) {
      return;
    }

    setTorchEnabled(false);

    navigation.navigate('UploadScreen', {
      imageUris: capturedImageUris,
      imageUri: capturedImageUris[0],
      assignmentId,
    });
  }, [assignmentId, capturedImageUris, navigation]);

  const removeLastCapture = useCallback(() => {
    setCapturedImageUris((current) => {
      if (!current.length) {
        return current;
      }

      const next = current.slice(0, -1);
      setBannerMessage(next.length ? `Removed last page. ${next.length} left.` : 'Last captured page removed');
      return next;
    });
  }, []);

  const toggleTorch = useCallback(async () => {
    try {
      // Try use toggleTorchAsync if available (newer expo-camera versions)
      if (cameraRef.current && typeof (cameraRef.current as any).toggleTorchAsync === 'function') {
        await (cameraRef.current as any).toggleTorchAsync();
        setTorchEnabled((current) => !current);
      } else {
        // Fallback: toggle the state-based enableTorch prop
        setTorchEnabled((current) => !current);
      }
    } catch (error) {
      console.error('Torch toggle failed:', error);
      // Still toggle the state even if method fails
      setTorchEnabled((current) => !current);
    }
  }, []);

  const capturePhoto = useCallback(async () => {
    if (!cameraRef.current || isAnalyzing || !isCameraReady) {
      return;
    }

    setBannerMessage(null);
    setIsAnalyzing(true);

    try {
      const photo = await cameraRef.current.takePictureAsync({
        quality: 1,
        base64: true,
        exif: false,
        skipProcessing: false,
      });

      const sourceUri = photo.base64 ? `data:image/jpg;base64,${photo.base64}` : photo.uri;
      const { averageLuminance, sharpness } = await analyzeImageQuality(sourceUri);

      const isTooDark = averageLuminance < BRIGHTNESS_THRESHOLD;
      const isTooBlurry = sharpness < BLUR_SHARPNESS_THRESHOLD;

      if (isTooDark || isTooBlurry) {
        setBannerMessage(isTooDark ? 'Image too dark — retake' : 'Image too blurry — retake');
        return;
      }

      const imageUri = photo.base64 ? `data:image/jpg;base64,${photo.base64}` : photo.uri;
      setCapturedImageUris((current) => {
        const next = [...current, imageUri];
        setBannerMessage(`Captured page ${next.length}`);
        return next;
      });
    } catch (error) {
      console.error('Capture error:', error);
      setBannerMessage('Image too dark / blurry — retake');
    } finally {
      setIsAnalyzing(false);
    }
  }, [isAnalyzing, isCameraReady]);

  const permissionState = useMemo(() => {
    if (!permission) {
      return 'loading';
    }

    return permission.granted ? 'granted' : 'denied';
  }, [permission]);

  if (permissionState === 'loading') {
    return (
      <SafeAreaView style={styles.loaderWrap}>
        <ActivityIndicator size="large" color="#FFFFFF" />
        <Text style={styles.loaderText}>Loading camera...</Text>
      </SafeAreaView>
    );
  }

  if (permissionState === 'denied') {
    return (
      <SafeAreaView style={styles.permissionWrap}>
        <MaterialIcons name="photo-camera" size={44} color="#FFFFFF" />
        <Text style={styles.permissionTitle}>Camera access is required</Text>
        <Text style={styles.permissionText}>Allow camera access to capture handwritten assignments before upload.</Text>
        <TouchableOpacity style={styles.permissionButton} activeOpacity={0.85} onPress={() => (permission?.canAskAgain ? void requestPermission() : openSettings())}>
          <Text style={styles.permissionButtonText}>{permission?.canAskAgain ? 'Grant Permission' : 'Open Settings'}</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.cameraWrap}>
        <CameraView
          ref={cameraRef}
          style={styles.camera}
          facing={facing}
          active={isScreenFocused}
          enableTorch={torchEnabled}
          onCameraReady={() => setIsCameraReady(true)}
        />

        <View style={styles.overlay} pointerEvents="box-none">
          <View style={styles.topBar} pointerEvents="box-none">
            <TouchableOpacity style={styles.iconButton} activeOpacity={0.8} onPress={goBack}>
              <MaterialIcons name="close" size={22} color="#FFFFFF" />
            </TouchableOpacity>
            <Text style={styles.topTitle}>Capture Assignment</Text>
            <TouchableOpacity
              style={styles.iconButton}
              activeOpacity={0.8}
              onPress={() => void toggleTorch()}
            >
              <MaterialIcons name={torchEnabled ? 'flash-on' : 'flash-off'} size={22} color="#FFFFFF" />
            </TouchableOpacity>
          </View>

          {bannerMessage ? (
            <View style={styles.banner}>
              <Text style={styles.bannerText}>{bannerMessage}</Text>
            </View>
          ) : null}

          <View style={styles.bottomPanel}>
            <Text style={styles.instructions}>Capture all pages, then tap Continue.</Text>
            <View style={styles.shutterRow}>
              <View style={styles.sideSpacer} />
              <TouchableOpacity
                style={[styles.shutterOuter, isAnalyzing ? styles.shutterDisabled : null]}
                activeOpacity={0.9}
                onPress={() => void capturePhoto()}
                disabled={isAnalyzing}
              >
                <View style={styles.shutterInner}>
                  {isAnalyzing ? <ActivityIndicator color="#123A5F" /> : <View style={styles.shutterCore} />}
                </View>
              </TouchableOpacity>
              <View style={styles.sideSpacer} />
            </View>

            <View style={styles.captureFooterRow}>
              <Text style={styles.captureCount}>{capturedImageUris.length} page(s) captured</Text>
              <View style={styles.footerButtons}>
                <TouchableOpacity
                  style={[styles.removeButton, capturedImageUris.length === 0 ? styles.continueButtonDisabled : null]}
                  activeOpacity={0.85}
                  onPress={removeLastCapture}
                  disabled={capturedImageUris.length === 0}
                >
                  <Text style={styles.removeButtonText}>Remove Last</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.continueButton, capturedImageUris.length === 0 ? styles.continueButtonDisabled : null]}
                  activeOpacity={0.85}
                  onPress={continueToUpload}
                  disabled={capturedImageUris.length === 0}
                >
                  <Text style={styles.continueButtonText}>Continue</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
  },
  cameraWrap: {
    flex: 1,
    backgroundColor: '#000000',
  },
  camera: {
    flex: 1,
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'space-between',
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 12,
  },
  iconButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: 'rgba(15, 23, 42, 0.55)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  topTitle: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: 0.4,
  },
  banner: {
    alignSelf: 'center',
    marginTop: 10,
    backgroundColor: '#DC2626',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 999,
  },
  bannerText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '800',
  },
  bottomPanel: {
    paddingHorizontal: 18,
    paddingBottom: 28,
  },
  instructions: {
    color: '#E2E8F0',
    textAlign: 'center',
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 18,
  },
  shutterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  sideSpacer: {
    flex: 1,
    alignItems: 'center',
  },
  captureFooterRow: {
    marginTop: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  captureCount: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
  footerButtons: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  removeButton: {
    backgroundColor: 'rgba(255,255,255,0.18)',
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.35)',
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  removeButtonText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '800',
  },
  continueButton: {
    backgroundColor: '#FFFFFF',
    borderRadius: 999,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  continueButtonDisabled: {
    opacity: 0.55,
  },
  continueButtonText: {
    color: '#123A5F',
    fontSize: 13,
    fontWeight: '800',
  },
  shutterOuter: {
    width: 84,
    height: 84,
    borderRadius: 42,
    borderWidth: 6,
    borderColor: 'rgba(255,255,255,0.85)',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.18)',
  },
  shutterDisabled: {
    opacity: 0.65,
  },
  shutterInner: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  shutterCore: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#123A5F',
  },
  loaderWrap: {
    flex: 1,
    backgroundColor: '#000000',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 14,
  },
  loaderText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  permissionWrap: {
    flex: 1,
    backgroundColor: '#123A5F',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
    gap: 14,
  },
  permissionTitle: {
    color: '#FFFFFF',
    fontSize: 24,
    fontWeight: '800',
    textAlign: 'center',
  },
  permissionText: {
    color: 'rgba(255,255,255,0.88)',
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
    maxWidth: 320,
  },
  permissionButton: {
    marginTop: 8,
    backgroundColor: '#FFFFFF',
    borderRadius: 999,
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  permissionButtonText: {
    color: '#123A5F',
    fontSize: 14,
    fontWeight: '800',
  },
});
