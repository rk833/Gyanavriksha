import axios from 'axios';

/**
 * Shared Axios instance for all Gyanavriksha API requests.
 *
 * - Automatically attaches the Bearer access token from localStorage.
 * - On 401 responses it attempts a silent token refresh and retries the
 *   original request exactly once, queuing concurrent requests while the
 *   refresh is in flight.
 * - On refresh failure it clears all stored tokens and redirects to /login.
 */
const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:8000',
  timeout: 10000,
  headers: { 'Content-Type': 'application/json' },
});

api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('access_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

let isRefreshing = false;
let failedQueue = [];

/**
 * Flush the pending-request queue after a refresh attempt.
 *
 * @param {Error|null} error - Pass an error to reject all queued promises.
 * @param {string|null} token - Pass the new access token to resolve them.
 */
function processQueue(error, token = null) {
  failedQueue.forEach((prom) => {
    if (error) {
      prom.reject(error);
    } else {
      prom.resolve(token);
    }
  });
  failedQueue = [];
}

/**
 * Remove both tokens from localStorage and redirect to the login page.
 */
function clearTokensAndRedirect() {
  localStorage.removeItem('access_token');
  localStorage.removeItem('refresh_token');
  window.location.href = '/login';
}

/**
 * Attempt a silent token refresh using the stored refresh token.
 *
 * @returns {Promise<string>} The new access token on success.
 */
async function attemptTokenRefresh() {
  const refreshToken = localStorage.getItem('refresh_token');
  if (!refreshToken) {
    throw new Error('NO_REFRESH_TOKEN');
  }
  const { data } = await axios.post(
    `${api.defaults.baseURL}/api/auth/refresh`,
    { refresh_token: refreshToken },
    { headers: { 'Content-Type': 'application/json' } }
  );
  localStorage.setItem('access_token', data.access_token);
  localStorage.setItem('refresh_token', data.refresh_token);
  return data.access_token;
}

const SKIP_REFRESH_PATHS = ['/api/auth/login', '/api/auth/register', '/api/auth/refresh', '/api/auth/2fa/email/send'];
const AI_TUTOR_CHAT_PATH = '/api/students/ai-tutor/chat';

/**
 * Derive a human-readable wait message from the X-RateLimit-Reset header.
 *
 * @param {import('axios').AxiosResponse} response
 * @returns {string}
 */
function buildRateLimitMessage(response) {
  const reset = response?.headers?.['x-ratelimit-reset'];
  if (!reset) return 'Too many requests. Please wait before trying again.';
  const secondsLeft = Math.max(Math.ceil(Number(reset) - Date.now() / 1000), 1);
  return `Too many requests. Please wait ${secondsLeft}s before trying again.`;
}

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;
    const isAiTutorChat = originalRequest?.url?.includes(AI_TUTOR_CHAT_PATH);
    if (error.response?.status === 429) {
      const message = buildRateLimitMessage(error.response);
      return Promise.reject(Object.assign(error, { rateLimitMessage: message }));
    }
    const isSkipped = SKIP_REFRESH_PATHS.some((p) => originalRequest.url?.includes(p));
    if (isSkipped || error.response?.status !== 401 || originalRequest._retry) {
      return Promise.reject(error);
    }
    if (isRefreshing) {
      return new Promise((resolve, reject) => {
        failedQueue.push({ resolve, reject });
      }).then((token) => {
        originalRequest.headers = originalRequest.headers || {};
        originalRequest.headers.Authorization = `Bearer ${token}`;
        return api(originalRequest);
      });
    }
    originalRequest._retry = true;
    isRefreshing = true;
    let newToken;
    try {
      newToken = await attemptTokenRefresh();
      processQueue(null, newToken);
    } catch (refreshError) {
      processQueue(refreshError, null);
      clearTokensAndRedirect();
      return Promise.reject(refreshError);
    } finally {
      isRefreshing = false;
    }

    originalRequest.headers = originalRequest.headers || {};
    originalRequest.headers.Authorization = `Bearer ${newToken}`;

    try {
      return await api(originalRequest);
    } catch (retryError) {
      // Mid-request expiry edge case:
      // after a successful refresh, retry AI tutor chat once more.
      if (
        isAiTutorChat &&
        retryError.response?.status === 401 &&
        !originalRequest._aiTutorPostRefreshRetry
      ) {
        originalRequest._aiTutorPostRefreshRetry = true;
        const latestToken = localStorage.getItem('access_token');
        if (latestToken) {
          originalRequest.headers.Authorization = `Bearer ${latestToken}`;
        }
        return api(originalRequest);
      }
      return Promise.reject(retryError);
    }
  }
);

export default api;
