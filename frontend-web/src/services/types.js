/**
 * Shared JSDoc type definitions for Gyanavriksha API response shapes.
 *
 * These are documentation-only — no runtime code is exported.
 * They mirror the Pydantic schemas defined in the backend.
 */

/**
 * @typedef {'student'|'instructor'|'admin'} UserRole
 */

/**
 * @typedef {object} UserResponse
 * @property {string}   user_id
 * @property {string}   email
 * @property {string}   full_name
 * @property {UserRole} role
 * @property {boolean}  is_active
 * @property {boolean}  is_email_verified
 * @property {boolean}  totp_enabled
 * @property {string|null} profile_image_url
 * @property {string}   created_at
 */

/**
 * @typedef {object} TokenResponse
 * @property {string} access_token
 * @property {string} refresh_token
 * @property {string} token_type
 * @property {number} expires_in
 */

/**
 * @typedef {object} LoginResponse
 * @property {string|null}  access_token
 * @property {string|null}  refresh_token
 * @property {string}       token_type
 * @property {number|null}  expires_in
 * @property {boolean}      requires_2fa
 * @property {string|null}  user_id
 */

/**
 * @typedef {object} PaginatedResponse
 * @property {object[]} items
 * @property {number}   total
 * @property {number}   page
 * @property {number}   per_page
 * @property {number}   total_pages
 */

/**
 * @typedef {object} SubjectResponse
 * @property {number}  subject_id
 * @property {string}  subject_name
 * @property {string}  subject_code
 * @property {string|null} description
 * @property {number}  grade_id
 * @property {string|null} grade_name
 * @property {boolean} is_active
 */

/**
 * @typedef {object} AssignmentDetailResponse
 * @property {string}  assignment_id
 * @property {string}  title
 * @property {string|null} description
 * @property {number}  subject_id
 * @property {string|null} subject_name
 * @property {string|null} grade_name
 * @property {string[]|null} topic_tags
 * @property {boolean} is_exam_mode
 * @property {string|null} due_date
 * @property {boolean} is_published
 * @property {boolean} has_submitted
 * @property {string}  created_at
 * @property {number}  submission_count
 */

/**
 * @typedef {object} SubmissionDetailResponse
 * @property {string} submission_id
 * @property {string} assignment_id
 * @property {string|null} assignment_title
 * @property {string|null} subject_name
 * @property {string} submitted_at
 * @property {string} processing_status
 * @property {string|null} grade_classification
 * @property {number|null} score_percentage
 * @property {string} image_path
 * @property {number|null} image_quality_score
 * @property {boolean} is_exam_submission
 * @property {object|null} feedback
 * @property {object[]|null} knowledge_gaps
 */

/**
 * @typedef {object} SubmissionFeedbackResponse
 * @property {string}      feedback_id
 * @property {string}      overall_feedback
 * @property {object}      step_by_step_corrections
 * @property {string|null} failed_at_step
 * @property {string[]|null} rag_chunks_used
 * @property {string|null} llm_model_used
 * @property {boolean}     knowledge_gap_detected
 * @property {string}      created_at
 */

/**
 * @typedef {object} NotificationResponse
 * @property {string}  notification_id
 * @property {string}  title
 * @property {string}  body
 * @property {string}  type
 * @property {string}  channel
 * @property {boolean} is_read
 * @property {string|null} related_resource_id
 * @property {string}  created_at
 */

/**
 * @typedef {object} CurriculumDocumentResponse
 * @property {string} doc_id
 * @property {string} file_name
 * @property {string} file_path
 * @property {number|null} file_size_bytes
 * @property {string} doc_type
 * @property {string} embedding_status
 * @property {number} subject_id
 * @property {string|null} subject_name
 * @property {string|null} grade_name
 * @property {string|null} uploaded_by_name
 * @property {string} created_at
 */

/**
 * @typedef {object} DashboardResponse
 * @property {string}    student_name
 * @property {object|null} current_subject
 * @property {object[]} enrolled_subjects
 * @property {object[]} recent_submissions
 * @property {number}   total_submissions
 * @property {number|null} average_score
 * @property {number}   knowledge_gaps_count
 * @property {object[]} upcoming_assignments
 * @property {number}   notifications_unread_count
 */

/**
 * @typedef {object} StudentProgressResponse
 * @property {number|null} average_score
 * @property {number|null} trend_percentage
 * @property {number}      quizzes_completed
 * @property {number}      active_streak
 * @property {object[]}    score_progression
 * @property {object[]}    topic_difficulty
 * @property {boolean}     at_risk_flag
 * @property {string[]}    improvement_tips
 */

/**
 * @typedef {object} InstructorDashboardResponse
 * @property {number}   class_completion
 * @property {number|null} class_avg_score
 * @property {number}   total_assignments
 * @property {number}   total_submissions
 * @property {object[]} recent_submissions
 * @property {object[]} heatmap_preview
 * @property {object[]} velocity_table
 */

/**
 * @typedef {object} InstructorSubjectResponse
 * @property {number} subject_id
 * @property {string} subject_name
 * @property {string} subject_code
 * @property {number} grade_id
 * @property {string|null} grade_name
 * @property {number} student_count
 * @property {number} assignment_count
 */

/**
 * @typedef {object} InstructorSubjectDetailResponse
 * @property {number}   subject_id
 * @property {string}   subject_name
 * @property {string}   subject_code
 * @property {string|null} description
 * @property {number}   grade_id
 * @property {string|null} grade_name
 * @property {number}   student_count
 * @property {number}   assignment_count
 * @property {number}   total_submissions
 * @property {number|null} class_avg_score
 * @property {object[]} students
 * @property {number}   students_total
 * @property {number}   students_page
 * @property {number}   students_per_page
 * @property {number}   students_total_pages
 */

/**
 * @typedef {object} InstructorAssignmentResponse
 * @property {string}  assignment_id
 * @property {string}  title
 * @property {string|null} description
 * @property {number}  subject_id
 * @property {string|null} subject_name
 * @property {string|null} grade_name
 * @property {string[]|null} topic_tags
 * @property {boolean} is_exam_mode
 * @property {string|null} due_date
 * @property {boolean} is_published
 * @property {number}  max_score
 * @property {number}  submission_count
 * @property {number|null} avg_score
 * @property {string}  created_at
 */

/**
 * @typedef {InstructorAssignmentResponse} InstructorAssignmentDetailResponse
 * @property {number}   graded_count
 * @property {number}   pending_count
 * @property {object[]} recent_submissions
 */

/**
 * @typedef {object} InstructorSubmissionDetailResponse
 * @property {string}  submission_id
 * @property {string}  student_id
 * @property {string|null} student_name
 * @property {string}  assignment_id
 * @property {string|null} assignment_title
 * @property {string|null} subject_name
 * @property {string}  submitted_at
 * @property {string}  processing_status
 * @property {number|null} score_percentage
 * @property {number}  file_count
 * @property {string}  image_path
 * @property {string|null} student_email
 * @property {object|null} feedback
 */

/**
 * @typedef {object} VelocityAnalyticsResponse
 * @property {number}   class_avg_velocity
 * @property {object[]} velocity_trend
 * @property {object[]} completion_distribution
 * @property {object[]} student_velocities
 */

/**
 * @typedef {object} ConceptHeatmapResponse
 * @property {object[]} heatmap_entries
 * @property {object[]} emerging_friction
 * @property {string|null} teaching_insight
 */

/**
 * @typedef {object} KnowledgeBaseDocumentResponse
 * @property {string} doc_id
 * @property {number} subject_id
 * @property {string|null} subject_name
 * @property {string|null} grade_name
 * @property {string} file_name
 * @property {number|null} file_size_bytes
 * @property {string} doc_type
 * @property {string} created_at
 */

/**
 * @typedef {object} InstructorProfileResponse
 * @property {string}  user_id
 * @property {string}  email
 * @property {string}  full_name
 * @property {string}  role
 * @property {boolean} is_active
 * @property {boolean} totp_enabled
 * @property {string|null} profile_image_url
 * @property {string}  created_at
 * @property {InstructorSubjectResponse[]} subjects
 */

export {};
