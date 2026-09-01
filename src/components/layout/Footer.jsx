import { Mic } from "lucide-react";
import Container from "./Container";
import { nav } from "../../data/content";

export default function Footer() {
  return (
    <footer className="border-t border-ink-700 py-10">
      <Container className="flex flex-col items-center gap-6 text-sm text-mist-400 sm:flex-row sm:justify-between">
        <a href="#top" className="flex items-center gap-2 font-semibold text-white">
          <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-br from-brand-500 to-glow-400">
            <Mic size={14} strokeWidth={2.25} />
          </span>
          Cognitive Interview AI
        </a>

        <nav className="flex flex-wrap items-center justify-center gap-5">
          {nav.map((item) => (
            <a key={item.href} href={item.href} className="hover:text-white transition-colors">
              {item.label}
            </a>
          ))}
        </nav>

        <span>No login required — practice starts instantly.</span>
      </Container>
    </footer>
  );
}
