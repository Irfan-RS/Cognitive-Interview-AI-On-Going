import { useState } from "react";
import {
  ArrowRight,
  Briefcase,
  Camera,
  FileText,
  Hash,
  Mic,
  ShieldCheck,
  Swords,
  Target,
  Timer,
} from "lucide-react";
import Button from "../components/ui/Button";

const DURATIONS = [5, 10, 30];

const MODES = [
  {
    key: "mock",
    label: "Mock interview",
    tagline: "No hints — simulates the real thing",
    icon: Swords,
    accent: "mock",
  },
  {
    key: "practice",
    label: "Practice interview",
    tagline: "Hint button after 15s of silence",
    icon: Target,
    accent: "practice",
  },
];

const TRACKS = [
  { key: "role", label: "Role-based", hint: "Questions for a target role", icon: Briefcase },
  { key: "resume", label: "Resume-based", hint: "Matched to your resume keywords", icon: FileText },
  { key: "topic", label: "Topic-based", hint: "Drill one topic directly", icon: Hash },
];

const modeStyles = {
  mock: {
    active: "border-mock-500/60 bg-mock-500/10 shadow-[0_0_28px_-8px_rgba(255,107,107,0.5)]",
    icon: "bg-mock-500/15 text-mock-500",
  },
  practice: {
    active: "border-practice-500/60 bg-practice-500/10 shadow-[0_0_28px_-8px_rgba(34,211,184,0.5)]",
    icon: "bg-practice-500/15 text-practice-500",
  },
};

export default function SetupScreen({ mediaStatus, mediaError, onRequestMedia, onBegin }) {
  const [mode, setMode] = useState("practice");
  const [track, setTrack] = useState("role");
  const [role, setRole] = useState("");
  const [topic, setTopic] = useState("");
  const [resumeKeywords, setResumeKeywords] = useState("");
  const [duration, setDuration] = useState(10);

  const trackFieldFilled =
    (track === "role" && role.trim()) ||
    (track === "resume" && resumeKeywords.trim()) ||
    (track === "topic" && topic.trim());

  const canBegin = mediaStatus === "granted" && trackFieldFilled;

  const handleBegin = () => {
    onBegin({
      mode,
      track,
      role: track === "role" ? role.trim() : null,
      topic: track === "topic" ? topic.trim() : null,
      resume_keywords:
        track === "resume"
          ? resumeKeywords
              .split(",")
              .map((k) => k.trim())
              .filter(Boolean)
          : [],
      duration_minutes: duration,
    });
  };

  return (
    <div className="relative mx-auto max-w-3xl px-6 py-14 sm:py-20">
      <div className="animate-rise-in">
        <span className="text-xs font-semibold uppercase tracking-[0.2em] text-brand-400">Session setup</span>
        <h1 className="mt-3 text-3xl font-semibold text-white text-balance sm:text-4xl">
          Let's get you talking.
        </h1>
        <p className="mt-2 text-mist-400">Pick a mode and a track, then grant camera &amp; mic access to begin.</p>
      </div>

      <div className="mt-10 grid gap-4 sm:grid-cols-2">
        {MODES.map((m, i) => {
          const Icon = m.icon;
          const active = mode === m.key;
          return (
            <button
              key={m.key}
              onClick={() => setMode(m.key)}
              style={{ animationDelay: `${i * 60}ms` }}
              className={`animate-rise-in group relative overflow-hidden rounded-2xl border p-5 text-left transition-all duration-200 ${
                active ? modeStyles[m.accent].active : "border-ink-600 bg-ink-800/50 hover:border-ink-500 hover:bg-ink-800"
              }`}
            >
              <div className="flex items-start justify-between">
                <span className={`flex h-10 w-10 items-center justify-center rounded-xl transition-colors ${active ? modeStyles[m.accent].icon : "bg-ink-700 text-mist-400"}`}>
                  <Icon size={18} strokeWidth={1.75} />
                </span>
                <span
                  className={`h-4 w-4 rounded-full border-2 transition-all ${
                    active ? `border-transparent ${m.accent === "mock" ? "bg-mock-500" : "bg-practice-500"}` : "border-ink-500"
                  }`}
                />
              </div>
              <p className="mt-4 font-semibold text-white">{m.label}</p>
              <p className="mt-1 text-sm text-mist-400">{m.tagline}</p>
            </button>
          );
        })}
      </div>

      <div className="animate-rise-in mt-10" style={{ animationDelay: "120ms" }}>
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-mist-400">Track</p>
        <div className="mt-3 grid gap-3 sm:grid-cols-3">
          {TRACKS.map((t) => {
            const Icon = t.icon;
            const active = track === t.key;
            return (
              <button
                key={t.key}
                onClick={() => setTrack(t.key)}
                className={`rounded-xl border p-4 text-left transition-all duration-200 ${
                  active
                    ? "border-brand-400/60 bg-brand-500/10 shadow-[0_0_24px_-10px_rgba(109,91,255,0.6)]"
                    : "border-ink-600 bg-ink-800/50 hover:border-ink-500"
                }`}
              >
                <Icon size={16} strokeWidth={1.75} className={active ? "text-brand-300" : "text-mist-400"} />
                <p className="mt-2 text-sm font-medium text-white">{t.label}</p>
                <p className="mt-0.5 text-xs text-mist-400">{t.hint}</p>
              </button>
            );
          })}
        </div>

        <div className="mt-4">
          {track === "role" && (
            <input
              value={role}
              onChange={(e) => setRole(e.target.value)}
              placeholder="e.g. Backend Engineer"
              className="w-full rounded-xl border border-ink-600 bg-ink-900/80 px-4 py-3 text-sm text-white placeholder:text-mist-500 transition-colors focus:border-brand-400 focus:outline-none focus:ring-4 focus:ring-brand-500/15"
            />
          )}
          {track === "topic" && (
            <input
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              placeholder="e.g. System Design"
              className="w-full rounded-xl border border-ink-600 bg-ink-900/80 px-4 py-3 text-sm text-white placeholder:text-mist-500 transition-colors focus:border-brand-400 focus:outline-none focus:ring-4 focus:ring-brand-500/15"
            />
          )}
          {track === "resume" && (
            <input
              value={resumeKeywords}
              onChange={(e) => setResumeKeywords(e.target.value)}
              placeholder="e.g. React, Kafka, led a team of 4"
              className="w-full rounded-xl border border-ink-600 bg-ink-900/80 px-4 py-3 text-sm text-white placeholder:text-mist-500 transition-colors focus:border-brand-400 focus:outline-none focus:ring-4 focus:ring-brand-500/15"
            />
          )}
        </div>
      </div>

      <div className="animate-rise-in mt-10" style={{ animationDelay: "150ms" }}>
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-mist-400">Duration</p>
        <div className="mt-3 grid grid-cols-3 gap-3">
          {DURATIONS.map((mins) => {
            const active = duration === mins;
            return (
              <button
                key={mins}
                onClick={() => setDuration(mins)}
                className={`flex items-center justify-center gap-2 rounded-xl border p-4 text-sm font-medium transition-all duration-200 ${
                  active
                    ? "border-brand-400/60 bg-brand-500/10 text-white shadow-[0_0_24px_-10px_rgba(109,91,255,0.6)]"
                    : "border-ink-600 bg-ink-800/50 text-mist-300 hover:border-ink-500"
                }`}
              >
                <Timer size={15} strokeWidth={1.75} className={active ? "text-brand-300" : "text-mist-500"} />
                {mins} min
              </button>
            );
          })}
        </div>
      </div>

      <div className="glass-panel animate-rise-in mt-10 p-5" style={{ animationDelay: "180ms" }}>
        <div className="flex items-start gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-500/15 text-brand-300">
            <ShieldCheck size={18} strokeWidth={1.75} />
          </span>
          <div className="flex-1">
            <p className="font-medium text-white">Camera &amp; microphone access</p>
            <p className="mt-1 text-sm text-mist-400">
              Needed for spoken answers and eye-contact monitoring. Nothing is sent anywhere except this session's
              backend.
            </p>
            {mediaError && <p className="mt-2 text-sm text-mock-500">{mediaError}</p>}
          </div>
          {mediaStatus === "granted" ? (
            <span className="flex shrink-0 items-center gap-1.5 rounded-full bg-practice-500/15 px-3 py-1.5 text-xs font-medium text-practice-500">
              <Camera size={14} />
              <Mic size={14} />
              Granted
            </span>
          ) : (
            <Button variant="ghost" onClick={onRequestMedia} disabled={mediaStatus === "requesting"}>
              {mediaStatus === "requesting" ? "Requesting…" : "Grant access"}
            </Button>
          )}
        </div>
      </div>

      <div className="animate-rise-in mt-8 flex justify-end" style={{ animationDelay: "220ms" }}>
        <Button variant="primary" disabled={!canBegin} onClick={handleBegin}>
          Continue to calibration
          <ArrowRight size={16} />
        </Button>
      </div>
    </div>
  );
}
