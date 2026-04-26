// app/lib/entities/annotator.ts

import crypto from 'crypto';
import type { Entity, StudyEntityAnnotation } from '@/lib/db/types';
import { getDb } from '@/lib/db/connection';
import {
  getAnnotationsForStudy,
  insertStudyAnnotations,
  deleteAnnotationsForStudy,
} from '@/lib/db/entities/queries';
import { getIdiomRanges } from './idiom-phrases';

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
//
// The keys of this map are the canonical-form lowercase surfaces with multiple
// possible referents. The reader-side EntityLayerProvider filters annotations
// whose surface matches one of these keys — see ambiguous-names.ts for the
// renderer's reuse of this list.
export const AMBIGUOUS_NAMES: Record<string, AmbigConfig> = {
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
  // ── OT/NT clusters with very high homograph counts ────────────────────────
  // Default to the most-likely-to-appear-in-a-study candidate; context
  // keywords pin the secondary figure when their distinguishing terms appear
  // in the surrounding 200-char window.
  zechariah: {
    // Default: post-exilic prophet (book of Zechariah). Famous secondary
    // figures: NT priest father of John the Baptist; king of Israel; the
    // Zechariah son of Jehoiada stoned in 2 Chronicles 24.
    candidates: [
      'ZECHARIAH_H2148v',  // post-exilic prophet — book of Zechariah
      'ZECHARIAH_G2197H',  // priest, father of John the Baptist (Luke 1)
      'ZECHARIAH_H2148P',  // king of Israel, son of Jeroboam II
      'ZECHARIAH_H2148w',  // son of Jehoiada — stoned, 2 Chr 24
    ],
    contextKeywords: {
      ZECHARIAH_H2148v: ['haggai', 'darius', 'temple', 'rebuild', 'post-exilic', 'returnees', 'visions', 'branch', 'book of zechariah'],
      ZECHARIAH_G2197H: ['elizabeth', 'gabriel', 'priest', 'temple incense', 'mute', 'john the baptist', 'luke 1', 'abijah'],
      ZECHARIAH_H2148P: ['jeroboam', 'shallum', 'king of israel', 'six months', '2 kings 14', 'jehu'],
      ZECHARIAH_H2148w: ['jehoiada', 'joash', 'stoned', 'temple court', 'between the temple and the altar', '2 chronicles 24'],
    },
  },
  jonathan: {
    // Default: son of Saul (David's friend). The other Jonathans are obscure.
    candidates: ['JONATHAN_H3083H'],
    contextKeywords: {
      JONATHAN_H3083H: ['saul', 'david', 'philistines', 'gilboa', 'mephibosheth', 'ahinoam', 'covenant', 'arrows', 'jashobeam'],
    },
  },
  michael: {
    // Default: archangel (Daniel 10/12, Jude 9, Rev 12). All other Michaels
    // are genealogical Hebrew rows that rarely surface in study text.
    candidates: ['MICHAEL_H4317Q'],
    contextKeywords: {
      MICHAEL_H4317Q: ['archangel', 'daniel', 'gabriel', 'prince', 'angelic', 'devil', 'body of moses', 'jude 1', 'revelation 12', 'dragon'],
    },
  },
  joel: {
    // Default: prophet of the book of Joel (son of Pethuel).
    candidates: ['JOEL_H3100T'],
    contextKeywords: {
      JOEL_H3100T: ['pethuel', 'locusts', 'day of the lord', 'pour out my spirit', 'pentecost', 'book of joel', 'prophet'],
    },
  },
  obadiah: {
    // Default: prophet of the book of Obadiah (vision against Edom).
    // Secondary: Ahab's steward who hid 100 prophets in the cave.
    candidates: ['OBADIAH_H5662R', 'OBADIAH_H5662G'],
    contextKeywords: {
      OBADIAH_H5662R: ['edom', 'esau', 'vision', 'mount zion', 'book of obadiah', 'minor prophet'],
      OBADIAH_H5662G: ['ahab', 'jezebel', 'elijah', 'cave', 'hundred prophets', 'household', 'steward', '1 kings 18'],
    },
  },
  zadok: {
    // Default: David's chief priest (line continues through Solomon).
    // Secondary: NT-genealogy Zadok in Matthew 1.
    candidates: ['ZADOK_H6659G', 'ZADOK_G4524'],
    contextKeywords: {
      ZADOK_H6659G: ['ahitub', 'abiathar', 'david', 'solomon', 'high priest', 'ark', 'anoint', 'absalom', 'adonijah'],
      ZADOK_G4524: ['matthew 1', 'genealogy of jesus', 'azor', 'achim'],
    },
  },
  daniel: {
    // Default: Daniel of the book of Daniel (lions' den, exile).
    // Secondary: priest of Ithamar's line in 1 Chr 3 / Ezra 8.
    candidates: ['DANIEL_H1840G', 'DANIEL_H1841G'],
    contextKeywords: {
      DANIEL_H1840G: ['nebuchadnezzar', 'belteshazzar', 'lions', 'den', 'babylon', 'darius', 'shadrach', 'meshach', 'abednego', 'visions', 'seventy weeks', 'book of daniel', 'exile'],
      DANIEL_H1841G: ['ithamar', 'ezra 8', 'priest', '1 chronicles 3'],
    },
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
 * Reject any match whose surface text is fully lowercase, but ONLY when at
 * least one candidate is a `person` entity. The lowercase filter is
 * specifically for the proper-noun-homograph problem — "mark my words" is
 * the verb, not the evangelist; "peter out" is the verb, not the apostle.
 *
 * For non-person entities, lowercase surface is legitimate:
 *   - concepts ("grace", "covenant", "righteousness") routinely appear
 *     lowercase in study prose and surfacing them is desired,
 *   - place transliterations ("petra" the Greek for "rock") and theological
 *     compounds ("kinsman-redeemer") are not English-word homographs.
 *
 * Custom and culture/time_period entities are also exempt because their
 * canonical forms are usually multi-word phrases that don't collide with
 * everyday English words.
 */
function hasProperCase(surfaceText: string, candidates: Entity[]): boolean {
  if (surfaceText !== surfaceText.toLowerCase()) return true;
  // Lowercase surface — reject only if any candidate is a person entity.
  return !candidates.some(c => c.entity_type === 'person');
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
 * Pure helper: runs the matching pipeline against `contentMarkdown` and
 * returns the proposed annotation rows without touching the DB. Used by
 * `annotateStudyIfNeeded` (persistence path) AND by `scripts/rescan-
 * annotations.ts` (dry-run diff path) so both call sites share one code
 * path. The entity cache is still loaded here — that's a read, not a
 * write — so this remains side-effect-free with respect to study data.
 */
export function computeAnnotationsForContent(
  studyId: number,
  contentMarkdown: string
): { annotations: Omit<StudyEntityAnnotation, 'id' | 'created_at'>[]; contentHash: string } {
  const text = contentMarkdown.replace(/\r\n/g, '\n');
  const contentHash = crypto.createHash('sha256').update(text).digest('hex');

  const { nameToEntities, regex } = getEntityCache();

  const excludedRanges = [
    ...getExcludedRanges(text),
    ...getIdiomRanges(text),
  ];

  const annotations: Omit<StudyEntityAnnotation, 'id' | 'created_at'>[] = [];
  const seenEntityIds = new Set<string>();

  // Clone regex so matchAll state is independent across calls
  const rx = new RegExp(regex.source, regex.flags);

  for (const match of text.matchAll(rx)) {
    const matchedText = match[0];
    const normalizedName = matchedText.toLowerCase();
    const startOffset = match.index!;
    const endOffset = startOffset + matchedText.length;

    if (inExcludedRange(startOffset, excludedRanges)) continue;

    const candidates = nameToEntities.get(normalizedName);
    if (!candidates || candidates.length === 0) continue;

    // Lowercase surface is OK only for all-concept candidates.
    if (!hasProperCase(matchedText, candidates)) continue;

    const entity = disambiguate(normalizedName, candidates, text, startOffset);
    if (!entity) continue;

    if (seenEntityIds.has(entity.id)) continue;
    seenEntityIds.add(entity.id);

    annotations.push({
      study_id: studyId,
      entity_id: entity.id,
      surface_text: matchedText,
      start_offset: startOffset,
      end_offset: endOffset,
      content_hash: contentHash,
      annotation_source: 'render_fallback',
    });
  }

  return { annotations, contentHash };
}

/**
 * Generates entity annotations for a study by matching known entity names
 * against the study text. Only runs if the study has zero annotations or
 * the content hash has changed. Results are persisted to study_entity_annotations.
 */
export async function annotateStudyIfNeeded(
  studyId: number,
  contentMarkdown: string
): Promise<StudyEntityAnnotation[]> {
  const { annotations: toInsert, contentHash } = computeAnnotationsForContent(
    studyId,
    contentMarkdown
  );

  // Check existing annotations and decide whether to skip / overwrite.
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

  if (toInsert.length > 0) {
    insertStudyAnnotations(toInsert);
  }

  return getAnnotationsForStudy(studyId);
}
