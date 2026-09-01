import { Tag } from "lucide-react";
import Container from "../layout/Container";
import { questionBank } from "../../data/content";

export default function QuestionBank() {
  return (
    <section className="border-t border-ink-700 py-24">
      <Container className="grid gap-12 lg:grid-cols-[0.9fr_1.1fr] lg:items-center">
        <div>
          <span className="text-xs font-semibold uppercase tracking-[0.2em] text-brand-400">
            Question bank
          </span>
          <h2 className="mt-4 text-3xl font-semibold text-white text-balance sm:text-4xl">
            {questionBank.heading}
          </h2>
          <p className="mt-4 text-base text-mist-400 text-balance">{questionBank.body}</p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          {questionBank.tags.map((tag, i) => (
            <div
              key={tag.label}
              style={{ animationDelay: `${i * 70}ms` }}
              className="glass-panel animate-rise-in p-5 transition-transform duration-300 hover:-translate-y-1"
            >
              <div className="flex items-center gap-2 text-sm font-semibold text-white">
                <span className="flex h-6 w-6 items-center justify-center rounded-md bg-brand-500/15 text-brand-300">
                  <Tag size={12} />
                </span>
                {tag.label}
              </div>
              <p className="mt-2 text-sm text-mist-400">{tag.example}</p>
            </div>
          ))}
        </div>
      </Container>
    </section>
  );
}
