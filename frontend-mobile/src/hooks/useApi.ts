import { useCallback } from 'react';

import { AxiosRequestConfig, Method } from 'axios';

import { apiClient } from '../api/client';

type RequestConfig = Omit<AxiosRequestConfig, 'url' | 'method'>;

export function useApi() {
  const request = useCallback(
    async <T,>(method: Method, url: string, config: RequestConfig = {}) => {
      const response = await apiClient.request<T>({
        ...config,
        url,
        method,
      });
      return response.data;
    },
    []
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

  const patch = useCallback(
    <T,>(url: string, data?: unknown, config: RequestConfig = {}) =>
      request<T>('patch', url, { ...config, data }),
    [request]
  );

  const del = useCallback(
    <T,>(url: string, config: RequestConfig = {}) => request<T>('delete', url, config),
    [request]
  );

  return {
    client: apiClient,
    request,
    get,
    post,
    put,
    patch,
    delete: del,
  };
}