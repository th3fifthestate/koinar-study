// app/components/reader/study-hero.tsx
'use client';

import { type ReactNode } from 'react';
import { OlivePattern } from './patterns/olive';
import { useReaderPrefs } from '@/lib/reader/use-reader-prefs';

export interface StudyHeroProps {
  /** "A Standard Study" / "A Quick Study" — italic eyebrow framing. */
  eyebrow: string;
  /** Italic top line of the title. E.g., "The Life of". */
  italLine: string;
  /** Uppercase display line. E.g., "Peter". */
  displayLine: string;
  /** Italic subtitle below the title. E.g., "From Fisherman to Shepherd". */
  subtitle?: string;
  /** Author display name. E.g., "Koinar Team". */
  byline: string;
  /** Pre-formatted date string. */
  date: string;
  /** Tag chips — typically the study type and translation. */
  tags?: string[];
  /** Chrome cluster (StudyHeader) injected at the bottom of the hero. */
  chrome?: ReactNode;
  /** Backlink target. Defaults to /library. */
  backlinkHref?: string;
  /** Backlink label. Defaults to "Back to Library". */
  backlinkLabel?: string;
}

/**
 * Editorial hero. Centered chapter-title-page composition: italic
 * eyebrow with hairlines → italic + uppercase title stack → italic
 * subtitle → byline → 56px rule → tag chips → chrome cluster.
 *
 * Atmospheric layer: olive-branch pattern overlay + radial gradient
 * wash.
 *
 * Spec: §4 (layout), §5 (atmosphere), §10.1 (typography verification).
 */
export function StudyHero({
  eyebrow,
  italLine,
  displayLine,
  subtitle,
  byline,
  date,
  tags = [],
  chrome,
  backlinkHref = '/',
  backlinkLabel = 'Back to Library',
}: StudyHeroProps) {
  const { prefs } = useReaderPrefs();
  const mode = prefs.mode ?? 'light';

  // Length-aware display sizing — short titles ("PETER") get the dramatic
  // 9.5vw treatment; long question-titles (Quick studies) scale down so
  // they don't fill the viewport vertically.
  const len = displayLine.length;
  const displaySize =
    len <= 12  ? 'clamp(4rem, 9.5vw, 8rem)'   // "PETER", "MOSES"
    : len <= 24  ? 'clamp(3rem, 6.5vw, 5.5rem)' // "JOHN THE BAPTIST"
    : len <= 48  ? 'clamp(2.2rem, 4.2vw, 3.6rem)' // "Why Circumcision Was Required"
    : 'clamp(1.8rem, 3.2vw, 2.8rem)';            // very long Quick questions

  return (
    <header className="relative w-full overflow-hidden bg-[var(--hero-bg)] px-8 pb-32 pt-44 text-center">
      {/* Atmospheric radial wash */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0"
        style={{
          background: `
            radial-gradient(ellipse 720px 520px at 50% 30%, rgba(196,154,108,0.10), transparent 65%),
            radial-gradient(ellipse 600px 400px at 50% 80%, rgba(107,128,96,0.06), transparent 70%)
          `,
        }}
      />

      {/* Olive pattern overlay */}
      <OlivePattern mode={mode} />

      {/* Backlink — top-left absolute */}
      <a
        href={backlinkHref}
        className="absolute left-8 top-7 z-10 inline-flex items-center gap-2 text-[0.78rem] font-medium tracking-[0.06em] text-[var(--stone-700)] hover:text-[var(--stone-900)] dark:text-[var(--stone-300)] dark:hover:text-[var(--stone-100)]"
      >
        <span aria-hidden className="text-[0.95rem] opacity-70">←</span>
        {backlinkLabel}
      </a>

      <div className="relative z-[1] mx-auto max-w-[880px]">
        {/* Italic eyebrow with hairlines */}
        <div className="mb-9 inline-flex items-center gap-4 font-display text-[1.05rem] italic text-[var(--stone-700)] dark:text-[var(--stone-200)]">
          <span aria-hidden className="h-px w-9 bg-[var(--warmth)] opacity-55" />
          {eyebrow}
          <span aria-hidden className="h-px w-9 bg-[var(--warmth)] opacity-55" />
        </div>

        {/* Title — italic line stacked on uppercase line */}
        <div className="mb-7 leading-none">
          <span
            className="block font-display text-[clamp(2.2rem,4.2vw,3.4rem)] italic font-normal mb-3.5 tracking-[-0.005em] text-[var(--stone-900)] dark:text-[var(--stone-100)]"
            style={{ fontFeatureSettings: '"dlig" on, "liga" on' }}
          >
            {italLine}
          </span>
          <span
            className="block font-display font-semibold uppercase tracking-[-0.012em] leading-[0.95] text-[var(--stone-900)] dark:text-[var(--stone-50)]"
            style={{
              fontSize: displaySize,
              fontFeatureSettings: '"case" on, "dlig" on, "liga" on, "lnum" on',
            }}
          >
            {displayLine}
          </span>
        </div>

        {/* Italic subtitle */}
        {subtitle && (
          <p className="mb-6 mt-7 font-body text-[1.1rem] italic text-[var(--stone-700)] dark:text-[var(--stone-200)]">
            {subtitle}
          </p>
        )}

        {/* Byline (Geist uppercase letterspaced) */}
        <p className="mb-11 text-[0.78rem] uppercase tracking-[0.08em] text-[var(--stone-500)] dark:text-[var(--stone-400)]">
          by {byline}
          <span
            aria-hidden
            className="mx-3.5 inline-block h-[3px] w-[3px] rounded-full bg-[var(--stone-500)] align-middle opacity-60"
          />
          {date}
        </p>

        {/* Hairline rule */}
        <div className="mx-auto mb-9 h-px w-14 bg-[var(--stone-900)] opacity-[0.32] dark:bg-[var(--stone-100)] dark:opacity-50" />

        {/* Tag chips */}
        {tags.length > 0 && (
          <div className="mb-9 inline-flex items-center gap-2">
            {tags.map((tag) => (
              <span
                key={tag}
                className="rounded-full border border-[rgba(107,128,96,0.18)] bg-[rgba(107,128,96,0.08)] px-3.5 py-[5px] text-[0.66rem] font-medium uppercase tracking-[0.18em] text-[var(--sage-700)] dark:border-[rgba(168,184,160,0.25)] dark:bg-[rgba(168,184,160,0.10)] dark:text-[var(--sage-300)]"
              >
                {tag}
              </span>
            ))}
          </div>
        )}

        {/* Chrome cluster */}
        {chrome && <div className="relative z-[1]">{chrome}</div>}
      </div>
    </header>
  );
}
