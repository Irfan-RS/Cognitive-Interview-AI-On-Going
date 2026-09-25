import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  ArrowRight,
  CalendarClock,
  CheckCircle2,
  ListChecks,
  Loader2,
  Plus,
  Sparkles,
  Swords,
  Target,
  TrendingDown,
  TrendingUp,
  Trash2,
  Trophy,
} from "lucide-react";
import Card from "../components/ui/Card";
import Button from "../components/ui/Button";
import { api } from "../lib/api";

function formatDate(iso) {
  return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

const STATUS_STYLES = {
  completed: { label: "Completed", cls: "bg-practice-500/15 text-practice-500" },
  ended_early: { label: "Ended early", cls: "bg-amber-400/15 text-amber-400" },
  active: { label: "In progress", cls: "bg-brand-400/15 text-brand-300" },
};

function StatusBadge({ status }) {
  const s = STATUS_STYLES[status] || STATUS_STYLES.active;
  return <span className={`rounded-full px-2.5 py-1 text-[11px] font-medium ${s.cls}`}>{s.label}</span>;
}

// Same category ↔ color mapping used on the report screen (SessionDetail.jsx),
// so a category always reads the same color everywhere in the app.
const CATEGORY_META = [
  { key: "technical_pct", label: "Technical", text: "text-amber-400", bar: "bg-amber-400" },
  { key: "cognitive_pct", label: "Cognitive", text: "text-glow-400", bar: "bg-glow-400" },
  { key: "communication_pct", label: "Communication", text: "text-practice-500", bar: "bg-practice-500" },
  { key: "adaptability_pct", label: "Adaptability", text: "text-brand-300", bar: "bg-brand-400" },
];

function avg(values) {
  return values.length ? values.reduce((a, b) => a + b, 0) / values.length : null;
}

function OverviewCard({ icon: Icon, label, value, tone }) {
  return (
    <Card className="animate-rise-in flex items-center gap-3 p-4">
      <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${tone}`}>
        <Icon size={17} strokeWidth={1.75} />
      </span>
      <div className="min-w-0">
        <p className="truncate text-xl font-semibold text-white">{value}</p>
        <p className="text-xs text-mist-400">{label}</p>
      </div>
    </Card>
  );
}

// Plain SVG sparkline — a single real series, so no legend/library is needed
// (matches the hand-rolled ReadinessRing chart already used on the report page).
function ScoreTrend({ points }) {
  if (points.length < 2) {
    return <p className="text-sm text-mist-400">Complete at least two scored interviews to see a trend.</p>;
  }

  const width = 100;
  const height = 40;
  const padY = 4;
  const stepX = width / (points.length - 1);
  const coords = points.map((p, i) => [i * stepX, height - padY - (p.score / 100) * (height - padY * 2)]);
  const path = coords.map(([x, y], i) => `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`).join(" ");

  return (
    <div>
      <svg viewBox={`0 0 ${width} ${height}`} className="h-24 w-full" preserveAspectRatio="none">
        <line x1="0" y1={height - padY} x2={width} y2={height - padY} stroke="var(--color-ink-600)" strokeWidth="0.5" />
        <path
          d={path}
          fill="none"
          stroke="var(--color-brand-400)"
          strokeWidth="1.5"
          vectorEffect="non-scaling-stroke"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        {coords.map(([x, y], i) => (
          <circle key={i} cx={x} cy={y} r="1.6" fill="var(--color-brand-300)" />
        ))}
      </svg>
      <div className="mt-1 flex justify-between text-[10px] text-mist-500">
        <span>{points[0].label}</span>
        <span>{points[points.length - 1].label}</span>
      </div>
    </div>
  );
}

function AnalyticsSection({ sessions }) {
  const analytics = useMemo(() => {
    const scored = sessions.filter((s) => s.average_overall_score != null);
    const chronological = [...scored].sort((a, b) => new Date(a.created_at) - new Date(b.created_at));

    const categoryAverages = CATEGORY_META.map((c) => ({
      ...c,
      value: avg(scored.map((s) => s[c.key]).filter((v) => v != null)),
    }));

    let trendDelta = null;
    if (chronological.length >= 4) {
      const mid = Math.floor(chronological.length / 2);
      const firstHalf = avg(chronological.slice(0, mid).map((s) => s.average_overall_score));
      const secondHalf = avg(chronological.slice(mid).map((s) => s.average_overall_score));
      trendDelta = Math.round(secondHalf - firstHalf);
    } else if (chronological.length >= 2) {
      trendDelta = Math.round(
        chronological[chronological.length - 1].average_overall_score - chronological[0].average_overall_score
      );
    }

    return {
      total: sessions.length,
      completed: sessions.filter((s) => s.status === "completed").length,
      questionsAnswered: sessions.reduce((sum, s) => sum + (s.answered_count || 0), 0),
      averageScore: avg(scored.map((s) => s.average_overall_score)),
      categoryAverages,
      hasCategoryData: categoryAverages.some((c) => c.value != null),
      trendDelta,
      trendPoints: chronological.map((s) => ({ label: formatDate(s.created_at), score: s.average_overall_score })),
    };
  }, [sessions]);

  return (
    <div className="animate-rise-in mt-8 flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <OverviewCard icon={ListChecks} label="Interviews" value={analytics.total} tone="bg-brand-500/15 text-brand-300" />
        <OverviewCard icon={CheckCircle2} label="Completed" value={analytics.completed} tone="bg-practice-500/15 text-practice-500" />
        <OverviewCard
          icon={Trophy}
          label="Average score"
          value={analytics.averageScore != null ? Math.round(analytics.averageScore) : "—"}
          tone="bg-amber-400/15 text-amber-400"
        />
        <OverviewCard icon={Sparkles} label="Questions answered" value={analytics.questionsAnswered} tone="bg-glow-400/15 text-glow-400" />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Card>
          <p className="text-xs font-semibold uppercase tracking-wide text-mist-400">Score trend</p>
          <div className="mt-2 flex items-center gap-2">
            {analytics.trendDelta != null ? (
              <span
                className={`flex items-center gap-1 text-sm font-semibold ${
                  analytics.trendDelta >= 0 ? "text-practice-500" : "text-mock-500"
                }`}
              >
                {analytics.trendDelta >= 0 ? <TrendingUp size={15} /> : <TrendingDown size={15} />}
                {analytics.trendDelta >= 0 ? "+" : ""}
                {analytics.trendDelta} pts
              </span>
            ) : (
              <span className="text-xs text-mist-400">Not enough scored interviews yet</span>
            )}
          </div>
          <div className="mt-3">
            <ScoreTrend points={analytics.trendPoints} />
          </div>
        </Card>

        <Card>
          <p className="text-xs font-semibold uppercase tracking-wide text-mist-400">Category breakdown</p>
          {analytics.hasCategoryData ? (
            <div className="mt-4 flex flex-col gap-3">
              {analytics.categoryAverages.map((c) => (
                <div key={c.key}>
                  <div className="flex items-center justify-between text-xs">
                    <span className={`font-medium ${c.text}`}>{c.label}</span>
                    <span className="text-mist-400">{c.value != null ? `${Math.round(c.value)}%` : "—"}</span>
                  </div>
                  <div className="mt-1 h-2 w-full overflow-hidden rounded-full bg-ink-700">
                    <div
                      className={`h-full rounded-full ${c.bar}`}
                      style={{ width: `${c.value != null ? Math.round(c.value) : 0}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="mt-3 text-sm text-mist-400">Answer some questions in an interview to see category scores here.</p>
          )}
        </Card>
      </div>
    </div>
  );
}

export default function Dashboard() {
  const [sessions, setSessions] = useState(null);
  const [error, setError] = useState(null);
  const [confirmingId, setConfirmingId] = useState(null);
  const [deletingId, setDeletingId] = useState(null);

  useEffect(() => {
    api
      .listSessions()
      .then(setSessions)
      .catch((err) => setError(err.message));
  }, []);

  // The row is a <Link>, so every control inside it has to stop the click from
  // navigating to the report before it can do its own job.
  const swallowClick = (e) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDelete = async (e, sessionId) => {
    swallowClick(e);
    setDeletingId(sessionId);
    setError(null);
    try {
      await api.deleteSession(sessionId);
      setSessions((prev) => prev.filter((s) => s.id !== sessionId));
      setConfirmingId(null);
    } catch (err) {
      setError(`Couldn't delete that session — ${err.message}`);
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="relative min-h-screen bg-ink-950">
      <div className="ambient-glow" />

      <div className="sticky top-0 z-40 flex items-center justify-between border-b border-ink-700/80 bg-ink-950/80 px-4 py-3 backdrop-blur-xl sm:px-6">
        <Link to="/" className="flex items-center gap-2.5 text-sm font-semibold text-white">
          <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-br from-brand-500 to-glow-400 shadow-[0_0_16px_-2px_rgba(109,91,255,0.7)]">
            <ListChecks size={14} strokeWidth={2.25} />
          </span>
          Cognitive Interview AI
        </Link>
        <Link to="/app">
          <Button variant="primary">
            <Plus size={16} />
            New interview
          </Button>
        </Link>
      </div>

      <div className="mx-auto max-w-5xl px-6 py-14 sm:py-16">
        <div className="animate-rise-in">
          <span className="text-xs font-semibold uppercase tracking-[0.2em] text-brand-400">Dashboard</span>
          <h1 className="mt-3 text-3xl font-semibold text-white text-balance sm:text-4xl">Your interviews</h1>
          <p className="mt-2 text-mist-400">Every session you've run, with full analytics one click away.</p>
        </div>

        {error && (
          <div className="animate-rise-in mt-8 rounded-xl border border-mock-500/40 bg-mock-500/10 px-4 py-3 text-sm text-mock-500">
            {error}
          </div>
        )}

        {!sessions && !error && <p className="mt-10 text-sm text-mist-400">Loading…</p>}

        {sessions && sessions.length === 0 && (
          <Card className="animate-rise-in mt-8 flex flex-col items-center gap-4 py-14 text-center">
            <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-500/15 text-brand-300">
              <Target size={26} strokeWidth={1.75} />
            </span>
            <div>
              <p className="font-semibold text-white">No interviews yet</p>
              <p className="mt-1 text-sm text-mist-400">Start your first session to see it show up here.</p>
            </div>
            <Link to="/app">
              <Button variant="primary">
                <Plus size={16} />
                Start an interview
              </Button>
            </Link>
          </Card>
        )}

        {sessions && sessions.length > 0 && <AnalyticsSection sessions={sessions} />}

        {sessions && sessions.length > 0 && (
          <div className="mt-10 flex flex-col gap-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-mist-400">Recent interviews</p>
            {sessions.map((s, i) => (
              <Link key={s.id} to={`/dashboard/${s.id}`} style={{ animationDelay: `${i * 40}ms` }}>
                <Card className="animate-rise-in flex flex-wrap items-center justify-between gap-4 transition-transform duration-300 hover:-translate-y-0.5">
                  <div className="flex items-center gap-4">
                    <span
                      className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-gradient-to-br ${
                        s.mode === "mock" ? "from-mock-500/25 to-transparent text-mock-500" : "from-practice-500/25 to-transparent text-practice-500"
                      }`}
                    >
                      <Swords size={18} strokeWidth={1.75} />
                    </span>
                    <div>
                      <p className="font-medium text-white">
                        <span className="capitalize">{s.mode}</span> · <span className="capitalize">{s.track}</span>
                        {s.role && ` — ${s.role}`}
                        {s.topic && ` — ${s.topic}`}
                      </p>
                      <p className="mt-0.5 flex items-center gap-1.5 text-xs text-mist-400">
                        <CalendarClock size={12} />
                        {formatDate(s.created_at)} · {s.answered_count} of {s.question_count} question
                        {s.question_count === 1 ? "" : "s"} answered
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    {confirmingId === s.id ? (
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-mist-400">Delete permanently?</span>
                        <button
                          onClick={(e) => handleDelete(e, s.id)}
                          disabled={deletingId === s.id}
                          className="flex items-center gap-1.5 rounded-full bg-mock-500 px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-mock-500/85 disabled:opacity-60"
                        >
                          {deletingId === s.id ? <Loader2 size={13} className="animate-spin" /> : <Trash2 size={13} />}
                          {deletingId === s.id ? "Deleting…" : "Delete"}
                        </button>
                        <button
                          onClick={(e) => {
                            swallowClick(e);
                            setConfirmingId(null);
                          }}
                          className="rounded-full border border-ink-600 px-3 py-1.5 text-xs font-medium text-mist-300 transition-colors hover:text-white"
                        >
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <>
                        <StatusBadge status={s.status} />
                        {s.average_overall_score != null && (
                          <span className="text-sm font-semibold text-brand-300">{s.average_overall_score}/100</span>
                        )}
                        <button
                          onClick={(e) => {
                            swallowClick(e);
                            setConfirmingId(s.id);
                          }}
                          aria-label="Delete this interview"
                          title="Delete this interview"
                          className="rounded-lg p-1.5 text-mist-500 transition-colors hover:bg-mock-500/10 hover:text-mock-500"
                        >
                          <Trash2 size={15} />
                        </button>
                        <ArrowRight size={16} className="text-mist-500" />
                      </>
                    )}
                  </div>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
