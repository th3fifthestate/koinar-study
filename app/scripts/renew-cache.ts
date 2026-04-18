// app/scripts/renew-cache.ts
//
// Translation cache renewal job. Deployment: Railway cron service running
// this script hourly (see founders-files/brief-13-plan.md §5). Not an
// in-process interval — in-process timers reset on deploy and duplicate
// under horizontal scaling.
//
// Steps on each run:
//   1. Refetch rows whose lease has crossed the 75% renewal threshold.
//   2. Flush buffered FUMS events in one batch of 500.
//   3. Once per 24h (tracked via renewal_meta): prune FUMS events > 13 months.
//   4. Enforce storage cap per licensed translation.
//
// Exits 0 on success, 1 on any thrown error. Railway treats non-zero as
// a failed run and surfaces it in the dashboard.

import { getDb } from "@/lib/db/connection";
import { config } from "@/lib/config";
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

const PRUNE_META_KEY = "fums_prune_last_run";
const PRUNE_INTERVAL_SECONDS = 24 * 60 * 60;

async function main(): Promise<void> {
  const startedAt = Date.now();
  const stats = {
    renewed: 0,
    renewalErrors: 0,
    fumsFlushed: 0,
    fumsPruned: 0 as number | null,
    capEvictions: {} as Record<string, number>,
  };

  // --- 1. DHCP renewals ---
  const due = findRowsDueForRenewal();
  for (const row of due) {
    try {
      await renewRow(row);
      stats.renewed++;
    } catch (err) {
      stats.renewalErrors++;
      // Server-side cron: log both user-safe message and server-only details
      // (upstream status + body slice). CLAUDE.md §6 forbids returning
      // `details` to clients — logs are fine and necessary for ops.
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

  // --- 2. FUMS flush ---
  const flush = await flushFumsEvents(500);
  stats.fumsFlushed = flush.flushed;

  // --- 3. 24h-gated retention prune ---
  if (shouldPruneFums()) {
    const result = pruneOldFumsEvents();
    stats.fumsPruned = result.deleted;
    setRenewalMeta(PRUNE_META_KEY, nowSeconds());
  } else {
    stats.fumsPruned = null;
  }

  // --- 4. Per-translation storage cap ---
  for (const t of Object.values(TRANSLATIONS)) {
    if (!t.isLicensed) continue;
    const { deleted } = enforceStorageCap(t.id);
    if (deleted > 0) stats.capEvictions[t.id] = deleted;
  }

  console.log("[renew-cache] done", {
    ms: Date.now() - startedAt,
    ...stats,
  });
}

async function renewRow(row: CachedVerse): Promise<void> {
  if (row.translation === "NLT" || row.translation === "NIV" || row.translation === "NASB") {
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
      // TODO: renew-cache runs outside a request context — no studyId available.
      recordFumsEvent({
        translation: row.translation,
        fumsToken: v.fumsToken,
        eventType: "fetch",
        verseCount: 1,
        surface: { kind: 'reader', studyId: 'unknown' },
      });
    }
    return;
  }
  if (row.translation === "ESV") {
    // ESV renewal requires a display book name for the `q=` parameter.
    // Renewal-time book display name resolution is deferred until PR 2 wires
    // the swap engine (which already does slug → display). Skip with a
    // logged TODO so the cron doesn't error.
    console.warn(
      "[renew-cache] ESV renewal skipped pending slug→display helper (PR 2)",
      { book: row.book, chapter: row.chapter, verse: row.verse },
    );
    return;
  }
  // BSB / KJV / WEB are local — no renewal needed.
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

// Silence "unused variable" warning if config is only referenced indirectly.
void config;

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("[renew-cache] fatal", err);
    process.exit(1);
  });
