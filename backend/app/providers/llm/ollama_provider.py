import httpx

from app.providers.llm.base import LLMProvider


class OllamaProvider(LLMProvider):
    """Talks to a local Ollama daemon (`ollama serve`, default port 11434).
    No API key, no data leaving the machine — the default for this project
    given the target hardware (8GB RAM / entry-level GPU): pick a small
    quantized instruct model (e.g. qwen2.5:3b-instruct) with `ollama pull`."""

    def __init__(self, base_url: str, model: str):
        self.base_url = base_url.rstrip("/")
        self.model = model

    async def chat(self, system: str, user: str, *, json_mode: bool = False, temperature: float = 0.4) -> str:
        payload = {
            "model": self.model,
            "messages": [
                {"role": "system", "content": system},
                {"role": "user", "content": user},
            ],
            "stream": False,
            "options": {"temperature": temperature},
        }
        if json_mode:
            payload["format"] = "json"

        # 300s, not 120s: on the target hardware (CPU-only, no dedicated model
        # server) a cold model load — after Ollama's idle-unload, or the very
        # first request — can itself take over a minute before generation starts.
        async with httpx.AsyncClient(timeout=300.0) as client:
            resp = await client.post(f"{self.base_url}/api/chat", json=payload)
            resp.raise_for_status()
            data = resp.json()
            return data.get("message", {}).get("content", "").strip()
