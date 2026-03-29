import api from './api';

const authService = {
  async login(email, password) {
    const { data } = await api.post('/api/auth/login', { email, password });
    return data;
  },

  async refreshToken(refreshToken) {
    const { data } = await api.post('/api/auth/refresh', { refresh_token: refreshToken });
    return data;
  },

  async logout() {
    const { data } = await api.post('/api/auth/logout');
    return data;
  },

  async getMe() {
    const { data } = await api.get('/api/auth/me');
    return data;
  },

  async forgotPassword(email) {
    const { data } = await api.post('/api/auth/forgot-password', { email });
    return data;
  },

  async resetPassword(token, newPassword) {
    const { data } = await api.post('/api/auth/reset-password', {
      token,
      new_password: newPassword,
    });
    return data;
  },

  async verify2FA(userId, code) {
    const { data } = await api.post('/api/auth/2fa/validate', {
      user_id: userId,
      code,
    });
    return data;
  },

  async setup2FA() {
    const { data } = await api.post('/api/auth/2fa/setup');
    return data;
  },

  async verify2FASetup(secret, code) {
    const { data } = await api.post('/api/auth/2fa/verify', { secret, code });
    return data;
  },

  async disable2FA(code, password) {
    const { data } = await api.post('/api/auth/2fa/disable', { code, password });
    return data;
  },
};

export default authService;
