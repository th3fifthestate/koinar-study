// app/components/reader/section-header.tsx
'use client';

import { type ReactNode } from 'react';

interface SectionHeaderProps {
  /** The H2 chapter heading. Should be a string or a fragment with line breaks. */
  heading: ReactNode;
  /** Optional descriptive intro paragraph, shown in the right column. */
  intro?: ReactNode;
}

/**
 * Two-column section opener: H2 chapter heading on the left, optional
 * intro paragraph on the right. When `intro` is omitted, the heading
 * takes full width.
 *
 * Visual spec: spec §4 — H2 uppercase Fraunces 700 with case feature on,
 * 56px section rule below at 0.28 opacity, intro is italic Literata
 * 1.18rem maxed at 480px width.
 */
export function SectionHeader({ heading, intro }: SectionHeaderProps) {
  return (
    <header
      className={`mx-auto mb-[92px] max-w-[1320px] ${
        intro ? 'grid grid-cols-1 items-end gap-20 md:grid-cols-2' : ''
      }`}
    >
      <div className="pr-6">
        <h2
          className="font-display text-[clamp(2.6rem,5vw,4.4rem)] font-bold uppercase leading-[0.98] tracking-[-0.005em] text-[var(--stone-900)] dark:text-[var(--stone-100)]"
          style={{ fontFeatureSettings: '"case" on, "dlig" on, "liga" on, "lnum" on' }}
        >
          {heading}
        </h2>
        <div className="mt-9 h-px w-14 bg-[var(--stone-900)] opacity-[0.28] dark:bg-[var(--stone-100)] dark:opacity-50" />
      </div>
      {intro && (
        <div className="pt-3.5">
          <p className="max-w-[480px] font-body text-[1.18rem] italic leading-[1.6] tracking-[0.005em] text-[var(--stone-700)] dark:text-[var(--stone-200)]">
            {intro}
          </p>
        </div>
      )}
    </header>
  );
}
