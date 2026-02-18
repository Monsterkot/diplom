"""
Application configuration settings.
"""
from pydantic_settings import BaseSettings
from pydantic import field_validator, computed_field
from functools import lru_cache
from typing import List


class Settings(BaseSettings):
    """Application settings loaded from environment variables."""

    # ==========================================================================
    # Application
    # ==========================================================================
    app_name: str = "Literature Aggregation System"
    app_version: str = "1.0.0"
    debug: bool = True
    secret_key: str = "your-secret-key-change-in-production"

    # ==========================================================================
    # Database (PostgreSQL)
    # ==========================================================================
    database_url: str = "postgresql+asyncpg://literature_user:literature_password@postgres:5432/literature_db"

    # Sync URL для Alembic миграций
    @computed_field
    @property
    def database_url_sync(self) -> str:
        """Sync database URL for Alembic migrations."""
        return self.database_url.replace("+asyncpg", "").replace("postgresql://", "postgresql+psycopg2://")

    # ==========================================================================
    # MinIO (S3-compatible storage)
    # ==========================================================================
    minio_endpoint: str = "minio:9000"  # Internal Docker endpoint
    minio_public_endpoint: str = "localhost:9000"  # Public endpoint for browser access
    minio_access_key: str = "minioadmin"
    minio_secret_key: str = "minioadmin123"
    minio_bucket: str = "literature"
    minio_secure: bool = False
    minio_public_secure: bool = False  # Use HTTPS for public URLs

    # ==========================================================================
    # Meilisearch
    # ==========================================================================
    meili_url: str = "http://meilisearch:7700"
    meili_master_key: str = "masterKey123"

    # ==========================================================================
    # JWT Authentication
    # ==========================================================================
    jwt_algorithm: str = "HS256"
    access_token_expire_minutes: int = 60 * 24  # 24 hours
    refresh_token_expire_days: int = 7

    # ==========================================================================
    # CORS
    # ==========================================================================
    cors_origins: str = "http://localhost:3000,http://127.0.0.1:3000,http://frontend:3000"

    @field_validator("cors_origins", mode="before")
    @classmethod
    def parse_cors_origins(cls, v):
        if isinstance(v, list):
            return ",".join(v)
        return v

    @property
    def cors_origins_list(self) -> List[str]:
        """Get CORS origins as list."""
        return [origin.strip() for origin in self.cors_origins.split(",") if origin.strip()]

    # ==========================================================================
    # File Upload
    # ==========================================================================
    max_file_size_mb: int = 100  # Maximum file size in MB
    allowed_file_types: str = "application/pdf,application/epub+zip,text/plain"

    @property
    def max_file_size_bytes(self) -> int:
        return self.max_file_size_mb * 1024 * 1024

    @property
    def allowed_file_types_list(self) -> List[str]:
        return [t.strip() for t in self.allowed_file_types.split(",")]

    # ==========================================================================
    # External APIs
    # ==========================================================================
    google_books_api_key: str | None = None

    # ==========================================================================
    # Celery / Redis
    # ==========================================================================
    redis_url: str = "redis://redis:6379/0"
    celery_broker_url: str = "redis://redis:6379/1"
    celery_result_backend: str = "redis://redis:6379/2"

    class Config:
        env_file = ".env"
        case_sensitive = False
        extra = "ignore"


@lru_cache()
def get_settings() -> Settings:
    """Get cached settings instance."""
    return Settings()


settings = get_settings()
