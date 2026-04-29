from typing import List

from pydantic import Field, field_validator, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


DEFAULT_SECRET_KEY = "super-secret-key-change-in-production-min-32-chars"


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", case_sensitive=True)

    ENVIRONMENT: str = "development"
    APP_NAME: str = "SmartQuery AI"
    SECRET_KEY: str = DEFAULT_SECRET_KEY
    ENCRYPTION_KEY: str | None = None
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24  # 24 hours

    DATABASE_URL: str = "sqlite+aiosqlite:///./smartquery.db"
    ALLOWED_ORIGINS: List[str] = Field(default_factory=lambda: ["http://localhost:5173", "http://localhost:3000"])

    OLLAMA_BASE_URL: str = "http://localhost:11434"
    OLLAMA_MODEL: str = "phi3"

    QUERY_CACHE_TTL: int = 300
    MAX_QUERY_RETRIES: int = 3
    MAX_HISTORY_PER_USER: int = 100
    QUERY_MAX_TEXT_LENGTH: int = 500
    MAX_CONNECTION_PROFILES_PER_USER: int = 10

    AUTH_RATE_LIMIT_ATTEMPTS: int = 5
    AUTH_RATE_LIMIT_WINDOW_SECONDS: int = 60
    QUERY_RATE_LIMIT_PER_MINUTE: int = 30

    @field_validator("ENVIRONMENT")
    @classmethod
    def normalize_environment(cls, value: str) -> str:
        return (value or "development").strip().lower()

    @field_validator("ALLOWED_ORIGINS", mode="before")
    @classmethod
    def parse_allowed_origins(cls, value):
        if isinstance(value, str):
            return [item.strip() for item in value.split(",") if item.strip()]
        return value

    @model_validator(mode="after")
    def validate_security_settings(self):
        if len(self.SECRET_KEY) < 32:
            raise ValueError("SECRET_KEY must be at least 32 characters long.")
        if self.ENVIRONMENT == "production" and self.SECRET_KEY == DEFAULT_SECRET_KEY:
            raise ValueError("SECRET_KEY must be overridden in production.")
        return self


settings = Settings()
