import json
import re

_FENCE_RE = re.compile(r"^```(?:json)?\s*|\s*```$", re.MULTILINE)


def parse_llm_json(raw: str, fallback: dict) -> dict:
    """Models frequently wrap JSON in markdown fences or add stray prose
    even when asked for json_mode — strip fences, then try to locate the
    outermost {...} block before giving up and returning the fallback."""
    text = _FENCE_RE.sub("", raw).strip()

    try:
        return json.loads(text)
    except json.JSONDecodeError:
        pass

    start, end = text.find("{"), text.rfind("}")
    if start != -1 and end != -1 and end > start:
        try:
            return json.loads(text[start : end + 1])
        except json.JSONDecodeError:
            pass

    return fallback
