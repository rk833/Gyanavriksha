"""API-level Pydantic request/response schemas for the Admin Control Panel."""
import uuid
from datetime import datetime
from typing import Optional

from pydantic import BaseModel, EmailStr, Field

from app.shared.source_enum import UserRole


class AdminUserCreateRequest(BaseModel):
    """Request body for creating a new platform user."""

    email: EmailStr
    full_name: str = Field(..., min_length=1, max_length=150)
    role: UserRole
    grade_id: Optional[int] = None
    password: Optional[str] = None


class AdminUserUpdateRequest(BaseModel):
    """Request body for partially updating a user record."""

    full_name: Optional[str] = Field(None, min_length=1, max_length=150)
    role: Optional[UserRole] = None
    is_active: Optional[bool] = None
    grade_id: Optional[int] = None
    profile_image_url: Optional[str] = None


class AdminUserResponse(BaseModel):
    """Full user detail returned by admin user endpoints."""

    user_id: uuid.UUID
    email: str
    full_name: str
    role: UserRole
    grade_name: Optional[str] = None
    is_active: bool
    is_email_verified: bool
    totp_enabled: bool
    created_at: datetime
    last_login_at: Optional[datetime] = None

    model_config = {"from_attributes": True}


class AdminUserCreateResponse(AdminUserResponse):
    """Extends user response with a one-time generated password field."""

    generated_password: Optional[str] = None


class RoleDistribution(BaseModel):
    """Count of users per role across the platform."""

    students: int = 0
    instructors: int = 0
    admins: int = 0


class AdminUserListResponse(BaseModel):
    """Paginated user list with platform-level summary stats."""

    users: list[AdminUserResponse]
    total_count: int
    page: int
    per_page: int
    role_distribution: RoleDistribution
    security_health_pct: float = 0.0
    pending_approvals_count: int = 0


class BulkUserIdsRequest(BaseModel):
    """Request body for bulk user operations."""

    user_ids: list[uuid.UUID]


class RoleChangeRequest(BaseModel):
    """Request body for changing a user's role."""

    role: UserRole
    subject_ids: Optional[list[int]] = None
    grade_id: Optional[int] = None


class GradeCreateRequest(BaseModel):
    """Request body for creating an academic grade."""

    grade_name: str = Field(..., min_length=1, max_length=50)
    grade_level: int = Field(..., ge=1, le=20)
    description: Optional[str] = None


class GradeUpdateRequest(BaseModel):
    """Request body for partially updating a grade."""

    grade_name: Optional[str] = Field(None, min_length=1, max_length=50)
    description: Optional[str] = None


class GradeResponse(BaseModel):
    """Grade record with aggregated counts."""

    grade_id: int
    grade_name: str
    grade_level: int
    description: Optional[str] = None
    subject_count: int = 0
    student_count: int = 0

    model_config = {"from_attributes": True}


class SubjectCreateRequest(BaseModel):
    """Request body for creating a subject."""

    name: str = Field(..., min_length=1, max_length=150)
    subject_code: str = Field(..., min_length=1, max_length=20)
    description: Optional[str] = None
    grade_id: int
    instructor_id: Optional[uuid.UUID] = None


class SubjectUpdateRequest(BaseModel):
    """Request body for partially updating a subject."""

    name: Optional[str] = Field(None, min_length=1, max_length=150)
    description: Optional[str] = None
    instructor_id: Optional[uuid.UUID] = None


class SubjectResponse(BaseModel):
    """Subject record with instructor and count info."""

    subject_id: int
    name: str
    subject_code: str
    description: Optional[str] = None
    grade_id: int
    grade_name: str
    instructor_name: Optional[str] = None
    student_count: int = 0
    assignment_count: int = 0

    model_config = {"from_attributes": True}


class AssignInstructorRequest(BaseModel):
    """Request body for assigning an instructor to a subject."""

    instructor_id: uuid.UUID


class EnrollmentCreateRequest(BaseModel):
    """Request body for enrolling a single student."""

    student_id: uuid.UUID
    subject_id: int


class EnrollmentBulkCreateRequest(BaseModel):
    """Request body for bulk enrolling students into one subject."""

    student_ids: list[uuid.UUID]
    subject_id: int


class EnrollmentResponse(BaseModel):
    """Enrollment record with joined student and subject info."""

    enrollment_id: uuid.UUID
    student_name: str
    student_email: str
    subject_name: str
    grade_name: str
    enrolled_at: datetime
    status: str

    model_config = {"from_attributes": True}


class EnrollmentListResponse(BaseModel):
    """Paginated enrollment list."""

    enrollments: list[EnrollmentResponse]
    total_count: int
    page: int
    per_page: int


class BulkEnrollmentResponse(BaseModel):
    """Result summary for a bulk enrollment operation."""

    enrolled_count: int
    skipped_student_ids: list[uuid.UUID] = []


class IngestionJobResponse(BaseModel):
    """Status record for a single curriculum ingestion job."""

    job_id: uuid.UUID
    filename: str
    grade_subject: str
    status: str
    progress_pct: float = 0.0
    created_at: datetime
    completed_at: Optional[datetime] = None

    model_config = {"from_attributes": True}


class IngestionJobListResponse(BaseModel):
    """Paginated list of ingestion jobs."""

    jobs: list[IngestionJobResponse]
    total_count: int
    page: int
    per_page: int


class IoTDeviceCreateRequest(BaseModel):
    """Request body for registering a new IoT device."""

    node_id: str = Field(..., min_length=1, max_length=100)
    device_type: str = Field(..., min_length=1, max_length=50)
    location: str = Field(..., min_length=1, max_length=150)
    description: Optional[str] = None


class IoTDeviceUpdateRequest(BaseModel):
    """Request body for partially updating an IoT device record."""

    location: Optional[str] = Field(None, min_length=1, max_length=150)
    description: Optional[str] = None
    status: Optional[str] = None


class DeviceStatusUpdateRequest(BaseModel):
    """Request body for manually overriding a device status."""

    status: str


class IoTDeviceResponse(BaseModel):
    """IoT device record with masked API key hint."""

    device_id: uuid.UUID
    node_id: str
    device_type: str
    location: str
    description: Optional[str] = None
    api_key_hint: str
    status: str
    last_seen_at: Optional[datetime] = None
    created_at: datetime

    model_config = {"from_attributes": True}


class IoTDeviceCreateResponse(IoTDeviceResponse):
    """Extends device response with a one-time plain-text API key."""

    api_key: str


class ApiKeyRegenerateResponse(BaseModel):
    """Response after regenerating a device API key."""

    device_id: uuid.UUID
    node_id: str
    api_key: str


class IoTDeviceListResponse(BaseModel):
    """Paginated device list with network summary stats."""

    devices: list[IoTDeviceResponse]
    total_count: int
    active_nodes: int
    alerts_count: int
    page: int
    per_page: int


class IoTHealthResponse(BaseModel):
    """Overall IoT network health summary."""

    health_check_pct: float
    uptime_status: str
    data_throughput_gbps: float
    network_security_protocol: str
    active_device_count: int
    offline_device_count: int
    alert_count: int


class AuditLogResponse(BaseModel):
    """Single audit log entry."""

    log_id: int
    timestamp: datetime
    user_email: Optional[str] = None
    user_initials: Optional[str] = None
    event_type: str
    description: str
    ip_address: Optional[str] = None
    status: str

    model_config = {"from_attributes": True}


class AuditLogListResponse(BaseModel):
    """Paginated audit log list."""

    logs: list[AuditLogResponse]
    total_count: int
    page: int
    per_page: int


class SystemHealthSummary(BaseModel):
    """System resource health snapshot."""

    node_uptime_pct: float
    memory_load_pct: float
    live_monitoring_active: bool = True


class AdminDashboardResponse(BaseModel):
    """Aggregated admin control panel overview."""

    iot_nodes_active: int
    chromadb_accuracy_pct: Optional[float] = None
    two_fa_compliance_pct: float
    iot_registry_preview: list[dict] = []
    integrity_status: str
    integrity_verified_count: int
    quick_user_access: list[dict] = []
    system_health: SystemHealthSummary


class AdminSettingsResponse(BaseModel):
    """Current admin system settings."""

    ocr_engine: str
    rag_chunk_size: int
    google_vision_key_hint: Optional[str] = None
    gemini_key_hint: Optional[str] = None
    mqtt_broker_host: Optional[str] = None
    maintenance_mode: bool
    backup_last_success: Optional[datetime] = None


class AdminSettingsUpdateRequest(BaseModel):
    """Request body for updating admin system settings."""

    ocr_engine: Optional[str] = None
    rag_chunk_size: Optional[int] = Field(None, ge=64, le=2048)
    google_vision_api_key: Optional[str] = None
    gemini_api_key: Optional[str] = None
    mqtt_broker_host: Optional[str] = None
    mqtt_broker_credentials: Optional[str] = None
    maintenance_mode: Optional[bool] = None
