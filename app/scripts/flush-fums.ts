// app/scripts/flush-fums.ts
//
// CLI entry point for a one-shot FUMS flush + retention prune.
//
// Production path: the in-process scheduler in lib/translations/cron-scheduler.ts
// runs the same job (runFlushFumsJob) on the schedule. This script exists for
// manual flushing during incident response, ad-hoc backfills, or local
// verification — it shares the body, so behavior is identical.
//
// Exits 0 on success, 1 on thrown error. Per-row flush failures inside
// flushFumsEvents() are tracked via flush_attempts and do NOT throw out.

import { runFlushFumsJob } from "@/lib/translations/jobs";

async function main(): Promise<void> {
  const stats = await runFlushFumsJob();
  console.log("[flush-fums] done", stats);
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("[flush-fums] fatal", err);
    process.exit(1);
  });
