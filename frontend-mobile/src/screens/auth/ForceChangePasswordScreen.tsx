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
import * as SecureStore from 'expo-secure-store';

import { API_BASE_URL } from '../../config/api';
import { useAppTheme } from '../../context/ThemeContext';

// ─── Password rules ────────────────────────────────────────────────────────────

const RULES = [
  { label: 'At least 8 characters', test: (v: string) => v.length >= 8 },
  { label: 'One uppercase letter', test: (v: string) => /[A-Z]/.test(v) },
  { label: 'One lowercase letter', test: (v: string) => /[a-z]/.test(v) },
  { label: 'One number', test: (v: string) => /\d/.test(v) },
];

// ─── Types ─────────────────────────────────────────────────────────────────────

type Props = {
  navigation?: {
    navigate: (screen: string, params?: Record<string, unknown>) => void;
    replace?: (screen: string) => void;
    goBack?: () => void;
  };
  route?: { params?: { token?: string } };
  onLoginSuccess?: (token: string) => void;
};

// ─── Screen ────────────────────────────────────────────────────────────────────

export default function ForceChangePasswordScreen({ navigation, route, onLoginSuccess }: Props) {
  const { theme } = useAppTheme();
  const token = route?.params?.token ?? '';

  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const passed = RULES.filter((r) => r.test(newPassword)).length;
  const strengthColors = ['#EF4444', '#F97316', '#EAB308', '#22C55E'];
  const strengthColor = passed > 0 ? strengthColors[passed - 1] : theme.colors.border;

  const handleSubmit = useCallback(async () => {
    setError(null);
    if (passed < 4) { setError('Password does not meet all requirements.'); return; }
    if (newPassword !== confirmPassword) { setError('Passwords do not match.'); return; }

    setLoading(true);
    try {
      await axios.post(
        `${API_BASE_URL}/api/auth/force-change-password`,
        { new_password: newPassword },
        { headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' } },
      );
      // Clear tokens — user must log in again with new password
      await SecureStore.deleteItemAsync('access_token');
      await SecureStore.deleteItemAsync('auth_token');
      await SecureStore.deleteItemAsync('refresh_token');
      // Navigate back to login
      navigation?.replace?.('LoginScreen');
      if (!navigation?.replace) navigation?.navigate('LoginScreen');
    } catch (err) {
      const detail = axios.isAxiosError(err) ? err.response?.data?.detail : null;
      setError(typeof detail === 'string' ? detail : 'Could not update password. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [newPassword, confirmPassword, passed, token, navigation]);

  return (
    <SafeAreaView style={[s.safe, { backgroundColor: theme.colors.screen }]} edges={['top', 'left', 'right']}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={s.scroll} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>

          {/* Hero */}
          <View style={[s.hero, { backgroundColor: theme.colors.primary }]}>
            <View style={s.heroIconWrap}>
              <MaterialIcons name="lock-reset" size={32} color="#FFFFFF" />
            </View>
            <Text style={s.heroTitle}>Set your new password</Text>
            <Text style={s.heroSub}>
              Your account was created by an administrator. Choose a personal password to keep your account secure.
            </Text>
          </View>

          <View style={[s.card, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>

            {/* New password */}
            <View style={s.fieldWrap}>
              <Text style={[s.label, { color: theme.colors.muted }]}>NEW PASSWORD</Text>
              <View style={[s.inputRow, { borderColor: theme.colors.border, backgroundColor: theme.colors.screen }]}>
                <MaterialIcons name="lock-outline" size={18} color={theme.colors.muted} style={s.inputIcon} />
                <TextInput
                  style={[s.input, { color: theme.colors.text }]}
                  placeholder="Choose a strong password"
                  placeholderTextColor={theme.colors.muted}
                  secureTextEntry={!showNew}
                  value={newPassword}
                  onChangeText={(v) => { setNewPassword(v); setError(null); }}
                  autoCapitalize="none"
                  autoCorrect={false}
                />
                <TouchableOpacity onPress={() => setShowNew((p) => !p)} style={s.eyeBtn}>
                  <MaterialIcons name={showNew ? 'visibility-off' : 'visibility'} size={18} color={theme.colors.muted} />
                </TouchableOpacity>
              </View>

              {/* Strength bar */}
              {newPassword.length > 0 && (
                <View style={s.strengthWrap}>
                  <View style={s.strengthBar}>
                    {[0, 1, 2, 3].map((i) => (
                      <View
                        key={i}
                        style={[s.strengthSegment, { backgroundColor: i < passed ? strengthColor : theme.colors.border }]}
                      />
                    ))}
                  </View>
                  <View style={s.rulesGrid}>
                    {RULES.map((r) => (
                      <View key={r.label} style={s.ruleRow}>
                        <MaterialIcons
                          name={r.test(newPassword) ? 'check-circle' : 'radio-button-unchecked'}
                          size={13}
                          color={r.test(newPassword) ? '#22C55E' : theme.colors.muted}
                        />
                        <Text style={[s.ruleText, { color: r.test(newPassword) ? '#15803D' : theme.colors.muted }]}>
                          {r.label}
                        </Text>
                      </View>
                    ))}
                  </View>
                </View>
              )}
            </View>

            {/* Confirm password */}
            <View style={s.fieldWrap}>
              <Text style={[s.label, { color: theme.colors.muted }]}>CONFIRM PASSWORD</Text>
              <View style={[
                s.inputRow,
                {
                  borderColor: confirmPassword && confirmPassword !== newPassword ? '#EF4444' : theme.colors.border,
                  backgroundColor: theme.colors.screen,
                },
              ]}>
                <MaterialIcons name="lock-outline" size={18} color={theme.colors.muted} style={s.inputIcon} />
                <TextInput
                  style={[s.input, { color: theme.colors.text }]}
                  placeholder="Repeat your new password"
                  placeholderTextColor={theme.colors.muted}
                  secureTextEntry={!showConfirm}
                  value={confirmPassword}
                  onChangeText={(v) => { setConfirmPassword(v); setError(null); }}
                  autoCapitalize="none"
                  autoCorrect={false}
                />
                <TouchableOpacity onPress={() => setShowConfirm((p) => !p)} style={s.eyeBtn}>
                  <MaterialIcons name={showConfirm ? 'visibility-off' : 'visibility'} size={18} color={theme.colors.muted} />
                </TouchableOpacity>
              </View>
              {confirmPassword.length > 0 && confirmPassword !== newPassword && (
                <Text style={s.matchError}>Passwords do not match</Text>
              )}
            </View>

            {/* Error banner */}
            {error && (
              <View style={s.errorBanner}>
                <MaterialIcons name="error-outline" size={16} color="#9F1239" />
                <Text style={s.errorText}>{error}</Text>
              </View>
            )}

            {/* Submit */}
            <TouchableOpacity
              style={[s.submitBtn, { backgroundColor: theme.colors.primary, opacity: loading || passed < 4 || !confirmPassword ? 0.6 : 1 }]}
              onPress={() => void handleSubmit()}
              disabled={loading || passed < 4 || !confirmPassword}
              activeOpacity={0.85}
            >
              {loading ? (
                <ActivityIndicator color="#FFFFFF" size="small" />
              ) : (
                <>
                  <Text style={s.submitText}>Set Password</Text>
                  <MaterialIcons name="arrow-forward" size={18} color="#FFFFFF" />
                </>
              )}
            </TouchableOpacity>

            <Text style={[s.hint, { color: theme.colors.muted }]}>
              After setting your password you will be redirected to sign in again.
            </Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

// ─── Styles ────────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  safe: { flex: 1 },
  scroll: { flexGrow: 1 },
  hero: {
    paddingHorizontal: 24,
    paddingTop: 48,
    paddingBottom: 36,
    alignItems: 'center',
  },
  heroIconWrap: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: 'rgba(255,255,255,0.18)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  heroTitle: { fontSize: 22, fontWeight: '800', color: '#FFFFFF', textAlign: 'center' },
  heroSub: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.82)',
    textAlign: 'center',
    marginTop: 8,
    lineHeight: 19,
    paddingHorizontal: 8,
  },
  card: {
    margin: 16,
    borderRadius: 20,
    borderWidth: 1,
    padding: 20,
    gap: 16,
    marginBottom: 32,
  },
  fieldWrap: { gap: 6 },
  label: { fontSize: 10, fontWeight: '800', letterSpacing: 0.8 },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    height: 48,
  },
  inputIcon: { marginRight: 8 },
  input: { flex: 1, fontSize: 14, paddingVertical: 0 },
  eyeBtn: { padding: 4 },
  strengthWrap: { gap: 8, marginTop: 4 },
  strengthBar: { flexDirection: 'row', gap: 4, height: 5 },
  strengthSegment: { flex: 1, borderRadius: 3 },
  rulesGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  ruleRow: { flexDirection: 'row', alignItems: 'center', gap: 4, width: '48%' },
  ruleText: { fontSize: 11, flexShrink: 1 },
  matchError: { fontSize: 11, color: '#EF4444', marginTop: 2 },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    backgroundColor: '#FFF1F2',
    borderWidth: 1,
    borderColor: '#FECACA',
    borderRadius: 10,
    padding: 12,
  },
  errorText: { flex: 1, fontSize: 12, color: '#9F1239', lineHeight: 17 },
  submitBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderRadius: 14,
    paddingVertical: 14,
  },
  submitText: { fontSize: 15, fontWeight: '800', color: '#FFFFFF' },
  hint: { fontSize: 11, textAlign: 'center', lineHeight: 16 },
});
