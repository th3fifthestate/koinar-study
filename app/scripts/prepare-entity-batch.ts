// scripts/prepare-entity-batch.ts
// Pre-computes all Bible data for entities and submits a Message Batch to Anthropic.
// Usage: npx tsx scripts/prepare-entity-batch.ts [options]
//
// Options:
//   --type <type>      Filter by entity type (person, culture, place, time_period, custom, concept)
//   --id <id>          Process a specific entity ID only
//   --dry-run          Show what would be submitted without calling the API
//   --regenerate       Include entities that already have content
//   --limit <n>        Limit number of entities
//   --output <path>    Write requests JSONL to file (for inspection) instead of submitting
//   --min-chars <n>    Treat profiles shorter than N chars as needing generation
//                      (defaults to 3000 so thin TIPNR @Article seeds are regenerated)

import 'dotenv/config';
import Anthropic from '@anthropic-ai/sdk';
import * as fs from 'fs';
import { getDb } from '../lib/db/connection';
import { getEntityContentPrompt, buildEntityUserMessage } from '../lib/ai/entity-content-prompt';
import { config } from '../lib/config';
import {
  getVerse,
  getVerseRange,
  searchVersesFts,
  searchVerses,
  getHebrewWords,
  getGreekWords,
  getLxxVerse,
  lookupStrongs,
  getCrossReferences,
} from '../lib/db/bible/queries';
import type { Entity } from '../lib/db/types';

// ---------------------------------------------------------------------------
// CLI argument parsing
// ---------------------------------------------------------------------------

const args = process.argv.slice(2);

function getArg(name: string): string | undefined {
  const idx = args.indexOf(`--${name}`);
  if (idx === -1 || idx + 1 >= args.length) return undefined;
  return args[idx + 1];
}

function hasFlag(name: string): boolean {
  return args.includes(`--${name}`);
}

const filterType = getArg('type') as Entity['entity_type'] | undefined;
const filterId = getArg('id');
const dryRun = hasFlag('dry-run');
const regenerate = hasFlag('regenerate');
const limit = getArg('limit') ? parseInt(getArg('limit')!, 10) : undefined;
const outputPath = getArg('output');
const minChars = getArg('min-chars') ? parseInt(getArg('min-chars')!, 10) : 3000;

// ---------------------------------------------------------------------------
// API setup
// ---------------------------------------------------------------------------

const apiKey = config.ai.anthropicApiKey;
if (!apiKey && !dryRun && !outputPath) {
  console.error('ERROR: ANTHROPIC_API_KEY is not set. Set it in .env or environment.');
  process.exit(1);
}

const modelId = config.ai.modelId || 'claude-opus-4-6';

// ---------------------------------------------------------------------------
// Query entities to process
// ---------------------------------------------------------------------------

function getEntitiesToProcess(): Entity[] {
  const db = getDb();

  let sql = 'SELECT * FROM entities';
  const conditions: string[] = [];
  const params: unknown[] = [];

  if (filterId) {
    conditions.push('id = ?');
    params.push(filterId);
  }

  if (filterType) {
    conditions.push('entity_type = ?');
    params.push(filterType);
  }

  if (!regenerate && !filterId) {
    // Treat both NULL and "thin" profiles (typically TIPNR @Article seeds) as
    // needing generation. 3000 chars is well above any TIPNR article and well
    // below any fully-generated Koinar profile (avg ~9000 chars).
    conditions.push("(full_profile IS NULL OR full_profile = '' OR length(full_profile) < ?)");
    params.push(minChars);
  }

  if (conditions.length > 0) {
    sql += ' WHERE ' + conditions.join(' AND ');
  }

  sql += ` ORDER BY
    CASE entity_type
      WHEN 'person' THEN 1
      WHEN 'place' THEN 2
      WHEN 'culture' THEN 3
      WHEN 'time_period' THEN 4
      WHEN 'custom' THEN 5
      WHEN 'concept' THEN 6
      ELSE 7
    END,
    canonical_name`;

  if (limit) {
    sql += ' LIMIT ?';
    params.push(limit);
  }

  return db.prepare(sql).all(...params) as Entity[];
}

// ---------------------------------------------------------------------------
// Pre-compute Bible data for an entity
// ---------------------------------------------------------------------------

interface PreComputedData {
  verseTexts: string[];
  crossReferenceTexts: string[];
  relatedEntities: { label: string; name: string; type: string }[];
  keywordSearchResults: string[];
  strongsData: string[];
  originalLanguageData: string[];
}

function loadVerseTexts(entityId: string): string[] {
  const db = getDb();
  const refs = db
    .prepare(
      `SELECT * FROM entity_verse_refs
       WHERE entity_id = ?
       ORDER BY
         CASE confidence WHEN 'high' THEN 1 WHEN 'medium' THEN 2 ELSE 3 END,
         book, chapter, verse_start
       LIMIT 25`
    )
    .all(entityId) as {
    book: string;
    chapter: number;
    verse_start: number;
    verse_end: number;
  }[];

  const texts: string[] = [];
  for (const ref of refs) {
    if (ref.verse_end > ref.verse_start) {
      const verses = getVerseRange(ref.book, ref.chapter, ref.verse_start, ref.verse_end);
      if (verses.length > 0) {
        const combined = verses.map((v) => `${v.verse}: ${v.text.trim()}`).join(' ');
        texts.push(`${verses[0].book} ${ref.chapter}:${ref.verse_start}-${ref.verse_end} — ${combined}`);
      }
    } else {
      const verse = getVerse(ref.book, ref.chapter, ref.verse_start);
      if (verse) {
        texts.push(`${verse.book} ${verse.chapter}:${verse.verse} — ${verse.text.trim()}`);
      }
    }
  }
  return texts;
}

function loadCrossReferenceTexts(entityId: string): string[] {
  const db = getDb();
  const refs = db
    .prepare(
      `SELECT * FROM entity_verse_refs
       WHERE entity_id = ? AND confidence IN ('high', 'medium')
       ORDER BY
         CASE confidence WHEN 'high' THEN 1 ELSE 2 END,
         book, chapter, verse_start
       LIMIT 8`
    )
    .all(entityId) as {
    book: string;
    chapter: number;
    verse_start: number;
  }[];

  const texts: string[] = [];
  const seen = new Set<string>();

  for (const ref of refs) {
    const crossRefs = getCrossReferences(ref.book, ref.chapter, ref.verse_start, 5, true);
    for (const cr of crossRefs) {
      const refStr =
        cr.toVerseStart === cr.toVerseEnd
          ? `${cr.toBook} ${cr.toChapter}:${cr.toVerseStart}`
          : `${cr.toBook} ${cr.toChapter}:${cr.toVerseStart}-${cr.toVerseEnd}`;
      if (seen.has(refStr)) continue;
      seen.add(refStr);
      texts.push(`${refStr} (${cr.votes} votes) — ${cr.text ?? ''}`);
    }
  }
  return texts.slice(0, 20); // Cap at 20 cross-references
}

function loadRelatedEntities(entityId: string): { label: string; name: string; type: string }[] {
  const db = getDb();
  return (
    db
      .prepare(
        `SELECT er.relationship_label,
          CASE WHEN er.from_entity_id = ? THEN e_to.canonical_name ELSE e_from.canonical_name END AS name,
          CASE WHEN er.from_entity_id = ? THEN e_to.entity_type   ELSE e_from.entity_type   END AS type
         FROM entity_relationships er
         LEFT JOIN entities e_to   ON er.to_entity_id   = e_to.id
         LEFT JOIN entities e_from ON er.from_entity_id = e_from.id
         WHERE er.from_entity_id = ? OR er.to_entity_id = ?
         LIMIT 15`
      )
      .all(entityId, entityId, entityId, entityId) as {
      relationship_label: string;
      name: string;
      type: string;
    }[]
  ).map((r) => ({ label: r.relationship_label, name: r.name, type: r.type }));
}

function loadKeywordSearchResults(entity: Entity): string[] {
  const names = [entity.canonical_name];
  if (entity.aliases) {
    try {
      const parsed = JSON.parse(entity.aliases) as string[];
      names.push(...parsed.slice(0, 3)); // Top 3 aliases
    } catch {
      // ignore parse errors
    }
  }

  const results: string[] = [];
  const seen = new Set<string>();

  for (const name of names) {
    try {
      const fts = searchVersesFts(name, 10);
      const verses = fts.results.length > 0 ? fts.results : searchVerses(name, 10);
      for (const v of verses) {
        const key = `${v.book} ${v.chapter}:${v.verse}`;
        if (seen.has(key)) continue;
        seen.add(key);
        results.push(`${key} — ${v.text.trim()}`);
      }
    } catch {
      // FTS may not be available, skip
    }
    if (results.length >= 15) break;
  }

  return results.slice(0, 15);
}

function loadStrongsData(entity: Entity): string[] {
  const results: string[] = [];

  // Look up Hebrew/Greek names if they have Strong's numbers
  const strongsPattern = /[HG]\d{1,5}/g;
  const fields = [entity.hebrew_name, entity.greek_name, entity.disambiguation_note].filter(Boolean);

  for (const field of fields) {
    const matches = field!.match(strongsPattern);
    if (matches) {
      for (const num of matches) {
        const entry = lookupStrongs(num);
        if (entry) {
          results.push(`${entry.number}: ${entry.lemma ?? ''} — ${entry.description?.slice(0, 200) ?? ''}`);
        }
      }
    }
  }

  return results;
}

function loadOriginalLanguageData(entityId: string): string[] {
  const db = getDb();
  // Get top 3 high-confidence verse refs for original language data
  const refs = db
    .prepare(
      `SELECT * FROM entity_verse_refs
       WHERE entity_id = ? AND confidence = 'high'
       ORDER BY book, chapter, verse_start
       LIMIT 3`
    )
    .all(entityId) as {
    book: string;
    chapter: number;
    verse_start: number;
  }[];

  const results: string[] = [];

  for (const ref of refs) {
    const hebrew = getHebrewWords(ref.book, ref.chapter, ref.verse_start);
    const greek = getGreekWords(ref.book, ref.chapter, ref.verse_start);
    const lxx = getLxxVerse(ref.book, ref.chapter, ref.verse_start);

    if (hebrew.length > 0) {
      const words = hebrew
        .filter((w) => w.strongs)
        .slice(0, 5)
        .map((w) => `${w.hebrew_text} (${w.strongs}, ${w.transliteration ?? ''})`)
        .join(', ');
      if (words) results.push(`Hebrew ${ref.book} ${ref.chapter}:${ref.verse_start}: ${words}`);
    }

    if (greek.length > 0) {
      const words = greek
        .filter((w) => w.strongs)
        .slice(0, 5)
        .map((w) => `${w.greek_text} (${w.strongs}, ${w.transliteration ?? ''})`)
        .join(', ');
      if (words) results.push(`Greek ${ref.book} ${ref.chapter}:${ref.verse_start}: ${words}`);
    }

    if (lxx.length > 0) {
      const words = lxx
        .filter((w) => w.strongs)
        .slice(0, 5)
        .map((w) => `${w.greek_text} (${w.strongs})`)
        .join(', ');
      if (words) results.push(`LXX ${ref.book} ${ref.chapter}:${ref.verse_start}: ${words}`);
    }
  }

  return results;
}

function preComputeEntityData(entity: Entity): PreComputedData {
  return {
    verseTexts: loadVerseTexts(entity.id),
    crossReferenceTexts: loadCrossReferenceTexts(entity.id),
    relatedEntities: loadRelatedEntities(entity.id),
    keywordSearchResults: loadKeywordSearchResults(entity),
    strongsData: loadStrongsData(entity),
    originalLanguageData: loadOriginalLanguageData(entity.id),
  };
}

// ---------------------------------------------------------------------------
// Build enriched user message with all pre-computed data
// ---------------------------------------------------------------------------

function buildEnrichedUserMessage(entity: Entity, data: PreComputedData): string {
  // Start with the standard message
  const baseMessage = buildEntityUserMessage({
    id: entity.id,
    canonicalName: entity.canonical_name,
    entityType: entity.entity_type,
    dateRange: entity.date_range,
    hebrewName: entity.hebrew_name,
    greekName: entity.greek_name,
    disambiguationNote: entity.disambiguation_note,
    existingQuickGlance: entity.quick_glance,
    existingSummary: entity.summary,
    verseTexts: data.verseTexts,
    relatedEntities: data.relatedEntities,
    crossReferenceTexts: data.crossReferenceTexts,
  });

  // Append additional pre-computed data
  const extras: string[] = [];

  if (data.keywordSearchResults.length > 0) {
    extras.push('\nAdditional Bible Text Mentions (keyword search):');
    for (const r of data.keywordSearchResults) extras.push(r);
  }

  if (data.strongsData.length > 0) {
    extras.push("\nStrong's Concordance Data:");
    for (const s of data.strongsData) extras.push(s);
  }

  if (data.originalLanguageData.length > 0) {
    extras.push('\nOriginal Language Breakdown:');
    for (const o of data.originalLanguageData) extras.push(o);
  }

  if (extras.length > 0) {
    return baseMessage + '\n' + extras.join('\n');
  }

  return baseMessage;
}

// ---------------------------------------------------------------------------
// Build modified system prompt (no tools available)
// ---------------------------------------------------------------------------

function getNoToolsSystemPrompt(entityType: string): string {
  const base = getEntityContentPrompt(entityType);

  // Replace the tool-use instructions with pre-computed data instructions
  const toolReplacement = `You have been provided with all available Bible data pre-loaded in the user message below. This includes:
1. BSB verse texts for key references
2. Cross-reference passages with vote counts
3. Keyword search results showing where this entity appears in Scripture
4. Strong's Concordance entries for relevant Hebrew/Greek terms
5. Original language word breakdowns for key verses

Use ONLY the provided data to ground your claims. You do NOT have access to Bible lookup tools in this context — all relevant data has been pre-loaded for you. If the provided data is insufficient for a particular claim, flag it with [SOURCE_UNVERIFIED].`;

  return base.replace(
    /You have access to Bible databases through tools:[\s\S]*?You MUST use these tools to look up every verse reference\. Never cite a verse from memory\./,
    toolReplacement
  ).replace(
    /Use the Bible tools to look up and verify every verse you reference\./g,
    'Reference only the pre-loaded verse data provided above.'
  );
}

// ---------------------------------------------------------------------------
// Build batch request for a single entity
// ---------------------------------------------------------------------------

function buildBatchRequest(
  entity: Entity,
  data: PreComputedData
): { custom_id: string; params: Anthropic.MessageCreateParamsNonStreaming } {
  const systemPrompt = getNoToolsSystemPrompt(entity.entity_type);
  const userMessage = buildEnrichedUserMessage(entity, data);

  return {
    custom_id: entity.id,
    params: {
      model: modelId,
      max_tokens: 16384,
      system: systemPrompt,
      messages: [{ role: 'user', content: userMessage }],
    },
  };
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  console.log('Entity Content Batch Preparation');
  console.log('=================================');
  console.log(`Model: ${modelId}`);
  console.log(`Dry run: ${dryRun}`);
  console.log(`Regenerate: ${regenerate}`);
  if (filterType) console.log(`Type filter: ${filterType}`);
  if (filterId) console.log(`ID filter: ${filterId}`);
  if (limit) console.log(`Limit: ${limit}`);
  if (outputPath) console.log(`Output file: ${outputPath}`);
  console.log('');

  const entities = getEntitiesToProcess();
  console.log(`Found ${entities.length} entities to process.\n`);

  if (entities.length === 0) {
    console.log('Nothing to do.');
    return;
  }

  // Pre-compute data for all entities
  console.log('Pre-computing Bible data for all entities...');
  const requests: { custom_id: string; params: Anthropic.MessageCreateParamsNonStreaming }[] = [];
  let totalDataPoints = 0;

  for (let i = 0; i < entities.length; i++) {
    const entity = entities[i];
    const data = preComputeEntityData(entity);

    const dataPoints =
      data.verseTexts.length +
      data.crossReferenceTexts.length +
      data.relatedEntities.length +
      data.keywordSearchResults.length +
      data.strongsData.length +
      data.originalLanguageData.length;
    totalDataPoints += dataPoints;

    if (dryRun) {
      console.log(
        `[${i + 1}/${entities.length}] ${entity.id} (${entity.entity_type}) — ` +
          `verses: ${data.verseTexts.length}, xrefs: ${data.crossReferenceTexts.length}, ` +
          `search: ${data.keywordSearchResults.length}, strongs: ${data.strongsData.length}, ` +
          `orig-lang: ${data.originalLanguageData.length}, related: ${data.relatedEntities.length}`
      );
      continue;
    }

    requests.push(buildBatchRequest(entity, data));

    if ((i + 1) % 50 === 0) {
      console.log(`  Prepared ${i + 1}/${entities.length} entities...`);
    }
  }

  console.log(`\nTotal data points pre-computed: ${totalDataPoints}`);
  console.log(`Average data points per entity: ${(totalDataPoints / entities.length).toFixed(1)}`);

  if (dryRun) {
    console.log('\nDry run complete. No batch submitted.');
    return;
  }

  // Write to file if --output specified
  if (outputPath) {
    const lines = requests.map((r) => JSON.stringify(r));
    fs.writeFileSync(outputPath, lines.join('\n'), 'utf-8');
    console.log(`\nWrote ${requests.length} requests to ${outputPath}`);
    return;
  }

  // Submit batch
  console.log(`\nSubmitting batch of ${requests.length} requests...`);

  const client = new Anthropic({ apiKey });

  try {
    const batch = await client.messages.batches.create({
      requests: requests.map((r) => ({
        custom_id: r.custom_id,
        params: r.params,
      })),
    });

    console.log('\n=================================');
    console.log('Batch submitted successfully!');
    console.log(`Batch ID: ${batch.id}`);
    console.log(`Status: ${batch.processing_status}`);
    console.log(`Created: ${batch.created_at}`);
    console.log(`Expires: ${batch.expires_at}`);
    console.log(`Request counts: ${JSON.stringify(batch.request_counts)}`);
    console.log('\nTo check status:');
    console.log(`  npx tsx scripts/process-entity-batch.ts --batch-id ${batch.id} --status`);
    console.log('\nTo process results when complete:');
    console.log(`  npx tsx scripts/process-entity-batch.ts --batch-id ${batch.id}`);

    // Save batch ID for convenience
    const batchInfoPath = 'data/last-entity-batch.json';
    fs.mkdirSync('data', { recursive: true });
    fs.writeFileSync(
      batchInfoPath,
      JSON.stringify(
        {
          batch_id: batch.id,
          entity_count: requests.length,
          model: modelId,
          created_at: batch.created_at,
          entity_ids: requests.map((r) => r.custom_id),
        },
        null,
        2
      ),
      'utf-8'
    );
    console.log(`\nBatch info saved to ${batchInfoPath}`);
  } catch (err) {
    console.error('Failed to submit batch:', err instanceof Error ? err.message : err);
    process.exit(1);
  }
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
