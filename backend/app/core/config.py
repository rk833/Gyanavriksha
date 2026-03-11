from functools import lru_cache
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    # Core project settings
    PROJECT_NAME: str = "Gyanavriksha Backend API"
    ENVIRONMENT: str = "development"

    # Database settings – values come from .env / environment
    POSTGRES_HOST: str = "localhost"
    POSTGRES_PORT: int = 5432
    POSTGRES_USER: str = "postgres"
    POSTGRES_PASSWORD: str = "postgres"
    POSTGRES_DB: str = "gyanavriksha"
    POSTGRES_LOG_LEVEL: str = "info"

    @property
    def SYNC_DATABASE_URL(self) -> str:
        """
        Synchronous URL used by Alembic for migrations.
        Uses psycopg2 driver.
        """
        return (
            f"postgresql+psycopg2://{self.POSTGRES_USER}:{self.POSTGRES_PASSWORD}"
            f"@{self.POSTGRES_HOST}:{self.POSTGRES_PORT}/{self.POSTGRES_DB}"
        )

    @property
    def ASYNC_DATABASE_URL(self) -> str:
        """
        Async URL for application runtime (if/when async engine is used).
        """
        return (
            f"postgresql+asyncpg://{self.POSTGRES_USER}:{self.POSTGRES_PASSWORD}"
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

