// Central content module for the landing page.
// Section components read from here so copy changes never touch layout/markup.

export const nav = [
  { label: "How it works", href: "#how-it-works" },
  { label: "Modes", href: "#modes" },
  { label: "Live monitoring", href: "#monitoring" },
  { label: "Answer intelligence", href: "#intelligence" },
  { label: "Architecture", href: "#architecture" },
];

export const hero = {
  eyebrow: "AI interview coach",
  title: "Practice speaking. Build confidence. Walk in ready.",
  subtitle:
    "Cognitive Interview AI runs full voice-driven mock and practice interviews, watches your eye contact and delivery in real time, and coaches you question by question — so confidence is built through repetition, not luck.",
  primaryCta: "Start a practice interview",
  secondaryCta: "See how it works",
};

export const problem = {
  heading: "Interview nerves aren't a knowledge problem — they're a repetition problem.",
  body:
    "Most candidates know the material. What they lack is a low-stakes place to say it out loud, under a bit of pressure, and get told exactly where it broke down — the filler words, the eye contact, the answer that drifted from the question.",
  points: [
    {
      title: "No safe place to fail out loud",
      body: "Mock interviews with a friend feel awkward; real interviews are too high-stakes to practice in.",
    },
    {
      title: "Feedback is vague or missing",
      body: "\"You did fine\" doesn't tell you that you rambled, avoided eye contact, or never answered the actual question.",
    },
    {
      title: "Practice doesn't adapt",
      body: "Static question lists don't get harder when you're doing well or ease up when you're struggling.",
    },
  ],
};

export const howItWorks = {
  heading: "How a session works",
  subheading: "One continuous voice-driven loop — from camera calibration to the follow-up question.",
  steps: [
    {
      title: "Grant camera & mic, calibrate",
      body: "Allow audio/video access, then look at four corner dots and one center dot so the app learns your screen bounds for eye-and-face tracking.",
    },
    {
      title: "Pick a mode and a track",
      body: "Choose Mock or Practice, then Role-based, Resume-based, or Topic-based questions.",
    },
    {
      title: "AI asks the question — by voice",
      body: "Questions are spoken aloud via text-to-speech, not just displayed as text.",
    },
    {
      title: "Record your answer, no typing",
      body: "Start recording manually, or it auto-starts 20s after the question if you haven't begun. Submit when done.",
    },
    {
      title: "Speech becomes text, instantly",
      body: "Your recording is transcribed and shown in a side panel so you can see exactly what was captured.",
    },
    {
      title: "AI analyzes and adapts",
      body: "Grammar, filler/pauses, relevance, and eye contact are scored; difficulty shifts up or down for the next question.",
    },
    {
      title: "Follow-up or next question",
      body: "You choose: dig deeper with a follow-up generated from your own answer, or move to an unrelated next question.",
    },
    {
      title: "Voice hand-off",
      body: "Say \"repeat\" and the AI repeats the question; say \"I don't understand\" and it rephrases — all spoken back to you.",
    },
  ],
};

export const modes = {
  heading: "Two modes, one engine",
  subheading: "Same voice pipeline and analysis underneath — different pressure and support levels.",
  cards: [
    {
      key: "mock",
      title: "Mock interview",
      tagline: "Simulates the real thing",
      description:
        "No hints, no safety net. Silence is just silence. Designed to rehearse composure under the same pressure as a real interview.",
      bullets: [
        "No hint button, ever",
        "Timing and difficulty ramp mirror a real panel",
        "Best used once you already know the material",
      ],
    },
    {
      key: "practice",
      title: "Practice interview",
      tagline: "Guided, forgiving, built for learning",
      description:
        "If you go quiet for more than 15 seconds, a Hint button lights up. Tap it and the AI gives you a nudge toward an answer — you stay in control of when to use it.",
      bullets: [
        "Hint appears after 15s of silence",
        "Explicit opt-in — hints never appear uninvited",
        "Best used while you're still building the answer",
      ],
    },
  ],
};

export const tracks = {
  heading: "Three ways to choose what you're asked",
  subheading: "Every question in the bank is admin-tagged so the right ones surface for the right session.",
  items: [
    {
      title: "Role-based",
      body: "Pick a target role (e.g. Backend Engineer, Product Analyst) and get questions tagged to that role.",
    },
    {
      title: "Resume-based",
      body: "Questions are matched against keywords pulled from your resume — your own projects and skills come back at you.",
    },
    {
      title: "Topic-based",
      body: "Drill one topic directly — System Design, SQL, Behavioral, or any topic tag an admin has defined.",
    },
  ],
};

export const monitoring = {
  heading: "Eye contact and face position, watched continuously",
  subheading:
    "A one-time calibration step teaches the app your screen, then a background process watches without interrupting your answer.",
  calibration: {
    title: "Calibration: 5 reference points",
    body: "Before the interview starts, you look at four corner dots and one center dot. That reference lets the app map your natural eye and face position to your actual monitor bounds — not a generic average face.",
  },
  runtime: {
    title: "Runtime: continuous gaze & face tracking",
    body: "While you answer, a background process keeps checking that your eyes and face stay within the calibrated screen area. Drift too far or too long, and a small on-screen nudge appears — \"Focus on the screen — maintain eye contact\" — without stopping your recording.",
  },
};

export const intelligence = {
  heading: "What happens to your answer after you hit submit",
  subheading: "A second background process analyzes the transcript across several dimensions in parallel.",
  items: [
    {
      title: "Grammar check",
      body: "Flags grammatical mistakes in the spoken answer, not just spelling.",
    },
    {
      title: "Fluency gaps",
      body: "Detects filler words, \"umm\"/\"ah\", and unnatural pauses that break up delivery.",
    },
    {
      title: "Relevance scoring",
      body: "Scores how directly the answer addresses what was actually asked, versus a generic response — expressed as a percentage.",
    },
    {
      title: "Adaptive difficulty",
      body: "Struggling answers ease the difficulty of the next question; strong answers raise it slightly.",
    },
    {
      title: "Generated follow-ups",
      body: "If you choose a follow-up, it's generated fresh from what you actually said — not a canned second question.",
    },
    {
      title: "Model solution, flexibly graded",
      body: "An LLM-authored reference answer exists per question, but any phrasing that covers the same key points counts as correct.",
    },
  ],
  storedPerQuestion: {
    title: "Stored per question, every time",
    body: "Recording, transcript, eye/face-contact log, confidence score, grammar mistakes, relevance %, and the LLM's model solution are all saved — so a session becomes a reviewable report, not a one-off.",
  },
};

export const voicePipeline = {
  heading: "A conversation, not a form",
  subheading: "The interviewer speaks, listens, and responds — you never type an answer.",
  flow: [
    { label: "AI asks", detail: "Question spoken aloud via text-to-speech." },
    { label: "You respond", detail: "\"Repeat that\" → question is repeated. \"I don't understand\" → question is rephrased." },
    { label: "You record", detail: "Start manually, or recording auto-starts after 20s of silence." },
    { label: "You submit", detail: "One tap sends audio to the backend for transcription and analysis." },
    { label: "AI replies", detail: "Follow-up or next question, spoken back to you, difficulty already adjusted." },
  ],
};

export const questionBank = {
  heading: "The question bank is admin-curated, not crowdsourced",
  body: "Every question carries metadata an admin sets up front, so the matching engine has something real to work with.",
  tags: [
    { label: "Applicable roles", example: "e.g. Backend Engineer, Data Analyst" },
    { label: "Topics", example: "e.g. System Design, SQL, Behavioral" },
    { label: "Resume keywords", example: "e.g. \"Kafka\", \"React\", \"led a team of 4\"" },
    { label: "Reference solution", example: "Key points required, not a fixed script — multiple valid phrasings pass" },
  ],
};

export const architecture = {
  heading: "Layered, not monolithic — on purpose",
  subheading:
    "Frontend and backend are both split into clear layers so the voice pipeline, the vision pipeline, and the LLM pipeline can change independently.",
  frontend: {
    title: "Frontend — React + Tailwind CSS",
    layers: [
      { name: "Layout", body: "Shell, navigation, page structure." },
      { name: "Sections", body: "One component per page section, each reading from a shared content layer." },
      { name: "UI primitives", body: "Small reusable building blocks — cards, badges, buttons." },
      { name: "Hooks & lib", body: "Camera/mic access, calibration math, recording state — kept out of components." },
    ],
  },
  backend: {
    title: "Backend — FastAPI",
    layers: [
      { name: "Routers", body: "Thin HTTP layer: interview sessions, questions, recordings, reports." },
      { name: "Services", body: "Interview flow, difficulty adaptation, follow-up generation, scoring orchestration." },
      { name: "Providers", body: "Swappable STT / TTS / LLM adapters — local or cloud behind one interface." },
      { name: "Data access", body: "Question bank, sessions, and per-answer analysis records." },
    ],
  },
};

export const deployment = {
  heading: "Local LLM or cloud API — your call",
  subheading:
    "The provider layer is swappable, so the same interview flow runs on whichever model you point it at.",
  options: [
    {
      title: "Local model",
      body: "Runs entirely on your machine — no per-call cost, no data leaving the device. Best suited to a small, quantized model given typical consumer hardware (e.g. an 8GB-RAM, single mid-range GPU laptop).",
    },
    {
      title: "Cloud model API",
      body: "Point the same provider interface at a hosted LLM when you want more headroom than local hardware can give — no code changes in the interview flow itself.",
    },
  ],
  voice: {
    title: "Voice via Google Cloud Text-to-Speech (free tier)",
    body: "Questions, repeats, rephrasings, and follow-ups are all spoken using the Google Cloud TTS free tier to start.",
  },
  access: {
    title: "No login required — for now",
    body: "The MVP has no authentication; anyone can start a session directly. Accounts can be layered in later without touching the interview flow.",
  },
};

export const finalCta = {
  heading: "Ready to hear how you actually sound?",
  body: "Grant camera and mic access, pick mock or practice, and start talking.",
  primaryCta: "Start a practice interview",
};
