"""Generate cognitive scaffolding for every question in the bank.

Adds concept, sub_concept, expected_reasoning, common_mistakes,
progressive_hints and learning_objective to questions that lack them, writing
back into data/question_bank/*.json so the bank stays the version-controlled
source of truth.

Safe to interrupt and re-run: each file is saved as soon as it's finished, and
already-enriched questions are skipped. Reseed afterwards to load the results:

    python scripts/enrich_questions.py
    python scripts/seed_questions.py

This is a BUILD-TIME task, not a runtime dependency: the results are written
into the bank files and committed, so the app itself still runs fully local
afterwards. Use --provider cloud for markedly better scaffolding without
changing what the running app uses.

Options:
    --limit N          stop after enriching N questions (useful for a trial run)
    --file NAME        only process one bank file, e.g. --file dsa.json
    --force            re-enrich questions that already have scaffolding
    --provider local|cloud   override LLM_PROVIDER for this run only
    --concurrency N    parallel requests (cloud only; default 1)
    --roles a,b        only questions tagged with any of these roles
    --topics a,b       only questions tagged with any of these topics
    --preset core      shorthand for the priority roles+topics (see PRESETS)

Free API tiers cap requests per DAY per model, so enriching the whole bank in
one go usually isn't possible — filter to what matters first.
"""

import argparse
import asyncio
import json
import re
import sys
from pathlib import Path

BACKEND_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(BACKEND_ROOT))

from app.core.config import get_settings  # noqa: E402
from app.providers.llm.cloud_provider import CloudLLMProvider  # noqa: E402
from app.providers.llm.ollama_provider import OllamaProvider  # noqa: E402
from app.services.llm_json import parse_llm_json  # noqa: E402

BANK_DIR = BACKEND_ROOT / "data" / "question_bank"

_SYSTEM_PROMPT = """You write the cognitive scaffolding an interviewer uses to grade HOW a
candidate reasons — not just whether they land the right answer.

Rules:
- expected_reasoning describes the THINKING PATH a strong candidate follows to reach the
  answer (what they clarify first, what they derive, what trade-off they weigh). It is not a
  restatement of the answer.
- common_mistakes are the specific, realistic ways candidates get this wrong or answer
  shallowly — including "states the conclusion with no justification" style failures.
- progressive_hints must ESCALATE IN STRENGTH — they are three attempts at the SAME stuck
  moment, not three separate sub-questions. Hint 1 barely helps (just reframes the problem or
  asks what to consider first). Hint 2 narrows to the specific area they're missing. Hint 3 is
  the strongest hint possible that STILL leaves the candidate to state the answer.
  Correct escalation, for "why is a hash map right here?":
    1. "What is the slow part of your current approach doing repeatedly?"
    2. "You're recomputing sums over ranges you've already seen. What could you store instead?"
    3. "If you knew the running total at every index, what single lookup would tell you a
       subarray ends here?"
  WRONG (three parallel sub-questions, no escalation):
    1. "What is a hash map?" 2. "What is a prefix sum?" 3. "What is the time complexity?"
  No hint may contain the answer itself.
- concept is the single core idea being tested, in Title Case (e.g. "Prefix Sum",
  "CAP Theorem", "Database Indexing"). sub_concept is the specific facet of it.
- learning_objective is what the candidate should walk away understanding.

Respond with ONLY a JSON object. No markdown fences, no prose outside the JSON."""

_USER_TEMPLATE = """QUESTION: {question}

TYPE: {type} | DIFFICULTY: {difficulty}/5
TOPICS: {topics}
{key_points}

Return a JSON object with exactly these fields:
{{
  "concept": "the single core concept under test, Title Case, 1-4 words",
  "sub_concept": "the specific facet of that concept this question probes",
  "expected_reasoning": "3-5 sentences describing the reasoning path a strong candidate follows to get here — what they clarify, derive, and weigh. Not the answer itself.",
  "common_mistakes": ["4-6 specific, realistic ways candidates get this wrong or answer shallowly"],
  "progressive_hints": ["barely helps - reframes or asks what to consider first", "narrows to the specific area they are missing", "strongest possible hint that still withholds the answer itself"],
  "learning_objective": "one sentence: what the candidate should walk away understanding"
}}"""

REQUIRED = ["concept", "sub_concept", "expected_reasoning", "common_mistakes", "progressive_hints", "learning_objective"]

SAVE_EVERY = 20  # write progress to disk every N enrichments within a file

# The roles/topics worth spending limited daily quota on first: the engineering
# tracks candidates actually pick, plus the CS fundamentals every interview
# draws on. Deliberately excludes the behavioural/culture-fit bulk, which is
# both the largest slice of the bank and the least dependent on this kind of
# technical reasoning scaffolding.
PRESETS: dict[str, dict[str, set[str]]] = {
    "core": {
        "roles": {
            "backend",
            "frontend",
            "fullstack",
            "system_design",
            "ml",
            "machine_learning_engineer",
            "data_scientist",
            "data_engineer",
        },
        "topics": {
            # CS fundamentals
            "operating-systems", "os", "dbms", "databases", "networking", "computer-networks",
            "oop", "oop-fundamentals", "system-design", "distributed-systems",
            # Backend depth
            "authentication", "security", "api-design", "database-indexing", "sql", "nosql",
            "caching", "microservices", "message-queues", "concurrency", "scalability",
            "rate-limiting", "load-balancing", "observability", "event-driven",
            # Frontend / fullstack
            "frontend", "react", "javascript", "typescript", "css", "web-performance",
            "accessibility", "http", "real-time",
            # Data / ML
            "machine-learning", "statistics", "big-data", "ml-systems",
            # Language + DSA underpinnings
            "dsa", "algorithms", "arrays", "python", "java", "cpp", "nodejs",
            "dynamic-programming", "recursion", "trees", "binary-search-tree", "dfs-bfs",
            "strings", "matrix", "graphs", "heaps", "linked-lists", "hashing", "sorting",
            "networking-fundamentals", "scheduling", "processes", "threads", "deadlock",
            "memory-management", "design-patterns", "performance", "cloud", "devops", "docker",
            "kubernetes", "testing", "git", "linux",
        },
    }
}


def _matches_filters(q: dict, roles: set[str], topics: set[str]) -> bool:
    """A question qualifies if it matches EITHER filter — a DBMS question tagged
    only 'general_sde' still matters for a backend candidate, and a backend-role
    question is worth enriching whatever its topic tag happens to be."""
    if not roles and not topics:
        return True
    if roles and roles & {r.lower() for r in q.get("roles", [])}:
        return True
    if topics and topics & {t.lower() for t in q.get("topics", [])}:
        return True
    return False


def needs_enrichment(q: dict) -> bool:
    return not (q.get("concept") and q.get("expected_reasoning") and q.get("progressive_hints"))


def _strip_latex(text: str) -> str:
    """Models like to wrap complexities in LaTeX ($O(n^2)$). These strings are
    shown to candidates and read aloud by TTS, where the delimiters render as
    literal dollar signs — strip them but keep the expression."""
    return re.sub(r"\$([^$]+)\$", r"\1", text).strip()


def _clean_list(value, limit: int) -> list[str]:
    if not isinstance(value, list):
        return []
    return [_strip_latex(str(v)) for v in value if str(v).strip()][:limit]


async def _chat_with_backoff(llm, system: str, user: str, *, attempts: int = 6) -> str | None:
    """Free API tiers rate-limit aggressively (429) and flash models return
    transient 503s under load. Both are retryable — without backoff the run
    burns through the whole bank failing rather than just waiting a moment."""
    delay = 4.0
    for attempt in range(1, attempts + 1):
        try:
            return await llm.chat(system, user, json_mode=True, temperature=0.3)
        except Exception as exc:  # noqa: BLE001 - provider SDKs raise varied types
            text = str(exc)
            retryable = "429" in text or "503" in text or "Too Many Requests" in text or "UNAVAILABLE" in text
            if not retryable or attempt == attempts:
                print(f"    ! LLM error: {text[:120]}")
                return None
            await asyncio.sleep(delay)
            delay = min(delay * 2, 60.0)  # 4, 8, 16, 32, 60...
    return None


async def enrich_one(llm, q: dict) -> dict | None:
    ref = q.get("reference_solution") or {}
    key_points = ref.get("key_points") or []
    prompt = _USER_TEMPLATE.format(
        question=q.get("question", ""),
        type=q.get("type", "conceptual"),
        difficulty=q.get("difficulty", 3),
        topics=", ".join(q.get("topics", [])) or "(untagged)",
        key_points=("KEY POINTS A STRONG ANSWER COVERS:\n" + "\n".join(f"- {kp}" for kp in key_points))
        if key_points
        else "",
    )

    raw = await _chat_with_backoff(llm, _SYSTEM_PROMPT, prompt)
    if raw is None:
        return None

    parsed = parse_llm_json(raw, {})
    if not all(parsed.get(f) for f in REQUIRED):
        return None

    hints = _clean_list(parsed.get("progressive_hints"), 3)
    if len(hints) < 2:  # a single "progressive" hint defeats the point
        return None

    # Small models often return the concept lowercased despite the instruction;
    # it's surfaced to candidates as a label, so normalise rather than re-prompt.
    concept = str(parsed["concept"]).strip()
    if concept.islower():
        concept = concept.title()

    return {
        "concept": concept,
        "sub_concept": _strip_latex(str(parsed["sub_concept"])),
        "expected_reasoning": _strip_latex(str(parsed["expected_reasoning"])),
        "common_mistakes": _clean_list(parsed.get("common_mistakes"), 6),
        "progressive_hints": hints,
        "learning_objective": _strip_latex(str(parsed["learning_objective"])),
    }


async def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--limit", type=int, default=0, help="stop after N enrichments (0 = no limit)")
    parser.add_argument("--file", type=str, default="", help="only process this bank file")
    parser.add_argument("--force", action="store_true", help="re-enrich questions that already have scaffolding")
    parser.add_argument("--provider", choices=["local", "cloud"], default="", help="override LLM_PROVIDER for this run only")
    parser.add_argument("--concurrency", type=int, default=1, help="parallel requests (cloud only)")
    parser.add_argument("--roles", type=str, default="", help="comma-separated roles to include")
    parser.add_argument("--topics", type=str, default="", help="comma-separated topics to include")
    parser.add_argument("--preset", choices=sorted(PRESETS), default="", help="use a predefined role/topic filter")
    args = parser.parse_args()

    roles = {r.strip().lower() for r in args.roles.split(",") if r.strip()}
    topics = {t.strip().lower() for t in args.topics.split(",") if t.strip()}
    if args.preset:
        roles |= PRESETS[args.preset]["roles"]
        topics |= PRESETS[args.preset]["topics"]

    settings = get_settings()
    provider = args.provider or settings.llm_provider

    if provider == "cloud":
        if not settings.llm_cloud_api_key:
            print(
                "LLM_CLOUD_API_KEY is not set.\n\n"
                "Add your key to backend/.env (create it from .env.example if needed):\n"
                "    LLM_CLOUD_API_KEY=sk-...\n"
                "    LLM_CLOUD_BASE_URL=https://api.openai.com/v1\n"
                "    LLM_CLOUD_MODEL=gpt-4o-mini\n\n"
                "LLM_CLOUD_BASE_URL accepts any OpenAI-compatible endpoint (Groq, Together,\n"
                "OpenRouter, etc.). Leave LLM_PROVIDER=local so the APP still runs offline —\n"
                "this script only uses cloud for the one-off enrichment."
            )
            return
        llm = CloudLLMProvider(
            base_url=settings.llm_cloud_base_url,
            api_key=settings.llm_cloud_api_key,
            model=settings.llm_cloud_model,
        )
        model_name = settings.llm_cloud_model
    else:
        llm = OllamaProvider(base_url=settings.llm_local_base_url, model=settings.llm_local_model)
        model_name = settings.llm_local_model

    concurrency = max(1, args.concurrency if provider == "cloud" else 1)
    print(f"LLM provider: {provider} ({model_name}), concurrency {concurrency}\n")

    files = sorted(BANK_DIR.glob(args.file or "*.json"))
    if not files:
        print(f"No bank files matched {args.file or '*.json'}")
        return

    pending = 0
    for path in files:
        questions = json.loads(path.read_text(encoding="utf-8"))
        pending += sum(
            1 for q in questions if (args.force or needs_enrichment(q)) and _matches_filters(q, roles, topics)
        )
    if roles or topics:
        print(f"Filter: {len(roles)} role(s), {len(topics)} topic(s) — matching EITHER.")
    print(f"{pending} question(s) need enrichment across {len(files)} file(s).")
    if args.limit:
        print(f"Limiting this run to {args.limit}.")
    print("Safe to interrupt — each file is saved as it completes.\n")

    done = 0
    failed = 0
    for path in files:
        questions = json.loads(path.read_text(encoding="utf-8"))
        targets = [
            q for q in questions if (args.force or needs_enrichment(q)) and _matches_filters(q, roles, topics)
        ]
        if not targets:
            continue

        if args.limit:
            targets = targets[: max(0, args.limit - done)]
            if not targets:
                break

        print(f"{path.name}: {len(targets)} to enrich")

        semaphore = asyncio.Semaphore(concurrency)

        async def run(q):
            async with semaphore:
                return q, await enrich_one(llm, q)

        # Process in chunks and save after each, so an interrupted run of a
        # large file (behavioral_project.json alone has 456) keeps its progress
        # instead of discarding everything done so far.
        changed = False
        for start in range(0, len(targets), SAVE_EVERY):
            chunk = targets[start : start + SAVE_EVERY]
            for q, fields in await asyncio.gather(*(run(q) for q in chunk)):
                if fields is None:
                    failed += 1
                    print(f"    skip {q.get('id')} (unusable response)")
                    continue
                q.update(fields)
                changed = True
                done += 1
                print(f"    [{done}/{args.limit or pending}] {q.get('id')} -> {fields['concept']}")

            if changed:
                path.write_text(json.dumps(questions, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
                print(f"  saved {path.name} ({done} enriched so far)")

        if args.limit and done >= args.limit:
            break

    print(f"\nEnriched {done} question(s); {failed} skipped.")
    print("Now run: python scripts/seed_questions.py")


if __name__ == "__main__":
    asyncio.run(main())
