// @vitest-environment node
import Database from 'better-sqlite3'
import { describe, it, expect, beforeEach, vi } from 'vitest'

function buildInMemoryDb(): Database.Database {
  const db = new Database(':memory:')
  db.prepare('CREATE TABLE users (id INTEGER PRIMARY KEY)').run()
  db.prepare(`
    CREATE TABLE bench_user_flags (
      user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
      has_seen_bench_intro INTEGER NOT NULL DEFAULT 0,
      has_drawn_first_connection INTEGER NOT NULL DEFAULT 0,
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `).run()
  db.prepare('INSERT INTO users (id) VALUES (1)').run()
  return db
}

const mockDb = buildInMemoryDb()

vi.mock('@/lib/db/connection', () => ({ getDb: () => mockDb }))

const { getUserFlags, patchUserFlags } = await import('@/lib/bench/user-flags')

describe('getUserFlags', () => {
  it('returns defaults when no row exists', () => {
    const flags = getUserFlags(1)
    expect(flags.has_seen_bench_intro).toBe(0)
    expect(flags.has_drawn_first_connection).toBe(0)
  })
})

describe('patchUserFlags', () => {
  beforeEach(() => {
    mockDb.prepare('DELETE FROM bench_user_flags').run()
  })

  it('upserts has_seen_bench_intro', () => {
    patchUserFlags(1, { has_seen_bench_intro: 1 })
    expect(getUserFlags(1).has_seen_bench_intro).toBe(1)
  })

  it('upserts has_drawn_first_connection', () => {
    patchUserFlags(1, { has_drawn_first_connection: 1 })
    expect(getUserFlags(1).has_drawn_first_connection).toBe(1)
  })

  it('preserves existing flags when patching only one', () => {
    patchUserFlags(1, { has_seen_bench_intro: 1 })
    patchUserFlags(1, { has_drawn_first_connection: 1 })
    const flags = getUserFlags(1)
    expect(flags.has_seen_bench_intro).toBe(1)
    expect(flags.has_drawn_first_connection).toBe(1)
  })
})
