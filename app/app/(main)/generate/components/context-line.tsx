'use client';

import Link from 'next/link';
import type { Format, Entitlement } from '../types';

interface ContextLineProps {
  entitlement: Entitlement;
  selectedFormat: Format;
}

const FORMAT_LABELS: Record<Format, string> = {
  quick: 'Quick',
  standard: 'Standard',
  comprehensive: 'Comprehensive',
};

export function ContextLine({ entitlement, selectedFormat }: ContextLineProps) {
  if (entitlement.kind === 'none') {
    return null;
  }

  if (entitlement.kind === 'byok') {
    return (
      <p className="text-[var(--stone-700)]" style={{ fontSize: '1rem' }}>
        Using your Anthropic key.{' '}
        <Link
          href="/settings?tab=api-key"
          className="text-[var(--sage-700)] underline hover:text-[var(--sage-600)]"
        >
          [change]
        </Link>
      </p>
    );
  }

  if (entitlement.kind === 'admin') {
    return (
      <p className="text-[var(--stone-700)]" style={{ fontSize: '1rem' }}>
        Using the platform key.
      </p>
    );
  }

  // gift
  const { credits } = entitlement;
  const selectedCredits = credits[selectedFormat] ?? 0;

  if (selectedCredits > 0) {
    return (
      <p className="text-[var(--sage-700)]" style={{ fontSize: '1rem' }}>
        One gift-code credit will be used.
      </p>
    );
  }

  // 0 credits for selected format — check if any other format has credits
  const otherFormats = (Object.keys(credits) as Format[]).filter(
    (f) => f !== selectedFormat && (credits[f] ?? 0) > 0,
  );

  if (otherFormats.length > 0) {
    const otherFormat = otherFormats[0];
    const otherCount = credits[otherFormat] ?? 0;
    return (
      <p className="text-[var(--stone-700)]" style={{ fontSize: '1rem' }}>
        No credits for this depth. You have {otherCount} for {FORMAT_LABELS[otherFormat]}.
      </p>
    );
  }

  // 0 credits overall — don't render
  return null;
}
