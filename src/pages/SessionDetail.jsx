import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Circle,
  Eye,
  Gauge,
  ListChecks,
  MessageCircleQuestion,
  Target,
  XCircle,
} from "lucide-react";
import Card from "../components/ui/Card";
import { api } from "../lib/api";

const TABS = [
  { key: "summary", label: "Summary", icon: Gauge },
  { key: "questions", label: "Question-wise feedback", icon: MessageCircleQuestion },
  { key: "actions", label: "Action items", icon: ListChecks },
];

function ReadinessRing({ value, passed }) {
  const radius = 46;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference * (1 - value / 100);
  const color = passed ? "var(--color-practice-500)" : value >= 40 ? "var(--color-amber-400)" : "var(--color-mock-500)";

  return (
    <div className="relative flex h-32 w-32 shrink-0 items-center justify-center">
      <svg viewBox="0 0 100 100" className="h-full w-full -rotate-90">
        <circle cx="50" cy="50" r={radius} fill="none" stroke="var(--color-ink-600)" strokeWidth="8" />
        <circle
          cx="50"
          cy="50"
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth="8"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          style={{ transition: "stroke-dashoffset 0.8s cubic-bezier(0.16,1,0.3,1)" }}
        />
      </svg>
      <div className="absolute flex flex-col items-center">
        <span className="text-2xl font-semibold text-white">{value}%</span>
        <span className="text-[10px] uppercase tracking-wide text-mist-500">Readiness</span>
      </div>
    </div>
  );
}

function StatTile({ icon: Icon, label, value, suffix = "", tone }) {
  return (
    <div className={`rounded-xl border p-4 text-center ${tone.bg}`}>
      <Icon size={16} strokeWidth={1.75} className={`mx-auto ${tone.text}`} />
      <p className={`mt-2 text-xl font-semibold ${tone.text}`}>
        {value}
        {suffix}
      </p>
      <p className="mt-0.5 text-xs text-mist-400">{label}</p>
    </div>
  );
}

function QuestionFeedback({ report }) {
  const [index, setIndex] = useState(0);
  const turn = report.turns[index];
  const a = turn?.answer;

  return (
    <div className="flex flex-col gap-4">
      <div className="glass-panel flex items-center justify-between p-3">
        <button
          onClick={() => setIndex((i) => Math.max(0, i - 1))}
          disabled={index === 0}
          className="flex items-center gap-1 rounded-full px-3 py-1.5 text-sm text-mist-300 transition-colors hover:text-white disabled:opacity-30"
        >
          <ChevronLeft size={16} />
          Prev
        </button>
        <span className="text-sm font-medium text-white">
          Question {index + 1} of {report.turns.length}
        </span>
        <button
          onClick={() => setIndex((i) => Math.min(report.turns.length - 1, i + 1))}
          disabled={index === report.turns.length - 1}
          className="flex items-center gap-1 rounded-full px-3 py-1.5 text-sm text-mist-300 transition-colors hover:text-white disabled:opacity-30"
        >
          Next
          <ChevronRight size={16} />
        </button>
      </div>

      <Card className="animate-rise-in">
        <div className="flex items-center justify-between text-xs text-mist-400">
          <span>
            difficulty {turn.difficulty_at_ask}/5{turn.is_follow_up && " · follow-up"}
          </span>
          {a && (
            <span
              className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${
                a.relevance_score >= 75
                  ? "bg-practice-500/15 text-practice-500"
                  : a.relevance_score >= 40
                    ? "bg-amber-400/15 text-amber-400"
                    : "bg-mock-500/15 text-mock-500"
              }`}
            >
              {a.relevance_score}% on-topic
            </span>
          )}
        </div>
        <p className="mt-2 text-lg font-medium text-white text-balance">{turn.question_text}</p>

        {!a ? (
          <p className="mt-3 text-sm italic text-mist-500">No answer submitted.</p>
        ) : (
          <>
            <p className="mt-3 rounded-lg border border-ink-700 bg-ink-900/60 px-3 py-2 text-sm text-mist-300">
              {a.transcript || <span className="italic text-mist-500">No speech detected.</span>}
            </p>

            {turn.has_recording && (
              <audio controls src={api.recordingUrl(turn.session_question_id)} className="mt-3 w-full" />
            )}

            <div className="mt-4 rounded-lg border border-brand-500/20 bg-brand-500/10 py-2 text-center">
              <p className="text-lg font-semibold text-brand-300">{a.overall_score}/100</p>
              <p className="text-xs text-mist-400">Overall score</p>
            </div>

            <div className="mt-2 grid grid-cols-2 gap-2 text-center text-xs sm:grid-cols-4">
              <div className="rounded-lg border border-amber-400/20 bg-amber-400/10 py-2">
                <p className="text-amber-400 font-semibold">{a.category_scores.technical}%</p>
                <p className="text-mist-400">Technical</p>
              </div>
              <div className="rounded-lg border border-glow-400/20 bg-glow-400/10 py-2">
                <p className="text-glow-400 font-semibold">{a.category_scores.cognitive}%</p>
                <p className="text-mist-400">Cognitive</p>
              </div>
              <div className="rounded-lg border border-practice-500/20 bg-practice-500/10 py-2">
                <p className="font-semibold text-practice-500">{a.category_scores.communication}%</p>
                <p className="text-mist-400">Communication</p>
              </div>
              <div className="rounded-lg border border-brand-500/20 bg-brand-500/10 py-2">
                <p className="font-semibold text-brand-300">{a.category_scores.adaptability}%</p>
                <p className="text-mist-400">Adaptability</p>
              </div>
            </div>

            <p className="mt-2 flex items-center gap-1.5 text-xs text-mist-500">
              <Eye size={12} />
              Eye contact (not part of the score) · {Math.round(a.eye_contact_ratio * 100)}% on screen · relevance {a.relevance_score}%
            </p>

            {a.grammar_issues?.length > 0 && (
              <p className="mt-3 text-xs text-mist-400">
                <span className="font-medium text-mist-300">Grammar:</span> {a.grammar_issues.join("; ")}
              </p>
            )}
            {Object.keys(a.filler_words || {}).length > 0 && (
              <p className="mt-1 text-xs text-mist-400">
                <span className="font-medium text-mist-300">Fluency:</span>{" "}
                {Object.entries(a.filler_words).map(([w, c]) => `"${w}" ×${c}`).join(", ")}
                {a.pause_count > 0 && ` · ${a.pause_count} pauses`}
              </p>
            )}

            {(a.covered_key_points?.length > 0 || a.missed_key_points?.length > 0) && (
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                {a.covered_key_points?.length > 0 && (
                  <div className="rounded-lg border border-practice-500/20 bg-practice-500/5 p-2.5">
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-practice-500">Covered</p>
                    <ul className="mt-1 list-inside list-disc text-xs text-mist-300">
                      {a.covered_key_points.map((kp, k) => (
                        <li key={k}>{kp}</li>
                      ))}
                    </ul>
                  </div>
                )}
                {a.missed_key_points?.length > 0 && (
                  <div className="rounded-lg border border-mock-500/20 bg-mock-500/5 p-2.5">
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-mock-500">Missed</p>
                    <ul className="mt-1 list-inside list-disc text-xs text-mist-300">
                      {a.missed_key_points.map((kp, k) => (
                        <li key={k}>{kp}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}

            {a.llm_model_solution && (
              <p className="mt-4 rounded-lg border border-ink-600 bg-ink-900 px-3 py-2 text-xs text-mist-300">
                <span className="font-semibold text-mist-100">Model solution: </span>
                {a.llm_model_solution}
              </p>
            )}
          </>
        )}
      </Card>
    </div>
  );
}

function ActionItems({ items }) {
  const [checked, setChecked] = useState(() => new Set());

  const toggle = (i) => {
    setChecked((prev) => {
      const next = new Set(prev);
      if (next.has(i)) next.delete(i);
      else next.add(i);
      return next;
    });
  };

  if (!items || items.length === 0) {
    return (
      <Card className="py-10 text-center text-sm text-mist-400">
        No action items — either everything went well, or no questions were answered yet.
      </Card>
    );
  }

  return (
    <Card>
      <p className="text-xs font-semibold uppercase tracking-wide text-mist-400">
        Tailored steps to improve your next interview
      </p>
      <ul className="mt-4 flex flex-col divide-y divide-ink-700">
        {items.map((item, i) => (
          <li key={i} className="flex items-start gap-3 py-3">
            <button onClick={() => toggle(i)} className="mt-0.5 shrink-0 text-brand-400 transition-colors hover:text-brand-300">
              {checked.has(i) ? <CheckCircle2 size={18} /> : <Circle size={18} />}
            </button>
            <p className={`text-sm ${checked.has(i) ? "text-mist-500 line-through" : "text-mist-200"}`}>{item}</p>
          </li>
        ))}
      </ul>
    </Card>
  );
}

export default function SessionDetail() {
  const { sessionId } = useParams();
  const [report, setReport] = useState(null);
  const [error, setError] = useState(null);
  const [tab, setTab] = useState("summary");

  useEffect(() => {
    api
      .getReport(sessionId)
      .then(setReport)
      .catch((err) => setError(err.message));
  }, [sessionId]);

  return (
    <div className="relative min-h-screen bg-ink-950">
      <div className="ambient-glow" />

      <div className="sticky top-0 z-40 border-b border-ink-700/80 bg-ink-950/80 px-4 py-3 backdrop-blur-xl sm:px-6">
        <Link to="/dashboard" className="flex items-center gap-1.5 text-sm text-mist-400 transition-colors hover:text-white">
          <ArrowLeft size={16} />
          Back to dashboard
        </Link>
      </div>

      <div className="mx-auto max-w-4xl px-6 py-10 sm:py-14">
        {error && (
          <div className="animate-rise-in rounded-xl border border-mock-500/40 bg-mock-500/10 px-4 py-3 text-sm text-mock-500">
            {error}
          </div>
        )}

        {!report && !error && <p className="text-sm text-mist-400">Loading report…</p>}

        {report && (
          <>
            <div className="glass-panel animate-rise-in flex flex-col items-center gap-6 p-6 text-center sm:flex-row sm:text-left">
              <ReadinessRing value={report.readiness_score} passed={report.passed} />
              <div className="flex-1">
                <div className="flex flex-wrap items-center justify-center gap-2 sm:justify-start">
                  <span
                    className={`flex items-center gap-1 rounded-full px-3 py-1 text-xs font-semibold ${
                      report.passed ? "bg-practice-500/15 text-practice-500" : "bg-mock-500/15 text-mock-500"
                    }`}
                  >
                    {report.passed ? <CheckCircle2 size={13} /> : <XCircle size={13} />}
                    {report.passed ? "Ready" : "Needs work"}
                  </span>
                  <span className="rounded-full border border-ink-500 px-3 py-1 text-xs capitalize text-mist-300">
                    {report.mode}
                  </span>
                  <span className="rounded-full border border-ink-500 px-3 py-1 text-xs capitalize text-mist-300">
                    {report.track}
                    {report.role && ` — ${report.role}`}
                    {report.topic && ` — ${report.topic}`}
                  </span>
                </div>
                <h1 className="mt-3 text-2xl font-semibold text-white text-balance">
                  {report.turns.length} question{report.turns.length === 1 ? "" : "s"} answered
                </h1>
                {report.summary && <p className="mt-2 text-sm text-mist-300 text-balance">{report.summary}</p>}
              </div>
            </div>

            <div className="animate-rise-in mt-6 flex gap-1 overflow-x-auto rounded-full border border-ink-700 bg-ink-900/60 p-1">
              {TABS.map((t) => {
                const Icon = t.icon;
                const active = tab === t.key;
                return (
                  <button
                    key={t.key}
                    onClick={() => setTab(t.key)}
                    className={`flex shrink-0 items-center gap-1.5 rounded-full px-4 py-2 text-sm font-medium transition-colors ${
                      active ? "bg-brand-500 text-white" : "text-mist-400 hover:text-white"
                    }`}
                  >
                    <Icon size={14} />
                    {t.label}
                  </button>
                );
              })}
            </div>

            <div className="mt-6">
              {tab === "summary" && (
                <div className="flex flex-col gap-6">
                  <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                    <StatTile
                      icon={Target}
                      label="Technical"
                      value={report.technical_pct}
                      suffix="%"
                      tone={{ bg: "border-amber-400/20 bg-amber-400/10", text: "text-amber-400" }}
                    />
                    <StatTile
                      icon={Gauge}
                      label="Cognitive"
                      value={report.cognitive_pct}
                      suffix="%"
                      tone={{ bg: "border-glow-400/20 bg-glow-400/10", text: "text-glow-400" }}
                    />
                    <StatTile
                      icon={MessageCircleQuestion}
                      label="Communication"
                      value={report.communication_pct}
                      suffix="%"
                      tone={{ bg: "border-practice-500/20 bg-practice-500/10", text: "text-practice-500" }}
                    />
                    <StatTile
                      icon={ListChecks}
                      label="Adaptability"
                      value={report.adaptability_pct}
                      suffix="%"
                      tone={{ bg: "border-brand-500/20 bg-brand-500/10", text: "text-brand-300" }}
                    />
                  </div>

                  <Card className="border-dashed">
                    <p className="text-xs font-semibold uppercase tracking-wide text-mist-400">
                      Proctoring — observational only, not part of the score
                    </p>
                    <div className="mt-3 flex items-center gap-6 text-sm text-mist-300">
                      <span className="flex items-center gap-1.5">
                        <Eye size={14} className="text-mist-500" />
                        {report.proctoring.eye_contact_ratio}% on screen
                      </span>
                      <span>
                        Looked away{" "}
                        <span className="font-semibold text-mist-100">{report.proctoring.look_away_count}</span>{" "}
                        time{report.proctoring.look_away_count === 1 ? "" : "s"}
                      </span>
                    </div>
                  </Card>

                  <Card>
                    <p className="text-xs font-semibold uppercase tracking-wide text-mist-400">All questions</p>
                    <ul className="mt-3 flex flex-col divide-y divide-ink-700">
                      {report.turns.map((turn, i) => (
                        <li key={turn.session_question_id} className="flex items-center justify-between gap-3 py-3">
                          <span className="flex items-center gap-3 text-sm text-mist-200">
                            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-ink-600 text-xs text-mist-400">
                              {i + 1}
                            </span>
                            <span className="text-balance">{turn.question_text}</span>
                          </span>
                          {turn.answer ? (
                            <span className="shrink-0 text-xs font-medium text-brand-300">
                              {turn.answer.relevance_score}%
                            </span>
                          ) : (
                            <span className="shrink-0 text-xs italic text-mist-500">skipped</span>
                          )}
                        </li>
                      ))}
                    </ul>
                    <button
                      onClick={() => setTab("questions")}
                      className="mt-3 flex items-center gap-1 text-sm font-medium text-brand-300 hover:text-brand-200"
                    >
                      View full feedback per question
                      <ArrowRight size={14} />
                    </button>
                  </Card>
                </div>
              )}

              {tab === "questions" && <QuestionFeedback report={report} />}
              {tab === "actions" && <ActionItems items={report.action_items} />}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
