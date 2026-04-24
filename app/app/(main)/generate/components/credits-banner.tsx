'use client';

// Running-balance banner shown above the prompt field when the user is on
// gift-code credits. Keeps the total visible so the per-card badges and
// the ContextLine under the CTA don't have to carry the full weight of
// the entitlement story.

import type { Entitlement, Format } from '../types';

interface CreditsBannerProps {
  entitlement: Entitlement;
}

const FORMAT_LABELS: Record<Format, string> = {
  simple: 'Simple',
  standard: 'Standard',
  comprehensive: 'Comprehensive',
};

// Deterministic column order so the banner reads the same way every render.
const FORMAT_ORDER: Format[] = ['simple', 'standard', 'comprehensive'];

export function CreditsBanner({ entitlement }: CreditsBannerProps) {
  if (entitlement.kind !== 'gift') return null;

  const nonZero = FORMAT_ORDER.filter(
    (f) => (entitlement.credits[f] ?? 0) > 0,
  );

  // If every format is zeroed out, let the no-entitlement / disabled-card
  // copy elsewhere do the talking; no reason for a cheerful banner.
  if (nonZero.length === 0) return null;

  const parts = nonZero.map((f) => {
    const n = entitlement.credits[f] ?? 0;
    return `${n} ${FORMAT_LABELS[f]} credit${n === 1 ? '' : 's'}`;
  });

  // Join with commas; Oxford for 3+, "and" for 2, bare for 1.
  let summary: string;
  if (parts.length === 1) {
    summary = parts[0];
  } else if (parts.length === 2) {
    summary = `${parts[0]} and ${parts[1]}`;
  } else {
    summary = `${parts.slice(0, -1).join(', ')}, and ${parts[parts.length - 1]}`;
  }

  return (
    <div
      className="mb-6 rounded-md border border-[var(--sage-300)] bg-[var(--sage-50)] px-4 py-3"
      role="status"
      aria-label="Your study credits"
    >
      <p className="font-body text-sm text-[var(--stone-700)]">
        <span className="font-semibold text-[var(--sage-700)] uppercase tracking-[0.12em] text-xs mr-2">
          Your credits
        </span>
        {summary}.
      </p>
    </div>
  );
}
