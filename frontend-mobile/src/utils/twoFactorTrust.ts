import * as SecureStore from 'expo-secure-store';

/** SecureStore key for opaque "trust this device" token (server-issued, 3-day skip 2FA). */
export function twoFactorTrustStorageKey(email: string): string {
  const safe = email
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
  return `gv2fa_trust_${safe || 'user'}`;
}

export async function saveTwoFactorTrustToken(email: string, token: string): Promise<void> {
  try {
    await SecureStore.setItemAsync(twoFactorTrustStorageKey(email), token);
  } catch {
    /* ignore */
  }
}

const LAST_LOGIN_EMAIL_KEY = 'last_login_email';

export async function setLastLoginEmail(email: string): Promise<void> {
  try {
    await SecureStore.setItemAsync(LAST_LOGIN_EMAIL_KEY, email.trim().toLowerCase());
  } catch {
    /* ignore */
  }
}

export async function clearTwoFactorTrustForEmail(email: string): Promise<void> {
  try {
    await SecureStore.deleteItemAsync(twoFactorTrustStorageKey(email));
  } catch {
    /* ignore */
  }
}

export async function clearTwoFactorTrustUsingLastLoginEmail(): Promise<void> {
  try {
    const email = await SecureStore.getItemAsync(LAST_LOGIN_EMAIL_KEY);
    if (email) {
      await clearTwoFactorTrustForEmail(email);
      await SecureStore.deleteItemAsync(LAST_LOGIN_EMAIL_KEY);
    }
  } catch {
    /* ignore */
  }
}
