import api from './api';

/**
 * Service layer for all student API calls.
 * Maps directly to the backend student bounded context: /api/students/*
 */

/**
 * Fetch aggregated dashboard statistics for the current student.
 *
 * @returns {Promise<import('./types').DashboardResponse>}
 */
export const getDashboard = () => api.get('/api/students/dashboard');

/**
 * List all subjects the current student is enrolled in.
 *
 * @returns {Promise<import('./types').SubjectResponse[]>}
 */
export const getSubjects = () => api.get('/api/students/subjects');

/**
 * Fetch detail for a single subject the student is enrolled in.
 *
 * @param {number} id - Subject ID.
 * @returns {Promise<import('./types').SubjectResponse>}
 */
export const getSubjectDetail = (id) => api.get(`/api/students/subjects/${id}`);

/**
 * Fetch paginated enrollments with completion percentages.
 *
 * @param {{ page?: number, per_page?: number }} params
 * @returns {Promise<import('./types').PaginatedResponse>}
 */
export const getEnrollments = (params = {}) =>
  api.get('/api/students/enrollments', { params });

/**
 * Fetch paginated published assignments for the student's enrolled subjects.
 *
 * @param {{ subject_id?: number, status?: 'open'|'closed'|'all', page?: number, per_page?: number }} params
 * @returns {Promise<import('./types').PaginatedResponse>}
 */
export const getAssignments = (params = {}) =>
  api.get('/api/students/assignments', { params });

/**
 * Fetch full detail for a single assignment.
 *
 * @param {string} id - Assignment UUID.
 * @returns {Promise<import('./types').AssignmentDetailResponse>}
 */
export const getAssignmentDetail = (id) => api.get(`/api/students/assignments/${id}`);

/** Start or resume a persisted exam session (server `exam_sessions` row). */
export const postExamSessionStart = (assignmentId) =>
  api.post(`/api/students/assignments/${assignmentId}/exam-session/start`);

/** Abandon in-progress exam (counts as attempt used). */
export const postExamSessionTerminate = (sessionId) =>
  api.post(`/api/students/exam-sessions/${sessionId}/terminate`);

/**
 * Upload handwritten work images as a new submission.
 *
 * @param {string} assignmentId - Assignment UUID.
 * @param {File[]} files - One or more image files.
 * @returns {Promise<import('./types').SubmissionListItem>}
 */
export const uploadSubmission = (assignmentId, files) => {
  const formData = new FormData();
  files.forEach((file) => formData.append('files', file));
  return api.post(`/api/students/submissions?assignment_id=${assignmentId}`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
};

/**
 * Fetch paginated submission records for the current student.
 *
 * @param {{ subject_id?: number, status?: string, page?: number, per_page?: number }} params
 * @returns {Promise<import('./types').PaginatedResponse>}
 */
export const getSubmissions = (params = {}) =>
  api.get('/api/students/submissions', { params });

/**
 * Fetch full submission detail including feedback and knowledge gap data.
 *
 * @param {string} id - Submission UUID.
 * @returns {Promise<import('./types').SubmissionDetailResponse>}
 */
export const getSubmissionDetail = (id) => api.get(`/api/students/submissions/${id}`);

/**
 * Download one uploaded file for the student's submission (blob; triggers save in browser).
 *
 * @param {string} submissionId
 * @param {number} fileIndex
 * @param {string} [filename] - Suggested download name.
 */
export const downloadSubmissionFile = (submissionId, fileIndex, filename) =>
  api.get(`/api/students/submissions/${submissionId}/files/${fileIndex}`, {
    responseType: 'blob',
    timeout: 120000,
  }).then((res) => {
    const blob = new Blob([res.data]);
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename || `submission-${fileIndex}`;
    a.click();
    window.URL.revokeObjectURL(url);
  });

/**
 * Fetch AI-generated grading feedback for a specific submission.
 *
 * @param {string} id - Submission UUID.
 * @returns {Promise<import('./types').SubmissionFeedbackResponse>}
 */
export const getSubmissionFeedback = (id) =>
  api.get(`/api/students/submissions/${id}/feedback`);

/**
 * Fetch paginated knowledge gaps detected for the current student.
 *
 * @param {{ subject_id?: number, resolved?: boolean, page?: number, per_page?: number }} params
 * @returns {Promise<import('./types').PaginatedResponse>}
 */
export const getKnowledgeGaps = (params = {}) =>
  api.get('/api/students/knowledge-gaps', { params });

/**
 * Fetch aggregated knowledge gap summary counts.
 *
 * @returns {Promise<{total_gaps: number, gaps_resolved: number, gaps_pending: number}>}
 */
export const getKnowledgeGapSummary = () =>
  api.get('/api/students/knowledge-gaps/summary');

/**
 * Fetch student progress analytics for the specified time period.
 *
 * @param {'weekly'|'monthly'} period
 * @returns {Promise<import('./types').StudentProgressResponse>}
 */
export const getProgress = (period = 'weekly') =>
  api.get('/api/students/progress', { params: { period } });

/**
 * Fetch the current student's profile.
 *
 * @returns {Promise<import('./types').UserResponse>}
 */
export const getProfile = () => api.get('/api/students/profile');

/**
 * Update the current student's profile (name and/or image URL).
 *
 * @param {{ full_name?: string, profile_image_url?: string }} data
 * @returns {Promise<import('./types').UserResponse>}
 */
export const updateProfile = (data) => api.patch('/api/students/profile', data);

/**
 * Fetch paginated notifications for the current student.
 *
 * @param {{ type?: string, read?: boolean, page?: number, per_page?: number }} params
 * @returns {Promise<import('./types').PaginatedResponse>}
 */
export const getNotifications = (params = {}) =>
  api.get('/api/students/notifications', { params });

/**
 * Fetch the count of unread notifications.
 *
 * @returns {Promise<{count: number}>}
 */
export const getUnreadCount = () =>
  api.get('/api/students/notifications/unread-count');

/**
 * Mark a single notification as read.
 *
 * @param {string} id - Notification UUID.
 * @returns {Promise<import('./types').NotificationResponse>}
 */
export const markNotificationRead = (id) =>
  api.patch(`/api/students/notifications/${id}/read`);

/**
 * Mark all unread notifications as read.
 *
 * @returns {Promise<{message: string}>}
 */
export const markAllNotificationsRead = () =>
  api.patch('/api/students/notifications/read-all');

/**
 * Fetch paginated curriculum documents for the student's enrolled subjects.
 *
 * @param {{ subject_id?: number, doc_type?: string, search?: string, page?: number, per_page?: number }} params
 * @returns {Promise<import('./types').PaginatedResponse>}
 */
export const getLibraryDocuments = (params = {}) =>
  api.get('/api/students/library', { params });

/**
 * Fetch detail for a single curriculum document.
 *
 * @param {string} id - Document UUID.
 * @returns {Promise<import('./types').CurriculumDocumentResponse>}
 */
export const getLibraryDocument = (id) => api.get(`/api/students/library/${id}`);

/**
 * Download a curriculum document as a file blob (uses auth token automatically).
 *
 * @param {string} docId - Document UUID.
 * @param {string} fileName - Suggested save name.
 */
export const downloadDocument = async (docId, fileName) => {
  const res = await api.get(`/api/students/library/${docId}/download`, {
    responseType: 'blob',
    timeout: 180_000,
  });
  const url = URL.createObjectURL(res.data);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
};
