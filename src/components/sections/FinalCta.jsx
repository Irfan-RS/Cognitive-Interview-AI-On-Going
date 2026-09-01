import { ArrowRight } from "lucide-react";
import Container from "../layout/Container";
import Button from "../ui/Button";
import { finalCta } from "../../data/content";

export default function FinalCta({ onStart }) {
  return (
    <section className="border-t border-ink-700 py-24">
      <Container>
        <div className="animate-rise-in glow-ring relative mx-auto flex max-w-2xl flex-col items-center gap-6 overflow-hidden rounded-3xl border border-brand-400/30 bg-brand-500/10 px-8 py-16 text-center">
          <div className="ambient-glow" />
          <h2 className="relative text-3xl font-semibold text-white text-balance sm:text-4xl">
            {finalCta.heading}
          </h2>
          <p className="relative text-mist-300 text-balance">{finalCta.body}</p>
          <Button variant="primary" onClick={onStart} className="relative">
            {finalCta.primaryCta}
            <ArrowRight size={16} />
          </Button>
        </div>
      </Container>
    </section>
  );
}
