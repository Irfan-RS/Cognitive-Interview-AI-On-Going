from functools import lru_cache

from app.core.config import get_settings
from app.providers.llm.base import LLMProvider
from app.providers.llm.cloud_provider import CloudLLMProvider
from app.providers.llm.ollama_provider import OllamaProvider


@lru_cache
def get_llm_provider() -> LLMProvider:
    settings = get_settings()

    if settings.llm_provider == "cloud":
        return CloudLLMProvider(
            base_url=settings.llm_cloud_base_url,
            api_key=settings.llm_cloud_api_key,
            model=settings.llm_cloud_model,
        )

    if settings.llm_provider == "local":
        return OllamaProvider(base_url=settings.llm_local_base_url, model=settings.llm_local_model)

    raise ValueError(f"Unknown LLM_PROVIDER '{settings.llm_provider}' — expected 'local' or 'cloud'")
