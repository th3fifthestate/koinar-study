// app/lib/translations/fums-tracker.ts
//
// FUMS (Fair Use Monitoring System) event buffer + flush.
//
//   - `recordFumsEvent` writes a row into `fums_events`; called on every
//     licensed-translation fetch and display.
//   - `flushFumsEvents` GETs unflushed rows (those with a fumsToken) to the
//     api.bible FUMS endpoint in batches grouped by session.
//   - `pruneOldFumsEvents` deletes rows older than config.bible.retention.
//
// FUMS spec: https://docs.api.bible/guides/fair-use/
//   GET https://fums.api.bible/f3?t=<token>&t=<token>&dId=<uuid>&sId=<uuid>&uId=<hash>
//   No auth header. Any 2xx = acknowledged. Audio Bibles allow only one `t`
//   per request (N/A — we serve no audio). Response is a 1×1 GIF.

import { getDb } from "@/lib/db/connection";
import { config } from "@/lib/config";
import type { DisplaySurface } from "@/lib/bench/types";
import { getFumsDeviceId, hashFumsUserId } from "@/lib/fums/identity";

const FUMS_ENDPOINT = "https://fums.api.bible/f3";

// Cap concurrent HTTP traffic. 40 fumsTokens per GET keeps the URL under ~2KB
// even with long UUIDs — well below any documented limit but comfortably short
// for proxy tolerance. Raise cautiously; some proxies reject URLs past 4KB.
const TOKENS_PER_REQUEST = 40;

// Rows stop retrying after 10 consecutive failures. They remain in the table
// (flushed_at IS NULL, flush_attempts >= 10) and are eventually pruned by the
// 13-month retention window. Quarantining prevents one bad row from pinning
// the entire batch's flush_attempts counter.
const MAX_FLUSH_ATTEMPTS = 10;

export interface FumsEventInput {
  translation: string;
  fumsToken: string | null;
  eventType: "fetch" | "display";
  studyId?: number;
  userId?: number;
  verseCount: number;
  surface: DisplaySurface;
  /**
   * FUMS session ID — populated from SessionData.sessionId. NULL for events
   * recorded from background scripts (renew-cache) or legacy rows recorded
   * before the sessionId field was added; flushFumsEvents() bucketizes these
   * under a synthetic "cron" session so they still ship.
   */
  sessionId?: string | null;
}

function serializeSurface(surface: DisplaySurface): string {
  return surface.kind === 'reader' ? 'reader' : `bench:${surface.boardId}`;
}

export function recordFumsEvent(ev: FumsEventInput): void {
  const db = getDb();
  db.prepare(
    `INSERT INTO fums_events
       (translation, fums_token, event_type, study_id, user_id, verse_count, created_at, surface, session_id)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    ev.translation,
    ev.fumsToken,
    ev.eventType,
    ev.studyId ?? null,
    ev.userId ?? null,
    ev.verseCount,
    nowSeconds(),
    serializeSurface(ev.surface),
    ev.sessionId ?? null,
  );
}

interface PendingRow {
  id: number;
  fums_token: string;
  user_id: number | null;
  session_id: string | null;
}

type GroupKey = string; // `${sessionBucket}|${userBucket}`

interface GroupedBatch {
  sessionId: string;
  uId: string | null;
  rows: PendingRow[];
}

/**
 * Drains unflushed FUMS events. Groups rows by (sessionId, uId) and issues a
 * GET per group/batch. Rows in a 2xx batch get flushed_at set; rows in a
 * failing batch get flush_attempts incremented (and quarantined at MAX).
 *
 * Transient network failure is non-fatal — the next cron run retries.
 * Permanent failure (api.bible returns 4xx) still increments attempts so a
 * poisonous row eventually quarantines.
 */
export async function flushFumsEvents(
  batchSize = 500,
): Promise<{ flushed: number; attempted: number }> {
  const db = getDb();

  // Skip tokenless rows: FUMS only cares about fetch events with tokens. Display
  // events without a token are audit-only and drained by the 13-month prune.
  // Skip quarantined rows: flush_attempts >= MAX means we've tried 10 times,
  // don't flood the endpoint with known-bad requests.
  const rows = db
    .prepare(
      `SELECT id, fums_token, user_id, session_id
         FROM fums_events
         WHERE flushed_at IS NULL
           AND fums_token IS NOT NULL
           AND flush_attempts < ?
         ORDER BY id ASC
         LIMIT ?`,
    )
    .all(MAX_FLUSH_ATTEMPTS, batchSize) as PendingRow[];

  if (rows.length === 0) {
    return { flushed: 0, attempted: 0 };
  }

  const dId = getFumsDeviceId();

  // Group by (session, user). sessionId NULL → synthetic "cron" bucket so
  // background-script events (renew-cache, admin tools) still ship rather
  // than accumulating forever. Every bucket still gets a real sId value —
  // api.bible requires one.
  const groups = new Map<GroupKey, GroupedBatch>();
  for (const row of rows) {
    const sessionBucket = row.session_id ?? "cron";
    const uBucket = row.user_id ?? "anon";
    const key = `${sessionBucket}|${uBucket}`;
    let bucket = groups.get(key);
    if (!bucket) {
      bucket = {
        sessionId: sessionBucket,
        uId: hashFumsUserId(row.user_id),
        rows: [],
      };
      groups.set(key, bucket);
    }
    bucket.rows.push(row);
  }

  let flushed = 0;

  for (const group of groups.values()) {
    // Chunk each group's rows across multiple GETs so URLs stay short.
    for (let i = 0; i < group.rows.length; i += TOKENS_PER_REQUEST) {
      const chunk = group.rows.slice(i, i + TOKENS_PER_REQUEST);
      try {
        await sendFumsBatch({
          dId,
          sId: group.sessionId,
          uId: group.uId,
          tokens: chunk.map((r) => r.fums_token),
        });
        markRowsFlushed(chunk.map((r) => r.id));
        flushed += chunk.length;
      } catch (err) {
        recordFlushFailure(
          chunk.map((r) => r.id),
          err instanceof Error ? err.message : String(err),
        );
      }
    }
  }

  return { flushed, attempted: rows.length };
}

function markRowsFlushed(ids: number[]): void {
  if (ids.length === 0) return;
  const db = getDb();
  const now = nowSeconds();
  const placeholders = ids.map(() => "?").join(",");
  db.prepare(
    `UPDATE fums_events
       SET flushed_at = ?
     WHERE id IN (${placeholders})`,
  ).run(now, ...ids);
}

function recordFlushFailure(ids: number[], errMessage: string): void {
  if (ids.length === 0) return;
  const db = getDb();
  const placeholders = ids.map(() => "?").join(",");
  // Truncate error to 500 chars — avoid filling disk on repeated errors and
  // never log tokens/PII (CLAUDE.md §4). The message comes from our own
  // sendFumsBatch throw, which only contains status codes / network strings.
  const truncated = errMessage.slice(0, 500);
  db.prepare(
    `UPDATE fums_events
       SET flush_attempts = flush_attempts + 1,
           flush_last_error = ?
     WHERE id IN (${placeholders})`,
  ).run(truncated, ...ids);
}

interface SendBatchInput {
  dId: string;
  sId: string;
  uId: string | null;
  tokens: string[];
}

/**
 * Issues one GET to the FUMS endpoint. Any non-2xx response throws — caller
 * handles flush_attempts accounting. Network errors (fetch throws) also
 * throw, for the same reason. The request response body (a 1×1 GIF) is not
 * read; we discard it.
 */
async function sendFumsBatch(input: SendBatchInput): Promise<void> {
  const params = new URLSearchParams();
  for (const token of input.tokens) {
    params.append("t", token);
  }
  params.set("dId", input.dId);
  params.set("sId", input.sId);
  if (input.uId) {
    params.set("uId", input.uId);
  }

  const url = `${FUMS_ENDPOINT}?${params.toString()}`;
  const res = await fetch(url, { method: "GET" });
  if (!res.ok) {
    throw new Error(`FUMS ${res.status}`);
  }
}

/** Deletes rows older than the retention window (default 13 months). */
export function pruneOldFumsEvents(): { deleted: number } {
  const db = getDb();
  const cutoff =
    nowSeconds() - config.bible.retention.fumsEventMonths * 30 * 24 * 60 * 60;
  const result = db
    .prepare(`DELETE FROM fums_events WHERE created_at < ?`)
    .run(cutoff);
  return { deleted: result.changes as number };
}

function nowSeconds(): number {
  return Math.floor(Date.now() / 1000);
}
