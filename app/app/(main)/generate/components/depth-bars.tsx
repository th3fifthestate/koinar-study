'use client';

import type { Format } from '../types';

interface DepthBarsProps {
  format: Format;
}

const DEPTHS: Record<Format, number> = { simple: 1, standard: 2, comprehensive: 3 };

export function DepthBars({ format }: DepthBarsProps) {
  const count = DEPTHS[format];
  return (
    <div className="flex gap-[4px] items-end h-[12px]" aria-hidden="true">
      {[1, 2, 3].map((i) => (
        <span
          key={i}
          className={`inline-block w-[6px] rounded-sm transition-all duration-200 ${
            i <= count ? 'bg-[var(--sage-500)] h-[12px]' : 'bg-[var(--stone-200)] h-[6px]'
          }`}
        />
      ))}
    </div>
  );
}
