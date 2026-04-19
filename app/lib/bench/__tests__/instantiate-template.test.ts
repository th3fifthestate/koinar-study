import { describe, it, expect, vi, beforeEach } from 'vitest'

const { mockCreateBoard, mockCreateClipping, mockCreateConnection, insertedClippings, insertedConnections } = vi.hoisted(() => {
  const insertedClippings: Array<{ id: string; board_id: string; clipping_type: string; source_ref: string }> = []
  const insertedConnections: Array<{ from_id: string; to_id: string; label: string | null }> = []
  const mockCreateBoard = vi.fn(() => ({ id: 'board-uuid', title: 'Test', question: '' }))
  const mockCreateClipping = vi.fn((input: { id: string; board_id: string; clipping_type: string; source_ref: string }) => {
    insertedClippings.push({ id: input.id, board_id: input.board_id, clipping_type: input.clipping_type, source_ref: input.source_ref })
  })
  const mockCreateConnection = vi.fn((_id: string, _boardId: string, fromId: string, toId: string, label: string | null) => {
    insertedConnections.push({ from_id: fromId, to_id: toId, label })
  })
  return { mockCreateBoard, mockCreateClipping, mockCreateConnection, insertedClippings, insertedConnections }
})

vi.mock('@/lib/db/bench/queries', () => ({
  createBenchBoardWithQuestion: mockCreateBoard,
  createBenchClippingRaw: mockCreateClipping,
  createBenchConnectionRaw: mockCreateConnection,
}))

vi.mock('@/lib/db/connection', () => ({
  getDb: () => ({ transaction: (fn: () => void) => fn }),
}))

import { instantiateTemplate } from '../../../components/bench/templates/instantiate-template'
import { wordStudy } from '../../../components/bench/templates/word-study'
import { characterStudy } from '../../../components/bench/templates/character-study'
import { passageStudy } from '../../../components/bench/templates/passage-study'
import { blank } from '../../../components/bench/templates/blank'

const opts = { userId: 1, title: 'Test', question: 'What?' }

describe('instantiateTemplate', () => {
  beforeEach(() => {
    insertedClippings.length = 0
    insertedConnections.length = 0
    vi.clearAllMocks()
    mockCreateBoard.mockReturnValue({ id: 'board-uuid', title: 'Test', question: '' })
  })

  it('blank template produces 0 clippings and 0 connections', async () => {
    await instantiateTemplate(blank, opts)
    expect(insertedClippings).toHaveLength(0)
    expect(insertedConnections).toHaveLength(0)
  })

  it('word-study produces 6 clippings and 3 connections', async () => {
    await instantiateTemplate(wordStudy, opts)
    expect(insertedClippings).toHaveLength(6)
    expect(insertedConnections).toHaveLength(3)
  })

  it('character-study produces 9 clippings and 8 connections (7 + 1 bidirectional)', async () => {
    await instantiateTemplate(characterStudy, opts)
    expect(insertedClippings).toHaveLength(9)
    // 6 verse + note-relationships bidirectional = 8 total connections
    expect(insertedConnections).toHaveLength(8)
  })

  it('passage-study produces 6 clippings and 5 connections', async () => {
    await instantiateTemplate(passageStudy, opts)
    expect(insertedClippings).toHaveLength(6)
    expect(insertedConnections).toHaveLength(5)
  })

  it('all clippings have placeholder source_ref', async () => {
    await instantiateTemplate(wordStudy, opts)
    for (const clip of insertedClippings) {
      const ref = JSON.parse(clip.source_ref)
      expect(ref.placeholder).toBe(true)
    }
  })
})
