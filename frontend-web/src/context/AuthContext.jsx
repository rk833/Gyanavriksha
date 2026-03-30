import { createContext, useState, useEffect, useCallback } from 'react';
import authService from '../services/authService';

export const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const isAuthenticated = !!user;

  // Fetch current user from /me endpoint
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

  // On mount: check for existing token and load user
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

  const login = async (email, password) => {
    const data = await authService.login(email, password);

    // If 2FA is required, return the response without storing tokens
    if (data.requires_2fa) {
      return data;
    }

    localStorage.setItem('access_token', data.access_token);
    localStorage.setItem('refresh_token', data.refresh_token);
    const userData = await fetchUser();
    return { ...data, user: userData };
  };

  const complete2FA = async (userId, code) => {
    const data = await authService.verify2FA(userId, code);
    localStorage.setItem('access_token', data.access_token);
    localStorage.setItem('refresh_token', data.refresh_token);
    const userData = await fetchUser();
    return { ...data, user: userData };
  };

  const logout = async () => {
    try {
      await authService.logout();
    } catch {
      // Proceed with local cleanup even if API call fails
    }
    localStorage.removeItem('access_token');
    localStorage.removeItem('refresh_token');
    setUser(null);
  };

  const value = {
    user,
    loading,
    isAuthenticated,
    login,
    complete2FA,
    logout,
    fetchUser,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
