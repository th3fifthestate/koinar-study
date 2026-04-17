'use client';

interface GenerateLedeProps {
  className?: string;
}

export function GenerateLede({ className }: GenerateLedeProps) {
  return (
    <header className={`text-center py-16 px-6 ${className ?? ''}`}>
      {/* Eyebrow: small caps */}
      <p className="text-[var(--stone-700)] text-xs font-semibold tracking-[0.25em] uppercase mb-6">
        Begin a Study
      </p>

      {/* Bodoni Moda display headline */}
      <h1
        className="font-display text-[var(--stone-900)] text-4xl md:text-5xl xl:text-6xl leading-tight mb-6"
        style={{ animation: 'authFadeIn 400ms ease-out both' }}
      >
        Let the passage{' '}
        <em className="text-[var(--sage-700)] not-italic italic">find its footing.</em>
      </h1>

      {/* Ornamental sage-300 dot rule */}
      <div className="flex justify-center gap-2 mt-2" aria-hidden="true">
        <span className="inline-block w-[6px] h-[6px] rounded-full bg-[var(--sage-300)]" />
        <span className="inline-block w-[6px] h-[6px] rounded-full bg-[var(--sage-300)]" />
        <span className="inline-block w-[6px] h-[6px] rounded-full bg-[var(--sage-300)]" />
      </div>
    </header>
  );
}
