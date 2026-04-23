import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockGet = vi.fn()
const mockAll = vi.fn()
const mockRun = vi.fn()
const mockPrepare = vi.fn(() => ({ get: mockGet, all: mockAll, run: mockRun }))
const mockDb = { prepare: mockPrepare }

vi.mock('@/lib/db/connection', () => ({ getDb: () => mockDb }))

import {
  getBenchBoards,
  getBenchBoard,
  createBenchBoard,
  updateBenchBoard,
  deleteBenchBoard,
  getBenchClippings,
  createBenchClipping,
  updateBenchClipping,
  deleteBenchClipping,
  getBenchConnections,
  createBenchConnection,
  updateBenchConnection,
  deleteBenchConnection,
  getRecentVerseSeeds,
} from '../queries'

beforeEach(() => vi.clearAllMocks())

describe('getBenchBoards', () => {
  it('queries boards for user ordered by updated_at desc', () => {
    mockAll.mockReturnValue([])
    getBenchBoards(1)
    expect(mockPrepare).toHaveBeenCalledWith(
      expect.stringContaining('WHERE user_id = ?')
    )
    expect(mockAll).toHaveBeenCalledWith(1)
  })
})

describe('getBenchBoard', () => {
  it('returns null when board not found', () => {
    mockGet.mockReturnValue(undefined)
    expect(getBenchBoard('board-1', 1)).toBeNull()
  })

  it('returns board when user owns it', () => {
    const board = { id: 'board-1', user_id: 1 }
    mockGet.mockReturnValue(board)
    expect(getBenchBoard('board-1', 1)).toEqual(board)
  })
})

describe('createBenchBoard', () => {
  it('runs INSERT and returns new board via get', () => {
    const board = { id: 'b1', user_id: 1, title: 'My Board' }
    mockGet.mockReturnValue(board)
    const result = createBenchBoard(1, 'My Board')
    expect(mockRun).toHaveBeenCalled()
    expect(result).toEqual(board)
  })
})

describe('updateBenchBoard', () => {
  it('builds SET clause from patch keys only', () => {
    mockGet.mockReturnValue({ id: 'b1' })
    updateBenchBoard('b1', 1, { title: 'New Title' })
    const sql = (mockPrepare.mock.calls as unknown as [string][]).find(
      (c) => typeof c[0] === 'string' && c[0].includes('UPDATE bench_boards')
    )?.[0] as string
    expect(sql).toContain('title = ?')
    expect(sql).not.toContain('question = ?')
  })
})

describe('deleteBenchBoard', () => {
  it('deletes by id and user_id', () => {
    deleteBenchBoard('b1', 1)
    expect(mockRun).toHaveBeenCalledWith('b1', 1)
  })
})

describe('createBenchClipping', () => {
  it('inserts clipping and returns it', () => {
    const clipping = { id: 'c1', board_id: 'b1', clipping_type: 'verse' }
    mockGet.mockReturnValue(clipping)
    const result = createBenchClipping({
      id: 'c1', board_id: 'b1', clipping_type: 'verse',
      source_ref: '{}', x: 100, y: 200, width: 300, height: 140,
      color: null, user_label: null, z_index: 0,
    })
    expect(mockRun).toHaveBeenCalled()
    expect(result).toEqual(clipping)
  })
})

describe('updateBenchClipping', () => {
  it('builds SET clause from patch keys', () => {
    mockGet.mockReturnValue({ id: 'c1' })
    updateBenchClipping('c1', 'b1', { x: 50, y: 80 })
    const sql = (mockPrepare.mock.calls as unknown as [string][]).find(
      (c) => typeof c[0] === 'string' && c[0].includes('UPDATE bench_clippings')
    )?.[0] as string
    expect(sql).toContain('x = ?')
    expect(sql).toContain('y = ?')
  })
})

describe('deleteBenchClipping', () => {
  it('deletes by id and board_id to enforce ownership', () => {
    deleteBenchClipping('clip-1', 'board-1')
    const sql = (mockPrepare.mock.calls as unknown as [string][]).at(-1)?.[0] as string
    expect(sql).toContain('board_id = ?')
    expect(mockRun).toHaveBeenCalledWith('clip-1', 'board-1')
  })
})

describe('getBenchConnections', () => {
  it('queries connections for board', () => {
    mockAll.mockReturnValue([])
    getBenchConnections('b1')
    expect(mockPrepare).toHaveBeenCalledWith(
      expect.stringContaining('WHERE board_id = ?')
    )
    expect(mockAll).toHaveBeenCalledWith('b1')
  })
})

describe('createBenchConnection', () => {
  it('inserts connection and returns it', () => {
    const conn = { id: 'cn1', board_id: 'b1' }
    mockGet.mockReturnValue(conn)
    const result = createBenchConnection('b1', 'c1', 'c2', 'leads to')
    expect(mockRun).toHaveBeenCalled()
    expect(result).toEqual(conn)
  })
})

describe('deleteBenchConnection', () => {
  it('deletes by id and board_id', () => {
    deleteBenchConnection('cn1', 'b1')
    const sql = (mockPrepare.mock.calls as unknown as [string][]).at(-1)?.[0] as string
    expect(sql).toContain('board_id = ?')
    expect(mockRun).toHaveBeenCalledWith('cn1', 'b1')
  })
})

describe('getRecentVerseSeeds', () => {
  it('queries bench_clippings for verse type ordered by created_at desc', () => {
    mockAll.mockReturnValue([])
    getRecentVerseSeeds(1, 10)
    const sql = (mockPrepare.mock.calls as unknown as [string][]).at(-1)?.[0] as string
    expect(sql).toContain("clipping_type = 'verse'")
    expect(sql).toContain('LIMIT ?')
    expect(mockAll).toHaveBeenCalledWith(1, 10)
  })
})
