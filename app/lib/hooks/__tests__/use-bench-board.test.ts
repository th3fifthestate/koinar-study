// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'

vi.stubGlobal('fetch', vi.fn())

import { useBenchBoard } from '../use-bench-board'
import type { BenchClipping, BenchConnection } from '@/lib/db/types'

const mockFetch = vi.mocked(fetch)

const makeClipping = (overrides: Partial<BenchClipping> = {}): BenchClipping => ({
  id: 'c1',
  board_id: 'b1',
  clipping_type: 'verse',
  source_ref: '{}',
  x: 0,
  y: 0,
  width: 300,
  height: 140,
  color: null,
  user_label: null,
  z_index: 0,
  created_at: '2026-01-01',
  ...overrides,
})

beforeEach(() => vi.clearAllMocks())

describe('useBenchBoard — initial state', () => {
  it('starts with provided clippings and connections', () => {
    const clip = makeClipping()
    const { result } = renderHook(() => useBenchBoard('b1', [clip], []))
    expect(result.current.clippings).toHaveLength(1)
    expect(result.current.connections).toHaveLength(0)
  })
})

describe('useBenchBoard — addClipping', () => {
  it('optimistically adds clipping before server responds', async () => {
    mockFetch.mockResolvedValueOnce(
      new Response(
        JSON.stringify({ clipping: makeClipping({ id: 'server-id' }) }),
        { status: 201 }
      )
    )
    const { result } = renderHook(() => useBenchBoard('b1', [], []))

    await act(async () => {
      await result.current.addClipping({
        clipping_type: 'verse',
        source_ref: { type: 'verse', book: 'Gen', chapter: 1, verse: 1, translation: 'bsb' },
        x: 100,
        y: 200,
      })
    })

    expect(result.current.clippings).toHaveLength(1)
    expect(result.current.clippings[0].id).toBe('server-id')
  })

  it('rolls back on server error', async () => {
    mockFetch.mockResolvedValueOnce(
      new Response(JSON.stringify({ error: 'fail' }), { status: 500 })
    )
    const { result } = renderHook(() => useBenchBoard('b1', [], []))

    await act(async () => {
      await result.current.addClipping({
        clipping_type: 'verse',
        source_ref: { type: 'verse', book: 'Gen', chapter: 1, verse: 1, translation: 'bsb' },
        x: 100,
        y: 200,
      })
    })

    expect(result.current.clippings).toHaveLength(0)
  })
})

describe('useBenchBoard — moveClipping', () => {
  it('optimistically updates position', async () => {
    mockFetch.mockResolvedValueOnce(
      new Response(
        JSON.stringify({ clipping: makeClipping({ id: 'c1', x: 50, y: 80 }) }),
        { status: 200 }
      )
    )
    const { result } = renderHook(() => useBenchBoard('b1', [makeClipping()], []))

    await act(async () => {
      await result.current.moveClipping('c1', 50, 80)
    })

    expect(result.current.clippings[0].x).toBe(50)
    expect(result.current.clippings[0].y).toBe(80)
  })
})

describe('useBenchBoard — deleteClipping', () => {
  it('removes clipping and its connections optimistically', async () => {
    mockFetch.mockResolvedValueOnce(
      new Response(JSON.stringify({ ok: true }), { status: 200 })
    )
    const conn: BenchConnection = {
      id: 'cn1',
      board_id: 'b1',
      from_clipping_id: 'c1',
      to_clipping_id: 'c2',
      label: null,
      created_at: '2026-01-01',
    }
    const { result } = renderHook(() =>
      useBenchBoard('b1', [makeClipping(), makeClipping({ id: 'c2' })], [conn])
    )

    await act(async () => {
      await result.current.deleteClipping('c1')
    })

    expect(result.current.clippings).toHaveLength(1)
    expect(result.current.connections).toHaveLength(0)
  })

  it('rolls back on server error', async () => {
    mockFetch.mockResolvedValueOnce(
      new Response(JSON.stringify({ error: 'fail' }), { status: 500 })
    )
    const { result } = renderHook(() => useBenchBoard('b1', [makeClipping()], []))

    await act(async () => {
      await result.current.deleteClipping('c1')
    })

    expect(result.current.clippings).toHaveLength(1)
  })
})

describe('useBenchBoard — addConnection', () => {
  it('adds connection after server confirms', async () => {
    const conn: BenchConnection = {
      id: 'cn1',
      board_id: 'b1',
      from_clipping_id: 'c1',
      to_clipping_id: 'c2',
      label: 'leads to',
      created_at: '2026-01-01',
    }
    mockFetch.mockResolvedValueOnce(
      new Response(JSON.stringify({ connection: conn }), { status: 201 })
    )
    const { result } = renderHook(() => useBenchBoard('b1', [], []))

    await act(async () => {
      await result.current.addConnection('c1', 'c2', 'leads to')
    })

    expect(result.current.connections).toHaveLength(1)
    expect(result.current.connections[0].label).toBe('leads to')
  })
})
