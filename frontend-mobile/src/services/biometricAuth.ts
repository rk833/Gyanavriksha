import axios from 'axios';
import * as LocalAuthentication from 'expo-local-authentication';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

import { API_BASE_URL } from '../config/api';

// Legacy global key — kept only for one-time migration reads
const LEGACY_BIOMETRIC_KEY = 'biometric_signin_enabled';

// Per-user key. Mirrors the twoFactorTrust pattern.
export function biometricSignInKeyForEmail(email: string): string {
  const safe = email
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
  return `gv_biometric_${safe || 'user'}`;
}

// ─── Last-login email (written by LoginScreen / TwoFactorScreen) ────────────
const LAST_LOGIN_EMAIL_KEY = 'last_login_email';

async function getLastLoginEmail(): Promise<string | null> {
  try {
    return await SecureStore.getItemAsync(LAST_LOGIN_EMAIL_KEY);
  } catch {
    return null;
  }
}

// ─── Per-user preference helpers ───────────────────────────────────────────

/**
 * Return true only when *this* user (identified by email) has biometric
 * quick sign-in turned on.  Falls back to last_login_email when no email is
 * supplied (login screen / navigator don't have it at call time).
 */
export async function isBiometricSignInEnabled(email?: string): Promise<boolean> {
  try {
    const resolvedEmail = email ?? (await getLastLoginEmail());
    if (!resolvedEmail) return false;

    const key = biometricSignInKeyForEmail(resolvedEmail);
    const perUser = await SecureStore.getItemAsync(key);
    if (perUser !== null) {
      return perUser === 'true';
    }

    // One-time migration: if the old global key is 'true', move it to the
    // per-user key and erase the global one so future accounts start clean.
    const legacy = await SecureStore.getItemAsync(LEGACY_BIOMETRIC_KEY);
    if (legacy === 'true') {
      await SecureStore.setItemAsync(key, 'true');
      await SecureStore.deleteItemAsync(LEGACY_BIOMETRIC_KEY);
      return true;
    }

    return false;
  } catch {
    return false;
  }
}

export async function setBiometricSignInEnabled(enabled: boolean, email?: string): Promise<void> {
  const resolvedEmail = email ?? (await getLastLoginEmail());
  if (!resolvedEmail) return;

  const key = biometricSignInKeyForEmail(resolvedEmail);
  if (enabled) {
    await SecureStore.setItemAsync(key, 'true');
  } else {
    await SecureStore.deleteItemAsync(key);
  }
  // Always clean up the legacy global key to avoid stale reads on other accounts
  try { await SecureStore.deleteItemAsync(LEGACY_BIOMETRIC_KEY); } catch { /* ignore */ }
}

export async function clearBiometricSignInPreference(email?: string): Promise<void> {
  try {
    const resolvedEmail = email ?? (await getLastLoginEmail());
    if (resolvedEmail) {
      await SecureStore.deleteItemAsync(biometricSignInKeyForEmail(resolvedEmail));
    }
    await SecureStore.deleteItemAsync(LEGACY_BIOMETRIC_KEY);
  } catch { /* ignore */ }
}

// ─── JWT helpers ───────────────────────────────────────────────────────────

function decodeJwtPayload(token: string): Record<string, unknown> | null {
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  try {
    const payloadBase64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const padded = payloadBase64.padEnd(payloadBase64.length + ((4 - (payloadBase64.length % 4)) % 4), '=');
    return JSON.parse(globalThis.atob(padded)) as Record<string, unknown>;
  } catch {
    return null;
  }
}

export function isAccessTokenExpired(token: string): boolean {
  const payload = decodeJwtPayload(token);
  const exp = payload?.exp;
  if (typeof exp !== 'number') return true;
  return Date.now() >= exp * 1000;
}

/** Exchange refresh token for new tokens. Returns true if SecureStore was updated. */
export async function refreshSessionWithStoredRefreshToken(): Promise<boolean> {
  const refreshToken = await SecureStore.getItemAsync('refresh_token');
  if (!refreshToken) return false;
  try {
    const { data } = await axios.post<{ access_token: string; refresh_token: string }>(
      `${API_BASE_URL}/api/auth/refresh`,
      { refresh_token: refreshToken },
      { headers: { 'Content-Type': 'application/json' }, timeout: 15000 }
    );
    await SecureStore.setItemAsync('access_token', data.access_token);
    await SecureStore.setItemAsync('auth_token', data.access_token);
    await SecureStore.setItemAsync('refresh_token', data.refresh_token);
    return true;
  } catch {
    return false;
  }
}

// ─── Biometric hardware info ───────────────────────────────────────────────

/**
 * Human-readable name for the device unlock method.
 */
export async function getBiometricTypeLabel(): Promise<string> {
  if (Platform.OS === 'web') return 'Biometric';
  try {
    const types = await LocalAuthentication.supportedAuthenticationTypesAsync();
    const hasPrint = types.includes(LocalAuthentication.AuthenticationType.FINGERPRINT);
    const hasFace  = types.includes(LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION);
    if (hasPrint) return Platform.OS === 'ios' ? 'Touch ID' : 'Fingerprint';
    if (hasFace)  return Platform.OS === 'ios' ? 'Face ID' : 'Face unlock';
    if (types.includes(LocalAuthentication.AuthenticationType.IRIS)) return 'Iris';

    const enrolledLevel = await LocalAuthentication.getEnrolledLevelAsync();
    if (enrolledLevel === LocalAuthentication.SecurityLevel.BIOMETRIC_STRONG)
      return Platform.OS === 'ios' ? 'Face ID or Touch ID' : 'Fingerprint';
    if (enrolledLevel === LocalAuthentication.SecurityLevel.BIOMETRIC_WEAK)
      return Platform.OS === 'ios' ? 'Biometric' : 'Face unlock';
    if (enrolledLevel === LocalAuthentication.SecurityLevel.SECRET)
      return 'Device PIN or pattern';
  } catch { /* ignore */ }

  try {
    const has      = await LocalAuthentication.hasHardwareAsync();
    const enrolled = has ? await LocalAuthentication.isEnrolledAsync() : false;
    if (has && enrolled) return Platform.OS === 'ios' ? 'Touch ID' : 'Fingerprint';
  } catch { /* ignore */ }

  return 'Biometric';
}

export type BiometricHardwareInfo = {
  supported: boolean;
  enrolled: boolean;
  label: string;
};

export async function getBiometricHardwareInfo(): Promise<BiometricHardwareInfo> {
  if (Platform.OS === 'web') return { supported: false, enrolled: false, label: 'Not available on web' };
  try {
    const supported = await LocalAuthentication.hasHardwareAsync();
    const enrolled  = supported ? await LocalAuthentication.isEnrolledAsync() : false;
    const label     = await getBiometricTypeLabel();
    return { supported, enrolled, label };
  } catch {
    const label = await getBiometricTypeLabel();
    return { supported: false, enrolled: false, label };
  }
}

/** Prompt device owner verification (Face ID / fingerprint / device PIN). */
export async function promptDeviceAuthentication(
  promptMessage: string
): Promise<{ ok: boolean; cancelled: boolean }> {
  if (Platform.OS === 'web') return { ok: false, cancelled: false };
  try {
    const result = await LocalAuthentication.authenticateAsync({
      promptMessage,
      cancelLabel: 'Cancel',
      disableDeviceFallback: false,
      ...(Platform.OS === 'android' ? { biometricsSecurityLevel: 'weak' as const } : {}),
    });
    if (result.success) return { ok: true, cancelled: false };
    return { ok: false, cancelled: result.error === 'user_cancel' };
  } catch {
    return { ok: false, cancelled: false };
  }
}

/**
 * After OS biometric/PIN success: return a valid access token from storage or via refresh.
 * Used on the sign-in screen for returning users who enabled biometric quick sign-in.
 */
export async function completeBiometricSignIn(): Promise<
  { ok: true; accessToken: string } | { ok: false; message: string }
> {
  if (Platform.OS === 'web') {
    return { ok: false, message: 'Biometric sign-in is not available in the browser.' };
  }

  // Uses last_login_email to resolve whose preference to check
  const enabled = await isBiometricSignInEnabled();
  if (!enabled) {
    return {
      ok: false,
      message:
        'Quick sign-in is turned off on this device. After you sign in with email, open Profile → Security & device to turn it on.',
    };
  }

  const access  = (await SecureStore.getItemAsync('access_token')) ?? (await SecureStore.getItemAsync('auth_token'));
  const refresh = await SecureStore.getItemAsync('refresh_token');
  const hasValidAccess = typeof access === 'string' && access.length > 0 && !isAccessTokenExpired(access);
  const hasRefresh     = typeof refresh === 'string' && refresh.length > 0;

  if (!hasValidAccess && !hasRefresh) {
    const label = await getBiometricTypeLabel();
    return {
      ok: false,
      message: `You signed out, so there is no saved session to unlock. Sign in with email and password once. After that, ${label} can open the app for you until you sign out again.`,
    };
  }

  const hw = await getBiometricHardwareInfo();
  if (!hw.supported || !hw.enrolled) {
    return {
      ok: false,
      message: 'Add Face ID, Touch ID, or a screen lock on this device to use quick sign-in.',
    };
  }

  const gate = await promptDeviceAuthentication('Sign in to Gyanavriksha');
  if (!gate.ok) {
    return { ok: false, message: gate.cancelled ? 'Sign-in cancelled.' : 'Could not verify your identity.' };
  }

  if (hasValidAccess && typeof access === 'string') {
    return { ok: true, accessToken: access };
  }

  const refreshed = await refreshSessionWithStoredRefreshToken();
  if (refreshed) {
    const next = (await SecureStore.getItemAsync('access_token')) ?? (await SecureStore.getItemAsync('auth_token'));
    if (typeof next === 'string' && next.length > 0) {
      return { ok: true, accessToken: next };
    }
  }

  return { ok: false, message: 'This session could not be restored. Sign in with email and password.' };
}
