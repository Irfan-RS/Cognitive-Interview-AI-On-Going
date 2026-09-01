import { ArrowRight, PlayCircle, Radio, Sparkles } from "lucide-react";
import Container from "../layout/Container";
import Button from "../ui/Button";
import { hero } from "../../data/content";

const WAVEFORM = [6, 14, 9, 20, 12, 24, 10, 18, 8, 22, 13, 6, 16, 9, 21];

export default function Hero({ onStart }) {
  return (
    <section id="top" className="relative overflow-hidden bg-grid pt-24 pb-24">
      <div className="ambient-glow" />
      <div className="pointer-events-none absolute inset-x-0 top-0 h-[520px] bg-gradient-to-b from-brand-500/15 via-transparent to-transparent" />

      <Container className="relative grid gap-16 lg:grid-cols-[1.1fr_0.9fr] lg:items-center">
        <div className="animate-rise-in flex flex-col items-start gap-6">
          <span className="flex items-center gap-2 rounded-full border border-ink-500 bg-ink-900/60 px-4 py-1.5 text-xs font-medium uppercase tracking-[0.2em] text-mist-300 backdrop-blur">
            <Sparkles size={12} className="text-brand-300" />
            {hero.eyebrow}
          </span>

          <h1 className="text-4xl font-semibold text-white text-balance sm:text-5xl lg:text-6xl">
            Practice speaking. Build confidence.{" "}
            <span className="text-gradient">Walk in ready.</span>
          </h1>

          <p className="max-w-xl text-lg text-mist-400 text-balance">{hero.subtitle}</p>

          <div className="flex flex-wrap items-center gap-4 pt-2">
            <Button variant="primary" onClick={onStart}>
              {hero.primaryCta}
              <ArrowRight size={16} />
            </Button>
            <a
              href="#how-it-works"
              className="inline-flex items-center justify-center gap-2 rounded-full border border-ink-500 px-5 py-3 text-sm font-semibold text-mist-100 transition-all hover:border-mist-300 hover:bg-white/5 hover:text-white"
            >
              <PlayCircle size={16} />
              {hero.secondaryCta}
            </a>
          </div>
        </div>

        <div className="animate-rise-in relative mx-auto w-full max-w-md" style={{ animationDelay: "150ms" }}>
          <div className="glass-panel glow-ring relative overflow-hidden p-5">
            <div className="animate-shimmer pointer-events-none absolute inset-0" />
            <div className="relative flex items-center justify-between text-xs text-mist-400">
              <span className="flex items-center gap-2">
                <span className="relative flex h-2 w-2">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-mock-500 opacity-75" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-mock-500" />
                </span>
                Recording answer
              </span>
              <span>Q3 of 8 · Practice mode</span>
            </div>

            <div className="relative mt-4 flex h-28 items-end gap-1 rounded-lg bg-ink-900/80 p-3">
              {WAVEFORM.map((h, i) => (
                <span
                  key={i}
                  className="animate-bar-bounce flex-1 rounded-full bg-gradient-to-t from-brand-500 to-glow-400"
                  style={{ height: `${h * 3}px`, animationDelay: `${i * 70}ms` }}
                />
              ))}
            </div>

            <div className="relative mt-4 flex items-center gap-2 text-xs text-practice-500">
              <Radio size={14} />
              Hint available after 15s of silence
            </div>

            <div className="relative mt-4 rounded-lg border border-ink-600 bg-ink-950/80 p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-mist-400">Live transcript</p>
              <p className="mt-2 text-sm text-mist-200">
                "In my last project I owned the migration end-to-end, so I coordinated with three teams and cut
                rollout time by..."
              </p>
            </div>

            <div className="relative mt-4 grid grid-cols-3 gap-2 text-center text-xs">
              <div className="rounded-lg border border-brand-500/20 bg-brand-500/10 py-2">
                <p className="font-semibold text-brand-300">92%</p>
                <p className="text-mist-400">Relevance</p>
              </div>
              <div className="rounded-lg border border-practice-500/20 bg-practice-500/10 py-2">
                <p className="font-semibold text-practice-500">On-screen</p>
                <p className="text-mist-400">Eye contact</p>
              </div>
              <div className="rounded-lg border border-glow-400/20 bg-glow-400/10 py-2">
                <p className="text-glow-400 font-semibold">2 fillers</p>
                <p className="text-mist-400">Fluency</p>
              </div>
            </div>
          </div>
        </div>
      </Container>
    </section>
  );
}
