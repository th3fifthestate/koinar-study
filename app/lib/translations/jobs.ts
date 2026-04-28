// app/lib/translations/jobs.ts
//
// Reusable job bodies for the FUMS flush and translation-cache renewal work.
// Both the CLI scripts (scripts/flush-fums.ts, scripts/renew-cache.ts) and the
// in-process scheduler (cron-scheduler.ts) call these. Single source of truth
// for job behavior, so a manual `npx tsx scripts/flush-fums.ts` run and a
// scheduled in-process firing produce identical effects.

import { config } from "@/lib/config";
import { getDb } from "@/lib/db/connection";
import { fetchApiBiblePassage } from "@/lib/translations/api-bible-client";
import {
  enforceStorageCap,
  findRowsDueForRenewal,
  setCachedVerse,
  type CachedVerse,
} from "@/lib/translations/cache";
import {
  flushFumsEvents,
  pruneOldFumsEvents,
  recordFumsEvent,
} from "@/lib/translations/fums-tracker";
import { TRANSLATIONS } from "@/lib/translations/registry";

const FLUSH_BATCH_SIZE = 2000;
const RENEW_FLUSH_BATCH_SIZE = 500;
const PRUNE_META_KEY = "fums_prune_last_run";
const PRUNE_INTERVAL_SECONDS = 24 * 60 * 60;

export interface FlushFumsStats {
  ms: number;
  flushed: number;
  attempted: number;
  pruned: number;
}

export interface RenewCacheStats {
  ms: number;
  renewed: number;
  renewalErrors: number;
  fumsFlushed: number;
  /** null = skipped this run (24h gate not crossed). */
  fumsPruned: number | null;
  capEvictions: Record<string, number>;
}

/**
 * FUMS flush job.
 *   1. Drain up to 2,000 unflushed events to fums.api.bible/f3.
 *   2. Prune any rows past the 13-month retention window.
 * Failures inside flushFumsEvents are tracked per-row via flush_attempts and
 * do NOT throw out — only DB-level errors propagate.
 */
export async function runFlushFumsJob(): Promise<FlushFumsStats> {
  const startedAt = Date.now();
  const flush = await flushFumsEvents(FLUSH_BATCH_SIZE);
  const prune = pruneOldFumsEvents();
  return {
    ms: Date.now() - startedAt,
    flushed: flush.flushed,
    attempted: flush.attempted,
    pruned: prune.deleted,
  };
}

/**
 * Translation cache renewal job.
 *   1. Refetch rows past 75% lease.
 *   2. Flush 500 buffered FUMS events.
 *   3. Once per 24h: prune FUMS > 13 months.
 *   4. Per-translation storage cap eviction.
 */
export async function runRenewCacheJob(): Promise<RenewCacheStats> {
  const startedAt = Date.now();
  const stats: RenewCacheStats = {
    ms: 0,
    renewed: 0,
    renewalErrors: 0,
    fumsFlushed: 0,
    fumsPruned: 0,
    capEvictions: {},
  };

  const due = findRowsDueForRenewal();
  for (const row of due) {
    try {
      await renewRow(row);
      stats.renewed++;
    } catch (err) {
      stats.renewalErrors++;
      const message = err instanceof Error ? err.message : String(err);
      const details =
        err && typeof err === "object" && "details" in err
          ? (err as { details?: unknown }).details
          : undefined;
      const statusCode =
        err && typeof err === "object" && "statusCode" in err
          ? (err as { statusCode?: unknown }).statusCode
          : undefined;
      console.error(
        "[renew-cache] renewal failed",
        {
          translation: row.translation,
          book: row.book,
          chapter: row.chapter,
          verse: row.verse,
          statusCode,
        },
        message,
        details,
      );
    }
  }

  const flush = await flushFumsEvents(RENEW_FLUSH_BATCH_SIZE);
  stats.fumsFlushed = flush.flushed;

  if (shouldPruneFums()) {
    const result = pruneOldFumsEvents();
    stats.fumsPruned = result.deleted;
    setRenewalMeta(PRUNE_META_KEY, nowSeconds());
  } else {
    stats.fumsPruned = null;
  }

  for (const t of Object.values(TRANSLATIONS)) {
    if (!t.isLicensed) continue;
    const { deleted } = enforceStorageCap(t.id);
    if (deleted > 0) stats.capEvictions[t.id] = deleted;
  }

  stats.ms = Date.now() - startedAt;
  return stats;
}

async function renewRow(row: CachedVerse): Promise<void> {
  if (
    row.translation === "NLT" ||
    row.translation === "NIV" ||
    row.translation === "NASB"
  ) {
    const verses = await fetchApiBiblePassage({
      translation: row.translation,
      book: row.book,
      chapter: row.chapter,
      verseStart: row.verse,
      verseEnd: row.verse,
    });
    for (const v of verses) {
      setCachedVerse({
        translation: row.translation,
        book: v.book,
        chapter: v.chapter,
        verse: v.verse,
        text: v.text,
        fumsToken: v.fumsToken,
      });
      recordFumsEvent({
        translation: row.translation,
        fumsToken: v.fumsToken,
        eventType: "fetch",
        verseCount: 1,
        surface: { kind: "reader", studyId: "system:renew-cache" },
      });
    }
    return;
  }
  if (row.translation === "ESV") {
    console.warn(
      "[renew-cache] ESV renewal skipped pending slug→display helper (PR 2)",
      { book: row.book, chapter: row.chapter, verse: row.verse },
    );
    return;
  }
  // BSB/KJV/WEB are local — no renewal needed.
}

function shouldPruneFums(): boolean {
  const last = getRenewalMeta(PRUNE_META_KEY);
  return last === null || nowSeconds() - last >= PRUNE_INTERVAL_SECONDS;
}

function getRenewalMeta(key: string): number | null {
  const row = getDb()
    .prepare(`SELECT value_int FROM renewal_meta WHERE key = ?`)
    .get(key) as { value_int: number | null } | undefined;
  return row?.value_int ?? null;
}

function setRenewalMeta(key: string, value: number): void {
  getDb()
    .prepare(
      `INSERT INTO renewal_meta (key, value_int) VALUES (?, ?)
       ON CONFLICT(key) DO UPDATE SET value_int = excluded.value_int`,
    )
    .run(key, value);
}

function nowSeconds(): number {
  return Math.floor(Date.now() / 1000);
}

// Hold a reference so unused-import warnings don't strip config (it's
// indirectly required by the cache + api-bible client during execution).
void config;
