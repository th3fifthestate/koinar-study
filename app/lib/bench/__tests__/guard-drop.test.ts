import { describe, it, expect, vi, beforeEach } from 'vitest'

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

import { guardDrop } from '../guard-drop'
import type { BenchClipping } from '@/lib/db/types'

function makeNivClipping(verse: number): BenchClipping {
  return {
    id: `clip-${verse}`,
    board_id: 'board-1',
    clipping_type: 'verse',
    source_ref: JSON.stringify({ type: 'verse', translation: 'NIV', book: 'Romans', chapter: 1, verse }),
    x: 0, y: 0, width: 300, height: 140,
    color: null, user_label: null, z_index: 0,
    created_at: new Date().toISOString(),
  }
}

function makeNltClipping(verse: number): BenchClipping {
  return {
    ...makeNivClipping(verse),
    id: `nlt-${verse}`,
    source_ref: JSON.stringify({ type: 'verse', translation: 'NLT', book: 'Romans', chapter: 1, verse }),
  }
}

describe('guardDrop', () => {
  const board25 = {
    id: 'board-1',
    clippings: Array.from({ length: 25 }, (_, i) => makeNivClipping(i + 1)),
  }

  it('blocks a 26th NIV verse when board has 25', () => {
    const result = guardDrop({ clippingType: 'verse', translation: 'NIV' }, board25)
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.reason).toBe('niv-cap')
      expect(result.modalProps.translation).toBe('NIV')
      expect(result.modalProps.count).toBe(25)
      expect(result.modalProps.cap).toBe(25)
    }
  })

  it('allows a 25th NIV verse when board has 24', () => {
    const board24 = { id: 'board-1', clippings: Array.from({ length: 24 }, (_, i) => makeNivClipping(i + 1)) }
    const result = guardDrop({ clippingType: 'verse', translation: 'NIV' }, board24)
    expect(result.ok).toBe(true)
  })

  it('allows a 26th NLT verse (cap is 500)', () => {
    const boardWithNlt = {
      id: 'board-1',
      clippings: Array.from({ length: 25 }, (_, i) => makeNltClipping(i + 1)),
    }
    const result = guardDrop({ clippingType: 'verse', translation: 'NLT' }, boardWithNlt)
    expect(result.ok).toBe(true)
  })

  it('allows BSB drops without cap check', () => {
    const result = guardDrop({ clippingType: 'verse', translation: 'BSB' }, board25)
    expect(result.ok).toBe(true)
  })

  it('returns other-cap for non-NIV licensed cap hit', () => {
    const boardWith500Nlt = {
      id: 'board-1',
      clippings: Array.from({ length: 500 }, (_, i) => makeNltClipping(i + 1)),
    }
    const result = guardDrop({ clippingType: 'verse', translation: 'NLT' }, boardWith500Nlt)
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.reason).toBe('other-cap')
      expect(result.modalProps.translation).toBe('NLT')
      expect(result.modalProps.cap).toBe(500)
    }
  })
})
