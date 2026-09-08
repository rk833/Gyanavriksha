import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
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

import { API_BASE_URL } from '../../config/api';

type Step = 'email' | 'reset';

type NavProp = {
  goBack?: () => void;
};

function parseApiError(error: unknown, fallback: string) {
  if (axios.isAxiosError(error)) {
    const d = error.response?.data?.detail;
    if (typeof d === 'string' && d.trim()) return d;
  }
  if (error instanceof Error && error.message.trim()) return error.message;
  return fallback;
}

export default function ForgotPasswordScreen({ navigation }: { navigation: NavProp }) {
  const [step, setStep] = useState<Step>('email');

  // Step 1 state
  const [email, setEmail] = useState('');
  const [emailLoading, setEmailLoading] = useState(false);
  const [emailError, setEmailError] = useState<string | null>(null);
  const [emailSuccess, setEmailSuccess] = useState<string | null>(null);

  // Step 2 state
  const [token, setToken] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [resetLoading, setResetLoading] = useState(false);
  const [resetError, setResetError] = useState<string | null>(null);
  const [resetSuccess, setResetSuccess] = useState(false);

  const submitEmail = useCallback(async () => {
    const trimmed = email.trim();
    if (!trimmed) {
      setEmailError('Please enter your email address.');
      return;
    }
    setEmailError(null);
    setEmailLoading(true);
    try {
      await axios.post(`${API_BASE_URL}/api/auth/forgot-password`, { email: trimmed });
      setEmailSuccess('If that email is registered, a reset link has been sent. Enter the token below.');
      setStep('reset');
    } catch (err) {
      // Backend silently succeeds even for unknown emails — still advance
      if (axios.isAxiosError(err) && err.response?.status === 422) {
        setEmailError(parseApiError(err, 'Invalid email format.'));
      } else {
        setEmailSuccess('If that email is registered, a reset link has been sent. Enter the token below.');
        setStep('reset');
      }
    } finally {
      setEmailLoading(false);
    }
  }, [email]);

  const submitReset = useCallback(async () => {
    setResetError(null);
    if (!token.trim()) {
      setResetError('Please enter the reset token from your email.');
      return;
    }
    if (newPassword.length < 8) {
      setResetError('New password must be at least 8 characters.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setResetError('Passwords do not match.');
      return;
    }
    setResetLoading(true);
    try {
      await axios.post(`${API_BASE_URL}/api/auth/reset-password`, {
        token: token.trim(),
        new_password: newPassword,
      });
      setResetSuccess(true);
    } catch (err) {
      setResetError(parseApiError(err, 'Could not reset password. The token may be invalid or expired.'));
    } finally {
      setResetLoading(false);
    }
  }, [token, newPassword, confirmPassword]);

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          {/* Back button */}
          <TouchableOpacity style={styles.backBtn} activeOpacity={0.8} onPress={() => navigation.goBack?.()}>
            <MaterialIcons name="arrow-back" size={22} color="#123A5F" />
            <Text style={styles.backText}>Back to login</Text>
          </TouchableOpacity>

          {/* Header */}
          <View style={styles.header}>
            <View style={styles.iconWrap}>
              <MaterialIcons name="lock-reset" size={36} color="#FFFFFF" />
            </View>
            <Text style={styles.title}>Reset Password</Text>
            <Text style={styles.subtitle}>
              {step === 'email'
                ? 'Enter your account email. We\'ll send a reset token.'
                : `Enter the token sent to ${email} and choose a new password.`}
            </Text>
          </View>

          {/* Step dots */}
          <View style={styles.stepRow}>
            <View style={[styles.stepDot, step === 'email' ? styles.stepDotActive : styles.stepDotDone]}>
              {step === 'email' ? <Text style={styles.stepDotText}>1</Text> : <MaterialIcons name="check" size={12} color="#FFFFFF" />}
            </View>
            <View style={[styles.stepLine, step === 'reset' && styles.stepLineDone]} />
            <View style={[styles.stepDot, step === 'reset' ? styles.stepDotActive : styles.stepDotInactive]}>
              <Text style={styles.stepDotText}>2</Text>
            </View>
          </View>

          {/* Success state */}
          {resetSuccess ? (
            <View style={styles.successCard}>
              <MaterialIcons name="check-circle" size={44} color="#15803D" />
              <Text style={styles.successTitle}>Password reset!</Text>
              <Text style={styles.successBody}>Your password has been updated. You can now log in with your new password.</Text>
              <TouchableOpacity style={styles.loginBtn} activeOpacity={0.9} onPress={() => navigation.goBack?.()}>
                <Text style={styles.loginBtnText}>Go to Login</Text>
              </TouchableOpacity>
            </View>
          ) : step === 'email' ? (
            // ── Step 1: email ──
            <View style={styles.card}>
              <Text style={styles.fieldLabel}>Email address</Text>
              <View style={styles.inputWrap}>
                <MaterialIcons name="email" size={18} color="#64748B" />
                <TextInput
                  style={styles.input}
                  placeholder="your@email.com"
                  placeholderTextColor="#94A3B8"
                  value={email}
                  onChangeText={(v) => { setEmail(v); setEmailError(null); }}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoCorrect={false}
                  returnKeyType="send"
                  onSubmitEditing={() => void submitEmail()}
                />
              </View>

              {emailError && (
                <View style={styles.errorRow}>
                  <MaterialIcons name="error-outline" size={14} color="#9F1239" />
                  <Text style={styles.errorText}>{emailError}</Text>
                </View>
              )}

              <TouchableOpacity
                style={[styles.primaryBtn, emailLoading && styles.primaryBtnDisabled]}
                activeOpacity={0.9}
                onPress={() => void submitEmail()}
                disabled={emailLoading}
              >
                {emailLoading ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <>
                    <Text style={styles.primaryBtnText}>Send Reset Token</Text>
                    <MaterialIcons name="send" size={16} color="#FFFFFF" />
                  </>
                )}
              </TouchableOpacity>

              <TouchableOpacity style={styles.secondaryBtn} onPress={() => setStep('reset')}>
                <Text style={styles.secondaryBtnText}>Already have a token? Skip</Text>
              </TouchableOpacity>
            </View>
          ) : (
            // ── Step 2: reset ──
            <View style={styles.card}>
              {emailSuccess && (
                <View style={styles.infoRow}>
                  <MaterialIcons name="info-outline" size={14} color="#1D4ED8" />
                  <Text style={styles.infoText}>{emailSuccess}</Text>
                </View>
              )}

              <Text style={styles.fieldLabel}>Reset token</Text>
              <View style={styles.inputWrap}>
                <MaterialIcons name="vpn-key" size={18} color="#64748B" />
                <TextInput
                  style={styles.input}
                  placeholder="Paste token from email"
                  placeholderTextColor="#94A3B8"
                  value={token}
                  onChangeText={(v) => { setToken(v); setResetError(null); }}
                  autoCapitalize="none"
                  autoCorrect={false}
                />
              </View>

              <Text style={[styles.fieldLabel, { marginTop: 12 }]}>New password</Text>
              <View style={styles.inputWrap}>
                <MaterialIcons name="lock" size={18} color="#64748B" />
                <TextInput
                  style={styles.input}
                  placeholder="At least 8 characters"
                  placeholderTextColor="#94A3B8"
                  value={newPassword}
                  onChangeText={(v) => { setNewPassword(v); setResetError(null); }}
                  secureTextEntry={!showPassword}
                  autoCapitalize="none"
                />
                <TouchableOpacity onPress={() => setShowPassword((s) => !s)}>
                  <MaterialIcons name={showPassword ? 'visibility-off' : 'visibility'} size={18} color="#64748B" />
                </TouchableOpacity>
              </View>

              <Text style={[styles.fieldLabel, { marginTop: 12 }]}>Confirm new password</Text>
              <View style={styles.inputWrap}>
                <MaterialIcons name="lock-outline" size={18} color="#64748B" />
                <TextInput
                  style={styles.input}
                  placeholder="Re-enter new password"
                  placeholderTextColor="#94A3B8"
                  value={confirmPassword}
                  onChangeText={(v) => { setConfirmPassword(v); setResetError(null); }}
                  secureTextEntry={!showPassword}
                  autoCapitalize="none"
                  returnKeyType="done"
                  onSubmitEditing={() => void submitReset()}
                />
              </View>

              {resetError && (
                <View style={styles.errorRow}>
                  <MaterialIcons name="error-outline" size={14} color="#9F1239" />
                  <Text style={styles.errorText}>{resetError}</Text>
                </View>
              )}

              <TouchableOpacity
                style={[styles.primaryBtn, resetLoading && styles.primaryBtnDisabled]}
                activeOpacity={0.9}
                onPress={() => void submitReset()}
                disabled={resetLoading}
              >
                {resetLoading ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <>
                    <Text style={styles.primaryBtnText}>Reset Password</Text>
                    <MaterialIcons name="lock-reset" size={16} color="#FFFFFF" />
                  </>
                )}
              </TouchableOpacity>

              <TouchableOpacity style={styles.secondaryBtn} onPress={() => setStep('email')}>
                <Text style={styles.secondaryBtnText}>← Back to email step</Text>
              </TouchableOpacity>
            </View>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#F3F1EB' },
  flex: { flex: 1 },
  scroll: { padding: 20, paddingBottom: 40, gap: 0 },
  backBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 24,
    alignSelf: 'flex-start',
  },
  backText: { color: '#123A5F', fontSize: 14, fontWeight: '700' },
  header: { alignItems: 'center', gap: 10, marginBottom: 28 },
  iconWrap: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: '#123A5F',
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: { fontSize: 26, fontWeight: '900', color: '#123A5F' },
  subtitle: { fontSize: 13, color: '#64748B', textAlign: 'center', lineHeight: 20 },
  stepRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 0,
    marginBottom: 24,
  },
  stepDot: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepDotActive: { backgroundColor: '#123A5F' },
  stepDotDone: { backgroundColor: '#15803D' },
  stepDotInactive: { backgroundColor: '#CBD5E1' },
  stepDotText: { color: '#FFFFFF', fontSize: 12, fontWeight: '800' },
  stepLine: { width: 48, height: 2, backgroundColor: '#CBD5E1' },
  stepLineDone: { backgroundColor: '#15803D' },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 20,
    borderWidth: 1,
    borderColor: '#E2D9C8',
    gap: 8,
  },
  fieldLabel: { fontSize: 12, fontWeight: '800', color: '#64748B', textTransform: 'uppercase', letterSpacing: 0.6 },
  inputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E2D9C8',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 11,
    backgroundColor: '#FAFAF7',
    gap: 10,
  },
  input: { flex: 1, fontSize: 14, color: '#0F172A' },
  errorRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 6 },
  errorText: { flex: 1, color: '#9F1239', fontSize: 12, lineHeight: 18 },
  infoRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 6, backgroundColor: '#EFF6FF', borderRadius: 10, padding: 10 },
  infoText: { flex: 1, color: '#1D4ED8', fontSize: 12, lineHeight: 18 },
  primaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#123A5F',
    borderRadius: 14,
    paddingVertical: 14,
    marginTop: 6,
  },
  primaryBtnDisabled: { opacity: 0.6 },
  primaryBtnText: { color: '#FFFFFF', fontSize: 15, fontWeight: '800' },
  secondaryBtn: { alignItems: 'center', paddingVertical: 10 },
  secondaryBtnText: { color: '#64748B', fontSize: 13, fontWeight: '600' },
  successCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 28,
    borderWidth: 1,
    borderColor: '#BBF7D0',
    alignItems: 'center',
    gap: 12,
  },
  successTitle: { fontSize: 22, fontWeight: '900', color: '#15803D' },
  successBody: { fontSize: 13, color: '#64748B', textAlign: 'center', lineHeight: 20 },
  loginBtn: {
    backgroundColor: '#123A5F',
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 36,
    marginTop: 8,
  },
  loginBtnText: { color: '#FFFFFF', fontSize: 15, fontWeight: '800' },
});
