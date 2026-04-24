// app/lib/auth/step-up.ts
//
// Admin step-up session helpers. A step-up session is a short-lived
// (30-minute rolling TTL) marker in admin_step_up_sessions that indicates
// the admin has recently passed a TOTP challenge. The Route Handler for
// /api/study/generate consults this before handing out the platform
// Anthropic key: no step-up row, or an expired one, and the request is
// rejected with STEP_UP_REQUIRED so the UI can prompt for a TOTP code.
//
// Why a DB row instead of a flag on the session cookie?
//   - Revocable server-side without rotating the login session.
//   - Survives process restarts (important for in-memory rate-limit maps
//     that could otherwise drift).
//   - One row per admin user (UNIQUE constraint on user_id) keeps bookkeeping
//     trivial — upsert on verify, delete on revoke.
//   - If an admin's laptop gets stolen, `admin-reset-totp.ts` can wipe
//     everything in one transaction.

import { getDb } from '@/lib/db/connection';

/**
 * TTL in minutes, per the Brief 26 spec. Passed as a SQLite datetime modifier
 * ('+30 minutes') so expires_at stays in SQLite's native format — same format
 * as datetime('now') — which keeps lexical comparisons in WHERE clauses honest.
 * Change requires bumping the UI copy.
 */
const STEP_UP_TTL_MINUTES = 30;
const TTL_MODIFIER = `+${STEP_UP_TTL_MINUTES} minutes`;

/**
 * Returns true if the admin currently has a valid (non-expired) step-up
 * session. Safe to call on every /study/generate request — it's a single
 * indexed lookup.
 */
export function hasValidStepUpSession(userId: number): boolean {
  const row = getDb()
    .prepare(
      `SELECT 1 AS found FROM admin_step_up_sessions
       WHERE user_id = ? AND expires_at > datetime('now')`
    )
    .get(userId) as { found: number } | undefined;
  return row !== undefined;
}

/**
 * Upsert a step-up session. Called after a successful TOTP verify. Always
 * resets expires_at to now + TTL so every verify buys the admin another
 * 30 minutes.
 */
export function createStepUpSession(userId: number): void {
  getDb()
    .prepare(
      `INSERT INTO admin_step_up_sessions (user_id, verified_at, expires_at)
       VALUES (?, datetime('now'), datetime('now', ?))
       ON CONFLICT(user_id) DO UPDATE SET
         verified_at = datetime('now'),
         expires_at = datetime('now', ?)`
    )
    .run(userId, TTL_MODIFIER, TTL_MODIFIER);
}

/**
 * Revoke an admin's step-up session immediately. Called from an explicit
 * "sign out of admin mode" action and from the reset-TOTP script to
 * guarantee the gate re-challenges on next use.
 */
export function revokeStepUpSession(userId: number): void {
  getDb()
    .prepare('DELETE FROM admin_step_up_sessions WHERE user_id = ?')
    .run(userId);
}

/**
 * Returns the expiry timestamp (ISO 8601) of the admin's current step-up
 * session, or null if none. UI uses this to show a countdown.
 */
export function getStepUpExpiry(userId: number): string | null {
  const row = getDb()
    .prepare(
      `SELECT expires_at FROM admin_step_up_sessions
       WHERE user_id = ? AND expires_at > datetime('now')`
    )
    .get(userId) as { expires_at: string } | undefined;
  return row?.expires_at ?? null;
}
