// app/lib/bench/license-counts.ts
import { config } from '@/lib/config'
import type { BenchClipping, BenchClippingSourceRef } from '@/lib/db/types'
import type { TranslationId } from '@/lib/translations/registry'
import { TRANSLATIONS } from '@/lib/translations/registry'

// Per-board licensed verse caps (per brief 34a §6).
// NIV comes from config; others are contractual constants.
export const LICENSED_VERSE_CAPS: Partial<Record<TranslationId, number>> = {
  NIV:  config.bible.niv.maxVersesPerView,  // 25
  NLT:  500,
  NASB: 1000,
  ESV:  500,
}

/**
 * Counts how many licensed verses are on the board, grouped by translation.
 * Translation-compare clippings count each licensed translation once per verse
 * (not N times for N translations), matching brief 34a §6 contract.
 */
export function computeLicenseCounts(
  clippings: BenchClipping[]
): Partial<Record<TranslationId, number>> {
  const counts: Partial<Record<TranslationId, number>> = {}

  for (const clip of clippings) {
    let ref: BenchClippingSourceRef
    try {
      ref = JSON.parse(clip.source_ref) as BenchClippingSourceRef
    } catch {
      continue
    }

    // Skip placeholders
    if ('placeholder' in ref && ref.placeholder) continue

    if ('type' in ref) {
      if (ref.type === 'verse') {
        const tid = ref.translation.toUpperCase() as TranslationId
        if (TRANSLATIONS[tid]?.isLicensed) {
          counts[tid] = (counts[tid] ?? 0) + 1
        }
      } else if (ref.type === 'translation-compare') {
        for (const t of ref.translations) {
          const tid = t.toUpperCase() as TranslationId
          if (TRANSLATIONS[tid]?.isLicensed) {
            counts[tid] = (counts[tid] ?? 0) + 1
          }
        }
      }
    }
  }

  return counts
}
