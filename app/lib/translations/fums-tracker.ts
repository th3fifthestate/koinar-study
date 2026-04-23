// app/lib/translations/fums-tracker.ts
//
// FUMS (Fair Use Management System) event buffer.
//
//   - `recordFumsEvent` writes a row into `fums_events`; called on every
//     licensed-translation fetch and display.
//   - `flushFumsEvents` POSTs unflushed rows to the FUMS endpoint in batches.
//     TODO(brief-13-followup): confirm endpoint URL + payload format from
//     docs.api.bible; the current stub flushes by marking rows and logging,
//     so we can ship the schema + tracker today.
//   - `pruneOldFumsEvents` deletes rows older than config.bible.retention.

import { getDb } from "@/lib/db/connection";
import { config } from "@/lib/config";
import type { DisplaySurface } from "@/lib/bench/types";

export interface FumsEventInput {
  translation: string;
  fumsToken: string | null;
  eventType: "fetch" | "display";
  studyId?: number;
  userId?: number;
  verseCount: number;
  surface: DisplaySurface;
}

function serializeSurface(surface: DisplaySurface): string {
  return surface.kind === 'reader' ? 'reader' : `bench:${surface.boardId}`;
}

export function recordFumsEvent(ev: FumsEventInput): void {
  const db = getDb();
  db.prepare(
    `INSERT INTO fums_events
       (translation, fums_token, event_type, study_id, user_id, verse_count, created_at, surface)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    ev.translation,
    ev.fumsToken,
    ev.eventType,
    ev.studyId ?? null,
    ev.userId ?? null,
    ev.verseCount,
    nowSeconds(),
    serializeSurface(ev.surface),
  );
}

/**
 * Flushes unreported events to the FUMS endpoint in batches. Intentionally a
 * no-op until the endpoint is wired — marking events `flushed_at` locally
 * would drop compliance data the first time this ships with a real POST
 * (pre-existing rows would already be marked flushed and never reported).
 *
 * The 13-month retention prune (`pruneOldFumsEvents`) gives months of
 * headroom before unflushed rows become a storage concern. When the real
 * endpoint lands: POST the batch, and ONLY on 2xx set `flushed_at`.
 *
 * TODO(brief-13-followup): confirm endpoint URL + payload format from
 * docs.api.bible and implement the POST here.
 */
export async function flushFumsEvents(
  batchSize = 500,
): Promise<{ flushed: number; attempted: number }> {
  const db = getDb();
  const rows = db
    .prepare(
      `SELECT id FROM fums_events WHERE flushed_at IS NULL
        ORDER BY id ASC LIMIT ?`,
    )
    .all(batchSize) as Array<{ id: number }>;

  return { flushed: 0, attempted: rows.length };
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
