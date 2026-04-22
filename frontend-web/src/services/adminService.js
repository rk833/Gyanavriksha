import api from './api';

export const getDashboard = () => api.get('/api/admin/dashboard');

export const getUsers = (params = {}) => api.get('/api/admin/users', { params });
export const getUserById = (id) => api.get(`/api/admin/users/${id}`);
export const createUser = (data) => api.post('/api/admin/users', data);
export const updateUser = (id, data) => api.patch(`/api/admin/users/${id}`, data);
export const suspendUser = (id) => api.patch(`/api/admin/users/${id}/suspend`);
export const reactivateUser = (id) => api.patch(`/api/admin/users/${id}/reactivate`);
export const deleteUser = (id) => api.delete(`/api/admin/users/${id}`);
export const resetPassword = (id) => api.post(`/api/admin/users/${id}/reset-password`);
export const changeUserRole = (id, data) => api.patch(`/api/admin/users/${id}/role`, data);
export const bulkSuspend = (data) => api.post('/api/admin/users/bulk-suspend', data);
export const bulkDelete = (data) => api.post('/api/admin/users/bulk-delete', data);
export const bulkImportUsers = (role, formData) =>
  api.post(`/api/admin/users/bulk-import?role=${role}`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
export const getPendingEnrollments = () => api.get('/api/admin/users/pending-enrollments');
export const approveEnrollment = (enrollmentId) =>
  api.patch(`/api/admin/users/enrollments/${enrollmentId}/approve`);

export const getGrades = () => api.get('/api/admin/grades');
export const createGrade = (data) => api.post('/api/admin/grades', data);
export const updateGrade = (id, data) => api.patch(`/api/admin/grades/${id}`, data);
export const deleteGrade = (id) => api.delete(`/api/admin/grades/${id}`);

export const getSubjects = (params = {}) => api.get('/api/admin/subjects', { params });
export const createSubject = (data) => api.post('/api/admin/subjects', data);
export const updateSubject = (id, data) => api.patch(`/api/admin/subjects/${id}`, data);
export const deleteSubject = (id) => api.delete(`/api/admin/subjects/${id}`);
export const assignInstructor = (subjectId, data) =>
  api.post(`/api/admin/subjects/${subjectId}/assign-instructor`, data);

export const getEnrollments = (params = {}) => api.get('/api/admin/enrollments', { params });
export const createEnrollment = (data) => api.post('/api/admin/enrollments', data);
export const bulkEnroll = (data) => api.post('/api/admin/enrollments/bulk', data);
export const removeEnrollment = (id) => api.delete(`/api/admin/enrollments/${id}`);

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
export const getIotDevice = (id) => api.get(`/api/admin/iot/devices/${id}`);
export const updateIotDevice = (id, data) => api.patch(`/api/admin/iot/devices/${id}`, data);
export const decommissionDevice = (id) => api.delete(`/api/admin/iot/devices/${id}`);
export const regenerateDeviceKey = (id) => api.post(`/api/admin/iot/devices/${id}/regenerate-key`);
export const updateDeviceStatus = (id, data) => api.patch(`/api/admin/iot/devices/${id}/status`, data);
export const getDeviceTelemetry = (id, params = {}) =>
  api.get(`/api/admin/iot/devices/${id}/telemetry`, { params });

export const uploadCurriculum = (formData) =>
  api.post('/api/admin/ingestion/upload', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
export const getIngestionJobs = (params = {}) => api.get('/api/admin/ingestion/jobs', { params });
export const getIngestionJob = (id) => api.get(`/api/admin/ingestion/jobs/${id}`);
export const cancelIngestionJob = (id) => api.delete(`/api/admin/ingestion/jobs/${id}`);

export const getCurriculumDocs = (params = {}) => api.get('/api/admin/curriculum', { params });
export const getCurriculumDoc = (id) => api.get(`/api/admin/curriculum/${id}`);
export const deleteCurriculumDoc = (id) => api.delete(`/api/admin/curriculum/${id}`);
export const requeueCurriculumDoc = (id) => api.post(`/api/admin/curriculum/${id}/requeue`);

export const getSecurityOverview = () => api.get('/api/admin/security/overview');
export const getSecurityEvents = () => api.get('/api/admin/security/events');
export const runIntegrityAudit = () => api.post('/api/admin/security/run-audit');

export const getSettings = () => api.get('/api/admin/settings');
export const updateSettings = (data) => api.patch('/api/admin/settings', data);
