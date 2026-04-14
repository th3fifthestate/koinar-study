#!/usr/bin/env tsx
/**
 * TIPNR Disambiguation Audit
 * ---------------------------
 * Parses the TIPNR source TSV and compares it to what actually made it into
 * the `entities` table. Surfaces:
 *   1. Names shared by multiple TIPNR individuals (name collisions)
 *   2. Which of those individuals are/aren't represented in our DB
 *   3. Famous biblical figures entirely missing from the DB
 *   4. A concrete "gap list" with TIPNR ids, verse counts, and biblical
 *      significance for each missing figure — ready to feed the re-import.
 *
 * Run from app/:  npx tsx scripts/audit-tipnr-disambiguation.ts
 */

import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import { getDb } from '../lib/db/connection';

// ───────────────────────── Parse TIPNR ─────────────────────────

type TipnrPerson = {
  unifiedName: string;   // e.g. "James" (before @)
  fullId: string;        // e.g. "James@Mat.13.55-Jud=G2385I" (full disambiguated TIPNR id)
  tipnrKey: string;      // the disambiguator (everything after @ through =)
  strongsKey: string;    // e.g. "G2385I" — the unique Greek/Hebrew Strong variant
  description: string;   // one-liner from col 1
  verseCount: number;
  firstRef: string;
};

function parseTipnr(filePath: string): TipnrPerson[] {
  const content = fs.readFileSync(filePath, 'utf-8');
  const lines = content.split('\n');

  const people: TipnrPerson[] = [];
  let current: Partial<TipnrPerson> | null = null;
  let inPerson = false;

  for (const line of lines) {
    const trimmed = line.trimEnd();

    if (trimmed.startsWith('$==========') && trimmed.includes('PERSON')) {
      if (current && current.unifiedName) {
        people.push(current as TipnrPerson);
      }
      current = { verseCount: 0, description: '', firstRef: '' };
      inPerson = true;
      continue;
    }
    if (!inPerson || !current) continue;

    // Total row: verse count is in col 4
    if (trimmed.startsWith('– Total') || trimmed.startsWith('- Total')) {
      const cols = trimmed.split('\t');
      const count = parseInt((cols[4] ?? '').trim(), 10);
      if (!isNaN(count)) current.verseCount = count;
      continue;
    }

    // Header row — first line that has an "@" and "=" in col 0
    if (
      current.unifiedName === undefined &&
      trimmed.length > 0 &&
      !trimmed.startsWith('$') &&
      !trimmed.startsWith('@') &&
      !trimmed.startsWith('–') &&
      !trimmed.startsWith('-')
    ) {
      const cols = trimmed.split('\t');
      const col0 = (cols[0] ?? '').trim();
      if (col0.includes('@') && col0.includes('=')) {
        const eqIdx = col0.indexOf('=');
        const unifiedFull = col0.slice(0, eqIdx); // "James@Mat.13.55-Jud"
        const strongsKey = col0.slice(eqIdx + 1); // "G2385I"
        const atIdx = unifiedFull.indexOf('@');
        const unifiedName = unifiedFull.slice(0, atIdx); // "James"
        const tipnrKey = unifiedFull.slice(atIdx + 1); // "Mat.13.55-Jud"
        current.unifiedName = unifiedName;
        current.fullId = col0;
        current.tipnrKey = tipnrKey;
        current.strongsKey = strongsKey;
        current.description = (cols[1] ?? '').trim();
        current.firstRef = tipnrKey.split('-')[0]; // "Mat.13.55"
      }
    }
  }
  if (current && current.unifiedName) people.push(current as TipnrPerson);

  return people;
}

// ───────────────────── Classification helpers ─────────────────────

/**
 * Names whose missing individuals are high-impact for a Bible study app.
 * Surfacing these first gives David a crisp "launch blocker" list.
 */
const HIGH_IMPACT_NAMES = new Set([
  'Mary', 'James', 'Joseph', 'Joses', 'Judas', 'Jude', 'Simon',
  'John', 'Zechariah', 'Zacharias', 'Herod', 'Philip', 'Lazarus',
  'Mary_Magdalene', 'Martha', 'Salome', 'Joanna', 'Cleopas', 'Clopas',
  'Alphaeus', 'Levi', 'Matthew', 'Thaddaeus', 'Bartholomew',
  'Ananias', 'Saphira', 'Barnabas', 'Mark', 'Silas', 'Timothy',
  'Apollos', 'Priscilla', 'Aquila', 'Nicodemus', 'Joseph_Arimathea',
]);

// ───────────────────── Audit ─────────────────────

function main() {
  const filePath = path.join(__dirname, '../data/tipnr/tipnr-names.tsv');
  console.log(`Reading TIPNR: ${filePath}\n`);
  const all = parseTipnr(filePath);
  console.log(`Parsed ${all.length} TIPNR person entries.\n`);

  // Group by shared unified name
  const byName = new Map<string, TipnrPerson[]>();
  for (const p of all) {
    const list = byName.get(p.unifiedName) ?? [];
    list.push(p);
    byName.set(p.unifiedName, list);
  }

  const collisions = [...byName.entries()]
    .filter(([, list]) => list.length > 1)
    .sort((a, b) => b[1].length - a[1].length);

  console.log(`Distinct unified names: ${byName.size}`);
  console.log(`Names with MULTIPLE individuals (collisions): ${collisions.length}\n`);

  // What's in the DB right now?
  const db = getDb();
  const dbPeople = db
    .prepare("SELECT id, canonical_name, tipnr_id FROM entities WHERE entity_type = 'person'")
    .all() as { id: string; canonical_name: string; tipnr_id: string | null }[];

  // Map: canonical_name → list of DB entities (lowercased for match)
  const dbByName = new Map<string, typeof dbPeople>();
  for (const e of dbPeople) {
    const key = e.canonical_name.toLowerCase();
    const list = dbByName.get(key) ?? [];
    list.push(e);
    dbByName.set(key, list);
  }

  // Map: tipnr_id (full id before =) → db entity
  const dbByFullId = new Set<string>();
  for (const e of dbPeople) {
    if (e.tipnr_id) dbByFullId.add(e.tipnr_id);
  }

  // ─── High-impact missing individuals ───
  const highImpactGaps: Array<{
    name: string;
    totalTipnrIndividuals: number;
    representedInDb: number;
    missing: TipnrPerson[];
  }> = [];

  const mediumImpactGaps: typeof highImpactGaps = [];

  for (const [name, individuals] of collisions) {
    const dbMatches = dbByName.get(name.toLowerCase()) ?? [];
    const representedStrongs = new Set(
      dbMatches
        .map(m => m.tipnr_id?.split('=')[1])
        .filter((s): s is string => !!s)
    );
    const missing = individuals.filter(p => !representedStrongs.has(p.strongsKey));
    if (missing.length === 0) continue;

    const bucket = HIGH_IMPACT_NAMES.has(name) ? highImpactGaps : mediumImpactGaps;
    bucket.push({
      name,
      totalTipnrIndividuals: individuals.length,
      representedInDb: individuals.length - missing.length,
      missing,
    });
  }

  highImpactGaps.sort((a, b) => b.missing.length - a.missing.length);
  mediumImpactGaps.sort((a, b) => {
    // Sort by largest missing verse count first (biblical importance proxy)
    const maxA = Math.max(...a.missing.map(m => m.verseCount));
    const maxB = Math.max(...b.missing.map(m => m.verseCount));
    return maxB - maxA;
  });

  // ─── Entirely missing names (canonical name absent from DB) ───
  const entirelyMissing: TipnrPerson[] = [];
  for (const [name, individuals] of byName.entries()) {
    if (!dbByName.has(name.toLowerCase())) {
      // Only report ones with non-trivial verse counts so we don't drown in 1-verse minor figures
      const significant = individuals.filter(p => p.verseCount >= 10);
      entirelyMissing.push(...significant);
    }
  }
  entirelyMissing.sort((a, b) => b.verseCount - a.verseCount);

  // ─── Report ───
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('  HIGH-IMPACT DISAMBIGUATION GAPS (launch blockers)');
  console.log('═══════════════════════════════════════════════════════════════\n');
  if (highImpactGaps.length === 0) {
    console.log('  (none)\n');
  } else {
    for (const g of highImpactGaps) {
      console.log(`▸ ${g.name}  — ${g.representedInDb}/${g.totalTipnrIndividuals} in DB, ${g.missing.length} missing`);
      for (const m of g.missing) {
        const desc = m.description.length > 70 ? m.description.slice(0, 67) + '...' : m.description;
        console.log(`    · ${m.fullId}   [${m.verseCount} vs]   ${desc}`);
      }
      console.log('');
    }
  }

  console.log('═══════════════════════════════════════════════════════════════');
  console.log('  MEDIUM-IMPACT DISAMBIGUATION GAPS');
  console.log('═══════════════════════════════════════════════════════════════\n');
  if (mediumImpactGaps.length === 0) {
    console.log('  (none)\n');
  } else {
    for (const g of mediumImpactGaps.slice(0, 40)) {
      console.log(`▸ ${g.name}  — ${g.representedInDb}/${g.totalTipnrIndividuals} in DB, ${g.missing.length} missing`);
      for (const m of g.missing) {
        const desc = m.description.length > 70 ? m.description.slice(0, 67) + '...' : m.description;
        console.log(`    · ${m.fullId}   [${m.verseCount} vs]   ${desc}`);
      }
      console.log('');
    }
    if (mediumImpactGaps.length > 40) {
      console.log(`  ... and ${mediumImpactGaps.length - 40} more medium-impact collision names omitted.\n`);
    }
  }

  console.log('═══════════════════════════════════════════════════════════════');
  console.log('  ENTIRELY MISSING FROM DB (name has zero entries, ≥10 verse refs)');
  console.log('═══════════════════════════════════════════════════════════════\n');
  if (entirelyMissing.length === 0) {
    console.log('  (none significant)\n');
  } else {
    for (const m of entirelyMissing.slice(0, 40)) {
      const desc = m.description.length > 70 ? m.description.slice(0, 67) + '...' : m.description;
      console.log(`  · ${m.fullId}   [${m.verseCount} vs]   ${desc}`);
    }
    if (entirelyMissing.length > 40) {
      console.log(`\n  ... and ${entirelyMissing.length - 40} more entirely-missing figures omitted.`);
    }
    console.log('');
  }

  // ─── Totals ───
  const totalHighImpactMissing = highImpactGaps.reduce((n, g) => n + g.missing.length, 0);
  const totalMediumImpactMissing = mediumImpactGaps.reduce((n, g) => n + g.missing.length, 0);
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('  SUMMARY');
  console.log('═══════════════════════════════════════════════════════════════');
  console.log(`  TIPNR total persons:                 ${all.length}`);
  console.log(`  TIPNR distinct canonical names:      ${byName.size}`);
  console.log(`  Names with disambiguation needed:    ${collisions.length}`);
  console.log(`  DB person entities:                  ${dbPeople.length}`);
  console.log(`  High-impact names with gaps:         ${highImpactGaps.length}`);
  console.log(`    → individuals missing:             ${totalHighImpactMissing}`);
  console.log(`  Medium-impact names with gaps:       ${mediumImpactGaps.length}`);
  console.log(`    → individuals missing:             ${totalMediumImpactMissing}`);
  console.log(`  Entirely-missing names (≥10 refs):   ${entirelyMissing.length}`);
  console.log('');
  console.log('  Suggested re-import plan:');
  console.log('  1. Key entities.id on TIPNR strongsKey (e.g. JAMES_G2385I), not bare name.');
  console.log('  2. Rename existing ambiguous ids to strongs-suffixed ids.');
  console.log('  3. Re-import all individuals from high + medium collision names.');
  console.log('  4. Import entirely-missing names (esp. Mary, Nicodemus, etc.).');
  console.log('  5. Regenerate content for new entities via batch pipeline.');
  console.log('  6. Re-run entity annotation over existing studies.');
  console.log('');
}

main();
