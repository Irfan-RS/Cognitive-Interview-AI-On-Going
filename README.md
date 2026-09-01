# Cognitive Interview AI

**A voice-driven, AI-powered mock & practice interview platform** that watches, listens, and adapts — combining live webcam-based eye-contact monitoring, adaptive difficulty, speech-to-text/text-to-speech, and an LLM-graded, RAG-backed question bank of 900+ interview questions to help candidates build real interview confidence.

<p align="left">
  <img alt="Python" src="https://img.shields.io/badge/Python-3.11-3776AB?style=for-the-badge&logo=python&logoColor=white" />
  <img alt="FastAPI" src="https://img.shields.io/badge/FastAPI-009688?style=for-the-badge&logo=fastapi&logoColor=white" />
  <img alt="React" src="https://img.shields.io/badge/React-19-61DAFB?style=for-the-badge&logo=react&logoColor=black" />
  <img alt="Vite" src="https://img.shields.io/badge/Vite-646CFF?style=for-the-badge&logo=vite&logoColor=white" />
  <img alt="TailwindCSS" src="https://img.shields.io/badge/TailwindCSS-4-06B6D4?style=for-the-badge&logo=tailwindcss&logoColor=white" />
  <img alt="SQLite" src="https://img.shields.io/badge/SQLite-003B57?style=for-the-badge&logo=sqlite&logoColor=white" />
</p>

---

## Table of Contents

- [Overview](#overview)
- [Key Features](#key-features)
- [Tech Stack](#tech-stack)
- [Architecture](#architecture)
- [Workflow](#workflow)
- [Project Structure](#project-structure)
- [Getting Started](#getting-started)
- [Configuration](#configuration)
- [API Overview](#api-overview)
- [Question Bank](#question-bank)

---

## Overview

Cognitive Interview AI simulates a real technical interview end-to-end:

1. A candidate picks a **role, resume-based, or topic track**, plus an interview **duration** (5 / 10 / 30 min).
2. A one-time **calibration** step maps where the candidate is actually looking on screen.
3. During the interview, the candidate is **continuously monitored** for eye contact via the webcam — if they look away for too long, a gentle on-screen nudge reminds them to look back, without interrupting the flow.
4. Each answer is **recorded, transcribed, and graded** by an LLM against an admin-authored rubric — difficulty adapts turn-by-turn based on performance, and the system decides whether to ask a grounded follow-up or move to the next question.
5. Only **after** the interview ends does the candidate see their full report: per-question transcripts, scores, a readiness rating, and concrete action items.

The whole system is built as **swappable, layered components** — the LLM, speech-to-text, and text-to-speech providers are all configured via environment variables, so it runs entirely offline/local (sized for an 8GB-RAM laptop with an entry-level GPU) or against cloud APIs, with no code changes either way.

## Key Features

- 🎯 **Two modes** — Mock Interview (timed, realistic, no hints) and Practice Mode (hints after 15s of silence)
- 🧭 **Three track types** — Role-based, Resume-based, or Topic-based question selection
- 👁️ **Live gaze & eye-contact monitoring** — client-side MediaPipe FaceLandmarker with a custom 5-point calibration (4 corners + center), least-squares-fitted to the candidate's actual screen
- 📈 **Adaptive difficulty engine** — each answer's score shifts the next question's difficulty up or down
- 🔁 **Smart follow-up logic** — the system decides whether to probe deeper on the same topic or move to a new question, grounded in real related questions from the bank (RAG)
- 🎙️ **Full voice pipeline** — questions are read aloud (TTS), answers are spoken and transcribed (STT)
- 🗂️ **Centralized, many-to-many tagged question bank** — 900+ questions tagged by role, topic, skill, and concept (not siloed per-role banks), each with reference solutions, evaluation criteria, and scoring rubrics
- 🧠 **LLM-graded answers** — scored against a real rubric (correctness, depth, reasoning, communication, trade-off awareness), producing a genuine `rubric_score`
- 📊 **Post-interview report** — readiness score, pass/fail threshold, per-question breakdown, and LLM-synthesized summary + action items — generated only once the interview actually ends
- ⏱️ **Configurable session length** — 5 / 10 / 30 minute interviews, with a live countdown and a "Complete interview" early-exit option
- 🔌 **Swappable providers** — local (Ollama / faster-whisper / OS voice) or cloud (any OpenAI-compatible LLM, Google Cloud TTS) via a single `.env` change

## Tech Stack

<table>
<tr><td valign="top">

**Frontend**

<img src="https://img.shields.io/badge/React_19-61DAFB?style=flat-square&logo=react&logoColor=black" /><br/>
<img src="https://img.shields.io/badge/Vite-646CFF?style=flat-square&logo=vite&logoColor=white" /><br/>
<img src="https://img.shields.io/badge/React_Router-CA4245?style=flat-square&logo=reactrouter&logoColor=white" /><br/>
<img src="https://img.shields.io/badge/TailwindCSS_4-06B6D4?style=flat-square&logo=tailwindcss&logoColor=white" /><br/>
<img src="https://img.shields.io/badge/MediaPipe-0097A7?style=flat-square&logo=googlecloud&logoColor=white" /><br/>
<img src="https://img.shields.io/badge/Lucide_Icons-F56565?style=flat-square&logo=lucide&logoColor=white" />

</td><td valign="top">

**Backend**

<img src="https://img.shields.io/badge/Python_3.11-3776AB?style=flat-square&logo=python&logoColor=white" /><br/>
<img src="https://img.shields.io/badge/FastAPI-009688?style=flat-square&logo=fastapi&logoColor=white" /><br/>
<img src="https://img.shields.io/badge/Uvicorn-499848?style=flat-square&logo=gunicorn&logoColor=white" /><br/>
<img src="https://img.shields.io/badge/SQLAlchemy_2.0-D71F00?style=flat-square&logo=sqlalchemy&logoColor=white" /><br/>
<img src="https://img.shields.io/badge/SQLite-003B57?style=flat-square&logo=sqlite&logoColor=white" /><br/>
<img src="https://img.shields.io/badge/Pydantic-E92063?style=flat-square&logo=pydantic&logoColor=white" />

</td><td valign="top">

**AI / ML**

<img src="https://img.shields.io/badge/Ollama-000000?style=flat-square&logo=ollama&logoColor=white" /><br/>
<img src="https://img.shields.io/badge/Qwen2.5--3B--Instruct-FF6F00?style=flat-square" /><br/>
<img src="https://img.shields.io/badge/ChromaDB-FF6F61?style=flat-square" /><br/>
<img src="https://img.shields.io/badge/FastEmbed_(BGE--small)-6E4AFF?style=flat-square" /><br/>
<img src="https://img.shields.io/badge/faster--whisper-2E2E2E?style=flat-square" /><br/>
<img src="https://img.shields.io/badge/Google_Cloud_TTS-4285F4?style=flat-square&logo=googlecloud&logoColor=white" />

</td></tr>
</table>

| Layer | Choice | Why |
|---|---|---|
| LLM (local) | Ollama — `qwen2.5:3b-instruct` | Fits comfortably in 8GB RAM / GTX 1650 (4GB) — no cloud account needed |
| LLM (cloud, optional) | Any OpenAI-compatible `/chat/completions` endpoint | Drop-in swap via `.env` — OpenAI, Groq, Together, OpenRouter, etc. |
| Speech-to-Text | `faster-whisper` (CTranslate2) | Lightweight, fully offline, no `torch` dependency |
| Text-to-Speech | Google Cloud TTS (free tier) → falls back to OS voice | Works with zero setup if no Google credentials are configured |
| Vector store | ChromaDB + FastEmbed (`BAAI/bge-small-en-v1.5`) | CPU-friendly RAG retrieval for question selection & follow-ups |
| Database | SQLite | Zero-setup persistence, right-sized for single-machine/local deployment |

## Architecture

The backend follows a strict **layered architecture** — routers never touch the database directly, services never call a concrete LLM/STT/TTS SDK directly, and every external dependency is swappable behind a `providers/*/factory.py` interface.

```mermaid
graph TB
    subgraph Client["Browser — React + Vite"]
        UI["Landing / Setup / Calibration<br/>/ Interview / Dashboard"]
        MP["MediaPipe FaceLandmarker<br/>(gaze & eye-contact tracking)"]
        REC["MediaRecorder<br/>(audio capture)"]
    end

    subgraph API["FastAPI Backend — layered"]
        ROUTERS["Routers (routers/v1/*)<br/>HTTP layer only — no business logic"]
        SERVICES["Services<br/>interview flow · difficulty · analysis · follow-ups · hints · report"]
        RAGL["RAG<br/>embeddings + Chroma retriever"]
        PROV["Providers<br/>llm/{ollama,cloud} · stt/{local} · tts/{google_cloud,local}"]
        REPO["Repositories<br/>all SQL access — services never touch the ORM directly"]
    end

    subgraph Storage["Storage"]
        DB[("SQLite<br/>sessions · answers · questions · taxonomy")]
        VEC[("Chroma Vector Store<br/>question embeddings")]
        FS[("Recordings<br/>answer audio files")]
    end

    subgraph External["Pluggable External Services"]
        OLLAMA["Ollama (local)<br/>qwen2.5:3b-instruct"]
        CLOUD["Cloud LLM<br/>OpenAI-compatible API"]
        WHISPER["faster-whisper<br/>local STT"]
        GTTS["Google Cloud TTS"]
    end

    UI -->|"REST /api/v1/*"| ROUTERS
    MP -.->|"gaze events"| ROUTERS
    REC -->|"answer audio (multipart)"| ROUTERS
    ROUTERS --> SERVICES
    SERVICES --> RAGL
    SERVICES --> PROV
    SERVICES --> REPO
    REPO --> DB
    RAGL --> VEC
    RAGL --> REPO
    PROV --> OLLAMA
    PROV --> CLOUD
    PROV --> WHISPER
    PROV --> GTTS
    SERVICES --> FS
```

**Backend layers** (`backend/app/`):

```
routers/v1/      thin HTTP layer — request/response only, no business logic
services/        interview flow, difficulty adaptation, analysis, follow-ups, hints, reports
rag/             embeddings + Chroma vector store + weighted-ranking retriever
providers/       swappable adapters — llm/{ollama,cloud}, stt/{local}, tts/{google_cloud,local}
repositories/    all SQL access — services never touch the ORM/session directly
models/          SQLAlchemy tables (+ many-to-many taxonomy: Role/Topic/Skill/Concept)
schemas/         Pydantic request/response contracts
core/            settings (env-driven, swappable providers via .env)
```

Because nothing above talks to a concrete provider directly, switching `LLM_PROVIDER=local` → `cloud`, or changing the STT/TTS backend, is a **`.env` change, not a code change**.

## Workflow

### Interview session lifecycle

```mermaid
sequenceDiagram
    participant U as Candidate (Browser)
    participant API as FastAPI
    participant RAG as RAG Retriever
    participant STT as STT Provider
    participant LLM as LLM Provider
    participant DB as SQLite

    U->>API: POST /sessions (role/resume/topic, duration)
    API->>RAG: select_question(track, starting difficulty)
    RAG->>DB: weighted match on role/topic/skill/semantic similarity
    RAG-->>API: best-matching question
    API-->>U: session + first question

    Note over U: One-time calibration (4 corners + center)<br/>then continuous gaze monitoring begins

    loop Each question
        U->>API: POST /questions/{id}/answer (recorded audio)
        API->>STT: transcribe(audio)
        STT-->>API: transcript
        API->>LLM: analyze(transcript, key points, rubric)
        LLM-->>API: score, grammar/relevance feedback, rubric_score
        API->>API: difficulty_service adjusts next question's difficulty
        API-->>U: analysis result
        alt Follow-up warranted
            U->>API: POST /questions/{id}/follow-up
            API->>RAG: retrieve_related_context(topic)
            RAG-->>API: grounded related questions
            API->>LLM: generate specific follow-up
            API-->>U: follow-up question
        else Move on
            U->>API: POST /questions/{id}/next
            API->>RAG: select_question(exclude asked)
            RAG-->>API: next question
        end
    end

    U->>API: POST /sessions/{id}/complete (early exit or duration expired)
    API->>DB: mark session completed
    U->>API: GET /sessions/{id}/report
    API->>LLM: synthesize summary + action items
    API-->>U: readiness score, pass/fail, per-question breakdown, transcript, action items
```

### Frontend screen flow

```mermaid
stateDiagram-v2
    [*] --> Landing
    Landing --> Setup: Start
    Setup --> Calibration: role/topic + duration chosen, camera granted
    Calibration --> Interview: 5-point gaze mapping fitted
    Interview --> Interview: next question / follow-up
    Interview --> Dashboard: bank exhausted, duration expired,\nor "Complete interview" clicked
    Dashboard --> SessionDetail: select a past session
    SessionDetail --> Dashboard: back
    Dashboard --> [*]
```

The report screen is only reachable **after** a session is explicitly completed — nothing is shown mid-interview beyond the current question and live transcript, by design.

## Project Structure

```
Cognitive Interview AI/
├── backend/
│   ├── app/
│   │   ├── routers/v1/        # HTTP endpoints (sessions, answers, voice, monitoring, admin)
│   │   ├── services/          # interview orchestration, difficulty, analysis, reports
│   │   ├── rag/                # embeddings, Chroma vector store, retriever
│   │   ├── providers/          # llm / stt / tts adapters (swappable)
│   │   ├── repositories/       # SQL access layer
│   │   ├── models/              # SQLAlchemy models + taxonomy (Role/Topic/Skill/Concept)
│   │   ├── schemas/             # Pydantic contracts
│   │   └── core/                 # settings (.env-driven)
│   ├── data/question_bank/     # 900+ questions as versioned JSON files
│   ├── scripts/                 # seed_questions.py, build_index.py, smoke_test.py
│   ├── storage/                  # SQLite DB, Chroma index, recordings (gitignored)
│   └── requirements.txt
├── src/
│   ├── pages/                   # LandingPage, SetupScreen, CalibrationScreen,
│   │                             # InterviewScreen, Dashboard, SessionDetail
│   ├── hooks/                    # useMediaStream, useCalibration, useGazeMonitor, useRecorder
│   ├── components/               # layout, sections (landing page), ui (design system)
│   ├── lib/                       # api.js (backend client), gaze.js (MediaPipe logic)
│   └── data/content.js
├── public/
├── package.json
└── vite.config.js
```

## Getting Started

### Prerequisites

- **Node.js** v18+ (v20+ recommended)
- **Python** 3.11 (3.10–3.12 also work)
- **[Ollama](https://ollama.com)** — for the local LLM (no account needed)

### 1. Backend

```bash
cd backend
python -m venv .venv
.venv\Scripts\activate        # Windows — use `source .venv/bin/activate` on macOS/Linux
pip install -r requirements.txt
copy .env.example .env        # Windows — use `cp .env.example .env` on macOS/Linux
```

Pull the local LLM model (one-time):

```bash
ollama pull qwen2.5:3b-instruct
```

Seed the question bank and build the search index (one-time; safe to re-run):

```bash
python scripts/seed_questions.py
python scripts/build_index.py
```

Run the API:

```bash
uvicorn app.main:app --reload --port 8000
```

Interactive API docs at `http://localhost:8000/docs`.

### 2. Frontend

From the project root, in a separate terminal:

```bash
npm install
npm run dev
```

Open the URL Vite prints (usually `http://localhost:5173`).

Everything runs fully offline/local by default — SQLite for storage, `faster-whisper` for STT, Ollama for the LLM, and an OS-voice TTS fallback if no Google Cloud credentials are set. No API keys are required to boot the app.

## Configuration

All configuration lives in `backend/.env` (copied from `.env.example`). The key switch is `LLM_PROVIDER`:

```bash
# Local (default) — sized for 8GB RAM / entry-level GPU
LLM_PROVIDER=local
LLM_LOCAL_MODEL=qwen2.5:3b-instruct

# Cloud (optional) — any OpenAI-compatible endpoint
LLM_PROVIDER=cloud
LLM_CLOUD_API_KEY=sk-...
LLM_CLOUD_MODEL=gpt-4o-mini
```

Other tunables include `HINT_AFTER_SECONDS`, `AUTO_RECORD_AFTER_SECONDS`, `DIFFICULTY_MIN`/`MAX`, and `READINESS_PASS_THRESHOLD` — see `backend/.env.example` for the full list with comments.

## API Overview

| Endpoint | Purpose |
|---|---|
| `POST /api/v1/sessions` | Start a new interview session (role/resume/topic track, duration) |
| `GET /api/v1/sessions` | List all past sessions |
| `POST /api/v1/questions/{id}/answer` | Submit recorded audio for the current question (multipart) |
| `POST /api/v1/questions/{id}/follow-up` | Request a grounded, RAG-backed follow-up question |
| `POST /api/v1/questions/{id}/next` | Move to the next question, excluding those already asked |
| `POST /api/v1/sessions/{id}/complete` | End a session early (or on duration expiry) |
| `GET /api/v1/sessions/{id}/report` | Full report — readiness score, per-question breakdown, summary, action items |
| `POST /api/v1/monitoring/events` | Client-reported gaze/eye-contact events during the interview |
| `POST /api/v1/admin/questions/bulk-import` | Add new questions to the bank without a server restart |

See `backend/README.md` for the full request/response flow through each layer.

## Question Bank

The question bank is **centralized, not siloed per-role** — every question is tagged through a many-to-many relational schema (`Role` ↔ `Topic` ↔ `Skill` ↔ `Concept`), so adding a new role or technology never requires a new bank, just new tag associations.

- **900+ questions** across DSA, OOP, OS, CN, DBMS, System Design, languages (Java/Python/JS/TypeScript/C++), frontend/backend/DevOps/cloud, ML/statistics, security, testing, distributed systems, and behavioral/leadership.
- Each question carries: type, difficulty (1–5), tagged roles/topics/skills, a reference solution (key points + sample answer), a follow-up hint, evaluation criteria, and a scoring rubric.
- Retrieval uses a **weighted ranking function** combining semantic similarity (via Chroma) with role/topic/skill relevance and difficulty fit — with fuzzy tag matching, so entering "backend", "Backend Engineer", or "back-end" all resolve correctly.
- Answers are graded by the LLM against the question's own rubric, producing a genuine `rubric_score`, not just a generic pass/fail.
