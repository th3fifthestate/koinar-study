// app/lib/entities/annotator.ts

import crypto from 'crypto';
import type { Entity, StudyEntityAnnotation } from '@/lib/db/types';
import { getDb } from '@/lib/db/connection';
import {
  getAnnotationsForStudy,
  insertStudyAnnotations,
  deleteAnnotationsForStudy,
} from '@/lib/db/entities/queries';

// ─── Disambiguation Config ────────────────────────────────────────────────────

interface AmbigConfig {
  /** Preferred entity IDs in priority order (index 0 = default when no context) */
  candidates: string[];
  /** Keywords that favour a specific entity ID when found within 200 chars */
  contextKeywords: Record<string, string[]>;
}

const AMBIGUOUS_NAMES: Record<string, AmbigConfig> = {
  herod: {
    candidates: ['HEROD_GREAT', 'HEROD_ANTIPAS', 'HEROD_AGRIPPA_I', 'HEROD_AGRIPPA_II'],
    contextKeywords: {
      HEROD_GREAT: ['birth', 'magi', 'bethlehem', 'massacre', 'wise men', 'slaughter', 'infant'],
      HEROD_ANTIPAS: ['galilee', 'herodias', 'salome', 'tetrarch', 'beheaded', 'john the baptist'],
      HEROD_AGRIPPA_I: ['james', 'peter', 'acts 12', 'worm', 'agrippa'],
    },
  },
  james: {
    candidates: ['JAMES_SON_OF_ZEBEDEE', 'JAMES_BROTHER_OF_JESUS', 'JAMES_SON_OF_ALPHAEUS'],
    contextKeywords: {
      JAMES_SON_OF_ZEBEDEE: ['zebedee', 'john', 'boanerges', 'thunder', 'fishermen', 'transfiguration'],
      JAMES_BROTHER_OF_JESUS: ['lord', 'brother', 'epistle', 'jerusalem', 'pillar', 'half-brother'],
      JAMES_SON_OF_ALPHAEUS: ['alphaeus', 'lesser', 'little'],
    },
  },
  simon: {
    candidates: ['SIMON_PETER', 'SIMON_OF_CYRENE', 'SIMON_THE_ZEALOT', 'SIMON_THE_PHARISEE'],
    contextKeywords: {
      SIMON_PETER: ['peter', 'rock', 'cephas', 'fish', 'galilee', 'keys'],
      SIMON_OF_CYRENE: ['cyrene', 'cross', 'carried'],
      SIMON_THE_ZEALOT: ['zealot', 'zealots', 'cananaean'],
      SIMON_THE_PHARISEE: ['pharisee', 'anointed', 'woman'],
    },
  },
  peter: {
    candidates: ['SIMON_PETER'],
    contextKeywords: {},
  },
  mary: {
    candidates: ['MARY_MOTHER_OF_JESUS', 'MARY_MAGDALENE', 'MARY_OF_BETHANY', 'MARY_MOTHER_OF_JAMES'],
    contextKeywords: {
      MARY_MOTHER_OF_JESUS: ['virgin', 'joseph', 'birth', 'nazareth', 'magnificat', 'annunciation'],
      MARY_MAGDALENE: ['magdalene', 'seven demons', 'resurrection', 'garden', 'tomb', 'first'],
      MARY_OF_BETHANY: ['bethany', 'lazarus', 'martha', 'feet', 'ointment', 'perfume'],
    },
  },
  john: {
    candidates: ['JOHN_THE_APOSTLE', 'JOHN_THE_BAPTIST', 'JOHN_MARK'],
    contextKeywords: {
      JOHN_THE_APOSTLE: ['zebedee', 'beloved', 'disciple', 'revelation', 'ephesus', 'thunder'],
      JOHN_THE_BAPTIST: ['baptist', 'baptize', 'jordan', 'wilderness', 'elijah', 'locust'],
      JOHN_MARK: ['mark', 'barnabas', 'cyprus', 'acts', 'pamphylia'],
    },
  },
};

// ─── Entity Cache ─────────────────────────────────────────────────────────────

interface EntityCache {
  /** Normalized name (lowercase) → all entities with that name or alias */
  nameToEntities: Map<string, Entity[]>;
  /** Case-insensitive regex for all names, longest patterns first */
  regex: RegExp;
  /** max(updated_at) from entities table at time of cache build */
  maxUpdatedAt: string;
}

let _cache: EntityCache | null = null;

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function buildCache(): EntityCache {
  const db = getDb();
  const entities = db.prepare('SELECT * FROM entities').all() as Entity[];
  const row = db
    .prepare('SELECT MAX(updated_at) AS max_updated_at FROM entities')
    .get() as { max_updated_at: string | null };
  const maxUpdatedAt = row.max_updated_at ?? '';

  const nameToEntities = new Map<string, Entity[]>();

  for (const entity of entities) {
    const names: string[] = [entity.canonical_name];
    if (entity.aliases) {
      try {
        names.push(...(JSON.parse(entity.aliases) as string[]));
      } catch { /* skip malformed aliases */ }
    }
    for (const name of names) {
      if (!name || name.length < 3) continue; // skip very short names
      const key = name.toLowerCase();
      const existing = nameToEntities.get(key) ?? [];
      existing.push(entity);
      nameToEntities.set(key, existing);
    }
  }

  // Sort longest names first so "Herod the Great" matches before "Herod"
  const sortedNames = [...nameToEntities.keys()].sort((a, b) => b.length - a.length);
  const escaped = sortedNames.map(escapeRegex);
  const regex = new RegExp(`\\b(${escaped.join('|')})\\b`, 'gi');

  return { nameToEntities, regex, maxUpdatedAt };
}

function getEntityCache(): EntityCache {
  if (_cache) {
    // One lightweight staleness check per call
    const db = getDb();
    const row = db
      .prepare('SELECT MAX(updated_at) AS max_updated_at FROM entities')
      .get() as { max_updated_at: string | null };
    if ((row.max_updated_at ?? '') === _cache.maxUpdatedAt) return _cache;
  }
  _cache = buildCache();
  return _cache;
}

// ─── Excluded Range Helpers ───────────────────────────────────────────────────

type Range = [number, number];

function getExcludedRanges(text: string): Range[] {
  const ranges: Range[] = [];

  // Code fences: ``` ... ```
  for (const match of text.matchAll(/```[\s\S]*?```/g)) {
    ranges.push([match.index!, match.index! + match[0].length]);
  }

  // Blockquote lines: lines starting with ">"
  let offset = 0;
  for (const line of text.split('\n')) {
    if (line.startsWith('>')) {
      ranges.push([offset, offset + line.length]);
    }
    offset += line.length + 1; // +1 for the newline character
  }

  return ranges;
}

function inExcludedRange(position: number, ranges: Range[]): boolean {
  for (const [start, end] of ranges) {
    if (position >= start && position < end) return true;
  }
  return false;
}

// ─── Disambiguation ───────────────────────────────────────────────────────────

function disambiguate(
  normalizedName: string,
  candidates: Entity[],
  text: string,
  matchOffset: number
): Entity | null {
  if (candidates.length === 1) return candidates[0];

  const config = AMBIGUOUS_NAMES[normalizedName];
  if (!config) return candidates[0]; // unknown ambiguous name — return first

  // Check 200-char window around the match for context keywords
  const ctxStart = Math.max(0, matchOffset - 200);
  const ctxEnd = Math.min(text.length, matchOffset + 200);
  const context = text.slice(ctxStart, ctxEnd).toLowerCase();

  let bestId: string | null = null;
  let bestScore = 0;

  for (const [entityId, keywords] of Object.entries(config.contextKeywords)) {
    const score = keywords.filter((kw) => context.includes(kw)).length;
    if (score > bestScore) {
      bestScore = score;
      bestId = entityId;
    }
  }

  if (bestId) {
    const found = candidates.find((e) => e.id === bestId);
    if (found) return found;
  }

  // Default: first candidate in the priority list
  return candidates.find((e) => e.id === config.candidates[0]) ?? candidates[0];
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Generates entity annotations for a study by matching known entity names
 * against the study text. Only runs if the study has zero annotations or
 * the content hash has changed. Results are persisted to study_entity_annotations.
 */
export async function annotateStudyIfNeeded(
  studyId: number,
  contentMarkdown: string
): Promise<StudyEntityAnnotation[]> {
  const contentHash = crypto.createHash('sha256').update(contentMarkdown).digest('hex');

  // 1. Check existing annotations
  const existing = getAnnotationsForStudy(studyId);
  if (existing.length > 0) {
    if (existing[0].content_hash === contentHash) return existing; // cache hit
    // Hash mismatch — content changed, re-annotate
    deleteAnnotationsForStudy(studyId);
  }

  // 2. Load entity cache (auto-rebuilds when entities are updated)
  const { nameToEntities, regex } = getEntityCache();

  // 3. Build excluded ranges (code blocks + blockquote lines)
  const excludedRanges = getExcludedRanges(contentMarkdown);

  // 4. Match entity names — first mention only, skip excluded ranges
  const toInsert: Omit<StudyEntityAnnotation, 'id' | 'created_at'>[] = [];
  const seenEntityIds = new Set<string>();

  // Clone regex so matchAll state is independent across calls
  const rx = new RegExp(regex.source, regex.flags);

  for (const match of contentMarkdown.matchAll(rx)) {
    const matchedText = match[0];
    const normalizedName = matchedText.toLowerCase();
    const startOffset = match.index!;
    const endOffset = startOffset + matchedText.length;

    if (inExcludedRange(startOffset, excludedRanges)) continue;

    const candidates = nameToEntities.get(normalizedName);
    if (!candidates || candidates.length === 0) continue;

    const entity = disambiguate(normalizedName, candidates, contentMarkdown, startOffset);
    if (!entity) continue;

    if (seenEntityIds.has(entity.id)) continue;
    seenEntityIds.add(entity.id);

    toInsert.push({
      study_id: studyId,
      entity_id: entity.id,
      surface_text: matchedText,
      start_offset: startOffset,
      end_offset: endOffset,
      content_hash: contentHash,
      annotation_source: 'render_fallback',
    });
  }

  // 5. Persist and return
  if (toInsert.length > 0) {
    insertStudyAnnotations(toInsert);
  }

  return getAnnotationsForStudy(studyId);
}
