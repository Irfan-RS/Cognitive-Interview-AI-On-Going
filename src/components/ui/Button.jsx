export default function Button({ children, variant = "primary", className = "", ...props }) {
  const base =
    "inline-flex items-center justify-center gap-2 rounded-full px-5 py-3 text-sm font-semibold transition-all duration-200 active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-40 disabled:active:scale-100 disabled:hover:shadow-none";
  const variants = {
    primary:
      "bg-gradient-to-b from-brand-400 to-brand-500 text-white shadow-[0_1px_0_0_rgba(255,255,255,0.2)_inset,0_8px_20px_-6px_rgba(109,91,255,0.55)] hover:shadow-[0_1px_0_0_rgba(255,255,255,0.25)_inset,0_10px_28px_-6px_rgba(109,91,255,0.75)] hover:brightness-110",
    ghost:
      "border border-ink-500 text-mist-100 hover:border-mist-300 hover:text-white hover:bg-white/5",
  };

  return (
    <button className={`${base} ${variants[variant]} ${className}`} {...props}>
      {children}
    </button>
  );
}
