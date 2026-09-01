export default function IconTile({ icon: Icon, tone = "brand" }) {
  const tones = {
    brand: "from-brand-500/25 to-brand-500/5 text-brand-300 shadow-[0_0_20px_-8px_rgba(109,91,255,0.7)]",
    mock: "from-mock-500/25 to-mock-500/5 text-mock-500 shadow-[0_0_20px_-8px_rgba(255,107,107,0.6)]",
    practice: "from-practice-500/25 to-practice-500/5 text-practice-500 shadow-[0_0_20px_-8px_rgba(34,211,184,0.6)]",
  };

  return (
    <div
      className={`inline-flex h-11 w-11 items-center justify-center rounded-xl border border-white/10 bg-gradient-to-br ${tones[tone]}`}
    >
      <Icon size={20} strokeWidth={1.75} />
    </div>
  );
}
