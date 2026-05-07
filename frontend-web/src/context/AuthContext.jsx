import { createContext, useState, useEffect, useCallback } from 'react';
import authService from '../services/authService';

export const AuthContext = createContext(null);

/**
 * Provides authentication state and actions to the entire React tree.
 *
 * Exposed context value:
 * - `user`            Current user object, or null when unauthenticated.
 * - `loading`         True while the initial auth check is in progress.
 * - `isAuthenticated` Derived boolean from user presence.
 * - `login`           Email/password sign-in; handles 2FA redirect.
 * - `complete2FA`     Exchange a TOTP code for full tokens after login.
 * - `logout`          Revoke tokens and clear local state.
 * - `changePassword`  Change the authenticated user's password.
 * - `fetchUser`       Re-fetch the /me endpoint and update user state.
 */
export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const isAuthenticated = !!user;

  /**
   * Fetch the current user from /api/auth/me and update state.
   * Returns the user object on success, or null on any error.
   */
  const fetchUser = useCallback(async () => {
    try {
      const userData = await authService.getMe();
      setUser(userData);
      return userData;
    } catch {
      setUser(null);
      return null;
    }
  }, []);

  useEffect(() => {
    const initAuth = async () => {
      const token = localStorage.getItem('access_token');
      if (token) {
        await fetchUser();
      }
      setLoading(false);
    };
    initAuth();
  }, [fetchUser]);

  /**
   * Sign in with email and password.
   * When 2FA is required the raw API response is returned without storing tokens;
   * the caller must redirect to the 2FA validation step.
   *
   * @param {string} email
   * @param {string} password
   * @returns {Promise<object>} Login response, possibly with `requires_2fa: true`.
   */
  const login = async (email, password) => {
    const trustKey = authService.twoFactorTrustStorageKey(email);
    let hadTrust = false;
    try {
      hadTrust = !!localStorage.getItem(trustKey);
    } catch {
      hadTrust = false;
    }
    const data = await authService.login(email, password);
    if (data.requires_2fa && hadTrust) {
      try {
        localStorage.removeItem(trustKey);
      } catch {
        /* no-op */
      }
    }
    if (data.requires_2fa) {
      return data;
    }
    localStorage.setItem('access_token', data.access_token);
    localStorage.setItem('refresh_token', data.refresh_token);
    const userData = await fetchUser();
    return { ...data, user: userData };
  };

  /**
   * Complete a 2FA login by exchanging the TOTP code for full tokens.
   *
   * @param {string} email - Used to store optional "trust this device" token (per browser).
   * @param {string} userId
   * @param {string} code
   * @param {string} method
   * @param {boolean} rememberDevice - If true, server returns a device token (skip 2FA for 3 days on this browser).
   * @returns {Promise<object>} Token response with the resolved user.
   */
  const complete2FA = async (email, userId, code, method = 'totp', rememberDevice = false) => {
    const data = await authService.verify2FA(userId, code, method, rememberDevice);
    if (rememberDevice && data.trusted_device_token && email) {
      try {
        localStorage.setItem(authService.twoFactorTrustStorageKey(email), data.trusted_device_token);
      } catch {
        /* no-op */
      }
    } else if (!rememberDevice && email) {
      try {
        localStorage.removeItem(authService.twoFactorTrustStorageKey(email));
      } catch {
        /* no-op */
      }
    }
    localStorage.setItem('access_token', data.access_token);
    localStorage.setItem('refresh_token', data.refresh_token);
    const userData = await fetchUser();
    return { ...data, user: userData };
  };

  /**
   * Sign out the current user: revoke server tokens and clear local state.
   * Proceeds with local cleanup even when the API call fails.
   */
  const logout = async () => {
    try {
      await authService.logout();
    } catch {
      /* intentional no-op */
    }
    localStorage.removeItem('access_token');
    localStorage.removeItem('refresh_token');
    if (user?.email) {
      try {
        localStorage.removeItem(authService.twoFactorTrustStorageKey(user.email));
      } catch {
        /* no-op */
      }
    }
    setUser(null);
  };

  /**
   * Change the authenticated user's password.
   *
   * @param {string} currentPassword
   * @param {string} newPassword
   * @returns {Promise<{message: string}>}
   */
  const changePassword = (currentPassword, newPassword) =>
    authService.changePassword(currentPassword, newPassword);

  const value = {
    user,
    loading,
    isAuthenticated,
    login,
    complete2FA,
    logout,
    changePassword,
    fetchUser,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
