export default function SectionHeading({ eyebrow, heading, subheading, align = "left" }) {
  const alignClass = align === "center" ? "text-center items-center mx-auto" : "text-left items-start";

  return (
    <div className={`flex flex-col gap-4 max-w-2xl ${alignClass}`}>
      {eyebrow && (
        <span className="text-xs font-semibold uppercase tracking-[0.2em] text-brand-400">
          {eyebrow}
        </span>
      )}
      <h2 className="text-3xl sm:text-4xl font-semibold text-white text-balance">{heading}</h2>
      {subheading && <p className="text-base sm:text-lg text-mist-400 text-balance">{subheading}</p>}
    </div>
  );
}
