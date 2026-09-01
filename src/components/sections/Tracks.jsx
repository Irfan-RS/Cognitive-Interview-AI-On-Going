import { Briefcase, FileText, Layers } from "lucide-react";
import Container from "../layout/Container";
import SectionHeading from "../ui/SectionHeading";
import Card from "../ui/Card";
import IconTile from "../ui/IconTile";
import { tracks } from "../../data/content";

const icons = [Briefcase, FileText, Layers];

export default function Tracks() {
  return (
    <section className="border-t border-ink-700 py-24">
      <Container>
        <SectionHeading eyebrow="Question tracks" heading={tracks.heading} subheading={tracks.subheading} />

        <div className="mt-14 grid gap-6 sm:grid-cols-3">
          {tracks.items.map((item, i) => {
            const Icon = icons[i];
            return (
              <Card
                key={item.title}
                className="animate-rise-in transition-transform duration-300 hover:-translate-y-1"
                style={{ animationDelay: `${i * 80}ms` }}
              >
                <IconTile icon={Icon} />
                <h3 className="mt-4 font-semibold text-white">{item.title}</h3>
                <p className="mt-2 text-sm text-mist-400">{item.body}</p>
              </Card>
            );
          })}
        </div>
      </Container>
    </section>
  );
}
