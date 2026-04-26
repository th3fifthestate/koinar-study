export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    // Brief 24: Next 16.2.x Turbopack cold-start does not reliably source .env
    // before server modules initialize, leaving ANTHROPIC_API_KEY empty at runtime.
    // instrumentation.ts runs before any route handler and before module evaluation.
    const { config } = await import("dotenv");
    config({ path: ".env" });

    // Bible DBs are not committed to git (gitignored, ~117 MB) so the deploy
    // image doesn't ship them. On boot, ensure they're present at
    // BIBLE_DB_PATH; if any are missing, download from the R2 data bucket.
    // Cached on the persistent volume so subsequent boots are instant.
    await ensureBibleDbsPresent();
  }
}

async function ensureBibleDbsPresent(): Promise<void> {
  const fs = await import("node:fs");
  const path = await import("node:path");

  const REQUIRED = [
    "BSB.db",
    "bsb_fts.db",
    "bible_hebrew_greek.db",
    "cross_references.db",
    "strongs.sqlite",
  ];

  const bibleDir = process.env.BIBLE_DB_PATH || "./data/databases";
  const dataAccountId = process.env.R2_DATA_ACCOUNT_ID;

  // No R2 data creds configured (e.g., local dev with files already present).
  // Skip silently — the Bible-DB-using code paths will surface clear errors
  // if the files are actually missing at runtime.
  if (!dataAccountId) return;

  // Make sure the target dir exists.
  if (!fs.existsSync(bibleDir)) {
    fs.mkdirSync(bibleDir, { recursive: true });
  }

  const missing = REQUIRED.filter(
    (f) => !fs.existsSync(path.join(bibleDir, f)),
  );
  if (missing.length === 0) {
    // All present — nothing to do.
    return;
  }

  console.log(
    `[instrumentation] ${missing.length}/${REQUIRED.length} Bible DBs missing from ${bibleDir}, downloading from R2...`,
  );

  // Lazy-import the R2 helper so this module's import graph stays small.
  const { getDataObject } = await import("@/lib/data/r2-data");

  for (const file of missing) {
    const start = Date.now();
    try {
      const buf = await getDataObject(`bible-dbs/${file}`);
      fs.writeFileSync(path.join(bibleDir, file), buf);
      const ms = Date.now() - start;
      const mb = (buf.length / (1024 * 1024)).toFixed(1);
      console.log(
        `[instrumentation]   ✓ ${file} (${mb} MB in ${(ms / 1000).toFixed(1)}s)`,
      );
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`[instrumentation]   ✗ ${file}: ${msg}`);
      // Don't crash the boot — let the route handlers surface the error
      // path themselves. A partial download still leaves SOME tools working.
    }
  }
  console.log("[instrumentation] Bible DB sync complete.");
}
