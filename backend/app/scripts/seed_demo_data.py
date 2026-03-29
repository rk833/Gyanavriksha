"""
Seed script — creates demo grades, subjects, users, and enrollments for testing.
Run: uv run python -m app.scripts.seed_demo_data

This script is idempotent: running it again will skip existing records.
"""
from datetime import datetime, timedelta, timezone

from sqlalchemy.orm import Session

from app.core.database import SessionLocal
from app.core.security import hash_password
from app.db.models.assignment import Assignment
from app.db.models.grade import Grade
from app.db.models.student_enrollment import StudentEnrollment
from app.db.models.subject import Subject
from app.db.models.user import User
from app.shared.source_enum import UserRole


# Demo credentials
DEMO_STUDENT_EMAIL = "student@gyanavriksha.edu.np"
DEMO_STUDENT_PASSWORD = "Student@1234"
DEMO_STUDENT_NAME = "Rohan Sharma"

DEMO_INSTRUCTOR_EMAIL = "instructor@gyanavriksha.edu.np"
DEMO_INSTRUCTOR_PASSWORD = "Instructor@1234"
DEMO_INSTRUCTOR_NAME = "Dr. Priya Acharya"


GRADES = [
    {"grade_name": "Grade 10", "grade_level": 10, "description": "Secondary Education - Grade 10"},
    {"grade_name": "Grade 11", "grade_level": 11, "description": "Higher Secondary - Grade 11"},
    {"grade_name": "Grade 12", "grade_level": 12, "description": "Higher Secondary - Grade 12"},
]

SUBJECTS = [
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
        "subject_name": "Trigonometry",
        "subject_code": "MATH201",
        "chroma_namespace": "math_trigonometry",
        "description": "Trigonometric functions, identities, and applications.",
        "grade_level": 10,
    },
    {
        "subject_name": "Chemistry - Organic",
        "subject_code": "CHEM301",
        "chroma_namespace": "chem_organic",
        "description": "Study of carbon compounds and organic reactions.",
        "grade_level": 12,
    },
]


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
    subject_records = []
    for s in SUBJECTS:
        grade_level = s.pop("grade_level")
        grade = grade_map[grade_level]
        existing = db.query(Subject).filter(Subject.subject_code == s["subject_code"]).first()
        if existing:
            subject_records.append(existing)
            s["grade_level"] = grade_level
            continue
        subject = Subject(grade_id=grade.grade_id, **s)
        db.add(subject)
        db.flush()
        subject_records.append(subject)
        print(f"  [+] Subject: {subject.subject_name} ({subject.subject_code})")
        s["grade_level"] = grade_level

    # 3. Demo users
    print("[SEED] Creating demo users...")
    student = _get_or_create_user(
        db, DEMO_STUDENT_EMAIL, DEMO_STUDENT_PASSWORD, DEMO_STUDENT_NAME, UserRole.STUDENT
    )
    instructor = _get_or_create_user(
        db, DEMO_INSTRUCTOR_EMAIL, DEMO_INSTRUCTOR_PASSWORD, DEMO_INSTRUCTOR_NAME, UserRole.INSTRUCTOR
    )

    # 4. Enroll student in first 3 subjects
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
        enrollment = StudentEnrollment(
            student_id=student.user_id,
            grade_id=grade.grade_id,
            subject_id=subject.subject_id,
        )
        db.add(enrollment)
        db.flush()
        print(f"  [+] Enrolled {DEMO_STUDENT_NAME} in {subject.subject_name}")

    # 5. Create sample assignments
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

    math_subject = subject_records[0]
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
        assignment = Assignment(
            subject_id=math_subject.subject_id,
            instructor_id=instructor.user_id,
            **a_data,
        )
        db.add(assignment)
        db.flush()
        print(f"  [+] Assignment: {assignment.title}")

    db.commit()

    print()
    print("[SEED] Demo data seeded successfully!")
    print()
    print("  Demo Credentials:")
    print(f"  Student:    {DEMO_STUDENT_EMAIL} / {DEMO_STUDENT_PASSWORD}")
    print(f"  Instructor: {DEMO_INSTRUCTOR_EMAIL} / {DEMO_INSTRUCTOR_PASSWORD}")
    print(f"  Admin:      admin@gyanavriksha.edu.np / Admin@1234")
    print()
    print("  Enrolled subjects for student:")
    for s in subject_records[:3]:
        print(f"    - {s.subject_name} ({s.subject_code})")
    print()


if __name__ == "__main__":
    db = SessionLocal()
    try:
        seed_demo_data(db)
    finally:
        db.close()
