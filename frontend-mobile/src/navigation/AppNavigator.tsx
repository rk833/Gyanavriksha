import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Image, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { DefaultTheme, NavigationContainer } from '@react-navigation/native';
import { StatusBar } from 'expo-status-bar';
import { BottomTabBarProps, createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { MaterialIcons } from '@expo/vector-icons';
import * as SecureStore from 'expo-secure-store';
import axios from 'axios';

import { apiClient, clearStoredAuthTokens, subscribeSessionExpired } from '../api/client';
import { useAppTheme } from '../context/ThemeContext';
import {
  isAccessTokenExpired,
  isBiometricSignInEnabled,
  refreshSessionWithStoredRefreshToken,
} from '../services/biometricAuth';
import SplashScreen from '../screens/SplashScreen';
import ForgotPasswordScreen from '../screens/auth/ForgotPasswordScreen';
import ForceChangePasswordScreen from '../screens/auth/ForceChangePasswordScreen';
import LoginScreen from '../screens/auth/LoginScreen';
import TwoFactorScreen from '../screens/auth/TwoFactorScreen';
import QRLoginScreen from '../screens/auth/QRLoginScreen';
import AssignmentPickerScreen from '../screens/student/AssignmentPickerScreen';
import CameraScreen from '../screens/student/CameraScreen';
import ChatbotScreen from '../screens/student/ChatbotScreen';
import DashboardScreen from '../screens/student/DashboardScreen';
import ExamModeScreen from '../screens/student/ExamModeScreen';
import HelpScreen from '../screens/student/HelpScreen';
import IoTStatusScreen from '../screens/student/IoTStatusScreen';
import LibraryScreen from '../screens/student/LibraryScreen';
import NotificationsScreen from '../screens/student/NotificationsScreen';
import PerformanceScreen from '../screens/student/PerformanceScreen';
import ProfileStack from '../screens/student/ProfileScreen';
import QuizAndGapsScreen from '../screens/student/QuizAndGapsScreen';
import { StudentIotRealtimeProvider } from '../context/StudentIotRealtimeContext';
import SubmissionDetailsScreen from '../screens/student/SubmissionDetailsScreen';
import SubmissionProgressScreen from '../screens/student/SubmissionProgressScreen';
import SubmissionResultScreen from '../screens/student/SubmissionResultScreen';
import SubmissionsListScreen from '../screens/student/SubmissionsListScreen';
import UploadScreen from '../screens/student/UploadScreen';
const Tab = createBottomTabNavigator();
const Stack = createNativeStackNavigator();

const BADGE_RED = '#DC2626';
const POLL_INTERVAL_MS = 60000;

type UnreadCountResponse = {
  count: number;
};

type NotificationItem = {
  notification_id: string;
  title: string;
  body: string;
  is_read: boolean;
  created_at: string;
};

type PaginatedNotificationsResponse = {
  items: NotificationItem[];
  total: number;
  page: number;
  per_page: number;
  total_pages: number;
};

function formatNotificationDate(rawValue: string) {
  const parsedDate = new Date(rawValue);
  if (Number.isNaN(parsedDate.getTime())) {
    return rawValue;
  }

  return parsedDate.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
  });
}

function PlaceholderScreen({ title }: { title: string }) {
  const { theme } = useAppTheme();

  return (
    <View style={[styles.placeholderContainer, { backgroundColor: theme.colors.screen }]}>
      <Text style={[styles.placeholderTitle, { color: theme.colors.text }]}>{title}</Text>
      <Text style={[styles.placeholderSubtitle, { color: theme.colors.muted }]}>This page will be implemented next.</Text>
    </View>
  );
}

function GlobalBottomTabBar({ state, navigation }: BottomTabBarProps) {
  const { theme } = useAppTheme();

  const focusedRouteName = state.routes[state.index]?.name;
  const HIDDEN_SCREENS = new Set([
    'CameraScreen',
    'UploadScreen',
    'SubmissionDetailsScreen',
    'SubmissionProgressScreen',
    'SubmissionResultScreen',
    'IoTStatusScreen',
    'ExamModeScreen',
    'PerformanceScreen',
    'LibraryScreen',
    'NotificationsScreen',
    'SubmissionsListScreen',
    'HelpScreen',
    'QRLoginScreen',
  ]);
  if (HIDDEN_SCREENS.has(focusedRouteName ?? '')) {
    return null;
  }

  const tabItems = [
    { key: 'Home', icon: 'home', label: 'Home', capture: false },
    { key: 'History', icon: 'quiz', label: 'Quizzes', capture: false },
    { key: 'Submit', icon: 'photo-camera', label: 'Capture', capture: true },
    { key: 'Chat', icon: 'chat-bubble-outline', label: 'Chat', capture: false },
    { key: 'Profile', icon: 'person', label: 'Profile', capture: false },
  ] as const;

  return (
    <View
      style={[
        styles.bottomBar,
        {
          backgroundColor: theme.colors.surface,
          borderTopColor: theme.colors.headerBorder,
          shadowColor: theme.colors.shadow,
        },
      ]}
    >
      {tabItems.map((item) => {
        const routeIndex = state.routes.findIndex((route) => route.name === item.key);
        const isFocused = routeIndex >= 0 && state.index === routeIndex;

        if (item.capture) {
          return (
            <TouchableOpacity
              key={item.key}
              style={styles.captureTab}
              activeOpacity={0.85}
              onPress={() => {
                navigation.navigate(item.key as never);
              }}
            >
              <View style={[styles.captureButton, { backgroundColor: theme.colors.primary, shadowColor: theme.colors.shadow }]}>
                <MaterialIcons name="photo-camera" size={26} color="#FFFFFF" />
              </View>
              <Text style={[styles.captureLabel, { color: theme.colors.muted }]}>{item.label}</Text>
            </TouchableOpacity>
          );
        }

        return (
          <TouchableOpacity
            key={item.key}
            style={styles.tabItem}
            activeOpacity={0.85}
            onPress={() => {
              const event = navigation.emit({
                type: 'tabPress',
                target: state.routes[routeIndex]?.key,
                canPreventDefault: true,
              });

              if (!isFocused && !event.defaultPrevented) {
                navigation.navigate(item.key as never);
              }
            }}
          >
            <MaterialIcons name={item.icon as keyof typeof MaterialIcons.glyphMap} size={24} color={isFocused ? theme.colors.primary : theme.colors.inactive} />
            <Text
              style={[
                styles.tabLabel,
                isFocused ? styles.tabLabelActive : { color: theme.colors.muted },
                isFocused ? { color: theme.colors.primary } : null,
              ]}
            >
              {item.label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

function AppTabs({ onLogout }: { onLogout: () => void | Promise<void> }) {
  const { theme } = useAppTheme();
  const [unreadCount, setUnreadCount] = useState(0);
  const [isNotificationsVisible, setIsNotificationsVisible] = useState(false);
  const [isNotificationsLoading, setIsNotificationsLoading] = useState(false);
  const [notificationsError, setNotificationsError] = useState<string | null>(null);
  const [unreadNotifications, setUnreadNotifications] = useState<NotificationItem[]>([]);

  const fetchUnreadCount = useCallback(async () => {
    try {
      const response = await apiClient.get<UnreadCountResponse>('/api/students/notifications/unread-count');
      setUnreadCount(typeof response.data?.count === 'number' ? response.data.count : 0);
    } catch {
      setUnreadCount(0);
    }
  }, []);

  const loadUnreadNotifications = useCallback(async () => {
    setNotificationsError(null);
    setIsNotificationsLoading(true);

    try {
      const response = await apiClient.get<PaginatedNotificationsResponse>(
        '/api/students/notifications?read=false&page=1&per_page=20'
      );

      setUnreadNotifications(response.data?.items ?? []);
    } catch (error) {
      let message = 'Unable to load unread notifications right now.';

      if (axios.isAxiosError(error)) {
        const detail = error.response?.data?.detail;
        if (typeof detail === 'string' && detail.trim().length > 0) {
          message = detail;
        }
      } else if (error instanceof Error && error.message.trim().length > 0) {
        message = error.message;
      }

      setNotificationsError(message);
    } finally {
      setIsNotificationsLoading(false);
    }
  }, []);

  const openNotifications = useCallback(async () => {
    setIsNotificationsVisible(true);
    await loadUnreadNotifications();
  }, [loadUnreadNotifications]);

  const closeNotifications = useCallback(() => {
    setIsNotificationsVisible(false);
  }, []);

  useEffect(() => {
    void fetchUnreadCount();

    const intervalId = setInterval(() => {
      void fetchUnreadCount();
    }, POLL_INTERVAL_MS);

    return () => {
      clearInterval(intervalId);
    };
  }, [fetchUnreadCount]);

  const homeBadge = useMemo(() => {
    if (unreadCount <= 0) {
      return undefined;
    }

    return unreadCount > 99 ? '99+' : unreadCount;
  }, [unreadCount]);

  return (
    <StudentIotRealtimeProvider>
    <>
    <Tab.Navigator
        tabBar={(props) => <GlobalBottomTabBar {...props} />}
        screenOptions={({ route, navigation }) => ({
          headerShown: false,
          headerStyle: {
            backgroundColor: theme.colors.surface,
            borderBottomWidth: 1,
            borderBottomColor: theme.colors.headerBorder,
          },
          headerShadowVisible: false,
          headerRightContainerStyle: {
            paddingRight: 12,
          },
          headerTitleAlign: 'left',
          headerTitle: () => (
            <View style={styles.headerTitleRow}>
              <Image source={require('../../assets/logo-icon.png')} style={styles.headerLogo} resizeMode="contain" />
              <Text style={[styles.headerBrandText, { color: theme.colors.primary }]}>Gyanavriksha</Text>
            </View>
          ),
          headerRight: () => (
            <TouchableOpacity
              style={[styles.headerBellButton, { backgroundColor: theme.colors.primarySoft }]}
              activeOpacity={0.8}
              onPress={() => void openNotifications()}
            >
              <MaterialIcons name="notifications-none" size={20} color={theme.colors.primary} />
              {unreadCount > 0 ? (
                <View style={styles.headerBadge}>
                  <Text style={styles.headerBadgeText}>{unreadCount > 99 ? '99+' : unreadCount}</Text>
                </View>
              ) : null}
            </TouchableOpacity>
          ),
          tabBarIcon: ({ color, size }) => {
            const iconSize = size ?? 22;

            if (route.name === 'Home') {
              return <MaterialIcons name="home" size={iconSize} color={color} />;
            }
            if (route.name === 'Submit') {
              return <MaterialIcons name="photo-camera" size={iconSize} color={color} />;
            }
            if (route.name === 'Chat') {
              return <MaterialIcons name="chat-bubble-outline" size={iconSize} color={color} />;
            }
            if (route.name === 'History') {
              return <MaterialIcons name="history" size={iconSize} color={color} />;
            }

            return <MaterialIcons name="person-outline" size={iconSize} color={color} />;
          },
        })}
      >
        <Tab.Screen
          name="Home"
          options={{
            tabBarBadge: homeBadge,
            tabBarBadgeStyle: {
              backgroundColor: BADGE_RED,
              color: '#FFFFFF',
            },
          }}
        >
          {(props) => <DashboardScreen {...props} />}
        </Tab.Screen>
        <Tab.Screen name="Submit" options={{ title: 'Submit' }}>
          {(props) => <AssignmentPickerScreen {...props} />}
        </Tab.Screen>
        <Tab.Screen name="Chat" options={{ title: 'AI Tutor' }}>
          {() => <ChatbotScreen />}
        </Tab.Screen>
        <Tab.Screen name="History" options={{ title: 'Quizzes & Gaps' }}>
          {() => <QuizAndGapsScreen />}
        </Tab.Screen>
        <Tab.Screen name="Profile" options={{ title: 'Profile' }}>
          {() => <ProfileStack onLogout={onLogout} onOpenHomeNotifications={openNotifications} />}
        </Tab.Screen>
        <Tab.Screen
          name="CameraScreen"
          options={{
            title: 'CameraScreen',
            unmountOnBlur: true,
          } as any}
        >
          {(props) => <CameraScreen {...props} />}
        </Tab.Screen>
        <Tab.Screen
          name="SubmissionDetailsScreen"
          options={{ title: 'SubmissionDetailsScreen' }}
        >
          {(props) => <SubmissionDetailsScreen {...props} />}
        </Tab.Screen>
        <Tab.Screen
          name="UploadScreen"
          options={{ title: 'UploadScreen' }}
        >
          {(props) => <UploadScreen {...props} />}
        </Tab.Screen>
        <Tab.Screen
          name="SubmissionProgressScreen"
          options={{ title: 'SubmissionProgressScreen' }}
        >
          {(props) => <SubmissionProgressScreen {...props} />}
        </Tab.Screen>
        <Tab.Screen
          name="SubmissionResultScreen"
          options={{ title: 'SubmissionResultScreen' }}
        >
          {(props) => <SubmissionResultScreen {...props} />}
        </Tab.Screen>
        <Tab.Screen
          name="IoTStatusScreen"
          options={{ title: 'IoT Status', unmountOnBlur: true } as any}
        >
          {() => <IoTStatusScreen />}
        </Tab.Screen>
        <Tab.Screen
          name="ExamModeScreen"
          options={{ title: 'Exam Mode', unmountOnBlur: true } as any}
        >
          {(props) => <ExamModeScreen {...props} />}
        </Tab.Screen>
        <Tab.Screen
          name="PerformanceScreen"
          options={{ title: 'Performance' }}
        >
          {() => <PerformanceScreen />}
        </Tab.Screen>
        <Tab.Screen
          name="LibraryScreen"
          options={{ title: 'Library' }}
        >
          {() => <LibraryScreen />}
        </Tab.Screen>
        <Tab.Screen
          name="NotificationsScreen"
          options={{ title: 'Notifications' }}
        >
          {() => <NotificationsScreen />}
        </Tab.Screen>
        <Tab.Screen
          name="SubmissionsListScreen"
          options={{ title: 'My Submissions' }}
        >
          {() => <SubmissionsListScreen />}
        </Tab.Screen>
        <Tab.Screen
          name="HelpScreen"
          options={{ title: 'Help & FAQ' }}
        >
          {() => <HelpScreen />}
        </Tab.Screen>
        <Tab.Screen
          name="QRLoginScreen"
          options={{ title: 'Scan QR for web', unmountOnBlur: true } as any}
        >
          {(props) => (
            <QRLoginScreen
              {...props}
              onLoginSuccess={() => {
                props.navigation.goBack();
              }}
            />
          )}
        </Tab.Screen>
      </Tab.Navigator>

      <Modal visible={isNotificationsVisible} transparent animationType="slide" onRequestClose={closeNotifications}>
        <View style={styles.notificationBackdrop}>
          <Pressable style={styles.notificationDismissArea} onPress={closeNotifications} />

          <View style={styles.notificationSheet}>
            <View style={styles.notificationHeader}>
              <Text style={styles.notificationTitle}>Unread Notifications</Text>
              <TouchableOpacity style={styles.notificationCloseButton} onPress={closeNotifications} activeOpacity={0.8}>
                <Text style={styles.notificationCloseText}>Close</Text>
              </TouchableOpacity>
            </View>

            {isNotificationsLoading ? (
              <View style={styles.notificationLoadingWrap}>
                <ActivityIndicator color={theme.colors.primary} />
              </View>
            ) : notificationsError ? (
              <View style={styles.notificationErrorCard}>
                <Text style={styles.notificationErrorText}>{notificationsError}</Text>
                <TouchableOpacity
                  style={styles.notificationRetryButton}
                  activeOpacity={0.85}
                  onPress={() => {
                    void loadUnreadNotifications();
                  }}
                >
                  <Text style={styles.notificationRetryButtonText}>Retry</Text>
                </TouchableOpacity>
              </View>
            ) : unreadNotifications.length > 0 ? (
              <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.notificationList}>
                {unreadNotifications.map((notification) => (
                  <View key={notification.notification_id} style={styles.notificationItem}>
                    <Text style={styles.notificationItemTitle}>{notification.title}</Text>
                    <Text style={styles.notificationItemBody}>{notification.body}</Text>
                    <Text style={styles.notificationItemDate}>{formatNotificationDate(notification.created_at)}</Text>
                  </View>
                ))}
              </ScrollView>
            ) : (
              <Text style={styles.notificationEmpty}>No unread notifications.</Text>
            )}
          </View>
        </View>
      </Modal>
    </>
    </StudentIotRealtimeProvider>
  );
}

function LoginStack({ onAuthenticated, sessionMessage }: { onAuthenticated: () => void; sessionMessage: string | null }) {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="LoginScreen">
        {(props) => <LoginScreen {...props} onLoginSuccess={onAuthenticated} initialMessage={sessionMessage} />}
      </Stack.Screen>
      <Stack.Screen name="TwoFactorScreen">
        {(props) => <TwoFactorScreen {...props} onLoginSuccess={onAuthenticated} />}
      </Stack.Screen>
      <Stack.Screen name="QRLoginScreen">
        {(props) => <QRLoginScreen {...props} onLoginSuccess={onAuthenticated} />}
      </Stack.Screen>
      <Stack.Screen name="ForgotPasswordScreen">
        {(props) => <ForgotPasswordScreen {...props} />}
      </Stack.Screen>
      <Stack.Screen name="ForceChangePasswordScreen">
        {(props) => <ForceChangePasswordScreen {...props} onLoginSuccess={onAuthenticated} />}
      </Stack.Screen>
    </Stack.Navigator>
  );
}

export default function AppNavigator() {
  const { theme } = useAppTheme();
  const [showSplash, setShowSplash] = useState(true);
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [sessionMessage, setSessionMessage] = useState<string | null>(null);

  useEffect(() => {
    return subscribeSessionExpired(() => {
      setIsAuthenticated(false);
      setSessionMessage('Your session has expired. Please log in again.');
    });
  }, []);

  const navigationTheme = useMemo(
    () => ({
      ...DefaultTheme,
      dark: theme.key === 'dark',
      colors: {
        ...DefaultTheme.colors,
        primary: theme.colors.primary,
        background: theme.colors.screen,
        card: theme.colors.surface,
        text: theme.colors.text,
        border: theme.colors.border,
        notification: theme.colors.primarySoft,
      },
    }),
    [theme]
  );

  /** Match status bar to app theme. Splash uses light icons; without resetting here they stay light on a light screen. */
  const statusBarStyle = theme.key === 'dark' ? 'light' : 'dark';

  useEffect(() => {
    let active = true;

    const bootstrap = async () => {
      const access = await SecureStore.getItemAsync('access_token');
      const fallbackAccess = access ?? (await SecureStore.getItemAsync('auth_token'));

      if (!active) {
        return;
      }

      if (typeof fallbackAccess === 'string' && fallbackAccess.length > 0 && !isAccessTokenExpired(fallbackAccess)) {
        setIsAuthenticated(true);
        setSessionMessage(null);
        setIsCheckingAuth(false);
        return;
      }

      const refreshed = await refreshSessionWithStoredRefreshToken();
      if (refreshed) {
        setIsAuthenticated(true);
        setSessionMessage(null);
        setIsCheckingAuth(false);
        return;
      }

      setIsAuthenticated(false);
      setSessionMessage(
        typeof fallbackAccess === 'string' && fallbackAccess.length > 0
          ? 'Your session has expired. Please log in again.'
          : null
      );
      setIsCheckingAuth(false);

      await clearStoredAuthTokens();
    };

    void bootstrap();

    return () => {
      active = false;
    };
  }, []);

  if (showSplash) {
    return <SplashScreen onFinish={() => setShowSplash(false)} />;
  }

  if (isCheckingAuth) {
    return (
      <>
        <StatusBar
          style={statusBarStyle}
          backgroundColor={Platform.OS === 'android' ? theme.colors.screen : undefined}
        />
        <View style={[styles.loaderWrap, { backgroundColor: theme.colors.screen }]}>
          <ActivityIndicator size="large" color={theme.colors.primary} />
        </View>
      </>
    );
  }

  return (
    <>
      <StatusBar
        style={statusBarStyle}
        backgroundColor={Platform.OS === 'android' ? theme.colors.screen : undefined}
      />
      <NavigationContainer theme={navigationTheme}>
        {isAuthenticated ? (
          <AppTabs
            onLogout={async () => {
              const preserveQuickSignIn = await isBiometricSignInEnabled();
              await clearStoredAuthTokens(preserveQuickSignIn);
              setIsAuthenticated(false);
              setSessionMessage(
                preserveQuickSignIn
                  ? 'Signed out on this device. Use quick sign-in or your email and password below.'
                  : 'Your session has ended. Please log in again.'
              );
            }}
          />
        ) : (
          <LoginStack
            onAuthenticated={() => {
              setIsAuthenticated(true);
            }}
            sessionMessage={sessionMessage}
          />
        )}
      </NavigationContainer>
    </>
  );
}

const styles = StyleSheet.create({
  placeholderContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  placeholderTitle: {
    fontSize: 24,
    fontWeight: '800',
    textAlign: 'center',
  },
  placeholderSubtitle: {
    marginTop: 10,
    fontSize: 14,
    textAlign: 'center',
  },
  headerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerLogo: {
    width: 32,
    height: 32,
  },
  headerBrandText: {
    fontSize: 18,
    fontWeight: '800',
  },
  headerBellButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  headerBadge: {
    position: 'absolute',
    top: -4,
    right: -4,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    paddingHorizontal: 3,
    backgroundColor: '#B91C1C',
    borderWidth: 1,
    borderColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerBadgeText: {
    color: '#FFFFFF',
    fontSize: 8,
    lineHeight: 10,
    fontWeight: '700',
  },
  notificationBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.32)',
    justifyContent: 'flex-end',
  },
  notificationDismissArea: {
    flex: 1,
  },
  notificationSheet: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 18,
    paddingTop: 16,
    paddingBottom: 24,
    minHeight: '48%',
  },
  notificationHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  notificationTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#123A5F',
  },
  notificationCloseButton: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: '#F1E8D8',
  },
  notificationCloseText: {
    color: '#123A5F',
    fontSize: 13,
    fontWeight: '700',
  },
  notificationLoadingWrap: {
    minHeight: 160,
    alignItems: 'center',
    justifyContent: 'center',
  },
  notificationErrorCard: {
    borderWidth: 1,
    borderColor: '#FECACA',
    backgroundColor: '#FFF1F2',
    borderRadius: 16,
    padding: 14,
    gap: 10,
  },
  notificationErrorText: {
    color: '#9F1239',
    fontSize: 14,
    lineHeight: 20,
  },
  notificationRetryButton: {
    alignSelf: 'flex-start',
    backgroundColor: '#123A5F',
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 9,
  },
  notificationRetryButtonText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
  notificationList: {
    gap: 10,
    paddingBottom: 10,
  },
  notificationItem: {
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 16,
    padding: 14,
    gap: 6,
    backgroundColor: '#FAFAF7',
  },
  notificationItemTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#123A5F',
  },
  notificationItemBody: {
    fontSize: 13,
    lineHeight: 18,
    color: '#475569',
  },
  notificationItemDate: {
    fontSize: 11,
    fontWeight: '700',
    color: '#64748B',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  notificationEmpty: {
    color: '#64748B',
    fontSize: 14,
    textAlign: 'center',
    paddingVertical: 28,
  },
  bottomBar: {
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
  loaderWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
