from functools import lru_cache

from app.core.config import get_settings
from app.providers.stt.base import STTProvider
from app.providers.stt.local_whisper_provider import LocalWhisperProvider


@lru_cache
def get_stt_provider() -> STTProvider:
    settings = get_settings()

    # Only "local" is implemented today (faster-whisper) — the interface
    # leaves room for a cloud STT provider later without touching callers.
    if settings.stt_provider == "local":
        return LocalWhisperProvider(
            model_size=settings.stt_local_model_size,
            device=settings.stt_local_device,
            compute_type=settings.stt_local_compute_type,
            language=settings.stt_language,
        )

    raise ValueError(f"Unknown STT_PROVIDER '{settings.stt_provider}' — expected 'local'")
