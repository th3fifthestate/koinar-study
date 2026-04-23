'use client'

// app/components/bench/license-meter-chip.tsx
import { useState } from 'react'
import type { TranslationId } from '@/lib/translations/registry'

interface LicenseMeterChipProps {
  translation: TranslationId
  count: number
  cap: number
}

function getState(count: number, cap: number): 'comfortable' | 'approaching' | 'at-cap' {
  const pct = cap > 0 ? count / cap : 1
  if (pct >= 1) return 'at-cap'
  if (pct >= 0.8) return 'approaching'
  return 'comfortable'
}

const STATE_STYLES = {
  comfortable: {
    bg: 'bg-stone-100',
    text: 'text-stone-700',
    dot: 'bg-[var(--sage-500)]',
  },
  approaching: {
    bg: 'bg-[var(--amber-50)]',
    text: 'text-[var(--amber-700)]',
    dot: 'bg-[var(--amber-500)]',
  },
  'at-cap': {
    bg: 'bg-[var(--red-50)]',
    text: 'text-[var(--red-700)]',
    dot: 'bg-[var(--red-500)]',
  },
} as const

export function LicenseMeterChip({ translation, count, cap }: LicenseMeterChipProps) {
  const [showTooltip, setShowTooltip] = useState(false)
  const state = getState(count, cap)
  const { bg, text, dot } = STATE_STYLES[state]

  const tooltipText =
    state === 'comfortable'
      ? `This board is using ${count} of your ${cap} ${translation} verses. Each board is its own display view.`
      : state === 'approaching'
      ? `You're close to the ${translation} display limit on this board. Start a new board for your next set of ${translation} verses.`
      : `You're at the ${translation} display limit on this board. Remove a clipping or change its translation to add more ${translation}.`

  return (
    <div className="relative">
      <a
        href={`/attributions#${translation.toLowerCase()}`}
        target="_blank"
        rel="noopener noreferrer"
        className={`inline-flex items-center gap-2 px-2.5 py-1 rounded-lg text-[12px] tabular-nums
                    ${bg} ${text} transition-colors`}
        aria-label={`${translation} ${count} of ${cap} verses used on this board${count >= cap ? ' — limit reached' : count >= cap * 0.8 ? ' — approaching limit' : ''}`}
        onMouseEnter={() => setShowTooltip(true)}
        onMouseLeave={() => setShowTooltip(false)}
      >
        <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${dot}`} aria-hidden />
        <span>
          <span className="font-semibold">{translation} {count}</span>
          <span className="font-normal"> / {cap}</span>
        </span>
      </a>
      {showTooltip && (
        <div
          className="absolute right-0 top-8 z-50 w-60 rounded-lg bg-popover border border-border
                     shadow-md p-3 text-[12px] text-muted-foreground"
          role="tooltip"
        >
          {tooltipText}
        </div>
      )}
    </div>
  )
}
