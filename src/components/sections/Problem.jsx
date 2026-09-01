import { MessageCircleWarning, Repeat, TrendingUp } from "lucide-react";
import Container from "../layout/Container";
import Card from "../ui/Card";
import IconTile from "../ui/IconTile";
import { problem } from "../../data/content";

const icons = [MessageCircleWarning, Repeat, TrendingUp];

export default function Problem() {
  return (
    <section className="py-24">
      <Container>
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-3xl font-semibold text-white text-balance sm:text-4xl">
            {problem.heading}
          </h2>
          <p className="mt-4 text-lg text-mist-400 text-balance">{problem.body}</p>
        </div>

        <div className="mt-14 grid gap-6 sm:grid-cols-3">
          {problem.points.map((point, i) => {
            const Icon = icons[i];
            return (
              <Card
                key={point.title}
                className="animate-rise-in transition-transform duration-300 hover:-translate-y-1"
                style={{ animationDelay: `${i * 80}ms` }}
              >
                <IconTile icon={Icon} />
                <h3 className="mt-4 font-semibold text-white">{point.title}</h3>
                <p className="mt-2 text-sm text-mist-400">{point.body}</p>
              </Card>
            );
          })}
        </div>
      </Container>
    </section>
  );
}
