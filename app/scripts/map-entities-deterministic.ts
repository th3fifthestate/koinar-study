#!/usr/bin/env tsx
// scripts/map-entities-deterministic.ts
// Phase 1: Scan BSB verses through entity name trie, create verse refs.
// Usage: npx tsx scripts/map-entities-deterministic.ts [options]
//
// Options:
//   --group <1-7>       Process a priority book group (default: all)
//   --books <list>      Comma-separated book names (overrides --group)
//   --dry-run           Report matches without writing to DB
//   --clear-existing    Clear deterministic mappings for specified books first

import 'dotenv/config';
import { getDb } from '../lib/db/connection';
import { getBsbDb } from '../lib/db/bible/connection';
import { getBookId } from '../lib/db/bible/queries';
import { buildEntityNameIndex } from '../lib/entities/name-index';
import type { EntityVerseRef } from '../lib/db/types';

// ── Book Groups ──────────────────────────────────────────────────────────────

const BOOK_GROUPS: Record<number, string[]> = {
  1: ['Matthew', 'Mark', 'Luke', 'John'],
  2: ['Acts'],
  3: ['Genesis', 'Exodus'],
  4: ['1 Samuel', '2 Samuel', '1 Kings', '2 Kings'],
  5: ['Romans', '1 Corinthians', '2 Corinthians', 'Galatians', 'Ephesians'],
  6: [
    'Joshua', 'Judges', 'Ruth', 'Leviticus', 'Numbers', 'Deuteronomy',
    '1 Chronicles', '2 Chronicles', 'Ezra', 'Nehemiah', 'Esther', 'Job',
    'Psalms', 'Proverbs', 'Ecclesiastes', 'Song of Solomon',
    'Isaiah', 'Jeremiah', 'Lamentations', 'Ezekiel', 'Daniel',
    'Hosea', 'Joel', 'Amos', 'Obadiah', 'Jonah', 'Micah', 'Nahum',
    'Habakkuk', 'Zephaniah', 'Haggai', 'Zechariah', 'Malachi',
  ],
  7: [
    'Philippians', 'Colossians', '1 Thessalonians', '2 Thessalonians',
    '1 Timothy', '2 Timothy', 'Titus', 'Philemon', 'Hebrews',
    'James', '1 Peter', '2 Peter', '1 John', '2 John', '3 John',
    'Jude', 'Revelation',
  ],
};

// ── CLI ──────────────────────────────────────────────────────────────────────

const args = process.argv.slice(2);

function getArg(name: string): string | undefined {
  const idx = args.indexOf(`--${name}`);
  if (idx === -1 || idx + 1 >= args.length) return undefined;
  return args[idx + 1];
}

function hasFlag(name: string): boolean {
  return args.includes(`--${name}`);
}

const dryRun = hasFlag('dry-run');
const clearExisting = hasFlag('clear-existing');
const groupArg = getArg('group');
const booksArg = getArg('books');

function getTargetBooks(): string[] {
  if (booksArg) return booksArg.split(',').map((b) => b.trim());
  if (groupArg) {
    const num = parseInt(groupArg, 10);
    if (BOOK_GROUPS[num]) return BOOK_GROUPS[num];
    console.error(`Unknown group: ${groupArg}. Valid: 1-7`);
    process.exit(1);
  }
  // Default: all groups
  return Object.values(BOOK_GROUPS).flat();
}

// ── Main ─────────────────────────────────────────────────────────────────────

function main() {
  const books = getTargetBooks();

  console.log('Entity Cross-Reference Mapping — Phase 1 (Deterministic)');
  console.log('═══════════════════════════════════════════════════════════');
  console.log(`Mode: ${dryRun ? 'DRY RUN' : 'COMMIT'}`);
  console.log(`Books: ${books.join(', ')}`);
  console.log(`Clear existing: ${clearExisting}\n`);

  // Build name index
  console.log('Building entity name index...');
  const index = buildEntityNameIndex();
  console.log(`Index built: ${index.size} surface forms\n`);

  const db = getDb();
  const bsbDb = getBsbDb();

  // Load existing entity+verse combos for dedup
  const existingRefs = new Set<string>();
  const existingRows = db
    .prepare('SELECT entity_id, book, chapter, verse_start FROM entity_verse_refs')
    .all() as { entity_id: string; book: string; chapter: number; verse_start: number }[];
  for (const r of existingRows) {
    existingRefs.add(`${r.entity_id}|${r.book}|${r.chapter}|${r.verse_start}`);
  }
  console.log(`Loaded ${existingRefs.size} existing refs for dedup\n`);

  // Clear existing deterministic refs if requested
  if (clearExisting && !dryRun) {
    const placeholders = books.map(() => '?').join(',');
    const deleted = db
      .prepare(`DELETE FROM entity_verse_refs WHERE source IN ('deterministic', 'deterministic_ambiguous') AND book IN (${placeholders})`)
      .run(...books);
    console.log(`Cleared ${deleted.changes} existing deterministic refs\n`);
    // Rebuild dedup set after clearing
    existingRefs.clear();
    const refreshed = db
      .prepare('SELECT entity_id, book, chapter, verse_start FROM entity_verse_refs')
      .all() as { entity_id: string; book: string; chapter: number; verse_start: number }[];
    for (const r of refreshed) {
      existingRefs.add(`${r.entity_id}|${r.book}|${r.chapter}|${r.verse_start}`);
    }
  }

  let totalUnambiguous = 0;
  let totalAmbiguous = 0;
  let totalSkippedDedup = 0;
  let totalVerses = 0;

  const insertStmt = db.prepare(
    `INSERT INTO entity_verse_refs (entity_id, book, chapter, verse_start, verse_end, surface_text, confidence, source)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  );

  for (const bookName of books) {
    const bookId = getBookId(bookName);
    if (!bookId) {
      console.log(`[SKIP] Book not found in BSB: ${bookName}`);
      continue;
    }

    // Get all verses for this book
    const verses = bsbDb
      .prepare(
        'SELECT chapter, verse, text FROM BSB_verses WHERE book_id = ? ORDER BY chapter, verse'
      )
      .all(bookId) as { chapter: number; verse: number; text: string }[];

    let bookUnambiguous = 0;
    let bookAmbiguous = 0;
    let bookSkipped = 0;

    // Process in chapter-sized transactions for performance
    const chapterMap = new Map<number, { chapter: number; verse: number; text: string }[]>();
    for (const v of verses) {
      const arr = chapterMap.get(v.chapter) ?? [];
      arr.push(v);
      chapterMap.set(v.chapter, arr);
    }

    for (const [chapter, chapterVerses] of chapterMap) {
      const refsToInsert: Omit<EntityVerseRef, 'id' | 'created_at'>[] = [];

      for (const v of chapterVerses) {
        totalVerses++;
        const matches = index.findMatches(v.text);

        for (const match of matches) {
          if (match.ambiguous) {
            // For ambiguous matches, store ALL candidate IDs in surface_text as JSON
            const dedupKey = `${match.candidate_ids[0]}|${bookName}|${chapter}|${v.verse}`;
            if (existingRefs.has(dedupKey)) {
              bookSkipped++;
              continue;
            }
            refsToInsert.push({
              entity_id: match.candidate_ids[0], // placeholder — will be resolved in Phase 1b/2
              book: bookName,
              chapter,
              verse_start: v.verse,
              verse_end: v.verse,
              surface_text: JSON.stringify({
                matched: match.surface_text,
                candidates: match.candidate_ids,
              }),
              confidence: 'low',
              source: 'deterministic_ambiguous',
            });
            existingRefs.add(dedupKey);
            bookAmbiguous++;
          } else {
            // Unambiguous — check dedup
            const dedupKey = `${match.entity_id}|${bookName}|${chapter}|${v.verse}`;
            if (existingRefs.has(dedupKey)) {
              bookSkipped++;
              continue;
            }
            refsToInsert.push({
              entity_id: match.entity_id,
              book: bookName,
              chapter,
              verse_start: v.verse,
              verse_end: v.verse,
              surface_text: match.surface_text,
              confidence: 'high',
              source: 'deterministic',
            });
            existingRefs.add(dedupKey);
            bookUnambiguous++;
          }
        }
      }

      // Batch insert per chapter (not using insertVerseRefs which wraps its own transaction)
      if (!dryRun && refsToInsert.length > 0) {
        db.transaction(() => {
          for (const ref of refsToInsert) {
            insertStmt.run(
              ref.entity_id, ref.book, ref.chapter, ref.verse_start, ref.verse_end,
              ref.surface_text, ref.confidence, ref.source
            );
          }
        })();
      }
    }

    totalUnambiguous += bookUnambiguous;
    totalAmbiguous += bookAmbiguous;
    totalSkippedDedup += bookSkipped;

    console.log(
      `  ${bookName.padEnd(20)} ${verses.length.toString().padStart(5)} verses → ` +
      `${bookUnambiguous} unambiguous, ${bookAmbiguous} ambiguous, ${bookSkipped} deduped`
    );
  }

  console.log('\n═══════════════════════════════════════════════════════════');
  console.log(`Total verses scanned:    ${totalVerses}`);
  console.log(`Unambiguous matches:     ${totalUnambiguous}`);
  console.log(`Ambiguous matches:       ${totalAmbiguous}`);
  console.log(`Skipped (already exist): ${totalSkippedDedup}`);
  if (dryRun) console.log('\n(Dry run — no data written)');
}

main();
