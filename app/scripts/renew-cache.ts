// app/scripts/renew-cache.ts
//
// CLI entry point for a one-shot translation-cache renewal pass.
//
// Production path: the in-process scheduler in lib/translations/cron-scheduler.ts
// runs the same job (runRenewCacheJob) on the schedule. This script exists for
// manual triggering — it shares the body, so behavior is identical.
//
// Exits 0 on success, 1 on any thrown error.

import { runRenewCacheJob } from "@/lib/translations/jobs";

async function main(): Promise<void> {
  const stats = await runRenewCacheJob();
  console.log("[renew-cache] done", stats);
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("[renew-cache] fatal", err);
    process.exit(1);
  });
