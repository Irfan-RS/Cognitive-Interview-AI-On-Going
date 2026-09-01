import { Crosshair, Eye } from "lucide-react";
import Container from "../layout/Container";
import SectionHeading from "../ui/SectionHeading";
import { monitoring } from "../../data/content";

export default function Monitoring() {
  return (
    <section id="monitoring" className="border-t border-ink-700 py-24">
      <Container className="grid gap-14 lg:grid-cols-2 lg:items-center">
        <div className="flex flex-col gap-8">
          <SectionHeading eyebrow="Live monitoring" heading={monitoring.heading} subheading={monitoring.subheading} />

          <div className="flex flex-col gap-6">
            <div className="flex gap-4">
              <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-brand-500/15 text-brand-300">
                <Crosshair size={18} strokeWidth={1.75} />
              </div>
              <div>
                <h3 className="font-semibold text-white">{monitoring.calibration.title}</h3>
                <p className="mt-1 text-sm text-mist-400">{monitoring.calibration.body}</p>
              </div>
            </div>

            <div className="flex gap-4">
              <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-brand-500/15 text-brand-300">
                <Eye size={18} strokeWidth={1.75} />
              </div>
              <div>
                <h3 className="font-semibold text-white">{monitoring.runtime.title}</h3>
                <p className="mt-1 text-sm text-mist-400">{monitoring.runtime.body}</p>
              </div>
            </div>
          </div>
        </div>

        <div className="glass-panel animate-rise-in relative mx-auto aspect-video w-full max-w-lg overflow-hidden" style={{ animationDelay: "100ms" }}>
          <div className="bg-grid pointer-events-none absolute inset-0 opacity-30" />
          {["top-4 left-4", "top-4 right-4", "bottom-4 left-4", "bottom-4 right-4"].map((pos, i) => (
            <span key={pos} className={`absolute ${pos}`}>
              <span
                className="absolute inset-0 -m-2 animate-ping rounded-full bg-brand-400/30"
                style={{ animationDelay: `${i * 300}ms`, animationDuration: "2.4s" }}
              />
              <span className="relative block h-3 w-3 rounded-full bg-brand-400 shadow-[0_0_12px_2px_rgba(139,123,255,0.6)]" />
            </span>
          ))}
          <span className="absolute left-1/2 top-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full bg-practice-500 shadow-[0_0_12px_2px_rgba(34,211,184,0.6)]" />

          <div className="relative flex h-full flex-col items-center justify-center gap-3 text-center">
            <span className="flex h-14 w-14 items-center justify-center rounded-full border border-ink-500 bg-ink-800/80 backdrop-blur">
              <Eye size={22} className="text-mist-200" />
            </span>
            <p className="max-w-[220px] text-xs text-mist-400">
              Calibration reference: 4 corners + center, then continuous tracking during the interview.
            </p>
          </div>

          <div className="absolute -bottom-4 left-1/2 -translate-x-1/2 rounded-full border border-mock-500/40 bg-ink-950 px-4 py-1.5 text-xs text-mock-500 shadow-lg">
            Focus on the screen — maintain eye contact
          </div>
        </div>
      </Container>
    </section>
  );
}
