// lib/entities/citation-verifier.ts
// Post-generation citation verification — checks that cited sources
// actually exist in the databases.

import { getDb } from '../db/connection';
import { getVerse, lookupStrongs, normalizeBookName } from '../db/bible/queries';
import type { EntityCitation } from '../db/types';

export interface VerificationResult {
  entityId: string;
  entityName: string;
  totalCitations: number;
  verifiedCitations: number;
  issues: string[];
}

const APPROVED_SOURCES = new Set([
  'BSB',
  'Berean Standard Bible',
  'Josephus, Antiquities of the Jews',
  'Josephus, The Jewish War',
  'Josephus',
  "Easton's Bible Dictionary",
  "Smith's Bible Dictionary",
  "Strong's Concordance",
  'Cross-References',
  'Archaeological',
  'Tel Dan Stele',
  'Sennacherib Prism',
  'Moabite Stone',
  'Dead Sea Scrolls',
  '1 Maccabees',
  '2 Maccabees',
  'Book of Enoch',
  'TIPNR Dataset',
  'TIPNR',
]);

// Match common source name prefixes for flexibility
function isApprovedSource(sourceName: string): boolean {
  if (APPROVED_SOURCES.has(sourceName)) return true;

  const lower = sourceName.toLowerCase();
  // Allow Josephus with any specific reference
  if (lower.startsWith('josephus')) return true;
  // Allow dictionary references
  if (lower.includes("easton's") || lower.includes("smith's")) return true;
  // Allow archaeological sources
  if (lower.startsWith('archaeological') || lower.includes('stele') || lower.includes('inscription')) return true;
  // Allow BSB variants
  if (lower === 'bsb' || lower.includes('berean')) return true;
  // Allow Strong's variants
  if (lower.includes("strong's")) return true;
  // Allow non-canonical historical sources
  if (lower.includes('maccabees') || lower.includes('enoch')) return true;
  // Allow TIPNR dataset (seed data source)
  if (lower.includes('tipnr')) return true;

  return false;
}

/**
 * Parse a verse reference string like "Matthew 2:1-18" or "Genesis 1:1"
 * into components.
 */
function parseVerseRef(ref: string): { book: string; chapter: number; verse: number } | null {
  // Match patterns like "Genesis 1:1", "1 Kings 6:1", "Matthew 2:1-18"
  const match = ref.match(/^(.+?)\s+(\d+):(\d+)/);
  if (!match) return null;
  return {
    book: match[1],
    chapter: parseInt(match[2], 10),
    verse: parseInt(match[3], 10),
  };
}

/**
 * Extract Strong's numbers from citation text (e.g., "H7225", "G3056")
 */
function extractStrongsNumbers(text: string): string[] {
  const matches = text.match(/[HG]\d{1,5}/g);
  return matches ? Array.from(new Set(matches)) : [];
}

/**
 * Verify citations for a single entity.
 */
export function verifyCitations(entityId: string): VerificationResult {
  const db = getDb();
  const entity = db.prepare('SELECT canonical_name FROM entities WHERE id = ?').get(entityId) as
    | { canonical_name: string }
    | undefined;

  const citations = db
    .prepare('SELECT * FROM entity_citations WHERE entity_id = ?')
    .all(entityId) as EntityCitation[];

  const result: VerificationResult = {
    entityId,
    entityName: entity?.canonical_name ?? entityId,
    totalCitations: citations.length,
    verifiedCitations: 0,
    issues: [],
  };

  for (const citation of citations) {
    let verified = true;

    // Check 1: Source name is approved
    if (!isApprovedSource(citation.source_name)) {
      result.issues.push(
        `Unknown source: "${citation.source_name}" (ref: ${citation.source_ref ?? 'none'})`
      );
      verified = false;
    }

    // Check 2: BSB verse references exist in the database
    if (
      citation.source_name === 'BSB' ||
      citation.source_name === 'Berean Standard Bible'
    ) {
      if (citation.source_ref) {
        const parsed = parseVerseRef(citation.source_ref);
        if (parsed) {
          const verse = getVerse(parsed.book, parsed.chapter, parsed.verse);
          if (!verse) {
            result.issues.push(
              `BSB verse not found: ${citation.source_ref}`
            );
            verified = false;
          }
        }
      }
    }

    // Check 3: Strong's numbers in excerpt exist
    if (citation.excerpt) {
      const strongsNums = extractStrongsNumbers(citation.excerpt);
      for (const num of strongsNums) {
        const entry = lookupStrongs(num);
        if (!entry) {
          result.issues.push(
            `Strong's number not found: ${num} (in citation for ${citation.source_ref ?? citation.source_name})`
          );
          verified = false;
        }
      }
    }

    if (verified) {
      result.verifiedCitations++;
    }
  }

  return result;
}

/**
 * Verify citations for all entities that have generated content.
 */
export function verifyAllCitations(): VerificationResult[] {
  const db = getDb();
  const entities = db
    .prepare("SELECT id FROM entities WHERE full_profile IS NOT NULL AND full_profile != ''")
    .all() as { id: string }[];

  return entities.map((e) => verifyCitations(e.id));
}
