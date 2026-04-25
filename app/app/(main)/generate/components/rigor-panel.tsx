'use client';

const STEPS = [
  { label: 'Immediate context', desc: 'five verses on either side.' },
  { label: 'Chapter context', desc: 'the flow of thought.' },
  { label: 'Book context', desc: 'purpose, audience, setting.' },
  { label: 'Cross-references', desc: 'top community-voted parallels.' },
  { label: 'Original language', desc: 'Hebrew, Greek, Septuagint.' },
  { label: 'Historical and narrative setting', desc: 'who, when, where, why.' },
  { label: 'Canonical context', desc: 'the whole Bible interpreting itself.' },
];

export function RigorPanel() {
  return (
    <details className="border-t border-[var(--stone-200)] mt-8">
      <summary className="flex items-center gap-2 py-4 cursor-pointer text-[var(--stone-700)] text-sm font-medium select-none list-none [&::-webkit-details-marker]:hidden">
        <span className="text-[var(--stone-300)] text-xs">▸</span>
        What Koinar does with this
      </summary>
      <div className="pb-8 pt-2">
        <h2 className="font-display text-[var(--stone-900)] text-xl mb-3">
          Seven checks before a single citation.
        </h2>
        <p className="font-body text-[var(--stone-700)] text-base mb-5 leading-relaxed">
          Every verse in a Koinar study goes through the same seven-step protocol. This is why a
          Quick answer is honest and a Comprehensive study is thorough — the checks do not change,
          only how much of the work shows on the page.
        </p>
        <ol className="space-y-2">
          {STEPS.map((step, i) => (
            <li key={step.label} className="flex gap-3 text-base text-[var(--stone-700)] font-body">
              <span className="text-[var(--sage-500)] font-semibold min-w-[1.2em]">{i + 1}.</span>
              <span>
                <strong className="text-[var(--stone-900)] font-semibold">{step.label}</strong>
                {' — '}
                {step.desc}
              </span>
            </li>
          ))}
        </ol>
      </div>
    </details>
  );
}
