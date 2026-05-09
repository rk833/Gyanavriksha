import api from './api';

/**
 * Service layer for all instructor API calls.
 * Maps directly to the backend instructor bounded context: /api/instructors/*
 */

/**
 * Fetch aggregated intelligence-dashboard statistics for the current instructor.
 *
 * @returns {Promise<import('./types').InstructorDashboardResponse>}
 */
export const getDashboard = () => api.get('/api/instructors/dashboard');

/**
 * List all subjects assigned to the current instructor.
 *
 * @returns {Promise<import('./types').InstructorSubjectResponse[]>}
 */
export const getSubjects = () => api.get('/api/instructors/subjects');

/**
 * Fetch subject detail with paginated enrolled-student progress data.
 *
 * @param {number} id - Subject ID.
 * @param {{ page?: number, per_page?: number, sort_by?: 'name'|'score'|'submissions' }} params
 * @returns {Promise<import('./types').InstructorSubjectDetailResponse>}
 */
export const getSubjectDetail = (id, params = {}) =>
  api.get(`/api/instructors/subjects/${id}`, { params });

/**
 * Fetch paginated assignments for the current instructor with optional filters.
 *
 * @param {{ subject_id?: number, status?: 'draft'|'published', is_exam_mode?: boolean, page?: number, per_page?: number }} params
 * @returns {Promise<import('./types').PaginatedResponse>}
 */
export const getAssignments = (params = {}) =>
  api.get('/api/instructors/assignments', { params });

/**
 * Fetch full assignment detail with submission statistics.
 *
 * @param {string} id - Assignment UUID.
 * @returns {Promise<import('./types').InstructorAssignmentDetailResponse>}
 */
export const getAssignmentDetail = (id) =>
  api.get(`/api/instructors/assignments/${id}`);

/**
 * Create a new draft assignment for one of the instructor's subjects.
 *
 * @param {{ title: string, subject_id: number, description?: string, due_date?: string, topic_tags?: string[], max_score?: number, is_exam_mode?: boolean }} data
 * @returns {Promise<import('./types').InstructorAssignmentResponse>}
 */
export const createAssignment = (data) =>
  api.post('/api/instructors/assignments', data);

/**
 * Apply partial updates to an existing assignment.
 *
 * @param {string} id - Assignment UUID.
 * @param {Partial<import('./types').AssignmentUpdateRequest>} data
 * @returns {Promise<import('./types').InstructorAssignmentResponse>}
 */
export const updateAssignment = (id, data) =>
  api.patch(`/api/instructors/assignments/${id}`, data);

/**
 * Publish a draft assignment so students can see and submit work.
 *
 * @param {string} id - Assignment UUID.
 * @returns {Promise<import('./types').InstructorAssignmentResponse>}
 */
export const publishAssignment = (id) =>
  api.patch(`/api/instructors/assignments/${id}/publish`);

/**
 * Delete a draft assignment that has no associated submissions.
 *
 * @param {string} id - Assignment UUID.
 * @returns {Promise<void>}
 */
export const deleteAssignment = (id) =>
  api.delete(`/api/instructors/assignments/${id}`);

/**
 * Fetch paginated submissions for the instructor's assignments with optional filters.
 *
 * @param {{ assignment_id?: string, student_id?: string, subject_id?: number, status?: string, page?: number, per_page?: number }} params
 * @returns {Promise<import('./types').PaginatedResponse>}
 */
export const getSubmissions = (params = {}) =>
  api.get('/api/instructors/submissions', { params });

/**
 * Fetch full submission detail including AI-generated and instructor feedback.
 *
 * @param {string} id - Submission UUID.
 * @returns {Promise<import('./types').InstructorSubmissionDetailResponse>}
 */
export const getSubmissionDetail = (id) =>
  api.get(`/api/instructors/submissions/${id}`);

/**
 * Download one uploaded file for a submission the instructor can access.
 *
 * @param {string} submissionId
 * @param {number} fileIndex
 * @param {string} [filename]
 */
export const downloadSubmissionFile = (submissionId, fileIndex, filename) =>
  api.get(`/api/instructors/submissions/${submissionId}/files/${fileIndex}`, {
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
 * Create or override instructor feedback and score on a submission.
 *
 * @param {string} id - Submission UUID.
 * @param {{ score_percentage: number, overall_feedback?: string, strengths?: string, improvements?: string, instructor_comments?: string }} data
 * @returns {Promise<import('./types').InstructorSubmissionDetailResponse>}
 */
export const overrideFeedback = (id, data) =>
  api.patch(`/api/instructors/submissions/${id}/feedback`, data);

/**
 * Fetch submission velocity analytics for the instructor's subjects.
 *
 * @param {{ subject_id?: number }} params
 * @returns {Promise<import('./types').VelocityAnalyticsResponse>}
 */
export const getVelocityAnalytics = (params = {}) =>
  api.get('/api/instructors/analytics/velocity', { params });

/**
 * Fetch paginated at-risk students identified by the analytics engine.
 *
 * @param {{ subject_id?: number, grade_id?: number, page?: number, per_page?: number }} params
 * @returns {Promise<import('./types').PaginatedResponse>}
 */
export const getAtRiskStudents = (params = {}) =>
  api.get('/api/instructors/analytics/at-risk', { params });

/**
 * Fetch concept heatmap data showing topic-level knowledge struggle areas.
 *
 * @param {{ subject_id?: number, grade_id?: number, timeframe?: '7d'|'30d'|'all' }} params
 * @returns {Promise<import('./types').ConceptHeatmapResponse>}
 */
export const getConceptHeatmap = (params = {}) =>
  api.get('/api/instructors/analytics/concept-heatmap', { params });

/**
 * Fetch paginated knowledge-base documents uploaded by the current instructor.
 *
 * @param {{ subject_id?: number, doc_type?: 'curriculum_pdf'|'instructor_note', search?: string, page?: number, per_page?: number }} params
 * @returns {Promise<import('./types').PaginatedResponse>}
 */
export const getKnowledgeBase = (params = {}) =>
  api.get('/api/instructors/knowledge-base', { params });

/**
 * Upload a PDF document to the knowledge base for one of the instructor's subjects.
 *
 * @param {FormData} formData - Must include `file`, `subject_id`, and `doc_type` fields.
 * @returns {Promise<import('./types').KnowledgeBaseDocumentResponse>}
 */
export const uploadDocument = (formData) =>
  api.post('/api/instructors/knowledge-base/upload', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });

/**
 * Delete a knowledge-base document owned by the current instructor.
 *
 * @param {string} id - Document UUID.
 * @returns {Promise<void>}
 */
export const deleteDocument = (id) =>
  api.delete(`/api/instructors/knowledge-base/${id}`);

/**
 * Live exam monitor: roster, session states, IoT telemetry, posture alert feed.
 *
 * @param {{ assignment_id?: string }} params
 */
export const getExamMonitor = (params = {}) =>
  api.get('/api/instructors/exam-monitor', { params });

/**
 * Fetch the current instructor's profile including assigned subjects.
 *
 * @returns {Promise<import('./types').InstructorProfileResponse>}
 */
export const getProfile = () => api.get('/api/instructors/profile');

/**
 * Update the current instructor's profile (name and/or image URL).
 *
 * @param {{ full_name?: string, profile_image_url?: string }} data
 * @returns {Promise<import('./types').InstructorProfileResponse>}
 */
export const updateProfile = (data) => api.patch('/api/instructors/profile', data);

// ── Notifications ─────────────────────────────────────────────────────────

export const getNotifications = (params = {}) =>
  api.get('/api/instructors/notifications', { params });

export const getUnreadCount = () =>
  api.get('/api/instructors/notifications/unread-count');

export const markNotificationRead = (id) =>
  api.patch(`/api/instructors/notifications/${id}/read`);

export const markAllNotificationsRead = () =>
  api.patch('/api/instructors/notifications/read-all');
