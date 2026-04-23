import { getDb } from '@/lib/db/connection'
import type { BenchBoard, BenchClipping, BenchConnection } from '@/lib/db/types'

// Explicit column lists — CLAUDE.md §3 forbids SELECT * and un-allowlisted
// column names in dynamic SQL. Update these when the schema changes.
const BOARD_COLS =
  'id, user_id, title, question, camera_x, camera_y, camera_zoom, is_archived, created_at, updated_at'
const CLIPPING_COLS =
  'id, board_id, clipping_type, source_ref, x, y, width, height, color, user_label, z_index, created_at'
const CONNECTION_COLS = 'id, board_id, from_clipping_id, to_clipping_id, label, created_at'

const BOARD_PATCH_COLS = new Set([
  'title',
  'question',
  'camera_x',
  'camera_y',
  'camera_zoom',
  'is_archived',
])
const CLIPPING_PATCH_COLS = new Set([
  'x',
  'y',
  'width',
  'height',
  'color',
  'user_label',
  'z_index',
  'source_ref',
])

// ── Boards ──────────────────────────────────────────────────────────────────

export function getBenchBoards(userId: number): BenchBoard[] {
  return getDb()
    .prepare(
      `SELECT ${BOARD_COLS} FROM bench_boards WHERE user_id = ? AND is_archived = 0 ORDER BY updated_at DESC`
    )
    .all(userId) as BenchBoard[]
}

export function getBenchBoard(boardId: string, userId: number): BenchBoard | null {
  return (
    (getDb()
      .prepare(`SELECT ${BOARD_COLS} FROM bench_boards WHERE id = ? AND user_id = ?`)
      .get(boardId, userId) as BenchBoard | undefined) ?? null
  )
}

export function createBenchBoard(userId: number, title: string): BenchBoard {
  const db = getDb()
  const id = crypto.randomUUID()
  db.prepare(
    `INSERT INTO bench_boards (id, user_id, title, question, camera_x, camera_y, camera_zoom)
     VALUES (?, ?, ?, '', 0, 0, 1)`
  ).run(id, userId, title)
  return db
    .prepare(`SELECT ${BOARD_COLS} FROM bench_boards WHERE id = ?`)
    .get(id) as BenchBoard
}

export function createBenchBoardWithQuestion(
  userId: number,
  title: string,
  question: string
): BenchBoard {
  const db = getDb()
  const id = crypto.randomUUID()
  db.prepare(
    `INSERT INTO bench_boards (id, user_id, title, question, camera_x, camera_y, camera_zoom)
     VALUES (?, ?, ?, ?, 0, 0, 1)`
  ).run(id, userId, title, question)
  return db
    .prepare(`SELECT ${BOARD_COLS} FROM bench_boards WHERE id = ?`)
    .get(id) as BenchBoard
}

interface CreateClippingRawInput {
  id: string
  board_id: string
  clipping_type: BenchClipping['clipping_type']
  source_ref: string
  x: number
  y: number
  width: number
  height: number
}

export function createBenchClippingRaw(input: CreateClippingRawInput): void {
  getDb().prepare(
    `INSERT INTO bench_clippings (id, board_id, clipping_type, source_ref, x, y, width, height, z_index)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0)`
  ).run(input.id, input.board_id, input.clipping_type, input.source_ref, input.x, input.y, input.width, input.height)
}

export function createBenchConnectionRaw(
  id: string,
  boardId: string,
  fromId: string,
  toId: string,
  label: string | null
): void {
  getDb().prepare(
    `INSERT INTO bench_connections (id, board_id, from_clipping_id, to_clipping_id, label)
     VALUES (?, ?, ?, ?, ?)`
  ).run(id, boardId, fromId, toId, label ?? null)
}

export function updateBenchBoard(
  boardId: string,
  userId: number,
  patch: Partial<
    Pick<BenchBoard, 'title' | 'question' | 'camera_x' | 'camera_y' | 'camera_zoom' | 'is_archived'>
  >
): BenchBoard | null {
  const db = getDb()
  const entries = Object.entries(patch).filter(([k]) => BOARD_PATCH_COLS.has(k))
  if (entries.length === 0) return getBenchBoard(boardId, userId)
  const sets = entries.map(([k]) => `${k} = ?`).join(', ')
  const values = entries.map(([, v]) => v)
  db.prepare(
    `UPDATE bench_boards SET ${sets}, updated_at = datetime('now') WHERE id = ? AND user_id = ?`
  ).run(...values, boardId, userId)
  return getBenchBoard(boardId, userId)
}

export function deleteBenchBoard(boardId: string, userId: number): void {
  getDb()
    .prepare('DELETE FROM bench_boards WHERE id = ? AND user_id = ?')
    .run(boardId, userId)
}

// ── Clippings ────────────────────────────────────────────────────────────────

export function getBenchClippings(boardId: string): BenchClipping[] {
  return getDb()
    .prepare(
      `SELECT ${CLIPPING_COLS} FROM bench_clippings WHERE board_id = ? ORDER BY z_index ASC, created_at ASC`
    )
    .all(boardId) as BenchClipping[]
}

export function getBenchClippingBoardId(clippingId: string): string | null {
  const row = getDb()
    .prepare('SELECT board_id FROM bench_clippings WHERE id = ?')
    .get(clippingId) as { board_id: string } | undefined
  return row?.board_id ?? null
}

export interface CreateClippingInput {
  id: string
  board_id: string
  clipping_type: BenchClipping['clipping_type']
  source_ref: string
  x: number
  y: number
  width: number
  height: number
  color: string | null
  user_label: string | null
  z_index: number
}

export function createBenchClipping(input: CreateClippingInput): BenchClipping {
  const db = getDb()
  db.prepare(
    `INSERT INTO bench_clippings
       (id, board_id, clipping_type, source_ref, x, y, width, height, color, user_label, z_index)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    input.id,
    input.board_id,
    input.clipping_type,
    input.source_ref,
    input.x,
    input.y,
    input.width,
    input.height,
    input.color,
    input.user_label,
    input.z_index
  )
  return db
    .prepare(`SELECT ${CLIPPING_COLS} FROM bench_clippings WHERE id = ?`)
    .get(input.id) as BenchClipping
}

export function updateBenchClipping(
  clippingId: string,
  boardId: string,
  patch: Partial<
    Pick<BenchClipping, 'x' | 'y' | 'width' | 'height' | 'color' | 'user_label' | 'z_index' | 'source_ref'>
  >
): BenchClipping | null {
  const db = getDb()
  const entries = Object.entries(patch).filter(([k]) => CLIPPING_PATCH_COLS.has(k))
  if (entries.length === 0) return null
  const sets = entries.map(([k]) => `${k} = ?`).join(', ')
  const values = entries.map(([, v]) => v)
  db.prepare(
    `UPDATE bench_clippings SET ${sets} WHERE id = ? AND board_id = ?`
  ).run(...values, clippingId, boardId)
  return (
    (db
      .prepare(`SELECT ${CLIPPING_COLS} FROM bench_clippings WHERE id = ?`)
      .get(clippingId) as BenchClipping | undefined) ?? null
  )
}

export function deleteBenchClipping(clippingId: string, boardId: string): void {
  getDb()
    .prepare('DELETE FROM bench_clippings WHERE id = ? AND board_id = ?')
    .run(clippingId, boardId)
}

// ── Connections ──────────────────────────────────────────────────────────────

export function getBenchConnections(boardId: string): BenchConnection[] {
  return getDb()
    .prepare(
      `SELECT ${CONNECTION_COLS} FROM bench_connections WHERE board_id = ? ORDER BY created_at ASC`
    )
    .all(boardId) as BenchConnection[]
}

export function createBenchConnection(
  boardId: string,
  fromId: string,
  toId: string,
  label: string | null
): BenchConnection {
  const db = getDb()
  const id = crypto.randomUUID()
  db.prepare(
    `INSERT INTO bench_connections (id, board_id, from_clipping_id, to_clipping_id, label)
     VALUES (?, ?, ?, ?, ?)`
  ).run(id, boardId, fromId, toId, label)
  return db
    .prepare(`SELECT ${CONNECTION_COLS} FROM bench_connections WHERE id = ?`)
    .get(id) as BenchConnection
}

export function updateBenchConnection(
  connectionId: string,
  boardId: string,
  label: string | null
): BenchConnection | null {
  const db = getDb()
  db.prepare('UPDATE bench_connections SET label = ? WHERE id = ? AND board_id = ?').run(
    label,
    connectionId,
    boardId
  )
  return (
    (db
      .prepare(`SELECT ${CONNECTION_COLS} FROM bench_connections WHERE id = ?`)
      .get(connectionId) as BenchConnection | undefined) ?? null
  )
}

export function deleteBenchConnection(connectionId: string, boardId: string): void {
  getDb()
    .prepare('DELETE FROM bench_connections WHERE id = ? AND board_id = ?')
    .run(connectionId, boardId)
}

// ── Source drawer seeds ──────────────────────────────────────────────────────

export function getRecentVerseSeeds(
  userId: number,
  limit: number
): Array<{ source_ref: string; created_at: string }> {
  return getDb()
    .prepare(
      `SELECT DISTINCT source_ref, MAX(created_at) AS created_at
       FROM bench_clippings
       WHERE board_id IN (SELECT id FROM bench_boards WHERE user_id = ?)
         AND clipping_type = 'verse'
       GROUP BY source_ref
       ORDER BY created_at DESC
       LIMIT ?`
    )
    .all(userId, limit) as Array<{ source_ref: string; created_at: string }>
}
