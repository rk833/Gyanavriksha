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
export const getSubjects = (params = {}) => api.get('/api/admin/subjects', { params });

export const getAuditLogs = (params = {}) => api.get('/api/admin/audit-logs', { params });
export const getSystemChanges = () => api.get('/api/admin/audit-logs/system-changes');
export const exportAuditLogs = (params = {}) =>
  api.get('/api/admin/audit-logs/export', { params, responseType: 'blob' });

export const getNamespaces = () => api.get('/api/admin/vector-store/namespaces');
export const getVectorStats = () => api.get('/api/admin/vector-store/stats');
export const createNamespace = (data) => api.post('/api/admin/vector-store/namespaces', data);
export const reindexStore = (data = {}) => api.post('/api/admin/vector-store/reindex', data);
export const getExportSnapshot = () => api.get('/api/admin/vector-store/export-snapshot');

export const listIotDevices = (params = {}) => api.get('/api/admin/iot/devices', { params });
export const registerDevice = (data) => api.post('/api/admin/iot/devices', data);
export const getIotHealth = () => api.get('/api/admin/iot/health');
export const decommissionDevice = (id) => api.delete(`/api/admin/iot/devices/${id}`);
export const regenerateDeviceKey = (id) => api.post(`/api/admin/iot/devices/${id}/regenerate-key`);
export const updateDeviceStatus = (id, data) => api.patch(`/api/admin/iot/devices/${id}/status`, data);

export const getSecurityOverview = () => api.get('/api/admin/security/overview');
export const getSecurityEvents = () => api.get('/api/admin/security/events');
export const runIntegrityAudit = () => api.post('/api/admin/security/run-audit');

export const uploadCurriculum = (formData) =>
  api.post('/api/admin/ingestion/upload', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
export const getIngestionJobs = (params = {}) => api.get('/api/admin/ingestion/jobs', { params });
export const cancelIngestionJob = (id) => api.delete(`/api/admin/ingestion/jobs/${id}`);

export const getSettings = () => api.get('/api/admin/settings');
export const updateSettings = (data) => api.patch('/api/admin/settings', data);
