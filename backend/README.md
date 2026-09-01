# Cognitive Interview AI — Backend

Layered FastAPI service powering the mock/practice interview flow: session
orchestration, RAG-backed question selection, speech-to-text, LLM-driven
answer analysis and follow-up generation, and text-to-speech.

## Layers

```
app/
  routers/v1/      thin HTTP layer — request/response only, no business logic
  services/        interview flow, difficulty adaptation, analysis, follow-ups, hints
  rag/             embeddings + Chroma vector store + retriever (question selection & follow-up grounding)
  providers/       swappable adapters — llm/{ollama,cloud}, stt/{local}, tts/{google_cloud,local}
  repositories/    all SQL access — services never touch the ORM/session directly
  models/          SQLAlchemy tables
  schemas/         Pydantic request/response contracts
  core/            settings (env-driven)
```

Nothing above talks to a concrete provider directly — every LLM/STT/TTS call
goes through `providers/*/factory.py`, so `LLM_PROVIDER=local` vs `cloud` (or
swapping the cloud model) is a `.env` change, not a code change.

## Setup

```bash
cd backend
python -m venv .venv
.venv\Scripts\activate        # Windows
pip install -r requirements.txt
copy .env.example .env
```

The defaults in `.env.example` need zero external accounts to boot:
SQLite for storage, a local Whisper model for STT, a local Ollama model for
the LLM, and an offline OS-voice fallback for TTS if Google credentials
aren't set.

### Local LLM (default) — sized for 8GB RAM / entry-level GPU

Install [Ollama](https://ollama.com), then pull a small instruct model:

```bash
ollama pull qwen2.5:3b-instruct
```

That fits comfortably in 8GB RAM on CPU alone; a GTX 1650 (4GB VRAM) gives a
speed boost but isn't required. `phi3.5:3.8b-mini-instruct-q4_0` is a good
alternative if you want to compare.

### Cloud LLM (optional)

Set in `.env`:

```
LLM_PROVIDER=cloud
LLM_CLOUD_API_KEY=sk-...
LLM_CLOUD_MODEL=gpt-4o-mini
```

`LLM_CLOUD_BASE_URL` accepts any OpenAI-compatible `/chat/completions`
endpoint, so this also works with Groq, Together, OpenRouter, etc. — just
change the base URL and model.

### Voice

- **STT** (candidate's spoken answer → text): local by default via
  `faster-whisper` — no account needed, runs fully offline.
- **TTS** (question read aloud): Google Cloud TTS free tier if
  `GOOGLE_APPLICATION_CREDENTIALS` is set in `.env`; otherwise falls back
  automatically to the OS's built-in voice (SAPI5 on Windows) so voice
  interaction still works with zero setup.

## Seed the question bank + build the RAG index

```bash
python scripts/seed_questions.py   # loads data/question_bank/*.json into SQLite
python scripts/build_index.py      # embeds every question into the Chroma vector store
```

Both are safe to re-run. Adding more questions later: drop another
`*.json` file (same schema) into `data/question_bank/`, or POST to
`/api/v1/admin/questions/bulk-import` (which indexes immediately, no
separate reindex step).

## Run

```bash
uvicorn app.main:app --reload --port 8000
```

Interactive API docs at `http://localhost:8000/docs`.

## How a session flows through the layers

1. `POST /api/v1/sessions` — `interview_service.start_session` asks
   `rag/retriever.select_question` for a first question matching the
   chosen track (role/resume/topic) at the starting difficulty.
2. `POST /api/v1/questions/{id}/answer` (multipart audio) —
   `providers/stt` transcribes it, `services/analysis_service` asks the LLM
   (grounded with the question's admin-authored key points) to score
   grammar, relevance, and coverage; `services/difficulty_service` adjusts
   the next question's difficulty from that score.
3. `POST /api/v1/questions/{id}/follow-up` — `services/followup_service`
   pulls related bank questions via `rag/retriever.retrieve_related_context`
   and asks the LLM for one grounded, specific follow-up.
4. `POST /api/v1/questions/{id}/next` — pulls another question via the same
   RAG retriever, excluding everything already asked this session.
5. `GET /api/v1/sessions/{id}/report` — full per-question breakdown:
   transcript, grammar issues, filler/pause counts, relevance %, eye-contact
   ratio (from `/api/v1/monitoring/events`), confidence score, and the
   LLM's model solution.
