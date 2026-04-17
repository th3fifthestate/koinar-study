'use client';
import type { ToolCallEntry } from '../types';

interface ToolCallFeedProps {
  entries: ToolCallEntry[];
}

export function ToolCallFeed({ entries }: ToolCallFeedProps) {
  const visible = entries.slice(-6);
  return (
    <section aria-label="Consulting" className="mt-8">
      <p className="text-[var(--stone-700)] text-xs font-semibold tracking-[0.2em] uppercase mb-3">
        Consulting
      </p>
      <ul
        role="log"
        aria-live="polite"
        aria-label="Study progress"
        className="space-y-2"
      >
        {visible.map((entry, i) => {
          const isOld = i < visible.length - 1;
          return (
            <li
              key={entry.id}
              className={`font-body text-base italic transition-opacity duration-300 ${
                isOld ? 'text-[var(--stone-700)] opacity-50' : 'text-[var(--stone-700)]'
              }`}
              style={{ animation: 'authFadeIn 450ms ease-out both' }}
            >
              {entry.phrase}
            </li>
          );
        })}
      </ul>
      <p className="text-[var(--stone-700)] text-xs mt-4 font-body">
        Most studies take one to three minutes.
      </p>
    </section>
  );
}
