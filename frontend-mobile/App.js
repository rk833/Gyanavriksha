import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StyleSheet, Text, View } from 'react-native';
import LoginScreen from './src/screens/auth/LoginScreen';
import QRLoginScreen from './src/screens/auth/QRLoginScreen';
import TwoFactorScreen from './src/screens/auth/TwoFactorScreen';
import HomeScreen from './src/screens/student/HomeScreen';

const Stack = createNativeStackNavigator();

function PlaceholderScreen({ title, subtitle }) {
  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.center}>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.subtitle}>{subtitle}</Text>
      </View>
    </SafeAreaView>
  );
}

export default function App() {
  return (
    <NavigationContainer>
      <Stack.Navigator
        initialRouteName="LoginScreen"
        screenOptions={{
          headerShown: false,
        }}
      >
        <Stack.Screen name="LoginScreen" component={LoginScreen} />
        <Stack.Screen name="QRLoginScreen" component={QRLoginScreen} />
        <Stack.Screen name="ForgotPasswordScreen">
          {() => (
            <PlaceholderScreen
              title="Forgot Password"
              subtitle="Forgot password flow will be implemented next."
            />
          )}
        </Stack.Screen>
        <Stack.Screen name="TwoFactorScreen" component={TwoFactorScreen} />
        <Stack.Screen name="HomeScreen" component={HomeScreen} />
        <Stack.Screen name="SettingsScreen">
          {() => (
            <PlaceholderScreen
              title="Settings"
              subtitle="Settings screen will be implemented next."
            />
          )}
        </Stack.Screen>
        <Stack.Screen name="ChangePasswordScreen">
          {() => (
            <PlaceholderScreen
              title="Change Password"
              subtitle="Change password UI placeholder for settings navigation."
            />
          )}
        </Stack.Screen>
      </Stack.Navigator>
    </NavigationContainer>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#F9F7F7',
  },
  center: {
    flex: 1,
    paddingHorizontal: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 28,
    fontWeight: '800',
    color: '#112D4E',
    textAlign: 'center',
  },
  subtitle: {
    marginTop: 10,
    fontSize: 15,
    color: '#64748B',
    textAlign: 'center',
    lineHeight: 22,
  },
});
