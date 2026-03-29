import api from './api';

// Dashboard
export const getDashboard = () => api.get('/api/students/dashboard');

// Subjects & Enrollments
export const getSubjects = () => api.get('/api/students/subjects');
export const getSubjectDetail = (id) => api.get(`/api/students/subjects/${id}`);
export const getEnrollments = (params = {}) => api.get('/api/students/enrollments', { params });

// Assignments
export const getAssignments = (params = {}) => api.get('/api/students/assignments', { params });
export const getAssignmentDetail = (id) => api.get(`/api/students/assignments/${id}`);

// Submissions
export const getSubmissions = (params = {}) => api.get('/api/students/submissions', { params });
export const getSubmissionDetail = (id) => api.get(`/api/students/submissions/${id}`);
export const getSubmissionFeedback = (id) => api.get(`/api/students/submissions/${id}/feedback`);
export const uploadSubmission = (assignmentId, files) => {
  const formData = new FormData();
  files.forEach((file) => formData.append('files', file));
  return api.post(`/api/students/submissions?assignment_id=${assignmentId}`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
};

// Knowledge Gaps
export const getKnowledgeGaps = (params = {}) => api.get('/api/students/knowledge-gaps', { params });
export const getKnowledgeGapSummary = () => api.get('/api/students/knowledge-gaps/summary');

// Progress
export const getProgress = (period = 'weekly') => api.get('/api/students/progress', { params: { period } });

// Profile
export const getProfile = () => api.get('/api/students/profile');
export const updateProfile = (data) => api.patch('/api/students/profile', data);

// Notifications
export const getNotifications = (params = {}) => api.get('/api/students/notifications', { params });
export const getUnreadCount = () => api.get('/api/students/notifications/unread-count');
export const markNotificationRead = (id) => api.patch(`/api/students/notifications/${id}/read`);
export const markAllNotificationsRead = () => api.patch('/api/students/notifications/read-all');

// Library
export const getLibraryDocuments = (params = {}) => api.get('/api/students/library', { params });
export const getLibraryDocument = (id) => api.get(`/api/students/library/${id}`);
