from abc import ABC, abstractmethod


class LLMProvider(ABC):
    """Every LLM backend (local Ollama, any cloud API) implements this one
    method. Services never import a concrete provider directly — they go
    through get_llm_provider() so LLM_PROVIDER=local|cloud is a one-line
    swap with no code changes elsewhere."""

    @abstractmethod
    async def chat(self, system: str, user: str, *, json_mode: bool = False, temperature: float = 0.4) -> str:
        """Return the model's raw text reply. If json_mode is True the
        provider should ask the backend for a JSON response (Ollama's
        `format: json`, OpenAI's `response_format`), but callers must still
        parse defensively — no model reliably guarantees valid JSON."""
        raise NotImplementedError
