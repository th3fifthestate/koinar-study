// app/lib/fums/identity.ts
//
// Identity helpers for the FUMS (Fair Use Monitoring System) flush. The
// api.bible spec (https://docs.api.bible/guides/fair-use/) defines three
// identifiers on every ping:
//
//   - dId (device ID)   required, constant for device lifetime, no PII
//   - sId (session ID)  required, unique random per session, regenerated per session
//   - uId (user ID)     optional,  no PII; sha256-hashable
//
// For Koinar's server-side deployment:
//   - The server IS the "device" from api.bible's perspective. A single dId
//     per deployment is correct — per-browser fingerprinting would be PII-
//     adjacent and is explicitly forbidden.
//   - sId is captured at login in SessionData.sessionId and travels with
//     every FUMS event via the session_id column on fums_events.
//   - uId is sha256(userId + FUMS_UID_SALT) truncated to 32 hex chars. The
//     salt prevents cross-deployment correlation; truncation keeps the query
//     string short (every byte matters when we're batching up to ~40 tokens
//     per GET).

import { createHash, randomUUID } from "crypto";
import { getDb } from "@/lib/db/connection";
import { config } from "@/lib/config";

const DEVICE_ID_KEY = "fums.device_id";

/**
 * Returns the deployment-scoped FUMS device ID. Minted on first call and
 * persisted in app_config; constant for the lifetime of the DB file. Never
 * contains PII — it's a bare UUIDv4.
 *
 * Cheap: a single PK SELECT. Safe to call on every flush.
 */
export function getFumsDeviceId(): string {
  const db = getDb();
  const existing = db
    .prepare(`SELECT value FROM app_config WHERE key = ?`)
    .get(DEVICE_ID_KEY) as { value: string } | undefined;
  if (existing?.value) return existing.value;

  const fresh = randomUUID();
  db.prepare(
    `INSERT OR IGNORE INTO app_config (key, value) VALUES (?, ?)`,
  ).run(DEVICE_ID_KEY, fresh);

  // Re-read in case a concurrent process minted first (INSERT OR IGNORE leaves
  // the earlier row in place). Cron runs single-instance but tests may race.
  const final = db
    .prepare(`SELECT value FROM app_config WHERE key = ?`)
    .get(DEVICE_ID_KEY) as { value: string };
  return final.value;
}

/**
 * Returns the FUMS uId for a given user. sha256(userId + salt), truncated to
 * 32 hex chars (128 bits of collision space — plenty for per-user uniqueness
 * on the api.bible side, and keeps query strings tight). Returns null when no
 * salt is configured, which is explicitly allowed (uId is optional per FUMS).
 *
 * Do NOT cache across users — a shared hash would leak one user's uId to
 * another. Compute per event-group.
 */
export function hashFumsUserId(userId: number | null): string | null {
  if (userId == null) return null;
  const salt = config.bible.fumsUidSalt;
  if (!salt) return null;
  return createHash("sha256")
    .update(`${userId}:${salt}`)
    .digest("hex")
    .slice(0, 32);
}

/**
 * Mints a new session ID for iron-session on login. Called from the four
 * login/register routes. Not a crypto-security primitive — api.bible only
 * uses it to disambiguate usage sessions — but uuid-v4 is fine and avoids
 * collisions.
 */
export function newFumsSessionId(): string {
  return randomUUID();
}
