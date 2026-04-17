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
  simple: {
    name: 'Simple',
    tagline: 'A brief devotional.',
    body: 'Focused on the key contextual moves and one or two cross-references. ~500–1,500 words.',
    costRange: 'Approx. $0.10–0.20',
  },
  standard: {
    name: 'Standard',
    tagline: 'Thorough with room to breathe.',
    body: 'Full context for each passage cited, two to three cross-references per point, original-language notes on key terms. ~1,500–3,000 words.',
    costRange: 'Approx. $0.30–0.60',
  },
  comprehensive: {
    name: 'Comprehensive',
    tagline: 'The seven-step protocol in full.',
    body: 'Full context, multiple cross-references, original-language analysis for every key term, historical setting where named sources support it. ~3,000–5,000 words.',
    costRange: 'Approx. $0.70–1.50',
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
