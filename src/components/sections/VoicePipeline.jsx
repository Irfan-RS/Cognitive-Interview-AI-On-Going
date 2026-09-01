import { ArrowRight } from "lucide-react";
import Container from "../layout/Container";
import SectionHeading from "../ui/SectionHeading";
import { voicePipeline } from "../../data/content";

export default function VoicePipeline() {
  return (
    <section className="border-t border-ink-700 py-24">
      <Container>
        <SectionHeading
          eyebrow="Voice interaction"
          heading={voicePipeline.heading}
          subheading={voicePipeline.subheading}
          align="center"
        />

        <div className="mt-14 flex flex-col items-stretch gap-3 lg:flex-row lg:items-center">
          {voicePipeline.flow.map((step, i) => (
            <div
              key={step.label}
              className="animate-rise-in flex flex-1 items-center gap-3"
              style={{ animationDelay: `${i * 70}ms` }}
            >
              <div className="glass-panel flex-1 p-5 transition-transform duration-300 hover:-translate-y-1">
                <span className="text-[11px] font-semibold uppercase tracking-wide text-brand-400">
                  Step {i + 1}
                </span>
                <p className="mt-1 font-semibold text-white">{step.label}</p>
                <p className="mt-1.5 text-sm text-mist-400">{step.detail}</p>
              </div>
              {i < voicePipeline.flow.length - 1 && (
                <ArrowRight size={18} className="hidden shrink-0 text-brand-400/60 lg:block" />
              )}
            </div>
          ))}
        </div>
      </Container>
    </section>
  );
}
