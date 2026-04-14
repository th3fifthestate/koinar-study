#!/usr/bin/env tsx
// scripts/map-entities-disambiguate.ts
// Phase 1b: TIPNR-backed local disambiguation of ambiguous matches.
// Phase 2:  AI disambiguation for remaining unresolved matches.
//
// Usage: npx tsx scripts/map-entities-disambiguate.ts [options]
//
// Options:
//   --books <list>      Comma-separated book names (default: all with ambiguous refs)
//   --tipnr-only        Only run TIPNR resolution (skip AI, $0 cost)
//   --ai-only           Only run AI disambiguation (skip TIPNR phase)
//   --limit <number>    Max ambiguous refs to send to AI (cost control)
//   --batch-size <n>    Verses per AI call (default: 20)
//   --dry-run           Print decisions without updating DB

import 'dotenv/config';
import Anthropic from '@anthropic-ai/sdk';
import { getDb } from '../lib/db/connection';
import { getChapter } from '../lib/db/bible/queries';
import { config } from '../lib/config';

// ── CLI ──────────────────────────────────────────────────────────────────────

const args = process.argv.slice(2);

function getArg(name: string): string | undefined {
  const idx = args.indexOf(`--${name}`);
  if (idx === -1 || idx + 1 >= args.length) return undefined;
  return args[idx + 1];
}

function hasFlag(name: string): boolean {
  return args.includes(`--${name}`);
}

const dryRun = hasFlag('dry-run');
const tipnrOnly = hasFlag('tipnr-only');
const aiOnly = hasFlag('ai-only');
const booksArg = getArg('books');
const limitArg = getArg('limit');
const batchSizeArg = getArg('batch-size');
const limit = limitArg ? parseInt(limitArg, 10) : Infinity;
const batchSize = batchSizeArg ? parseInt(batchSizeArg, 10) : 20;

// ── TIPNR Resolution (Phase 1b) ─────────────────────────────────────────────

interface AmbiguousRef {
  id: number;
  entity_id: string;
  book: string;
  chapter: number;
  verse_start: number;
  surface_text: string; // JSON: { matched, candidates }
}

interface ParsedAmbiguousData {
  matched: string;
  candidates: string[];
}

function parseSurfaceText(surfaceText: string): ParsedAmbiguousData | null {
  try {
    const parsed = JSON.parse(surfaceText);
    if (parsed.matched && Array.isArray(parsed.candidates)) return parsed;
    return null;
  } catch {
    return null;
  }
}

function runTipnrResolution(ambiguousRefs: AmbiguousRef[]): {
  resolved: { ref: AmbiguousRef; resolvedEntityId: string }[];
  unresolved: AmbiguousRef[];
} {
  const db = getDb();
  const resolved: { ref: AmbiguousRef; resolvedEntityId: string }[] = [];
  const unresolved: AmbiguousRef[] = [];

  // Build a lookup: for each (book, chapter, verse), which TIPNR entity IDs are present?
  const tipnrLookup = new Map<string, Set<string>>();
  const tipnrRows = db
    .prepare("SELECT entity_id, book, chapter, verse_start FROM entity_verse_refs WHERE source = 'tipnr'")
    .all() as { entity_id: string; book: string; chapter: number; verse_start: number }[];
  for (const r of tipnrRows) {
    const key = `${r.book}|${r.chapter}|${r.verse_start}`;
    const set = tipnrLookup.get(key) ?? new Set();
    set.add(r.entity_id);
    tipnrLookup.set(key, set);
  }

  for (const ref of ambiguousRefs) {
    const data = parseSurfaceText(ref.surface_text);
    if (!data) {
      unresolved.push(ref);
      continue;
    }

    const verseKey = `${ref.book}|${ref.chapter}|${ref.verse_start}`;
    const tipnrEntities = tipnrLookup.get(verseKey);

    if (!tipnrEntities) {
      unresolved.push(ref);
      continue;
    }

    // Check which candidates TIPNR places in this verse
    const tipnrMatches = data.candidates.filter((c) => tipnrEntities.has(c));

    if (tipnrMatches.length === 1) {
      // Exactly one candidate confirmed by TIPNR — resolved!
      resolved.push({ ref, resolvedEntityId: tipnrMatches[0] });
    } else {
      // 0 or multiple TIPNR matches — still ambiguous
      unresolved.push(ref);
    }
  }

  return { resolved, unresolved };
}

// ── AI Disambiguation (Phase 2) ─────────────────────────────────────────────

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

interface DisambiguationResult {
  verse: string;
  surface_text: string;
  resolved_entity_id: string | null;
  confidence: 'high' | 'medium' | 'low';
  reasoning: string;
}

async function disambiguateBatch(
  client: Anthropic,
  book: string,
  chapter: number,
  chapterText: string,
  refs: { ref: AmbiguousRef; data: ParsedAmbiguousData }[],
  entityInfo: Map<string, { canonical_name: string; quick_glance: string | null }>
): Promise<DisambiguationResult[]> {
  const refsBlock = refs.map(({ ref, data }) => {
    const candidateLines = data.candidates.map((cid) => {
      const info = entityInfo.get(cid);
      return `- ${cid}: ${info?.canonical_name ?? 'Unknown'} — ${info?.quick_glance ?? 'No description'}`;
    }).join('\n');
    return `### Verse ${chapter}:${ref.verse_start}\nMatched term: "${data.matched}"\nCandidates:\n${candidateLines}`;
  }).join('\n\n');

  const prompt = `You are a biblical scholar disambiguating entity references in scripture.

For each verse below, a name or term was detected that could refer to multiple entities.
Using the surrounding chapter context, determine which specific entity is being referenced.

## Chapter Context (${book} ${chapter})
${chapterText}

## Ambiguous References

${refsBlock}

## Response Format
Respond with ONLY a JSON array. For each reference:
{
  "verse": "${chapter}:<verse_number>",
  "surface_text": "<matched term>",
  "resolved_entity_id": "<entity_id>" | null,
  "confidence": "high" | "medium" | "low",
  "reasoning": "Brief explanation (1 sentence)"
}

If the matched term is NOT actually referring to any of the candidates (e.g., "James" used as a book name, not a person), set resolved_entity_id to null.`;

  const response = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 2048,
    messages: [{ role: 'user', content: prompt }],
  });

  const text = response.content
    .filter((b): b is Anthropic.TextBlock => b.type === 'text')
    .map((b) => b.text)
    .join('');

  // Parse JSON response
  let jsonStr = text.trim();
  const fenceMatch = jsonStr.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/);
  if (fenceMatch) jsonStr = fenceMatch[1].trim();

  try {
    return JSON.parse(jsonStr) as DisambiguationResult[];
  } catch {
    console.error(`  [PARSE ERROR] Could not parse AI response for ${book} ${chapter}`);
    console.error(`  First 200 chars: ${text.slice(0, 200)}`);
    return [];
  }
}

// ── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  const db = getDb();

  console.log('Entity Cross-Reference Mapping — Disambiguation');
  console.log('═══════════════════════════════════════════════════════════');
  console.log(`Mode: ${dryRun ? 'DRY RUN' : 'COMMIT'}`);
  console.log(`TIPNR resolution: ${aiOnly ? 'SKIP' : 'YES'}`);
  console.log(`AI disambiguation: ${tipnrOnly ? 'SKIP' : 'YES'}`);
  if (!tipnrOnly) console.log(`AI batch size: ${batchSize}, limit: ${limit === Infinity ? 'none' : limit}`);
  console.log('');

  // Load all ambiguous refs
  let ambiguousRefs: AmbiguousRef[];
  if (booksArg) {
    const bookList = booksArg.split(',').map((b) => b.trim());
    const placeholders = bookList.map(() => '?').join(',');
    ambiguousRefs = db
      .prepare(`SELECT * FROM entity_verse_refs WHERE source = 'deterministic_ambiguous' AND book IN (${placeholders}) ORDER BY book, chapter, verse_start`)
      .all(...bookList) as AmbiguousRef[];
  } else {
    ambiguousRefs = db
      .prepare("SELECT * FROM entity_verse_refs WHERE source = 'deterministic_ambiguous' ORDER BY book, chapter, verse_start")
      .all() as AmbiguousRef[];
  }

  console.log(`Ambiguous refs to process: ${ambiguousRefs.length}\n`);
  if (ambiguousRefs.length === 0) {
    console.log('Nothing to disambiguate.');
    return;
  }

  // ── Phase 1b: TIPNR Resolution ──────────────────────────────────────────

  let unresolvedRefs = ambiguousRefs;

  if (!aiOnly) {
    console.log('Phase 1b: TIPNR-backed disambiguation');
    console.log('───────────────────────────────────────');
    const tipnrResult = runTipnrResolution(ambiguousRefs);

    console.log(`  Resolved by TIPNR:  ${tipnrResult.resolved.length}`);
    console.log(`  Still unresolved:   ${tipnrResult.unresolved.length}\n`);

    // Apply TIPNR resolutions
    if (!dryRun) {
      const updateStmt = db.prepare(
        "UPDATE entity_verse_refs SET entity_id = ?, confidence = 'high', source = 'tipnr_disambiguated' WHERE id = ?"
      );
      db.transaction(() => {
        for (const { ref, resolvedEntityId } of tipnrResult.resolved) {
          updateStmt.run(resolvedEntityId, ref.id);
        }
      })();
    }

    unresolvedRefs = tipnrResult.unresolved;
  }

  // ── Phase 2: AI Disambiguation ──────────────────────────────────────────

  if (tipnrOnly || unresolvedRefs.length === 0) {
    if (unresolvedRefs.length > 0) {
      console.log(`${unresolvedRefs.length} refs remain unresolved (--tipnr-only mode, skipping AI).`);
    }
    console.log('\nDone.');
    return;
  }

  console.log('Phase 2: AI disambiguation (Claude Sonnet)');
  console.log('───────────────────────────────────────────');

  const apiKey = config.ai.anthropicApiKey;
  if (!apiKey) {
    console.error('ERROR: ANTHROPIC_API_KEY is not set. Cannot run AI disambiguation.');
    process.exit(1);
  }

  const client = new Anthropic({ apiKey });

  // Load entity info for prompt context
  const entityInfo = new Map<string, { canonical_name: string; quick_glance: string | null }>();
  const entityRows = db
    .prepare('SELECT id, canonical_name, quick_glance FROM entities')
    .all() as { id: string; canonical_name: string; quick_glance: string | null }[];
  for (const e of entityRows) {
    entityInfo.set(e.id, { canonical_name: e.canonical_name, quick_glance: e.quick_glance });
  }

  // Group by book + chapter
  const byChapter = new Map<string, { ref: AmbiguousRef; data: ParsedAmbiguousData }[]>();
  for (const ref of unresolvedRefs) {
    const data = parseSurfaceText(ref.surface_text);
    if (!data) continue;
    const key = `${ref.book}|${ref.chapter}`;
    const arr = byChapter.get(key) ?? [];
    arr.push({ ref, data });
    byChapter.set(key, arr);
  }

  let aiResolved = 0;
  let aiDeleted = 0;
  let aiSkipped = 0;
  let aiCalls = 0;
  let refsProcessed = 0;

  const updateStmt = db.prepare(
    'UPDATE entity_verse_refs SET entity_id = ?, confidence = ?, source = ? WHERE id = ?'
  );
  const deleteStmt = db.prepare('DELETE FROM entity_verse_refs WHERE id = ?');

  const chapterKeys = [...byChapter.keys()];

  for (let ki = 0; ki < chapterKeys.length; ki++) {
    if (refsProcessed >= limit) break;

    const chapterKey = chapterKeys[ki];
    const chapterRefs = byChapter.get(chapterKey)!;
    const [book, chapterStr] = chapterKey.split('|');
    const chapter = parseInt(chapterStr, 10);

    // Load chapter text for context
    const chapterVerses = getChapter(book, chapter);
    const chapterText = chapterVerses
      .map((v) => `${chapter}:${v.verse} ${v.text}`)
      .join('\n');

    // Process in batches
    for (let i = 0; i < chapterRefs.length; i += batchSize) {
      if (refsProcessed >= limit) break;

      const batch = chapterRefs.slice(i, i + batchSize);
      const results = await disambiguateBatch(client, book, chapter, chapterText, batch, entityInfo);
      aiCalls++;

      // Map results back to refs
      for (const result of results) {
        const verseNum = parseInt(result.verse.split(':')[1], 10);
        const matchingRef = batch.find(
          (b) => b.ref.verse_start === verseNum && b.data.matched === result.surface_text
        );
        if (!matchingRef) continue;

        if (result.resolved_entity_id === null) {
          // Not actually an entity reference — delete
          if (!dryRun) deleteStmt.run(matchingRef.ref.id);
          aiDeleted++;
        } else if (matchingRef.data.candidates.includes(result.resolved_entity_id)) {
          // Valid resolution
          if (!dryRun) {
            updateStmt.run(
              result.resolved_entity_id,
              result.confidence,
              'ai_disambiguated',
              matchingRef.ref.id
            );
          }
          aiResolved++;
        } else {
          aiSkipped++;
        }
        refsProcessed++;
      }

      console.log(`  ${book} ${chapter} (batch ${Math.floor(i / batchSize) + 1}): ${results.length} results`);

      // Rate limit: 2s between API calls
      const isLastBatch = i + batchSize >= chapterRefs.length;
      const isLastChapter = ki === chapterKeys.length - 1;
      if (!isLastBatch || !isLastChapter) {
        await sleep(2000);
      }
    }
  }

  console.log('\n═══════════════════════════════════════════════════════════');
  console.log(`AI calls made:       ${aiCalls}`);
  console.log(`AI resolved:         ${aiResolved}`);
  console.log(`AI deleted (false+): ${aiDeleted}`);
  console.log(`AI skipped (bad):    ${aiSkipped}`);

  // Final count
  const remaining = db
    .prepare("SELECT COUNT(*) as c FROM entity_verse_refs WHERE source = 'deterministic_ambiguous'")
    .get() as { c: number };
  console.log(`\nRemaining ambiguous: ${remaining.c}`);
  if (dryRun) console.log('(Dry run — no data written)');
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
