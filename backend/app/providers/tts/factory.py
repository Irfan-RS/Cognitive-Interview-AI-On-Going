from functools import lru_cache

from app.core.config import get_settings
from app.providers.tts.base import TTSProvider
from app.providers.tts.google_tts_provider import GoogleCloudTTSProvider
from app.providers.tts.local_tts_provider import LocalTTSProvider


@lru_cache
def get_tts_provider() -> TTSProvider:
    settings = get_settings()

    if settings.tts_provider == "google_cloud" and settings.google_application_credentials:
        return GoogleCloudTTSProvider(
            voice_name=settings.google_tts_voice_name,
            language_code=settings.google_tts_language_code,
        )

    # No credentials configured (or explicitly requested) -> offline fallback,
    # so voice interaction still works out of the box for local dev.
    return LocalTTSProvider()
