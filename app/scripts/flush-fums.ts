// app/scripts/flush-fums.ts
//
// Dedicated FUMS flush entry point.
//
// Deployment: Railway cron service runs this hourly alongside renew-cache.ts.
// Both scripts flush FUMS events, but running a dedicated flush more frequently
// (or as a standalone backfill) keeps the unflushed queue short under spikes
// without coupling to the renewal cadence.
//
// Steps:
//   1. Flush up to 2,000 buffered FUMS events in one pass.
//   2. Prune any rows past the 13-month retention window.
//
// Exits 0 on success, 1 on thrown error. Flush failures inside
// flushFumsEvents() are tracked per-row via flush_attempts — they do NOT throw
// out of this script unless the DB itself is unreachable.
//
// Safe to run concurrently with renew-cache.ts: the SELECT in flushFumsEvents
// uses ORDER BY id + LIMIT, and markRowsFlushed/recordFlushFailure are
// idempotent — at worst two runs double-attempt the same batch, which is
// harmless at the FUMS endpoint (GET with repeated tokens).

import {
  flushFumsEvents,
  pruneOldFumsEvents,
} from "@/lib/translations/fums-tracker";

const BATCH_SIZE = 2000;

async function main(): Promise<void> {
  const startedAt = Date.now();

  const flush = await flushFumsEvents(BATCH_SIZE);
  const prune = pruneOldFumsEvents();

  console.log("[flush-fums] done", {
    ms: Date.now() - startedAt,
    flushed: flush.flushed,
    attempted: flush.attempted,
    pruned: prune.deleted,
  });
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("[flush-fums] fatal", err);
    process.exit(1);
  });
