#!/usr/bin/env tsx
// scripts/map-entities-validate.ts
// Phase 3: Validate cross-reference mappings against TIPNR, report stats.
// Usage: npx tsx scripts/map-entities-validate.ts [options]
//
// Options:
//   --books <list>      Comma-separated book names (default: all mapped books)

import 'dotenv/config';
import { getDb } from '../lib/db/connection';

const args = process.argv.slice(2);
function getArg(name: string): string | undefined {
  const idx = args.indexOf(`--${name}`);
  if (idx === -1 || idx + 1 >= args.length) return undefined;
  return args[idx + 1];
}

const booksArg = getArg('books');

function main() {
  const db = getDb();

  console.log('Entity Cross-Reference Mapping — Validation Report');
  console.log('═══════════════════════════════════════════════════════════\n');

  // ── 1. Overall stats ───────────────────────────────────────────────────

  const totalRefs = db.prepare('SELECT COUNT(*) as c FROM entity_verse_refs').get() as { c: number };
  const bySource = db
    .prepare('SELECT source, COUNT(*) as c FROM entity_verse_refs GROUP BY source ORDER BY c DESC')
    .all() as { source: string; c: number }[];
  const byConfidence = db
    .prepare('SELECT confidence, COUNT(*) as c FROM entity_verse_refs GROUP BY confidence ORDER BY c DESC')
    .all() as { confidence: string; c: number }[];

  console.log('Overall Verse Refs');
  console.log('───────────────────────────────────────');
  console.log(`  Total: ${totalRefs.c}`);
  console.log('  By source:');
  for (const r of bySource) console.log(`    ${r.source.padEnd(28)} ${r.c}`);
  console.log('  By confidence:');
  for (const r of byConfidence) console.log(`    ${r.confidence.padEnd(28)} ${r.c}`);

  // ── 2. TIPNR Consistency Check ─────────────────────────────────────────

  console.log('\nTIPNR Consistency');
  console.log('───────────────────────────────────────');

  // For each TIPNR ref, check if we ALSO have a deterministic/AI ref for the
  // same entity+verse. Mismatches mean our trie matched a different entity or missed it.
  const tipnrRefs = db
    .prepare(
      `SELECT entity_id, book, chapter, verse_start FROM entity_verse_refs
       WHERE source = 'tipnr'`
    )
    .all() as { entity_id: string; book: string; chapter: number; verse_start: number }[];

  // Build set of our non-TIPNR refs
  const ourRefs = new Set<string>();
  const ourRows = db
    .prepare(
      `SELECT entity_id, book, chapter, verse_start FROM entity_verse_refs
       WHERE source IN ('deterministic', 'ai_disambiguated', 'tipnr_disambiguated')`
    )
    .all() as { entity_id: string; book: string; chapter: number; verse_start: number }[];
  for (const r of ourRows) {
    ourRefs.add(`${r.entity_id}|${r.book}|${r.chapter}|${r.verse_start}`);
  }

  // Filter TIPNR refs to only books we've mapped (if --books specified)
  let targetBooks: Set<string> | null = null;
  if (booksArg) {
    targetBooks = new Set(booksArg.split(',').map((b) => b.trim()));
  }

  let tipnrMatched = 0;
  let tipnrMissed = 0;
  const missedSamples: string[] = [];

  for (const ref of tipnrRefs) {
    if (targetBooks && !targetBooks.has(ref.book)) continue;
    const key = `${ref.entity_id}|${ref.book}|${ref.chapter}|${ref.verse_start}`;
    if (ourRefs.has(key)) {
      tipnrMatched++;
    } else {
      tipnrMissed++;
      if (missedSamples.length < 10) {
        missedSamples.push(`  ${ref.entity_id} @ ${ref.book} ${ref.chapter}:${ref.verse_start}`);
      }
    }
  }

  const tipnrTotal = tipnrMatched + tipnrMissed;
  const agreement = tipnrTotal > 0 ? ((tipnrMatched / tipnrTotal) * 100).toFixed(1) : 'N/A';
  console.log(`  TIPNR refs checked:  ${tipnrTotal}`);
  console.log(`  Also found by us:    ${tipnrMatched}`);
  console.log(`  Missed by us:        ${tipnrMissed}`);
  console.log(`  Agreement rate:      ${agreement}%`);
  if (missedSamples.length > 0) {
    console.log('  Sample misses:');
    for (const s of missedSamples) console.log(s);
  }

  // ── 3. Remaining Ambiguous ─────────────────────────────────────────────

  const remaining = db
    .prepare("SELECT COUNT(*) as c FROM entity_verse_refs WHERE source = 'deterministic_ambiguous'")
    .get() as { c: number };
  console.log(`\nRemaining Ambiguous Refs: ${remaining.c}`);

  // ── 4. Per-Book Breakdown ──────────────────────────────────────────────

  console.log('\nPer-Book Density');
  console.log('───────────────────────────────────────');

  const books = db
    .prepare(
      `SELECT DISTINCT book FROM entity_verse_refs
       WHERE source IN ('deterministic', 'ai_disambiguated', 'tipnr_disambiguated')
       ORDER BY book`
    )
    .all() as { book: string }[];

  for (const { book } of books) {
    if (targetBooks && !targetBooks.has(book)) continue;
    const stats = db
      .prepare(
        `SELECT source, COUNT(*) as c FROM entity_verse_refs
         WHERE book = ? AND source IN ('deterministic', 'ai_disambiguated', 'tipnr_disambiguated', 'deterministic_ambiguous')
         GROUP BY source`
      )
      .all(book) as { source: string; c: number }[];
    const total = stats.reduce((sum, s) => sum + s.c, 0);
    const parts = stats.map((s) => `${s.source}: ${s.c}`).join(', ');
    console.log(`  ${book.padEnd(20)} ${total.toString().padStart(5)} refs (${parts})`);
  }

  // ── 5. Duplicate Detection ─────────────────────────────────────────────

  const dupes = db
    .prepare(
      `SELECT entity_id, book, chapter, verse_start, COUNT(*) as c
       FROM entity_verse_refs
       GROUP BY entity_id, book, chapter, verse_start
       HAVING c > 1`
    )
    .all() as { entity_id: string; book: string; chapter: number; verse_start: number; c: number }[];

  console.log(`\nDuplicate Mappings: ${dupes.length}`);
  if (dupes.length > 0 && dupes.length <= 20) {
    for (const d of dupes) {
      console.log(`  ${d.entity_id} @ ${d.book} ${d.chapter}:${d.verse_start} (${d.c}x)`);
    }
  } else if (dupes.length > 20) {
    console.log(`  (showing first 20)`);
    for (const d of dupes.slice(0, 20)) {
      console.log(`  ${d.entity_id} @ ${d.book} ${d.chapter}:${d.verse_start} (${d.c}x)`);
    }
  }

  console.log('\n═══════════════════════════════════════════════════════════');
  console.log('Validation complete.');
}

main();
