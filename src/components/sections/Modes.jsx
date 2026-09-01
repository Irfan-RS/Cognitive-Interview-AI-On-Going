import { Check, ShieldOff, Sparkles } from "lucide-react";
import Container from "../layout/Container";
import SectionHeading from "../ui/SectionHeading";
import { modes } from "../../data/content";

const toneMap = {
  mock: {
    icon: ShieldOff,
    glow: "hover:shadow-[0_0_40px_-16px_rgba(255,107,107,0.6)] hover:border-mock-500/40",
    badge: "bg-mock-500/15 text-mock-500",
  },
  practice: {
    icon: Sparkles,
    glow: "hover:shadow-[0_0_40px_-16px_rgba(34,211,184,0.6)] hover:border-practice-500/40",
    badge: "bg-practice-500/15 text-practice-500",
  },
};

export default function Modes() {
  return (
    <section id="modes" className="border-t border-ink-700 py-24">
      <Container>
        <SectionHeading eyebrow="Modes" heading={modes.heading} subheading={modes.subheading} />

        <div className="mt-14 grid gap-6 md:grid-cols-2">
          {modes.cards.map((card, i) => {
            const tone = toneMap[card.key];
            const Icon = tone.icon;
            return (
              <div
                key={card.key}
                style={{ animationDelay: `${i * 90}ms` }}
                className={`glass-panel animate-rise-in p-8 transition-all duration-300 hover:-translate-y-1 ${tone.glow}`}
              >
                <div className={`inline-flex h-11 w-11 items-center justify-center rounded-xl border border-white/10 ${tone.badge}`}>
                  <Icon size={20} strokeWidth={1.75} />
                </div>
                <h3 className="mt-5 text-2xl font-semibold text-white">{card.title}</h3>
                <p className={`mt-1 text-sm font-medium ${tone.badge.split(" ")[1]}`}>
                  {card.tagline}
                </p>
                <p className="mt-4 text-sm text-mist-400">{card.description}</p>

                <ul className="mt-6 flex flex-col gap-3">
                  {card.bullets.map((bullet) => (
                    <li key={bullet} className="flex items-start gap-2 text-sm text-mist-200">
                      <Check size={16} className="mt-0.5 shrink-0 text-mist-400" />
                      {bullet}
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
        </div>
      </Container>
    </section>
  );
}
