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

// Entity IDs use Strong's-suffixed format: NAME_STRONGS (e.g. HEROD_G2264G).
// When multiple entities share a canonical name, we use context keywords within
// a 200-char window to pick the most likely individual.
const AMBIGUOUS_NAMES: Record<string, AmbigConfig> = {
  herod: {
    candidates: ['HEROD_G2264G', 'HEROD_G2264H', 'HEROD_G2264I'],
    contextKeywords: {
      HEROD_G2264G: ['birth', 'magi', 'bethlehem', 'massacre', 'wise men', 'slaughter', 'infant', 'great'],
      HEROD_G2264H: ['galilee', 'herodias', 'salome', 'tetrarch', 'beheaded', 'john the baptist', 'antipas'],
      HEROD_G2264I: ['james', 'peter', 'acts 12', 'worm', 'agrippa'],
    },
  },
  james: {
    candidates: ['JAMES_G2385G', 'JAMES_G2385I', 'JAMES_G2385H', 'JAMES_G2385J'],
    contextKeywords: {
      JAMES_G2385G: ['zebedee', 'john', 'boanerges', 'thunder', 'fishermen', 'transfiguration', 'martyred'],
      JAMES_G2385I: ['lord', 'brother', 'epistle', 'jerusalem', 'pillar', 'half-brother', 'jude'],
      JAMES_G2385H: ['alphaeus', 'lesser', 'little', 'the less'],
      JAMES_G2385J: ['father', 'judas', 'not iscariot'],
    },
  },
  simon: {
    candidates: ['PETER_G4074G', 'SIMON_G4613J', 'SIMON_G4613G', 'SIMON_G4613I', 'SIMON_G4613M'],
    contextKeywords: {
      PETER_G4074G: ['peter', 'rock', 'cephas', 'fish', 'galilee', 'keys'],
      SIMON_G4613J: ['cyrene', 'cross', 'carried', 'rufus', 'alexander'],
      SIMON_G4613G: ['zealot', 'zealots', 'cananaean'],
      SIMON_G4613I: ['leper', 'pharisee', 'anointed', 'woman', 'alabaster'],
      SIMON_G4613M: ['sorcerer', 'magic', 'samaria', 'simony'],
    },
  },
  peter: {
    candidates: ['PETER_G4074G'],
    contextKeywords: {},
  },
  mary: {
    candidates: ['MARY_G3137G', 'MARY_MAGDALENE_G3137I', 'MARY_G3137J', 'MARY_G3137K'],
    contextKeywords: {
      MARY_G3137G: ['virgin', 'joseph', 'birth', 'nazareth', 'magnificat', 'annunciation', 'mother of jesus'],
      MARY_MAGDALENE_G3137I: ['magdalene', 'seven demons', 'resurrection', 'garden', 'tomb', 'magdala'],
      MARY_G3137J: ['bethany', 'lazarus', 'martha', 'feet', 'ointment', 'perfume'],
      MARY_G3137K: ['clopas', 'alphaeus', 'mother of james', 'mother of joses'],
    },
  },
  // "mary magdalene" as a distinct key so the two-word name gets direct lookup
  'mary magdalene': {
    candidates: ['MARY_MAGDALENE_G3137I'],
    contextKeywords: {},
  },
  john: {
    candidates: ['JOHN_G2491H', 'JOHN_G2491G', 'MARK_G3138'],
    contextKeywords: {
      JOHN_G2491H: ['zebedee', 'beloved', 'disciple', 'revelation', 'ephesus', 'thunder', 'apostle'],
      JOHN_G2491G: ['baptist', 'baptize', 'jordan', 'wilderness', 'elijah', 'locust'],
      MARK_G3138: ['mark', 'barnabas', 'cyprus', 'acts', 'pamphylia'],
    },
  },
  joseph: {
    candidates: ['JOSEPH_H3130G', 'JOSEPH_G2501G', 'JOSEPH_G2501I'],
    contextKeywords: {
      JOSEPH_H3130G: ['egypt', 'pharaoh', 'dreamer', 'coat', 'potiphar', 'genesis', 'patriarch'],
      JOSEPH_G2501G: ['mary', 'nazareth', 'bethlehem', 'carpenter', 'husband', 'dream', 'angel'],
      JOSEPH_G2501I: ['arimathea', 'tomb', 'burial', 'body', 'pilate', 'linen'],
    },
  },
  judas: {
    candidates: ['JUDAS_G2455H', 'JUDE_G2455I', 'JUDAS_G2455G', 'JUDAS_G2455M'],
    contextKeywords: {
      JUDAS_G2455H: ['iscariot', 'betray', 'silver', 'thirty', 'field', 'kiss'],
      JUDE_G2455I: ['brother', 'epistle', 'james', 'jude'],
      JUDAS_G2455G: ['thaddaeus', 'lebbaeus', 'not iscariot'],
      JUDAS_G2455M: ['barsabbas', 'silas', 'antioch', 'prophets'],
    },
  },
  lazarus: {
    candidates: ['LAZARUS_G2976H', 'LAZARUS_G2976G'],
    contextKeywords: {
      LAZARUS_G2976H: ['bethany', 'martha', 'mary', 'raised', 'tomb', 'four days', 'dead'],
      LAZARUS_G2976G: ['rich man', 'bosom', 'abraham', 'parable', 'purple', 'crumbs'],
    },
  },
  saul: {
    candidates: ['PAUL_G3972G', 'SAUL_H7586G'],
    contextKeywords: {
      PAUL_G3972G: ['tarsus', 'damascus', 'barnabas', 'gentiles', 'apostle', 'ananias', 'antioch', 'conversion', 'persecuted', 'church', 'christians', 'acts'],
      SAUL_H7586G: ['king', 'david', 'jonathan', 'samuel', 'gilboa', 'philistines', 'israel', 'benjamin', 'anointed', 'spear', 'witch', 'endor'],
    },
  },
  // "saul of tarsus" as a distinct key for direct lookup
  'saul of tarsus': {
    candidates: ['PAUL_G3972G'],
    contextKeywords: {},
  },
};

// ─── Entity Cache ─────────────────────────────────────────────────────────────

interface EntityCache {
  /** Normalized name (lowercase) → all entities with that name or alias */
  nameToEntities: Map<string, Entity[]>;
  /** Case-insensitive regex for all names, longest patterns first. ALWAYS clone before use:
   *  `new RegExp(regex.source, regex.flags)` — the g flag makes lastIndex stateful. */
  regex: RegExp;
  /** max(updated_at) from entities table at time of cache build */
  maxUpdatedAt: string;
}

let _cache: EntityCache | null = null;
let _lastCacheCheckAt = 0;
const CACHE_CHECK_INTERVAL_MS = 60_000;

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

  // Warn if any AMBIGUOUS_NAMES candidate IDs are absent from the loaded entity set
  const entityIds = new Set(entities.map((e) => e.id));
  for (const [name, config] of Object.entries(AMBIGUOUS_NAMES)) {
    for (const candidateId of config.candidates) {
      if (!entityIds.has(candidateId)) {
        console.warn(`[annotator] AMBIGUOUS_NAMES candidate "${candidateId}" (for "${name}") not found in entities table`);
      }
    }
  }

  return { nameToEntities, regex, maxUpdatedAt };
}

function getEntityCache(): EntityCache {
  const now = Date.now();
  if (_cache && now - _lastCacheCheckAt < CACHE_CHECK_INTERVAL_MS) {
    return _cache;
  }
  if (_cache) {
    // Throttled staleness check — runs at most once per 60s
    const db = getDb();
    const row = db
      .prepare('SELECT MAX(updated_at) AS max_updated_at FROM entities')
      .get() as { max_updated_at: string | null };
    _lastCacheCheckAt = now;
    if ((row.max_updated_at ?? '') === _cache.maxUpdatedAt) return _cache;
  }
  _cache = buildCache();
  _lastCacheCheckAt = now;
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

/**
 * Reject any match whose surface text is fully lowercase. Proper nouns in
 * running English prose are always capitalized — a lowercase "mark" in
 * "mark my words" is the verb, not the evangelist; a lowercase "peter" in
 * "peter out" is the verb, not the apostle. The regex is case-insensitive
 * so we can match sentence-initial "Mark" and ALL-CAPS headings, but we
 * reject the lowercase forms that almost always resolve to a common English
 * word rather than the biblical figure.
 */
function hasProperCase(surfaceText: string): boolean {
  return surfaceText !== surfaceText.toLowerCase();
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
  // Normalize CRLF → LF so blockquote offset accounting is consistent
  const text = contentMarkdown.replace(/\r\n/g, '\n');
  const contentHash = crypto.createHash('sha256').update(text).digest('hex');

  // 1. Check existing annotations
  const existing = getAnnotationsForStudy(studyId);
  if (existing.length > 0) {
    // AI-generated annotations take priority — don't overwrite with render fallback
    const hasAiAnnotations = existing.some((a) => a.annotation_source === 'ai_generation');
    // Cache hit if any annotation matches the current content hash (skip nulls)
    const hashMatches = existing.some((a) => a.content_hash != null && a.content_hash === contentHash);
    if (hashMatches || hasAiAnnotations) return existing;
    // Hash mismatch on render-fallback annotations — content changed, re-annotate
    deleteAnnotationsForStudy(studyId);
  }

  // 2. Load entity cache (auto-rebuilds when entities are updated)
  const { nameToEntities, regex } = getEntityCache();

  // 3. Build excluded ranges (code blocks + blockquote lines)
  const excludedRanges = getExcludedRanges(text);

  // 4. Match entity names — first mention only, skip excluded ranges
  const toInsert: Omit<StudyEntityAnnotation, 'id' | 'created_at'>[] = [];
  const seenEntityIds = new Set<string>();

  // Clone regex so matchAll state is independent across calls
  const rx = new RegExp(regex.source, regex.flags);

  for (const match of text.matchAll(rx)) {
    const matchedText = match[0];
    const normalizedName = matchedText.toLowerCase();
    const startOffset = match.index!;
    const endOffset = startOffset + matchedText.length;

    if (inExcludedRange(startOffset, excludedRanges)) continue;

    // Fully-lowercase surface text almost always means the English word,
    // not the proper name ("mark my words" ≠ the evangelist Mark).
    if (!hasProperCase(matchedText)) continue;

    const candidates = nameToEntities.get(normalizedName);
    if (!candidates || candidates.length === 0) continue;

    const entity = disambiguate(normalizedName, candidates, text, startOffset);
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
