#!/usr/bin/env tsx
/**
 * STEPBible Lexicon Import — Koinar Bible Study App
 *
 * Imports Hebrew (TBESH) and Greek (TBESG) lexicon entries from the
 * STEPBible-Data repository (Tyndale House Cambridge, CC BY 4.0) into
 * the lexicon_entries table, keyed by normalized Extended Strong's ID.
 *
 * Strong's ID normalization: numeric part is left-padded to 4 digits.
 *   H1 → H0001,  G26 → G0026,  H0001 → H0001 (already padded)
 *
 * Multiple rows in the TSV share the same base eStrong# (disambiguation
 * variants for the same word or proper-name sub-senses). We keep only the
 * first occurrence — the canonical lexical entry — via a seen-set guard.
 *
 * Source: https://github.com/STEPBible/STEPBible-Data  CC BY 4.0
 * Run from app/ directory: npx tsx scripts/import-stepbible-lexicon.ts
 *   Flags:
 *     --source <dir>   path to STEPBible-Data clone (default: data/stepbible)
 *     --dry-run        parse only, print row counts, no DB writes
 */

import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import { execFileSync } from 'child_process';
import { getDb } from '../lib/db/connection';

// ─── Constants ────────────────────────────────────────────────────────────────

const STEPBIBLE_REPO = 'https://github.com/STEPBible/STEPBible-Data';
const LEXICONS_SUBDIR = 'Lexicons';
const TBESH_FILENAME = 'TBESH - Translators Brief lexicon of Extended Strongs for Hebrew - STEPBible.org CC BY.txt';
const TBESG_FILENAME = 'TBESG - Translators Brief lexicon of Extended Strongs for Greek - STEPBible.org CC BY.txt';

const BATCH_SIZE = 2000;

// TSV column indices (0-based, same layout for both TBESH and TBESG)
const COL_ESTRONG = 0;
const COL_LEMMA = 3;
const COL_TRANSLIT = 4;
const COL_MORPH = 5;
const COL_GLOSS = 6;
const COL_DEFINITION = 7;

// ─── Types ────────────────────────────────────────────────────────────────────

interface ParsedEntry {
  strongsId: string;
  language: 'hebrew' | 'greek';
  lemma: string;
  transliteration: string | null;
  gloss: string;
  definition: string | null;
  morphology: string | null;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Normalize an Extended Strong's number to 4-digit zero-padded form.
 * H1 → H0001, G26 → G0026, H0001 → H0001.
 * Letter suffix disambiguators (H0001G) are stripped — we use the base ID only.
 */
function normalizeStrongsId(raw: string): string {
  const match = raw.trim().match(/^([HG])(\d+)/);
  if (!match) return raw.trim();
  return match[1] + match[2].padStart(4, '0');
}

function nullIfEmpty(s: string): string | null {
  const t = s.trim();
  return t.length > 0 ? t : null;
}

// ─── Parsing ──────────────────────────────────────────────────────────────────

function parseFile(filePath: string, language: 'hebrew' | 'greek'): ParsedEntry[] {
  const content = fs.readFileSync(filePath, 'utf-8');
  const lines = content.split('\n');
  const entries: ParsedEntry[] = [];
  const seen = new Set<string>();

  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.length === 0) continue;

    const cols = line.split('\t');

    // Data rows have col 0 matching [HG] followed by digits.
    // Header, comment, and description rows do not match this pattern.
    if (!cols[COL_ESTRONG] || !/^[HG]\d+/.test(cols[COL_ESTRONG].trim())) continue;

    const strongsId = normalizeStrongsId(cols[COL_ESTRONG]);

    // Keep only the first occurrence per base Strong's number.
    // Subsequent rows for the same eStrong# are disambiguation sub-senses.
    if (seen.has(strongsId)) continue;
    seen.add(strongsId);

    const lemma = cols[COL_LEMMA]?.trim() ?? '';
    if (lemma.length === 0) continue;

    const gloss = cols[COL_GLOSS]?.trim() ?? '';
    if (gloss.length === 0) continue;

    entries.push({
      strongsId,
      language,
      lemma,
      transliteration: nullIfEmpty(cols[COL_TRANSLIT] ?? ''),
      gloss,
      definition: nullIfEmpty(cols[COL_DEFINITION] ?? ''),
      morphology: nullIfEmpty(cols[COL_MORPH] ?? ''),
    });
  }

  return entries;
}

// ─── Source setup ─────────────────────────────────────────────────────────────

function ensureSourceDir(sourceDir: string): void {
  const lexiconsDir = path.join(sourceDir, LEXICONS_SUBDIR);
  const tbesh = path.join(lexiconsDir, TBESH_FILENAME);
  const tbesg = path.join(lexiconsDir, TBESG_FILENAME);

  if (fs.existsSync(tbesh) && fs.existsSync(tbesg)) return;

  console.log(`STEPBible data not found at ${sourceDir}. Cloning from GitHub...`);
  fs.mkdirSync(path.dirname(sourceDir), { recursive: true });

  try {
    // execFileSync with an argument array prevents shell injection.
    execFileSync('git', ['clone', '--depth=1', STEPBIBLE_REPO, sourceDir], { stdio: 'inherit' });
  } catch {
    console.error(`Failed to clone ${STEPBIBLE_REPO}`);
    console.error(`To fix, manually clone the repo to ${sourceDir} or pass --source <dir>`);
    process.exit(1);
  }
}

function getSourceVersion(sourceDir: string): string | null {
  try {
    return execFileSync('git', ['rev-parse', 'HEAD'], { cwd: sourceDir, encoding: 'utf-8' }).trim();
  } catch {
    return null;
  }
}

// ─── DB insertion ─────────────────────────────────────────────────────────────

function insertBatch(entries: ParsedEntry[], sourceVersion: string | null): void {
  const db = getDb();
  const stmt = db.prepare(`
    INSERT OR REPLACE INTO lexicon_entries
      (strongs_id, language, lemma, transliteration, gloss, definition, morphology, source, source_version)
    VALUES
      (?, ?, ?, ?, ?, ?, ?, 'stepbible', ?)
  `);

  db.transaction(() => {
    for (const e of entries) {
      stmt.run(
        e.strongsId,
        e.language,
        e.lemma,
        e.transliteration,
        e.gloss,
        e.definition,
        e.morphology,
        sourceVersion,
      );
    }
  })();
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');

  const sourceIdx = args.indexOf('--source');
  const defaultSource = path.resolve(__dirname, '..', 'data', 'stepbible');
  const rawSource = args[sourceIdx + 1];
  if (sourceIdx !== -1 && (!rawSource || rawSource.startsWith('--'))) {
    console.error('Error: --source requires a directory path argument.');
    process.exit(1);
  }
  const sourceDir = sourceIdx !== -1 ? path.resolve(rawSource) : defaultSource;

  console.log(`Source directory: ${sourceDir}`);
  if (dryRun) console.log('Dry-run mode — no writes.');

  ensureSourceDir(sourceDir);

  const sourceVersion = getSourceVersion(sourceDir);
  if (sourceVersion) {
    console.log(`Dataset commit: ${sourceVersion}`);
  }

  const lexiconsDir = path.join(sourceDir, LEXICONS_SUBDIR);
  const tbeshPath = path.join(lexiconsDir, TBESH_FILENAME);
  const tbesgPath = path.join(lexiconsDir, TBESG_FILENAME);

  console.log('Parsing TBESH (Hebrew)...');
  const hebrewEntries = parseFile(tbeshPath, 'hebrew');
  console.log(`  Parsed ${hebrewEntries.length} Hebrew entries.`);

  console.log('Parsing TBESG (Greek)...');
  const greekEntries = parseFile(tbesgPath, 'greek');
  console.log(`  Parsed ${greekEntries.length} Greek entries.`);

  const total = hebrewEntries.length + greekEntries.length;
  console.log(`Total: ${total} entries.`);

  if (dryRun) {
    console.log('Dry-run complete. No rows written.');
    return;
  }

  const allEntries = [...hebrewEntries, ...greekEntries];
  let inserted = 0;
  for (let i = 0; i < allEntries.length; i += BATCH_SIZE) {
    const batch = allEntries.slice(i, i + BATCH_SIZE);
    insertBatch(batch, sourceVersion);
    inserted += batch.length;
    process.stdout.write(`\rInserting... ${inserted}/${total}`);
  }
  console.log(`\nDone. ${inserted} rows written.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
