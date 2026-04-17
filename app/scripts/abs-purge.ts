// app/scripts/abs-purge.ts
//
// Operational script for the 72-hour termination runbook
// (founders-files/runbooks/abs-termination-purge.md).
//
// Usage:
//   npm run abs:purge -- --scope=all     # purge NLT, NIV, NASB, ESV
//   npm run abs:purge -- --scope=niv     # NIV only (Biblica termination)
//   npm run abs:purge -- --scope=esv     # ESV only (Crossway termination)
//
// Actions per invocation:
//   1. Delete cached rows for the scoped translations.
//   2. Void unflushed FUMS events for those translations (flushed_at = now,
//      so they are not re-sent — retention prune removes them later).
//   3. Write an audit record to founders-files/audit/abs-purge-<ts>.json.
//
// This script does NOT toggle ABS_PURGE_ENABLED — flip that env var + redeploy
// before running this, so getAvailableTranslations() hides the translations
// from users while the purge runs.

import fs from "fs";
import path from "path";
import { getDb } from "@/lib/db/connection";
import { purgeLicensedCache } from "@/lib/translations/cache";

type Scope = "all" | "niv" | "esv";

function parseScope(argv: string[]): Scope {
  const flag = argv.find((a) => a.startsWith("--scope="));
  const value = flag?.split("=")[1];
  if (value === "all" || value === "niv" || value === "esv") return value;
  throw new Error(`--scope=<all|niv|esv> is required (got: ${value ?? "none"})`);
}

function translationsForScope(scope: Scope): string[] {
  if (scope === "all") return ["NLT", "NIV", "NASB", "ESV"];
  if (scope === "niv") return ["NIV"];
  return ["ESV"];
}

function main(): void {
  const scope = parseScope(process.argv.slice(2));
  const translations = translationsForScope(scope);
  const db = getDb();
  const startedAt = new Date().toISOString();

  // 1. Purge cache rows.
  const { deleted: cacheDeleted } = purgeLicensedCache(translations);

  // 2. Void unflushed FUMS events for the scoped translations. We mark them
  //    `flushed_at = now` rather than deleting so the audit trail is preserved
  //    until the retention window expires.
  const placeholders = translations.map(() => "?").join(",");
  const fumsResult = db
    .prepare(
      `UPDATE fums_events SET flushed_at = ?
        WHERE translation IN (${placeholders}) AND flushed_at IS NULL`,
    )
    .run(Math.floor(Date.now() / 1000), ...translations);

  // 3. Write audit record.
  const auditDir = path.resolve(process.cwd(), "..", "founders-files", "audit");
  fs.mkdirSync(auditDir, { recursive: true });
  const auditFile = path.join(
    auditDir,
    `abs-purge-${startedAt.replace(/[:.]/g, "-")}.json`,
  );
  const audit = {
    scope,
    translations,
    startedAt,
    completedAt: new Date().toISOString(),
    cacheRowsDeleted: cacheDeleted,
    fumsEventsVoided: fumsResult.changes,
  };
  fs.writeFileSync(auditFile, JSON.stringify(audit, null, 2) + "\n");

  console.log("[abs-purge] done", { ...audit, auditFile });
}

try {
  main();
  process.exit(0);
} catch (err) {
  console.error("[abs-purge] fatal", err);
  process.exit(1);
}
