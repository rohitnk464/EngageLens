"""
Application configuration using pydantic-settings.
Loads from .env file or environment variables.
"""

import os
from pydantic_settings import BaseSettings
from functools import lru_cache


class Settings(BaseSettings):
    """Application settings loaded from environment variables."""

    # OpenAI
    openai_api_key: str = ""

    # ChromaDB
    chroma_persist_dir: str = "./chroma_db"

    # Models
    embedding_model: str = "all-MiniLM-L6-v2"
    llm_model: str = "gpt-4o-mini"

    # Chunking parameters
    chunk_size: int = 500
    chunk_overlap: int = 50

    # Instagram
    instagram_browser: str = "chrome"

    # Server
    backend_port: int = 8000
    frontend_url: str = "http://localhost:3000"

    model_config = {
        "env_file": os.path.join(os.path.dirname(os.path.dirname(__file__)), ".env"),
        "env_file_encoding": "utf-8",
        "extra": "ignore",
    }


@lru_cache()
def get_settings() -> Settings:
    """Cached settings instance — reads .env once."""
    return Settings()
