import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  SafeAreaView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import axios from 'axios';
import * as SecureStore from 'expo-secure-store';
import { API_BASE_URL } from '../../config/api';

const OTP_LENGTH = 6;

type TwoFactorScreenProps = {
  navigation?: {
    navigate: (screenName: string, params?: Record<string, unknown>) => void;
  };
  route?: {
    params?: {
      user_id?: string;
    };
  };
};

type Validate2faResponse = {
  access_token: string;
  refresh_token: string;
  token_type: 'bearer';
  expires_in: number;
};

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export default function TwoFactorScreen({ navigation, route }: TwoFactorScreenProps) {
  const [otpDigits, setOtpDigits] = useState<string[]>(Array(OTP_LENGTH).fill(''));
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorText, setErrorText] = useState<string | null>(null);

  const inputRefs = useRef<Array<TextInput | null>>([]);
  const userId = route?.params?.user_id;

  const otpValue = useMemo(() => otpDigits.join(''), [otpDigits]);

  const clearOtpInputs = () => {
    setOtpDigits(Array(OTP_LENGTH).fill(''));
    inputRefs.current[0]?.focus();
  };

  useEffect(() => {
    if (!userId || !UUID_REGEX.test(userId)) {
      setErrorText('2FA session is missing. Please login again.');
    }
  }, [userId]);

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
      });

      await SecureStore.setItemAsync('auth_token', response.data.access_token);
      await SecureStore.setItemAsync('refresh_token', response.data.refresh_token);

      navigation?.navigate('HomeScreen');
    } catch (error) {
      if (axios.isAxiosError(error) && error.response?.status === 422) {
        clearOtpInputs();
        setErrorText('Invalid code - try again');
      } else {
        setErrorText('Unable to verify code right now. Please try again.');
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

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.container}>
          <Text style={styles.title}>Two-Factor Verification</Text>
          <Text style={styles.subtitle}>Open your authenticator app and enter the 6-digit code</Text>

          <View style={styles.otpRow}>
            {otpDigits.map((digit, index) => (
              <TextInput
                key={index}
                ref={(ref) => {
                  inputRefs.current[index] = ref;
                }}
                style={styles.otpInput}
                value={digit}
                onChangeText={(value) => handleDigitChange(index, value)}
                onKeyPress={({ nativeEvent }) => handleKeyPress(index, nativeEvent.key)}
                keyboardType="number-pad"
                maxLength={1}
                textAlign="center"
                autoFocus={index === 0}
                editable={!isSubmitting}
              />
            ))}
          </View>

          {errorText ? <Text style={styles.errorText}>{errorText}</Text> : null}

          {isSubmitting ? (
            <View style={styles.submittingRow}>
              <ActivityIndicator color="#112D4E" />
              <Text style={styles.submittingText}>Verifying code...</Text>
            </View>
          ) : null}

          {!isSubmitting && otpValue.length === OTP_LENGTH ? (
            <Text style={styles.submittingText}>Submitting code...</Text>
          ) : null}
        </View>
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
  container: {
    flex: 1,
    paddingHorizontal: 20,
    justifyContent: 'center',
  },
  title: {
    color: '#112D4E',
    fontSize: 30,
    fontWeight: '800',
    textAlign: 'center',
  },
  subtitle: {
    marginTop: 8,
    color: '#64748B',
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 22,
  },
  otpRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 8,
  },
  otpInput: {
    flex: 1,
    height: 56,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#DBE2EF',
    backgroundColor: '#FFFFFF',
    color: '#112D4E',
    fontSize: 24,
    fontWeight: '700',
  },
  errorText: {
    marginTop: 14,
    color: '#D92D20',
    fontSize: 13,
    fontWeight: '600',
    textAlign: 'center',
  },
  submittingRow: {
    marginTop: 12,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
  },
  submittingText: {
    color: '#112D4E',
    fontSize: 13,
    fontWeight: '600',
  },
});
