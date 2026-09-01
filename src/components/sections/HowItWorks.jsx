import Container from "../layout/Container";
import SectionHeading from "../ui/SectionHeading";
import { howItWorks } from "../../data/content";

export default function HowItWorks() {
  return (
    <section id="how-it-works" className="border-t border-ink-700 py-24">
      <Container>
        <SectionHeading
          eyebrow="Session flow"
          heading={howItWorks.heading}
          subheading={howItWorks.subheading}
        />

        <ol className="mt-14 grid gap-x-8 gap-y-10 sm:grid-cols-2 lg:grid-cols-4">
          {howItWorks.steps.map((step, i) => (
            <li
              key={step.title}
              className="animate-rise-in group relative pl-12"
              style={{ animationDelay: `${i * 50}ms` }}
            >
              {i < howItWorks.steps.length - 1 && (
                <span className="absolute left-4 top-8 hidden h-[calc(100%+1.5rem)] w-px bg-gradient-to-b from-ink-600 to-transparent lg:block" />
              )}
              <span className="absolute left-0 top-0 flex h-8 w-8 items-center justify-center rounded-full border border-brand-400/50 bg-gradient-to-br from-brand-500/25 to-transparent text-sm font-semibold text-brand-300 shadow-[0_0_16px_-6px_rgba(109,91,255,0.8)] transition-transform group-hover:scale-110">
                {i + 1}
              </span>
              <h3 className="font-semibold text-white">{step.title}</h3>
              <p className="mt-1.5 text-sm text-mist-400">{step.body}</p>
            </li>
          ))}
        </ol>
      </Container>
    </section>
  );
}
