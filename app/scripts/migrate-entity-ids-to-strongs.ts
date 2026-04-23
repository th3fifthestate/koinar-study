#!/usr/bin/env tsx
/**
 * Entity ID Migration — Universal Strong's-Suffixed IDs
 * ------------------------------------------------------
 * Renames every existing person entity from its bare-name ID (e.g. "JAMES")
 * to a Strong's-suffixed ID (e.g. "JAMES_G2385G"), eliminating the collision
 * class that currently causes multiple TIPNR individuals to collapse to one
 * DB row.
 *
 * Safety model
 *   • Runs inside a single transaction.
 *   • PRAGMA foreign_keys = OFF while rewriting PK/FK rows, then ON + check.
 *   • Validates uniqueness of the proposed new IDs BEFORE any write.
 *   • Confirms every FK row is updated before commit (`foreign_key_check`).
 *   • `--dry-run` prints the full rename map + FK row counts and commits nothing.
 *
 * Scope (Option B)
 *   • All person entities whose `tipnr_id` is set get renamed.
 *   • Persons without a `tipnr_id` (manual seeds, if any) are left alone.
 *   • Non-person entities are untouched.
 *
 * Run from app/:
 *   npx tsx scripts/migrate-entity-ids-to-strongs.ts --dry-run
 *   npx tsx scripts/migrate-entity-ids-to-strongs.ts            # commit
 */

import 'dotenv/config';
import { getDb } from '../lib/db/connection';

const dryRun = process.argv.includes('--dry-run');

type EntityRow = { id: string; canonical_name: string; tipnr_id: string };

// ---------------------------------------------------------------------------
// New ID derivation
// ---------------------------------------------------------------------------

function strongsKeyFromTipnrId(tipnrId: string): string | null {
  const eqIdx = tipnrId.indexOf('=');
  if (eqIdx === -1) return null;
  const key = tipnrId.slice(eqIdx + 1).trim();
  return key.length > 0 ? key : null;
}

function canonicalNameToIdBase(name: string): string {
  // camelCase → snake_case then upper, preserving existing normalization rules
  const split = name.replace(/([a-z])([A-Z])/g, '$1_$2');
  // Collapse any non-alphanumeric char (except _ and -) to _ — covers #, ', etc.
  return split.replace(/[^A-Za-z0-9_-]+/g, '_').toUpperCase();
}

function buildNewId(canonicalName: string, tipnrId: string): string | null {
  const strongs = strongsKeyFromTipnrId(tipnrId);
  if (!strongs) return null;
  const base = canonicalNameToIdBase(canonicalName);
  return `${base}_${strongs}`;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

function main() {
  const db = getDb();

  const persons = db
    .prepare(
      `SELECT id, canonical_name, tipnr_id
       FROM entities
       WHERE entity_type = 'person' AND tipnr_id IS NOT NULL AND tipnr_id != ''`
    )
    .all() as EntityRow[];

  console.log('Entity ID Migration — Universal Strong\'s Suffix');
  console.log('═══════════════════════════════════════════════════════════════');
  console.log(`Mode: ${dryRun ? 'DRY RUN (no writes)' : 'COMMIT'}`);
  console.log(`Candidate persons: ${persons.length}\n`);

  // 1. Compute rename map
  const renames: { oldId: string; newId: string; canonicalName: string }[] = [];
  const skipped: { id: string; reason: string }[] = [];
  const seenNewIds = new Map<string, string>(); // newId -> oldId (first seen)

  for (const p of persons) {
    const newId = buildNewId(p.canonical_name, p.tipnr_id);
    if (!newId) {
      skipped.push({ id: p.id, reason: `tipnr_id has no strongs suffix: ${p.tipnr_id}` });
      continue;
    }
    if (newId === p.id) {
      skipped.push({ id: p.id, reason: 'already in final form' });
      continue;
    }
    const prev = seenNewIds.get(newId);
    if (prev) {
      skipped.push({ id: p.id, reason: `collision with ${prev} on proposed new id ${newId}` });
      continue;
    }
    seenNewIds.set(newId, p.id);
    renames.push({ oldId: p.id, newId, canonicalName: p.canonical_name });
  }

  // 2. Sanity: no proposed new id must already exist in the DB as a DIFFERENT row
  const allExistingIds = new Set(
    (db.prepare('SELECT id FROM entities').all() as { id: string }[]).map((r) => r.id)
  );
  const blocked: { oldId: string; newId: string }[] = [];
  for (const r of renames) {
    if (r.newId !== r.oldId && allExistingIds.has(r.newId)) {
      blocked.push({ oldId: r.oldId, newId: r.newId });
    }
  }

  // 3. Show the plan
  console.log('───────────────────────────────────────────────────────────────');
  console.log('  RENAME MAP');
  console.log('───────────────────────────────────────────────────────────────');
  for (const r of renames) {
    console.log(`  ${r.oldId.padEnd(18)} →  ${r.newId.padEnd(28)}  (${r.canonicalName})`);
  }
  console.log(`\n  Total renames planned: ${renames.length}`);

  if (skipped.length > 0) {
    console.log('\n───────────────────────────────────────────────────────────────');
    console.log('  SKIPPED');
    console.log('───────────────────────────────────────────────────────────────');
    for (const s of skipped) console.log(`  ${s.id.padEnd(18)}  — ${s.reason}`);
  }

  if (blocked.length > 0) {
    console.log('\n⚠  BLOCKED — proposed new id already exists in DB:');
    for (const b of blocked) console.log(`  ${b.oldId} → ${b.newId}`);
    console.log('\nAborting. Resolve collisions before re-running.');
    process.exit(1);
  }

  // 4. FK row counts touched
  const fkTables = [
    { table: 'entity_verse_refs', col: 'entity_id' },
    { table: 'entity_citations', col: 'entity_id' },
    { table: 'study_entity_annotations', col: 'entity_id' },
    { table: 'entity_relationships', col: 'from_entity_id' },
    { table: 'entity_relationships', col: 'to_entity_id' },
  ];
  const oldIds = renames.map((r) => r.oldId);
  const placeholders = oldIds.map(() => '?').join(',');
  console.log('\n───────────────────────────────────────────────────────────────');
  console.log('  FK ROW COUNTS (rows that will be updated)');
  console.log('───────────────────────────────────────────────────────────────');
  for (const { table, col } of fkTables) {
    const row = db
      .prepare(`SELECT COUNT(*) AS n FROM ${table} WHERE ${col} IN (${placeholders})`)
      .get(...oldIds) as { n: number };
    console.log(`  ${table}.${col.padEnd(18)}  ${row.n}`);
  }

  if (dryRun) {
    console.log('\n✓ Dry run complete. No changes committed.');
    return;
  }

  // 5. Execute
  console.log('\n───────────────────────────────────────────────────────────────');
  console.log('  EXECUTING MIGRATION');
  console.log('───────────────────────────────────────────────────────────────');

  db.pragma('foreign_keys = OFF');

  try {
    db.transaction(() => {
      const updEntity = db.prepare('UPDATE entities SET id = ?, updated_at = datetime(\'now\') WHERE id = ?');
      const updVerseRef = db.prepare('UPDATE entity_verse_refs SET entity_id = ? WHERE entity_id = ?');
      const updCitation = db.prepare('UPDATE entity_citations SET entity_id = ? WHERE entity_id = ?');
      const updAnnot = db.prepare('UPDATE study_entity_annotations SET entity_id = ? WHERE entity_id = ?');
      const updRelFrom = db.prepare('UPDATE entity_relationships SET from_entity_id = ? WHERE from_entity_id = ?');
      const updRelTo = db.prepare('UPDATE entity_relationships SET to_entity_id = ? WHERE to_entity_id = ?');

      for (const r of renames) {
        updEntity.run(r.newId, r.oldId);
        updVerseRef.run(r.newId, r.oldId);
        updCitation.run(r.newId, r.oldId);
        updAnnot.run(r.newId, r.oldId);
        updRelFrom.run(r.newId, r.oldId);
        updRelTo.run(r.newId, r.oldId);
      }

      // Validate FK integrity while FKs are OFF but within the txn
      const violations = db.prepare('PRAGMA foreign_key_check').all() as unknown[];
      if (violations.length > 0) {
        console.error('FK violations detected:', violations);
        throw new Error('Aborting: foreign_key_check reported violations.');
      }
    })();
  } finally {
    db.pragma('foreign_keys = ON');
  }

  console.log(`✓ Renamed ${renames.length} entities and cascaded all FK rows.`);
}

main();
