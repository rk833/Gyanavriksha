"""
Seed script — creates demo grades, subjects, users, enrollments, IoT devices,
audit logs, ingestion jobs, system settings, and security events for testing.
Run: uv run python -m app.scripts.seed_demo_data

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


GRADES = [
    {"grade_name": "Grade 9", "grade_level": 9, "description": "Secondary Education - Grade 9"},
    {"grade_name": "Grade 10", "grade_level": 10, "description": "Secondary Education - Grade 10"},
    {"grade_name": "Grade 11", "grade_level": 11, "description": "Higher Secondary - Grade 11"},
    {"grade_name": "Grade 12", "grade_level": 12, "description": "Higher Secondary - Grade 12"},
]

SUBJECTS = [
    {
        "subject_name": "Mathematics - Algebra",
        "subject_code": "MATH901",
        "chroma_namespace": "math_algebra_g9",
        "description": "Foundations of algebra: equations, inequalities, and functions.",
        "grade_level": 9,
    },
    {
        "subject_name": "Science - Biology",
        "subject_code": "SCI901",
        "chroma_namespace": "sci_biology_g9",
        "description": "Cell biology, genetics, and the human body.",
        "grade_level": 9,
    },
    {
        "subject_name": "English - Writing",
        "subject_code": "ENG901",
        "chroma_namespace": "eng_writing_g9",
        "description": "Essay writing, grammar, and comprehension.",
        "grade_level": 9,
    },
    {
        "subject_name": "Computer Science - Basics",
        "subject_code": "CS901",
        "chroma_namespace": "cs_basics_g9",
        "description": "Introduction to programming, algorithms, and data structures.",
        "grade_level": 9,
    },
    {
        "subject_name": "Trigonometry",
        "subject_code": "MATH201",
        "chroma_namespace": "math_trigonometry",
        "description": "Trigonometric functions, identities, and applications.",
        "grade_level": 10,
    },
    {
        "subject_name": "Physics - Mechanics",
        "subject_code": "PHY201",
        "chroma_namespace": "phy_mechanics_g10",
        "description": "Newton's laws, motion, energy, and work.",
        "grade_level": 10,
    },
    {
        "subject_name": "English - Literature",
        "subject_code": "ENG201",
        "chroma_namespace": "eng_literature_g10",
        "description": "Classic and contemporary literature analysis.",
        "grade_level": 10,
    },
    {
        "subject_name": "Computer Science - Programming",
        "subject_code": "CS201",
        "chroma_namespace": "cs_programming_g10",
        "description": "Python programming fundamentals and problem solving.",
        "grade_level": 10,
    },
    {
        "subject_name": "Mathematics - Calculus",
        "subject_code": "MATH301",
        "chroma_namespace": "math_calculus",
        "description": "Mastering Derivatives and Integration through real-world physics applications.",
        "grade_level": 11,
    },
    {
        "subject_name": "Physics - Quantum Mechanics",
        "subject_code": "PHY401",
        "chroma_namespace": "phy_quantum",
        "description": "Introduction to quantum mechanics and wave-particle duality.",
        "grade_level": 11,
    },
    {
        "subject_name": "Linear Algebra",
        "subject_code": "MATH302",
        "chroma_namespace": "math_linear_algebra",
        "description": "Vectors, matrices, and linear transformations.",
        "grade_level": 11,
    },
    {
        "subject_name": "Computer Science - Data Structures",
        "subject_code": "CS301",
        "chroma_namespace": "cs_dsa_g11",
        "description": "Arrays, linked lists, trees, graphs, and sorting algorithms.",
        "grade_level": 11,
    },
    {
        "subject_name": "Chemistry - Organic",
        "subject_code": "CHEM301",
        "chroma_namespace": "chem_organic",
        "description": "Study of carbon compounds and organic reactions.",
        "grade_level": 12,
    },
    {
        "subject_name": "Mathematics - Statistics",
        "subject_code": "MATH401",
        "chroma_namespace": "math_statistics_g12",
        "description": "Probability, distributions, hypothesis testing.",
        "grade_level": 12,
    },
    {
        "subject_name": "Physics - Electromagnetism",
        "subject_code": "PHY402",
        "chroma_namespace": "phy_electromagnetism_g12",
        "description": "Electric fields, magnetic forces, and Maxwell's equations.",
        "grade_level": 12,
    },
    {
        "subject_name": "Computer Science - Networks",
        "subject_code": "CS401",
        "chroma_namespace": "cs_networks_g12",
        "description": "OSI model, TCP/IP, routing, and network security basics.",
        "grade_level": 12,
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
            "extra_metadata": {"description": "Uploaded Math_Unit_4.pdf to Grade 9 / Mathematics"},
            "offset_hours": -24,
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
    now = datetime.now(timezone.utc)
    if not subject_records:
        return

    jobs = [
        {
            "file_name": "Math_Unit_4.pdf",
            "file_path": "/uploads/curriculum/Math_Unit_4.pdf",
            "file_size_bytes": 2_400_000,
            "doc_type": DocumentType.CURRICULUM_PDF,
            "embedding_status": EmbeddingStatus.PROCESSING,
            "subject_index": 0,
            "offset_hours": -1,
        },
        {
            "file_name": "Physics_Ch12.pdf",
            "file_path": "/uploads/curriculum/Physics_Ch12.pdf",
            "file_size_bytes": 1_850_000,
            "doc_type": DocumentType.CURRICULUM_PDF,
            "embedding_status": EmbeddingStatus.DONE,
            "subject_index": 1,
            "offset_hours": -3,
            "embedded_at_offset": -2,
        },
        {
            "file_name": "Bio_Syllabus.docx",
            "file_path": "/uploads/curriculum/Bio_Syllabus.docx",
            "file_size_bytes": 540_000,
            "doc_type": DocumentType.CURRICULUM_PDF,
            "embedding_status": EmbeddingStatus.PENDING,
            "subject_index": min(2, len(subject_records) - 1),
            "offset_hours": -0,
        },
    ]

    for j in jobs:
        subj = subject_records[j["subject_index"]]
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

    # 3. Demo users
    print("[SEED] Creating demo users...")
    student = _get_or_create_user(
        db, DEMO_STUDENT_EMAIL, DEMO_STUDENT_PASSWORD, DEMO_STUDENT_NAME, UserRole.STUDENT
    )
    if student.grade_id is None and grade_map:
        student.grade_id = next(iter(grade_map.values())).grade_id
        db.flush()
    instructor = _get_or_create_user(
        db, DEMO_INSTRUCTOR_EMAIL, DEMO_INSTRUCTOR_PASSWORD, DEMO_INSTRUCTOR_NAME, UserRole.INSTRUCTOR
    )
    admin = _get_or_create_user(
        db, DEMO_ADMIN_EMAIL, DEMO_ADMIN_PASSWORD, DEMO_ADMIN_NAME, UserRole.ADMIN
    )

    # 4. Assign instructor to first 3 subjects
    print("[SEED] Assigning instructor to subjects...")
    for subject in subject_records[:3]:
        existing = (
            db.query(InstructorSubject)
            .filter(
                InstructorSubject.instructor_id == instructor.user_id,
                InstructorSubject.subject_id == subject.subject_id,
            )
            .first()
        )
        if existing:
            continue
        db.add(InstructorSubject(
            instructor_id=instructor.user_id,
            subject_id=subject.subject_id,
            assigned_by=instructor.user_id,
        ))
        db.flush()
        print(f"  [+] Assigned {DEMO_INSTRUCTOR_NAME} to {subject.subject_name}")

    # 5. Enroll student in first 3 subjects
    print("[SEED] Creating enrollments...")
    for subject in subject_records[:3]:
        existing = (
            db.query(StudentEnrollment)
            .filter(
                StudentEnrollment.student_id == student.user_id,
                StudentEnrollment.subject_id == subject.subject_id,
            )
            .first()
        )
        if existing:
            continue
        grade = db.query(Grade).filter(Grade.grade_id == subject.grade_id).first()
        db.add(StudentEnrollment(
            student_id=student.user_id,
            grade_id=grade.grade_id,
            subject_id=subject.subject_id,
        ))
        db.flush()
        print(f"  [+] Enrolled {DEMO_STUDENT_NAME} in {subject.subject_name}")

    # 6. Sample assignments
    print("[SEED] Creating sample assignments...")
    now = datetime.now(timezone.utc)
    sample_assignments = [
        {
            "title": "Derivatives Practice Set 1",
            "description": "Solve the following derivative problems using chain rule and product rule.",
            "topic_tags": ["derivatives", "chain-rule", "product-rule"],
            "is_exam_mode": False,
            "is_published": True,
            "due_date": now + timedelta(days=7),
        },
        {
            "title": "Integration Techniques",
            "description": "Apply substitution and integration by parts to solve these integrals.",
            "topic_tags": ["integration", "substitution", "by-parts"],
            "is_exam_mode": False,
            "is_published": True,
            "due_date": now + timedelta(days=14),
        },
        {
            "title": "Mid-Term Exam: Calculus",
            "description": "Comprehensive exam covering derivatives and basic integration.",
            "topic_tags": ["derivatives", "integration", "exam"],
            "is_exam_mode": True,
            "is_published": True,
            "due_date": now + timedelta(days=21),
        },
    ]
    math_subject = next(
        (s for s in subject_records if s.subject_code == "MATH301"), subject_records[0]
    )
    for a_data in sample_assignments:
        existing = (
            db.query(Assignment)
            .filter(
                Assignment.title == a_data["title"],
                Assignment.subject_id == math_subject.subject_id,
            )
            .first()
        )
        if existing:
            continue
        db.add(Assignment(
            subject_id=math_subject.subject_id,
            instructor_id=instructor.user_id,
            **a_data,
        ))
        db.flush()
        print(f"  [+] Assignment: {a_data['title']}")

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
    print(f"  Student:    {DEMO_STUDENT_EMAIL} / {DEMO_STUDENT_PASSWORD}")
    print(f"  Instructor: {DEMO_INSTRUCTOR_EMAIL} / {DEMO_INSTRUCTOR_PASSWORD}")
    print(f"  Admin:      {DEMO_ADMIN_EMAIL} / {DEMO_ADMIN_PASSWORD}")
    print()
    print("  Grades seeded:")
    for g in GRADES:
        print(f"    - {g['grade_name']}")
    print()
    print("  IoT Devices seeded:")
    for d in IOT_DEVICES:
        print(f"    - {d['node_id']} ({d['status']})")
    print()


if __name__ == "__main__":
    db = SessionLocal()
    try:
        seed_demo_data(db)
    finally:
        db.close()
