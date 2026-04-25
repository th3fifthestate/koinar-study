#!/usr/bin/env tsx
/**
 * Backfill `disambiguation_note` for person entities whose `canonical_name`
 * collides with another person row. The note is derived from the existing
 * `summary` field's leading clause — the LLM-authored summaries already
 * begin with the disambiguating epithet (e.g. "Herod Antipas was the
 * tetrarch of Galilee…", "Joseph of Arimathea was a wealthy…", "Philip
 * the Evangelist…").
 *
 * Idempotent: only writes rows where disambiguation_note IS NULL or empty.
 *
 * Run from app/:
 *   npx tsx scripts/backfill-person-disambiguation.ts                 # dry-run, prints samples
 *   npx tsx scripts/backfill-person-disambiguation.ts --commit        # actually write
 *   npx tsx scripts/backfill-person-disambiguation.ts --names=Herod,Mary --commit
 */

import 'dotenv/config';
import { getDb } from '../lib/db/connection';

type PersonRow = {
  id: string;
  canonical_name: string;
  summary: string | null;
  disambiguation_note: string | null;
};

const argv = new Set(process.argv.slice(2));
const COMMIT = argv.has('--commit');
const namesArg = process.argv.slice(2).find(a => a.startsWith('--names='));
const ONLY_NAMES = namesArg ? namesArg.slice('--names='.length).split(',') : null;

/**
 * Extract a short disambiguator from a person's summary.
 *
 * Heuristics, applied in order. Each strips "{canonical_name}" if it appears
 * at the very start, then takes a leading prose chunk up to a clause boundary
 * and trims/collapses.
 *
 * Returns null when extraction can't find a confident disambiguator —
 * caller should leave the row's disambiguation_note alone.
 */
/**
 * Verbs that mark the boundary between the disambiguating epithet and the
 * descriptive prose. Sourced from the LLM-generated summary patterns we have:
 *  "{Name} {Epithet} was/is/were/are/lived/served/appears/became/ruled/…"
 */
const BOUNDARY_VERBS = [
  'was', 'is', 'were', 'are',
  'appears', 'appeared',
  'lived', 'served',
  'became', 'rose',
  'ruled', 'reigned', 'governed',
  'presided', 'founded',
  'married', 'wed',
  'died', 'fled',
  'led', 'wrote',
  'rebuilt', 'built',
  'succeeded',
];
const BOUNDARY_VERB_PATTERN = new RegExp(`\\s(?:${BOUNDARY_VERBS.join('|')})\\s`, 'i');

export function extractDisambiguator(canonicalName: string, summary: string | null): string | null {
  if (!summary) return null;
  const text = summary.trim();
  if (text.length === 0) return null;

  // STRICT MODE: only extract when summary starts with the canonical name at
  // position 0. Without this gate, summaries like "In his letter to the
  // Romans…" produce nonsense disambiguators.
  const namePattern = new RegExp(`^${escapeRegex(canonicalName)}[,\\s]+`, 'i');
  if (!namePattern.test(text)) return null;
  let working = text.replace(namePattern, '').trim();

  // Strip a leading parenthetical with metadata like "(Greek: …)" or
  // "(Hebrew: …, H1234)". These wrap names but aren't disambiguators.
  working = working.replace(/^\([^)]{0,80}\)\s*/, '').trim();

  // Strip another leading bare comma if both the name strip and parenthetical
  // strip happened ("Mary," → strip → ", the mother…" → strip → "the mother…").
  working = working.replace(/^,\s*/, '').trim();

  // If `working` begins with a boundary verb (no epithet between the
  // canonical name and the verb), there's no good disambiguator to extract —
  // skip rather than producing descriptive prose.
  // E.g. "Joseph was a descendant of King David who lived…" → after strip,
  // working = "was a descendant…" — skip.
  const startsWithVerb = new RegExp(`^(?:${BOUNDARY_VERBS.join('|')})\\s`, 'i');
  if (startsWithVerb.test(working)) return null;

  // Cut at the earliest of: first boundary verb, first comma, first period.
  // The first comma often precedes the verb in comma-form summaries
  // ("Philip the Tetrarch, son of Herod, ruled…" — comma cut wins over the
  // " ruled " cut).
  const verbMatch = working.match(BOUNDARY_VERB_PATTERN);
  const verbIdx = verbMatch?.index ?? -1;
  const commaIdx = working.indexOf(',');
  const periodIdx = working.indexOf('.');
  const cutPoints = [verbIdx, commaIdx, periodIdx].filter(i => i >= 0);
  if (cutPoints.length === 0) return null;
  let candidate = working.slice(0, Math.min(...cutPoints)).trim();

  // Strip inline "(Greek: …)" / "(Hebrew: …)" parentheticals from the candidate.
  candidate = candidate.replace(/\s*\((?:Greek|Hebrew|Latin|Aramaic):[^)]*\)/gi, '').trim();

  // Drop trailing punctuation.
  candidate = candidate.replace(/[.,;:]+$/, '').trim();

  // Reject if extraction produced something too long for a card disambiguator
  // — better to skip than to render a paragraph.
  if (candidate.length > 60) return null;

  // Final sanity.
  if (candidate.length < 3) return null;
  if (candidate.toLowerCase() === canonicalName.toLowerCase()) return null;

  return candidate;
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function main(): void {
  const db = getDb();

  // Step 1: find collision clusters.
  const collisionRows = db
    .prepare(
      `SELECT canonical_name, COUNT(*) AS cnt
         FROM entities
        WHERE entity_type = 'person'
        GROUP BY canonical_name
        HAVING cnt > 1`
    )
    .all() as { canonical_name: string; cnt: number }[];

  let collisionNames = collisionRows.map(r => r.canonical_name);
  if (ONLY_NAMES) {
    collisionNames = collisionNames.filter(n => ONLY_NAMES.includes(n));
  }

  console.log(
    `Found ${collisionRows.length} collision-cluster names covering ${collisionRows.reduce((s, r) => s + r.cnt, 0)} persons.`
  );
  if (ONLY_NAMES) {
    console.log(`Filtering to ${collisionNames.length} names: ${collisionNames.join(', ')}`);
  }

  // Step 2: load persons in those clusters with NULL/empty disambiguation_note.
  const placeholders = collisionNames.map(() => '?').join(',');
  const rows = db
    .prepare(
      `SELECT id, canonical_name, summary, disambiguation_note
         FROM entities
        WHERE entity_type = 'person'
          AND canonical_name IN (${placeholders})
          AND (disambiguation_note IS NULL OR disambiguation_note = '')`
    )
    .all(...collisionNames) as PersonRow[];

  console.log(`\nCandidates (NULL disambiguation_note): ${rows.length}`);

  // Step 3: extract.
  const updates: { id: string; canonical_name: string; note: string }[] = [];
  const skipped: { id: string; canonical_name: string; reason: string }[] = [];
  for (const r of rows) {
    const note = extractDisambiguator(r.canonical_name, r.summary);
    if (note) {
      updates.push({ id: r.id, canonical_name: r.canonical_name, note });
    } else {
      skipped.push({
        id: r.id,
        canonical_name: r.canonical_name,
        reason: r.summary ? 'extraction-failed' : 'no-summary',
      });
    }
  }

  console.log(`  Extracted: ${updates.length}`);
  console.log(`  Skipped:   ${skipped.length}`);

  // Step 4: print samples grouped by name (so you can eyeball quality).
  const byName = new Map<string, typeof updates>();
  for (const u of updates) {
    const list = byName.get(u.canonical_name) ?? [];
    list.push(u);
    byName.set(u.canonical_name, list);
  }
  console.log('\nSample extractions (top 6 collision clusters):');
  const topNames = collisionRows
    .slice()
    .sort((a, b) => b.cnt - a.cnt)
    .filter(r => byName.has(r.canonical_name))
    .slice(0, 6);
  for (const { canonical_name } of topNames) {
    const list = byName.get(canonical_name)!;
    console.log(`\n  ${canonical_name}  (${list.length} extractions)`);
    for (const u of list.slice(0, 4)) {
      console.log(`    ${u.id.padEnd(22)} → "${u.note}"`);
    }
    if (list.length > 4) console.log(`    … +${list.length - 4} more`);
  }

  if (skipped.length > 0) {
    const reasons: Record<string, number> = {};
    for (const s of skipped) reasons[s.reason] = (reasons[s.reason] ?? 0) + 1;
    console.log('\nSkipped reasons:');
    for (const [r, n] of Object.entries(reasons)) console.log(`  ${r.padEnd(20)} ${n}`);
  }

  // Step 5: commit if requested.
  if (!COMMIT) {
    console.log('\n(DRY RUN — re-run with --commit to apply)\n');
    return;
  }

  console.log(`\nApplying ${updates.length} updates …`);
  const stmt = db.prepare(
    `UPDATE entities
        SET disambiguation_note = ?,
            updated_at = datetime('now')
      WHERE id = ?
        AND (disambiguation_note IS NULL OR disambiguation_note = '')`
  );
  let written = 0;
  db.transaction(() => {
    for (const u of updates) {
      const r = stmt.run(u.note, u.id);
      written += r.changes;
    }
  })();
  console.log(`\n✓ Wrote ${written} rows.\n`);
}

main();
