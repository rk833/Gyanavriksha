import api from './api';

/**
 * Service layer for all authentication API calls.
 * Maps directly to the backend auth bounded context: /api/auth/*
 */
const authService = {
  /**
   * Register a new student or instructor account.
   *
   * @param {string} email
   * @param {string} password
   * @param {string} fullName
   * @param {'student'|'instructor'} role
   * @returns {Promise<object>} Created user record.
   */
  async register(email, password, fullName, role) {
    const { data } = await api.post('/api/auth/register', {
      email,
      password,
      full_name: fullName,
      role,
    });
    return data;
  },

  /**
   * Authenticate with email and password.
   * Returns tokens directly, or `requires_2fa: true` with a `user_id` when
   * the account has TOTP enabled.
   *
   * @param {string} email
   * @param {string} password
   * @returns {Promise<import('./types').LoginResponse>}
   */
  async login(email, password) {
    const { data } = await api.post('/api/auth/login', { email, password });
    return data;
  },

  /**
   * Exchange a valid refresh token for a new access/refresh token pair.
   *
   * @param {string} refreshToken
   * @returns {Promise<import('./types').TokenResponse>}
   */
  async refreshToken(refreshToken) {
    const { data } = await api.post('/api/auth/refresh', { refresh_token: refreshToken });
    return data;
  },

  /**
   * Revoke all active sessions for the currently authenticated user.
   *
   * @returns {Promise<{message: string}>}
   */
  async logout() {
    const { data } = await api.post('/api/auth/logout');
    return data;
  },

  /**
   * Fetch the profile of the currently authenticated user.
   *
   * @returns {Promise<import('./types').UserResponse>}
   */
  async getMe() {
    const { data } = await api.get('/api/auth/me');
    return data;
  },

  /**
   * Request a password-reset email for the given address.
   * Always returns a success message regardless of whether the email exists.
   *
   * @param {string} email
   * @returns {Promise<{message: string}>}
   */
  async forgotPassword(email) {
    const { data } = await api.post('/api/auth/forgot-password', { email });
    return data;
  },

  /**
   * Complete a password reset using the token from the email link.
   *
   * @param {string} token
   * @param {string} newPassword
   * @returns {Promise<{message: string}>}
   */
  async resetPassword(token, newPassword) {
    const { data } = await api.post('/api/auth/reset-password', {
      token,
      new_password: newPassword,
    });
    return data;
  },

  /**
   * Change the authenticated user's password after verifying the current one.
   *
   * @param {string} currentPassword
   * @param {string} newPassword
   * @returns {Promise<{message: string}>}
   */
  async changePassword(currentPassword, newPassword) {
    const { data } = await api.post('/api/auth/change-password', {
      current_password: currentPassword,
      new_password: newPassword,
    });
    return data;
  },

  /**
   * Generate a TOTP QR code and secret for the authenticated user.
   *
   * @returns {Promise<{qr_code_base64: string, secret: string}>}
   */
  async setup2FA() {
    const { data } = await api.post('/api/auth/2fa/setup');
    return data;
  },

  /**
   * Confirm the TOTP code scanned during setup to activate 2FA.
   *
   * @param {string} secret - The plaintext TOTP secret returned by setup2FA.
   * @param {string} code - The 6-digit code from the authenticator app.
   * @returns {Promise<{message: string}>}
   */
  async verify2FASetup(secret, code) {
    const { data } = await api.post('/api/auth/2fa/verify', { secret, code });
    return data;
  },

  /**
   * Validate a TOTP code at login time and exchange it for full tokens.
   *
   * @param {string} userId
   * @param {string} code
   * @returns {Promise<import('./types').TokenResponse>}
   */
  async verify2FA(userId, code) {
    const { data } = await api.post('/api/auth/2fa/validate', {
      user_id: userId,
      code,
    });
    return data;
  },

  /**
   * Disable TOTP after verifying the account password and a valid code.
   *
   * @param {string} code
   * @param {string} password
   * @returns {Promise<{message: string}>}
   */
  async disable2FA(code, password) {
    const { data } = await api.post('/api/auth/2fa/disable', { code, password });
    return data;
  },

  /**
   * Create a new QR-login session for the desktop login flow.
   *
   * @returns {Promise<{session_id: string, qr_data: string, expires_in: number}>}
   */
  async createQrSession() {
    const { data } = await api.post('/api/auth/qr/create');
    return data;
  },

  /**
   * Record that the authenticated mobile user has scanned a QR session.
   *
   * @param {string} sessionId
   * @returns {Promise<{message: string}>}
   */
  async scanQrSession(sessionId) {
    const { data } = await api.post('/api/auth/qr/scan', { session_id: sessionId });
    return data;
  },

  /**
   * Poll the current status of a QR-login session.
   * Returns tokens when the session has been authenticated.
   *
   * @param {string} sessionId
   * @returns {Promise<{status: string, access_token?: string, refresh_token?: string}>}
   */
  async getQrStatus(sessionId) {
    const { data } = await api.get(`/api/auth/qr/status/${sessionId}`);
    return data;
  },

  /**
   * Finalise QR authentication from the mobile side and return access tokens.
   *
   * @param {string} sessionId
   * @returns {Promise<import('./types').TokenResponse>}
   */
  async authenticateQrSession(sessionId) {
    const { data } = await api.post('/api/auth/qr/authenticate', { session_id: sessionId });
    return data;
  },
};

export default authService;
