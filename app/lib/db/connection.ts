// app/lib/db/connection.ts
import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';
import { config } from '../config';
import { CREATE_INDEXES, CREATE_TABLES, SCHEMA_VERSION, SEED_CATEGORIES } from './schema';

const g = globalThis as typeof globalThis & { __appDb?: Database.Database };
let db: Database.Database | null = g.__appDb ?? null;

/**
 * Run a SQL string that may contain multiple semicolon-separated statements.
 * NOTE: Uses naive semicolon splitting — do not pass SQL with semicolons inside
 * quoted string literals (e.g. VALUES ('foo;bar')). Safe for schema constants.
 */
function runStatements(database: Database.Database, sql: string): void {
  // Split on semicolons, but respect BEGIN...END blocks (used in triggers).
  const statements: string[] = [];
  let current = '';
  let inBlock = false;
  for (const line of sql.split('\n')) {
    const trimmed = line.trim().toUpperCase();
    current += line + '\n';
    if (!inBlock && trimmed.endsWith('BEGIN')) {
      inBlock = true;
    } else if (inBlock && trimmed === 'END;') {
      statements.push(current.trim());
      current = '';
      inBlock = false;
    } else if (!inBlock && line.includes(';')) {
      const parts = current.split(';');
      for (let i = 0; i < parts.length - 1; i++) {
        const s = parts[i].trim();
        if (s.length > 0) statements.push(s);
      }
      current = parts[parts.length - 1];
    }
  }
  const last = current.trim();
  if (last.length > 0) statements.push(last.replace(/;$/, ''));

  for (const stmt of statements) {
    if (stmt.length > 0) database.prepare(stmt).run();
  }
}

function applyPragmas(database: Database.Database): void {
  database.pragma('journal_mode = WAL');
  database.pragma('busy_timeout = 5000');
  database.pragma('synchronous = NORMAL');
  database.pragma('cache_size = -20000');
  database.pragma('foreign_keys = ON');
  database.pragma('temp_store = MEMORY');
}

function getCurrentVersion(database: Database.Database): number {
  try {
    const row = database
      .prepare('SELECT MAX(version) as version FROM schema_migrations')
      .get() as { version: number | null };
    return row?.version ?? 0;
  } catch {
    // schema_migrations table does not exist yet
    return 0;
  }
}

function runMigration(database: Database.Database): void {
  const currentVersion = getCurrentVersion(database);
  if (currentVersion >= SCHEMA_VERSION) return;

  database.transaction(() => {
    runStatements(database, CREATE_TABLES);
    runStatements(database, CREATE_INDEXES);

    if (currentVersion === 0) {
      runStatements(database, SEED_CATEGORIES);
    }

    // v1 → v2: Populate FTS5 index from existing studies
    if (currentVersion >= 1 && currentVersion < 2) {
      const count = (database.prepare('SELECT COUNT(*) as c FROM studies').get() as { c: number }).c;
      if (count > 0) {
        database.prepare(
          `INSERT INTO studies_fts(rowid, title, summary, content_markdown)
           SELECT id, title, summary, content_markdown FROM studies`
        ).run();
      }
    }

    // v2 → v3: Entity knowledge layer tables
    // No data backfill needed — entities table starts empty.
    // CREATE TABLE IF NOT EXISTS statements in CREATE_TABLES handle table creation automatically.
    // This block exists as a version marker and for any future one-time data migration.
    if (currentVersion >= 2 && currentVersion < 3) {
      // No-op: new tables are created by runStatements(database, CREATE_TABLES) above.
      // Triggers and indexes are created by runStatements(database, CREATE_INDEXES) above.
    }

    // v3 → v4: Annotations schema overhaul — adds selected_text, note_text, named color
    // enum, updated_at, and changes is_public default from 1 to 0.
    // No production annotation data exists (feature was never implemented), so the
    // table is dropped and recreated. Indexes are re-created explicitly because
    // CREATE_INDEXES ran before this block on the now-dropped old table.
    if (currentVersion >= 3 && currentVersion < 4) {
      database.prepare('DROP TABLE IF EXISTS annotations').run();
      database.prepare(`
        CREATE TABLE annotations (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          study_id INTEGER NOT NULL REFERENCES studies(id) ON DELETE CASCADE,
          user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          type TEXT NOT NULL CHECK(type IN ('highlight', 'note')),
          color TEXT NOT NULL DEFAULT 'yellow' CHECK(color IN ('yellow', 'green', 'blue', 'pink', 'purple')),
          start_offset INTEGER NOT NULL,
          end_offset INTEGER NOT NULL CHECK(end_offset > start_offset),
          selected_text TEXT NOT NULL,
          note_text TEXT,
          is_public INTEGER NOT NULL DEFAULT 0,
          created_at TEXT NOT NULL DEFAULT (datetime('now')),
          updated_at TEXT NOT NULL DEFAULT (datetime('now'))
        )
      `).run();
      database.prepare('CREATE INDEX IF NOT EXISTS idx_annotations_study ON annotations(study_id)').run();
      database.prepare('CREATE INDEX IF NOT EXISTS idx_annotations_user ON annotations(user_id)').run();
      database.prepare('CREATE INDEX IF NOT EXISTS idx_annotations_study_public ON annotations(study_id, is_public)').run();
      database.prepare('CREATE INDEX IF NOT EXISTS idx_annotations_type ON annotations(study_id, type)').run();
    }

    database
      .prepare('INSERT OR REPLACE INTO schema_migrations (version) VALUES (?)')
      .run(SCHEMA_VERSION);
  })();
}

export function getDb(): Database.Database {
  if (db) return db;

  const dbPath = config.db.app;
  const dbDir = path.dirname(dbPath);
  fs.mkdirSync(dbDir, { recursive: true });

  const connection = new Database(dbPath);
  try {
    applyPragmas(connection);
    runMigration(connection);
  } catch (err) {
    connection.close();
    throw err;
  }

  db = connection;
  g.__appDb = connection;
  return db;
}

export function closeDb(): void {
  if (db) {
    db.close();
    db = null;
    g.__appDb = undefined;
  }
}
