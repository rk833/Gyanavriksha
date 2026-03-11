from enum import Enum


class UserRole(str, Enum):
    STUDENT = "student"
    INSTRUCTOR = "instructor"
    ADMIN = "admin"


class QrSessionStatus(str, Enum):
    PENDING = "pending"
    SCANNED = "scanned"
    AUTHENTICATED = "authenticated"
    EXPIRED = "expired"


class EmailVerificationType(str, Enum):
    EMAIL_VERIFY = "email_verify"
    PASSWORD_RESET = "password_reset"
    TWO_FA_SETUP = "2fa_setup"


class DocumentType(str, Enum):
    CURRICULUM_PDF = "curriculum_pdf"
    INSTRUCTOR_NOTE = "instructor_note"


class EmbeddingStatus(str, Enum):
    PENDING = "pending"
    PROCESSING = "processing"
    DONE = "done"
    FAILED = "failed"


class SubmissionProcessingStatus(str, Enum):
    QUEUED = "queued"
    OCR = "ocr"
    GRADING = "grading"
    DONE = "done"
    REJECTED = "rejected"


class GradeClassification(str, Enum):
    CORRECT = "correct"
    PARTIAL = "partial"
    INCORRECT = "incorrect"


class OcrEngineUsed(str, Enum):
    GOOGLE_CLOUD_VISION = "google_cloud_vision"
    TESSERACT_FALLBACK = "tesseract_fallback"


class QuestionType(str, Enum):
    MCQ = "mcq"
    SHORT_ANSWER = "short_answer"


class QuestionDifficulty(str, Enum):
    EASY = "easy"
    MEDIUM = "medium"
    HARD = "hard"


class MicroQuizStatus(str, Enum):
    ASSIGNED = "assigned"
    IN_PROGRESS = "in_progress"
    COMPLETED = "completed"


class PeriodType(str, Enum):
    WEEKLY = "weekly"
    MONTHLY = "monthly"


class SensorType(str, Enum):
    LDR = "ldr"
    ULTRASONIC = "ultrasonic"


class AlertTriggered(str, Enum):
    POSTURE = "posture"
    ABSENCE = "absence"
    EXAM_PAUSE = "exam_pause"


class ExamSessionStatus(str, Enum):
    ACTIVE = "active"
    PAUSED = "paused"
    COMPLETED = "completed"
    TERMINATED = "terminated"


class ActorRole(str, Enum):
    STUDENT = "student"
    INSTRUCTOR = "instructor"
    ADMIN = "admin"


class NotificationType(str, Enum):
    GRADING_DONE = "grading_done"
    HEATMAP_UPDATED = "heatmap_updated"
    QUIZ_ASSIGNED = "quiz_assigned"
    POSTURE_ALERT = "posture_alert"
    AT_RISK_FLAG = "at_risk_flag"


class NotificationChannel(str, Enum):
    WEBSOCKET = "websocket"
    EMAIL = "email"
    IN_APP = "in_app"

