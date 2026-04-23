import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockGet = vi.fn()
const mockAll = vi.fn()
const mockRun = vi.fn()
const mockPrepare = vi.fn(() => ({ get: mockGet, all: mockAll, run: mockRun }))
const mockDb = { prepare: mockPrepare }

vi.mock('@/lib/db/connection', () => ({ getDb: () => mockDb }))
vi.mock('crypto', () => ({ randomUUID: () => 'test-uuid-123' }))

import {
  getRecentClips,
  createRecentClip,
  deleteRecentClip,
  purgeOldestRecentClips,
} from '../recent-clips-queries'

beforeEach(() => vi.clearAllMocks())

const payload = JSON.stringify({ type: 'verse', source_ref: { book: 'John', chapter: 3, verse: 16, translation: 'bsb' } })

describe('getRecentClips', () => {
  it('queries clips for user ordered by created_at desc', () => {
    mockAll.mockReturnValue([])
    getRecentClips(1, 50)
    expect(mockPrepare).toHaveBeenCalledWith(expect.stringContaining('WHERE user_id = ?'))
    expect(mockAll).toHaveBeenCalledWith('1', 50)
  })
})

describe('createRecentClip', () => {
  it('inserts a row and returns it via get', () => {
    const clip = { id: 'test-uuid-123', user_id: '1', payload, clipped_from_route: '/study/test', created_at: '2026-01-01T00:00:00.000Z' }
    mockGet.mockReturnValue(clip)
    const result = createRecentClip(1, payload, '/study/test')
    expect(mockRun).toHaveBeenCalled()
    expect(result).toEqual(clip)
  })

  it('passes userId as string to SQL', () => {
    mockGet.mockReturnValue({})
    createRecentClip(42, payload, null)
    expect(mockRun).toHaveBeenCalledWith('test-uuid-123', '42', payload, null, expect.any(String))
  })
})

describe('deleteRecentClip', () => {
  it('deletes by id and userId', () => {
    deleteRecentClip('clip-id', 1)
    expect(mockPrepare).toHaveBeenCalledWith(expect.stringContaining('WHERE id = ? AND user_id = ?'))
    expect(mockRun).toHaveBeenCalledWith('clip-id', '1')
  })
})

describe('purgeOldestRecentClips', () => {
  it('deletes rows outside the keepCount window', () => {
    purgeOldestRecentClips(1, 100)
    expect(mockPrepare).toHaveBeenCalledWith(expect.stringContaining('LIMIT ?'))
    expect(mockRun).toHaveBeenCalledWith('1', '1', 100)
  })
})
