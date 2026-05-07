import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { Controller, useForm } from 'react-hook-form';
import axios from 'axios';
import * as SecureStore from 'expo-secure-store';
import { API_BASE_URL } from '../../config/api';
import { completeBiometricSignIn, getBiometricTypeLabel } from '../../services/biometricAuth';
import {
  clearTwoFactorTrustForEmail,
  setLastLoginEmail,
  twoFactorTrustStorageKey,
} from '../../utils/twoFactorTrust';

type LoginFormValues = {
  email: string;
  password: string;
};

type LoginScreenProps = {
  navigation?: {
    navigate: (screenName: string, params?: Record<string, unknown>) => void;
  };
  onLoginSuccess?: (token: string) => void;
  initialMessage?: string | null;
};

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function LoginScreen({ navigation, onLoginSuccess, initialMessage }: LoginScreenProps) {
  const [submitError, setSubmitError] = useState<string | null>(initialMessage ?? null);
  const [passwordVisible, setPasswordVisible] = useState(false);
  const [biometricLabel, setBiometricLabel] = useState('Biometric');
  const [biometricBusy, setBiometricBusy] = useState(false);
  const [twoFactorNudgeToken, setTwoFactorNudgeToken] = useState<string | null>(null);

  const refreshBiometricLabel = useCallback(() => {
    if (Platform.OS === 'web') {
      return;
    }
    void getBiometricTypeLabel().then(setBiometricLabel);
  }, []);

  useFocusEffect(
    useCallback(() => {
      refreshBiometricLabel();
    }, [refreshBiometricLabel])
  );

  const onBiometricLogin = async () => {
    setSubmitError(null);
    setBiometricBusy(true);
    try {
      const result = await completeBiometricSignIn();
      if (result.ok) {
        onLoginSuccess?.(result.accessToken);
        return;
      }
      setSubmitError(result.message);
    } finally {
      setBiometricBusy(false);
    }
  };

  const {
    control,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginFormValues>({
    defaultValues: {
      email: '',
      password: '',
    },
    mode: 'onTouched',
  });

  const onSubmit = handleSubmit(async ({ email, password }) => {
    setSubmitError(null);

    try {
      const normalizedEmail = email.trim().toLowerCase();
      let trusted_device_token: string | null = null;
      try {
        trusted_device_token = await SecureStore.getItemAsync(twoFactorTrustStorageKey(normalizedEmail));
      } catch {
        trusted_device_token = null;
      }

      const body: Record<string, string> = { email: email.trim(), password };
      if (trusted_device_token) {
        body.trusted_device_token = trusted_device_token;
      }

      const response = await axios.post(`${API_BASE_URL}/api/auth/login`, body);

      const requiresTwoFactor = response.data?.requires_2fa === true;
      const userId = response.data?.user_id;

      if (requiresTwoFactor) {
        if (trusted_device_token) {
          await clearTwoFactorTrustForEmail(normalizedEmail);
        }
        if (navigation && typeof userId === 'string' && userId.length > 0) {
          const rawMethods = response.data?.two_factor_methods;
          const twoFactorMethods =
            Array.isArray(rawMethods) && rawMethods.length > 0 ? rawMethods : ['totp'];
          await setLastLoginEmail(email.trim());
          navigation.navigate('TwoFactorScreen', {
            user_id: userId,
            two_factor_methods: twoFactorMethods,
            login_email: email.trim(),
          });
          return;
        }

        setSubmitError('Two-factor authentication is required. Please log in again.');
        return;
      }

      const token =
        response.data?.token ??
        response.data?.access_token ??
        response.data?.jwt ??
        response.data?.auth_token;

      if (typeof token !== 'string' || token.length === 0) {
        throw new Error('Token missing from login response.');
      }

      const refreshToken = response.data?.refresh_token;

      await SecureStore.setItemAsync('access_token', token);
      await SecureStore.setItemAsync('auth_token', token);
      if (typeof refreshToken === 'string' && refreshToken.length > 0) {
        await SecureStore.setItemAsync('refresh_token', refreshToken);
      }

      await setLastLoginEmail(email.trim());

      // Check if admin-created account needs a password change before full access
      try {
        const meRes = await axios.get(`${API_BASE_URL}/api/auth/me`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (meRes.data?.must_change_password === true) {
          navigation?.navigate('ForceChangePasswordScreen', { token });
          return;
        }
        const has2fa = meRes.data?.totp_enabled === true || meRes.data?.email_2fa_enabled === true;
        if (!has2fa) {
          setTwoFactorNudgeToken(token);
          return;
        }
      } catch {
        // If /me fails, proceed normally — not worth blocking login over
      }

      onLoginSuccess?.(token);
      // AppNavigator switches to tabs after auth success.
    } catch (error) {
      if (axios.isAxiosError(error) && error.response?.status === 401) {
        setSubmitError('Invalid email or password. Please try again.');
        return;
      }

      if (axios.isAxiosError(error) && error.response?.status === 423) {
        setSubmitError('Account is temporarily locked. Please try again later.');
        return;
      }

      if (axios.isAxiosError(error) && error.response) {
        const detail = error.response.data?.detail;
        if (typeof detail === 'string' && detail.length > 0) {
          setSubmitError(detail);
          return;
        }
      }

      setSubmitError('Unable to sign in right now. Please check your connection and try again.');
    }
  });

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
          <View style={styles.frame}>
            <View style={styles.card}>
              <View style={styles.brandBlock}>
                <Image
                  source={require('../../../assets/logo-icon.png')}
                  style={styles.logoImage}
                  resizeMode="contain"
                />
                <View style={styles.brandTextBlock}>
                  <Text style={styles.brandTitle}>Gyanavriksha</Text>
                  <Text style={styles.brandSubtitle}>Welcome Back</Text>
                </View>
                <Text style={styles.tagline}>Learning Ecosystem for Nepal&apos;s Secondary Education</Text>
              </View>

              <View style={styles.form}>
                <View style={styles.fieldGroup}>
                  <Controller
                    control={control}
                    name="email"
                    rules={{
                      required: 'Email is required.',
                      pattern: {
                        value: EMAIL_REGEX,
                        message: 'Enter a valid email address.',
                      },
                    }}
                    render={({ field: { onChange, onBlur, value } }) => (
                      <TextInput
                        style={[styles.input, errors.email ? styles.inputError : null]}
                        placeholder="Email Address"
                        placeholderTextColor="#999999"
                        keyboardType="email-address"
                        autoCapitalize="none"
                        autoCorrect={false}
                        textContentType="emailAddress"
                        value={value}
                        onBlur={onBlur}
                        onChangeText={onChange}
                      />
                    )}
                  />
                  {errors.email ? <Text style={styles.fieldError}>{errors.email.message}</Text> : null}
                </View>

                <View style={styles.fieldGroup}>
                  <View style={[styles.passwordRow, errors.password ? styles.inputError : null]}>
                    <Controller
                      control={control}
                      name="password"
                      rules={{
                        required: 'Password is required.',
                      }}
                      render={({ field: { onChange, onBlur, value } }) => (
                        <TextInput
                          style={styles.passwordInput}
                          placeholder="Password"
                          placeholderTextColor="#999999"
                          secureTextEntry={!passwordVisible}
                          autoCapitalize="none"
                          autoCorrect={false}
                          textContentType="password"
                          value={value}
                          onBlur={onBlur}
                          onChangeText={onChange}
                        />
                      )}
                    />
                    <TouchableOpacity
                      onPress={() => setPasswordVisible((current) => !current)}
                      activeOpacity={0.8}
                      style={styles.visibilityButton}
                    >
                      <Text style={styles.visibilityText}>{passwordVisible ? 'Hide' : 'Show'}</Text>
                    </TouchableOpacity>
                  </View>
                  {errors.password ? <Text style={styles.fieldError}>{errors.password.message}</Text> : null}
                </View>

                <TouchableOpacity
                  onPress={() => {
                    if (navigation) {
                      navigation.navigate('ForgotPasswordScreen');
                      return;
                    }

                    Alert.alert('Preview mode', 'Forgot password navigation is not wired yet.');
                  }}
                  activeOpacity={0.8}
                  style={styles.forgotLinkWrap}
                >
                  <Text style={styles.forgotLink}>Forgot Password?</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.loginButton, isSubmitting ? styles.loginButtonDisabled : null]}
                  activeOpacity={0.85}
                  onPress={onSubmit}
                  disabled={isSubmitting}
                >
                  {isSubmitting ? (
                    <ActivityIndicator color="#FFFFFF" />
                  ) : (
                    <Text style={styles.loginButtonText}>Login</Text>
                  )}
                </TouchableOpacity>

                {submitError ? <Text style={styles.submitError}>{submitError}</Text> : null}

                <View style={styles.dividerWrap}>
                  <View style={styles.dividerLine} />
                  <View style={styles.dividerLabelWrap}>
                    <Text style={styles.dividerLabel}>OR</Text>
                  </View>
                </View>

                {Platform.OS !== 'web' ? (
                  <>
                    <TouchableOpacity
                      style={[styles.biometricButton, biometricBusy ? styles.biometricButtonDisabled : null]}
                      activeOpacity={0.85}
                      onPress={() => void onBiometricLogin()}
                      disabled={biometricBusy}
                    >
                      {biometricBusy ? (
                        <ActivityIndicator color="#112D4E" />
                      ) : (
                        <Text style={styles.biometricButtonText}>Sign in with {biometricLabel}</Text>
                      )}
                    </TouchableOpacity>
                  </>
                ) : null}
              </View>

              <View style={styles.footer}>
                <View style={styles.secureChip}>
                  <View style={styles.secureDot} />
                  <Text style={styles.secureChipText}>2FA Secured</Text>
                </View>
              </View>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
      <Modal visible={!!twoFactorNudgeToken} transparent animationType="fade" onRequestClose={() => setTwoFactorNudgeToken(null)}>
        <View style={styles.nudgeOverlay}>
          <View style={styles.nudgeCard}>
            <View style={styles.nudgeIconWrap}>
              <Text style={styles.nudgeIcon}>🛡️</Text>
            </View>
            <Text style={styles.nudgeTitle}>Protect your account</Text>
            <Text style={styles.nudgeBody}>
              Add Two-Factor Auth from Profile {'>'} Two-Factor Auth for stronger security.
            </Text>
            <TouchableOpacity
              style={styles.nudgePrimaryBtn}
              activeOpacity={0.85}
              onPress={() => {
                const t = twoFactorNudgeToken;
                setTwoFactorNudgeToken(null);
                if (t) onLoginSuccess?.(t);
              }}
            >
              <Text style={styles.nudgePrimaryText}>Continue</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#F9F7F7',
  },
  flex: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: 20,
    paddingVertical: 28,
  },
  frame: {
    width: '100%',
    maxWidth: 420,
    alignSelf: 'center',
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 28,
    paddingHorizontal: 24,
    paddingVertical: 32,
    shadowColor: '#000000',
    shadowOpacity: 0.08,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 10 },
    elevation: 8,
  },
  brandBlock: {
    alignItems: 'center',
    marginBottom: 28,
  },
  logoImage: {
    width: 92,
    height: 92,
    marginBottom: 12,
  },
  brandTextBlock: {
    alignItems: 'center',
  },
  brandTitle: {
    color: '#112D4E',
    fontSize: 30,
    fontWeight: '800',
    letterSpacing: -0.4,
  },
  brandSubtitle: {
    marginTop: 6,
    color: '#3F72AF',
    fontSize: 16,
    fontWeight: '600',
  },
  tagline: {
    marginTop: 12,
    color: '#64748B',
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 19,
  },
  form: {
    gap: 14,
  },
  fieldGroup: {
    gap: 6,
  },
  input: {
    borderWidth: 1,
    borderColor: '#DBE2EF',
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    color: '#112D4E',
    fontSize: 15,
    paddingHorizontal: 18,
    paddingVertical: 15,
  },
  inputError: {
    borderColor: '#D92D20',
  },
  passwordRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#DBE2EF',
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    overflow: 'hidden',
  },
  passwordInput: {
    flex: 1,
    color: '#112D4E',
    fontSize: 15,
    paddingHorizontal: 18,
    paddingVertical: 15,
  },
  visibilityButton: {
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  visibilityText: {
    color: '#3F72AF',
    fontSize: 13,
    fontWeight: '700',
  },
  fieldError: {
    color: '#D92D20',
    fontSize: 12,
    fontWeight: '600',
    paddingLeft: 4,
  },
  forgotLinkWrap: {
    alignSelf: 'flex-end',
  },
  forgotLink: {
    color: '#3F72AF',
    fontSize: 13,
    fontWeight: '700',
    textDecorationLine: 'underline',
    textDecorationColor: '#3F72AF',
  },
  loginButton: {
    marginTop: 2,
    backgroundColor: '#112D4E',
    borderRadius: 14,
    paddingVertical: 15,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000000',
    shadowOpacity: 0.14,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
  },
  loginButtonDisabled: {
    opacity: 0.8,
  },
  loginButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  submitError: {
    color: '#D92D20',
    fontSize: 13,
    fontWeight: '600',
    textAlign: 'center',
    marginTop: -2,
  },
  dividerWrap: {
    marginVertical: 4,
    justifyContent: 'center',
    alignItems: 'center',
  },
  dividerLine: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: '50%',
    height: 1,
    backgroundColor: '#DBE2EF',
  },
  dividerLabelWrap: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 16,
    paddingVertical: 2,
  },
  dividerLabel: {
    color: '#3F72AF',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.2,
  },
  biometricButton: {
    borderWidth: 1,
    borderColor: '#DBE2EF',
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    paddingVertical: 15,
    alignItems: 'center',
    justifyContent: 'center',
  },
  biometricButtonDisabled: {
    opacity: 0.7,
  },
  biometricButtonText: {
    color: '#112D4E',
    fontSize: 15,
    fontWeight: '800',
  },
  footer: {
    marginTop: 28,
    alignItems: 'center',
    gap: 18,
  },
  footerText: {
    color: '#64748B',
    fontSize: 13,
    textAlign: 'center',
  },
  secureChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#DBE2EF',
    borderWidth: 1,
    borderColor: '#E8E8E8',
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  secureDot: {
    width: 8,
    height: 8,
    borderRadius: 999,
    backgroundColor: '#4CAF50',
  },
  secureChipText: {
    color: '#112D4E',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  nudgeOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.35)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  nudgeCard: {
    width: '100%',
    maxWidth: 360,
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 20,
    borderWidth: 1,
    borderColor: '#DBE2EF',
    alignItems: 'center',
  },
  nudgeIconWrap: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#EEF2F7',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  nudgeIcon: { fontSize: 24 },
  nudgeTitle: {
    color: '#112D4E',
    fontSize: 20,
    fontWeight: '800',
    textAlign: 'center',
    marginBottom: 6,
  },
  nudgeBody: {
    color: '#64748B',
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
    marginBottom: 16,
  },
  nudgePrimaryBtn: {
    alignSelf: 'stretch',
    backgroundColor: '#112D4E',
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
  },
  nudgePrimaryText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '800',
    letterSpacing: 0.2,
  },
});