#!/usr/bin/env tsx
/**
 * TIPNR Import Script — Koinar Bible Study App
 * Imports top-100 most-referenced biblical people from the STEPBible TIPNR dataset.
 * Source: Tyndale House Cambridge, CC BY 4.0
 * Run from app/ directory: npx tsx scripts/import-tipnr.ts
 */

import fs from 'fs';
import path from 'path';
import { getDb } from '../lib/db/connection';
import {
  upsertEntity,
  insertRelationship,
} from '../lib/db/entities/queries';
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

function toEntityId(unifiedName: string): string {
  // Extract name before @ sign
  const namePart = unifiedName.split('@')[0];
  // Split camelCase: insert _ before uppercase letter preceded by lowercase
  const split = namePart.replace(/([a-z])([A-Z])/g, '$1_$2');
  // Replace . and spaces with _, uppercase
  return split.replace(/[.\s]+/g, '_').toUpperCase();
}

function stripFamilyRef(nameWithRef: string): string {
  return nameWithRef.split('@')[0].trim();
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
  // Handle "Name@ref + Name@ref" (parents) and "Name@ref, Name@ref" (others)
  return raw
    .split(/[,+]/)
    .map(s => stripFamilyRef(s.trim()))
    .filter(s => s.length > 0 && s !== '>');
}

// ==============================
// Types
// ==============================

type PersonEntry = {
  unifiedName: string;    // full "Aaron@Exo.4.14-Heb=H0175" string (before =)
  displayName: string;    // name before "@"
  description: string;
  parents: string[];
  siblings: string[];
  partners: string[];
  offspring: string[];
  hebrewName: string;     // extracted from – Named row after "="
  greekName: string;      // extracted from – Greek row after "="
  tipnrId: string;        // full UnifiedName@Ref=uStrong string
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
        // UnifiedName is the part before "=" in col0
        const eqIdx = col0.indexOf('=');
        current.unifiedName = eqIdx !== -1 ? col0.slice(0, eqIdx) : col0;
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
  const filePath = path.join(__dirname, '../data/tipnr/tipnr-names.tsv');

  console.log(`Parsing TIPNR file: ${filePath}`);

  // 1. Parse all person entries
  const allEntries = parseFile(filePath);
  console.log(`Total persons parsed from file: ${allEntries.length}`);

  // 2. Sort by verseCount descending, take top 100
  const sorted = [...allEntries].sort((a, b) => b.verseCount - a.verseCount);
  const top100 = sorted.slice(0, 100);

  console.log(`Top 100 selected. #1: ${top100[0]?.displayName} (${top100[0]?.verseCount} refs), #100: ${top100[99]?.displayName} (${top100[99]?.verseCount} refs)`);

  const top100Ids = new Set(top100.map(e => toEntityId(e.unifiedName)));

  // 3. Initialize DB (creates tables if needed)
  const db = getDb();

  // 4. Insert all 100 entities + verse refs + citations
  let totalVerseRefs = 0;
  let parseErrors = 0;

  const allRefs: Omit<EntityVerseRef, 'id' | 'created_at'>[] = [];
  const citations: { entity_id: string; source_name: string; source_ref: string; source_url: string; content_field: 'general'; excerpt: null }[] = [];

  db.transaction(() => {
    for (const entry of top100) {
      const entityId = toEntityId(entry.unifiedName);

      // Build summary from first paragraph of article
      const firstPara = entry.article
        ? stripHtml(entry.article.split('¶')[0].trim())
        : null;

      // Build full_profile from article with paragraph breaks
      const fullProfile = entry.article
        ? stripHtml(entry.article.replace(/¶/g, '\n\n'))
        : null;

      upsertEntity({
        id: entityId,
        entity_type: 'person',
        canonical_name: entry.displayName,
        aliases: null,
        quick_glance: entry.shortDesc || null,
        summary: firstPara || null,
        full_profile: fullProfile || null,
        hebrew_name: entry.hebrewName || null,
        greek_name: entry.greekName || null,
        disambiguation_note: null,
        date_range: null,
        geographic_context: null,
        source_verified: 1,
        tipnr_id: entry.tipnrId,
      });

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

  console.log(`Inserted/updated 100 entities`);
  console.log(`Inserted ${totalVerseRefs} verse refs`);
  if (parseErrors > 0) {
    console.warn(`Parse errors (skipped refs): ${parseErrors}`);
  }

  // 5. Insert relationships (only where both IDs exist in top 100)
  let relCount = 0;

  db.transaction(() => {
  for (const entry of top100) {
    const fromId = toEntityId(entry.unifiedName);

    // Parents: this person is a child_of each parent
    for (const parentName of entry.parents) {
      const toId = toEntityId(parentName);
      if (top100Ids.has(toId)) {
        insertRelationship({
          from_entity_id: fromId,
          to_entity_id: toId,
          relationship_type: 'child_of',
          relationship_label: 'child of',
          bidirectional: 0,
          source: 'tipnr',
        });
        relCount++;
      }
    }

    // Offspring: this person is a parent_of each child
    for (const childName of entry.offspring) {
      const toId = toEntityId(childName);
      if (top100Ids.has(toId)) {
        insertRelationship({
          from_entity_id: fromId,
          to_entity_id: toId,
          relationship_type: 'parent_of',
          relationship_label: 'parent of',
          bidirectional: 0,
          source: 'tipnr',
        });
        relCount++;
      }
    }

    // Partners: spouse_of (bidirectional)
    for (const partnerName of entry.partners) {
      const toId = toEntityId(partnerName);
      if (top100Ids.has(toId)) {
        insertRelationship({
          from_entity_id: fromId,
          to_entity_id: toId,
          relationship_type: 'spouse_of',
          relationship_label: 'spouse of',
          bidirectional: 1,
          source: 'tipnr',
        });
        relCount++;
      }
    }

    // Siblings: sibling_of (bidirectional)
    for (const siblingName of entry.siblings) {
      const toId = toEntityId(siblingName);
      if (top100Ids.has(toId)) {
        insertRelationship({
          from_entity_id: fromId,
          to_entity_id: toId,
          relationship_type: 'sibling_of',
          relationship_label: 'sibling of',
          bidirectional: 1,
          source: 'tipnr',
        });
        relCount++;
      }
    }
  }
  })();

  console.log(`Inserted ${relCount} relationships`);
  console.log('Import complete.');
}

main().catch(err => {
  console.error('Import failed:', err);
  process.exit(1);
});
