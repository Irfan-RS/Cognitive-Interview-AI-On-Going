import httpx

from app.providers.llm.base import LLMProvider


class CloudLLMProvider(LLMProvider):
    """Any OpenAI-compatible /chat/completions endpoint — OpenAI itself, or
    a compatible provider (Groq, Together, OpenRouter, etc.). Swapping
    providers within "cloud" mode is just changing base_url/model in .env,
    no code change."""

    def __init__(self, base_url: str, api_key: str, model: str):
        if not api_key:
            raise RuntimeError(
                "LLM_PROVIDER=cloud but LLM_CLOUD_API_KEY is empty — set it in .env, "
                "or switch LLM_PROVIDER=local to use Ollama instead."
            )
        self.base_url = base_url.rstrip("/")
        self.api_key = api_key
        self.model = model

    async def chat(self, system: str, user: str, *, json_mode: bool = False, temperature: float = 0.4) -> str:
        payload = {
            "model": self.model,
            "messages": [
                {"role": "system", "content": system},
                {"role": "user", "content": user},
            ],
            "temperature": temperature,
        }
        if json_mode:
            payload["response_format"] = {"type": "json_object"}

        headers = {"Authorization": f"Bearer {self.api_key}"}

        async with httpx.AsyncClient(timeout=60.0) as client:
            resp = await client.post(f"{self.base_url}/chat/completions", json=payload, headers=headers)
            resp.raise_for_status()
            data = resp.json()
            return data["choices"][0]["message"]["content"].strip()
