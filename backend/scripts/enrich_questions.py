"""Generate cognitive scaffolding for every question in the bank.

Adds concept, sub_concept, expected_reasoning, common_mistakes,
progressive_hints and learning_objective to questions that lack them, writing
back into data/question_bank/*.json so the bank stays the version-controlled
source of truth.

Safe to interrupt and re-run: each file is saved as soon as it's finished, and
already-enriched questions are skipped. Reseed afterwards to load the results:

    python scripts/enrich_questions.py
    python scripts/seed_questions.py

Options:
    --limit N     stop after enriching N questions (useful for a trial run)
    --file NAME   only process one bank file, e.g. --file dsa.json
    --force       re-enrich questions that already have scaffolding
"""

import argparse
import asyncio
import json
import sys
from pathlib import Path

BACKEND_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(BACKEND_ROOT))

from app.core.config import get_settings  # noqa: E402
from app.providers.llm.factory import get_llm_provider  # noqa: E402
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


def needs_enrichment(q: dict) -> bool:
    return not (q.get("concept") and q.get("expected_reasoning") and q.get("progressive_hints"))


def _clean_list(value, limit: int) -> list[str]:
    if not isinstance(value, list):
        return []
    return [str(v).strip() for v in value if str(v).strip()][:limit]


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

    try:
        raw = await llm.chat(_SYSTEM_PROMPT, prompt, json_mode=True, temperature=0.3)
    except Exception as exc:  # noqa: BLE001 - one bad question must not kill a multi-hour run
        print(f"    ! LLM error: {exc}")
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
        "sub_concept": str(parsed["sub_concept"]).strip(),
        "expected_reasoning": str(parsed["expected_reasoning"]).strip(),
        "common_mistakes": _clean_list(parsed.get("common_mistakes"), 6),
        "progressive_hints": hints,
        "learning_objective": str(parsed["learning_objective"]).strip(),
    }


async def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--limit", type=int, default=0, help="stop after N enrichments (0 = no limit)")
    parser.add_argument("--file", type=str, default="", help="only process this bank file")
    parser.add_argument("--force", action="store_true", help="re-enrich questions that already have scaffolding")
    args = parser.parse_args()

    settings = get_settings()
    print(f"LLM provider: {settings.llm_provider} ({settings.llm_local_model if settings.llm_provider == 'local' else settings.llm_cloud_model})\n")
    llm = get_llm_provider()

    files = sorted(BANK_DIR.glob(args.file or "*.json"))
    if not files:
        print(f"No bank files matched {args.file or '*.json'}")
        return

    pending = 0
    for path in files:
        questions = json.loads(path.read_text(encoding="utf-8"))
        pending += sum(1 for q in questions if args.force or needs_enrichment(q))
    print(f"{pending} question(s) need enrichment across {len(files)} file(s).")
    if args.limit:
        print(f"Limiting this run to {args.limit}.")
    print("Safe to interrupt — each file is saved as it completes.\n")

    done = 0
    failed = 0
    for path in files:
        questions = json.loads(path.read_text(encoding="utf-8"))
        targets = [q for q in questions if args.force or needs_enrichment(q)]
        if not targets:
            continue

        print(f"{path.name}: {len(targets)} to enrich")
        changed = False
        for q in targets:
            if args.limit and done >= args.limit:
                break
            fields = await enrich_one(llm, q)
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
            print(f"  saved {path.name}")

        if args.limit and done >= args.limit:
            break

    print(f"\nEnriched {done} question(s); {failed} skipped.")
    print("Now run: python scripts/seed_questions.py")


if __name__ == "__main__":
    asyncio.run(main())
