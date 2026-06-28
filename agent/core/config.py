from pydantic_settings import BaseSettings
from functools import lru_cache

class Settings(BaseSettings):
    groq_api_key: str
    github_token: str
    redis_url: str
    database_url: str
    environment: str = 'development'

    class Config:
        env_file = ".env"
        extra = "ignore"
    
@lru_cache()
def get_settings() -> Settings:
    return Settings()