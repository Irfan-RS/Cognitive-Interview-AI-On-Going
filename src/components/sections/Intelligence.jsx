import { GitBranch, MessageSquareText, SpellCheck2, Target, TimerReset, Wand2 } from "lucide-react";
import Container from "../layout/Container";
import SectionHeading from "../ui/SectionHeading";
import Card from "../ui/Card";
import IconTile from "../ui/IconTile";
import { intelligence } from "../../data/content";

const icons = [SpellCheck2, TimerReset, Target, GitBranch, MessageSquareText, Wand2];

export default function Intelligence() {
  return (
    <section id="intelligence" className="border-t border-ink-700 py-24">
      <Container>
        <SectionHeading
          eyebrow="Answer intelligence"
          heading={intelligence.heading}
          subheading={intelligence.subheading}
        />

        <div className="mt-14 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {intelligence.items.map((item, i) => {
            const Icon = icons[i];
            return (
              <Card
                key={item.title}
                className="animate-rise-in transition-transform duration-300 hover:-translate-y-1"
                style={{ animationDelay: `${i * 60}ms` }}
              >
                <IconTile icon={Icon} />
                <h3 className="mt-4 font-semibold text-white">{item.title}</h3>
                <p className="mt-2 text-sm text-mist-400">{item.body}</p>
              </Card>
            );
          })}
        </div>

        <div className="glass-panel relative mt-8 overflow-hidden border-brand-400/30 bg-brand-500/10 p-6 sm:p-8">
          <div className="ambient-glow opacity-60" />
          <h3 className="font-semibold text-white">{intelligence.storedPerQuestion.title}</h3>
          <p className="mt-2 text-sm text-mist-300">{intelligence.storedPerQuestion.body}</p>
        </div>
      </Container>
    </section>
  );
}
