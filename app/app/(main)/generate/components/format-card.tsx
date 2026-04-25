'use client';

import Link from 'next/link';
import type { Format, Entitlement } from '../types';
import { DepthBars } from './depth-bars';

interface FormatCardProps {
  format: Format;
  selected: boolean;
  onSelect: () => void;
  entitlement: Entitlement;
  disabled: boolean;
}

const CARD_DATA: Record<
  Format,
  {
    name: string;
    tagline: string;
    body: string;
    costRange: string;
  }
> = {
  quick: {
    name: 'Quick',
    tagline: 'Ask a question. Get the scriptures that speak to it.',
    body: 'A scripture-finder, not a study. Surfaces 3–6 verses and 1–3 narratives that address your question, each grounded in the full seven-step research protocol. No counsel or personal application — just "read these in context." ~600–1,200 words.',
    costRange: 'Approx. $0.40–0.80',
  },
  standard: {
    name: 'Standard',
    tagline: 'Thorough with room to breathe.',
    body: 'Rigid skeleton: Summary, four-part scripture references, four to eight body sections (each with text, historical context, original-language word study, key insight, and cross-references), key themes, OT/NT echoes, and conclusion. ~2,500–3,000 words.',
    costRange: 'Approx. $0.40–0.70',
  },
  comprehensive: {
    name: 'Comprehensive',
    tagline: 'The seven-step protocol in full.',
    body: 'Standard skeleton plus book/domain context, preceding context, verse-by-verse subdivisions inside every body section, following context, and a legacy-and-echoes table tracing the subject across the canon. ~4,500–6,000 words.',
    costRange: 'Approx. $1.00–1.80',
  },
};

function EntitlementLine({
  format,
  entitlement,
}: {
  format: Format;
  entitlement: Entitlement;
}) {
  if (entitlement.kind === 'gift') {
    const credits = entitlement.credits[format] ?? 0;
    if (credits > 0) {
      return (
        <p className="text-[var(--stone-700)] italic" style={{ fontSize: '0.8rem' }}>
          {credits} credit{credits === 1 ? '' : 's'} available.
        </p>
      );
    }
    return (
      <p className="text-[var(--stone-700)] italic" style={{ fontSize: '0.8rem' }}>
        No credits for this depth —{' '}
        <Link
          href="/settings?tab=api-key"
          className="underline text-[var(--sage-700)] hover:text-[var(--sage-600)]"
        >
          use your own Anthropic key
        </Link>
      </p>
    );
  }

  if (entitlement.kind === 'byok' || entitlement.kind === 'admin') {
    return (
      <p className="text-[var(--stone-700)] italic" style={{ fontSize: '0.8rem' }}>
        {CARD_DATA[format].costRange}
      </p>
    );
  }

  return null;
}

export function FormatCard({
  format,
  selected,
  onSelect,
  entitlement,
  disabled,
}: FormatCardProps) {
  const card = CARD_DATA[format];

  const isGiftZeroCredits =
    entitlement.kind === 'gift' && (entitlement.credits[format] ?? 0) === 0;

  const isDimmed = isGiftZeroCredits;

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === ' ' || e.key === 'Enter') {
      e.preventDefault();
      onSelect();
    }
  };

  return (
    <div
      role="radio"
      aria-checked={selected}
      tabIndex={disabled ? -1 : 0}
      onClick={disabled ? undefined : onSelect}
      onKeyDown={disabled ? undefined : handleKeyDown}
      className={`
        relative flex-1 bg-white rounded-lg border border-[var(--stone-200)] p-4 cursor-pointer
        transition-all duration-150 select-none
        ${selected
          ? 'border-l-[3px] border-l-[var(--sage-500)] md:border-l-0 md:border-b-[3px] md:border-b-[var(--sage-500)]'
          : 'hover:border-[var(--stone-300)]'
        }
        ${isDimmed ? 'opacity-60 cursor-not-allowed' : ''}
      `}
    >
      {selected && (
        <span className="sr-only">Selected.</span>
      )}

      {/* Header row: name + depth bars */}
      <div className="flex items-center justify-between mb-1">
        <span className="font-semibold text-[var(--stone-900)] text-base">{card.name}</span>
        <DepthBars format={format} />
      </div>

      {/* Tagline */}
      <p className="text-[var(--stone-700)] text-base font-medium mb-2">{card.tagline}</p>

      {/* Body */}
      <p className="text-[var(--stone-700)] text-base leading-relaxed mb-3">{card.body}</p>

      {/* Entitlement line */}
      <EntitlementLine format={format} entitlement={entitlement} />
    </div>
  );
}
