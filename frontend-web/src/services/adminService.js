import api from './api';

/**
 * Service layer for all admin API calls.
 * Maps to the backend admin bounded context: /api/admin/*
 */

export const getDashboard = () => api.get('/api/admin/dashboard');

export const getUsers = (params = {}) => api.get('/api/admin/users', { params });

export const createUser = (data) => api.post('/api/admin/users', data);

export const updateUser = (id, data) => api.patch(`/api/admin/users/${id}`, data);

export const suspendUser = (id) => api.patch(`/api/admin/users/${id}/suspend`);

export const reactivateUser = (id) => api.patch(`/api/admin/users/${id}/reactivate`);

export const deleteUser = (id) => api.delete(`/api/admin/users/${id}`);

export const resetPassword = (id) => api.post(`/api/admin/users/${id}/reset-password`);

export const bulkSuspend = (data) => api.post('/api/admin/users/bulk-suspend', data);

export const bulkDelete = (data) => api.post('/api/admin/users/bulk-delete', data);

export const getGrades = () => api.get('/api/admin/grades');

export const getAuditLogs = (params = {}) => api.get('/api/admin/audit-logs', { params });

export const getSystemChanges = () => api.get('/api/admin/audit-logs/system-changes');

export const exportAuditLogs = (params = {}) =>
  api.get('/api/admin/audit-logs/export', { params, responseType: 'blob' });

export const runIntegrityAudit = () => api.post('/api/admin/security/run-audit');
