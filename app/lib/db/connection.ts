// app/lib/db/connection.ts
import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';
import { config } from '../config';
import { CREATE_INDEXES, CREATE_TABLES, SCHEMA_VERSION, SEED_CATEGORIES } from './schema';

let db: Database.Database | null = null;

/** Run a SQL string that may contain multiple semicolon-separated statements. */
function runStatements(database: Database.Database, sql: string): void {
  const statements = sql
    .split(';')
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
  for (const stmt of statements) {
    database.prepare(stmt).run();
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

  db = new Database(dbPath);
  applyPragmas(db);
  runMigration(db);

  return db;
}

export function closeDb(): void {
  if (db) {
    db.close();
    db = null;
  }
}
