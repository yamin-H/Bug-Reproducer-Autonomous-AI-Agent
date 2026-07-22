from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        extra="ignore",
    )

    groq_api_key: str
    github_token: str
    redis_url: str
    database_url: str
    environment: str = "development"


@lru_cache
def get_settings() -> Settings:
    return Settings()