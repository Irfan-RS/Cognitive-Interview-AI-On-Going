import asyncio
import random
import re

import httpx

from app.providers.llm.base import LLMProvider

# Matches "7.66s", "6m0s", "1h2m3s" — the compound-duration format Groq's
# x-ratelimit-reset-* headers actually use, not just a bare seconds value.
_DURATION_RE = re.compile(r"^(?:(\d+)h)?(?:(\d+)m)?(?:(\d+(?:\.\d+)?)s)?$")

# Hosted providers rate-limit per minute (Groq's free tier caps tokens/min, and
# one analysis prompt is large), and transiently return 5xx under load. A single
# unretried failure surfaces to the candidate as a lost answer mid-interview, so
# both are worth waiting out.
MAX_ATTEMPTS = 4
RETRYABLE_STATUS = {408, 429, 500, 502, 503, 504}


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
        url = f"{self.base_url}/chat/completions"

        async with httpx.AsyncClient(timeout=90.0) as client:
            for attempt in range(1, MAX_ATTEMPTS + 1):
                try:
                    resp = await client.post(url, json=payload, headers=headers)
                except httpx.RequestError:
                    if attempt == MAX_ATTEMPTS:
                        raise
                    await asyncio.sleep(self._backoff(attempt))
                    continue

                if resp.status_code in RETRYABLE_STATUS and attempt < MAX_ATTEMPTS:
                    await asyncio.sleep(self._retry_delay(resp, attempt))
                    continue

                resp.raise_for_status()
                return resp.json()["choices"][0]["message"]["content"].strip()

        raise RuntimeError("unreachable: retry loop exhausted without returning or raising")

    @staticmethod
    def _backoff(attempt: int) -> float:
        # Jitter matters when several requests are throttled together — without
        # it they'd all wake at the same instant and re-trigger the limit.
        return min(2.0 ** attempt, 30.0) + random.uniform(0, 0.5)

    def _retry_delay(self, resp: httpx.Response, attempt: int) -> float:
        """Prefer the provider's own advice — Groq returns how long until the
        token bucket refills, which is far more accurate than guessing."""
        for header in ("retry-after", "x-ratelimit-reset-tokens", "x-ratelimit-reset-requests"):
            raw = resp.headers.get(header)
            if not raw:
                continue
            parsed = self._parse_duration_seconds(raw.strip())
            if parsed is not None:
                return min(parsed, 30.0)
        return self._backoff(attempt)

    @staticmethod
    def _parse_duration_seconds(raw: str) -> float | None:
        match = _DURATION_RE.match(raw)
        if match and any(match.groups()):
            hours, minutes, seconds = match.groups()
            return int(hours or 0) * 3600 + int(minutes or 0) * 60 + float(seconds or 0)
        try:
            # Plain seconds, no unit (the standard Retry-After: delta-seconds form).
            return float(raw)
        except ValueError:
            return None
