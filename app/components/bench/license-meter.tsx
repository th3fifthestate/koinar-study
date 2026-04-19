'use client'

// app/components/bench/license-meter.tsx
import React, { useMemo } from 'react'
import { useBenchBoardContext } from './bench-board-context'
import { computeLicenseCounts, LICENSED_VERSE_CAPS } from '@/lib/bench/license-counts'
import { LicenseMeterChip } from './license-meter-chip'
import type { TranslationId } from '@/lib/translations/registry'

const DISPLAY_ORDER: TranslationId[] = ['NIV', 'NLT', 'NASB', 'ESV']

export const LicenseMeter = React.memo(function LicenseMeter() {
  const { clippings } = useBenchBoardContext()

  const counts = useMemo(() => computeLicenseCounts(clippings), [clippings])

  const chips = DISPLAY_ORDER
    .map((tid) => ({ tid, count: counts[tid] ?? 0, cap: LICENSED_VERSE_CAPS[tid] ?? 0 }))
    .filter(({ count }) => count > 0)

  if (chips.length === 0) return null

  return (
    <div className="flex items-center gap-1.5 shrink-0">
      {chips.map(({ tid, count, cap }) => (
        <LicenseMeterChip key={tid} translation={tid} count={count} cap={cap} />
      ))}
    </div>
  )
})
