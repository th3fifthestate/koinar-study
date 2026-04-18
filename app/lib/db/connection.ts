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

    // v4 → v5: Image generation — add new columns to study_images, add seasonal_images table.
    // The CREATE TABLE IF NOT EXISTS statements above handle seasonal_images creation.
    // For study_images, add columns that don't exist yet (ALTER TABLE ADD COLUMN is idempotent
    // when wrapped in try/catch — SQLite throws if column already exists).
    if (currentVersion >= 4 && currentVersion < 5) {
      const addColumns = [
        "ALTER TABLE study_images ADD COLUMN r2_key TEXT",
        "ALTER TABLE study_images ADD COLUMN style TEXT NOT NULL DEFAULT 'cinematic'",
        "ALTER TABLE study_images ADD COLUMN aspect_ratio TEXT NOT NULL DEFAULT '16:9'",
        "ALTER TABLE study_images ADD COLUMN width INTEGER NOT NULL DEFAULT 1920",
        "ALTER TABLE study_images ADD COLUMN height INTEGER NOT NULL DEFAULT 1080",
        "ALTER TABLE study_images ADD COLUMN size_bytes INTEGER",
        "ALTER TABLE study_images ADD COLUMN is_hero INTEGER NOT NULL DEFAULT 0",
        "ALTER TABLE study_images ADD COLUMN flux_task_id TEXT",
        "ALTER TABLE study_images ADD COLUMN created_by INTEGER REFERENCES users(id)",
      ];
      for (const sql of addColumns) {
        try {
          database.prepare(sql).run();
        } catch {
          // Column already exists — safe to ignore
        }
      }
      // New indexes for is_hero and seasonal_images are created by CREATE_INDEXES below.
    }

    // v5 → v6: Add is_banned column to users for admin ban/unban feature.
    // Condition is currentVersion < 6 (not >= 5) so DBs upgrading from v4 directly also get the column.
    if (currentVersion < 6) {
      try {
        database
          .prepare('ALTER TABLE users ADD COLUMN is_banned INTEGER NOT NULL DEFAULT 0')
          .run();
      } catch {
        // Column already exists — safe to ignore
      }
    }

    // v6 → v7: Add onboarding_completed column to users for Brief 10 onboarding gate.
    if (currentVersion < 7) {
      try {
        database
          .prepare('ALTER TABLE users ADD COLUMN onboarding_completed INTEGER NOT NULL DEFAULT 0')
          .run();
      } catch {
        // Column already exists (fresh DB created by CREATE TABLE) — safe to ignore
      }
    }

    // v7 → v8: Brief 13 translation layer.
    //   - Drop legacy verse_cache (different column shape, confirmed empty on disk);
    //     CREATE_TABLES recreates it with the new PK + fetched_at/lease_expires shape.
    //   - Create fums_events + renewal_meta (CREATE_TABLES handles idempotently).
    //   - Add studies.original_content + studies.current_translation for verse-swap
    //     audit. Backfill original_content from content_markdown on existing rows.
    if (currentVersion < 8) {
      if (currentVersion >= 1) {
        // Pre-existing install: legacy verse_cache has the old shape. Drop it so
        // CREATE_TABLES (which runs before this block in the transaction) can...
        // Note: because CREATE_TABLES already ran above, we must DROP + recreate here.
        database.prepare('DROP TABLE IF EXISTS verse_cache').run();
        runStatements(
          database,
          `CREATE TABLE IF NOT EXISTS verse_cache (
             translation    TEXT    NOT NULL,
             book           TEXT    NOT NULL,
             chapter        INTEGER NOT NULL,
             verse          INTEGER NOT NULL,
             text           TEXT    NOT NULL,
             fetched_at     INTEGER NOT NULL,
             lease_expires  INTEGER NOT NULL,
             last_access    INTEGER NOT NULL,
             fums_token     TEXT,
             PRIMARY KEY (translation, book, chapter, verse)
           );`,
        );
      }
      const studiesColumns = [
        "ALTER TABLE studies ADD COLUMN original_content TEXT",
        "ALTER TABLE studies ADD COLUMN current_translation TEXT NOT NULL DEFAULT 'BSB'",
      ];
      for (const sql of studiesColumns) {
        try {
          database.prepare(sql).run();
        } catch {
          // Column already exists — safe to ignore.
        }
      }
      database
        .prepare(
          "UPDATE studies SET original_content = content_markdown WHERE original_content IS NULL",
        )
        .run();
    }

    // v8 → v9: Settings surface — add api_key_tail and api_key_updated_at to users.
    if (currentVersion < 9) {
      for (const sql of [
        'ALTER TABLE users ADD COLUMN api_key_tail TEXT',
        'ALTER TABLE users ADD COLUMN api_key_updated_at TEXT',
      ]) {
        try { database.prepare(sql).run(); } catch { /* column already exists */ }
      }
    }

    // v9 → v10: TSK cross-reference table (Brief 31a).
    // No data backfill needed — table starts empty; populated by npm run ingest:tsk.
    // CREATE TABLE IF NOT EXISTS in CREATE_TABLES handles creation on fresh DBs.
    if (currentVersion < 10) {
      // No-op: new table is created by runStatements(database, CREATE_TABLES) above.
    }

    // v10 → v11: STEPBible lexicon entries table (Brief 31b).
    // No data backfill needed — table starts empty; populated by npm run ingest:stepbible.
    // CREATE TABLE IF NOT EXISTS in CREATE_TABLES handles creation on fresh DBs.
    if (currentVersion < 11) {
      // No-op: new table is created by runStatements(database, CREATE_TABLES) above.
    }

    // v11 → v12: Study Bench tables + fums_events.surface (Brief 31c).
    // Four new bench_* tables for the canvas-based study bench feature.
    // fums_events.surface tracks which surface triggered a FUMS event (default 'reader').
    // ALTER TABLE must be a separate statement — SQLite does not allow it in a multi-statement exec.
    if (currentVersion < 12) {
      database.prepare(`
        CREATE TABLE IF NOT EXISTS bench_boards (
          id TEXT PRIMARY KEY,
          user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          title TEXT NOT NULL,
          question TEXT NOT NULL DEFAULT '',
          camera_x REAL NOT NULL DEFAULT 0,
          camera_y REAL NOT NULL DEFAULT 0,
          camera_zoom REAL NOT NULL DEFAULT 1,
          is_archived INTEGER NOT NULL DEFAULT 0,
          created_at TEXT NOT NULL DEFAULT (datetime('now')),
          updated_at TEXT NOT NULL DEFAULT (datetime('now'))
        )
      `).run();
      database.prepare('CREATE INDEX IF NOT EXISTS idx_bench_boards_user ON bench_boards(user_id, updated_at DESC)').run();
      database.prepare(`
        CREATE TABLE IF NOT EXISTS bench_clippings (
          id TEXT PRIMARY KEY,
          board_id TEXT NOT NULL REFERENCES bench_boards(id) ON DELETE CASCADE,
          clipping_type TEXT NOT NULL,
          source_ref TEXT NOT NULL,
          x REAL NOT NULL,
          y REAL NOT NULL,
          width REAL NOT NULL,
          height REAL NOT NULL,
          color TEXT,
          user_label TEXT,
          z_index INTEGER NOT NULL DEFAULT 0,
          created_at TEXT NOT NULL DEFAULT (datetime('now'))
        )
      `).run();
      database.prepare('CREATE INDEX IF NOT EXISTS idx_bench_clippings_board ON bench_clippings(board_id)').run();
      database.prepare(`
        CREATE TABLE IF NOT EXISTS bench_connections (
          id TEXT PRIMARY KEY,
          board_id TEXT NOT NULL REFERENCES bench_boards(id) ON DELETE CASCADE,
          from_clipping_id TEXT NOT NULL REFERENCES bench_clippings(id) ON DELETE CASCADE,
          to_clipping_id TEXT NOT NULL REFERENCES bench_clippings(id) ON DELETE CASCADE,
          label TEXT,
          created_at TEXT NOT NULL DEFAULT (datetime('now'))
        )
      `).run();
      database.prepare('CREATE INDEX IF NOT EXISTS idx_bench_connections_board ON bench_connections(board_id)').run();
      database.prepare(`
        CREATE TABLE IF NOT EXISTS bench_recent_clips (
          id TEXT PRIMARY KEY,
          user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          payload TEXT NOT NULL,
          clipped_from_route TEXT,
          created_at TEXT NOT NULL DEFAULT (datetime('now'))
        )
      `).run();
      database.prepare('CREATE INDEX IF NOT EXISTS idx_bench_recent_user ON bench_recent_clips(user_id, created_at DESC)').run();
      try {
        database.prepare("ALTER TABLE fums_events ADD COLUMN surface TEXT NOT NULL DEFAULT 'reader'").run();
      } catch {
        // Column already exists on fresh DBs where CREATE_TABLES already added it
      }
      database.pragma('user_version = 12');
    }

    // CREATE_INDEXES runs after all migration blocks so column additions (ALTER TABLE)
    // are applied before indexes that reference those columns are created.
    runStatements(database, CREATE_INDEXES);

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
