import { getDb } from '@/lib/db/connection'
import { randomUUID } from 'crypto'

const COLS = 'id, user_id, payload, clipped_from_route, created_at'

export interface BenchRecentClip {
  id: string
  user_id: string
  payload: string
  clipped_from_route: string | null
  created_at: string
}

export function getRecentClips(userId: number, limit = 50): BenchRecentClip[] {
  return getDb()
    .prepare(
      `SELECT ${COLS} FROM bench_recent_clips WHERE user_id = ? ORDER BY created_at DESC LIMIT ?`
    )
    .all(String(userId), limit) as BenchRecentClip[]
}

export function createRecentClip(
  userId: number,
  payload: string,
  clippedFromRoute: string | null
): BenchRecentClip {
  const db = getDb()
  const id = randomUUID()
  const now = new Date().toISOString()
  db.prepare(
    `INSERT INTO bench_recent_clips (id, user_id, payload, clipped_from_route, created_at) VALUES (?, ?, ?, ?, ?)`
  ).run(id, String(userId), payload, clippedFromRoute, now)
  return db
    .prepare(`SELECT ${COLS} FROM bench_recent_clips WHERE id = ?`)
    .get(id) as BenchRecentClip
}

export function deleteRecentClip(id: string, userId: number): void {
  getDb()
    .prepare(`DELETE FROM bench_recent_clips WHERE id = ? AND user_id = ?`)
    .run(id, String(userId))
}

export function purgeOldestRecentClips(userId: number, keepCount: number): void {
  getDb()
    .prepare(
      `DELETE FROM bench_recent_clips
       WHERE user_id = ? AND id NOT IN (
         SELECT id FROM bench_recent_clips WHERE user_id = ? ORDER BY created_at DESC LIMIT ?
       )`
    )
    .run(String(userId), String(userId), keepCount)
}
