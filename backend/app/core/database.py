from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.core.config import settings


# Synchronous engine + session for now.
# This is what Alembic and any sync services will use.
engine = create_engine(settings.SYNC_DATABASE_URL, future=True)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine, future=True)


def get_db():
    """
    FastAPI dependency to provide a scoped database session.
    """
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

