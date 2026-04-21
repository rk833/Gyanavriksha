import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Image, Modal, Pressable, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { DefaultTheme, NavigationContainer } from '@react-navigation/native';
import { BottomTabBarProps, createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { MaterialIcons } from '@expo/vector-icons';
import * as SecureStore from 'expo-secure-store';
import axios from 'axios';

import { API_BASE_URL } from '../config/api';
import { useAppTheme } from '../context/ThemeContext';
import LoginScreen from '../screens/auth/LoginScreen';
import TwoFactorScreen from '../screens/auth/TwoFactorScreen';
import QRLoginScreen from '../screens/auth/QRLoginScreen';
import DashboardScreen from '../screens/student/DashboardScreen';
import ProfileStack from '../screens/student/ProfileScreen';
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
function decodeJwtPayload(token: string): Record<string, unknown> | null {
  const parts = token.split('.');
  if (parts.length !== 3) {
    return null;
  }

  try {
  const payloadBase64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
  const paddedPayload = payloadBase64.padEnd(payloadBase64.length + ((4 - (payloadBase64.length % 4)) % 4), '=');
  const jsonPayload = globalThis.atob(paddedPayload);
    return JSON.parse(jsonPayload) as Record<string, unknown>;
  } catch {
    return null;
  }
}

function isTokenExpired(token: string) {
  const payload = decodeJwtPayload(token);
  const expValue = payload?.exp;
  return Date.now() >= expValue * 1000;
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

function AppTabs({ onLogout }: { onLogout: () => void }) {
  const { theme } = useAppTheme();
  const [unreadCount, setUnreadCount] = useState(0);
  const [isNotificationsVisible, setIsNotificationsVisible] = useState(false);
  const [isNotificationsLoading, setIsNotificationsLoading] = useState(false);
  const [notificationsError, setNotificationsError] = useState<string | null>(null);
  const [unreadNotifications, setUnreadNotifications] = useState<NotificationItem[]>([]);

  const fetchUnreadCount = useCallback(async () => {
    const token = await SecureStore.getItemAsync('access_token');
    if (!token) {
      setUnreadCount(0);
      return;
    }

    try {
      const response = await axios.get<UnreadCountResponse>(`${API_BASE_URL}/api/students/notifications/unread-count`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      setUnreadCount(typeof response.data?.count === 'number' ? response.data.count : 0);
    } catch {
      setUnreadCount(0);
    }
  }, []);

  const loadUnreadNotifications = useCallback(async () => {
    setNotificationsError(null);
    setIsNotificationsLoading(true);

    try {
      const token = await SecureStore.getItemAsync('access_token');
      if (!token) {
        setUnreadNotifications([]);
        return;
      }

      const response = await axios.get<PaginatedNotificationsResponse>(`${API_BASE_URL}/api/students/notifications?read=false&page=1&per_page=20`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

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
    <>
    <Tab.Navigator
        tabBar={(props) => <GlobalBottomTabBar {...props} />}
        screenOptions={({ route, navigation }) => ({
          headerShown: route.name !== 'Profile',
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
          {() => <PlaceholderScreen title="CameraScreen" />}
        </Tab.Screen>
        <Tab.Screen name="Chat" options={{ title: 'Chat' }}>
          {() => <PlaceholderScreen title="ChatbotScreen" />}
        </Tab.Screen>
        <Tab.Screen name="History" options={{ title: 'History' }}>
          {() => <PlaceholderScreen title="HistoryScreen" />}
        </Tab.Screen>
        <Tab.Screen name="Profile" options={{ title: 'Profile' }}>
          {() => <ProfileStack onLogout={onLogout} onOpenHomeNotifications={openNotifications} />}
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
    </Stack.Navigator>
  );
}

export default function AppNavigator() {
  const { theme } = useAppTheme();
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [sessionMessage, setSessionMessage] = useState<string | null>(null);

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

  useEffect(() => {
    let active = true;

    const bootstrap = async () => {
      const primaryToken = await SecureStore.getItemAsync('access_token');
      const fallbackToken = primaryToken ?? (await SecureStore.getItemAsync('auth_token'));

      if (!active) {
        return;
      }

      const hasStoredToken = typeof fallbackToken === 'string' && fallbackToken.length > 0;
      const tokenExpired = hasStoredToken && isTokenExpired(fallbackToken);
      const hasValidToken = hasStoredToken && !tokenExpired;
      setIsAuthenticated(hasValidToken);
      setSessionMessage(tokenExpired ? 'Your session has expired. Please log in again.' : null);
      setIsCheckingAuth(false);

      if (!hasValidToken) {
        await SecureStore.deleteItemAsync('access_token');
        await SecureStore.deleteItemAsync('auth_token');
      }
    };

    void bootstrap();

    return () => {
      active = false;
    };
  }, []);

  if (isCheckingAuth) {
    return (
      <View style={[styles.loaderWrap, { backgroundColor: theme.colors.screen }]}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
      </View>
    );
  }

  return (
    <NavigationContainer theme={navigationTheme}>
      {isAuthenticated ? (
        <AppTabs
          onLogout={() => {
            setIsAuthenticated(false);
            setSessionMessage('Your session has ended. Please log in again.');
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
