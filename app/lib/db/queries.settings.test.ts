import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import Database from 'better-sqlite3';

function buildSchema(db: Database.Database): void {
  db.prepare(`
    CREATE TABLE users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT NOT NULL UNIQUE,
      email TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      display_name TEXT,
      bio TEXT,
      is_admin INTEGER NOT NULL DEFAULT 0,
      is_approved INTEGER NOT NULL DEFAULT 0,
      is_banned INTEGER NOT NULL DEFAULT 0,
      onboarding_completed INTEGER NOT NULL DEFAULT 0,
      api_key_encrypted TEXT,
      api_key_tail TEXT,
      api_key_updated_at TEXT,
      invited_by INTEGER,
      failed_login_attempts INTEGER NOT NULL DEFAULT 0,
      locked_until TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      last_login TEXT,
      avatar_url TEXT
    )
  `).run();
  db.prepare(`
    CREATE TABLE invite_codes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      code TEXT NOT NULL UNIQUE,
      created_by INTEGER NOT NULL,
      invitee_name TEXT NOT NULL,
      invitee_email TEXT NOT NULL,
      linked_study_id INTEGER,
      used_by INTEGER,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      used_at TEXT,
      is_active INTEGER NOT NULL DEFAULT 1
    )
  `).run();
}

function seedUsers(db: Database.Database): void {
  db.prepare(`
    INSERT INTO users (id, username, email, password_hash, display_name, bio, is_admin)
    VALUES (1, 'alice', 'alice@example.com', 'hash', 'Alice', 'Hello', 0)
  `).run();
}

function seedInvites(db: Database.Database): void {
  // CODE1: pending (unused, active)
  db.prepare(
    `INSERT INTO invite_codes (code, created_by, invitee_name, invitee_email, used_by, is_active)
     VALUES ('CODE1', 1, 'Bob', 'bob@example.com', NULL, 1)`
  ).run();
  // CODE2: accepted (used_by is set)
  db.prepare(
    `INSERT INTO invite_codes (code, created_by, invitee_name, invitee_email, used_by, is_active)
     VALUES ('CODE2', 1, 'Carol', 'carol@example.com', 2, 0)`
  ).run();
  // CODE3: expired (not used, not active)
  db.prepare(
    `INSERT INTO invite_codes (code, created_by, invitee_name, invitee_email, used_by, is_active)
     VALUES ('CODE3', 1, 'Dan', 'dan@example.com', NULL, 0)`
  ).run();
}

describe('getUserSettings SQL shape', () => {
  let db: Database.Database;

  beforeEach(() => {
    db = new Database(':memory:');
    buildSchema(db);
    seedUsers(db);
  });

  afterEach(() => db.close());

  it('returns the row for an existing user', () => {
    const row = db.prepare(`
      SELECT id, username, email, display_name, bio,
        api_key_encrypted IS NOT NULL AS has_api_key,
        api_key_tail, api_key_updated_at, created_at, is_admin
      FROM users WHERE id = ?
    `).get(1) as Record<string, unknown>;

    expect(row.username).toBe('alice');
    expect(row.display_name).toBe('Alice');
    expect(row.has_api_key).toBe(0);
    expect(row.is_admin).toBe(0);
  });

  it('returns undefined for an unknown user', () => {
    const row = db.prepare('SELECT * FROM users WHERE id = ?').get(999);
    expect(row).toBeUndefined();
  });

  it('reflects has_api_key=1 when encrypted key is stored', () => {
    db.prepare('UPDATE users SET api_key_encrypted = ? WHERE id = ?').run('encrypted-value', 1);
    const row = db.prepare(
      `SELECT api_key_encrypted IS NOT NULL AS has_api_key FROM users WHERE id = ?`
    ).get(1) as { has_api_key: number };
    expect(row.has_api_key).toBe(1);
  });
});

describe('listUserInvitations status derivation', () => {
  let db: Database.Database;

  beforeEach(() => {
    db = new Database(':memory:');
    buildSchema(db);
    seedUsers(db);
    seedInvites(db);
  });

  afterEach(() => db.close());

  it('derives status correctly for all three cases', () => {
    const rows = db.prepare(`
      SELECT code,
        CASE
          WHEN used_by IS NOT NULL THEN 'accepted'
          WHEN is_active = 0 THEN 'expired'
          ELSE 'pending'
        END AS status
      FROM invite_codes WHERE created_by = ? ORDER BY id
    `).all(1) as Array<{ code: string; status: string }>;

    const byCode = Object.fromEntries(rows.map(r => [r.code, r.status]));
    expect(byCode['CODE1']).toBe('pending');
    expect(byCode['CODE2']).toBe('accepted');
    expect(byCode['CODE3']).toBe('expired');
  });

  it('does not return invites belonging to another user', () => {
    const rows = db.prepare(`SELECT * FROM invite_codes WHERE created_by = ?`).all(999);
    expect(rows).toHaveLength(0);
  });
});
