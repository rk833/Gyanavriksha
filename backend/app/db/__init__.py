from .base import Base

# Import models here so Alembic's autogenerate can discover them via Base.metadata.
from app.db.models import user  # noqa: F401
from app.db.models import auth  # noqa: F401


