import { describe, it, expect, vi, beforeEach } from 'vitest'

const { mockGetCached, mockAll } = vi.hoisted(() => {
  const mockGetCached = vi.fn().mockReturnValue(null)
  const mockAll = vi.fn().mockReturnValue([
    {
      id: 'clip-1',
      clipping_type: 'verse',
      source_ref: JSON.stringify({
        type: 'verse',
        book: 'John',
        chapter: 3,
        verse: 16,
        translation: 'NIV',
      }),
    },
  ])
  return { mockGetCached, mockAll }
})

vi.mock('@/lib/translations/cache', () => ({
  getCachedVerse: mockGetCached,
}))

vi.mock('@/lib/db/connection', () => ({
  getDb: () => ({ prepare: vi.fn().mockReturnValue({ all: mockAll }) }),
}))

import { prewarmBoard } from '../prewarm'

describe('prewarmBoard', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockAll.mockReturnValue([
      {
        id: 'clip-1',
        clipping_type: 'verse',
        source_ref: JSON.stringify({
          type: 'verse',
          book: 'John',
          chapter: 3,
          verse: 16,
          translation: 'NIV',
        }),
      },
    ])
  })

  it('queries clippings for the given board id', async () => {
    await prewarmBoard('board-1')
    expect(mockAll).toHaveBeenCalled()
  })

  it('resolves without throwing even if cache lookup throws', async () => {
    mockGetCached.mockImplementationOnce(() => { throw new Error('db error') })
    await expect(prewarmBoard('board-1')).resolves.toBeUndefined()
  })
})
