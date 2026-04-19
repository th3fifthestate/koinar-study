// app/lib/bench/guard-drop.ts
import type { BenchClipping } from '@/lib/db/types'
import type { TranslationId } from '@/lib/translations/registry'
import { TRANSLATIONS } from '@/lib/translations/registry'
import { computeLicenseCounts, LICENSED_VERSE_CAPS } from './license-counts'

export interface LicenseCapModalProps {
  translation: TranslationId
  count: number
  cap: number
  boardId: string
}

export interface GuardDropIntended {
  clippingType: BenchClipping['clipping_type']
  translation?: string          // for verse clippings
  translations?: string[]       // for translation-compare clippings
}

export type GuardDropResult =
  | { ok: true }
  | { ok: false; reason: 'niv-cap' | 'other-cap'; modalProps: LicenseCapModalProps }

export function guardDrop(
  intended: GuardDropIntended,
  board: { id: string; clippings: BenchClipping[] }
): GuardDropResult {
  const currentCounts = computeLicenseCounts(board.clippings)

  // Collect translations the intended drop would add
  const tidsToCheck: string[] = []
  if (intended.clippingType === 'verse' && intended.translation) {
    tidsToCheck.push(intended.translation.toUpperCase())
  } else if (intended.clippingType === 'translation-compare' && intended.translations) {
    for (const t of intended.translations) {
      tidsToCheck.push(t.toUpperCase())
    }
  }

  for (const tidStr of tidsToCheck) {
    const tid = tidStr as TranslationId
    if (!TRANSLATIONS[tid]?.isLicensed) continue

    const cap = LICENSED_VERSE_CAPS[tid]
    if (cap === undefined) continue

    const current = currentCounts[tid] ?? 0
    if (current >= cap) {
      return {
        ok: false,
        reason: tid === 'NIV' ? 'niv-cap' : 'other-cap',
        modalProps: { translation: tid, count: current, cap, boardId: board.id },
      }
    }
  }

  return { ok: true }
}
