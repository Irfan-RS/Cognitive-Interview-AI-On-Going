import { Check } from "lucide-react";

const STEPS = [
  { key: "setup", label: "Setup" },
  { key: "calibrate", label: "Calibrate" },
  { key: "interview", label: "Interview" },
];

export default function Stepper({ current }) {
  const currentIndex = STEPS.findIndex((s) => s.key === current);

  return (
    <ol className="flex items-center gap-1.5 sm:gap-2">
      {STEPS.map((step, i) => {
        const done = i < currentIndex;
        const active = i === currentIndex;
        return (
          <li key={step.key} className="flex items-center gap-1.5 sm:gap-2">
            <div className="flex items-center gap-2">
              <span
                className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold transition-all duration-300 ${
                  done
                    ? "bg-practice-500 text-ink-950"
                    : active
                      ? "glow-ring bg-brand-500 text-white"
                      : "border border-ink-500 text-mist-400"
                }`}
              >
                {done ? <Check size={12} strokeWidth={3} /> : i + 1}
              </span>
              <span
                className={`hidden text-xs font-medium sm:inline ${
                  active ? "text-white" : done ? "text-mist-300" : "text-mist-500"
                }`}
              >
                {step.label}
              </span>
            </div>
            {i < STEPS.length - 1 && (
              <span
                className={`h-px w-4 sm:w-8 transition-colors duration-300 ${done ? "bg-practice-500" : "bg-ink-600"}`}
              />
            )}
          </li>
        );
      })}
    </ol>
  );
}
