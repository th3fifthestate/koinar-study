// app/lib/auth/step-up.test.ts
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import Database from 'better-sqlite3';

// Must be vi.hoisted so the reference is available when vi.mock runs,
// which is hoisted above imports.
const testDb = vi.hoisted(() => ({ current: null as Database.Database | null }));

vi.mock('@/lib/db/connection', () => ({
  getDb: () => testDb.current!,
}));

// Import AFTER vi.mock is declared so the mocked getDb is picked up.
import {
  hasValidStepUpSession,
  createStepUpSession,
  revokeStepUpSession,
  getStepUpExpiry,
} from './step-up';

const CREATE_TABLE_SQL = `
  CREATE TABLE admin_step_up_sessions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL UNIQUE,
    verified_at TEXT NOT NULL DEFAULT (datetime('now')),
    expires_at TEXT NOT NULL
  )
`;

describe('step-up session helpers', () => {
  beforeEach(() => {
    testDb.current = new Database(':memory:');
    testDb.current.prepare(CREATE_TABLE_SQL).run();
  });

  afterEach(() => {
    testDb.current?.close();
    testDb.current = null;
  });

  describe('hasValidStepUpSession', () => {
    it('returns false for a user with no row', () => {
      expect(hasValidStepUpSession(1)).toBe(false);
    });

    it('returns true after createStepUpSession', () => {
      createStepUpSession(42);
      expect(hasValidStepUpSession(42)).toBe(true);
    });

    it('returns false when expires_at is in the past', () => {
      // Manually insert an expired row to simulate TTL lapse without sleeping.
      testDb.current!
        .prepare(
          `INSERT INTO admin_step_up_sessions (user_id, expires_at)
           VALUES (?, datetime('now', '-1 minute'))`
        )
        .run(7);
      expect(hasValidStepUpSession(7)).toBe(false);
    });

    it('scopes per user_id', () => {
      createStepUpSession(1);
      expect(hasValidStepUpSession(1)).toBe(true);
      expect(hasValidStepUpSession(2)).toBe(false);
    });
  });

  describe('createStepUpSession', () => {
    it('inserts a row with expires_at ~30 minutes after verified_at', () => {
      createStepUpSession(1);
      // Compare within SQLite (same format, no JS TZ ambiguity) — ask it
      // how many minutes apart the two columns are. Expect ~30 (allow
      // ±1 minute for the edge case where datetime('now') straddles a
      // second/minute boundary across two evaluations in one statement).
      const row = testDb.current!
        .prepare(
          `SELECT
             (julianday(expires_at) - julianday(verified_at)) * 24 * 60
             AS minutes_diff
           FROM admin_step_up_sessions WHERE user_id = ?`
        )
        .get(1) as { minutes_diff: number };
      expect(row.minutes_diff).toBeGreaterThanOrEqual(29);
      expect(row.minutes_diff).toBeLessThanOrEqual(31);
    });

    it('upserts — calling twice leaves only one row and extends expiry', () => {
      createStepUpSession(1);
      // Manually backdate the existing row so the upsert's extension is
      // observable. Set expires_at to 1 minute from now (well below the
      // 30-minute TTL) so the upsert should overwrite with a larger value.
      testDb.current!
        .prepare(
          `UPDATE admin_step_up_sessions
           SET expires_at = datetime('now', '+1 minute')
           WHERE user_id = ?`
        )
        .run(1);

      const first = testDb.current!
        .prepare('SELECT expires_at FROM admin_step_up_sessions WHERE user_id = ?')
        .get(1) as { expires_at: string };

      createStepUpSession(1);

      const rows = testDb.current!
        .prepare('SELECT expires_at FROM admin_step_up_sessions WHERE user_id = ?')
        .all(1) as { expires_at: string }[];
      expect(rows).toHaveLength(1);
      // Lexical string compare works because both timestamps are SQLite's
      // native "YYYY-MM-DD HH:MM:SS" format — lexical order == chronological.
      expect(rows[0].expires_at > first.expires_at).toBe(true);
    });
  });

  describe('revokeStepUpSession', () => {
    it('deletes the row for the given user_id', () => {
      createStepUpSession(1);
      createStepUpSession(2);
      revokeStepUpSession(1);
      expect(hasValidStepUpSession(1)).toBe(false);
      expect(hasValidStepUpSession(2)).toBe(true);
    });

    it('no-ops when there is no row', () => {
      expect(() => revokeStepUpSession(999)).not.toThrow();
    });
  });

  describe('getStepUpExpiry', () => {
    it('returns null when no session exists', () => {
      expect(getStepUpExpiry(1)).toBeNull();
    });

    it('returns an ISO-ish timestamp for a valid session', () => {
      createStepUpSession(1);
      const expiry = getStepUpExpiry(1);
      expect(expiry).not.toBeNull();
      // SQLite datetime returns "YYYY-MM-DD HH:MM:SS" — just sanity-check
      // that it parses to a real future date.
      expect(new Date(expiry!).getTime()).toBeGreaterThan(Date.now());
    });

    it('returns null for an expired session', () => {
      testDb.current!
        .prepare(
          `INSERT INTO admin_step_up_sessions (user_id, expires_at)
           VALUES (?, datetime('now', '-1 hour'))`
        )
        .run(5);
      expect(getStepUpExpiry(5)).toBeNull();
    });
  });
});
