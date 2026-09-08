import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import axios from 'axios';
import * as SecureStore from 'expo-secure-store';
import { API_BASE_URL } from '../../config/api';
import {
  clearTwoFactorTrustForEmail,
  saveTwoFactorTrustToken,
  setLastLoginEmail,
} from '../../utils/twoFactorTrust';

const OTP_LENGTH = 6;

const COLORS = {
  headerBg: '#0D2137',
  headerAccent: '#3F72AF',
  screen: '#EEF2F7',
  card: '#FFFFFF',
  text: '#112D4E',
  muted: '#64748B',
  border: '#E2E8F0',
  error: '#DC2626',
  chipBg: '#F1F5F9',
};

type TwoFactorMethod = 'totp' | 'email';

type TwoFactorScreenProps = {
  navigation?: {
    navigate: (screenName: string, params?: Record<string, unknown>) => void;
    goBack?: () => void;
  };
  onLoginSuccess?: (token: string) => void;
  route?: {
    params?: {
      user_id?: string;
      two_factor_methods?: TwoFactorMethod[];
      login_email?: string;
    };
  };
};

type Validate2faResponse = {
  access_token: string;
  refresh_token: string;
  token_type: 'bearer';
  expires_in: number;
  trusted_device_token?: string | null;
};

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export default function TwoFactorScreen({ navigation, route, onLoginSuccess }: TwoFactorScreenProps) {
  const [otpDigits, setOtpDigits] = useState<string[]>(Array(OTP_LENGTH).fill(''));
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorText, setErrorText] = useState<string | null>(null);

  const inputRefs = useRef<Array<TextInput | null>>([]);
  const userId = route?.params?.user_id;
  const loginEmail = route?.params?.login_email;
  const methodsFromRoute = route?.params?.two_factor_methods;
  const availableMethods = useMemo((): TwoFactorMethod[] => {
    if (Array.isArray(methodsFromRoute) && methodsFromRoute.length > 0) {
      return methodsFromRoute as TwoFactorMethod[];
    }
    return ['totp'];
  }, [methodsFromRoute]);

  const [verifyMethod, setVerifyMethod] = useState<TwoFactorMethod>(() =>
    availableMethods.includes('totp') ? 'totp' : 'email'
  );
  const [emailSendBusy, setEmailSendBusy] = useState(false);
  const [rememberDevice, setRememberDevice] = useState(false);
  const [twoFactorNudgeToken, setTwoFactorNudgeToken] = useState<string | null>(null);

  useEffect(() => {
    setVerifyMethod(availableMethods.includes('totp') ? 'totp' : 'email');
  }, [availableMethods]);

  const clearOtpInputs = () => {
    setOtpDigits(Array(OTP_LENGTH).fill(''));
    inputRefs.current[0]?.focus();
  };

  useEffect(() => {
    if (!userId || !UUID_REGEX.test(userId)) {
      setErrorText('2FA session is missing. Please login again.');
    }
  }, [userId]);

  const sendEmailCode = async () => {
    if (!userId || !UUID_REGEX.test(userId)) return;
    setEmailSendBusy(true);
    setErrorText(null);
    try {
      await axios.post(`${API_BASE_URL}/api/auth/2fa/email/send`, { user_id: userId });
    } catch {
      setErrorText('Could not send email code.');
    } finally {
      setEmailSendBusy(false);
    }
  };

  const verifyCode = async (code: string) => {
    if (!userId || !UUID_REGEX.test(userId) || isSubmitting || !/^\d{6}$/.test(code)) {
      return;
    }

    setIsSubmitting(true);
    setErrorText(null);

    try {
      const response = await axios.post<Validate2faResponse>(`${API_BASE_URL}/api/auth/2fa/validate`, {
        user_id: userId,
        code,
        method: verifyMethod,
        remember_device: rememberDevice,
      });

      const emailTrimmed =
        typeof loginEmail === 'string' && loginEmail.trim().length > 0 ? loginEmail.trim() : '';
      if (rememberDevice && response.data.trusted_device_token && emailTrimmed) {
        await saveTwoFactorTrustToken(emailTrimmed, response.data.trusted_device_token);
      } else if (!rememberDevice && emailTrimmed) {
        await clearTwoFactorTrustForEmail(emailTrimmed);
      }
      if (emailTrimmed) {
        await setLastLoginEmail(emailTrimmed);
      }

      await SecureStore.setItemAsync('access_token', response.data.access_token);
      await SecureStore.setItemAsync('auth_token', response.data.access_token);
      await SecureStore.setItemAsync('refresh_token', response.data.refresh_token);

      // Check for forced password change (admin-created accounts)
      try {
        const meRes = await axios.get(`${API_BASE_URL}/api/auth/me`, {
          headers: { Authorization: `Bearer ${response.data.access_token}` },
        });
        if (meRes.data?.must_change_password === true) {
          navigation?.navigate('ForceChangePasswordScreen', { token: response.data.access_token });
          return;
        }
        const has2fa = meRes.data?.totp_enabled === true || meRes.data?.email_2fa_enabled === true;
        if (!has2fa) {
          setTwoFactorNudgeToken(response.data.access_token);
          return;
        }
      } catch {
        // If /me fails, proceed normally
      }

      onLoginSuccess?.(response.data.access_token);
    } catch (error) {
      const status = axios.isAxiosError(error) ? error.response?.status : null;
      if (status === 401 || status === 422) {
        clearOtpInputs();
        setErrorText('Invalid code — try again');
      } else {
        setErrorText('Unable to verify right now.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDigitChange = (index: number, rawValue: string) => {
    const nextDigit = rawValue.replace(/\D/g, '').slice(-1);

    if (!nextDigit && rawValue !== '') {
      return;
    }

    const nextDigits = [...otpDigits];
    nextDigits[index] = nextDigit;
    setOtpDigits(nextDigits);
    setErrorText(null);

    if (nextDigit && index < OTP_LENGTH - 1) {
      inputRefs.current[index + 1]?.focus();
    }

    const assembled = nextDigits.join('');
    if (index === OTP_LENGTH - 1 && assembled.length === OTP_LENGTH && !nextDigits.includes('')) {
      void verifyCode(assembled);
    }
  };

  const handleKeyPress = (index: number, key: string) => {
    if (key !== 'Backspace') {
      return;
    }

    if (otpDigits[index]) {
      const nextDigits = [...otpDigits];
      nextDigits[index] = '';
      setOtpDigits(nextDigits);
      return;
    }

    if (index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const showTotp = availableMethods.includes('totp');
  const showEmail = availableMethods.includes('email');

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.header}>
            <View style={styles.headerGlow} />
            <TouchableOpacity
              style={styles.backButton}
              onPress={() => navigation?.goBack?.()}
              hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
              activeOpacity={0.7}
            >
              <MaterialIcons
                name={Platform.OS === 'ios' ? 'arrow-back-ios' : 'arrow-back'}
                size={Platform.OS === 'ios' ? 18 : 22}
                color="rgba(255,255,255,0.95)"
              />
              <Text style={styles.backButtonLabel}>Back</Text>
            </TouchableOpacity>

            <View style={styles.headerIconWrap}>
              <MaterialIcons name="verified-user" size={36} color={COLORS.headerAccent} />
            </View>
            <Text style={styles.headerTitle}>Verify it&apos;s you</Text>
            <Text style={styles.headerSubtitle}>
              {verifyMethod === 'email'
                ? 'Use a one-time code from your email to finish signing in.'
                : 'Enter the code from your authenticator app.'}
            </Text>

            {loginEmail ? (
              <View style={styles.emailPill}>
                <MaterialIcons name="alternate-email" size={16} color="rgba(255,255,255,0.85)" />
                <Text style={styles.emailPillText} numberOfLines={1}>
                  {loginEmail}
                </Text>
              </View>
            ) : null}
          </View>

          <View style={styles.card}>
            {showTotp && showEmail ? (
              <View style={styles.methodToggle}>
                <Pressable
                  style={({ pressed }) => [
                    styles.methodChip,
                    verifyMethod === 'totp' && styles.methodChipActive,
                    pressed && styles.methodChipPressed,
                  ]}
                  onPress={() => {
                    setVerifyMethod('totp');
                    clearOtpInputs();
                    setErrorText(null);
                  }}
                >
                  <MaterialIcons
                    name="smartphone"
                    size={20}
                    color={verifyMethod === 'totp' ? COLORS.headerAccent : COLORS.muted}
                  />
                  <Text style={[styles.methodChipText, verifyMethod === 'totp' && styles.methodChipTextActive]}>
                    Authenticator
                  </Text>
                </Pressable>
                <Pressable
                  style={({ pressed }) => [
                    styles.methodChip,
                    verifyMethod === 'email' && styles.methodChipActive,
                    pressed && styles.methodChipPressed,
                  ]}
                  onPress={() => {
                    setVerifyMethod('email');
                    clearOtpInputs();
                    setErrorText(null);
                  }}
                >
                  <MaterialIcons
                    name="mail-outline"
                    size={20}
                    color={verifyMethod === 'email' ? COLORS.headerAccent : COLORS.muted}
                  />
                  <Text style={[styles.methodChipText, verifyMethod === 'email' && styles.methodChipTextActive]}>
                    Email
                  </Text>
                </Pressable>
              </View>
            ) : null}

            {verifyMethod === 'email' ? (
              <TouchableOpacity
                style={[styles.emailSendBtn, emailSendBusy && styles.emailSendBtnDisabled]}
                onPress={() => void sendEmailCode()}
                disabled={emailSendBusy}
                activeOpacity={0.88}
              >
                {emailSendBusy ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <>
                    <MaterialIcons name="send" size={20} color="#FFFFFF" style={styles.emailSendIcon} />
                    <Text style={styles.emailSendBtnText}>Send code to email</Text>
                  </>
                )}
              </TouchableOpacity>
            ) : (
              <View style={styles.hintBox}>
                <MaterialIcons name="info-outline" size={18} color={COLORS.headerAccent} />
                <Text style={styles.hintText}>
                  Open Google Authenticator, Authy, or Microsoft Authenticator and enter the 6-digit code.
                </Text>
              </View>
            )}

            <Text style={styles.otpLabel}>Enter code</Text>
            <View style={styles.otpRow}>
              {otpDigits.map((digit, index) => {
                const filled = digit !== '';
                return (
                  <TextInput
                    key={index}
                    ref={(ref) => {
                      inputRefs.current[index] = ref;
                    }}
                    style={[
                      styles.otpInput,
                      filled && styles.otpInputFilled,
                      verifyMethod === 'email' && styles.otpInputEmailMode,
                      errorText && styles.otpInputError,
                    ]}
                    value={digit}
                    onChangeText={(value) => handleDigitChange(index, value)}
                    onKeyPress={({ nativeEvent }) => handleKeyPress(index, nativeEvent.key)}
                    keyboardType="number-pad"
                    maxLength={1}
                    textAlign="center"
                    autoFocus={index === 0}
                    editable={!isSubmitting}
                    selectTextOnFocus
                  />
                );
              })}
            </View>

            {errorText ? (
              <View style={styles.errorBanner}>
                <MaterialIcons name="error-outline" size={18} color={COLORS.error} />
                <Text style={styles.errorText}>{errorText}</Text>
              </View>
            ) : null}

            {isSubmitting ? (
              <View style={styles.submittingRow}>
                <ActivityIndicator color={COLORS.headerAccent} />
                <Text style={styles.submittingText}>Verifying…</Text>
              </View>
            ) : null}

            <View style={styles.trustCard}>
              <View style={styles.trustCardInner}>
                <Switch
                  value={rememberDevice}
                  onValueChange={setRememberDevice}
                  trackColor={{ false: '#CBD5E1', true: 'rgba(63, 114, 175, 0.45)' }}
                  thumbColor={rememberDevice ? COLORS.headerBg : '#F8FAFC'}
                  ios_backgroundColor="#CBD5E1"
                />
                <View style={styles.trustTextWrap}>
                  <Text style={styles.trustTitle}>Trust this device</Text>
                  <Text style={styles.trustLabel}>
                    Skip the second step for <Text style={styles.trustLabelEm}>3 days</Text> on this phone only.
                  </Text>
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
            <Text style={styles.nudgeTitle}>Boost your security</Text>
            <Text style={styles.nudgeBody}>
              You can enable Two-Factor Auth from Profile {'>'} Two-Factor Auth after login.
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
    backgroundColor: COLORS.headerBg,
  },
  flex: {
    flex: 1,
    backgroundColor: COLORS.screen,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingBottom: 32,
  },
  header: {
    backgroundColor: COLORS.headerBg,
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 28,
    borderBottomLeftRadius: 28,
    borderBottomRightRadius: 28,
    overflow: 'hidden',
  },
  headerGlow: {
    position: 'absolute',
    width: 220,
    height: 220,
    borderRadius: 110,
    backgroundColor: COLORS.headerAccent,
    opacity: 0.12,
    right: -60,
    top: -80,
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    marginBottom: 20,
    paddingVertical: 6,
    paddingRight: 12,
  },
  backButtonLabel: {
    color: 'rgba(255,255,255,0.95)',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 2,
  },
  headerIconWrap: {
    width: 72,
    height: 72,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.08)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
  },
  headerTitle: {
    color: '#FFFFFF',
    fontSize: 28,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  headerSubtitle: {
    marginTop: 8,
    color: 'rgba(255,255,255,0.75)',
    fontSize: 15,
    lineHeight: 22,
    maxWidth: '100%',
  },
  emailPill: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 8,
    marginTop: 14,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.1)',
    maxWidth: '100%',
  },
  emailPillText: {
    flex: 1,
    color: 'rgba(255,255,255,0.92)',
    fontSize: 13,
    fontWeight: '600',
  },
  card: {
    marginTop: -18,
    marginHorizontal: 16,
    backgroundColor: COLORS.card,
    borderRadius: 22,
    padding: 20,
    shadowColor: '#0D2137',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.12,
    shadowRadius: 20,
    elevation: 8,
    borderWidth: 1,
    borderColor: 'rgba(226, 232, 240, 0.9)',
  },
  methodToggle: {
    flexDirection: 'row',
    backgroundColor: COLORS.chipBg,
    borderRadius: 16,
    padding: 5,
    marginBottom: 18,
    gap: 6,
  },
  methodChip: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    borderRadius: 12,
  },
  methodChipActive: {
    backgroundColor: COLORS.card,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 2,
  },
  methodChipPressed: {
    opacity: 0.92,
  },
  methodChipText: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.muted,
  },
  methodChipTextActive: {
    color: COLORS.text,
  },
  emailSendBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.headerBg,
    borderRadius: 16,
    paddingVertical: 16,
    marginBottom: 18,
    gap: 8,
  },
  emailSendBtnDisabled: {
    opacity: 0.8,
  },
  emailSendIcon: {
    marginRight: 2,
  },
  emailSendBtnText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
  hintBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    backgroundColor: 'rgba(63, 114, 175, 0.08)',
    borderRadius: 14,
    padding: 14,
    marginBottom: 18,
    borderWidth: 1,
    borderColor: 'rgba(63, 114, 175, 0.2)',
  },
  hintText: {
    flex: 1,
    color: COLORS.muted,
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '500',
  },
  otpLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.muted,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 10,
  },
  otpRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 8,
  },
  otpInput: {
    flex: 1,
    minWidth: 0,
    height: 54,
    borderRadius: 14,
    borderWidth: 2,
    borderColor: COLORS.border,
    backgroundColor: COLORS.chipBg,
    color: COLORS.text,
    fontSize: 22,
    fontWeight: '800',
  },
  otpInputFilled: {
    borderColor: COLORS.headerAccent,
    backgroundColor: COLORS.card,
  },
  otpInputEmailMode: {
    borderColor: 'rgba(63, 114, 175, 0.35)',
  },
  otpInputError: {
    borderColor: 'rgba(220, 38, 38, 0.45)',
  },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 14,
    padding: 12,
    borderRadius: 12,
    backgroundColor: 'rgba(220, 38, 38, 0.08)',
  },
  errorText: {
    flex: 1,
    color: COLORS.error,
    fontSize: 14,
    fontWeight: '600',
  },
  submittingRow: {
    marginTop: 14,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 10,
  },
  submittingText: {
    color: COLORS.text,
    fontSize: 14,
    fontWeight: '600',
  },
  trustCard: {
    marginTop: 22,
    borderRadius: 16,
    backgroundColor: COLORS.chipBg,
    borderWidth: 1,
    borderColor: COLORS.border,
    overflow: 'hidden',
  },
  trustCardInner: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 14,
    gap: 14,
  },
  trustTextWrap: {
    flex: 1,
  },
  trustTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: COLORS.text,
    marginBottom: 4,
  },
  trustLabel: {
    color: COLORS.muted,
    fontSize: 13,
    lineHeight: 19,
    fontWeight: '500',
  },
  trustLabelEm: {
    color: COLORS.text,
    fontWeight: '800',
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
