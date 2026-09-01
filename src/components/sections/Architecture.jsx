import { Layers2, Server } from "lucide-react";
import Container from "../layout/Container";
import SectionHeading from "../ui/SectionHeading";
import { architecture } from "../../data/content";

function LayerStack({ title, icon: Icon, layers, delay = 0 }) {
  return (
    <div className="glass-panel animate-rise-in p-6 sm:p-8" style={{ animationDelay: `${delay}ms` }}>
      <div className="flex items-center gap-2.5">
        <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand-500/15 text-brand-300">
          <Icon size={16} />
        </span>
        <h3 className="font-semibold text-white">{title}</h3>
      </div>

      <div className="mt-6 flex flex-col gap-3">
        {layers.map((layer, i) => (
          <div
            key={layer.name}
            className="group relative overflow-hidden rounded-lg border border-ink-600 bg-ink-900/80 px-4 py-3 transition-colors hover:border-brand-400/30"
          >
            <span className="absolute left-0 top-0 h-full w-0.5 bg-gradient-to-b from-brand-400 to-glow-400 opacity-0 transition-opacity group-hover:opacity-100" />
            <p className="text-sm font-semibold text-mist-100">
              <span className="mr-1.5 text-mist-500">{String(i + 1).padStart(2, "0")}</span>
              {layer.name}
            </p>
            <p className="mt-0.5 text-xs text-mist-400">{layer.body}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function Architecture() {
  return (
    <section id="architecture" className="border-t border-ink-700 py-24">
      <Container>
        <SectionHeading
          eyebrow="Architecture"
          heading={architecture.heading}
          subheading={architecture.subheading}
        />

        <div className="mt-14 grid gap-6 lg:grid-cols-2">
          <LayerStack title={architecture.frontend.title} icon={Layers2} layers={architecture.frontend.layers} />
          <LayerStack
            title={architecture.backend.title}
            icon={Server}
            layers={architecture.backend.layers}
            delay={100}
          />
        </div>
      </Container>
    </section>
  );
}
