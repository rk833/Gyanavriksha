from functools import lru_cache
from urllib.parse import quote_plus

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    # Core project settings
    PROJECT_NAME: str = "Gyanavriksha Backend API"
    ENVIRONMENT: str = "development"

    # Database settings
    POSTGRES_HOST: str = "localhost"
    POSTGRES_PORT: int = 5432
    POSTGRES_USER: str = "postgres"
    POSTGRES_PASSWORD: str = "postgres"
    POSTGRES_DB: str = "gyanavriksha"
    POSTGRES_LOG_LEVEL: str = "info"

    # JWT Authentication
    JWT_SECRET_KEY: str = "CHANGE-ME-IN-PRODUCTION"
    JWT_ALGORITHM: str = "HS256"
    JWT_ACCESS_TOKEN_EXPIRE_MINUTES: int = 30
    JWT_REFRESH_TOKEN_EXPIRE_DAYS: int = 7

    # Email / SMTP
    SMTP_HOST: str = "smtp.gmail.com"
    SMTP_PORT: int = 587
    SMTP_USER: str = ""
    SMTP_PASSWORD: str = ""
    SMTP_FROM_EMAIL: str = "noreply@gyanavriksha.com"

    # Contact form receiver
    CONTACT_RECEIVER_EMAIL: str = "aayushshah817@gmail.com"

    # Frontend URL (for email verification/reset links)
    FRONTEND_URL: str = "http://localhost:5173"

    # AI Microservice
    AI_SERVICE_URL: str = "http://localhost:8001"
    AI_SERVICE_TIMEOUT: float = 60.0
    AI_SERVICE_LONG_TIMEOUT: float = 120.0

    # Redis
    REDIS_URL: str = "redis://localhost:6379/0"

    # Rate limiting (requests per client per route per window)
    RATE_LIMIT_CALLS: int = 100
    RATE_LIMIT_PERIOD: int = 60

    @property
    def SYNC_DATABASE_URL(self) -> str:
        password = quote_plus(self.POSTGRES_PASSWORD)
        return (
            f"postgresql+psycopg2://{self.POSTGRES_USER}:{password}"
            f"@{self.POSTGRES_HOST}:{self.POSTGRES_PORT}/{self.POSTGRES_DB}"
        )

    @property
    def ASYNC_DATABASE_URL(self) -> str:
        password = quote_plus(self.POSTGRES_PASSWORD)
        return (
            f"postgresql+asyncpg://{self.POSTGRES_USER}:{password}"
            f"@{self.POSTGRES_HOST}:{self.POSTGRES_PORT}/{self.POSTGRES_DB}"
        )

    model_config = SettingsConfigDict(
        case_sensitive=True,
        env_file=".env",
        extra="ignore",
    )


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
