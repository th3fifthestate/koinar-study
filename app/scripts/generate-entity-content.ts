// scripts/generate-entity-content.ts
// Batch AI content generation for entity knowledge base entries.
// Usage: npx tsx scripts/generate-entity-content.ts [options]
//
// Options:
//   --type <type>      Generate for a specific entity type (person, culture, place, time_period, custom, concept)
//   --id <id>          Generate for a specific entity ID
//   --dry-run          Show what would be generated without calling AI
//   --regenerate       Overwrite existing content (default: skip entities with content)
//   --limit <n>        Limit batch size

import 'dotenv/config';
import { generateText, stepCountIs } from 'ai';
import { createAnthropic } from '@ai-sdk/anthropic';
import { getDb } from '../lib/db/connection';
import {
  getEntityDetail,
  updateEntityContent,
  insertCitations,
} from '../lib/db/entities/queries';
import { getVerse, getCrossReferences } from '../lib/db/bible/queries';
import { studyTools } from '../lib/ai/tools';
import { getEntityContentPrompt, buildEntityUserMessage } from '../lib/ai/entity-content-prompt';
import { config } from '../lib/config';
import type { Entity, EntityCitation } from '../lib/db/types';

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

// ---------------------------------------------------------------------------
// AI provider setup
// ---------------------------------------------------------------------------

const apiKey = config.ai.anthropicApiKey;
if (!apiKey && !dryRun) {
  console.error('ERROR: ANTHROPIC_API_KEY is not set. Set it in .env or environment.');
  process.exit(1);
}

const provider = apiKey ? createAnthropic({ apiKey }) : null;
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

  // By default, skip entities that already have a non-empty full_profile
  if (!regenerate && !filterId) {
    conditions.push("(full_profile IS NULL OR full_profile = '')");
  }

  if (conditions.length > 0) {
    sql += ' WHERE ' + conditions.join(' AND ');
  }

  // Priority ordering: people first, then places, then rest alphabetical
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
// Load verse text for an entity's references
// ---------------------------------------------------------------------------

function loadVerseTexts(entityId: string): string[] {
  const db = getDb();
  const refs = db
    .prepare(
      `SELECT * FROM entity_verse_refs
       WHERE entity_id = ?
       ORDER BY
         CASE confidence WHEN 'high' THEN 1 WHEN 'medium' THEN 2 ELSE 3 END,
         book, chapter, verse_start
       LIMIT 10`
    )
    .all(entityId) as {
    book: string;
    chapter: number;
    verse_start: number;
    verse_end: number;
  }[];

  const texts: string[] = [];
  for (const ref of refs) {
    const verse = getVerse(ref.book, ref.chapter, ref.verse_start);
    if (verse) {
      texts.push(`${verse.book} ${verse.chapter}:${verse.verse} — ${verse.text.trim()}`);
    }
  }
  return texts;
}

// ---------------------------------------------------------------------------
// Load cross-references for an entity's top verse refs
// ---------------------------------------------------------------------------

function loadCrossReferenceTexts(entityId: string): string[] {
  const db = getDb();
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

  const texts: string[] = [];
  for (const ref of refs) {
    const crossRefs = getCrossReferences(ref.book, ref.chapter, ref.verse_start, 3, true);
    for (const cr of crossRefs) {
      const refStr =
        cr.toVerseStart === cr.toVerseEnd
          ? `${cr.toBook} ${cr.toChapter}:${cr.toVerseStart}`
          : `${cr.toBook} ${cr.toChapter}:${cr.toVerseStart}-${cr.toVerseEnd}`;
      texts.push(`${refStr} (${cr.votes} votes) — ${cr.text ?? ''}`);
    }
  }
  return texts;
}

// ---------------------------------------------------------------------------
// Load related entity context
// ---------------------------------------------------------------------------

function loadRelatedEntities(
  entityId: string
): { label: string; name: string; type: string }[] {
  const db = getDb();
  const rows = db
    .prepare(
      `SELECT er.relationship_label,
        CASE WHEN er.from_entity_id = ? THEN e_to.canonical_name ELSE e_from.canonical_name END AS name,
        CASE WHEN er.from_entity_id = ? THEN e_to.entity_type   ELSE e_from.entity_type   END AS type
       FROM entity_relationships er
       LEFT JOIN entities e_to   ON er.to_entity_id   = e_to.id
       LEFT JOIN entities e_from ON er.from_entity_id = e_from.id
       WHERE er.from_entity_id = ? OR er.to_entity_id = ?
       LIMIT 10`
    )
    .all(entityId, entityId, entityId, entityId) as {
    relationship_label: string;
    name: string;
    type: string;
  }[];

  return rows.map((r) => ({
    label: r.relationship_label,
    name: r.name,
    type: r.type,
  }));
}

// ---------------------------------------------------------------------------
// Parse AI response
// ---------------------------------------------------------------------------

interface GeneratedContent {
  quick_glance: string;
  summary: string;
  full_profile: string;
  citations: {
    source_name: string;
    source_ref?: string;
    source_url?: string;
    content_field: string;
    excerpt?: string;
  }[];
  source_verified: boolean;
  unverified_claims: string[];
}

function parseResponse(text: string): GeneratedContent | null {
  let jsonStr = text.trim();

  // Strip markdown code fences if present
  const fenceMatch = jsonStr.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/);
  if (fenceMatch) {
    jsonStr = fenceMatch[1].trim();
  }

  // If the response has leading text before the JSON, extract the JSON object
  if (!jsonStr.startsWith('{')) {
    const jsonStart = jsonStr.indexOf('{');
    if (jsonStart === -1) return null;
    // Find the matching closing brace by tracking depth
    let depth = 0;
    let jsonEnd = -1;
    for (let i = jsonStart; i < jsonStr.length; i++) {
      if (jsonStr[i] === '{') depth++;
      else if (jsonStr[i] === '}') {
        depth--;
        if (depth === 0) { jsonEnd = i + 1; break; }
      }
    }
    if (jsonEnd === -1) return null;
    jsonStr = jsonStr.slice(jsonStart, jsonEnd);
  }

  try {
    const parsed = JSON.parse(jsonStr);
    if (!parsed.quick_glance || !parsed.summary || !parsed.full_profile) {
      return null;
    }
    return {
      quick_glance: parsed.quick_glance,
      summary: parsed.summary,
      full_profile: parsed.full_profile,
      citations: Array.isArray(parsed.citations) ? parsed.citations : [],
      source_verified: parsed.source_verified !== false,
      unverified_claims: Array.isArray(parsed.unverified_claims)
        ? parsed.unverified_claims
        : [],
    };
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Delete existing citations for an entity (used on --regenerate)
// ---------------------------------------------------------------------------

function deleteCitationsForEntity(entityId: string): void {
  const db = getDb();
  db.prepare('DELETE FROM entity_citations WHERE entity_id = ?').run(entityId);
}

// ---------------------------------------------------------------------------
// Process a single entity
// ---------------------------------------------------------------------------

async function processEntity(
  entity: Entity,
  index: number,
  total: number
): Promise<{ success: boolean; tokens: number; citations: number; duration: number }> {
  const tag = `[${index + 1}/${total}] ${entity.id} (${entity.entity_type})`;

  if (dryRun) {
    const verseTexts = loadVerseTexts(entity.id);
    const related = loadRelatedEntities(entity.id);
    console.log(`${tag} — dry run`);
    console.log(`  Verse refs: ${verseTexts.length}, Related entities: ${related.length}`);
    console.log(`  Has existing content: ${entity.full_profile ? 'yes' : 'no'}`);
    return { success: true, tokens: 0, citations: 0, duration: 0 };
  }

  process.stdout.write(`${tag} — generating... `);
  const startTime = Date.now();

  // Load context
  const verseTexts = loadVerseTexts(entity.id);
  const crossRefTexts = loadCrossReferenceTexts(entity.id);
  const relatedEntities = loadRelatedEntities(entity.id);

  if (verseTexts.length === 0) {
    console.log(`(no pre-loaded verse refs — AI will use tools to find relevant passages)`);
  }

  // Build prompts
  const systemPrompt = getEntityContentPrompt(entity.entity_type);
  const userMessage = buildEntityUserMessage({
    id: entity.id,
    canonicalName: entity.canonical_name,
    entityType: entity.entity_type,
    dateRange: entity.date_range,
    hebrewName: entity.hebrew_name,
    greekName: entity.greek_name,
    disambiguationNote: entity.disambiguation_note,
    existingQuickGlance: entity.quick_glance,
    existingSummary: entity.summary,
    verseTexts,
    relatedEntities,
    crossReferenceTexts: crossRefTexts,
  });

  const MAX_RETRIES = 3;
  const BACKOFF_BASE_MS = 30_000;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      const result = await generateText({
        model: provider!(modelId),
        system: systemPrompt,
        prompt: userMessage,
        tools: studyTools,
        stopWhen: stepCountIs(20),
      });

      const duration = Date.now() - startTime;
      const totalTokens =
        (result.usage?.inputTokens ?? 0) + (result.usage?.outputTokens ?? 0);

      // Parse the response
      const content = parseResponse(result.text);
      if (!content) {
        console.log(`FAILED (invalid JSON response, ${duration}ms)`);
        console.error(`  Raw response (first 200 chars): ${result.text.slice(0, 200)}`);
        return { success: false, tokens: totalTokens, citations: 0, duration };
      }

      // Clean slate for citations on regenerate
      if (regenerate) {
        deleteCitationsForEntity(entity.id);
      }

      // Save content
      updateEntityContent(entity.id, {
        quick_glance: content.quick_glance,
        summary: content.summary,
        full_profile: content.full_profile,
        source_verified: content.source_verified ? 1 : 0,
      });

      // Save citations
      const validFields = new Set(['quick_glance', 'summary', 'full_profile', 'general']);
      const citationsToInsert: Omit<EntityCitation, 'id' | 'created_at'>[] = content.citations
        .filter((c) => c.source_name)
        .map((c) => ({
          entity_id: entity.id,
          source_name: c.source_name,
          source_ref: c.source_ref ?? null,
          source_url: c.source_url ?? null,
          content_field: (validFields.has(c.content_field)
            ? c.content_field
            : 'general') as EntityCitation['content_field'],
          excerpt: c.excerpt ?? null,
        }));

      if (citationsToInsert.length > 0) {
        insertCitations(citationsToInsert);
      }

      console.log(
        `done (${(duration / 1000).toFixed(1)}s, ${totalTokens} tokens, ${citationsToInsert.length} citations${
          !content.source_verified ? ', UNVERIFIED' : ''
        })`
      );

      if (content.unverified_claims.length > 0) {
        for (const claim of content.unverified_claims) {
          console.log(`  [UNVERIFIED] ${claim}`);
        }
      }

      return {
        success: true,
        tokens: totalTokens,
        citations: citationsToInsert.length,
        duration,
      };
    } catch (err) {
      const duration = Date.now() - startTime;
      const message = err instanceof Error ? err.message : String(err);
      const isRetryable = message.includes('rate') || message.includes('429') || message.includes('503') || message.includes('overloaded');

      if (isRetryable && attempt < MAX_RETRIES) {
        const backoff = BACKOFF_BASE_MS * Math.pow(2, attempt); // 30s, 60s, 120s
        console.log(`rate limited (attempt ${attempt + 1}/${MAX_RETRIES}), retrying in ${backoff / 1000}s...`);
        await sleep(backoff);
        continue;
      }

      console.log(`FAILED (${duration}ms): ${message}`);
      return { success: false, tokens: 0, citations: 0, duration };
    }
  }

  // Should not reach here, but TypeScript needs a return
  return { success: false, tokens: 0, citations: 0, duration: Date.now() - startTime };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Rough cost calculation based on Claude Opus pricing ($5/$25 per MTok)
function estimateCost(promptTokens: number, completionTokens: number): number {
  return (promptTokens / 1_000_000) * 5 + (completionTokens / 1_000_000) * 25;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  console.log('Entity Content Generator');
  console.log('========================');
  console.log(`Model: ${modelId}`);
  console.log(`Dry run: ${dryRun}`);
  console.log(`Regenerate: ${regenerate}`);
  if (filterType) console.log(`Type filter: ${filterType}`);
  if (filterId) console.log(`ID filter: ${filterId}`);
  if (limit) console.log(`Limit: ${limit}`);
  console.log('');

  const entities = getEntitiesToProcess();
  console.log(`Found ${entities.length} entities to process.\n`);

  if (entities.length === 0) {
    console.log('Nothing to do.');
    return;
  }

  let generated = 0;
  let skipped = 0;
  let errors = 0;
  let totalTokens = 0;
  let totalCitations = 0;
  let unverifiedCount = 0;

  for (let i = 0; i < entities.length; i++) {
    const result = await processEntity(entities[i], i, entities.length);

    if (result.success) {
      generated++;
      totalTokens += result.tokens;
      totalCitations += result.citations;
    } else if (result.tokens === 0 && result.duration === 0) {
      skipped++;
    } else {
      errors++;
    }

    // Rate limiting: 2 second delay between API calls
    if (!dryRun && i < entities.length - 1) {
      await sleep(2000);
    }
  }

  // Check for unverified entities
  if (!dryRun) {
    const db = getDb();
    const unverified = db
      .prepare('SELECT COUNT(*) as c FROM entities WHERE source_verified = 0 AND full_profile IS NOT NULL')
      .get() as { c: number };
    unverifiedCount = unverified.c;
  }

  console.log('\n========================');
  console.log(`Complete.`);
  console.log(
    `Summary: ${generated} generated, ${skipped} skipped, ${errors} errors. ` +
      `Total tokens: ${totalTokens}. Citations: ${totalCitations}. ` +
      `Unverified: ${unverifiedCount} entities.`
  );
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
