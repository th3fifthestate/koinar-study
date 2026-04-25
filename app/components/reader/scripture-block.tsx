// app/components/reader/scripture-block.tsx
import type { ReactNode } from 'react';

/**
 * Scripture quotation block. Sage-left-border in light, warmth-left-border
 * in dark — the accent flips via the --reader-accent CSS variable, which
 * is defined under [data-mode] in globals.css.
 *
 * Spec: §2 (typography), §3 (accent shift between modes), §10.5 (verification).
 */
export function ScriptureBlock({ children }: { children: ReactNode }) {
  return (
    <blockquote
      className="my-2 mb-9 rounded-r-lg border-l-[3px] py-7 pl-9 pr-9 bg-[rgba(107,128,96,0.05)] dark:bg-[rgba(196,154,108,0.06)]"
      style={{ borderLeftColor: 'var(--reader-accent)' }}
    >
      <div className="font-display text-[1.18rem] italic leading-[1.55] text-[var(--stone-900)] dark:text-[var(--stone-100)]">
        {children}
      </div>
    </blockquote>
  );
}
