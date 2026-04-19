import { getDb } from '@/lib/db/connection'
import type { BenchUserFlags } from '@/lib/db/types'

type FlagPatch = Partial<Pick<BenchUserFlags, 'has_seen_bench_intro' | 'has_drawn_first_connection'>>

export function getUserFlags(userId: number): BenchUserFlags {
  const db = getDb()
  const row = db
    .prepare(
      'SELECT user_id, has_seen_bench_intro, has_drawn_first_connection, updated_at FROM bench_user_flags WHERE user_id = ?'
    )
    .get(userId) as BenchUserFlags | undefined

  return row ?? {
    user_id: userId,
    has_seen_bench_intro: 0,
    has_drawn_first_connection: 0,
    updated_at: new Date().toISOString(),
  }
}

export function patchUserFlags(userId: number, patch: FlagPatch): void {
  const db = getDb()
  const existing = getUserFlags(userId)
  db.prepare(`
    INSERT INTO bench_user_flags
      (user_id, has_seen_bench_intro, has_drawn_first_connection, updated_at)
    VALUES (?, ?, ?, datetime('now'))
    ON CONFLICT(user_id) DO UPDATE SET
      has_seen_bench_intro = excluded.has_seen_bench_intro,
      has_drawn_first_connection = excluded.has_drawn_first_connection,
      updated_at = datetime('now')
  `).run(
    userId,
    patch.has_seen_bench_intro ?? existing.has_seen_bench_intro,
    patch.has_drawn_first_connection ?? existing.has_drawn_first_connection,
  )
}
