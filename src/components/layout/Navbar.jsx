import { Mic } from "lucide-react";
import { Link } from "react-router-dom";
import Container from "./Container";
import Button from "../ui/Button";
import { nav } from "../../data/content";

export default function Navbar({ onStart }) {
  return (
    <header className="sticky top-0 z-50 border-b border-ink-700/80 bg-ink-950/70 backdrop-blur-xl">
      <Container className="flex h-16 items-center justify-between">
        <a href="#top" className="flex items-center gap-2.5 font-semibold text-white">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-brand-500 to-glow-400 shadow-[0_0_16px_-3px_rgba(109,91,255,0.75)]">
            <Mic size={16} strokeWidth={2.25} />
          </span>
          Cognitive Interview AI
        </a>

        <nav className="hidden items-center gap-7 text-sm text-mist-300 md:flex">
          {nav.map((item) => (
            <a
              key={item.href}
              href={item.href}
              className="relative py-1 transition-colors hover:text-white [&:hover>span]:scale-x-100"
            >
              {item.label}
              <span className="absolute -bottom-0.5 left-0 h-px w-full origin-left scale-x-0 bg-gradient-to-r from-brand-400 to-glow-400 transition-transform duration-300" />
            </a>
          ))}
        </nav>

        <div className="flex items-center gap-4">
          <Link to="/dashboard" className="hidden text-sm text-mist-300 transition-colors hover:text-white sm:inline">
            Dashboard
          </Link>
          <Button variant="primary" onClick={onStart}>
            Start interview
          </Button>
        </div>
      </Container>
    </header>
  );
}
