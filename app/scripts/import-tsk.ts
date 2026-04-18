#!/usr/bin/env tsx
/**
 * TSK Import Script — Koinar Bible Study App
 *
 * Ingests ~340,000 cross-references from the Treasury of Scripture Knowledge
 * (TSK) via the OpenBible.info derivative dataset into the `cross_refs` table.
 *
 * Source: OpenBible.info, https://www.openbible.info/labs/cross-references/
 * License: Public Domain (TSK)
 *
 * Run from app/ directory: npx tsx scripts/import-tsk.ts
 *   Flags:
 *     --dry-run          parse everything, report row count, insert nothing
 *     --source=<path>    use a local file instead of downloading
 */

import 'dotenv/config';
import fs from 'fs';
import https from 'https';
import path from 'path';
import { getDb } from '../lib/db/connection';

const TSK_URL = 'https://www.openbible.info/labs/cross-references/cross_references.txt';
const CHUNK_SIZE = 5_000;
const LOG_INTERVAL = 10_000;
const MIN_ROW_COUNT = 300_000;

// ==============================
// OSIS book abbreviation map
// ==============================

const OSIS_BOOK_MAP: Record<string, string> = {
  Gen: 'Genesis', Exod: 'Exodus', Lev: 'Leviticus', Num: 'Numbers', Deut: 'Deuteronomy',
  Josh: 'Joshua', Judg: 'Judges', Ruth: 'Ruth', '1Sam': '1 Samuel', '2Sam': '2 Samuel',
  '1Kgs': '1 Kings', '2Kgs': '2 Kings', '1Chr': '1 Chronicles', '2Chr': '2 Chronicles',
  Ezra: 'Ezra', Neh: 'Nehemiah', Esth: 'Esther', Job: 'Job', Ps: 'Psalms',
  Prov: 'Proverbs', Eccl: 'Ecclesiastes', Song: 'Song of Solomon', Isa: 'Isaiah',
  Jer: 'Jeremiah', Lam: 'Lamentations', Ezek: 'Ezekiel', Dan: 'Daniel',
  Hos: 'Hosea', Joel: 'Joel', Amos: 'Amos', Obad: 'Obadiah', Jonah: 'Jonah',
  Mic: 'Micah', Nah: 'Nahum', Hab: 'Habakkuk', Zeph: 'Zephaniah', Hag: 'Haggai',
  Zech: 'Zechariah', Mal: 'Malachi',
  Matt: 'Matthew', Mark: 'Mark', Luke: 'Luke', John: 'John', Acts: 'Acts',
  Rom: 'Romans', '1Cor': '1 Corinthians', '2Cor': '2 Corinthians', Gal: 'Galatians',
  Eph: 'Ephesians', Phil: 'Philippians', Col: 'Colossians',
  '1Thess': '1 Thessalonians', '2Thess': '2 Thessalonians',
  '1Tim': '1 Timothy', '2Tim': '2 Timothy', Titus: 'Titus', Phlm: 'Philemon',
  Heb: 'Hebrews', Jas: 'James', '1Pet': '1 Peter', '2Pet': '2 Peter',
  '1John': '1 John', '2John': '2 John', '3John': '3 John', Jude: 'Jude',
  Rev: 'Revelation',
};

// ==============================
// Types
// ==============================

type ParsedRow = {
  from_book: string;
  from_chapter: number;
  from_verse: number;
  to_book: string;
  to_chapter: number;
  to_verse_start: number;
  to_verse_end: number | null;
  votes: number | null;
};

// ==============================
// Helpers
// ==============================

function parseVerseRef(ref: string): { book: string; chapter: number; verse: number } | null {
  // OSIS format: "Gen.1.1"
  const match = ref.trim().match(/^([A-Za-z0-9]+)\.(\d+)\.(\d+)$/);
  if (!match) return null;
  const book = OSIS_BOOK_MAP[match[1]];
  if (!book) return null;
  return { book, chapter: parseInt(match[2], 10), verse: parseInt(match[3], 10) };
}

function parseLine(line: string): ParsedRow | null {
  const cols = line.split('\t');
  if (cols.length < 2) return null;

  const fromRef = parseVerseRef(cols[0].trim());
  if (!fromRef) return null;

  const toRaw = cols[1].trim();
  let to_book: string;
  let to_chapter: number;
  let to_verse_start: number;
  let to_verse_end: number | null = null;

  // Range: "Gen.1.1-Gen.1.5" — two full refs joined by "-"
  const dashIdx = toRaw.indexOf('-', toRaw.indexOf('.') + 1);
  if (dashIdx !== -1) {
    const startPart = toRaw.slice(0, dashIdx);
    const endPart = toRaw.slice(dashIdx + 1);
    const startRef = parseVerseRef(startPart);
    const endRef = parseVerseRef(endPart);
    if (!startRef || !endRef) return null;
    to_book = startRef.book;
    to_chapter = startRef.chapter;
    to_verse_start = startRef.verse;
    to_verse_end = endRef.verse;
  } else {
    const toRef = parseVerseRef(toRaw);
    if (!toRef) return null;
    to_book = toRef.book;
    to_chapter = toRef.chapter;
    to_verse_start = toRef.verse;
  }

  const votes = cols[2] ? parseInt(cols[2].trim(), 10) : null;

  return {
    from_book: fromRef.book,
    from_chapter: fromRef.chapter,
    from_verse: fromRef.verse,
    to_book,
    to_chapter,
    to_verse_start,
    to_verse_end,
    votes: votes !== null && !isNaN(votes) ? votes : null,
  };
}

function download(url: string): Promise<string> {
  return new Promise((resolve, reject) => {
    console.log(`Downloading ${url} ...`);
    https.get(url, (res) => {
      if (res.statusCode !== 200) {
        reject(new Error(`HTTP ${res.statusCode} from ${url}`));
        return;
      }
      const chunks: Buffer[] = [];
      res.on('data', (c: Buffer) => chunks.push(c));
      res.on('end', () => resolve(Buffer.concat(chunks).toString('utf-8')));
      res.on('error', reject);
    }).on('error', reject);
  });
}

// ==============================
// Main
// ==============================

async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');
  const sourceArg = args.find((a) => a.startsWith('--source='));
  const sourcePath = sourceArg ? sourceArg.slice('--source='.length) : null;

  console.log(`Mode: ${dryRun ? 'DRY RUN (no writes)' : 'COMMIT'}`);

  // 1. Fetch or read the TSK file
  let raw: string;
  if (sourcePath) {
    console.log(`Reading local file: ${sourcePath}`);
    raw = fs.readFileSync(path.resolve(sourcePath), 'utf-8');
  } else {
    raw = await download(TSK_URL);
  }

  const lines = raw.split('\n');

  // 2. Parse all lines, skipping header and blanks
  const rows: ParsedRow[] = [];
  let parseErrors = 0;

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('From Verse')) continue;
    const parsed = parseLine(trimmed);
    if (!parsed) {
      parseErrors++;
      if (parseErrors <= 20) {
        console.warn(`  Skipping unparseable line: ${trimmed.slice(0, 80)}`);
      }
      continue;
    }
    rows.push(parsed);
  }

  console.log(`Parsed ${rows.length} rows (${parseErrors} skipped)`);

  if (dryRun) {
    console.log(`\nDry-run summary:`);
    console.log(`  Would insert: ${rows.length} rows`);
    console.log(`  Parse errors: ${parseErrors}`);
    if (rows.length < MIN_ROW_COUNT) {
      console.error(`ERROR: Row count ${rows.length} is below minimum ${MIN_ROW_COUNT}`);
      process.exit(1);
    }
    console.log('✓ Dry run complete.');
    return;
  }

  // 3. Get DB connection
  const db = getDb();

  // 4. Delete existing TSK rows (idempotent re-run)
  const deleted = db.prepare("DELETE FROM cross_refs WHERE source = 'tsk'").run();
  if (deleted.changes > 0) {
    console.log(`Cleared ${deleted.changes} existing TSK rows.`);
  }

  // 5. Prepare insert statement
  const insert = db.prepare(`
    INSERT INTO cross_refs
      (from_book, from_chapter, from_verse, to_book, to_chapter, to_verse_start, to_verse_end, votes, source)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'tsk')
  `);

  // 6. Chunked transactional inserts
  let inserted = 0;
  const startMs = Date.now();

  for (let i = 0; i < rows.length; i += CHUNK_SIZE) {
    const chunk = rows.slice(i, i + CHUNK_SIZE);
    db.transaction(() => {
      for (const row of chunk) {
        insert.run(
          row.from_book, row.from_chapter, row.from_verse,
          row.to_book, row.to_chapter, row.to_verse_start,
          row.to_verse_end ?? null,
          row.votes ?? null,
        );
        inserted++;
      }
    })();

    if (inserted % LOG_INTERVAL === 0 || inserted === rows.length) {
      const elapsed = ((Date.now() - startMs) / 1000).toFixed(1);
      console.log(`  ${inserted.toLocaleString()} rows inserted (${elapsed}s)`);
    }
  }

  // 7. Sanity check
  const finalCount = (db.prepare("SELECT COUNT(*) as c FROM cross_refs WHERE source = 'tsk'").get() as { c: number }).c;
  console.log(`\nFinal row count: ${finalCount.toLocaleString()}`);

  if (finalCount < MIN_ROW_COUNT) {
    console.error(`ERROR: Final count ${finalCount} is below minimum ${MIN_ROW_COUNT}. Something went wrong.`);
    process.exit(1);
  }

  const totalSec = ((Date.now() - startMs) / 1000).toFixed(1);
  console.log(`✓ Import complete in ${totalSec}s.`);
}

main().catch((err) => {
  console.error('Import failed:', err);
  process.exit(1);
});
