#!/usr/bin/env tsx
/**
 * Entity-Relationship Validator
 * ------------------------------
 * DB-wide audit for `entity_relationships`. Detects:
 *
 *   1. Missing inverses
 *        - `parent_of` without matching `child_of` (and vice versa)
 *        - `spouse_of` / `sibling_of` without matching symmetric edge
 *        - `located_in` / `contains` / `member_of` / `includes` / etc.
 *      (Covers every type registered in
 *       lib/entities/relationship-direction.ts. Unknown types fail loudly
 *       rather than silently passing — forces a conscious decision.)
 *   2. Contradictions
 *        - Both A parent_of B  AND  B parent_of A  (either is wrong; human call)
 *        - Both A child_of  B  AND  B child_of  A
 *   3. Self-loops (A rel_type A)
 *   4. Dangling references (from/to entity id doesn't exist)
 *   5. Unregistered types (present in DB but not in the registry)
 *
 * Output:
 *   - Human-readable summary to stdout
 *   - Machine-readable report JSON at
 *       app/founders-files/reports/relationship-mismatch-report.json
 *
 * Flags:
 *   --fix-missing-inverses   Insert the reciprocal row for every asymmetric /
 *                            symmetric-missing edge. Requires --commit.
 *   --fix-self-loops         Delete self-loop rows. Requires --commit.
 *   --fix-chronology         Resolve `preceded_by` contradictions between
 *                            biblical periods using the canonical ordered
 *                            list in CHRONOLOGY_ORDER. Deletes the
 *                            chronologically-wrong direction of each pair.
 *                            Requires --commit.
 *   --fix-family-on-non-person
 *                            Delete `parent_of` / `child_of` / `sibling_of`
 *                            edges where either endpoint is NOT of
 *                            entity_type='person'. TIPNR / biblical_text
 *                            source data applies family predicates to
 *                            people-groups (tribes, cultures), producing
 *                            duplicate cards in the drawer alongside the
 *                            semantically-correct `subgroup_of` /
 *                            `member_of` edges. No information is lost.
 *                            Requires --commit.
 *   --fix-chain-artifacts    Delete reciprocal rows whose inserts were
 *                            themselves triggered by a reciprocal (source
 *                            ends in `-reciprocal-reciprocal`). These come
 *                            from the non-mutual `subgroup_of → includes →
 *                            member_of` chain propagating a second hop when
 *                            `--fix-missing-inverses` is run more than once.
 *                            Carries no information — original + first-order
 *                            reciprocal already capture the full relation.
 *                            Requires --commit.
 *   --dry-run                Print changes but do not commit. Default for
 *                            --fix is DRY. You must pass --commit to actually
 *                            write.
 *   --commit                 Actually write changes. Required for any --fix.
 *
 * Run from app/:
 *     npx tsx scripts/validate-entity-relationships.ts
 *     npx tsx scripts/validate-entity-relationships.ts --fix-missing-inverses --commit
 *     npx tsx scripts/validate-entity-relationships.ts --fix-self-loops --commit
 */

import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import { getDb } from '../lib/db/connection';
import {
  RELATIONSHIP_REGISTRY,
  getSpec,
  reciprocalFor,
} from '../lib/entities/relationship-direction';

// ───────────────────────── Types ─────────────────────────

type RelRow = {
  id: number;
  from_entity_id: string;
  to_entity_id: string;
  relationship_type: string;
  relationship_label: string;
  bidirectional: number;
  source: string | null;
  from_name: string | null;
  to_name: string | null;
  from_type: string | null;
  to_type: string | null;
  from_exists: number;
  to_exists: number;
};

type AsymmetricEdge = {
  id: number;
  from_entity_id: string;
  from_name: string | null;
  to_entity_id: string;
  to_name: string | null;
  relationship_type: string;
  relationship_label: string;
  source: string | null;
  inverse_type: string;
  inverse_label: string;
  spec_kind: 'asymmetric' | 'symmetric';
};

type Contradiction = {
  edge_a_id: number;
  edge_b_id: number;
  a_from_id: string;
  a_to_id: string;
  a_from_name: string | null;
  a_to_name: string | null;
  relationship_type: string;
  note: string;
};

type ValidationReport = {
  generated_at: string;
  totals: {
    total_edges: number;
    by_type: Record<string, number>;
    unknown_type_edges: number;
    self_loops: number;
    dangling: number;
    missing_inverses: number;
    contradictions: number;
  };
  missing_inverses_by_type: Record<string, AsymmetricEdge[]>;
  contradictions: Contradiction[];
  self_loops: RelRow[];
  dangling_refs: RelRow[];
  unregistered_types: { type: string; count: number; sample_rows: RelRow[] }[];
};

// ───────────────────────── Arg parsing ─────────────────────────

const argv = new Set(process.argv.slice(2));
const FIX_MISSING = argv.has('--fix-missing-inverses');
const FIX_SELF_LOOPS = argv.has('--fix-self-loops');
const FIX_CHRONOLOGY = argv.has('--fix-chronology');
const FIX_FAMILY_ON_NON_PERSON = argv.has('--fix-family-on-non-person');
const FIX_CHAIN_ARTIFACTS = argv.has('--fix-chain-artifacts');
const COMMIT = argv.has('--commit');
const DRY_RUN = argv.has('--dry-run') ||
  ((FIX_MISSING || FIX_SELF_LOOPS || FIX_CHRONOLOGY || FIX_FAMILY_ON_NON_PERSON || FIX_CHAIN_ARTIFACTS) && !COMMIT);

/**
 * Canonical chronological order of biblical periods (earliest → latest).
 * Used to resolve `preceded_by` contradictions: for a pair where both
 * "A preceded_by B" and "B preceded_by A" exist, keep the edge where A is
 * chronologically LATER (so B genuinely came before A) and delete the other.
 *
 * If you add a new period entity, append it here in order.
 */
const CHRONOLOGY_ORDER: string[] = [
  'ANTEDILUVIAN_PERIOD',
  'PATRIARCHAL_PERIOD',
  'EGYPTIAN_SOJOURN',
  'WILDERNESS_PERIOD',
  'CONQUEST_PERIOD',
  'JUDGES_PERIOD',
  'UNITED_MONARCHY',
  'DIVIDED_KINGDOM',
  'ASSYRIAN_PERIOD',
  'BABYLONIAN_PERIOD',
  'PERSIAN_PERIOD',
  'HELLENISTIC_PERIOD',
  'HASMONEAN_PERIOD',
  'ROMAN_PERIOD',
  'EARLY_MINISTRY_JESUS',
  'PASSION_WEEK',
  'EARLY_CHURCH_PERIOD',
  'APOSTOLIC_AGE',
  'POST_APOSTOLIC_PERIOD',
  // Jewish wedding customs — ceremonial ordering
  'JEWISH_BETROTHAL',
  'JEWISH_WEDDING',
];

const CHRONOLOGY_RANK = new Map<string, number>(
  CHRONOLOGY_ORDER.map((id, i) => [id, i])
);

// ───────────────────────── Query helpers ─────────────────────────

function loadAllEdges(): RelRow[] {
  const db = getDb();
  return db
    .prepare(
      `SELECT er.id,
              er.from_entity_id,
              er.to_entity_id,
              er.relationship_type,
              er.relationship_label,
              er.bidirectional,
              er.source,
              e_from.canonical_name AS from_name,
              e_to.canonical_name   AS to_name,
              e_from.entity_type    AS from_type,
              e_to.entity_type      AS to_type,
              CASE WHEN e_from.id IS NULL THEN 0 ELSE 1 END AS from_exists,
              CASE WHEN e_to.id   IS NULL THEN 0 ELSE 1 END AS to_exists
         FROM entity_relationships er
         LEFT JOIN entities e_from ON e_from.id = er.from_entity_id
         LEFT JOIN entities e_to   ON e_to.id   = er.to_entity_id`
    )
    .all() as RelRow[];
}

function keyOf(fromId: string, toId: string, type: string): string {
  return `${fromId}||${toId}||${type}`;
}

// ───────────────────────── Validation ─────────────────────────

function validate(edges: RelRow[]): ValidationReport {
  const report: ValidationReport = {
    generated_at: new Date().toISOString(),
    totals: {
      total_edges: edges.length,
      by_type: {},
      unknown_type_edges: 0,
      self_loops: 0,
      dangling: 0,
      missing_inverses: 0,
      contradictions: 0,
    },
    missing_inverses_by_type: {},
    contradictions: [],
    self_loops: [],
    dangling_refs: [],
    unregistered_types: [],
  };

  // Build a lookup for existing (from, to, type) triples.
  const existing = new Set<string>();
  for (const e of edges) existing.add(keyOf(e.from_entity_id, e.to_entity_id, e.relationship_type));

  // Collect unregistered types first (distinct, not per-edge).
  const unregistered = new Map<string, RelRow[]>();

  for (const e of edges) {
    report.totals.by_type[e.relationship_type] = (report.totals.by_type[e.relationship_type] ?? 0) + 1;

    // Dangling
    if (!e.from_exists || !e.to_exists) {
      report.totals.dangling++;
      report.dangling_refs.push(e);
      continue;
    }

    // Self-loops
    if (e.from_entity_id === e.to_entity_id) {
      report.totals.self_loops++;
      report.self_loops.push(e);
      continue;
    }

    const spec = getSpec(e.relationship_type);
    if (!spec) {
      // Unregistered type — collect for report, skip validation
      report.totals.unknown_type_edges++;
      const list = unregistered.get(e.relationship_type) ?? [];
      list.push(e);
      unregistered.set(e.relationship_type, list);
      continue;
    }

    if (spec.kind === 'no_inverse') continue;

    // Skip rows that are themselves reciprocals. By construction, their
    // inverse (the original that triggered their insertion) exists. Checking
    // them would mis-propagate non-mutual chains on second+ runs — e.g.
    // subgroup_of → includes → member_of inserts a chain-artifact member_of
    // row on the second run if we don't gate here.
    if (e.source && /-reciprocal$/.test(e.source)) continue;

    // Check for reciprocal row.
    const recip = reciprocalFor(e.relationship_type, e.relationship_label);
    if (!recip) continue;
    const inverseKey = keyOf(e.to_entity_id, e.from_entity_id, recip.type);

    if (!existing.has(inverseKey)) {
      const asym: AsymmetricEdge = {
        id: e.id,
        from_entity_id: e.from_entity_id,
        from_name: e.from_name,
        to_entity_id: e.to_entity_id,
        to_name: e.to_name,
        relationship_type: e.relationship_type,
        relationship_label: e.relationship_label,
        source: e.source,
        inverse_type: recip.type,
        inverse_label: recip.label,
        spec_kind: spec.kind,
      };
      (report.missing_inverses_by_type[e.relationship_type] ??= []).push(asym);
      report.totals.missing_inverses++;
    }
  }

  // Contradictions: for every asymmetric type, flag pairs where both
  // directions exist with the SAME type (A type B AND B type A). One of the
  // two is necessarily wrong — by definition of an asymmetric relation.
  //
  // IMPORTANT: we do NOT auto-fix contradictions. These need human review
  // (which direction is correct?). And we must NOT run --fix-missing-inverses
  // against a DB with unresolved contradictions, because the backfill would
  // happily insert reciprocals for both wrong edges and double the mess.
  const asymmetricTypes = Object.entries(RELATIONSHIP_REGISTRY)
    .filter(([, s]) => s.kind === 'asymmetric')
    .map(([t]) => t);
  for (const type of asymmetricTypes) {
    const rows = edges.filter(e => e.relationship_type === type);
    const idx = new Map<string, RelRow>();
    for (const e of rows) idx.set(`${e.from_entity_id}||${e.to_entity_id}`, e);
    for (const e of rows) {
      const revKey = `${e.to_entity_id}||${e.from_entity_id}`;
      const counter = idx.get(revKey);
      if (counter && counter.id > e.id) {
        report.contradictions.push({
          edge_a_id: e.id,
          edge_b_id: counter.id,
          a_from_id: e.from_entity_id,
          a_to_id: e.to_entity_id,
          a_from_name: e.from_name,
          a_to_name: e.to_name,
          relationship_type: type,
          note: `Both A ${type} B AND B ${type} A — exactly one must be wrong.`,
        });
      }
    }
  }
  report.totals.contradictions = report.contradictions.length;

  // Drop missing-inverse entries whose (from, to) pair also has a
  // contradiction recorded. Backfilling them would just propagate the bad
  // data. Human must resolve contradictions first, then re-run --fix.
  if (report.contradictions.length > 0) {
    const contradictoryPairs = new Set<string>();
    for (const c of report.contradictions) {
      contradictoryPairs.add(`${c.a_from_id}||${c.a_to_id}`);
      contradictoryPairs.add(`${c.a_to_id}||${c.a_from_id}`);
    }
    for (const type of Object.keys(report.missing_inverses_by_type)) {
      const before = report.missing_inverses_by_type[type]!;
      const after = before.filter(
        (m) => !contradictoryPairs.has(`${m.from_entity_id}||${m.to_entity_id}`)
      );
      report.missing_inverses_by_type[type] = after;
      report.totals.missing_inverses -= (before.length - after.length);
    }
  }

  // Unregistered-types summary.
  for (const [type, rows] of unregistered) {
    report.unregistered_types.push({
      type,
      count: rows.length,
      sample_rows: rows.slice(0, 5),
    });
  }

  return report;
}

// ───────────────────────── Fixers ─────────────────────────

function fixMissingInverses(report: ValidationReport, commit: boolean): number {
  const db = getDb();
  const insertStmt = db.prepare(
    `INSERT OR IGNORE INTO entity_relationships
       (from_entity_id, to_entity_id, relationship_type, relationship_label, bidirectional, source)
     VALUES (?, ?, ?, ?, ?, ?)`
  );

  const all: AsymmetricEdge[] = Object.values(report.missing_inverses_by_type).flat();
  if (all.length === 0) {
    console.log('\nNo missing inverses to fix.\n');
    return 0;
  }

  console.log(`\n${commit ? 'INSERTING' : 'DRY-RUN (would insert)'} ${all.length} reciprocal rows:\n`);
  const byType: Record<string, number> = {};
  for (const m of all) byType[m.inverse_type] = (byType[m.inverse_type] ?? 0) + 1;
  for (const [t, n] of Object.entries(byType)) {
    console.log(`  ${t.padEnd(20)} ${n}`);
  }
  console.log('');

  let inserted = 0;
  const run = () => {
    for (const m of all) {
      // Symmetric types (spouse_of, sibling_of, near, etc.) should be marked
      // bidirectional=1 on the reciprocal row too.
      const spec = getSpec(m.relationship_type);
      const bidirectional = spec?.kind === 'symmetric' ? 1 : 0;
      const source = m.source ? `${m.source}-reciprocal` : 'auto-reciprocal';
      if (commit) {
        const result = insertStmt.run(
          m.to_entity_id,
          m.from_entity_id,
          m.inverse_type,
          m.inverse_label,
          bidirectional,
          source
        );
        if (result.changes > 0) inserted++;
      } else {
        inserted++;
      }
    }
  };

  if (commit) db.transaction(run)();
  else run();

  return inserted;
}

function fixChronologyContradictions(
  report: ValidationReport,
  commit: boolean
): number {
  const db = getDb();
  const chronoContradictions = report.contradictions.filter(c =>
    c.relationship_type === 'preceded_by' &&
    CHRONOLOGY_RANK.has(c.a_from_id) &&
    CHRONOLOGY_RANK.has(c.a_to_id)
  );
  if (chronoContradictions.length === 0) {
    console.log('\nNo chronology contradictions to fix.\n');
    return 0;
  }

  // For each contradictory pair, find the wrong edge and delete it.
  // "A preceded_by B" is correct iff rank(A) > rank(B).
  const wrongEdgeIds: number[] = [];
  const keptEdgeIds: number[] = [];
  const skipped: Array<{ pair: string; reason: string }> = [];

  for (const c of chronoContradictions) {
    const rankA = CHRONOLOGY_RANK.get(c.a_from_id)!;
    const rankB = CHRONOLOGY_RANK.get(c.a_to_id)!;
    // Edge A: from=a_from, to=a_to, type=preceded_by, id=edge_a_id
    // Edge B: from=a_to,   to=a_from, type=preceded_by, id=edge_b_id
    // Correct edge: whichever has from-rank > to-rank.
    if (rankA > rankB) {
      // Edge A correct; Edge B wrong.
      keptEdgeIds.push(c.edge_a_id);
      wrongEdgeIds.push(c.edge_b_id);
    } else if (rankB > rankA) {
      // Edge B correct; Edge A wrong.
      keptEdgeIds.push(c.edge_b_id);
      wrongEdgeIds.push(c.edge_a_id);
    } else {
      skipped.push({
        pair: `${c.a_from_id} / ${c.a_to_id}`,
        reason: 'equal chronology rank',
      });
    }
  }

  console.log(`\n${commit ? 'DELETING' : 'DRY-RUN (would delete)'} ${wrongEdgeIds.length} chronologically-wrong preceded_by edges:`);
  for (const c of chronoContradictions) {
    const rankA = CHRONOLOGY_RANK.get(c.a_from_id)!;
    const rankB = CHRONOLOGY_RANK.get(c.a_to_id)!;
    const wrongFrom = rankA > rankB ? c.a_to_id : c.a_from_id;
    const wrongTo   = rankA > rankB ? c.a_from_id : c.a_to_id;
    const wrongId   = rankA > rankB ? c.edge_b_id : c.edge_a_id;
    console.log(`  · id=${wrongId}  ${wrongFrom} preceded_by ${wrongTo}  (wrong: ${wrongFrom} is earlier than ${wrongTo})`);
  }
  for (const s of skipped) {
    console.log(`  skipped: ${s.pair} — ${s.reason}`);
  }

  if (!commit) return wrongEdgeIds.length;

  const stmt = db.prepare('DELETE FROM entity_relationships WHERE id = ?');
  let n = 0;
  db.transaction(() => {
    for (const id of wrongEdgeIds) {
      const r = stmt.run(id);
      n += r.changes;
    }
  })();
  return n;
}

/**
 * Delete `parent_of` / `child_of` / `sibling_of` edges where either endpoint
 * is NOT of entity_type='person'. These come from TIPNR / biblical_text seed
 * data applying family predicates to people-groups (tribes, cultures). They
 * double-up with the semantically-correct `subgroup_of` / `member_of` /
 * `includes` edges and show up as duplicate cards in the entity drawer.
 *
 * Operates on the raw edge list, not the report, because this sweep is
 * orthogonal to the missing-inverse / contradiction analysis.
 */
function fixFamilyOnNonPerson(edges: RelRow[], commit: boolean): number {
  const FAMILY_TYPES = new Set(['parent_of', 'child_of', 'sibling_of']);
  const offenders = edges.filter(e =>
    FAMILY_TYPES.has(e.relationship_type) &&
    e.from_exists === 1 &&
    e.to_exists === 1 &&
    (e.from_type !== 'person' || e.to_type !== 'person')
  );

  if (offenders.length === 0) {
    console.log('\nNo family-on-non-person edges to fix.\n');
    return 0;
  }

  console.log(
    `\n${commit ? 'DELETING' : 'DRY-RUN (would delete)'} ${offenders.length} family-type edges on non-person entities:`
  );
  // Group by type for a compact summary.
  const byType: Record<string, number> = {};
  for (const o of offenders) byType[o.relationship_type] = (byType[o.relationship_type] ?? 0) + 1;
  for (const [t, n] of Object.entries(byType)) {
    console.log(`  ${t.padEnd(12)} ${n}`);
  }
  console.log('');
  for (const o of offenders) {
    console.log(
      `  · id=${o.id}  ${o.from_name ?? o.from_entity_id} [${o.from_type}] ${o.relationship_type} ${o.to_name ?? o.to_entity_id} [${o.to_type}]`
    );
  }

  if (!commit) return offenders.length;
  const db = getDb();
  const stmt = db.prepare('DELETE FROM entity_relationships WHERE id = ?');
  let n = 0;
  db.transaction(() => {
    for (const o of offenders) {
      const r = stmt.run(o.id);
      n += r.changes;
    }
  })();
  return n;
}

/**
 * Delete chain-artifact rows: reciprocal inserts that were themselves
 * triggered by a reciprocal (source ends `-reciprocal-reciprocal`). Only
 * non-mutual chains (currently just `subgroup_of → includes → member_of`)
 * produce these when `--fix-missing-inverses` runs more than once. The
 * validator's chain-guard (above) prevents new ones from forming; this
 * cleans up the existing residue.
 */
function fixChainArtifacts(edges: RelRow[], commit: boolean): number {
  const artifacts = edges.filter(e =>
    e.source != null && /-reciprocal-reciprocal$/.test(e.source)
  );

  if (artifacts.length === 0) {
    console.log('\nNo chain-artifact rows to fix.\n');
    return 0;
  }

  console.log(
    `\n${commit ? 'DELETING' : 'DRY-RUN (would delete)'} ${artifacts.length} chain-artifact rows:`
  );
  const byType: Record<string, number> = {};
  for (const a of artifacts) byType[a.relationship_type] = (byType[a.relationship_type] ?? 0) + 1;
  for (const [t, n] of Object.entries(byType)) {
    console.log(`  ${t.padEnd(14)} ${n}`);
  }

  if (!commit) return artifacts.length;
  const db = getDb();
  const stmt = db.prepare('DELETE FROM entity_relationships WHERE id = ?');
  let n = 0;
  db.transaction(() => {
    for (const a of artifacts) {
      const r = stmt.run(a.id);
      n += r.changes;
    }
  })();
  return n;
}

function fixSelfLoops(report: ValidationReport, commit: boolean): number {
  const db = getDb();
  if (report.self_loops.length === 0) {
    console.log('\nNo self-loops to fix.\n');
    return 0;
  }
  console.log(`\n${commit ? 'DELETING' : 'DRY-RUN (would delete)'} ${report.self_loops.length} self-loop rows:\n`);
  for (const e of report.self_loops) {
    console.log(`  id=${e.id}  ${e.from_entity_id}  ${e.relationship_type}  ${e.from_entity_id}`);
  }
  if (!commit) return report.self_loops.length;
  const stmt = db.prepare('DELETE FROM entity_relationships WHERE id = ?');
  let n = 0;
  db.transaction(() => {
    for (const e of report.self_loops) {
      const r = stmt.run(e.id);
      n += r.changes;
    }
  })();
  return n;
}

// ───────────────────────── Reporting ─────────────────────────

function printSummary(report: ValidationReport): void {
  const t = report.totals;
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('  ENTITY-RELATIONSHIP VALIDATION');
  console.log('═══════════════════════════════════════════════════════════════');
  console.log(`  Total edges:                  ${t.total_edges}`);
  console.log(`  Registered types: ${Object.keys(RELATIONSHIP_REGISTRY).length}`);
  console.log('');
  console.log('  By type:');
  const sortedTypes = Object.entries(t.by_type).sort((a, b) => b[1] - a[1]);
  for (const [type, count] of sortedTypes) {
    const spec = getSpec(type);
    const kind = spec ? spec.kind : '— unregistered —';
    console.log(`    ${type.padEnd(20)} ${String(count).padStart(5)}   ${kind}`);
  }
  console.log('');
  console.log(`  Self-loops:                   ${t.self_loops}`);
  console.log(`  Dangling references:          ${t.dangling}`);
  console.log(`  Unregistered-type edges:      ${t.unknown_type_edges}`);
  console.log(`  Missing inverses:             ${t.missing_inverses}`);
  console.log(`  Contradictions:               ${t.contradictions}`);
  console.log('');

  if (report.contradictions.length > 0) {
    console.log('  CONTRADICTIONS (require human review — no auto-fix):');
    for (const c of report.contradictions.slice(0, 20)) {
      console.log(`    · [${c.relationship_type}]  ${c.a_from_name} (${c.a_from_id})  ↔  ${c.a_to_name} (${c.a_to_id})`);
      console.log(`        edge_ids: ${c.edge_a_id} / ${c.edge_b_id}`);
    }
    if (report.contradictions.length > 20) {
      console.log(`    ... and ${report.contradictions.length - 20} more (see JSON report)`);
    }
    console.log('');
  }

  if (report.self_loops.length > 0) {
    console.log('  SELF-LOOPS:');
    for (const e of report.self_loops.slice(0, 10)) {
      console.log(`    · ${e.from_entity_id}  ${e.relationship_type}  ${e.from_entity_id}   [${e.from_name ?? '?'}]`);
    }
    console.log('');
  }

  if (report.dangling_refs.length > 0) {
    console.log('  DANGLING REFS (from/to id not in entities):');
    for (const e of report.dangling_refs.slice(0, 10)) {
      const missing = !e.from_exists ? e.from_entity_id : e.to_entity_id;
      console.log(`    · edge ${e.id}  missing-entity=${missing}`);
    }
    console.log('');
  }

  if (report.unregistered_types.length > 0) {
    console.log('  UNREGISTERED TYPES (add to RELATIONSHIP_REGISTRY):');
    for (const u of report.unregistered_types.sort((a, b) => b.count - a.count)) {
      console.log(`    · ${u.type.padEnd(20)} ${u.count} edges`);
    }
    console.log('');
  }

  // Missing-inverse samples, grouped by original type.
  const missingByType = Object.entries(report.missing_inverses_by_type)
    .sort((a, b) => b[1].length - a[1].length);
  for (const [type, list] of missingByType) {
    if (list.length === 0) continue;
    const spec = getSpec(type);
    const inv = spec?.kind === 'asymmetric' ? spec.inverse_type : type;
    console.log(`  Missing inverse — ${type} → ${inv}:  ${list.length}`);
    for (const m of list.slice(0, 3)) {
      console.log(`    · ${m.from_name ?? '?'} (${m.from_entity_id})  ${m.relationship_type}  ${m.to_name ?? '?'} (${m.to_entity_id})`);
      console.log(`         → would insert: ${m.to_entity_id}  ${m.inverse_type}  ${m.from_entity_id}  [label: ${m.inverse_label}]`);
    }
    if (list.length > 3) console.log(`    ... +${list.length - 3} more`);
    console.log('');
  }
}

function writeReport(report: ValidationReport): string {
  const outDir = path.resolve(__dirname, '..', 'founders-files', 'reports');
  fs.mkdirSync(outDir, { recursive: true });
  const outPath = path.join(outDir, 'relationship-mismatch-report.json');
  fs.writeFileSync(outPath, JSON.stringify(report, null, 2));
  return outPath;
}

// ───────────────────────── Main ─────────────────────────

function main(): void {
  console.log('Loading entity_relationships …');
  const edges = loadAllEdges();
  console.log(`Loaded ${edges.length} edges.\n`);

  const report = validate(edges);
  printSummary(report);

  const outPath = writeReport(report);
  console.log(`Full report written to:\n  ${outPath}\n`);

  // IMPORTANT: chronology contradictions must be resolved BEFORE inserting
  // reciprocals, otherwise the backfill would happily insert succeeded_by
  // reciprocals for both directions and double the chronology damage.
  //
  // Family-on-non-person must also run BEFORE --fix-missing-inverses, so we
  // never insert a reciprocal for an edge we're about to delete.
  if (FIX_CHRONOLOGY) {
    const deleted = fixChronologyContradictions(report, COMMIT);
    if (COMMIT) console.log(`\n✓ Deleted ${deleted} chronologically-wrong preceded_by rows.\n`);
    else console.log(`\n(dry-run) Would delete ${deleted}. Re-run with --commit.\n`);
  }
  if (FIX_SELF_LOOPS) {
    const deleted = fixSelfLoops(report, COMMIT);
    if (COMMIT) console.log(`\n✓ Deleted ${deleted} self-loop rows.\n`);
    else console.log(`\n(dry-run) Would delete ${deleted}. Re-run with --commit.\n`);
  }
  if (FIX_FAMILY_ON_NON_PERSON) {
    const deleted = fixFamilyOnNonPerson(edges, COMMIT);
    if (COMMIT) console.log(`\n✓ Deleted ${deleted} family-on-non-person rows.\n`);
    else console.log(`\n(dry-run) Would delete ${deleted}. Re-run with --commit.\n`);
  }
  if (FIX_CHAIN_ARTIFACTS) {
    const deleted = fixChainArtifacts(edges, COMMIT);
    if (COMMIT) console.log(`\n✓ Deleted ${deleted} chain-artifact rows.\n`);
    else console.log(`\n(dry-run) Would delete ${deleted}. Re-run with --commit.\n`);
  }
  if (FIX_MISSING) {
    const inserted = fixMissingInverses(report, COMMIT);
    if (COMMIT) console.log(`\n✓ Inserted ${inserted} reciprocal rows.\n`);
    else console.log(`\n(dry-run) Would insert ${inserted}. Re-run with --commit.\n`);
  }
  if (!FIX_MISSING && !FIX_SELF_LOOPS && !FIX_CHRONOLOGY && !FIX_FAMILY_ON_NON_PERSON && !FIX_CHAIN_ARTIFACTS &&
      (report.totals.missing_inverses > 0 || report.totals.self_loops > 0 || report.totals.contradictions > 0)) {
    console.log(`To fix, re-run with  --fix-chronology --fix-self-loops --fix-family-on-non-person --fix-chain-artifacts --fix-missing-inverses --commit`);
  }

  if (DRY_RUN && (FIX_MISSING || FIX_SELF_LOOPS || FIX_CHRONOLOGY || FIX_FAMILY_ON_NON_PERSON || FIX_CHAIN_ARTIFACTS)) {
    console.log('(DRY RUN — no writes performed. Add --commit to persist.)');
  }
}

main();
