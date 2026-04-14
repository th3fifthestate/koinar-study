#!/usr/bin/env tsx
/**
 * TIPNR Import Script — Koinar Bible Study App
 *
 * Imports EVERY person from the STEPBible TIPNR dataset, keyed on a
 * Strong's-suffixed entity id (`NAME_STRONGS`) so that each TIPNR
 * individual gets its own distinct row. This eliminates the collision
 * class where multiple biblical figures sharing a name (Mary, James,
 * Joseph, Judas, ...) would collapse into a single DB row.
 *
 * Family relationships (parents, siblings, partners, offspring) are
 * resolved through a `Name@Ref → entity_id` lookup map, so each edge
 * points to the specific individual TIPNR references — not to whatever
 * the bare-name happened to resolve to previously.
 *
 * Source: Tyndale House Cambridge, CC BY 4.0
 * Run from app/ directory: npx tsx scripts/import-tipnr.ts
 *   Flags:
 *     --dry-run   parse only, no DB writes
 *     --limit=N   import first N entries (debug)
 */

import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import { getDb } from '../lib/db/connection';
import { insertRelationship } from '../lib/db/entities/queries';
import type { EntityVerseRef } from '../lib/db/types';

// ==============================
// Book abbreviation map
// ==============================

const BOOK_MAP: Record<string, string> = {
  Gen: 'Genesis', Exo: 'Exodus', Lev: 'Leviticus', Num: 'Numbers', Deu: 'Deuteronomy',
  Jos: 'Joshua', Jdg: 'Judges', Rut: 'Ruth', '1Sa': '1 Samuel', '2Sa': '2 Samuel',
  '1Ki': '1 Kings', '2Ki': '2 Kings', '1Ch': '1 Chronicles', '2Ch': '2 Chronicles',
  Ezr: 'Ezra', Neh: 'Nehemiah', Est: 'Esther', Job: 'Job', Psa: 'Psalms',
  Pro: 'Proverbs', Ecc: 'Ecclesiastes', Son: 'Song of Solomon', Isa: 'Isaiah',
  Jer: 'Jeremiah', Lam: 'Lamentations', Eze: 'Ezekiel', Dan: 'Daniel',
  Hos: 'Hosea', Joe: 'Joel', Amo: 'Amos', Oba: 'Obadiah', Jon: 'Jonah',
  Mic: 'Micah', Nah: 'Nahum', Hab: 'Habakkuk', Zep: 'Zephaniah', Hag: 'Haggai',
  Zec: 'Zechariah', Mal: 'Malachi', Mat: 'Matthew', Mar: 'Mark', Luk: 'Luke',
  Joh: 'John', Act: 'Acts', Rom: 'Romans', '1Co': '1 Corinthians', '2Co': '2 Corinthians',
  Gal: 'Galatians', Eph: 'Ephesians', Php: 'Philippians', Col: 'Colossians',
  '1Th': '1 Thessalonians', '2Th': '2 Thessalonians', '1Ti': '1 Timothy', '2Ti': '2 Timothy',
  Tit: 'Titus', Phm: 'Philemon', Heb: 'Hebrews', Jas: 'James', '1Pe': '1 Peter',
  '2Pe': '2 Peter', '1Jo': '1 John', '2Jo': '2 John', '3Jo': '3 John', Jud: 'Jude',
  Rev: 'Revelation',
};

// ==============================
// Helper functions
// ==============================

/**
 * Build a Strong's-suffixed entity ID.
 *
 * @param unifiedName e.g. "James@Mat.13.55-Jud"
 * @param strongsKey  e.g. "G2385I" — the token after `=` in the TIPNR row
 */
function toEntityId(unifiedName: string, strongsKey: string): string {
  const namePart = unifiedName.split('@')[0];
  const split = namePart.replace(/([a-z])([A-Z])/g, '$1_$2');
  // Collapse any non-alphanumeric char (except _) to _ — covers #, ', ., etc.
  const base = split.replace(/[^A-Za-z0-9_]+/g, '_').toUpperCase();
  return `${base}_${strongsKey}`;
}

/**
 * Keep the full family ref (e.g. "Aaron@Exo.4.14-Heb") intact — we resolve
 * it to a specific entity id later via a `unifiedName → entity_id` map.
 */
function normalizeFamilyRef(raw: string): string {
  // Strip trailing whitespace and any stray noise, but PRESERVE the `@Ref`
  // disambiguator so we can look up the specific individual.
  return raw.trim();
}

function parseVerseRef(ref: string): { book: string; chapter: number; verse_start: number; verse_end: number } | null {
  const cleaned = ref.trim().replace(/^LXX\s+/i, '');
  const match = cleaned.match(/^([A-Za-z0-9]+)\.(\d+)\.(\d+)[a-z]?$/);
  if (!match) return null;
  const [, abbr, chStr, vsStr] = match;
  const book = BOOK_MAP[abbr];
  if (!book) return null;
  const verse = parseInt(vsStr, 10);
  return { book, chapter: parseInt(chStr, 10), verse_start: verse, verse_end: verse };
}

function stripHtml(text: string): string {
  return text.replace(/<[^>]+>/g, '').trim();
}

function parseFamilyList(raw: string): string[] {
  if (!raw || raw.trim() === '' || raw.trim() === '>' || raw.trim() === '+') return [];
  // Handle "Name@ref + Name@ref" (parents) and "Name@ref, Name@ref" (others).
  // We KEEP the full `Name@ref` form so we can disambiguate which individual
  // the edge points to via the unifiedName → entity_id lookup.
  return raw
    .split(/[,+]/)
    .map((s) => normalizeFamilyRef(s))
    .filter((s) => s.length > 0 && s !== '>' && s !== '+');
}

// ==============================
// Types
// ==============================

type PersonEntry = {
  unifiedName: string;    // "Name@Ref" part (before the "=") — unique per TIPNR person
  strongsKey: string;     // "Strong's" part (after the "=") — e.g. "G2385I"
  displayName: string;    // bare canonical name ("James")
  description: string;
  parents: string[];      // raw "Name@ref" strings, resolved later
  siblings: string[];
  partners: string[];
  offspring: string[];
  hebrewName: string;     // extracted from – Named row after "="
  greekName: string;      // extracted from – Greek row after "="
  tipnrId: string;        // full "Name@Ref=Strong's" string
  verseRefs: string[];    // exhaustive list from Named + Greek sub-rows (col 5)
  verseCount: number;     // from – Total row col 4
  briefest: string;
  brief: string;
  shortDesc: string;      // @Short= value → quick_glance
  article: string;        // @Article= value (full) → full_profile; first para → summary
};

// ==============================
// File parsing
// ==============================

function parseFile(filePath: string): PersonEntry[] {
  const content = fs.readFileSync(filePath, 'utf-8');
  const lines = content.split('\n');

  const entries: PersonEntry[] = [];
  let current: PersonEntry | null = null;

  for (const line of lines) {
    const trimmed = line.trimEnd();

    // Detect start of a data person entry (has space before PERSON)
    if (trimmed.startsWith('$==========') && trimmed.includes(' PERSON')) {
      // Save previous entry if any
      if (current) entries.push(current);
      current = {
        unifiedName: '',
        strongsKey: '',
        displayName: '',
        description: '',
        parents: [],
        siblings: [],
        partners: [],
        offspring: [],
        hebrewName: '',
        greekName: '',
        tipnrId: '',
        verseRefs: [],
        verseCount: 0,
        briefest: '',
        brief: '',
        shortDesc: '',
        article: '',
      };
      continue;
    }

    if (!current) continue;

    // Sub-rows: lines starting with – (en-dash or regular dash)
    if (trimmed.startsWith('– ') || trimmed.startsWith('- ')) {
      const cols = trimmed.split('\t');
      const rowType = cols[0].replace(/^[–\-]\s*/, '').trim();

      if (rowType === 'Named') {
        // Col 2: dStrong«eStrong=HebrewForm → extract after "="
        const strongCol = cols[2] ?? '';
        const eqIdx = strongCol.indexOf('=');
        if (eqIdx !== -1) {
          current.hebrewName = strongCol.slice(eqIdx + 1).trim();
        }
        // Col 5: exhaustive refs (semicolon-separated)
        const refsCol = cols[5] ?? '';
        const refs = refsCol.split(/;\s*/).map(r => r.trim()).filter(r => r.length > 0);
        current.verseRefs.push(...refs);
      } else if (rowType === 'Greek') {
        // Col 2: extract greek form after "="
        const strongCol = cols[2] ?? '';
        const eqIdx = strongCol.indexOf('=');
        if (eqIdx !== -1) {
          current.greekName = strongCol.slice(eqIdx + 1).trim();
        }
        // Col 5: exhaustive refs
        const refsCol = cols[5] ?? '';
        const refs = refsCol.split(/;\s*/).map(r => r.trim()).filter(r => r.length > 0);
        current.verseRefs.push(...refs);
      } else if (rowType === 'Total') {
        // Col 4: count
        const countStr = (cols[4] ?? '').trim();
        const count = parseInt(countStr, 10);
        if (isNaN(count)) {
          console.warn(`  Could not parse verse count for: ${current.displayName}`);
        } else {
          current.verseCount = count;
        }
      }
      continue;
    }

    // Annotation lines
    if (trimmed.startsWith('@Briefest=')) {
      current.briefest = trimmed.replace(/^@Briefest=\s*/, '').trim();
      continue;
    }
    if (trimmed.startsWith('@Brief=')) {
      current.brief = trimmed.replace(/^@Brief=\s*/, '').trim();
      continue;
    }
    if (trimmed.startsWith('@Short=')) {
      // @Short= and @Article= may be on the same tab-delimited line
      const afterShort = trimmed.replace(/^@Short=\s*/, '');
      const tabIdx = afterShort.indexOf('\t');
      if (tabIdx !== -1) {
        current.shortDesc = afterShort.slice(0, tabIdx).trim();
        // Check if @Article= follows in the same line
        const rest = afterShort.slice(tabIdx + 1);
        const articleMatch = rest.match(/^@Article=\s*([\s\S]*)/);
        if (articleMatch) {
          current.article = articleMatch[1].trim();
        }
      } else {
        current.shortDesc = afterShort.trim();
      }
      continue;
    }
    if (trimmed.startsWith('@Article=')) {
      current.article = trimmed.replace(/^@Article=\s*/, '').trim();
      continue;
    }

    // Main data row: tab-separated, first column has UnifiedName@Ref=uStrong pattern
    // Only process if current entry hasn't been assigned yet (unifiedName is empty)
    if (current.unifiedName === '' && trimmed.length > 0 && !trimmed.startsWith('$') && !trimmed.startsWith('@') && !trimmed.startsWith('–') && !trimmed.startsWith('-')) {
      const cols = trimmed.split('\t');
      if (cols.length >= 2 && cols[0].includes('@')) {
        const col0 = cols[0].trim();
        current.tipnrId = col0;
        // UnifiedName is the part before "=" in col0; Strong's key is after
        const eqIdx = col0.indexOf('=');
        if (eqIdx !== -1) {
          current.unifiedName = col0.slice(0, eqIdx);
          current.strongsKey = col0.slice(eqIdx + 1).trim();
        } else {
          current.unifiedName = col0;
          current.strongsKey = '';
        }
        current.displayName = current.unifiedName.split('@')[0];
        current.description = (cols[1] ?? '').trim();

        // Parents: col 2 (format: "Name@ref + Name@ref")
        current.parents = parseFamilyList(cols[2] ?? '');

        // Siblings: col 3
        current.siblings = parseFamilyList(cols[3] ?? '');

        // Partners: col 4
        current.partners = parseFamilyList(cols[4] ?? '');

        // Offspring: col 5
        current.offspring = parseFamilyList(cols[5] ?? '');
      }
    }
  }

  // Push the last entry
  if (current && current.unifiedName !== '') {
    entries.push(current);
  }

  return entries;
}

// ==============================
// Main
// ==============================

async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');
  const limitArg = args.find((a) => a.startsWith('--limit='));
  const limit = limitArg ? parseInt(limitArg.slice('--limit='.length), 10) : null;

  const filePath = path.join(__dirname, '../data/tipnr/tipnr-names.tsv');

  console.log(`Parsing TIPNR file: ${filePath}`);
  console.log(`Mode: ${dryRun ? 'DRY RUN (no writes)' : 'COMMIT'}${limit ? ` — limit ${limit}` : ''}`);

  // 1. Parse all person entries
  const allParsed = parseFile(filePath);
  console.log(`Total persons parsed from file: ${allParsed.length}`);

  // 1a. Drop malformed entries (no strongsKey means we can't build a unique id)
  const allEntries = allParsed.filter((e) => {
    if (!e.strongsKey) {
      console.warn(`  skipping ${e.displayName}: no strongsKey (tipnrId=${e.tipnrId})`);
      return false;
    }
    return true;
  });
  const entries = limit ? allEntries.slice(0, limit) : allEntries;
  console.log(`Importing ${entries.length} persons${limit ? ` (limit)` : ''}.`);

  // 2. Build unifiedName → entity_id map (resolves family refs later)
  //    Family refs in TIPNR use the "Name@Ref" form WITHOUT the Strong's suffix,
  //    but that form is globally unique in TIPNR (it's the PK of the person row).
  const entityIdByUnifiedName = new Map<string, string>();
  for (const entry of entries) {
    const id = toEntityId(entry.unifiedName, entry.strongsKey);
    entityIdByUnifiedName.set(entry.unifiedName, id);
  }

  // 3. Initialize DB
  const db = getDb();

  if (dryRun) {
    console.log('\nDry-run summary:');
    console.log(`  entities to insert:  ${entries.length}`);
    let edgeCount = 0;
    let verseCount = 0;
    for (const e of entries) {
      verseCount += e.verseRefs.length;
      for (const list of [e.parents, e.offspring, e.partners, e.siblings]) {
        for (const ref of list) {
          if (entityIdByUnifiedName.has(ref)) edgeCount++;
        }
      }
    }
    console.log(`  relationship edges:  ${edgeCount} (resolvable through map)`);
    console.log(`  verse refs parsed:   ${verseCount}`);
    console.log('✓ Dry run complete.');
    return;
  }

  // 4. Insert entities + verse refs + citations
  let totalVerseRefs = 0;
  let parseErrors = 0;

  const allRefs: Omit<EntityVerseRef, 'id' | 'created_at'>[] = [];
  const citations: { entity_id: string; source_name: string; source_ref: string; source_url: string; content_field: 'general'; excerpt: null }[] = [];

  // Content-preserving upsert:
  //   • INSERT inserts all TIPNR fields (incl. thin @Article as full_profile seed)
  //   • ON CONFLICT only updates TIPNR-owned metadata (tipnr_id, canonical_name,
  //     hebrew_name, greek_name) and seeds content fields ONLY IF they are
  //     currently NULL. Existing generated content is preserved verbatim.
  const upsertStmt = db.prepare(
    `INSERT INTO entities (
       id, entity_type, canonical_name, aliases, quick_glance, summary, full_profile,
       hebrew_name, greek_name, disambiguation_note, date_range, geographic_context,
       source_verified, tipnr_id
     ) VALUES (?, 'person', ?, NULL, ?, ?, ?, ?, ?, NULL, NULL, NULL, 1, ?)
     ON CONFLICT(id) DO UPDATE SET
       canonical_name = excluded.canonical_name,
       hebrew_name    = COALESCE(entities.hebrew_name, excluded.hebrew_name),
       greek_name     = COALESCE(entities.greek_name, excluded.greek_name),
       tipnr_id       = excluded.tipnr_id,
       quick_glance   = COALESCE(entities.quick_glance, excluded.quick_glance),
       summary        = COALESCE(entities.summary, excluded.summary),
       full_profile   = COALESCE(entities.full_profile, excluded.full_profile),
       updated_at     = datetime('now')`
  );

  db.transaction(() => {
    for (const entry of entries) {
      const entityId = toEntityId(entry.unifiedName, entry.strongsKey);

      // Build summary from first paragraph of article
      const firstPara = entry.article
        ? stripHtml(entry.article.split('¶')[0].trim())
        : null;

      // Build full_profile from article with paragraph breaks
      const fullProfile = entry.article
        ? stripHtml(entry.article.replace(/¶/g, '\n\n'))
        : null;

      upsertStmt.run(
        entityId,
        entry.displayName,
        entry.shortDesc || null,
        firstPara || null,
        fullProfile || null,
        entry.hebrewName || null,
        entry.greekName || null,
        entry.tipnrId
      );

      // Parse verse refs — deduplicate within this entity
      const seenRefs = new Set<string>();
      for (const refStr of entry.verseRefs) {
        const parsed = parseVerseRef(refStr);
        if (!parsed) {
          if (refStr.match(/\w+\.\d+\.\d+/)) {
            parseErrors++;
          }
          continue;
        }
        const key = `${parsed.book}:${parsed.chapter}:${parsed.verse_start}`;
        if (seenRefs.has(key)) continue;
        seenRefs.add(key);

        allRefs.push({
          entity_id: entityId,
          book: parsed.book,
          chapter: parsed.chapter,
          verse_start: parsed.verse_start,
          verse_end: parsed.verse_end,
          surface_text: null,
          confidence: 'high',
          source: 'tipnr',
        });
        totalVerseRefs++;
      }

      citations.push({
        entity_id: entityId,
        source_name: 'TIPNR Dataset',
        source_ref: 'Tyndale House Cambridge (AI-generated, scholar-reviewed)',
        source_url: 'https://github.com/STEPBible/STEPBible-Data',
        content_field: 'general',
        excerpt: null,
      });
    }

    // Inline verse ref inserts (avoid nested transaction from insertVerseRefs)
    const refStmt = db.prepare(
      `INSERT OR IGNORE INTO entity_verse_refs (entity_id, book, chapter, verse_start, verse_end, surface_text, confidence, source)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    );
    for (const ref of allRefs) {
      refStmt.run(ref.entity_id, ref.book, ref.chapter, ref.verse_start, ref.verse_end, ref.surface_text ?? null, ref.confidence, ref.source);
    }

    // Inline citation inserts (avoid nested transaction from insertCitations)
    const citStmt = db.prepare(
      `INSERT OR IGNORE INTO entity_citations (entity_id, source_name, source_ref, source_url, content_field, excerpt)
       VALUES (?, ?, ?, ?, ?, ?)`
    );
    for (const c of citations) {
      citStmt.run(c.entity_id, c.source_name, c.source_ref, c.source_url, c.content_field, c.excerpt);
    }

    // Touch updated_at for all affected entities
    const touchStmt = db.prepare("UPDATE entities SET updated_at = datetime('now') WHERE id = ?");
    const uniqueEntityIds = [...new Set(allRefs.map((r) => r.entity_id))];
    for (const id of uniqueEntityIds) touchStmt.run(id);
  })();

  console.log(`Inserted/updated ${entries.length} entities`);
  console.log(`Inserted ${totalVerseRefs} verse refs`);
  if (parseErrors > 0) {
    console.warn(`Parse errors (skipped refs): ${parseErrors}`);
  }

  // 5. Insert relationships. Family refs are stored as "Name@Ref" in the TSV;
  //    resolve them via `entityIdByUnifiedName` to the strongs-suffixed entity id.
  //    Drop any edge whose endpoint isn't in the import set (rare, e.g. refs
  //    to entries that were filtered out because of a missing strongsKey).
  let relCount = 0;
  let unresolvedRefs = 0;

  const tryInsert = (
    fromId: string,
    toRef: string,
    relationship_type: 'child_of' | 'parent_of' | 'spouse_of' | 'sibling_of',
    relationship_label: string,
    bidirectional: 0 | 1
  ) => {
    const toId = entityIdByUnifiedName.get(toRef);
    if (!toId) {
      unresolvedRefs++;
      return;
    }
    insertRelationship({
      from_entity_id: fromId,
      to_entity_id: toId,
      relationship_type,
      relationship_label,
      bidirectional,
      source: 'tipnr',
    });
    relCount++;
  };

  db.transaction(() => {
    for (const entry of entries) {
      const fromId = toEntityId(entry.unifiedName, entry.strongsKey);
      for (const parentRef of entry.parents) tryInsert(fromId, parentRef, 'child_of', 'child of', 0);
      for (const childRef of entry.offspring) tryInsert(fromId, childRef, 'parent_of', 'parent of', 0);
      for (const partnerRef of entry.partners) tryInsert(fromId, partnerRef, 'spouse_of', 'spouse of', 1);
      for (const siblingRef of entry.siblings) tryInsert(fromId, siblingRef, 'sibling_of', 'sibling of', 1);
    }
  })();

  console.log(`Inserted ${relCount} relationships`);
  if (unresolvedRefs > 0) {
    console.warn(`Unresolved family refs (endpoint not in import set): ${unresolvedRefs}`);
  }
  console.log('Import complete.');
}

main().catch(err => {
  console.error('Import failed:', err);
  process.exit(1);
});
