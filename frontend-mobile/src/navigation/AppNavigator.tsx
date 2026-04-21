import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { MaterialIcons } from '@expo/vector-icons';
import * as SecureStore from 'expo-secure-store';
import axios from 'axios';

import { API_BASE_URL } from '../config/api';
import LoginScreen from '../screens/auth/LoginScreen';
import TwoFactorScreen from '../screens/auth/TwoFactorScreen';
import QRLoginScreen from '../screens/auth/QRLoginScreen';
import DashboardScreen from '../screens/student/DashboardScreen';

const Tab = createBottomTabNavigator();
const Stack = createNativeStackNavigator();

const ACTIVE_TINT = '#123A5F';
const INACTIVE_TINT = '#94A3B8';
const BADGE_RED = '#DC2626';
const POLL_INTERVAL_MS = 60000;

type UnreadCountResponse = {
  count: number;
};

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

  if (typeof expValue !== 'number') {
    return true;
  }

  return Date.now() >= expValue * 1000;
}

function PlaceholderScreen({ title }: { title: string }) {
  return (
    <View style={styles.placeholderContainer}>
      <Text style={styles.placeholderTitle}>{title}</Text>
      <Text style={styles.placeholderSubtitle}>This page will be implemented next.</Text>
    </View>
  );
}

function AppTabs() {
  const [unreadCount, setUnreadCount] = useState(0);

  const fetchUnreadCount = useCallback(async () => {
    const token = await SecureStore.getItemAsync('access_token');
    if (!token) {
      setUnreadCount(0);
      return;
    }

    try {
      const response = await axios.get<UnreadCountResponse>(
        `${API_BASE_URL}/api/students/notifications/unread-count`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      setUnreadCount(typeof response.data?.count === 'number' ? response.data.count : 0);
    } catch {
      setUnreadCount(0);
    }
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
    <Tab.Navigator
      screenOptions={({ route, navigation }) => ({
        headerShown: true,
        headerStyle: {
          backgroundColor: '#FFFFFF',
          borderBottomWidth: 1,
          borderBottomColor: '#E6E1D8',
        },
        headerShadowVisible: false,
        headerRightContainerStyle: {
          paddingRight: 12,
        },
        headerTitleAlign: 'left',
        headerTitle: () => (
          <View style={styles.headerTitleRow}>
            <Image source={require('../../assets/logo-icon.png')} style={styles.headerLogo} resizeMode="contain" />
            <Text style={styles.headerBrandText}>Gyanavriksha</Text>
          </View>
        ),
        headerRight: ({ tintColor }) => (
          <TouchableOpacity
            style={styles.headerBellButton}
            activeOpacity={0.8}
            onPress={() => {
              if (route.name === 'Home') {
                navigation.setParams({ openNotificationsAt: Date.now() });
                return;
              }

              navigation.navigate('Home', { openNotificationsAt: Date.now() });
            }}
          >
            <MaterialIcons name="notifications-none" size={20} color={tintColor ?? '#123A5F'} />
            {unreadCount > 0 ? (
              <View style={styles.headerBadge}>
                <Text style={styles.headerBadgeText}>{unreadCount > 99 ? '99+' : unreadCount}</Text>
              </View>
            ) : null}
          </TouchableOpacity>
        ),
        tabBarActiveTintColor: ACTIVE_TINT,
        tabBarInactiveTintColor: INACTIVE_TINT,
        tabBarIcon: ({ color, size, focused }) => {
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
        component={DashboardScreen}
        options={{
          tabBarBadge: homeBadge,
          tabBarBadgeStyle: {
            backgroundColor: BADGE_RED,
            color: '#FFFFFF',
          },
        }}
      />
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
        {() => <PlaceholderScreen title="SettingsScreen" />}
      </Tab.Screen>
    </Tab.Navigator>
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
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [sessionMessage, setSessionMessage] = useState<string | null>(null);

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
      <View style={styles.loaderWrap}>
        <ActivityIndicator size="large" color={ACTIVE_TINT} />
      </View>
    );
  }

  return (
    <NavigationContainer>
      {isAuthenticated ? (
        <AppTabs />
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
    backgroundColor: '#F8FAFC',
  },
  placeholderTitle: {
    fontSize: 24,
    fontWeight: '800',
    color: '#0F172A',
    textAlign: 'center',
  },
  placeholderSubtitle: {
    marginTop: 10,
    fontSize: 14,
    color: '#64748B',
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
    color: '#123A5F',
  },
  headerBellButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F3F1EB',
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
});