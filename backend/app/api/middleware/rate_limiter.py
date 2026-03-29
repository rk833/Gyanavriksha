from slowapi import Limiter  # type: ignore
from slowapi.util import get_remote_address  # type: ignore

from app.core.config import settings

limiter = Limiter(
    key_func=get_remote_address,
    enabled=settings.ENVIRONMENT != "testing",
)
