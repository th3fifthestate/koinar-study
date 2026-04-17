export function TranslatorsNoteCard() {
  return (
    <div
      className="h-full flex flex-col justify-between p-7 border border-transparent"
      style={{ minHeight: '280px', background: 'var(--stone-100)' }}
    >
      {/* Warmth divider */}
      <div className="w-6 h-px bg-[var(--warmth)] mb-6" />

      <p className="font-body text-[1rem] leading-relaxed text-[var(--stone-700)] italic flex-1">
        This study uses the Berean Standard Bible. Other readings pull from the King James and World
        English translations — each chosen to honor the passage.
      </p>

      <p className="text-[9px] uppercase tracking-[0.25em] text-[var(--warmth)] mt-6">
        — A note on translations
      </p>
    </div>
  );
}
