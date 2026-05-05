"""
Seed script — creates demo grades, subjects, users, enrollments, IoT devices,
audit logs, ingestion jobs, system settings, and security events for testing.
Run from the `backend` folder:

    uv run python -m app.scripts.seed_demo_data

This script is idempotent: running it again will skip existing records.
"""
import hashlib
import json
import uuid
from datetime import datetime, timedelta, timezone

from sqlalchemy.orm import Session

from app.core.database import SessionLocal
from app.core.security import hash_password
from app.db.models.assignment import Assignment
from app.db.models.audit_log import AuditLog
from app.db.models.curriculum_document import CurriculumDocument
from app.db.models.grade import Grade
from app.db.models.instructor_subject import InstructorSubject
from app.db.models.iot_device import IotDevice
from app.db.models.student_enrollment import StudentEnrollment
from app.db.models.subject import Subject
from app.db.models.system_setting import SystemSetting
from app.db.models.user import User
from app.shared.source_enum import ActorRole, DocumentType, EmbeddingStatus, UserRole


DEMO_STUDENT_EMAIL = "student@gyanavriksha.edu.np"
DEMO_STUDENT_PASSWORD = "Student@1234"
DEMO_STUDENT_NAME = "Rohan Sharma"

DEMO_INSTRUCTOR_EMAIL = "instructor@gyanavriksha.edu.np"
DEMO_INSTRUCTOR_PASSWORD = "Instructor@1234"
DEMO_INSTRUCTOR_NAME = "Dr. Priya Acharya"

DEMO_ADMIN_EMAIL = "admin@gyanavriksha.edu.np"
DEMO_ADMIN_PASSWORD = "Admin@1234"
DEMO_ADMIN_NAME = "System Administrator"

# Grade 9 English / CS cohort (5+ students enrolled in ENG-09 and CS-09)
G9_COHORT_STUDENTS = [
    ("image.png", "Aarav Thapa"),
    ("g9student02@gyanavriksha.edu.np", "Mina Gurung"),
    ("g9student03@gyanavriksha.edu.np", "Kiran Shah"),
    ("g9student04@gyanavriksha.edu.np", "Puja Magar"),
    ("g9student05@gyanavriksha.edu.np", "Bikash KC"),
]

# Dedicated instructors (same password as main demo instructor for convenience)
SPEC_INSTRUCTOR_PASSWORD = DEMO_INSTRUCTOR_PASSWORD
INSTRUCTOR_ENG_G9_EMAIL = "instructor.english.g9@gyanavriksha.edu.np"
INSTRUCTOR_ENG_G9_NAME = "Ms. Anisha Karki"
INSTRUCTOR_CS_G9_EMAIL = "instructor.cs.g9@gyanavriksha.edu.np"
INSTRUCTOR_CS_G9_NAME = "Mr. Suman Basnet"
INSTRUCTOR_MATH_G10_EMAIL = "instructor.math.g10@gyanavriksha.edu.np"
INSTRUCTOR_MATH_G10_NAME = "Dr. Ramesh Poudel"
INSTRUCTOR_CS_G10_EMAIL = "instructor.cs.g10@gyanavriksha.edu.np"
INSTRUCTOR_CS_G10_NAME = "Ms. Deepa Shrestha"


GRADES = [
    {"grade_name": "Grade 9", "grade_level": 9, "description": "Secondary Education - Grade 9"},
    {"grade_name": "Grade 10", "grade_level": 10, "description": "Secondary Education - Grade 10"},
]

SUBJECTS = [
    # Grade 9 — Nepal SEE curriculum core subjects
    {
        "subject_name": "Mathematics",
        "subject_code": "MATH-09",
        "chroma_namespace": "math_g9",
        "description": "Algebra, geometry, statistics, and mensuration.",
        "grade_level": 9,
    },
    {
        "subject_name": "Science",
        "subject_code": "SCI-09",
        "chroma_namespace": "sci_g9",
        "description": "Integrated science: physics, chemistry, and biology.",
        "grade_level": 9,
    },
    {
        "subject_name": "English",
        "subject_code": "ENG-09",
        "chroma_namespace": "eng_g9",
        "description": "Reading comprehension, grammar, writing, and literature.",
        "grade_level": 9,
    },
    {
        "subject_name": "Computer Science",
        "subject_code": "CS-09",
        "chroma_namespace": "cs_g9",
        "description": "Digital literacy, programming basics, and office applications.",
        "grade_level": 9,
    },
    # Grade 10 — Nepal SEE curriculum core subjects
    {
        "subject_name": "Mathematics",
        "subject_code": "MATH-10",
        "chroma_namespace": "math_g10",
        "description": "Advanced algebra, coordinate geometry, and trigonometry basics.",
        "grade_level": 10,
    },
    {
        "subject_name": "Science",
        "subject_code": "SCI-10",
        "chroma_namespace": "sci_g10",
        "description": "Physics, chemistry, and biology with practical applications.",
        "grade_level": 10,
    },
    {
        "subject_name": "English",
        "subject_code": "ENG-10",
        "chroma_namespace": "eng_g10",
        "description": "Advanced comprehension, essay writing, and language skills.",
        "grade_level": 10,
    },
    {
        "subject_name": "Computer Science",
        "subject_code": "CS-10",
        "chroma_namespace": "cs_g10",
        "description": "Programming fundamentals, web basics, and data handling.",
        "grade_level": 10,
    },
]


IOT_DEVICES = [
    {
        "node_id": "ESP-WROOM-32",
        "device_type": "ESP32",
        "location": "Room 402",
        "status": "online",
        "device_mac": "AA:BB:CC:DD:EE:01",
        "mqtt_topic_prefix": "gyanavriksha/node/esp-wroom-32",
        "firmware_version": "2.1.0",
        "description": "Main classroom sensor node for Room 402.",
        "_api_seed": "demo_esp_wroom_32",
        "_last_seen_offset": -2,
    },
    {
        "node_id": "DHT-NODE-01",
        "device_type": "Arduino MKR",
        "location": "Main Library",
        "status": "online",
        "device_mac": "AA:BB:CC:DD:EE:02",
        "mqtt_topic_prefix": "gyanavriksha/node/dht-node-01",
        "firmware_version": "1.8.3",
        "description": "Temperature and humidity monitoring in the library.",
        "_api_seed": "demo_dht_node_01",
        "_last_seen_offset": -14,
    },
    {
        "node_id": "GATEWAY-ALPHA",
        "device_type": "Raspberry Pi 4",
        "location": "Server Room",
        "status": "offline",
        "device_mac": "AA:BB:CC:DD:EE:03",
        "mqtt_topic_prefix": "gyanavriksha/node/gateway-alpha",
        "firmware_version": "3.0.1",
        "description": "Primary MQTT gateway and edge processing unit.",
        "_api_seed": "demo_gateway_alpha",
        "_last_seen_offset": -2 * 24 * 60,
    },
    {
        "node_id": "CAM-NODE-402",
        "device_type": "ESP32-CAM",
        "location": "Lab 2",
        "status": "online",
        "device_mac": "AA:BB:CC:DD:EE:04",
        "mqtt_topic_prefix": "gyanavriksha/node/cam-node-402",
        "firmware_version": "1.2.0",
        "description": "Visual presence monitoring camera node for Lab 2.",
        "_api_seed": "demo_cam_node_402",
        "_last_seen_offset": 0,
    },
]


DEFAULT_SETTINGS = {
    "ocr_engine": "Tesseract 5.0 Optimized",
    "rag_chunk_size": "512",
    "maintenance_mode": "false",
    "google_vision_key": "",
    "gemini_key": "",
    "mqtt_server": "mqtt.gyanavriksha.edu.np",
    "mqtt_credentials": "",
}


def _get_or_create_grade(db: Session, grade_data: dict) -> Grade:
    existing = db.query(Grade).filter(Grade.grade_name == grade_data["grade_name"]).first()
    if existing:
        return existing
    grade = Grade(**grade_data)
    db.add(grade)
    db.flush()
    print(f"  [+] Grade: {grade.grade_name}")
    return grade


def _get_or_create_user(db: Session, email: str, password: str, name: str, role: UserRole) -> User:
    existing = db.query(User).filter(User.email == email).first()
    if existing:
        return existing
    user = User(
        email=email,
        password_hash=hash_password(password),
        full_name=name,
        role=role,
        is_active=True,
        is_email_verified=True,
    )
    db.add(user)
    db.flush()
    print(f"  [+] User: {email} ({role.value})")
    return user


def _subject_by_code(subject_records: list, code: str) -> Subject:
    for s in subject_records:
        if s.subject_code == code:
            return s
    raise KeyError(f"Unknown subject_code: {code}")


def _link_instructor_subject(db: Session, assigned_by_id: uuid.UUID, instructor: User, subject: Subject) -> None:
    existing = (
        db.query(InstructorSubject)
        .filter(
            InstructorSubject.instructor_id == instructor.user_id,
            InstructorSubject.subject_id == subject.subject_id,
        )
        .first()
    )
    if existing:
        return
    db.add(
        InstructorSubject(
            instructor_id=instructor.user_id,
            subject_id=subject.subject_id,
            assigned_by=assigned_by_id,
        )
    )
    db.flush()
    print(f"  [+] Assigned {instructor.full_name} to {subject.subject_name} ({subject.subject_code})")


def _enroll_student(db: Session, student: User, subject: Subject) -> None:
    existing = (
        db.query(StudentEnrollment)
        .filter(
            StudentEnrollment.student_id == student.user_id,
            StudentEnrollment.subject_id == subject.subject_id,
        )
        .first()
    )
    if existing:
        return
    db.add(
        StudentEnrollment(
            student_id=student.user_id,
            grade_id=subject.grade_id,
            subject_id=subject.subject_id,
        )
    )
    db.flush()
    print(f"  [+] Enrolled {student.full_name} in {subject.subject_name} ({subject.subject_code})")


def _upsert_assignment(db: Session, subject: Subject, instructor_user: User, a_data: dict) -> None:
    """Create or refresh a demo assignment keyed by title + subject."""
    existing = (
        db.query(Assignment)
        .filter(
            Assignment.title == a_data["title"],
            Assignment.subject_id == subject.subject_id,
        )
        .first()
    )
    if existing:
        existing.description = a_data["description"]
        existing.topic_tags = a_data["topic_tags"]
        existing.is_exam_mode = a_data["is_exam_mode"]
        existing.due_date = a_data["due_date"]
        existing.exam_duration_minutes = a_data.get("exam_duration_minutes")
        existing.exam_max_pauses = a_data.get("exam_max_pauses")
        existing.exam_strict_proctor = a_data.get("exam_strict_proctor", False)
        existing.is_published = a_data.get("is_published", True)
        existing.instructor_id = instructor_user.user_id
        return
    db.add(
        Assignment(
            subject_id=subject.subject_id,
            instructor_id=instructor_user.user_id,
            **a_data,
        )
    )
    db.flush()
    print(f"  [+] Assignment: {a_data['title']} ({subject.subject_code})")


def _seed_subjects(db: Session, grade_map: dict) -> list:
    records = []
    for s in SUBJECTS:
        grade_level = s["grade_level"]
        grade = grade_map[grade_level]
        existing = db.query(Subject).filter(Subject.subject_code == s["subject_code"]).first()
        if existing:
            records.append(existing)
            continue
        subject = Subject(
            grade_id=grade.grade_id,
            subject_name=s["subject_name"],
            subject_code=s["subject_code"],
            chroma_namespace=s["chroma_namespace"],
            description=s["description"],
        )
        db.add(subject)
        db.flush()
        records.append(subject)
        print(f"  [+] Subject: {subject.subject_name} ({subject.subject_code})")
    return records


def _seed_iot_devices(db: Session, admin: User) -> None:
    now = datetime.now(timezone.utc)
    for d in IOT_DEVICES:
        existing = db.query(IotDevice).filter(IotDevice.node_id == d["node_id"]).first()
        if existing:
            continue
        api_key_hash = hashlib.sha256(d["_api_seed"].encode()).hexdigest()
        offset_minutes = d["_last_seen_offset"]
        last_seen = now + timedelta(minutes=offset_minutes) if offset_minutes != 0 else now
        device = IotDevice(
            node_id=d["node_id"],
            device_type=d["device_type"],
            location=d["location"],
            status=d["status"],
            device_mac=d["device_mac"],
            mqtt_topic_prefix=d["mqtt_topic_prefix"],
            firmware_version=d["firmware_version"],
            description=d["description"],
            api_key_hash=api_key_hash,
            registered_by=admin.user_id,
            last_seen_at=last_seen if d["status"] != "offline" else now - timedelta(days=2),
            is_active=d["status"] != "offline",
        )
        db.add(device)
        db.flush()
        print(f"  [+] IoT Device: {d['node_id']} ({d['status']})")


def _seed_audit_logs(db: Session, admin: User) -> None:
    now = datetime.now(timezone.utc)
    existing_count = db.query(AuditLog).count()
    if existing_count >= 10:
        print("  [~] Audit logs already seeded, skipping")
        return

    entries = [
        {
            "action": "USER_CREATED",
            "resource_type": "user",
            "extra_metadata": {"description": "Created instructor account for Dr. Priya Acharya", "email": DEMO_INSTRUCTOR_EMAIL},
            "offset_hours": -72,
        },
        {
            "action": "USER_CREATED",
            "resource_type": "user",
            "extra_metadata": {"description": "Created student account for Rohan Sharma", "email": DEMO_STUDENT_EMAIL},
            "offset_hours": -68,
        },
        {
            "action": "GRADE_CREATED",
            "resource_type": "grade",
            "extra_metadata": {"description": "Created Grade 11 — Higher Secondary"},
            "offset_hours": -60,
        },
        {
            "action": "SUBJECT_CREATED",
            "resource_type": "subject",
            "extra_metadata": {"description": "Created subject: Mathematics - Calculus (MATH301)"},
            "offset_hours": -55,
        },
        {
            "action": "ENROLLMENT_CREATED",
            "resource_type": "enrollment",
            "extra_metadata": {"description": "Enrolled Rohan Sharma in Mathematics - Calculus"},
            "offset_hours": -48,
        },
        {
            "action": "CURRICULUM_UPLOADED",
            "resource_type": "curriculum_document",
            "extra_metadata": {"description": "Uploaded MATHEMATICS GRADE 10.pdf to Grade 10 / Trigonometry"},
            "offset_hours": -48,
        },
        {
            "action": "CURRICULUM_UPLOADED",
            "resource_type": "curriculum_document",
            "extra_metadata": {"description": "Uploaded ENGLISH GRADE 9.pdf to Grade 9 / English - Writing"},
            "offset_hours": -36,
        },
        {
            "action": "CURRICULUM_UPLOADED",
            "resource_type": "curriculum_document",
            "extra_metadata": {"description": "Uploaded Computer Science Grade 10.pdf to Grade 10 / CS Programming"},
            "offset_hours": -24,
        },
        {
            "action": "CURRICULUM_UPLOADED",
            "resource_type": "curriculum_document",
            "extra_metadata": {"description": "Uploaded COMPUTER SCIENCE GRADE 9.pdf to Grade 9 / CS Basics — currently embedding"},
            "offset_hours": -6,
        },
        {
            "action": "CURRICULUM_UPLOADED",
            "resource_type": "curriculum_document",
            "extra_metadata": {"description": "Uploaded Science Grade 10.pdf to Grade 10 / Physics Mechanics — queued for embedding"},
            "offset_hours": -1,
        },
        {
            "action": "IOT_DEVICE_REGISTERED",
            "resource_type": "iot_device",
            "extra_metadata": {"description": "Registered device ESP-WROOM-32 for Room 402"},
            "offset_hours": -20,
        },
        {
            "action": "BRUTE_FORCE_ATTEMPT",
            "resource_type": "auth",
            "extra_metadata": {
                "description": "Brute-force login attempt detected",
                "ip": "192.168.1.105",
                "location": "Kathmandu, NP",
                "attempts": 12,
                "severity": "warning",
            },
            "offset_hours": -2,
        },
        {
            "action": "UNUSUAL_IOT_VOLUME",
            "resource_type": "iot_device",
            "extra_metadata": {
                "description": "Unusual IoT packet volume detected",
                "sensor": "Node-R4-Gate",
                "packets_per_min": 4200,
                "severity": "info",
            },
            "offset_hours": -1,
        },
        {
            "action": "API_KEY_ROTATION",
            "resource_type": "iot_device",
            "extra_metadata": {"description": "API key rotated for device GATEWAY-ALPHA", "severity": "critical"},
            "offset_hours": -0,
        },
        {
            "action": "INTEGRITY_AUDIT_RUN",
            "resource_type": "system",
            "extra_metadata": {"description": "Curriculum integrity audit completed", "status": "Valid & Synchronized"},
            "offset_hours": -5,
        },
        {
            "action": "SETTINGS_UPDATED",
            "resource_type": "system",
            "extra_metadata": {"description": "OCR engine updated to Tesseract 5.0 Optimized"},
            "offset_hours": -10,
        },
        {
            "action": "PASSWORD_RESET",
            "resource_type": "user",
            "extra_metadata": {"description": "Admin-initiated password reset for student@gyanavriksha.edu.np"},
            "offset_hours": -15,
        },
        {
            "action": "BACKUP_INTEGRITY_CHECK",
            "resource_type": "system",
            "extra_metadata": {"description": "System backup integrity check — Result: Success (Hash verified)", "severity": "success"},
            "offset_hours": -6,
        },
    ]

    for e in entries:
        entry = AuditLog(
            actor_id=admin.user_id,
            actor_role=ActorRole.ADMIN,
            action=e["action"],
            resource_type=e.get("resource_type"),
            extra_metadata=e.get("extra_metadata"),
            created_at=now + timedelta(hours=e["offset_hours"]),
        )
        db.add(entry)
    db.flush()
    print(f"  [+] Audit logs: {len(entries)} entries seeded")


def _seed_ingestion_jobs(db: Session, admin: User, subject_records: list) -> None:
    """Seed real curriculum PDF documents that exist in backend/uploads/curriculum/."""
    now = datetime.now(timezone.utc)
    if not subject_records:
        return

    # Build a subject_code → Subject lookup for reliable mapping
    subject_by_code = {s.subject_code: s for s in subject_records}

    jobs = [
        {
            "file_name": "MATHEMATICS GRADE 10.pdf",
            "file_path": "uploads/curriculum/MATHEMATICS GRADE 10.pdf",
            "file_size_bytes": 4_394_535,
            "doc_type": DocumentType.CURRICULUM_PDF,
            "embedding_status": EmbeddingStatus.PENDING,
            "subject_code": "MATH-10",
            "offset_hours": -48,
        },
        {
            "file_name": "ENGLISH GRADE 9.pdf",
            "file_path": "uploads/curriculum/ENGLISH GRADE 9.pdf",
            "file_size_bytes": 10_354_864,
            "doc_type": DocumentType.CURRICULUM_PDF,
            "embedding_status": EmbeddingStatus.PENDING,
            "subject_code": "ENG-09",
            "offset_hours": -36,
        },
        {
            "file_name": "Computer Science  Grade 10.pdf",
            "file_path": "uploads/curriculum/Computer Science  Grade 10.pdf",
            "file_size_bytes": 3_940_607,
            "doc_type": DocumentType.CURRICULUM_PDF,
            "embedding_status": EmbeddingStatus.PENDING,
            "subject_code": "CS-10",
            "offset_hours": -24,
        },
        {
            "file_name": "COMPUTER SCIENCE GRADE 9.pdf",
            "file_path": "uploads/curriculum/COMPUTER SCIENCE GRADE 9.pdf",
            "file_size_bytes": 5_043_480,
            "doc_type": DocumentType.CURRICULUM_PDF,
            "embedding_status": EmbeddingStatus.PENDING,
            "subject_code": "CS-09",
            "offset_hours": -6,
        },
    ]

    for j in jobs:
        code = j["subject_code"]
        subj = subject_by_code.get(code)
        if not subj:
            print(f"  [!] Subject '{code}' not found — skipping {j['file_name']}")
            continue
        existing = (
            db.query(CurriculumDocument)
            .filter(CurriculumDocument.file_name == j["file_name"])
            .first()
        )
        if existing:
            continue
        embedded_at = (
            now + timedelta(hours=j["embedded_at_offset"]) if "embedded_at_offset" in j else None
        )
        doc = CurriculumDocument(
            subject_id=subj.subject_id,
            uploaded_by=admin.user_id,
            file_name=j["file_name"],
            file_path=j["file_path"],
            file_size_bytes=j["file_size_bytes"],
            doc_type=j["doc_type"],
            embedding_status=j["embedding_status"],
            embedded_at=embedded_at,
            created_at=now + timedelta(hours=j["offset_hours"]),
        )
        db.add(doc)
        db.flush()
        print(f"  [+] Ingestion job: {j['file_name']} ({j['embedding_status'].value})")


def _seed_system_settings(db: Session) -> None:
    for key, value in DEFAULT_SETTINGS.items():
        existing = db.query(SystemSetting).filter(SystemSetting.key == key).first()
        if existing:
            continue
        db.add(SystemSetting(key=key, value=value))
        db.flush()
        print(f"  [+] Setting: {key} = {value!r}")


def seed_demo_data(db: Session) -> None:
    print("[SEED] Starting demo data seed...")

    # 1. Grades
    print("[SEED] Creating grades...")
    grade_map = {}
    for g in GRADES:
        grade = _get_or_create_grade(db, g)
        grade_map[grade.grade_level] = grade

    # 2. Subjects
    print("[SEED] Creating subjects...")
    subject_records = _seed_subjects(db, grade_map)

    # 3. Demo users (admin first so instructor-subject rows can use assigned_by=admin)
    print("[SEED] Creating demo users...")
    grade9 = grade_map.get(9)
    if not grade9:
        raise RuntimeError("Grade 9 must exist in GRADES")

    admin = _get_or_create_user(
        db, DEMO_ADMIN_EMAIL, DEMO_ADMIN_PASSWORD, DEMO_ADMIN_NAME, UserRole.ADMIN
    )
    student = _get_or_create_user(
        db, DEMO_STUDENT_EMAIL, DEMO_STUDENT_PASSWORD, DEMO_STUDENT_NAME, UserRole.STUDENT
    )
    if student.grade_id != grade9.grade_id:
        student.grade_id = grade9.grade_id
        db.flush()

    instructor = _get_or_create_user(
        db, DEMO_INSTRUCTOR_EMAIL, DEMO_INSTRUCTOR_PASSWORD, DEMO_INSTRUCTOR_NAME, UserRole.INSTRUCTOR
    )
    instructor_eng_g9 = _get_or_create_user(
        db, INSTRUCTOR_ENG_G9_EMAIL, SPEC_INSTRUCTOR_PASSWORD, INSTRUCTOR_ENG_G9_NAME, UserRole.INSTRUCTOR
    )
    instructor_cs_g9 = _get_or_create_user(
        db, INSTRUCTOR_CS_G9_EMAIL, SPEC_INSTRUCTOR_PASSWORD, INSTRUCTOR_CS_G9_NAME, UserRole.INSTRUCTOR
    )
    instructor_math_g10 = _get_or_create_user(
        db, INSTRUCTOR_MATH_G10_EMAIL, SPEC_INSTRUCTOR_PASSWORD, INSTRUCTOR_MATH_G10_NAME, UserRole.INSTRUCTOR
    )
    instructor_cs_g10 = _get_or_create_user(
        db, INSTRUCTOR_CS_G10_EMAIL, SPEC_INSTRUCTOR_PASSWORD, INSTRUCTOR_CS_G10_NAME, UserRole.INSTRUCTOR
    )

    g9_cohort = []
    for email, name in G9_COHORT_STUDENTS:
        u = _get_or_create_user(db, email, DEMO_STUDENT_PASSWORD, name, UserRole.STUDENT)
        if u.grade_id != grade9.grade_id:
            u.grade_id = grade9.grade_id
            db.flush()
        g9_cohort.append(u)

    # 4. Instructor ↔ subject (explicit: G9 English/CS, G10 Math/CS; main instructor on G9 Math/Science)
    print("[SEED] Assigning instructors to subjects...")
    eng_g9 = _subject_by_code(subject_records, "ENG-09")
    cs_g9 = _subject_by_code(subject_records, "CS-09")
    math_g10 = _subject_by_code(subject_records, "MATH-10")
    cs_g10 = _subject_by_code(subject_records, "CS-10")
    math_g9 = _subject_by_code(subject_records, "MATH-09")
    sci_g9 = _subject_by_code(subject_records, "SCI-09")

    for subj in (math_g9, sci_g9):
        _link_instructor_subject(db, admin.user_id, instructor, subj)
    _link_instructor_subject(db, admin.user_id, instructor_eng_g9, eng_g9)
    _link_instructor_subject(db, admin.user_id, instructor_cs_g9, cs_g9)
    _link_instructor_subject(db, admin.user_id, instructor_math_g10, math_g10)
    _link_instructor_subject(db, admin.user_id, instructor_cs_g10, cs_g10)

    # 5. Enrollments: flagship student in core G9 subjects; five cohort students in English + CS G9
    print("[SEED] Creating enrollments...")
    for subj in (math_g9, sci_g9, eng_g9, cs_g9):
        _enroll_student(db, student, subj)
    for cohort_student in g9_cohort:
        _enroll_student(db, cohort_student, eng_g9)
        _enroll_student(db, cohort_student, cs_g9)

    # 6. Sample assignments
    print("[SEED] Creating sample assignments...")
    now = datetime.now(timezone.utc)
    sample_assignments = [
        {
            "title": "Algebra: Linear Equations Practice",
            "description": (
                "**Instructions:** Show all working. Total marks as indicated.\n"
                "**Q1 (4 marks)** Solve for x: 3x - 7 = 14\n"
                "**Q2 (4 marks)** Solve for y: 2(y + 5) = 3y - 1\n"
                "**Q3 (6 marks)** A rectangle has length (2x + 1) cm and width (x - 2) cm. "
                "If its perimeter is 34 cm, find x and the area."
            ),
            "topic_tags": ["algebra", "linear-equations", "inequalities"],
            "is_exam_mode": False,
            "exam_duration_minutes": None,
            "exam_max_pauses": None,
            "exam_strict_proctor": False,
            "is_published": True,
            "due_date": now + timedelta(days=7),
        },
        {
            "title": "Geometry: Angles, Lines, and Triangles",
            "description": (
                "**Instructions:** Diagrams may be sketched freehand if neat.\n"
                "**Q1 (5 marks)** In a pair of parallel lines cut by a transversal, one angle is 72 degrees. "
                "Find all other angles at that intersection, with reasons.\n"
                "**Q2 (5 marks)** Prove that the base angles of an isosceles triangle are equal (short proof).\n"
                "**Q3 (5 marks)** Explain why the angle sum of a triangle is 180 degrees."
            ),
            "topic_tags": ["geometry", "angles", "triangles"],
            "is_exam_mode": False,
            "exam_duration_minutes": None,
            "exam_max_pauses": None,
            "exam_strict_proctor": False,
            "is_published": True,
            "due_date": now + timedelta(days=14),
        },
        {
            "title": "Mid-Term Exam: Mathematics",
            "description": (
                "**Exam rules:** Closed book. All questions compulsory. Use LaTeX-style math where shown.\n"
                "**Section A — Short answer (15 marks)**\n"
                "**A1 (3 marks)** Factorise: $x^2 - 5x + 6$\n"
                "**A2 (3 marks)** Simplify: (2a^3 b) / (4ab^2)\n"
                "**A3 (4 marks)** Solve the system: x + y = 5, 2x - y = 4\n"
                "**A4 (5 marks)** State and use the Pythagorean theorem to find the hypotenuse when legs are 6 cm and 8 cm.\n"
                "**Section B — Long answer (15 marks)**\n"
                "**B1 (15 marks)** A ladder 13 m long rests against a vertical wall. "
                "The foot of the ladder is 5 m from the wall. How high up the wall does the ladder reach? "
                "Show working and comment on whether the ladder angle is safe (above 70 degrees from ground is steep)."
            ),
            "topic_tags": ["algebra", "geometry", "exam"],
            "is_exam_mode": True,
            "exam_duration_minutes": 60,
            "exam_max_pauses": 2,
            "exam_strict_proctor": False,
            "is_published": True,
            "due_date": now + timedelta(days=21),
        },
    ]
    math_subject = next(
        (s for s in subject_records if s.subject_code == "MATH-09"), subject_records[0]
    )
    for a_data in sample_assignments:
        _upsert_assignment(db, math_subject, instructor, a_data)

    english_cs_assignments = [
        (
            eng_g9,
            instructor_eng_g9,
            {
                "title": "English G9 — Creative writing: personal narrative",
                "description": (
                    "**Task:** Write a 250–300 word personal narrative on one of: "
                    "a challenge you overcame, a moment of kindness, or a goal you are working toward.\n"
                    "**Criteria:** Clear beginning/middle/end, varied sentences, and proofread spelling."
                ),
                "topic_tags": ["writing", "narrative", "grade-9"],
                "is_exam_mode": False,
                "exam_duration_minutes": None,
                "exam_max_pauses": None,
                "exam_strict_proctor": False,
                "is_published": True,
                "due_date": now + timedelta(days=10),
            },
        ),
        (
            eng_g9,
            instructor_eng_g9,
            {
                "title": "English G9 — Reading & comprehension exam",
                "description": (
                    "**Exam:** Answer all parts in your own words. Closed book.\n"
                    "**Section A** Short responses on the unseen passage (teacher will distribute passage in class).\n"
                    "**Section B** One paragraph: main idea and two supporting details."
                ),
                "topic_tags": ["reading", "exam", "grade-9"],
                "is_exam_mode": True,
                "exam_duration_minutes": 45,
                "exam_max_pauses": 1,
                "exam_strict_proctor": False,
                "is_published": True,
                "due_date": now + timedelta(days=18),
            },
        ),
        (
            cs_g9,
            instructor_cs_g9,
            {
                "title": "Computer Science G9 — Algorithms & flowcharts",
                "description": (
                    "**Q1** Draw a flowchart to input two numbers and print the larger one.\n"
                    "**Q2** Trace this pseudocode with inputs $n=4$: sum $\\leftarrow 0$; for $i$ from 1 to $n$: sum $\\leftarrow$ sum + $i$; print sum.\n"
                    "**Q3** In one sentence, state the difference between an algorithm and a program."
                ),
                "topic_tags": ["algorithms", "flowcharts", "pseudocode"],
                "is_exam_mode": False,
                "exam_duration_minutes": None,
                "exam_max_pauses": None,
                "exam_strict_proctor": False,
                "is_published": True,
                "due_date": now + timedelta(days=9),
            },
        ),
        (
            cs_g9,
            instructor_cs_g9,
            {
                "title": "Computer Science G9 — Practical exam (Python & logic)",
                "description": (
                    "**Exam rules:** Individual work. You may use rough work on paper; submit clear photos or one PDF.\n"
                    "**Q1 (5 marks)** Write Python code that reads an integer and prints whether it is even or odd.\n"
                    "**Q2 (5 marks)** Explain in 3–4 lines what a loop is and give one example use in daily software.\n"
                    "**Q3 (5 marks)** List two ways to keep passwords safer when using school computers."
                ),
                "topic_tags": ["python", "exam", "digital-literacy"],
                "is_exam_mode": True,
                "exam_duration_minutes": 40,
                "exam_max_pauses": 2,
                "exam_strict_proctor": False,
                "is_published": True,
                "due_date": now + timedelta(days=16),
            },
        ),
    ]
    for subj, inst, a_data in english_cs_assignments:
        _upsert_assignment(db, subj, inst, a_data)

    # 7. IoT devices
    print("[SEED] Creating IoT devices...")
    _seed_iot_devices(db, admin)

    # 8. Audit logs
    print("[SEED] Creating audit logs...")
    _seed_audit_logs(db, admin)

    # 9. Ingestion jobs (curriculum documents)
    print("[SEED] Creating ingestion jobs...")
    _seed_ingestion_jobs(db, admin, subject_records)

    # 10. System settings
    print("[SEED] Creating system settings...")
    _seed_system_settings(db)

    db.commit()

    print()
    print("[SEED] Demo data seeded successfully!")
    print()
    print("  Demo Credentials:")
    print(f"  Student (G9, multi-subject): {DEMO_STUDENT_EMAIL} / {DEMO_STUDENT_PASSWORD}")
    print(f"  G9 cohort (ENG + CS only):  g9student01..05@gyanavriksha.edu.np / {DEMO_STUDENT_PASSWORD}")
    print(f"  Instructor (G9 Math/Sci):   {DEMO_INSTRUCTOR_EMAIL} / {DEMO_INSTRUCTOR_PASSWORD}")
    print(f"  Instructor (G9 English):      {INSTRUCTOR_ENG_G9_EMAIL} / {SPEC_INSTRUCTOR_PASSWORD}")
    print(f"  Instructor (G9 CS):         {INSTRUCTOR_CS_G9_EMAIL} / {SPEC_INSTRUCTOR_PASSWORD}")
    print(f"  Instructor (G10 Math):      {INSTRUCTOR_MATH_G10_EMAIL} / {SPEC_INSTRUCTOR_PASSWORD}")
    print(f"  Instructor (G10 CS):        {INSTRUCTOR_CS_G10_EMAIL} / {SPEC_INSTRUCTOR_PASSWORD}")
    print(f"  Admin:                      {DEMO_ADMIN_EMAIL} / {DEMO_ADMIN_PASSWORD}")
    print()
    print("  Grades seeded:")
    for g in GRADES:
        print(f"    - {g['grade_name']}")
    print()
    print("  IoT Devices seeded:")
    for d in IOT_DEVICES:
        print(f"    - {d['node_id']} ({d['status']})")
    print()
    print("  Curriculum documents seeded (all PENDING — run index_curriculum_docs next):")
    print("    - MATHEMATICS GRADE 10.pdf          -> Mathematics G10")
    print("    - ENGLISH GRADE 9.pdf               -> English G9")
    print("    - Computer Science  Grade 10.pdf    -> Computer Science G10")
    print("    - COMPUTER SCIENCE GRADE 9.pdf      -> Computer Science G9")
    print()
    print("  Next step — index into ChromaDB (ai-service must be running on port 8001):")
    print("    uv run python -m app.scripts.index_curriculum_docs")
    print()


if __name__ == "__main__":
    db = SessionLocal()
    try:
        seed_demo_data(db)
    finally:
        db.close()
