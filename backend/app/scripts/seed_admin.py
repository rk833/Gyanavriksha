"""
Seed script — creates the default admin account.
Run: uv run python -m app.scripts.seed_admin
"""
from sqlalchemy.orm import Session

from app.core.database import SessionLocal
from app.core.security import hash_password
from app.db.models.user import User
from app.shared.source_enum import UserRole

ADMIN_EMAIL = "admin@gyanavriksha.edu.np"
ADMIN_PASSWORD = "Admin@1234"
ADMIN_NAME = "System Administrator"


def seed_admin(db: Session) -> None:
    existing = db.query(User).filter(User.email == ADMIN_EMAIL).first()
    if existing:
        print(f"[SEED] Admin already exists: {ADMIN_EMAIL}")
        return

    admin = User(
        email=ADMIN_EMAIL,
        password_hash=hash_password(ADMIN_PASSWORD),
        full_name=ADMIN_NAME,
        role=UserRole.ADMIN,
        is_active=True,
        is_email_verified=True,
    )
    db.add(admin)
    db.commit()
    print(f"[SEED] Admin created: {ADMIN_EMAIL} / {ADMIN_PASSWORD}")
    print("[SEED] IMPORTANT: Change this password after first login!")


if __name__ == "__main__":
    db = SessionLocal()
    try:
        seed_admin(db)
    finally:
        db.close()
