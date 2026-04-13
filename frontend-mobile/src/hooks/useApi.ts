import { useCallback, useMemo } from 'react';

import axios, { AxiosRequestConfig, Method } from 'axios';
import * as SecureStore from 'expo-secure-store';
import { API_BASE_URL } from '../config/api';

type RequestConfig = Omit<AxiosRequestConfig, 'url' | 'method'>;

export function useApi() {
  const client = useMemo(
    () =>
      axios.create({
        baseURL: API_BASE_URL,
        timeout: 15000,
      }),
    []
  );

  const request = useCallback(
    async <T,>(method: Method, url: string, config: RequestConfig = {}) => {
      const token = await SecureStore.getItemAsync('auth_token');
      const headers = {
        ...(config.headers as Record<string, string> | undefined),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      };

      const response = await client.request<T>({
        ...config,
        url,
        method,
        headers,
      });

      return response.data;
    },
    [client]
  );

  const get = useCallback(
    <T,>(url: string, config: RequestConfig = {}) => request<T>('get', url, config),
    [request]
  );

  const post = useCallback(
    <T,>(url: string, data?: unknown, config: RequestConfig = {}) =>
      request<T>('post', url, { ...config, data }),
    [request]
  );

  const put = useCallback(
    <T,>(url: string, data?: unknown, config: RequestConfig = {}) =>
      request<T>('put', url, { ...config, data }),
    [request]
  );

  const del = useCallback(
    <T,>(url: string, config: RequestConfig = {}) => request<T>('delete', url, config),
    [request]
  );

  return {
    client,
    request,
    get,
    post,
    put,
    delete: del,
  };
}