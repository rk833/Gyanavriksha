import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  SectionList,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { MaterialIcons } from '@expo/vector-icons';
import Constants from 'expo-constants';
import axios from 'axios';
import { useApi } from '../../hooks/useApi';
import { ThemePalette, useAppTheme } from '../../context/ThemeContext';

type UserResponse = {
  user_id: string;
  email: string;
  full_name: string;
  role: string;
  is_active: boolean;
  is_email_verified: boolean;
  totp_enabled: boolean;
  profile_image_url: string | null;
  created_at: string;
  notification_preferences?: Record<string, unknown> | null;
};

type ProfileStackProps = {
  onLogout: () => void | Promise<void>;
  onOpenHomeNotifications: () => void;
};

type ProfileNavigation = {
  navigate: (screenName: string, params?: Record<string, unknown>) => void;
  goBack?: () => void;
  getParent?: () => ProfileNavigation | null;
};

type ScreenProps = {
  navigation: ProfileNavigation;
  onLogout?: () => void | Promise<void>;
  onOpenHomeNotifications?: () => void;
};

const Stack = createNativeStackNavigator();

function getInitials(fullName: string) {
  const trimmed = fullName.trim();
  if (!trimmed) {
    return 'GV';
  }

  const parts = trimmed.split(/\s+/).filter(Boolean);
  const first = parts[0]?.[0] ?? 'G';
  const second = parts.length > 1 ? parts[parts.length - 1]?.[0] ?? '' : parts[0]?.[1] ?? '';
  return `${first}${second}`.toUpperCase();
}

function appVersion() {
  return Constants.expoConfig?.version ?? Constants.nativeAppVersion ?? Constants.manifest2?.version ?? '1.0.0';
}

function parseApiMessage(error: unknown, fallback: string) {
  if (axios.isAxiosError(error)) {
    const detail = error.response?.data?.detail;
    if (typeof detail === 'string' && detail.trim().length > 0) {
      return detail;
    }
  }

  if (error instanceof Error && error.message.trim().length > 0) {
    return error.message;
  }

  return fallback;
}

function useStudentProfile() {
  const { request } = useApi();
  const [profile, setProfile] = useState<UserResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadProfile = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await request<UserResponse>('get', '/api/students/profile');
      setProfile(response);
    } catch (fetchError) {
      setError(parseApiMessage(fetchError, 'Unable to load your profile right now.'));
    } finally {
      setIsLoading(false);
    }
  }, [request]);

  useEffect(() => {
    void loadProfile();
  }, [loadProfile]);

  return { profile, isLoading, error, reload: loadProfile };
}

function getThemeLabel(themeKey: string) {
  switch (themeKey) {
    case 'ocean':
      return 'Ocean';
    case 'midnight':
      return 'Midnight';
    case 'slate':
      return 'Slate';
    case 'dark':
      return 'Dark';
    default:
      return 'Classic';
  }
}

function Shell({
  navigation,
  title,
  initials,
  onOpenHomeNotifications,
  children,
}: {
  navigation: ProfileNavigation;
  title: string;
  initials: string;
  onOpenHomeNotifications?: () => void;
  children: React.ReactNode;
}) {
  const { theme } = useAppTheme();
  const parentNavigation = navigation.getParent?.() ?? navigation;

  const goToTab = useCallback(
    (screenName: string, params?: Record<string, unknown>) => {
      parentNavigation.navigate(screenName, params);
    },
    [parentNavigation]
  );

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: theme.colors.screen }]}>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={[styles.frame, { backgroundColor: theme.colors.screen }]}>
          <View style={[styles.topBar, { backgroundColor: theme.colors.surface, borderBottomColor: theme.colors.headerBorder }]}>
            <View style={[styles.avatarSmall, { backgroundColor: theme.colors.primarySoft }]}>
              <Text style={[styles.avatarSmallText, { color: theme.colors.primary }]}>{initials}</Text>
            </View>
            <Text style={[styles.topTitle, { color: theme.colors.primary }]}>{title}</Text>
            <TouchableOpacity
              style={[styles.topBellButton, { backgroundColor: theme.colors.primarySoft }]}
              activeOpacity={0.8}
              onPress={() => {
                if (onOpenHomeNotifications) {
                  onOpenHomeNotifications();
                  return;
                }

                goToTab('Home');
              }}
            >
              <MaterialIcons name="notifications-none" size={20} color={theme.colors.primary} />
            </TouchableOpacity>
          </View>

          <View style={styles.contentArea}>{children}</View>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function SectionCard({ children }: { children: React.ReactNode }) {
  const { theme } = useAppTheme();

  return <View style={[styles.card, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border, shadowColor: theme.colors.shadow }]}>{children}</View>;
}

function Row({
  icon,
  label,
  value,
  description,
  badge,
  badgeTone = 'blue',
  destructive,
  onPress,
}: {
  icon: keyof typeof MaterialIcons.glyphMap;
  label: string;
  value?: string;
  description?: string;
  badge?: string;
  badgeTone?: 'blue' | 'green' | 'amber';
  destructive?: boolean;
  onPress?: () => void;
}) {
  const { theme } = useAppTheme();

  const content = (
    <View style={styles.rowInner}>
      <View style={styles.rowLeft}>
        <MaterialIcons name={icon} size={20} color={destructive ? '#EF5350' : theme.colors.muted} />
        <View style={styles.rowTextBlock}>
          <Text style={[styles.rowLabel, destructive ? styles.rowLabelDestructive : null, { color: destructive ? '#EF5350' : theme.colors.primary }]}>{label}</Text>
          {description ? <Text style={[styles.rowDescription, { color: theme.colors.muted }]}>{description}</Text> : null}
        </View>
      </View>
      <View style={styles.rowRight}>
        {value ? <Text style={[styles.rowValue, { color: theme.colors.muted }]}>{value}</Text> : null}
        {badge ? (
          <View style={[styles.badge, styles[`badge_${badgeTone}`]]}>
            <Text style={[styles.badgeText, styles[`badgeText_${badgeTone}`]]}>{badge}</Text>
          </View>
        ) : null}
        {onPress ? <MaterialIcons name="chevron-right" size={22} color={theme.colors.inactive} /> : null}
      </View>
    </View>
  );

  if (!onPress) {
    return <View style={[styles.row, { borderTopColor: theme.colors.border }]}>{content}</View>;
  }

  return (
    <Pressable style={[styles.row, { borderTopColor: theme.colors.border }]} onPress={onPress}>
      {content}
    </Pressable>
  );
}

function ToggleRow({
  icon,
  label,
  enabled,
  onToggle,
}: {
  icon: keyof typeof MaterialIcons.glyphMap;
  label: string;
  enabled: boolean;
  onToggle: () => void;
}) {
  const { theme } = useAppTheme();

  return (
    <Pressable style={[styles.row, { borderTopColor: theme.colors.border }]} onPress={onToggle}>
      <View style={styles.rowInner}>
        <View style={styles.rowLeft}>
          <MaterialIcons name={icon} size={20} color={theme.colors.muted} />
          <Text style={[styles.rowLabel, { color: theme.colors.primary }]}>{label}</Text>
        </View>
        <View style={[styles.toggle, enabled ? styles.toggleOn : styles.toggleOff, enabled ? { backgroundColor: theme.colors.primary } : null]}>
          <View style={styles.toggleThumb} />
        </View>
      </View>
    </Pressable>
  );
}

function ProfileHomeScreen({ navigation, onLogout, onOpenHomeNotifications }: ScreenProps) {
  const { theme, themeKey } = useAppTheme();
  const { request, patch } = useApi();
  const { profile, isLoading, error, reload } = useStudentProfile();
  const [connectedDevicesSummary, setConnectedDevicesSummary] = useState('Checking...');
  const [gradingAlertsEnabled, setGradingAlertsEnabled] = useState(true);
  const [quizRemindersEnabled, setQuizRemindersEnabled] = useState(true);
  const [postureConnectionEnabled, setPostureConnectionEnabled] = useState(false);

  useEffect(() => {
    let active = true;

    const loadConnectedDevices = async () => {
      try {
        const response = await request<Record<string, unknown>>('get', '/api/students/iot/status');

        if (!active) {
          return;
        }

        const devices = (response.devices as unknown[] | undefined) ?? [];
        const count = (response.device_count as number | undefined) ?? devices.length;
        setConnectedDevicesSummary(count > 0 ? `${count} connected` : 'No devices connected');
      } catch {
        if (active) {
          setConnectedDevicesSummary('Not available yet');
        }
      }
    };

    void loadConnectedDevices();

    return () => {
      active = false;
    };
  }, [request]);

  useEffect(() => {
    const p = profile?.notification_preferences;
    if (!p || typeof p !== 'object') return;
    setGradingAlertsEnabled(p.grading_updates !== false);
    setQuizRemindersEnabled(p.quiz_reminders !== false);
    setPostureConnectionEnabled(p.posture_connection === true);
  }, [profile?.notification_preferences, profile?.user_id]);

  const pushNotificationPreferences = useCallback(
    async (updates: Partial<{ grading_updates: boolean; quiz_reminders: boolean; posture_connection: boolean }>) => {
      const merged = {
        grading_updates: updates.grading_updates ?? gradingAlertsEnabled,
        quiz_reminders: updates.quiz_reminders ?? quizRemindersEnabled,
        posture_connection: updates.posture_connection ?? postureConnectionEnabled,
      };
      setGradingAlertsEnabled(merged.grading_updates);
      setQuizRemindersEnabled(merged.quiz_reminders);
      setPostureConnectionEnabled(merged.posture_connection);
      try {
        await patch<UserResponse>('/api/students/profile', { notification_preferences: merged });
      } catch (err) {
        Alert.alert('Could not save', parseApiMessage(err, 'Failed to update notification preferences.'));
        await reload();
      }
    },
    [gradingAlertsEnabled, quizRemindersEnabled, postureConnectionEnabled, patch, reload]
  );

  const initials = getInitials(profile?.full_name ?? 'Student');
  const totpEnabled = profile?.totp_enabled ?? false;

  const sections = useMemo(
    () => [
      { key: 'account', title: 'Account', data: [{ id: 'account-row' }] },
      { key: 'learning', title: 'Learning & Analytics', data: [{ id: 'learning-row' }] },
      { key: 'notifications', title: 'Notification Preferences', data: [{ id: 'notifications-row' }] },
      { key: 'iot', title: 'IoT & Smart Desk', data: [{ id: 'iot-row' }] },
      { key: 'appearance', title: 'Appearance', data: [{ id: 'appearance-row' }] },
      { key: 'support', title: 'Support', data: [{ id: 'support-row' }] },
    ],
    []
  );

  return (
    <Shell navigation={navigation} title="Profile" initials={initials} onOpenHomeNotifications={onOpenHomeNotifications}>
      <SectionList
        sections={sections}
        keyExtractor={(item) => item.id}
        stickySectionHeadersEnabled={false}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        renderSectionHeader={({ section }) => <Text style={[styles.sectionLabel, { color: theme.colors.muted }]}>{section.title}</Text>}
        renderItem={({ section }) => {
          if (section.key === 'account') {
            return (
              <SectionCard>
                <View style={styles.profileRow}>
                  <View style={[styles.avatarLarge, { backgroundColor: theme.colors.primary }]}>
                    <Text style={styles.avatarLargeText}>{initials}</Text>
                  </View>
                  <View style={styles.profileMeta}>
                    <Text style={[styles.profileLabel, { color: theme.colors.primary }]}>{isLoading ? 'Loading...' : profile?.full_name ?? 'Student'}</Text>
                    <Text style={[styles.profileSubtext, { color: theme.colors.muted }]}>{profile?.email ?? 'Loading email...'}</Text>
                    <View style={styles.badgeRow}>
                      <View style={[styles.statusBadge, totpEnabled ? styles.statusBadgeOn : styles.statusBadgeOff]}>
                        <Text style={[styles.statusBadgeText, totpEnabled ? styles.statusBadgeTextOn : styles.statusBadgeTextOff]}>
                          {totpEnabled ? '2FA enabled' : '2FA disabled'}
                        </Text>
                      </View>
                      {profile?.role ? (
                        <View style={[styles.roleBadge, { backgroundColor: theme.colors.primarySoft }]}>
                          <Text style={[styles.roleBadgeText, { color: theme.colors.primary }]}>{profile.role}</Text>
                        </View>
                      ) : null}
                    </View>
                  </View>
                </View>
                {error ? <Text style={styles.errorText}>{error}</Text> : null}
                <Row icon="lock" label="Change Password" description="Update your account password" onPress={() => navigation.navigate('ChangePassword')} />
                <Row icon="shield" label="Two-Factor Authentication" description="Enable or disable 2FA" value={totpEnabled ? 'Enabled' : 'Disabled'} onPress={() => navigation.navigate('TwoFactorSettings')} />
              </SectionCard>
            );
          }

          if (section.key === 'notifications') {
            return (
              <SectionCard>
                <ToggleRow
                  icon="notifications"
                  label="Grading Alerts"
                  enabled={gradingAlertsEnabled}
                  onToggle={() => void pushNotificationPreferences({ grading_updates: !gradingAlertsEnabled })}
                />
                <ToggleRow
                  icon="quiz"
                  label="Quiz Reminders"
                  enabled={quizRemindersEnabled}
                  onToggle={() => void pushNotificationPreferences({ quiz_reminders: !quizRemindersEnabled })}
                />
                <ToggleRow
                  icon="accessibility-new"
                  label="Posture Connection (IoT)"
                  enabled={postureConnectionEnabled}
                  onToggle={() => void pushNotificationPreferences({ posture_connection: !postureConnectionEnabled })}
                />
                <Text style={[styles.alertHint, { color: theme.colors.muted }]}>
                  When on, ultrasonic &quot;too close&quot; readings can trigger in-app posture alerts while your desk
                  device is assigned to you. Open IoT Status to verify live readings.
                </Text>
              </SectionCard>
            );
          }

          if (section.key === 'iot') {
            const parentNav = navigation.getParent?.() ?? navigation;
            return (
              <SectionCard>
                <Row
                  icon="sensors"
                  label="IoT Status"
                  description="Smart desk — live distance, light, and connectivity"
                  onPress={() => parentNav.navigate('IoTStatusScreen')}
                />
                <Row
                  icon="wifi"
                  label="Connected Devices"
                  description="Linked desk units on your account"
                  value={connectedDevicesSummary}
                  onPress={() => Alert.alert('Connected Devices', connectedDevicesSummary)}
                />
              </SectionCard>
            );
          }

          if (section.key === 'learning') {
            const parentNav = navigation.getParent?.() ?? navigation;
            return (
              <SectionCard>
                <Row
                  icon="assignment-turned-in"
                  label="My Submissions"
                  description="View all your submitted work"
                  onPress={() => parentNav.navigate('SubmissionsListScreen')}
                />
                <Row
                  icon="bar-chart"
                  label="Performance"
                  description="Score trends, streaks & improvement tips"
                  onPress={() => parentNav.navigate('PerformanceScreen')}
                />
                <Row
                  icon="library-books"
                  label="Library"
                  description="Browse curriculum documents"
                  onPress={() => parentNav.navigate('LibraryScreen')}
                />
              </SectionCard>
            );
          }

          if (section.key === 'appearance') {
            return (
              <SectionCard>
                <Row
                  icon="palette"
                  label="Theme"
                  description="Choose the app color palette"
                  value={getThemeLabel(themeKey)}
                  onPress={() => navigation.navigate('ThemeSettings')}
                />
              </SectionCard>
            );
          }

          if (section.key === 'support') {
            const parentNav = navigation.getParent?.() ?? navigation;
            return (
              <SectionCard>
                <Row
                  icon="notifications-active"
                  label="Notifications"
                  description="View your full notification inbox"
                  onPress={() => parentNav.navigate('NotificationsScreen')}
                />
                <Row
                  icon="help-outline"
                  label="Help & FAQ"
                  description="Guides, About, Privacy & Terms"
                  onPress={() => parentNav.navigate('HelpScreen')}
                />
              </SectionCard>
            );
          }

          return null;
        }}
        ListFooterComponent={
          <View style={styles.footerWrap}>
            <TouchableOpacity
              style={[
                styles.logoutButton,
                {
                  backgroundColor: theme.colors.surface,
                  borderColor: '#FCA5A5',
                  shadowColor: theme.colors.shadow,
                },
              ]}
              activeOpacity={0.9}
              onPress={() => {
                Alert.alert('Sign out', 'Are you sure you want to log out?', [
                  { text: 'Cancel', style: 'cancel' },
                  { text: 'Log out', style: 'destructive', onPress: onLogout },
                ]);
              }}
            >
              <MaterialIcons name="logout" size={20} color="#EF5350" />
              <Text style={styles.logoutButtonText}>Sign Out</Text>
            </TouchableOpacity>
            <Text style={[styles.versionText, { color: theme.colors.muted }]}>App version {appVersion()}</Text>
          </View>
        }
      />
    </Shell>
  );
}

function ChangePasswordScreen({ navigation, onOpenHomeNotifications }: ScreenProps) {
  const { theme } = useAppTheme();
  const { request } = useApi();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPasswords, setShowPasswords] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const initials = 'GV';

  const savePassword = useCallback(async () => {
    if (!currentPassword.trim()) {
      setError('Current password is required.');
      return;
    }

    if (newPassword.length < 8 || newPassword.length > 128) {
      setError('New password must be between 8 and 128 characters.');
      return;
    }

    if (newPassword !== confirmPassword) {
      setError('New password and confirmation do not match.');
      return;
    }

    setIsSaving(true);
    setError(null);
    setMessage(null);

    try {
      await request<void>('post', '/api/auth/change-password', {
        data: {
          current_password: currentPassword,
          new_password: newPassword,
        },
      });

      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setMessage('Password updated successfully.');
      Alert.alert('Password changed', 'Your password has been updated.');
    } catch (saveError) {
      setError(parseApiMessage(saveError, 'Unable to change your password right now.'));
    } finally {
      setIsSaving(false);
    }
  }, [currentPassword, newPassword, request]);

  return (
    <Shell navigation={navigation} title="Change Password" initials={initials} onOpenHomeNotifications={onOpenHomeNotifications}>
      <ScrollView contentContainerStyle={styles.pageContent} showsVerticalScrollIndicator={false}>
        <View style={[styles.card, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border, shadowColor: theme.colors.shadow }]}>
          <View style={styles.formStack}>
            <Text style={[styles.formLabel, { color: theme.colors.muted }]}>Current Password</Text>
            <TextInput
              style={[styles.input, { borderColor: theme.colors.border, color: theme.colors.primary, backgroundColor: theme.colors.surface }]}
              placeholder="Current password"
              placeholderTextColor="#94A3B8"
              secureTextEntry={!showPasswords}
              value={currentPassword}
              onChangeText={setCurrentPassword}
            />
            <Text style={[styles.formLabel, { color: theme.colors.muted }]}>New Password</Text>
            <TextInput
              style={[styles.input, { borderColor: theme.colors.border, color: theme.colors.primary, backgroundColor: theme.colors.surface }]}
              placeholder="New password"
              placeholderTextColor="#94A3B8"
              secureTextEntry={!showPasswords}
              value={newPassword}
              onChangeText={setNewPassword}
              maxLength={128}
            />
            <Text style={[styles.formLabel, { color: theme.colors.muted }]}>Confirm New Password</Text>
            <TextInput
              style={[styles.input, { borderColor: theme.colors.border, color: theme.colors.primary, backgroundColor: theme.colors.surface }]}
              placeholder="Confirm new password"
              placeholderTextColor="#94A3B8"
              secureTextEntry={!showPasswords}
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              maxLength={128}
            />
            <TouchableOpacity style={styles.passwordVisibilityButton} activeOpacity={0.8} onPress={() => setShowPasswords((current) => !current)}>
              <MaterialIcons name={showPasswords ? 'visibility-off' : 'visibility'} size={18} color={theme.colors.primary} />
              <Text style={[styles.passwordVisibilityText, { color: theme.colors.primary }]}>{showPasswords ? 'Hide passwords' : 'Show passwords'}</Text>
            </TouchableOpacity>
            <Text style={[styles.helperText, { color: theme.colors.muted }]}>8 to 128 characters.</Text>
            <TouchableOpacity
              style={[styles.primaryButton, { backgroundColor: theme.colors.primary }, isSaving ? styles.buttonDisabled : null]}
              activeOpacity={0.85}
              onPress={() => void savePassword()}
              disabled={isSaving}
            >
              {isSaving ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.primaryButtonText}>Change Password</Text>}
            </TouchableOpacity>
            {error ? <Text style={styles.errorText}>{error}</Text> : null}
            {message ? <Text style={styles.successText}>{message}</Text> : null}
          </View>
        </View>
      </ScrollView>
    </Shell>
  );
}

function TwoFactorSettingsScreen({ navigation, onOpenHomeNotifications }: ScreenProps) {
  const { theme } = useAppTheme();
  const { request } = useApi();
  const { profile, isLoading, error, reload } = useStudentProfile();
  const [mode, setMode] = useState<'idle' | 'enable' | 'disable'>('idle');
  const [setupSecret, setSetupSecret] = useState('');
  const [qrCodeBase64, setQrCodeBase64] = useState('');
  const [verificationCode, setVerificationCode] = useState('');
  const [currentPassword, setCurrentPassword] = useState('');
  const [disableCode, setDisableCode] = useState('');
  const [isBusy, setIsBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const initials = getInitials(profile?.full_name ?? 'Student');
  const enabled = profile?.totp_enabled ?? false;

  useEffect(() => {
    if (!enabled) {
      setMode('idle');
      setSetupSecret('');
      setQrCodeBase64('');
      setVerificationCode('');
      setCurrentPassword('');
      setDisableCode('');
      return;
    }

    setMode('idle');
    setSetupSecret('');
    setQrCodeBase64('');
    setVerificationCode('');
    setCurrentPassword('');
    setDisableCode('');
  }, [enabled]);

  const beginEnableFlow = useCallback(async () => {
    setIsBusy(true);
    setActionError(null);

    try {
      const response = await request<{ qr_code_base64: string; secret: string }>('post', '/api/auth/2fa/setup');
      setSetupSecret(response.secret);
      setQrCodeBase64(response.qr_code_base64);
      setMode('enable');
    } catch (setupError) {
      setActionError(parseApiMessage(setupError, 'Unable to start 2FA setup right now.'));
    } finally {
      setIsBusy(false);
    }
  }, [request]);

  const confirmEnable = useCallback(async () => {
    if (!setupSecret) {
      setActionError('Please start 2FA setup first.');
      return;
    }

    if (verificationCode.trim().length !== 6) {
      setActionError('Enter the 6-digit code from your authenticator app.');
      return;
    }

    setIsBusy(true);
    setActionError(null);

    try {
      await request<void>('post', '/api/auth/2fa/verify', {
        data: {
          secret: setupSecret,
          code: verificationCode.trim(),
        },
      });

      setMode('idle');
      setSetupSecret('');
      setQrCodeBase64('');
      setVerificationCode('');
      await reload();
      Alert.alert('2FA enabled', 'Two-factor authentication is now enabled.');
    } catch (enableError) {
      setActionError(parseApiMessage(enableError, 'Unable to verify the 2FA code right now.'));
    } finally {
      setIsBusy(false);
    }
  }, [reload, request, setupSecret, verificationCode]);

  const confirmDisable = useCallback(async () => {
    if (!currentPassword.trim()) {
      setActionError('Password is required to disable 2FA.');
      return;
    }

    if (disableCode.trim().length !== 6) {
      setActionError('Enter the 6-digit code from your authenticator app.');
      return;
    }

    setIsBusy(true);
    setActionError(null);

    try {
      await request<void>('post', '/api/auth/2fa/disable', {
        data: {
          password: currentPassword,
          code: disableCode.trim(),
        },
      });

      setMode('idle');
      setCurrentPassword('');
      setDisableCode('');
      await reload();
      Alert.alert('2FA disabled', 'Two-factor authentication has been turned off.');
    } catch (disableError) {
      setActionError(parseApiMessage(disableError, 'Unable to disable 2FA right now.'));
    } finally {
      setIsBusy(false);
    }
  }, [currentPassword, disableCode, reload, request]);

  return (
    <Shell navigation={navigation} title="Two-Factor Authentication" initials={initials} onOpenHomeNotifications={onOpenHomeNotifications}>
      <ScrollView contentContainerStyle={styles.pageContent} showsVerticalScrollIndicator={false}>
        <View style={[styles.card, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border, shadowColor: theme.colors.shadow }]}>
          <Row
            icon="shield"
            label="Current Status"
            badge={isLoading ? 'LOADING' : enabled ? 'ENABLED' : 'DISABLED'}
            badgeTone={isLoading ? 'amber' : enabled ? 'green' : 'amber'}
          />

          <Text style={[styles.helperText, { color: theme.colors.muted }]}>Scan the QR code only when you first enable 2FA. If you turn it off later, use your password and a 6-digit authenticator code.</Text>

          {error ? <Text style={styles.errorText}>{error}</Text> : null}
          {actionError ? <Text style={styles.errorText}>{actionError}</Text> : null}

          {!enabled ? (
            <View>
              {mode !== 'enable' ? (
                <View style={styles.formStack}>
                  <Text style={[styles.helperText, { color: theme.colors.muted }]}>Enable 2FA to secure your account with an authenticator app.</Text>
                  <TouchableOpacity style={[styles.primaryButton, { backgroundColor: theme.colors.primary }]} activeOpacity={0.85} onPress={() => void beginEnableFlow()} disabled={isBusy}>
                    {isBusy ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.primaryButtonText}>Enable 2FA</Text>}
                  </TouchableOpacity>
                </View>
              ) : (
                <View style={styles.formStack}>
                  {qrCodeBase64 ? (
                    <View style={styles.qrWrap}>
                      <Image source={{ uri: `data:image/png;base64,${qrCodeBase64}` }} style={styles.qrImage} />
                    </View>
                  ) : null}
                  <Text style={[styles.helperText, { color: theme.colors.muted }]}>Scan this QR code with Google Authenticator or any TOTP app.</Text>
                  {setupSecret ? (
                    <View style={[styles.manualSecretBox, { borderColor: theme.colors.border, backgroundColor: theme.colors.surfaceMuted }]}>
                      <Text style={[styles.manualSecretLabel, { color: theme.colors.muted }]}>Or enter this code manually</Text>
                      <Text style={[styles.manualSecretCode, { color: theme.colors.primary }]} selectable>
                        {setupSecret}
                      </Text>
                    </View>
                  ) : null}
                  <TextInput
                    style={[styles.input, { borderColor: theme.colors.border, color: theme.colors.primary, backgroundColor: theme.colors.surface }]}
                    placeholder="6-digit code"
                    placeholderTextColor="#94A3B8"
                    keyboardType="number-pad"
                    maxLength={6}
                    value={verificationCode}
                    onChangeText={setVerificationCode}
                  />
                  <TouchableOpacity style={[styles.primaryButton, { backgroundColor: theme.colors.primary }]} activeOpacity={0.85} onPress={() => void confirmEnable()} disabled={isBusy}>
                    {isBusy ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.primaryButtonText}>Verify and Enable</Text>}
                  </TouchableOpacity>
                </View>
              )}
            </View>
          ) : (
            <View>
              {mode !== 'disable' ? (
                <View style={styles.formStack}>
                  <Text style={[styles.helperText, { color: theme.colors.muted }]}>Two-factor authentication is currently active for your account.</Text>
                  <TouchableOpacity style={[styles.primaryButton, { backgroundColor: theme.colors.primary }]} activeOpacity={0.85} onPress={() => setMode('disable')}>
                    <Text style={styles.primaryButtonText}>Disable 2FA</Text>
                  </TouchableOpacity>
                </View>
              ) : (
                <View style={styles.formStack}>
                  <Text style={[styles.formLabel, { color: theme.colors.muted }]}>Password</Text>
                  <TextInput
                    style={[styles.input, { borderColor: theme.colors.border, color: theme.colors.primary, backgroundColor: theme.colors.surface }]}
                    placeholder="Account password"
                    placeholderTextColor="#94A3B8"
                    secureTextEntry
                    value={currentPassword}
                    onChangeText={setCurrentPassword}
                  />
                  <Text style={[styles.formLabel, { color: theme.colors.muted }]}>Authenticator Code</Text>
                  <TextInput
                    style={[styles.input, { borderColor: theme.colors.border, color: theme.colors.primary, backgroundColor: theme.colors.surface }]}
                    placeholder="6-digit code"
                    placeholderTextColor="#94A3B8"
                    keyboardType="number-pad"
                    maxLength={6}
                    value={disableCode}
                    onChangeText={setDisableCode}
                  />
                  <TouchableOpacity style={[styles.primaryButton, { backgroundColor: theme.colors.primary }]} activeOpacity={0.85} onPress={() => void confirmDisable()} disabled={isBusy}>
                    {isBusy ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.primaryButtonText}>Disable 2FA</Text>}
                  </TouchableOpacity>
                </View>
              )}
            </View>
          )}
        </View>
      </ScrollView>
    </Shell>
  );
}

function ThemeOptionCard({
  option,
  selected,
  onPress,
}: {
  option: ThemePalette;
  selected: boolean;
  onPress: () => void;
}) {
  const { theme } = useAppTheme();

  return (
    <Pressable
      onPress={onPress}
      style={[
        styles.themeOptionCard,
        {
          backgroundColor: theme.colors.surface,
          borderColor: selected ? theme.colors.primary : theme.colors.border,
          shadowColor: theme.colors.shadow,
        },
      ]}
    >
      <View style={[styles.themePreview, { backgroundColor: option.colors.screen, borderColor: option.colors.border }]}>
        <View style={[styles.themePreviewStrip, { backgroundColor: option.colors.primary }]} />
        <View style={[styles.themePreviewStrip, { backgroundColor: option.colors.surface }]} />
        <View style={[styles.themePreviewStrip, { backgroundColor: option.colors.surfaceMuted }]} />
      </View>
      <View style={styles.themeOptionTextWrap}>
        <Text style={[styles.themeOptionTitle, { color: theme.colors.primary }]}>{option.label}</Text>
        <Text style={[styles.themeOptionDescription, { color: theme.colors.muted }]}>{option.description}</Text>
      </View>
      <MaterialIcons name={selected ? 'check-circle' : 'radio-button-unchecked'} size={20} color={selected ? theme.colors.primary : theme.colors.inactive} />
    </Pressable>
  );
}

function ThemeSettingsScreen({ navigation, onOpenHomeNotifications }: ScreenProps) {
  const { theme, themeKey, themeOptions, setThemeKey } = useAppTheme();
  const initials = 'GV';

  return (
    <Shell navigation={navigation} title="Theme" initials={initials} onOpenHomeNotifications={onOpenHomeNotifications}>
      <ScrollView contentContainerStyle={styles.pageContent} showsVerticalScrollIndicator={false}>
        <View style={[styles.card, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border, shadowColor: theme.colors.shadow }]}>
          <View style={styles.formStack}>
            <Text style={[styles.formLabel, { color: theme.colors.muted }]}>Choose Your Look</Text>
            <Text style={[styles.helperText, { color: theme.colors.muted, marginTop: 0 }]}>Theme changes apply immediately and are saved on this device.</Text>
          </View>
          <View style={styles.themeOptionList}>
            {themeOptions.map((option) => (
              <ThemeOptionCard key={option.key} option={option} selected={themeKey === option.key} onPress={() => void setThemeKey(option.key)} />
            ))}
          </View>
        </View>
      </ScrollView>
    </Shell>
  );
}

function ProfileStack({ onLogout, onOpenHomeNotifications }: ProfileStackProps) {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="ProfileHome">
        {(props) => <ProfileHomeScreen {...props} onLogout={onLogout} onOpenHomeNotifications={onOpenHomeNotifications} />}
      </Stack.Screen>
      <Stack.Screen name="ChangePassword">
        {(props) => <ChangePasswordScreen {...props} onOpenHomeNotifications={onOpenHomeNotifications} />}
      </Stack.Screen>
      <Stack.Screen name="TwoFactorSettings">
        {(props) => <TwoFactorSettingsScreen {...props} onOpenHomeNotifications={onOpenHomeNotifications} />}
      </Stack.Screen>
      <Stack.Screen name="ThemeSettings">
        {(props) => <ThemeSettingsScreen {...props} onOpenHomeNotifications={onOpenHomeNotifications} />}
      </Stack.Screen>
    </Stack.Navigator>
  );
}

export default ProfileStack;

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  flex: {
    flex: 1,
  },
  frame: {
    flex: 1,
  },
  topBar: {
    height: 56,
    borderBottomWidth: 1,
    paddingHorizontal: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  avatarSmall: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarSmallText: {
    fontSize: 11,
    fontWeight: '800',
  },
  topTitle: {
    flex: 1,
    textAlign: 'center',
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: -0.2,
  },
  topBellButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  contentArea: {
    flex: 1,
  },
  listContent: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 28,
  },
  pageContent: {
    padding: 16,
    paddingBottom: 28,
  },
  sectionLabel: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    paddingHorizontal: 4,
    marginTop: 4,
    marginBottom: 6,
  },
  alertHint: {
    fontSize: 11,
    lineHeight: 16,
    marginTop: 10,
    paddingHorizontal: 4,
    paddingBottom: 4,
  },
  card: {
    borderWidth: 1,
    borderRadius: 12,
    overflow: 'hidden',
    shadowOpacity: 0.06,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
  },
  profileRow: {
    flexDirection: 'row',
    gap: 14,
    padding: 16,
  },
  avatarLarge: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarLargeText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '800',
  },
  profileMeta: {
    flex: 1,
    gap: 8,
  },
  profileLabel: {
    fontSize: 15,
    fontWeight: '800',
  },
  profileSubtext: {
    fontSize: 12,
  },
  badgeRow: {
    flexDirection: 'row',
    gap: 8,
    flexWrap: 'wrap',
  },
  roleBadge: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  roleBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
  },
  statusBadgeOn: {
    backgroundColor: '#DCFCE7',
  },
  statusBadgeOff: {
    backgroundColor: '#FEF3C7',
  },
  statusBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  statusBadgeTextOn: {
    color: '#15803D',
  },
  statusBadgeTextOff: {
    color: '#B45309',
  },
  input: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 11,
    fontSize: 14,
  },
  primaryButton: {
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonDisabled: {
    opacity: 0.7,
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '800',
  },
  errorText: {
    color: '#DC2626',
    fontSize: 12,
    fontWeight: '600',
  },
  successText: {
    color: '#15803D',
    fontSize: 12,
    fontWeight: '600',
  },
  formStack: {
    padding: 16,
    gap: 10,
  },
  formLabel: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  helperText: {
    fontSize: 11,
    marginTop: -4,
  },
  row: {
    borderTopWidth: 1,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  rowInner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  rowLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  rowTextBlock: {
    flex: 1,
  },
  rowLabel: {
    fontSize: 14,
    fontWeight: '600',
    flexShrink: 1,
  },
  rowLabelDestructive: {
    color: '#EF5350',
  },
  rowDescription: {
    fontSize: 11,
    marginTop: 2,
  },
  rowRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  rowValue: {
    fontSize: 12,
    fontWeight: '600',
  },
  passwordVisibilityButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'flex-start',
    paddingVertical: 2,
  },
  passwordVisibilityText: {
    fontSize: 12,
    fontWeight: '700',
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
  },
  badge_blue: {
    backgroundColor: '#DBEAFE',
  },
  badge_green: {
    backgroundColor: '#DCFCE7',
  },
  badge_amber: {
    backgroundColor: '#FEF3C7',
  },
  badgeText: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.6,
  },
  badgeText_blue: {
    color: '#3F72AF',
  },
  badgeText_green: {
    color: '#15803D',
  },
  badgeText_amber: {
    color: '#B45309',
  },
  toggle: {
    width: 44,
    height: 24,
    borderRadius: 12,
    padding: 2,
    justifyContent: 'center',
  },
  toggleOn: {
    alignItems: 'flex-end',
  },
  toggleOff: {
    backgroundColor: '#CBD5E1',
    alignItems: 'flex-start',
  },
  toggleThumb: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#FFFFFF',
  },
  footerWrap: {
    marginTop: 6,
    gap: 12,
    paddingBottom: 12,
  },
  logoutButton: {
    borderWidth: 1,
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 18,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  logoutButtonText: {
    color: '#EF5350',
    fontSize: 14,
    fontWeight: '800',
    letterSpacing: 0.4,
  },
  versionText: {
    fontSize: 12,
    textAlign: 'center',
  },
  bottomBar: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    borderTopWidth: 1,
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'flex-end',
    paddingTop: 8,
    paddingBottom: 26,
    paddingHorizontal: 8,
    shadowOpacity: 0.08,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: -2 },
    elevation: 4,
  },
  tabItem: {
    alignItems: 'center',
    gap: 2,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  tabLabel: {
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  tabLabelActive: {
    fontSize: 10,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  captureTab: {
    alignItems: 'center',
    marginTop: -20,
    paddingHorizontal: 8,
  },
  captureButton: {
    width: 56,
    height: 56,
    borderRadius: 28,
    borderWidth: 4,
    borderColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    shadowOpacity: 0.18,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  captureLabel: {
    marginTop: 4,
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  qrWrap: {
    alignItems: 'center',
    paddingVertical: 12,
  },
  qrImage: {
    width: 220,
    height: 220,
    borderRadius: 12,
  },
  manualSecretBox: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 4,
  },
  manualSecretLabel: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  manualSecretCode: {
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  themeOptionList: {
    paddingHorizontal: 16,
    paddingBottom: 16,
    gap: 10,
  },
  themeOptionCard: {
    borderWidth: 1,
    borderRadius: 14,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    shadowOpacity: 0.06,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
  },
  themePreview: {
    width: 60,
    height: 46,
    borderRadius: 12,
    borderWidth: 1,
    overflow: 'hidden',
    flexDirection: 'row',
  },
  themePreviewStrip: {
    flex: 1,
  },
  themeOptionTextWrap: {
    flex: 1,
    gap: 3,
  },
  themeOptionTitle: {
    fontSize: 14,
    fontWeight: '800',
  },
  themeOptionDescription: {
    fontSize: 11,
    lineHeight: 16,
  },
});