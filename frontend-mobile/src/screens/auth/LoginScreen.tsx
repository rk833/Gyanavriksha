import React, { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
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
import { Controller, useForm } from 'react-hook-form';
import axios from 'axios';
import * as SecureStore from 'expo-secure-store';

type LoginFormValues = {
  email: string;
  password: string;
};

type LoginScreenProps = {
  navigation?: {
    navigate: (screenName: string) => void;
  };
  onLoginSuccess?: (token: string) => void;
};

const API_BASE_URL = 'http://localhost:8000';
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function LoginScreen({ navigation, onLoginSuccess }: LoginScreenProps) {
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [passwordVisible, setPasswordVisible] = useState(false);

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
      const response = await axios.post(`${API_BASE_URL}/auth/login`, {
        email: email.trim(),
        password,
      });

      const token =
        response.data?.token ??
        response.data?.access_token ??
        response.data?.jwt ??
        response.data?.auth_token;

      if (typeof token !== 'string' || token.length === 0) {
        throw new Error('Token missing from login response.');
      }

      await SecureStore.setItemAsync('auth_token', token);
      onLoginSuccess?.(token);
    } catch (error) {
      if (axios.isAxiosError(error) && error.response?.status === 401) {
        setSubmitError('Invalid email or password. Please try again.');
        return;
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

                <TouchableOpacity
                  style={styles.qrButton}
                  activeOpacity={0.85}
                  onPress={() => {
                    if (navigation) {
                      navigation.navigate('QRLoginScreen');
                      return;
                    }

                    Alert.alert('Preview mode', 'QR login navigation is not wired yet.');
                  }}
                >
                  <Text style={styles.qrButtonText}>Login with QR Code</Text>
                </TouchableOpacity>
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
  qrButton: {
    borderWidth: 1,
    borderColor: '#DBE2EF',
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    paddingVertical: 15,
    alignItems: 'center',
    justifyContent: 'center',
  },
  qrButtonText: {
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
});