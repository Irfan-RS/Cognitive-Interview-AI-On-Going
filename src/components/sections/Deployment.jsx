import { Cloud, HardDrive, LockOpen, Volume2 } from "lucide-react";
import Container from "../layout/Container";
import SectionHeading from "../ui/SectionHeading";
import { deployment } from "../../data/content";

const optionIcons = [HardDrive, Cloud];

export default function Deployment() {
  return (
    <section className="border-t border-ink-700 py-24">
      <Container>
        <SectionHeading
          eyebrow="Model & voice providers"
          heading={deployment.heading}
          subheading={deployment.subheading}
        />

        <div className="mt-14 grid gap-6 md:grid-cols-2">
          {deployment.options.map((option, i) => {
            const Icon = optionIcons[i];
            return (
              <div
                key={option.title}
                style={{ animationDelay: `${i * 80}ms` }}
                className="glass-panel animate-rise-in p-6 transition-transform duration-300 hover:-translate-y-1 sm:p-8"
              >
                <div className="inline-flex h-11 w-11 items-center justify-center rounded-xl border border-white/10 bg-gradient-to-br from-brand-500/25 to-transparent text-brand-300">
                  <Icon size={20} strokeWidth={1.75} />
                </div>
                <h3 className="mt-4 font-semibold text-white">{option.title}</h3>
                <p className="mt-2 text-sm text-mist-400">{option.body}</p>
              </div>
            );
          })}
        </div>

        <div className="mt-6 grid gap-6 md:grid-cols-2">
          <div className="glass-panel animate-rise-in flex items-start gap-4 p-6">
            <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-ink-900 text-mist-200">
              <Volume2 size={18} strokeWidth={1.75} />
            </span>
            <div>
              <h3 className="font-semibold text-white">{deployment.voice.title}</h3>
              <p className="mt-1 text-sm text-mist-400">{deployment.voice.body}</p>
            </div>
          </div>

          <div className="glass-panel animate-rise-in flex items-start gap-4 p-6" style={{ animationDelay: "80ms" }}>
            <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-ink-900 text-mist-200">
              <LockOpen size={18} strokeWidth={1.75} />
            </span>
            <div>
              <h3 className="font-semibold text-white">{deployment.access.title}</h3>
              <p className="mt-1 text-sm text-mist-400">{deployment.access.body}</p>
            </div>
          </div>
        </div>
      </Container>
    </section>
  );
}
