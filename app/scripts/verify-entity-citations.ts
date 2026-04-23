// scripts/verify-entity-citations.ts
// Runs citation verification across all entities with generated content.
// Usage: npx tsx scripts/verify-entity-citations.ts [--id ENTITY_ID]

import 'dotenv/config';
import { getDb } from '../lib/db/connection';
import { verifyCitations, verifyAllCitations } from '../lib/entities/citation-verifier';
import type { VerificationResult } from '../lib/entities/citation-verifier';

const args = process.argv.slice(2);
const idIdx = args.indexOf('--id');
const filterId = idIdx !== -1 && idIdx + 1 < args.length ? args[idIdx + 1] : null;

function printResult(r: VerificationResult): void {
  const status = r.issues.length === 0 ? 'PASS' : 'ISSUES';
  console.log(
    `  ${r.entityId} (${r.entityName}): ${r.verifiedCitations}/${r.totalCitations} citations verified [${status}]`
  );
  for (const issue of r.issues) {
    console.log(`    - ${issue}`);
  }
}

function main(): void {
  console.log('Entity Citation Verification');
  console.log('============================\n');

  let results: VerificationResult[];

  if (filterId) {
    console.log(`Verifying entity: ${filterId}\n`);
    results = [verifyCitations(filterId)];
  } else {
    results = verifyAllCitations();
    console.log(`Verifying ${results.length} entities with content.\n`);
  }

  if (results.length === 0) {
    console.log('No entities with generated content found.');
    return;
  }

  // Group by status
  const clean = results.filter((r) => r.issues.length === 0);
  const withIssues = results.filter((r) => r.issues.length > 0);

  let totalCitations = 0;
  let totalVerified = 0;
  let totalIssues = 0;

  for (const r of results) {
    totalCitations += r.totalCitations;
    totalVerified += r.verifiedCitations;
    totalIssues += r.issues.length;
  }

  // Print entities with issues first
  if (withIssues.length > 0) {
    console.log(`Entities with issues (${withIssues.length}):`);
    for (const r of withIssues) {
      printResult(r);
    }
    console.log('');
  }

  // Summary of clean entities
  if (clean.length > 0 && !filterId) {
    console.log(`Clean entities: ${clean.length} (all citations verified)`);
  }

  // Overall summary
  console.log('\n============================');
  console.log(`Total entities: ${results.length}`);
  console.log(`Total citations: ${totalCitations}`);
  console.log(`Verified: ${totalVerified}`);
  console.log(`Issues found: ${totalIssues}`);
  console.log(
    `Pass rate: ${totalCitations > 0 ? ((totalVerified / totalCitations) * 100).toFixed(1) : 0}%`
  );

  // Check for unverified entities
  const db = getDb();
  const unverified = db
    .prepare(
      "SELECT id, canonical_name FROM entities WHERE source_verified = 0 AND full_profile IS NOT NULL AND full_profile != ''"
    )
    .all() as { id: string; canonical_name: string }[];

  if (unverified.length > 0) {
    console.log(`\nEntities flagged as source_verified=0 (${unverified.length}):`);
    for (const e of unverified) {
      console.log(`  - ${e.id} (${e.canonical_name})`);
    }
  }
}

main();
