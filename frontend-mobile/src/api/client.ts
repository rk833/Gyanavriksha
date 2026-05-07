import axios, { AxiosError, AxiosHeaders, InternalAxiosRequestConfig } from 'axios';
import * as SecureStore from 'expo-secure-store';
import { DeviceEventEmitter } from 'react-native';

import { API_BASE_URL } from '../config/api';
import { clearTwoFactorTrustUsingLastLoginEmail } from '../utils/twoFactorTrust';

const AUTH_SESSION_EXPIRED = 'auth:session-expired';

type RetryableConfig = InternalAxiosRequestConfig & {
  _retry?: boolean;
};

let isRefreshing = false;
let failedQueue: { resolve: (token: string) => void; reject: (err: unknown) => void }[] = [];

function processQueue(error: unknown, token: string | null = null) {
  failedQueue.forEach((prom) => {
    if (error) {
      prom.reject(error);
    } else if (token) {
      prom.resolve(token);
    }
  });
  failedQueue = [];
}

/**
 * Clear stored access tokens. Optionally keep the refresh token so the user can
 * unlock again with quick sign-in (biometrics) after Sign out.
 */
export async function clearStoredAuthTokens(preserveRefreshToken = false) {
  try {
    await SecureStore.deleteItemAsync('access_token');
  } catch {
    /* ignore */
  }
  try {
    await SecureStore.deleteItemAsync('auth_token');
  } catch {
    /* ignore */
  }
  if (!preserveRefreshToken) {
    try {
      await SecureStore.deleteItemAsync('refresh_token');
    } catch {
      /* ignore */
    }
    try {
      await clearTwoFactorTrustUsingLastLoginEmail();
    } catch {
      /* ignore */
    }
  }
}

export function emitSessionExpired() {
  DeviceEventEmitter.emit(AUTH_SESSION_EXPIRED);
}

/** Subscribe to refresh failures (no valid refresh token / server rejected refresh). */
export function subscribeSessionExpired(listener: () => void) {
  const sub = DeviceEventEmitter.addListener(AUTH_SESSION_EXPIRED, listener);
  return () => sub.remove();
}

async function attemptTokenRefresh(): Promise<string> {
  const refreshToken = await SecureStore.getItemAsync('refresh_token');
  if (!refreshToken) {
    throw new Error('NO_REFRESH_TOKEN');
  }

  const { data } = await axios.post<{ access_token: string; refresh_token: string }>(
    `${API_BASE_URL}/api/auth/refresh`,
    { refresh_token: refreshToken },
    { headers: { 'Content-Type': 'application/json' }, timeout: 15000 }
  );

  await SecureStore.setItemAsync('access_token', data.access_token);
  await SecureStore.setItemAsync('auth_token', data.access_token);
  await SecureStore.setItemAsync('refresh_token', data.refresh_token);
  return data.access_token;
}

/**
 * Shared Axios instance: attaches Bearer token, retries once on 401 after `/api/auth/refresh`
 * (mirrors frontend-web). Queues concurrent requests while refresh runs.
 */
export const apiClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: 15000,
  headers: { 'Content-Type': 'application/json' },
});

const SKIP_REFRESH_SUBSTR = ['/api/auth/login', '/api/auth/register', '/api/auth/refresh'];

function shouldSkipRefresh(url: string) {
  return SKIP_REFRESH_SUBSTR.some((p) => url.includes(p));
}

apiClient.interceptors.request.use(async (config) => {
  const access = await SecureStore.getItemAsync('access_token');
  const token = access ?? (await SecureStore.getItemAsync('auth_token'));
  const headers = AxiosHeaders.from(config.headers ?? {});
  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }
  config.headers = headers;
  return config;
});

apiClient.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const originalRequest = error.config as RetryableConfig | undefined;
    const url = String(originalRequest?.url ?? '');

    if (!originalRequest || shouldSkipRefresh(url) || error.response?.status !== 401 || originalRequest._retry) {
      return Promise.reject(error);
    }

    if (isRefreshing) {
      return new Promise<string>((resolve, reject) => {
        failedQueue.push({ resolve, reject });
      }).then((newToken) => {
        const headers = AxiosHeaders.from(originalRequest.headers ?? {});
        headers.set('Authorization', `Bearer ${newToken}`);
        originalRequest.headers = headers;
        return apiClient(originalRequest);
      });
    }

    originalRequest._retry = true;
    isRefreshing = true;

    try {
      const newToken = await attemptTokenRefresh();
      processQueue(null, newToken);
      const headers = AxiosHeaders.from(originalRequest.headers ?? {});
      headers.set('Authorization', `Bearer ${newToken}`);
      originalRequest.headers = headers;
      return await apiClient(originalRequest);
    } catch (refreshErr) {
      processQueue(refreshErr, null);
      await clearStoredAuthTokens();
      emitSessionExpired();
      return Promise.reject(refreshErr);
    } finally {
      isRefreshing = false;
    }
  }
);
