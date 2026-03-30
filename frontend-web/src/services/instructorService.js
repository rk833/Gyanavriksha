import api from './api';

// Dashboard
export const getDashboard = () => api.get('/api/instructors/dashboard');

// Subjects
export const getSubjects = () => api.get('/api/instructors/subjects');
export const getSubjectDetail = (id) => api.get(`/api/instructors/subjects/${id}`);

// Assignments
export const getAssignments = (params = {}) => api.get('/api/instructors/assignments', { params });
export const getAssignmentDetail = (id) => api.get(`/api/instructors/assignments/${id}`);
export const createAssignment = (data) => api.post('/api/instructors/assignments', data);
export const updateAssignment = (id, data) => api.patch(`/api/instructors/assignments/${id}`, data);
export const publishAssignment = (id) => api.patch(`/api/instructors/assignments/${id}/publish`);
export const deleteAssignment = (id) => api.delete(`/api/instructors/assignments/${id}`);

// Submissions
export const getSubmissions = (params = {}) => api.get('/api/instructors/submissions', { params });
export const getSubmissionDetail = (id) => api.get(`/api/instructors/submissions/${id}`);
export const overrideFeedback = (id, data) => api.patch(`/api/instructors/submissions/${id}/feedback`, data);

// Analytics
export const getVelocityAnalytics = (params = {}) => api.get('/api/instructors/analytics/velocity', { params });
export const getAtRiskStudents = (params = {}) => api.get('/api/instructors/analytics/at-risk', { params });
export const getConceptHeatmap = (params = {}) => api.get('/api/instructors/analytics/concept-heatmap', { params });

// Knowledge Base
export const getKnowledgeBase = (params = {}) => api.get('/api/instructors/knowledge-base', { params });
export const uploadDocument = (formData) => api.post('/api/instructors/knowledge-base/upload', formData, {
  headers: { 'Content-Type': 'multipart/form-data' },
});
export const deleteDocument = (id) => api.delete(`/api/instructors/knowledge-base/${id}`);

// Profile
export const getProfile = () => api.get('/api/instructors/profile');
export const updateProfile = (data) => api.patch('/api/instructors/profile', data);
