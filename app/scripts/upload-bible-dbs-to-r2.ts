/**
 * One-shot: upload the local Bible/Strongs SQLite DBs to the R2 data bucket
 * so prod (and any future Railway deploy) can download them on first boot.
 *
 * Local source: app/data/databases/
 * Remote target: r2://<R2_DATA_BUCKET>/bible-dbs/
 *
 * Idempotent — re-running uploads identical bytes (R2 dedups by content hash
 * for billing). If you swap an edition or rebuild a DB, just re-run.
 *
 * Run: cd app && npx tsx scripts/upload-bible-dbs-to-r2.ts
 *      (R2_DATA_* env vars must be in scope — `set -a && source .env`)
 */

import 'dotenv/config';

import * as fs from 'node:fs';
import * as path from 'node:path';
import { putDataObject, listDataObjects } from '../lib/data/r2-data';
import { config } from '../lib/config';

// Files we ship to prod via R2. Sidecar WAL/SHM files are NOT shipped — they
// reflect transient write state on the local machine; the prod boot will
// re-create empty sidecars when first opening the main file in WAL mode.
const FILES = [
  'BSB.db',
  'bsb_fts.db',
  'bible_hebrew_greek.db',
  'cross_references.db',
  'strongs.sqlite',
];

const PREFIX = 'bible-dbs/';

async function main() {
  if (!config.r2Data.accountId) {
    console.error('R2_DATA_ACCOUNT_ID not set. Source .env first:');
    console.error('  set -a && source .env && set +a && npx tsx scripts/upload-bible-dbs-to-r2.ts');
    process.exit(1);
  }

  const sourceDir = path.resolve(process.cwd(), 'data/databases');
  console.log(`\n  Uploading Bible DBs from ${sourceDir}`);
  console.log(`  Target: r2://${config.r2Data.bucketName}/${PREFIX}\n`);

  // Sanity-check all files exist locally before any upload.
  for (const f of FILES) {
    const p = path.join(sourceDir, f);
    if (!fs.existsSync(p)) {
      console.error(`  ✗ Missing local file: ${p}`);
      process.exit(1);
    }
  }

  let totalBytes = 0;
  let uploadedCount = 0;
  for (const file of FILES) {
    const localPath = path.join(sourceDir, file);
    const key = `${PREFIX}${file}`;
    const buf = fs.readFileSync(localPath);
    process.stdout.write(`  → ${file.padEnd(28)} ${(buf.length / (1024 * 1024)).toFixed(1).padStart(6)} MB ... `);
    const start = Date.now();
    try {
      await putDataObject(key, buf, 'application/x-sqlite3');
      const ms = Date.now() - start;
      console.log(`done in ${(ms / 1000).toFixed(1)}s`);
      totalBytes += buf.length;
      uploadedCount++;
    } catch (err) {
      console.log(`FAILED: ${err instanceof Error ? err.message : String(err)}`);
      throw err;
    }
  }

  console.log(`\n  ✔ Uploaded ${uploadedCount} files · ${(totalBytes / (1024 * 1024)).toFixed(1)} MB total\n`);

  // Verify by listing.
  const keys = await listDataObjects(PREFIX);
  console.log('  Bucket listing:');
  for (const k of keys) console.log(`    ${k}`);
}

main().catch((err) => {
  console.error('\n  ✗ Upload failed:', err);
  process.exit(1);
});
