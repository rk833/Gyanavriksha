import api from './api';

/**
 * Service layer for all AI-integration API calls.
 * Covers RAG queries/uploads, adaptive quiz generation, and grading results.
 */

// RAG

/**
 * Send a natural-language query to the curriculum RAG pipeline.
 *
 * @param {{ user_type: string, query: string, student_id?: string, grade?: number }} payload
 * @returns {Promise<{ answer: string, sources: string[] }>}
 */
export const queryRag = (payload) => api.post('/api/rag/query', payload);

/**
 * Upload a personal note file to the student's RAG namespace.
 *
 * @param {File} file
 * @param {{ student_id: string, subject?: string }} meta
 * @returns {Promise<{ chunks_added: number, collection: string }>}
 */
export const uploadPersonalNote = (file, meta) => {
  const fd = new FormData();
  fd.append('file', file);
  fd.append('user_type', 'student');
  fd.append('submitted_by', meta.student_id);
  if (meta.subject) fd.append('subject', meta.subject);
  if (meta.student_id) fd.append('student_id', meta.student_id);
  return api.post('/api/rag/upload', fd, {
    headers: { 'Content-Type': 'multipart/form-data' },
    timeout: 120_000,
  });
};

// Quiz

/**
 * Generate an AI micro-quiz for a specific concept and knowledge gap.
 *
 * @param {{ student_id: string, subject_id: number, concept: string, num_questions?: number, gap_id?: string }} payload
 * @returns {Promise<import('./types').MicroQuizResponse>}
 */
export const generateQuiz = (payload) => api.post('/api/quiz/generate', payload, { timeout: 120_000 });

/**
 * Stream adaptive quiz generation (NDJSON). Events: { type: 'question', index, total, question },
 * then { type: 'complete', quiz }. Errors as { type: 'error', detail }.
 *
 * @param {object} payload - Same shape as generateQuiz (student_id, subject_id, concept, num_questions?, gap_id?)
 * @param {(ev: object) => void} onEvent
 * @param {AbortSignal} [signal]
 */
export async function generateQuizStream(payload, onEvent, signal) {
  const token = localStorage.getItem('access_token');
  const base = import.meta.env.VITE_API_URL || 'http://localhost:8000';
  const res = await fetch(`${base}/api/quiz/generate-stream`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(payload),
    signal,
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(text || `Quiz stream failed (${res.status})`);
  }
  const reader = res.body?.getReader();
  if (!reader) throw new Error('No response body');
  const dec = new TextDecoder();
  let buf = '';
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += dec.decode(value, { stream: true });
    const lines = buf.split('\n');
    buf = lines.pop() ?? '';
    for (const line of lines) {
      const s = line.trim();
      if (!s) continue;
      const ev = JSON.parse(s);
      onEvent(ev);
      if (ev.type === 'error') {
        throw new Error(ev.detail || 'Quiz generation failed');
      }
    }
  }
}

/**
 * Fetch the paginated list of micro-quizzes assigned to a student.
 *
 * @param {string} studentId
 * @param {{ subject_id?: number, page?: number, per_page?: number }} params
 * @returns {Promise<import('./types').PaginatedResponse>}
 */
export const getStudentQuizzes = (studentId, params = {}) =>
  api.get(`/api/quiz/students/${studentId}`, { params });

/**
 * Fetch a specific micro-quiz for a student.
 *
 * @param {string} studentId
 * @param {string} quizId
 * @returns {Promise<import('./types').MicroQuizResponse>}
 */
export const getStudentQuiz = (studentId, quizId) =>
  api.get(`/api/quiz/students/${studentId}/${quizId}`);

/**
 * Submit micro-quiz answers (indices per question; null = skipped). Server scores and may resolve the gap.
 *
 * @param {string} quizId
 * @param {(number|null|undefined)[]} answers
 */
export const submitMicroQuiz = (quizId, answers) =>
  api.post(`/api/students/quizzes/${quizId}/submit`, { answers });

// Grading

/**
 * Fetch the OCR and LLM grading result for a submission.
 *
 * @param {string} submissionId - Submission UUID.
 * @returns {Promise<import('./types').GradingResultResponse>}
 */
export const getGradingResult = (submissionId) =>
  api.get(`/api/grading/submissions/${submissionId}/result`);

/**
 * Trigger OCR and LLM grading for a queued submission.
 *
 * @param {string} submissionId - Submission UUID.
 * @returns {Promise<{ message: string, submission_id: string }>}
 */
export const triggerGrading = (submissionId) =>
  api.post(`/api/grading/submissions/${submissionId}/process`);
