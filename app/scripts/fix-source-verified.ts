#!/usr/bin/env tsx
/**
 * Fix source_verified Flag
 * -------------------------
 * Runs the citation verifier against every entity flagged source_verified=0.
 * Sets source_verified=1 for entities whose citations all pass verification.
 * Entities with genuine citation issues stay flagged.
 *
 * Run from app/:  npx tsx scripts/fix-source-verified.ts [--dry-run]
 */

import 'dotenv/config';
import { getDb } from '../lib/db/connection';
import { verifyCitations } from '../lib/entities/citation-verifier';

const dryRun = process.argv.includes('--dry-run');

function main() {
  const db = getDb();

  const unverified = db
    .prepare("SELECT id, canonical_name FROM entities WHERE source_verified = 0")
    .all() as { id: string; canonical_name: string }[];

  console.log(`source_verified Fix`);
  console.log(`═══════════════════════════════════════`);
  console.log(`Mode: ${dryRun ? 'DRY RUN' : 'COMMIT'}`);
  console.log(`Entities with source_verified=0: ${unverified.length}\n`);

  let promoted = 0;
  let stillFlagged = 0;
  const issues: { id: string; name: string; problems: string[] }[] = [];

  const updateStmt = db.prepare("UPDATE entities SET source_verified = 1, updated_at = datetime('now') WHERE id = ?");

  for (const entity of unverified) {
    const result = verifyCitations(entity.id);
    if (result.issues.length === 0) {
      if (!dryRun) updateStmt.run(entity.id);
      promoted++;
    } else {
      stillFlagged++;
      issues.push({ id: entity.id, name: entity.canonical_name, problems: result.issues });
    }
  }

  console.log(`Promoted to source_verified=1:  ${promoted}`);
  console.log(`Still flagged (real issues):     ${stillFlagged}\n`);

  if (issues.length > 0) {
    console.log(`───────────────────────────────────────`);
    console.log(`  ENTITIES WITH GENUINE CITATION ISSUES`);
    console.log(`───────────────────────────────────────`);
    for (const i of issues.slice(0, 30)) {
      console.log(`\n  ${i.id} (${i.name}):`);
      for (const p of i.problems) console.log(`    · ${p}`);
    }
    if (issues.length > 30) {
      console.log(`\n  ... and ${issues.length - 30} more.`);
    }
  }

  // Final count
  const remaining = db
    .prepare("SELECT COUNT(*) AS n FROM entities WHERE source_verified = 0")
    .get() as { n: number };
  console.log(`\nFinal source_verified=0 count: ${remaining.n}`);
}

main();
