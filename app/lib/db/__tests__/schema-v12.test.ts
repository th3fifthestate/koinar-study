import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import Database from 'better-sqlite3'
import { CREATE_TABLES, CREATE_INDEXES } from '../schema'

// Helper: apply schema to a fresh in-memory DB
// Mirrors what connection.ts does: runStatements(CREATE_TABLES) then runStatements(CREATE_INDEXES)
function runStatements(database: Database.Database, sql: string): void {
  const statements: string[] = []
  let current = ''
  let inBlock = false
  for (const line of sql.split('\n')) {
    const trimmed = line.trim().toUpperCase()
    current += line + '\n'
    if (!inBlock && trimmed.endsWith('BEGIN')) {
      inBlock = true
    } else if (inBlock && trimmed === 'END;') {
      statements.push(current.trim())
      current = ''
      inBlock = false
    } else if (!inBlock && line.includes(';')) {
      const parts = current.split(';')
      for (let i = 0; i < parts.length - 1; i++) {
        const s = parts[i].trim()
        if (s.length > 0) statements.push(s)
      }
      current = parts[parts.length - 1]
    }
  }
  const last = current.trim()
  if (last.length > 0) statements.push(last.replace(/;$/, ''))
  for (const stmt of statements) {
    if (stmt.length > 0) database.prepare(stmt).run()
  }
}

function applySchema(db: Database.Database): void {
  db.pragma('foreign_keys = OFF') // allow forward-refs in CREATE TABLE IF NOT EXISTS
  runStatements(db, CREATE_TABLES)
  runStatements(db, CREATE_INDEXES)
  db.pragma('foreign_keys = ON')
}

describe('schema v12', () => {
  let db: Database.Database

  beforeEach(() => {
    db = new Database(':memory:')
    applySchema(db)
  })

  afterEach(() => db.close())

  it('creates bench_boards', () => {
    const row = db
      .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='bench_boards'")
      .get()
    expect(row).toBeDefined()
  })

  it('creates bench_clippings', () => {
    const row = db
      .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='bench_clippings'")
      .get()
    expect(row).toBeDefined()
  })

  it('creates bench_connections', () => {
    const row = db
      .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='bench_connections'")
      .get()
    expect(row).toBeDefined()
  })

  it('creates bench_recent_clips', () => {
    const row = db
      .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='bench_recent_clips'")
      .get()
    expect(row).toBeDefined()
  })

  it('fums_events has surface column', () => {
    const info = db.prepare('PRAGMA table_info(fums_events)').all() as Array<{ name: string }>
    expect(info.find(c => c.name === 'surface')).toBeDefined()
  })

  it('fums_events surface defaults to reader', () => {
    db
      .prepare("INSERT INTO fums_events (translation, event_type, verse_count, created_at) VALUES ('NIV', 'display', 1, 0)")
      .run()
    const row = db.prepare('SELECT surface FROM fums_events LIMIT 1').get() as { surface: string }
    expect(row.surface).toBe('reader')
  })
})
