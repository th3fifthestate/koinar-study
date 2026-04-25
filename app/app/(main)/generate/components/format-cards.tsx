'use client';

import type { Format, Entitlement } from '../types';
import { FormatCard } from './format-card';

interface FormatCardsProps {
  selected: Format;
  onSelect: (f: Format) => void;
  entitlement: Entitlement;
  disabled: boolean;
}

const FORMATS: Format[] = ['quick', 'standard', 'comprehensive'];

export function FormatCards({ selected, onSelect, entitlement, disabled }: FormatCardsProps) {
  return (
    <div>
      {/* Section label */}
      <p
        className="text-[var(--stone-700)] font-semibold uppercase tracking-[0.18em] mb-3"
        style={{ fontSize: '0.7rem' }}
      >
        Choose a depth
      </p>

      {/* Radio group */}
      <div
        role="radiogroup"
        aria-label="Choose a depth"
        className="flex flex-col md:flex-row gap-3"
      >
        {FORMATS.map((format) => (
          <FormatCard
            key={format}
            format={format}
            selected={selected === format}
            onSelect={() => onSelect(format)}
            entitlement={entitlement}
            disabled={disabled}
          />
        ))}
      </div>
    </div>
  );
}
