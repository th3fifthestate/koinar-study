// lib/entities/name-index.ts
// Regex-based entity name index for fast multi-pattern matching against verse text.
// Builds an in-memory index from all entities (names + aliases), detects ambiguity
// when multiple entities share a surface form, and prefers longest matches.

import type { Entity } from '@/lib/db/types';
import { getDb } from '@/lib/db/connection';

export interface TrieMatch {
  entity_id: string;
  entity_type: string;
  canonical_name: string;
  surface_text: string;      // the actual text matched in the verse
  ambiguous: boolean;        // true if this surface form maps to multiple entities
  candidate_ids: string[];   // all possible entity IDs for ambiguous matches
}

export interface EntityNameIndex {
  /** Find all entity matches in a text string */
  findMatches(text: string): TrieMatch[];
  /** Number of surface forms indexed */
  size: number;
}

interface SurfaceFormEntry {
  entities: { id: string; entity_type: string; canonical_name: string }[];
}

const MIN_NAME_LENGTH = 3;

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Reject matches whose surface text is fully lowercase. Proper nouns in
 * English prose are always capitalized; a lowercase "mark" or "peter" is
 * almost always the verb / common noun rather than the biblical figure.
 * The regex stays case-insensitive so sentence-initial and ALL-CAPS forms
 * still resolve, but fully-lowercase matches are dropped as false positives.
 */
function hasProperCase(surfaceText: string): boolean {
  return surfaceText !== surfaceText.toLowerCase();
}

export function buildEntityNameIndex(): EntityNameIndex {
  const db = getDb();
  const allEntities = db.prepare('SELECT * FROM entities').all() as Entity[];

  // Map: lowercase surface form → all entities that use it
  const surfaceForms = new Map<string, SurfaceFormEntry>();

  for (const entity of allEntities) {
    const names: string[] = [entity.canonical_name];
    if (entity.aliases) {
      try {
        const parsed = JSON.parse(entity.aliases) as string[];
        names.push(...parsed);
      } catch {
        /* skip malformed */
      }
    }

    for (const name of names) {
      if (!name || name.length < MIN_NAME_LENGTH) continue;
      const key = name.toLowerCase();
      const entry = surfaceForms.get(key) ?? { entities: [] };
      // Avoid duplicates if entity appears via both canonical_name and alias
      if (!entry.entities.some((e) => e.id === entity.id)) {
        entry.entities.push({
          id: entity.id,
          entity_type: entity.entity_type,
          canonical_name: entity.canonical_name,
        });
      }
      surfaceForms.set(key, entry);
    }
  }

  // Build regex — sort longest first so "Herod the Great" matches before "Herod"
  const sortedKeys = [...surfaceForms.keys()].sort((a, b) => b.length - a.length);
  const pattern = sortedKeys.map(escapeRegex).join('|');
  // Empty pattern edge case (no entities)
  const regex = pattern ? new RegExp(`\\b(${pattern})\\b`, 'gi') : null;

  return {
    findMatches(text: string): TrieMatch[] {
      if (!regex) return [];
      const matches: TrieMatch[] = [];
      // Track matched character ranges to skip overlaps (longest-match-first)
      const coveredRanges: [number, number][] = [];

      // Clone regex to reset lastIndex
      const rx = new RegExp(regex.source, regex.flags);

      for (const match of text.matchAll(rx)) {
        const start = match.index!;
        const end = start + match[0].length;

        // Skip fully-lowercase matches (likely the English word, not the name).
        if (!hasProperCase(match[0])) continue;

        // Skip if this range overlaps with an already-matched longer range
        if (coveredRanges.some(([s, e]) => start < e && end > s)) continue;
        coveredRanges.push([start, end]);

        const key = match[0].toLowerCase();
        const entry = surfaceForms.get(key);
        if (!entry) continue;

        const isAmbiguous = entry.entities.length > 1;
        const primary = entry.entities[0];

        matches.push({
          entity_id: primary.id,
          entity_type: primary.entity_type,
          canonical_name: primary.canonical_name,
          surface_text: match[0],
          ambiguous: isAmbiguous,
          candidate_ids: entry.entities.map((e) => e.id),
        });
      }

      return matches;
    },

    get size() {
      return surfaceForms.size;
    },
  };
}
