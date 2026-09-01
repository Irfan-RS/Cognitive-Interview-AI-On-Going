from functools import lru_cache
from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict

BACKEND_ROOT = Path(__file__).resolve().parent.parent.parent


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    app_env: str = "development"
    cors_origins: str = "http://localhost:5173"

    database_url: str = "sqlite:///./storage/cognitive_interview.db"

    # LLM provider switch — this single field is what makes local vs cloud swappable.
    llm_provider: str = "local"  # "local" | "cloud"
    llm_local_base_url: str = "http://localhost:11434"
    llm_local_model: str = "qwen2.5:3b-instruct"
    llm_cloud_base_url: str = "https://api.openai.com/v1"
    llm_cloud_api_key: str = ""
    llm_cloud_model: str = "gpt-4o-mini"

    stt_provider: str = "local"  # "local" | "cloud"
    stt_local_model_size: str = "base"
    stt_local_device: str = "cpu"
    stt_local_compute_type: str = "int8"
    # Pinned so short/accented answers aren't misdetected as another language.
    # Set to "" to restore Whisper's auto-detection.
    stt_language: str = "en"

    tts_provider: str = "google_cloud"  # "google_cloud" | "local_stub"
    google_application_credentials: str = ""
    google_tts_voice_name: str = "en-US-Neural2-C"
    google_tts_language_code: str = "en-US"

    chroma_persist_dir: str = "./storage/chroma"
    embedding_model: str = "BAAI/bge-small-en-v1.5"

    hint_after_seconds: int = 15
    auto_record_after_seconds: int = 20
    difficulty_min: int = 1
    difficulty_max: int = 5
    readiness_pass_threshold: float = 60.0

    recordings_dir: str = "./storage/recordings"

    @property
    def cors_origin_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]

    def resolve(self, relative: str) -> Path:
        """Resolve a config path relative to the backend root, so the app
        works the same whether uvicorn is launched from backend/ or elsewhere."""
        path = Path(relative)
        return path if path.is_absolute() else (BACKEND_ROOT / path)

    @property
    def resolved_database_url(self) -> str:
        """Anchors a relative sqlite:/// URL to the backend root, same as every
        other storage path — otherwise which DB file gets opened silently
        depends on the process's launch directory instead of the repo."""
        prefix = "sqlite:///"
        if not self.database_url.startswith(prefix):
            return self.database_url
        file_part = self.database_url[len(prefix) :]
        if file_part.startswith("/"):  # already absolute
            return self.database_url
        return f"{prefix}{self.resolve(file_part).as_posix()}"


@lru_cache
def get_settings() -> Settings:
    return Settings()
