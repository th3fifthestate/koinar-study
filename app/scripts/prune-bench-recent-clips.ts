// app/scripts/prune-bench-recent-clips.ts
//
// Bench recent clips retention job. Deployment: Railway cron service running
// this script daily (0 3 * * * UTC, 03:00 UTC). Prevents unbounded growth by
// deleting rows older than 30 days.
//
// Exits 0 on success, 1 on any thrown error. Railway treats non-zero as
// a failed run and surfaces it in the dashboard.

import { getDb } from "@/lib/db/connection";
import { config } from "@/lib/config";

const PRUNE_THRESHOLD_DAYS = 30;

async function main(): Promise<void> {
  const startedAt = Date.now();
  const stats = {
    deleted: 0,
  };

  try {
    const result = getDb()
      .prepare(
        `DELETE FROM bench_recent_clips WHERE created_at < datetime('now', '-${PRUNE_THRESHOLD_DAYS} days')`
      )
      .run();

    stats.deleted = result.changes;

    console.log("[prune-bench-recent-clips] done", {
      ms: Date.now() - startedAt,
      ...stats,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[prune-bench-recent-clips] fatal", { message }, err);
    process.exit(1);
  }
}

// Silence "unused variable" warning if config is only referenced indirectly.
void config;

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("[prune-bench-recent-clips] fatal", err);
    process.exit(1);
  });
