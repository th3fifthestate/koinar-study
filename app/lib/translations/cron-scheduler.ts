// app/lib/translations/cron-scheduler.ts
//
// In-process scheduler for the FUMS flush and translation-cache renewal
// jobs. Registered once per server boot from instrumentation.ts.
//
// Why in-process rather than a separate Railway cron service:
//   - The web service holds the persistent volume containing app.db. Railway
//     volumes are attached to a single service, so a separate cron service
//     would have no way to reach the SQLite file the jobs operate on.
//   - The deployment runs as a single instance — no horizontal scaling — so
//     the classic objection to in-process schedulers (duplicate firings under
//     N instances) doesn't apply.
//   - node-cron survives the lifetime of the Node.js process. On redeploy the
//     timer resets, but each job is idempotent and catches up on the next
//     firing. The 30-min flush cadence + 7-day cache lease means missing one
//     scheduled tick is non-load-bearing.
//
// Compliance note: when ABS_PURGE_ENABLED is true (72-hour termination
// kill-switch), the flush job continues to drain the FUMS queue (those events
// represent pre-purge displays that we still need to report), but the renewal
// job is skipped entirely so we don't pull fresh verses from api.bible after
// termination.

import cron from "node-cron";
import { config } from "@/lib/config";
import { runFlushFumsJob, runRenewCacheJob } from "./jobs";

// Every 30 min: flush + 13-month prune. ≥5 min, satisfies node-cron + matches
// the original Railway-cron plan documented in scripts/flush-fums.ts.
const FLUSH_SCHEDULE = "*/30 * * * *";
// Hourly: renew + flush + prune (24h-gated) + storage cap.
const RENEW_SCHEDULE = "0 * * * *";

// Survive Next.js dev HMR — register once per process. globalThis is the only
// store that's stable across module re-evaluations during turbopack reloads.
const GLOBAL_FLAG = Symbol.for("koinar.cron-scheduler.registered");
type GlobalWithFlag = typeof globalThis & { [GLOBAL_FLAG]?: boolean };

// Per-job in-flight guard — if the previous run hasn't finished, skip the
// next tick. Mirrors Railway's documented cron behavior: "if a previous
// execution is still running when the next scheduled execution is due,
// Railway will skip the new cron job."
let flushInFlight = false;
let renewInFlight = false;

export function startCronScheduler(): void {
  const g = globalThis as GlobalWithFlag;
  if (g[GLOBAL_FLAG]) {
    return;
  }
  g[GLOBAL_FLAG] = true;

  cron.schedule(
    FLUSH_SCHEDULE,
    () => {
      void runFlushTick();
    },
    { timezone: "UTC" },
  );

  cron.schedule(
    RENEW_SCHEDULE,
    () => {
      void runRenewTick();
    },
    { timezone: "UTC" },
  );

  console.log("[cron-scheduler] registered", {
    flush: FLUSH_SCHEDULE,
    renew: RENEW_SCHEDULE,
    timezone: "UTC",
  });
}

async function runFlushTick(): Promise<void> {
  if (flushInFlight) {
    console.log("[cron-scheduler] flush skipped — previous run in flight");
    return;
  }
  flushInFlight = true;
  try {
    const stats = await runFlushFumsJob();
    console.log("[cron-scheduler] flush done", stats);
  } catch (err) {
    console.error(
      "[cron-scheduler] flush fatal",
      err instanceof Error ? err.message : String(err),
    );
  } finally {
    flushInFlight = false;
  }
}

async function runRenewTick(): Promise<void> {
  if (config.bible.purgeEnabled) {
    console.log("[cron-scheduler] renew skipped — ABS_PURGE_ENABLED");
    return;
  }
  if (renewInFlight) {
    console.log("[cron-scheduler] renew skipped — previous run in flight");
    return;
  }
  renewInFlight = true;
  try {
    const stats = await runRenewCacheJob();
    console.log("[cron-scheduler] renew done", stats);
  } catch (err) {
    console.error(
      "[cron-scheduler] renew fatal",
      err instanceof Error ? err.message : String(err),
    );
  } finally {
    renewInFlight = false;
  }
}
