import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, CalendarClock, ListChecks, Loader2, Plus, Swords, Target, Trash2 } from "lucide-react";
import Card from "../components/ui/Card";
import Button from "../components/ui/Button";
import { api } from "../lib/api";

function formatDate(iso) {
  return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

function StatusBadge({ status }) {
  if (status === "completed") {
    return <span className="rounded-full bg-practice-500/15 px-2.5 py-1 text-[11px] font-medium text-practice-500">Completed</span>;
  }
  return <span className="rounded-full bg-amber-400/15 px-2.5 py-1 text-[11px] font-medium text-amber-400">In progress</span>;
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

      <div className="mx-auto max-w-4xl px-6 py-14 sm:py-16">
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

        <div className="mt-8 flex flex-col gap-3">
          {sessions?.map((s, i) => (
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
                      {formatDate(s.created_at)} · {s.question_count} question{s.question_count === 1 ? "" : "s"}
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
      </div>
    </div>
  );
}
