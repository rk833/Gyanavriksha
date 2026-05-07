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
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useFocusEffect } from '@react-navigation/native';
import { MaterialIcons } from '@expo/vector-icons';
import Constants from 'expo-constants';
import * as ImagePicker from 'expo-image-picker';
import axios from 'axios';
import { useApi } from '../../hooks/useApi';
import {
  getBiometricHardwareInfo,
  getBiometricTypeLabel,
  isBiometricSignInEnabled,
  promptDeviceAuthentication,
  setBiometricSignInEnabled,
} from '../../services/biometricAuth';
import { ThemePalette, useAppTheme } from '../../context/ThemeContext';

type UserResponse = {
  user_id: string;
  email: string;
  full_name: string;
  role: string;
  is_active: boolean;
  is_email_verified: boolean;
  totp_enabled: boolean;
  email_2fa_enabled?: boolean;
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
  route?: { params?: { profileImageUrl?: string | null } };
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
  profileImageUrl,
  onOpenHomeNotifications,
  children,
}: {
  navigation: ProfileNavigation;
  title: string;
  initials: string;
  profileImageUrl?: string | null;
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
            {/* Avatar — photo if available, initials otherwise */}
            <View style={[styles.avatarSmall, { backgroundColor: theme.colors.primarySoft, overflow: 'hidden' }]}>
              {profileImageUrl ? (
                <Image source={{ uri: profileImageUrl }} style={styles.avatarSmallImg} />
              ) : (
                <Text style={[styles.avatarSmallText, { color: theme.colors.primary }]}>{initials}</Text>
              )}
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

/* ──────────────────────────────────────────────────────────
   ProfileHome — enhanced row components
────────────────────────────────────────────────────────── */
function PhRow({
  icon,
  iconBg,
  label,
  description,
  value,
  rightEl,
  onPress,
  isFirst,
}: {
  icon: keyof typeof MaterialIcons.glyphMap;
  iconBg: string;
  label: string;
  description?: string;
  value?: string;
  rightEl?: React.ReactNode;
  onPress?: () => void;
  isFirst?: boolean;
}) {
  const { theme } = useAppTheme();

  const inner = (
    <View style={phStyles.phRowInner}>
      <View style={[phStyles.phIconCircle, { backgroundColor: iconBg + '22' }]}>
        <MaterialIcons name={icon} size={20} color={iconBg} />
      </View>
      <View style={phStyles.phRowTextWrap}>
        <Text style={[phStyles.phRowLabel, { color: theme.colors.primary }]}>{label}</Text>
        {description ? <Text style={[phStyles.phRowDesc, { color: theme.colors.muted }]}>{description}</Text> : null}
      </View>
      <View style={phStyles.phRowRight}>
        {rightEl ?? (value ? <Text style={[phStyles.phRowValue, { color: theme.colors.muted }]}>{value}</Text> : null)}
        {onPress ? <MaterialIcons name="chevron-right" size={20} color={theme.colors.inactive} /> : null}
      </View>
    </View>
  );

  if (!onPress) {
    return <View style={[phStyles.phRow, isFirst ? phStyles.phRowFirst : null, { borderTopColor: theme.colors.border }]}>{inner}</View>;
  }

  return (
    <Pressable
      style={({ pressed }) => [phStyles.phRow, isFirst ? phStyles.phRowFirst : null, { borderTopColor: theme.colors.border, opacity: pressed ? 0.72 : 1 }]}
      onPress={onPress}
    >
      {inner}
    </Pressable>
  );
}

function PhToggleRow({
  icon,
  iconBg,
  label,
  description,
  enabled,
  onToggle,
  isFirst,
}: {
  icon: keyof typeof MaterialIcons.glyphMap;
  iconBg: string;
  label: string;
  description?: string;
  enabled: boolean;
  onToggle: () => void;
  isFirst?: boolean;
}) {
  const { theme } = useAppTheme();

  return (
    <Pressable
      style={[phStyles.phRow, isFirst ? phStyles.phRowFirst : null, { borderTopColor: theme.colors.border }]}
      onPress={onToggle}
    >
      <View style={phStyles.phRowInner}>
        <View style={[phStyles.phIconCircle, { backgroundColor: iconBg + '22' }]}>
          <MaterialIcons name={icon} size={20} color={iconBg} />
        </View>
        <View style={phStyles.phRowTextWrap}>
          <Text style={[phStyles.phRowLabel, { color: theme.colors.primary }]}>{label}</Text>
          {description ? <Text style={[phStyles.phRowDesc, { color: theme.colors.muted }]}>{description}</Text> : null}
        </View>
        <Switch
          value={enabled}
          onValueChange={onToggle}
          trackColor={{ false: '#CBD5E1', true: theme.colors.primary }}
          thumbColor="#FFFFFF"
        />
      </View>
    </Pressable>
  );
}

function ProfileHomeScreen({ navigation, onLogout, onOpenHomeNotifications }: ScreenProps) {
  const { theme, themeKey } = useAppTheme();
  const { request, patch } = useApi();
  const { profile, isLoading, error, reload } = useStudentProfile();
  const [connectedDevicesSummary, setConnectedDevicesSummary] = useState('Checking...');
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);
  const [gradingAlertsEnabled, setGradingAlertsEnabled] = useState(true);
  const [quizRemindersEnabled, setQuizRemindersEnabled] = useState(true);
  const [postureConnectionEnabled, setPostureConnectionEnabled] = useState(false);
  const [biometricQuickSignIn, setBiometricQuickSignIn] = useState(false);
  const [biometricLabel, setBiometricLabel] = useState('Biometric');

  useFocusEffect(
    useCallback(() => {
      if (Platform.OS === 'web') {
        return;
      }
      let active = true;
      void (async () => {
        // Pass the profile email so we check THIS account's preference only
        const [enabled, label] = await Promise.all([
          isBiometricSignInEnabled(profile?.email ?? undefined),
          getBiometricTypeLabel(),
        ]);
        if (active) {
          setBiometricQuickSignIn(enabled);
          setBiometricLabel(label);
        }
      })();
      return () => {
        active = false;
      };
    }, [profile?.email])
  );

  /** If the account already has quick sign-in enabled (e.g. another device), enable local SecureStore when missing. */
  useEffect(() => {
    if (Platform.OS === 'web') {
      return;
    }
    const p = profile?.notification_preferences;
    if (!p || typeof p !== 'object' || p.mobile_biometric_quick_signin !== true) {
      return;
    }
    let active = true;
    void (async () => {
      const local = await isBiometricSignInEnabled(profile?.email ?? undefined);
      if (!active || local) {
        return;
      }
      try {
        await setBiometricSignInEnabled(true, profile?.email ?? undefined);
        if (active) {
          setBiometricQuickSignIn(true);
        }
      } catch {
        /* keep toggle off if SecureStore fails */
      }
    })();
    return () => {
      active = false;
    };
  }, [profile?.user_id, profile?.notification_preferences]);

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
  const email2faOn = profile?.email_2fa_enabled ?? false;
  const anySecondFactor = totpEnabled || email2faOn;
  const secondFactorSummary = useMemo(() => {
    if (totpEnabled && email2faOn) return 'App & email';
    if (totpEnabled) return 'Authenticator';
    if (email2faOn) return 'Email';
    return 'Off';
  }, [totpEnabled, email2faOn]);

  const onBiometricQuickSignInToggle = useCallback(async () => {
    if (Platform.OS === 'web') {
      return;
    }
    const userEmail = profile?.email ?? undefined;
    if (biometricQuickSignIn) {
      Alert.alert(
        'Turn off quick sign-in?',
        `You will sign in with email and password until you enable ${biometricLabel} again.`,
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Turn off',
            style: 'destructive',
            onPress: async () => {
              try {
                await setBiometricSignInEnabled(false, userEmail);
                setBiometricQuickSignIn(false);
                try {
                  await patch<UserResponse>('/api/students/profile', {
                    notification_preferences: { mobile_biometric_quick_signin: false },
                  });
                  await reload();
                } catch (err) {
                  Alert.alert(
                    'Saved on this device',
                    parseApiMessage(err, 'Could not update your account. This device will stay off for quick sign-in.')
                  );
                }
              } catch {
                Alert.alert('Could not update', 'Secure storage failed. Try again.');
              }
            },
          },
        ]
      );
      return;
    }
    const hw = await getBiometricHardwareInfo();
    if (!hw.supported) {
      Alert.alert('Not available', 'This device does not support biometric authentication.');
      return;
    }
    if (!hw.enrolled) {
      Alert.alert(
        'Set up screen lock first',
        'Enable Face ID, Touch ID, or a device passcode in your system settings, then try again.'
      );
      return;
    }
    const gate = await promptDeviceAuthentication(`Confirm with ${hw.label} to enable quick sign-in`);
    if (!gate.ok) {
      if (!gate.cancelled) {
        Alert.alert('Verification failed', 'Try again when you are ready.');
      }
      return;
    }
    try {
      await setBiometricSignInEnabled(true, userEmail);
    } catch {
      Alert.alert('Could not save on device', 'Secure storage failed. Try again.');
      return;
    }
    setBiometricQuickSignIn(true);
    let synced = true;
    try {
      await patch<UserResponse>('/api/students/profile', {
        notification_preferences: { mobile_biometric_quick_signin: true },
      });
      await reload();
    } catch (err) {
      synced = false;
      Alert.alert('Saved on this device only', parseApiMessage(err, 'Could not sync to your account. Quick sign-in still works here.'));
    }
    if (synced) {
      Alert.alert(
        'Quick sign-in enabled',
        `You can use ${biometricLabel} on the sign-in screen when your session is still valid.`
      );
    }
  }, [biometricQuickSignIn, biometricLabel, profile?.email, patch, reload]);

  const handlePickProfileImage = useCallback(async () => {
    if (Platform.OS === 'web') return;

    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert(
        'Permission needed',
        'Please allow photo library access to upload a profile picture.',
        [{ text: 'OK' }]
      );
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.7,
      base64: true,
    });

    if (result.canceled || !result.assets?.[0]?.base64) return;

    const asset = result.assets[0];
    const mimeType = asset.mimeType ?? 'image/jpeg';
    const dataUrl = `data:${mimeType};base64,${asset.base64}`;

    setIsUploadingPhoto(true);
    try {
      await patch<UserResponse>('/api/students/profile', { profile_image_url: dataUrl });
      await reload();
    } catch (err) {
      Alert.alert('Upload failed', parseApiMessage(err, 'Could not update your profile picture. Try again.'));
    } finally {
      setIsUploadingPhoto(false);
    }
  }, [patch, reload]);

  const sections = useMemo(() => {
    const rows = [
      { key: 'account', title: 'Account', data: [{ id: 'account-row' }] },
      { key: 'learning', title: 'Learning & Analytics', data: [{ id: 'learning-row' }] },
      { key: 'notifications', title: 'Notification Preferences', data: [{ id: 'notifications-row' }] },
      { key: 'iot', title: 'IoT & Smart Desk', data: [{ id: 'iot-row' }] },
      { key: 'appearance', title: 'Appearance', data: [{ id: 'appearance-row' }] },
      { key: 'support', title: 'Support', data: [{ id: 'support-row' }] },
    ];
    if (Platform.OS !== 'web') {
      rows.splice(1, 0, { key: 'security', title: 'Security & device', data: [{ id: 'security-row' }] });
    }
    return rows;
  }, []);

  return (
    <Shell navigation={navigation} title="Profile" initials={initials} profileImageUrl={profile?.profile_image_url} onOpenHomeNotifications={onOpenHomeNotifications}>
      <SectionList
        sections={sections}
        keyExtractor={(item) => item.id}
        stickySectionHeadersEnabled={false}
        contentContainerStyle={phStyles.listContent}
        showsVerticalScrollIndicator={false}

        /* ── Hero profile banner ── */
        ListHeaderComponent={
          <View style={[phStyles.heroCard, { backgroundColor: theme.colors.primary }]}>
            <View style={phStyles.heroGlow} />
            <View style={phStyles.heroGlow2} />
            <View style={phStyles.heroCenterContent}>
              {/* Tappable avatar — photo if available, initials otherwise */}
              <TouchableOpacity
                style={phStyles.avatarWrap}
                activeOpacity={0.85}
                onPress={() => void handlePickProfileImage()}
                disabled={isUploadingPhoto}
              >
                <View style={phStyles.avatarRing}>
                  {profile?.profile_image_url ? (
                    <Image source={{ uri: profile.profile_image_url }} style={phStyles.avatarImg} />
                  ) : (
                    <View style={[phStyles.avatarCircle, { backgroundColor: 'rgba(255,255,255,0.18)' }]}>
                      <Text style={phStyles.avatarInitials}>{initials}</Text>
                    </View>
                  )}
                </View>
                <View style={phStyles.avatarCameraBtn}>
                  {isUploadingPhoto ? (
                    <ActivityIndicator size="small" color="#FFFFFF" />
                  ) : (
                    <MaterialIcons name="photo-camera" size={14} color="#FFFFFF" />
                  )}
                </View>
              </TouchableOpacity>
              <Text style={phStyles.heroName}>{isLoading ? '…' : (profile?.full_name ?? 'Student')}</Text>
              <Text style={phStyles.heroEmail}>{profile?.email ?? '—'}</Text>
              <View style={phStyles.heroPillRow}>
                {profile?.role ? (
                  <View style={phStyles.rolePill}>
                    <Text style={phStyles.rolePillText}>{profile.role}</Text>
                  </View>
                ) : null}
                <View style={[phStyles.fa2Pill, anySecondFactor ? phStyles.fa2PillOn : phStyles.fa2PillOff]}>
                  <MaterialIcons name="security" size={11} color={anySecondFactor ? '#15803D' : '#92400E'} />
                  <Text style={[phStyles.fa2PillText, { color: anySecondFactor ? '#15803D' : '#92400E' }]}>
                    2FA {secondFactorSummary}
                  </Text>
                </View>
                {profile?.is_email_verified ? (
                  <View style={phStyles.verifiedPill}>
                    <MaterialIcons name="verified" size={11} color="#1D4ED8" />
                    <Text style={phStyles.verifiedPillText}>Verified</Text>
                  </View>
                ) : null}
              </View>
            </View>
          </View>
        }

        renderSectionHeader={({ section }) => (
          <Text style={[phStyles.sectionHeader, { color: theme.colors.muted }]}>{section.title}</Text>
        )}

        renderItem={({ section }) => {
          /* ── Account ── */
          if (section.key === 'account') {
            return (
              <View style={[phStyles.sectionCard, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border, shadowColor: theme.colors.shadow }]}>
                {error ? (
                  <View style={phStyles.errorBanner}>
                    <MaterialIcons name="error-outline" size={14} color="#DC2626" />
                    <Text style={phStyles.errorBannerText}>{error}</Text>
                  </View>
                ) : null}
                <PhRow
                  icon="lock-outline"
                  iconBg="#3F72AF"
                  label="Change Password"
                  description="Update your account password"
                  onPress={() => navigation.navigate('ChangePassword', { profileImageUrl: profile?.profile_image_url ?? null })}
                  isFirst
                />
                <PhRow
                  icon="security"
                  iconBg="#3F72AF"
                  label="Two-Factor Auth"
                  description="Authenticator app or email codes"
                  rightEl={
                    <View style={[phStyles.phBadge, anySecondFactor ? phStyles.phBadgeGreen : phStyles.phBadgeAmber]}>
                      <Text style={[phStyles.phBadgeText, { color: anySecondFactor ? '#15803D' : '#B45309' }]}>
                        {anySecondFactor ? secondFactorSummary : 'Off'}
                      </Text>
                    </View>
                  }
                  onPress={() => navigation.navigate('TwoFactorSettings', { profileImageUrl: profile?.profile_image_url ?? null })}
                />
              </View>
            );
          }

          /* ── Security & device (native only) ── */
          if (section.key === 'security') {
            return (
              <View style={[phStyles.sectionCard, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border, shadowColor: theme.colors.shadow }]}>
                <PhToggleRow
                  icon="fingerprint"
                  iconBg="#8B5CF6"
                  label={`${biometricLabel} Quick Sign-in`}
                  description={`Unlock the app with ${biometricLabel} — your password is never stored`}
                  enabled={biometricQuickSignIn}
                  onToggle={() => void onBiometricQuickSignInToggle()}
                  isFirst
                />
              </View>
            );
          }

          /* ── Learning & Analytics ── */
          if (section.key === 'learning') {
            const parentNav = navigation.getParent?.() ?? navigation;
            return (
              <View style={[phStyles.sectionCard, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border, shadowColor: theme.colors.shadow }]}>
                <PhRow icon="assignment-turned-in" iconBg="#10B981" label="My Submissions" description="View all submitted assignments" onPress={() => parentNav.navigate('SubmissionsListScreen')} isFirst />
                <PhRow icon="bar-chart" iconBg="#10B981" label="Performance" description="Score trends, streaks & improvement tips" onPress={() => parentNav.navigate('PerformanceScreen')} />
                <PhRow icon="library-books" iconBg="#10B981" label="Library" description="Browse curriculum documents" onPress={() => parentNav.navigate('LibraryScreen')} />
              </View>
            );
          }

          /* ── Notification Preferences ── */
          if (section.key === 'notifications') {
            return (
              <View style={[phStyles.sectionCard, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border, shadowColor: theme.colors.shadow }]}>
                <PhToggleRow icon="notifications" iconBg="#F59E0B" label="Grading Alerts" description="Notify when assignments are graded" enabled={gradingAlertsEnabled} onToggle={() => void pushNotificationPreferences({ grading_updates: !gradingAlertsEnabled })} isFirst />
                <PhToggleRow icon="quiz" iconBg="#F59E0B" label="Quiz Reminders" description="Upcoming quiz notifications" enabled={quizRemindersEnabled} onToggle={() => void pushNotificationPreferences({ quiz_reminders: !quizRemindersEnabled })} />
                <PhToggleRow icon="accessibility-new" iconBg="#F59E0B" label="Posture Alerts (IoT)" description="Ultrasonic desk distance triggers in-app alerts" enabled={postureConnectionEnabled} onToggle={() => void pushNotificationPreferences({ posture_connection: !postureConnectionEnabled })} />
              </View>
            );
          }

          /* ── IoT & Smart Desk ── */
          if (section.key === 'iot') {
            const parentNav = navigation.getParent?.() ?? navigation;
            return (
              <View style={[phStyles.sectionCard, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border, shadowColor: theme.colors.shadow }]}>
                <PhRow icon="sensors" iconBg="#06B6D4" label="IoT Status" description="Live desk distance, light & connectivity" onPress={() => parentNav.navigate('IoTStatusScreen')} isFirst />
                <PhRow icon="wifi" iconBg="#06B6D4" label="Connected Devices" description={connectedDevicesSummary} onPress={() => Alert.alert('Connected Devices', connectedDevicesSummary)} />
              </View>
            );
          }

          /* ── Appearance ── */
          if (section.key === 'appearance') {
            return (
              <View style={[phStyles.sectionCard, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border, shadowColor: theme.colors.shadow }]}>
                <PhRow
                  icon="palette"
                  iconBg="#8B5CF6"
                  label="Theme"
                  description="Customise the app colour palette"
                  rightEl={
                    <View style={[phStyles.phBadge, phStyles.phBadgeBlue]}>
                      <Text style={[phStyles.phBadgeText, { color: '#1D4ED8' }]}>{getThemeLabel(themeKey)}</Text>
                    </View>
                  }
                  onPress={() => navigation.navigate('ThemeSettings', { profileImageUrl: profile?.profile_image_url ?? null })}
                  isFirst
                />
              </View>
            );
          }

          /* ── Support ── */
          if (section.key === 'support') {
            const parentNav = navigation.getParent?.() ?? navigation;
            return (
              <View style={[phStyles.sectionCard, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border, shadowColor: theme.colors.shadow }]}>
                <PhRow icon="notifications-active" iconBg="#64748B" label="Notifications" description="View your full notification inbox" onPress={() => parentNav.navigate('NotificationsScreen')} isFirst />
                <PhRow icon="help-outline" iconBg="#64748B" label="Help & FAQ" description="Guides, About, Privacy & Terms" onPress={() => parentNav.navigate('HelpScreen')} />
              </View>
            );
          }

          return null;
        }}

        ListFooterComponent={
          <View style={phStyles.footerArea}>
            <TouchableOpacity
              style={[phStyles.signOutBtn, { backgroundColor: theme.colors.surface, borderColor: '#FCA5A5', shadowColor: theme.colors.shadow }]}
              activeOpacity={0.85}
              onPress={() => {
                const message =
                  Platform.OS !== 'web' && biometricQuickSignIn
                    ? `You can unlock this app again with ${biometricLabel} on this device, or sign in with email. Continue?`
                    : 'Are you sure you want to log out?';
                Alert.alert('Sign out', message, [
                  { text: 'Cancel', style: 'cancel' },
                  { text: 'Log out', style: 'destructive', onPress: onLogout },
                ]);
              }}
            >
              <View style={phStyles.signOutIconWrap}>
                <MaterialIcons name="logout" size={20} color="#EF5350" />
              </View>
              <Text style={phStyles.signOutText}>Sign Out</Text>
              <MaterialIcons name="chevron-right" size={20} color="#EF5350" style={{ opacity: 0.6 }} />
            </TouchableOpacity>
            <Text style={[phStyles.versionFooter, { color: theme.colors.muted }]}>Gyanavriksha · v{appVersion()}</Text>
          </View>
        }
      />
    </Shell>
  );
}

function ChangePasswordScreen({ navigation, route, onOpenHomeNotifications }: ScreenProps) {
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
  const profileImageUrl = route?.params?.profileImageUrl ?? null;

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
    <Shell navigation={navigation} title="Change Password" initials={initials} profileImageUrl={profileImageUrl} onOpenHomeNotifications={onOpenHomeNotifications}>
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
  const [emailEnablePassword, setEmailEnablePassword] = useState('');
  const [emailDisablePassword, setEmailDisablePassword] = useState('');
  const [isBusy, setIsBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const initials = getInitials(profile?.full_name ?? 'Student');
  const totpEnabled = profile?.totp_enabled ?? false;
  const email2faEnabled = profile?.email_2fa_enabled ?? false;

  useEffect(() => {
    if (!totpEnabled) {
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
  }, [totpEnabled]);

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
      Alert.alert('Authenticator disabled', 'Authenticator app 2FA has been turned off.');
    } catch (disableError) {
      setActionError(parseApiMessage(disableError, 'Unable to disable authenticator right now.'));
    } finally {
      setIsBusy(false);
    }
  }, [currentPassword, disableCode, reload, request]);

  const confirmEnableEmail2fa = useCallback(async () => {
    if (!emailEnablePassword.trim()) {
      setActionError('Enter your password to enable email codes.');
      return;
    }
    if (!profile?.is_email_verified) {
      setActionError('Verify your email address first.');
      return;
    }
    setIsBusy(true);
    setActionError(null);
    try {
      await request<void>('post', '/api/auth/2fa/email/enable', {
        data: { password: emailEnablePassword },
      });
      setEmailEnablePassword('');
      await reload();
      Alert.alert('Email codes enabled', 'You can sign in with codes sent to your email.');
    } catch (err) {
      setActionError(parseApiMessage(err, 'Could not enable email codes.'));
    } finally {
      setIsBusy(false);
    }
  }, [emailEnablePassword, profile?.is_email_verified, reload, request]);

  const confirmDisableEmail2fa = useCallback(async () => {
    if (!emailDisablePassword.trim()) {
      setActionError('Enter your password to disable email codes.');
      return;
    }
    setIsBusy(true);
    setActionError(null);
    try {
      await request<void>('post', '/api/auth/2fa/email/disable', {
        data: { password: emailDisablePassword },
      });
      setEmailDisablePassword('');
      await reload();
      Alert.alert('Email codes disabled');
    } catch (err) {
      setActionError(parseApiMessage(err, 'Could not disable email codes.'));
    } finally {
      setIsBusy(false);
    }
  }, [emailDisablePassword, reload, request]);

  const activeCount = (totpEnabled ? 1 : 0) + (email2faEnabled ? 1 : 0);

  return (
    <Shell navigation={navigation} title="Two-Factor Auth" initials={initials} profileImageUrl={profile?.profile_image_url} onOpenHomeNotifications={onOpenHomeNotifications}>
      <ScrollView contentContainerStyle={styles.pageContent} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">

        {/* ── Hero summary banner ── */}
        <View style={[tf2Styles.heroBanner, { backgroundColor: theme.colors.primary }]}>
          <View style={tf2Styles.heroGlow} />
          <View style={tf2Styles.heroLeft}>
            <View style={tf2Styles.heroIconWrap}>
              <MaterialIcons name="verified-user" size={28} color="#FFFFFF" />
            </View>
            <View style={tf2Styles.heroTextWrap}>
              <Text style={tf2Styles.heroTitle}>Account protection</Text>
              <Text style={tf2Styles.heroSub}>
                {isLoading
                  ? 'Loading…'
                  : activeCount === 0
                  ? 'No second factor enabled'
                  : activeCount === 1
                  ? '1 method active'
                  : '2 methods active — strongly secured'}
              </Text>
            </View>
          </View>
          <View style={[tf2Styles.heroBadge, { backgroundColor: activeCount > 0 ? 'rgba(255,255,255,0.18)' : 'rgba(255,255,255,0.1)' }]}>
            <Text style={tf2Styles.heroBadgeText}>{activeCount > 0 ? `${activeCount} ON` : 'OFF'}</Text>
          </View>
        </View>

        {/* ── Global errors ── */}
        {(error || actionError) ? (
          <View style={tf2Styles.errorBanner}>
            <MaterialIcons name="error-outline" size={16} color="#DC2626" />
            <Text style={tf2Styles.errorBannerText}>{actionError ?? error}</Text>
          </View>
        ) : null}

        {/* ══════════════════════════════════════
            METHOD 1 — Authenticator app
        ══════════════════════════════════════ */}
        <View style={[tf2Styles.methodCard, { backgroundColor: theme.colors.surface, borderColor: totpEnabled ? 'rgba(63,114,175,0.35)' : theme.colors.border, shadowColor: theme.colors.shadow }]}>
          {/* Card header */}
          <View style={tf2Styles.methodCardHeader}>
            <View style={[tf2Styles.methodIconWrap, { backgroundColor: totpEnabled ? 'rgba(63,114,175,0.12)' : theme.colors.surfaceMuted ?? theme.colors.border + '33' }]}>
              <MaterialIcons name="smartphone" size={24} color={totpEnabled ? theme.colors.primary : theme.colors.muted} />
            </View>
            <View style={tf2Styles.methodMeta}>
              <Text style={[tf2Styles.methodTitle, { color: theme.colors.primary }]}>Authenticator app</Text>
              <Text style={[tf2Styles.methodDesc, { color: theme.colors.muted }]}>Google Authenticator, Authy, or Microsoft Authenticator</Text>
            </View>
            <View style={[tf2Styles.statusPill, totpEnabled ? tf2Styles.statusPillOn : tf2Styles.statusPillOff]}>
              <View style={[tf2Styles.statusDot, totpEnabled ? tf2Styles.statusDotOn : tf2Styles.statusDotOff]} />
              <Text style={[tf2Styles.statusPillText, { color: totpEnabled ? '#15803D' : '#92400E' }]}>{isLoading ? '…' : totpEnabled ? 'ON' : 'OFF'}</Text>
            </View>
          </View>

          {/* Divider */}
          <View style={[tf2Styles.divider, { backgroundColor: theme.colors.border }]} />

          {/* ── TOTP not enabled: show setup flow ── */}
          {!totpEnabled ? (
            <View style={tf2Styles.methodBody}>
              {mode !== 'enable' ? (
                <TouchableOpacity
                  style={[tf2Styles.actionBtn, { backgroundColor: theme.colors.primary }]}
                  activeOpacity={0.85}
                  onPress={() => void beginEnableFlow()}
                  disabled={isBusy}
                >
                  {isBusy ? (
                    <ActivityIndicator color="#FFFFFF" size="small" />
                  ) : (
                    <>
                      <MaterialIcons name="qr-code-scanner" size={18} color="#FFFFFF" />
                      <Text style={tf2Styles.actionBtnText}>Set up authenticator</Text>
                    </>
                  )}
                </TouchableOpacity>
              ) : (
                <View style={tf2Styles.setupFlow}>
                  {/* Step indicator */}
                  <View style={tf2Styles.stepRow}>
                    <View style={[tf2Styles.stepDot, { backgroundColor: theme.colors.primary }]}><Text style={tf2Styles.stepNum}>1</Text></View>
                    <Text style={[tf2Styles.stepLabel, { color: theme.colors.muted }]}>Scan the QR code with your authenticator app</Text>
                  </View>

                  {qrCodeBase64 ? (
                    <View style={[tf2Styles.qrFrame, { borderColor: theme.colors.border, backgroundColor: theme.colors.surface }]}>
                      <Image source={{ uri: `data:image/png;base64,${qrCodeBase64}` }} style={tf2Styles.qrImg} />
                    </View>
                  ) : null}

                  {setupSecret ? (
                    <View style={[tf2Styles.secretBox, { borderColor: theme.colors.border, backgroundColor: theme.colors.surfaceMuted ?? theme.colors.border + '22' }]}>
                      <Text style={[tf2Styles.secretLabel, { color: theme.colors.muted }]}>Can't scan? Enter this code manually</Text>
                      <Text style={[tf2Styles.secretCode, { color: theme.colors.primary }]} selectable>{setupSecret}</Text>
                    </View>
                  ) : null}

                  <View style={[tf2Styles.divider, { backgroundColor: theme.colors.border, marginVertical: 4 }]} />

                  <View style={tf2Styles.stepRow}>
                    <View style={[tf2Styles.stepDot, { backgroundColor: theme.colors.primary }]}><Text style={tf2Styles.stepNum}>2</Text></View>
                    <Text style={[tf2Styles.stepLabel, { color: theme.colors.muted }]}>Enter the 6-digit code shown in your app</Text>
                  </View>

                  <TextInput
                    style={[tf2Styles.codeInput, { borderColor: theme.colors.border, color: theme.colors.primary, backgroundColor: theme.colors.surface }]}
                    placeholder="• • • • • •"
                    placeholderTextColor="#94A3B8"
                    keyboardType="number-pad"
                    maxLength={6}
                    value={verificationCode}
                    onChangeText={setVerificationCode}
                    textAlign="center"
                  />

                  <TouchableOpacity
                    style={[tf2Styles.actionBtn, { backgroundColor: theme.colors.primary }]}
                    activeOpacity={0.85}
                    onPress={() => void confirmEnable()}
                    disabled={isBusy}
                  >
                    {isBusy ? (
                      <ActivityIndicator color="#FFFFFF" size="small" />
                    ) : (
                      <>
                        <MaterialIcons name="check-circle" size={18} color="#FFFFFF" />
                        <Text style={tf2Styles.actionBtnText}>Verify &amp; activate</Text>
                      </>
                    )}
                  </TouchableOpacity>

                  <TouchableOpacity style={tf2Styles.cancelLink} onPress={() => setMode('idle')}>
                    <Text style={[tf2Styles.cancelLinkText, { color: theme.colors.muted }]}>Cancel setup</Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>
          ) : (
            /* ── TOTP enabled: show disable flow ── */
            <View style={tf2Styles.methodBody}>
              {mode !== 'disable' ? (
                <TouchableOpacity
                  style={[tf2Styles.actionBtn, tf2Styles.actionBtnOutline, { borderColor: theme.colors.border }]}
                  activeOpacity={0.85}
                  onPress={() => setMode('disable')}
                >
                  <MaterialIcons name="no-encryption-gmailerrorred" size={18} color="#B91C1C" />
                  <Text style={[tf2Styles.actionBtnText, { color: '#B91C1C' }]}>Disable authenticator</Text>
                </TouchableOpacity>
              ) : (
                <View style={tf2Styles.disableFlow}>
                  <View style={[tf2Styles.warningBox, { borderColor: 'rgba(185,28,28,0.2)', backgroundColor: 'rgba(254,242,242,0.9)' }]}>
                    <MaterialIcons name="warning-amber" size={18} color="#B91C1C" />
                    <Text style={tf2Styles.warningText}>Removing authenticator reduces your account security. Enter your password and a current code to continue.</Text>
                  </View>
                  <Text style={[tf2Styles.inputLabel, { color: theme.colors.muted }]}>Account password</Text>
                  <TextInput
                    style={[tf2Styles.fieldInput, { borderColor: theme.colors.border, color: theme.colors.primary, backgroundColor: theme.colors.surface }]}
                    placeholder="Enter your password"
                    placeholderTextColor="#94A3B8"
                    secureTextEntry
                    value={currentPassword}
                    onChangeText={setCurrentPassword}
                  />
                  <Text style={[tf2Styles.inputLabel, { color: theme.colors.muted }]}>Authenticator code</Text>
                  <TextInput
                    style={[tf2Styles.codeInput, { borderColor: theme.colors.border, color: theme.colors.primary, backgroundColor: theme.colors.surface }]}
                    placeholder="• • • • • •"
                    placeholderTextColor="#94A3B8"
                    keyboardType="number-pad"
                    maxLength={6}
                    value={disableCode}
                    onChangeText={setDisableCode}
                    textAlign="center"
                  />
                  <View style={tf2Styles.disableBtnRow}>
                    <TouchableOpacity style={[tf2Styles.cancelBtn, { borderColor: theme.colors.border }]} onPress={() => setMode('idle')}>
                      <Text style={[tf2Styles.cancelBtnText, { color: theme.colors.muted }]}>Cancel</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[tf2Styles.destructiveBtn, { flex: 1 }]}
                      activeOpacity={0.85}
                      onPress={() => void confirmDisable()}
                      disabled={isBusy}
                    >
                      {isBusy ? <ActivityIndicator color="#FFFFFF" size="small" /> : <Text style={tf2Styles.destructiveBtnText}>Disable</Text>}
                    </TouchableOpacity>
                  </View>
                </View>
              )}
            </View>
          )}
        </View>

        {/* ══════════════════════════════════════
            METHOD 2 — Email sign-in codes
        ══════════════════════════════════════ */}
        <View style={[tf2Styles.methodCard, { backgroundColor: theme.colors.surface, borderColor: email2faEnabled ? 'rgba(63,114,175,0.35)' : theme.colors.border, shadowColor: theme.colors.shadow, marginTop: 14 }]}>
          {/* Card header */}
          <View style={tf2Styles.methodCardHeader}>
            <View style={[tf2Styles.methodIconWrap, { backgroundColor: email2faEnabled ? 'rgba(63,114,175,0.12)' : theme.colors.surfaceMuted ?? theme.colors.border + '33' }]}>
              <MaterialIcons name="mail-outline" size={24} color={email2faEnabled ? theme.colors.primary : theme.colors.muted} />
            </View>
            <View style={tf2Styles.methodMeta}>
              <Text style={[tf2Styles.methodTitle, { color: theme.colors.primary }]}>Email codes</Text>
              <Text style={[tf2Styles.methodDesc, { color: theme.colors.muted }]}>One-time code sent to your verified email on sign-in</Text>
            </View>
            <View style={[tf2Styles.statusPill, email2faEnabled ? tf2Styles.statusPillOn : tf2Styles.statusPillOff]}>
              <View style={[tf2Styles.statusDot, email2faEnabled ? tf2Styles.statusDotOn : tf2Styles.statusDotOff]} />
              <Text style={[tf2Styles.statusPillText, { color: email2faEnabled ? '#15803D' : '#92400E' }]}>{isLoading ? '…' : email2faEnabled ? 'ON' : 'OFF'}</Text>
            </View>
          </View>

          <View style={[tf2Styles.divider, { backgroundColor: theme.colors.border }]} />

          <View style={tf2Styles.methodBody}>
            {!profile?.is_email_verified ? (
              <View style={[tf2Styles.warningBox, { borderColor: 'rgba(180,83,9,0.2)', backgroundColor: 'rgba(255,251,235,0.95)' }]}>
                <MaterialIcons name="info-outline" size={16} color="#B45309" />
                <Text style={[tf2Styles.warningText, { color: '#92400E' }]}>Your email address must be verified before enabling this option.</Text>
              </View>
            ) : null}

            {!email2faEnabled ? (
              <View style={tf2Styles.setupFlow}>
                <Text style={[tf2Styles.inputLabel, { color: theme.colors.muted }]}>Confirm password to enable</Text>
                <TextInput
                  style={[tf2Styles.fieldInput, { borderColor: theme.colors.border, color: theme.colors.primary, backgroundColor: theme.colors.surface }]}
                  placeholder="Account password"
                  placeholderTextColor="#94A3B8"
                  secureTextEntry
                  value={emailEnablePassword}
                  onChangeText={setEmailEnablePassword}
                />
                <TouchableOpacity
                  style={[tf2Styles.actionBtn, { backgroundColor: theme.colors.primary, opacity: (!profile?.is_email_verified || isBusy) ? 0.6 : 1 }]}
                  activeOpacity={0.85}
                  onPress={() => void confirmEnableEmail2fa()}
                  disabled={isBusy || !profile?.is_email_verified}
                >
                  {isBusy ? (
                    <ActivityIndicator color="#FFFFFF" size="small" />
                  ) : (
                    <>
                      <MaterialIcons name="mark-email-read" size={18} color="#FFFFFF" />
                      <Text style={tf2Styles.actionBtnText}>Enable email codes</Text>
                    </>
                  )}
                </TouchableOpacity>
              </View>
            ) : (
              <View style={tf2Styles.setupFlow}>
                <View style={[tf2Styles.warningBox, { borderColor: 'rgba(185,28,28,0.2)', backgroundColor: 'rgba(254,242,242,0.9)' }]}>
                  <MaterialIcons name="warning-amber" size={16} color="#B91C1C" />
                  <Text style={tf2Styles.warningText}>Confirm your password to stop receiving email sign-in codes.</Text>
                </View>
                <Text style={[tf2Styles.inputLabel, { color: theme.colors.muted }]}>Account password</Text>
                <TextInput
                  style={[tf2Styles.fieldInput, { borderColor: theme.colors.border, color: theme.colors.primary, backgroundColor: theme.colors.surface }]}
                  placeholder="Enter your password"
                  placeholderTextColor="#94A3B8"
                  secureTextEntry
                  value={emailDisablePassword}
                  onChangeText={setEmailDisablePassword}
                />
                <TouchableOpacity
                  style={[tf2Styles.destructiveBtn]}
                  activeOpacity={0.85}
                  onPress={() => void confirmDisableEmail2fa()}
                  disabled={isBusy}
                >
                  {isBusy ? <ActivityIndicator color="#FFFFFF" size="small" /> : <Text style={tf2Styles.destructiveBtnText}>Disable email codes</Text>}
                </TouchableOpacity>
              </View>
            )}
          </View>
        </View>

        {/* ── Security tip ── */}
        <View style={[tf2Styles.tipCard, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
          <MaterialIcons name="lightbulb-outline" size={18} color={theme.colors.primary} style={{ marginTop: 1 }} />
          <Text style={[tf2Styles.tipText, { color: theme.colors.muted }]}>
            <Text style={{ fontWeight: '700', color: theme.colors.primary }}>Tip: </Text>
            Using both methods gives you a backup if you lose access to one. We recommend keeping at least one enabled.
          </Text>
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

function ThemeSettingsScreen({ navigation, route, onOpenHomeNotifications }: ScreenProps) {
  const { theme, themeKey, themeOptions, setThemeKey } = useAppTheme();
  const initials = 'GV';
  const profileImageUrl = route?.params?.profileImageUrl ?? null;

  return (
    <Shell navigation={navigation} title="Theme" initials={initials} profileImageUrl={profileImageUrl} onOpenHomeNotifications={onOpenHomeNotifications}>
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
  avatarSmallImg: {
    width: 32,
    height: 32,
    borderRadius: 16,
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
  biometricSectionLead: {
    fontSize: 12,
    fontWeight: '700',
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 2,
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

/* ─────────────────────────────────────────────────────────────
   TwoFactorSettingsScreen dedicated styles
───────────────────────────────────────────────────────────── */
const tf2Styles = StyleSheet.create({
  /* Hero banner */
  heroBanner: {
    borderRadius: 16,
    padding: 18,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
    overflow: 'hidden',
    shadowOpacity: 0.18,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  heroGlow: {
    position: 'absolute',
    top: -30,
    right: -20,
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: 'rgba(255,255,255,0.07)',
  },
  heroLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    flex: 1,
  },
  heroIconWrap: {
    width: 50,
    height: 50,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroTextWrap: {
    flex: 1,
    gap: 3,
  },
  heroTitle: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: -0.2,
  },
  heroSub: {
    color: 'rgba(255,255,255,0.75)',
    fontSize: 12,
    fontWeight: '500',
    lineHeight: 17,
  },
  heroBadge: {
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 5,
    marginLeft: 10,
  },
  heroBadgeText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },

  /* Error banner */
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(254,242,242,0.95)',
    borderWidth: 1,
    borderColor: 'rgba(220,38,38,0.25)',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 14,
  },
  errorBannerText: {
    flex: 1,
    color: '#B91C1C',
    fontSize: 12,
    fontWeight: '600',
    lineHeight: 17,
  },

  /* Method card */
  methodCard: {
    borderWidth: 1,
    borderRadius: 16,
    overflow: 'hidden',
    shadowOpacity: 0.07,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  methodCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 16,
  },
  methodIconWrap: {
    width: 46,
    height: 46,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  methodMeta: {
    flex: 1,
    gap: 2,
  },
  methodTitle: {
    fontSize: 15,
    fontWeight: '800',
    letterSpacing: -0.1,
  },
  methodDesc: {
    fontSize: 11,
    lineHeight: 16,
  },

  /* Status pill */
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
  },
  statusPillOn: {
    backgroundColor: '#DCFCE7',
  },
  statusPillOff: {
    backgroundColor: '#FEF3C7',
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  statusDotOn: {
    backgroundColor: '#16A34A',
  },
  statusDotOff: {
    backgroundColor: '#D97706',
  },
  statusPillText: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },

  divider: {
    height: 1,
  },

  /* Method body */
  methodBody: {
    padding: 16,
    gap: 12,
  },
  setupFlow: {
    gap: 12,
  },
  disableFlow: {
    gap: 12,
  },

  /* Step indicator */
  stepRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  stepDot: {
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 1,
  },
  stepNum: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '900',
  },
  stepLabel: {
    flex: 1,
    fontSize: 12,
    lineHeight: 18,
    fontWeight: '500',
  },

  /* QR code frame */
  qrFrame: {
    alignSelf: 'center',
    borderWidth: 1,
    borderRadius: 16,
    padding: 12,
    shadowOpacity: 0.08,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  qrImg: {
    width: 200,
    height: 200,
    borderRadius: 8,
  },

  /* Secret box */
  secretBox: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 6,
  },
  secretLabel: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  secretCode: {
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 1,
  },

  /* Inputs */
  inputLabel: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    marginBottom: -4,
  },
  fieldInput: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 14,
  },
  codeInput: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 14,
    fontSize: 22,
    fontWeight: '800',
    letterSpacing: 8,
  },

  /* Action button (primary) */
  actionBtn: {
    borderRadius: 12,
    paddingVertical: 13,
    paddingHorizontal: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    shadowOpacity: 0.12,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 },
    elevation: 2,
  },
  actionBtnOutline: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    shadowOpacity: 0,
    elevation: 0,
  },
  actionBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '800',
    letterSpacing: 0.2,
  },

  /* Destructive button */
  destructiveBtn: {
    borderRadius: 12,
    paddingVertical: 13,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#B91C1C',
  },
  destructiveBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '800',
  },

  /* Cancel link / button */
  cancelLink: {
    alignSelf: 'center',
    paddingVertical: 4,
  },
  cancelLinkText: {
    fontSize: 13,
    fontWeight: '600',
    textDecorationLine: 'underline',
  },
  cancelBtn: {
    borderWidth: 1,
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelBtnText: {
    fontSize: 14,
    fontWeight: '700',
  },

  /* Disable button row */
  disableBtnRow: {
    flexDirection: 'row',
    gap: 10,
  },

  /* Warning box */
  warningBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  warningText: {
    flex: 1,
    fontSize: 12,
    fontWeight: '500',
    lineHeight: 18,
    color: '#7F1D1D',
  },

  /* Tip card */
  tipCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginTop: 14,
  },
  tipText: {
    flex: 1,
    fontSize: 12,
    lineHeight: 18,
    fontWeight: '500',
  },
});

/* ─────────────────────────────────────────────────────────────
   ProfileHomeScreen dedicated styles
───────────────────────────────────────────────────────────── */
const phStyles = StyleSheet.create({
  listContent: {
    paddingHorizontal: 16,
    paddingBottom: 32,
  },

  /* ── Hero banner ── */
  heroCard: {
    borderRadius: 20,
    overflow: 'hidden',
    marginBottom: 4,
    paddingBottom: 28,
    paddingTop: 8,
    shadowOpacity: 0.18,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 5 },
    elevation: 5,
  },
  heroGlow: {
    position: 'absolute',
    top: -50,
    left: -50,
    width: 180,
    height: 180,
    borderRadius: 90,
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  heroGlow2: {
    position: 'absolute',
    bottom: -30,
    right: -30,
    width: 130,
    height: 130,
    borderRadius: 65,
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  heroCenterContent: {
    alignItems: 'center',
    paddingTop: 28,
    gap: 5,
  },
  avatarWrap: {
    position: 'relative',
    alignSelf: 'center',
    marginBottom: 6,
  },
  avatarRing: {
    width: 96,
    height: 96,
    borderRadius: 48,
    borderWidth: 2.5,
    borderColor: 'rgba(255,255,255,0.38)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarImg: {
    width: 82,
    height: 82,
    borderRadius: 41,
  },
  avatarCircle: {
    width: 82,
    height: 82,
    borderRadius: 41,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarInitials: {
    color: '#FFFFFF',
    fontSize: 30,
    fontWeight: '900',
    letterSpacing: -0.5,
  },
  avatarCameraBtn: {
    position: 'absolute',
    bottom: 2,
    right: 0,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(15,23,42,0.82)',
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.28)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroName: {
    color: '#FFFFFF',
    fontSize: 21,
    fontWeight: '800',
    letterSpacing: -0.4,
    textAlign: 'center',
  },
  heroEmail: {
    color: 'rgba(255,255,255,0.68)',
    fontSize: 13,
    fontWeight: '500',
    textAlign: 'center',
  },
  heroPillRow: {
    flexDirection: 'row',
    gap: 8,
    flexWrap: 'wrap',
    justifyContent: 'center',
    marginTop: 6,
    paddingHorizontal: 16,
  },
  rolePill: {
    backgroundColor: 'rgba(255,255,255,0.18)',
    borderRadius: 20,
    paddingHorizontal: 11,
    paddingVertical: 4,
  },
  rolePillText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  fa2Pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  fa2PillOn: { backgroundColor: '#DCFCE7' },
  fa2PillOff: { backgroundColor: '#FEF3C7' },
  fa2PillText: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  verifiedPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#DBEAFE',
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  verifiedPillText: {
    color: '#1D4ED8',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },

  /* ── Section layout ── */
  sectionHeader: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.3,
    textTransform: 'uppercase',
    paddingHorizontal: 4,
    marginTop: 22,
    marginBottom: 8,
  },
  sectionCard: {
    borderWidth: 1,
    borderRadius: 16,
    overflow: 'hidden',
    shadowOpacity: 0.06,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(254,242,242,0.95)',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    margin: 12,
    marginBottom: 0,
  },
  errorBannerText: {
    flex: 1,
    color: '#B91C1C',
    fontSize: 12,
    fontWeight: '600',
    lineHeight: 17,
  },

  /* ── PhRow / PhToggleRow ── */
  phRow: {
    borderTopWidth: 1,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  phRowFirst: {
    borderTopWidth: 0,
  },
  phRowInner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  phIconCircle: {
    width: 42,
    height: 42,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
  },
  phRowTextWrap: {
    flex: 1,
    gap: 2,
  },
  phRowLabel: {
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: -0.1,
  },
  phRowDesc: {
    fontSize: 12,
    lineHeight: 17,
  },
  phRowRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  phRowValue: {
    fontSize: 12,
    fontWeight: '600',
  },

  /* Inline badges */
  phBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 20,
  },
  phBadgeGreen: { backgroundColor: '#DCFCE7' },
  phBadgeAmber: { backgroundColor: '#FEF3C7' },
  phBadgeBlue: { backgroundColor: '#DBEAFE' },
  phBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },

  /* ── Footer ── */
  footerArea: {
    marginTop: 14,
    gap: 16,
    paddingBottom: 12,
  },
  signOutBtn: {
    borderWidth: 1,
    borderRadius: 16,
    paddingVertical: 14,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    shadowOpacity: 0.06,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  signOutIconWrap: {
    width: 38,
    height: 38,
    borderRadius: 11,
    backgroundColor: 'rgba(239,83,80,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  signOutText: {
    flex: 1,
    color: '#EF5350',
    fontSize: 15,
    fontWeight: '800',
    letterSpacing: 0.1,
  },
  versionFooter: {
    fontSize: 12,
    textAlign: 'center',
    letterSpacing: 0.4,
  },
});