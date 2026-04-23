import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import Database from 'better-sqlite3';

const CREATE_TABLE_SQL = `
  CREATE TABLE admin_actions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    admin_id INTEGER NOT NULL,
    action_type TEXT NOT NULL,
    target_type TEXT NOT NULL,
    target_id INTEGER,
    details TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  )
`;

const INSERT_SQL = `
  INSERT INTO admin_actions (admin_id, action_type, target_type, target_id, details)
  VALUES (?, ?, ?, ?, ?)
`;

describe('admin_actions INSERT shape', () => {
  let db: Database.Database;

  beforeEach(() => {
    db = new Database(':memory:');
    db.prepare(CREATE_TABLE_SQL).run();
  });

  afterEach(() => {
    db.close();
  });

  it('inserts a row with all required fields', () => {
    db.prepare(INSERT_SQL).run(1, 'ban_user', 'user', 42, JSON.stringify({ reason: 'spam' }));

    const row = db.prepare('SELECT * FROM admin_actions').get() as Record<string, unknown>;
    expect(row.admin_id).toBe(1);
    expect(row.action_type).toBe('ban_user');
    expect(row.target_type).toBe('user');
    expect(row.target_id).toBe(42);
    expect(JSON.parse(row.details as string)).toEqual({ reason: 'spam' });
  });

  it('accepts null details', () => {
    db.prepare(INSERT_SQL).run(1, 'feature_study', 'study', 7, null);

    const row = db.prepare('SELECT * FROM admin_actions').get() as Record<string, unknown>;
    expect(row.details).toBeNull();
  });

  it('rejects null action_type (NOT NULL constraint)', () => {
    expect(() =>
      db.prepare(INSERT_SQL).run(1, null, 'study', 7, null)
    ).toThrow();
  });
});
