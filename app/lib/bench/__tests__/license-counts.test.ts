import { describe, it, expect, vi } from 'vitest'

vi.mock('@/lib/config', () => ({
  config: { bible: { niv: { maxVersesPerView: 25 } } },
}))

vi.mock('@/lib/translations/registry', () => ({
  TRANSLATIONS: {
    NIV:  { isLicensed: true },
    NLT:  { isLicensed: true },
    NASB: { isLicensed: true },
    ESV:  { isLicensed: true },
    BSB:  { isLicensed: false },
  },
}))

import { computeLicenseCounts } from '../license-counts'
import type { BenchClipping } from '@/lib/db/types'

function makeClipping(overrides: Partial<BenchClipping> & { source_ref: string }): BenchClipping {
  return {
    id: crypto.randomUUID(),
    board_id: 'board-1',
    clipping_type: 'verse',
    x: 0, y: 0, width: 300, height: 140,
    color: null, user_label: null, z_index: 0,
    created_at: new Date().toISOString(),
    ...overrides,
  }
}

describe('computeLicenseCounts', () => {
  it('counts NIV verse clippings', () => {
    const clippings = [
      makeClipping({ source_ref: JSON.stringify({ type: 'verse', translation: 'NIV', book: 'John', chapter: 1, verse: 1 }) }),
      makeClipping({ source_ref: JSON.stringify({ type: 'verse', translation: 'NIV', book: 'John', chapter: 1, verse: 2 }) }),
      makeClipping({ source_ref: JSON.stringify({ type: 'verse', translation: 'NIV', book: 'John', chapter: 1, verse: 3 }) }),
    ]
    expect(computeLicenseCounts(clippings)).toEqual({ NIV: 3 })
  })

  it('does not count unlicensed translations', () => {
    const clippings = [
      makeClipping({ source_ref: JSON.stringify({ type: 'verse', translation: 'BSB', book: 'John', chapter: 1, verse: 1 }) }),
    ]
    expect(computeLicenseCounts(clippings)).toEqual({})
  })

  it('counts translation-compare clippings once per licensed translation per verse', () => {
    const clippings = [
      makeClipping({
        clipping_type: 'translation-compare',
        source_ref: JSON.stringify({ type: 'translation-compare', book: 'John', chapter: 1, verse: 1, translations: ['bsb', 'niv', 'nlt'] }),
      }),
    ]
    const counts = computeLicenseCounts(clippings)
    expect(counts.NIV).toBe(1)
    expect(counts.NLT).toBe(1)
    expect((counts as Record<string, number>).BSB).toBeUndefined()
  })

  it('skips placeholder clippings', () => {
    const clippings = [
      makeClipping({ source_ref: JSON.stringify({ placeholder: true, body: 'Drop a verse here' }) }),
    ]
    expect(computeLicenseCounts(clippings)).toEqual({})
  })

  it('skips clippings with unparseable source_ref', () => {
    const clippings = [
      makeClipping({ source_ref: 'not-json' }),
    ]
    expect(computeLicenseCounts(clippings)).toEqual({})
  })
})
