// scripts/process-entity-batch.ts
// Polls for batch completion and processes results into the entity database.
// Usage: npx tsx scripts/process-entity-batch.ts [options]
//
// Options:
//   --batch-id <id>    Batch ID to process (defaults to last submitted batch)
//   --status           Just check status, don't process results
//   --poll             Poll until complete (checks every 60s)
//   --dry-run          Parse results but don't write to database

import 'dotenv/config';
import Anthropic from '@anthropic-ai/sdk';
import * as fs from 'fs';
import { getDb } from '../lib/db/connection';
import {
  updateEntityContent,
  insertCitations,
} from '../lib/db/entities/queries';
import { config } from '../lib/config';
import type { EntityCitation } from '../lib/db/types';

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

let batchId = getArg('batch-id');
const statusOnly = hasFlag('status');
const poll = hasFlag('poll');
const dryRun = hasFlag('dry-run');
const forceRegenerate = hasFlag('regenerate');

// If no batch ID given, try to load from last-entity-batch.json
if (!batchId) {
  try {
    const info = JSON.parse(fs.readFileSync('data/last-entity-batch.json', 'utf-8'));
    batchId = info.batch_id;
    console.log(`Using batch ID from data/last-entity-batch.json: ${batchId}`);
  } catch {
    console.error('ERROR: No --batch-id provided and no data/last-entity-batch.json found.');
    process.exit(1);
  }
}

// ---------------------------------------------------------------------------
// API setup
// ---------------------------------------------------------------------------

const apiKey = config.ai.anthropicApiKey;
if (!apiKey) {
  console.error('ERROR: ANTHROPIC_API_KEY is not set.');
  process.exit(1);
}

const client = new Anthropic({ apiKey });

// ---------------------------------------------------------------------------
// Parse AI response (same logic as generate-entity-content.ts)
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
    let depth = 0;
    let jsonEnd = -1;
    for (let i = jsonStart; i < jsonStr.length; i++) {
      if (jsonStr[i] === '{') depth++;
      else if (jsonStr[i] === '}') {
        depth--;
        if (depth === 0) {
          jsonEnd = i + 1;
          break;
        }
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
// Extract text from a Message response
// ---------------------------------------------------------------------------

function extractText(message: Anthropic.Message): string {
  return message.content
    .filter((block): block is Anthropic.TextBlock => block.type === 'text')
    .map((block) => block.text)
    .join('\n');
}

// ---------------------------------------------------------------------------
// Delete existing citations for an entity (used on regenerate)
// ---------------------------------------------------------------------------

function deleteCitationsForEntity(entityId: string): void {
  const db = getDb();
  db.prepare('DELETE FROM entity_citations WHERE entity_id = ?').run(entityId);
}

// ---------------------------------------------------------------------------
// Check if entity already has content (for safety)
// ---------------------------------------------------------------------------

function entityHasContent(entityId: string): boolean {
  const db = getDb();
  const row = db
    .prepare("SELECT full_profile FROM entities WHERE id = ? AND full_profile IS NOT NULL AND full_profile != ''")
    .get(entityId) as { full_profile: string } | undefined;
  return !!row;
}

// ---------------------------------------------------------------------------
// Process a single result
// ---------------------------------------------------------------------------

function processResult(
  entityId: string,
  message: Anthropic.Message,
  regenerate: boolean
): { success: boolean; citations: number; unverified: boolean } {
  const text = extractText(message);
  const content = parseResponse(text);

  if (!content) {
    console.log(`  [FAIL] ${entityId} — invalid JSON response`);
    console.log(`    First 200 chars: ${text.slice(0, 200)}`);
    return { success: false, citations: 0, unverified: false };
  }

  if (!regenerate && entityHasContent(entityId)) {
    console.log(`  [SKIP] ${entityId} — already has content (use --regenerate to overwrite)`);
    return { success: false, citations: 0, unverified: false };
  }

  if (dryRun) {
    console.log(
      `  [DRY] ${entityId} — QG: ${content.quick_glance.length}ch, Summary: ${content.summary.length}ch, ` +
        `Profile: ${content.full_profile.length}ch, Citations: ${content.citations.length}`
    );
    return { success: true, citations: content.citations.length, unverified: !content.source_verified };
  }

  // Clean slate for citations if entity had prior content
  if (regenerate) {
    deleteCitationsForEntity(entityId);
  }

  // Save content
  updateEntityContent(entityId, {
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
      entity_id: entityId,
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
    `  [OK] ${entityId} — Profile: ${content.full_profile.length}ch, Citations: ${citationsToInsert.length}` +
      (!content.source_verified ? ' [UNVERIFIED]' : '')
  );

  if (content.unverified_claims.length > 0) {
    for (const claim of content.unverified_claims) {
      console.log(`    [UNVERIFIED] ${claim}`);
    }
  }

  return {
    success: true,
    citations: citationsToInsert.length,
    unverified: !content.source_verified,
  };
}

// ---------------------------------------------------------------------------
// Sleep helper
// ---------------------------------------------------------------------------

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  console.log('Entity Content Batch Processor');
  console.log('==============================');
  console.log(`Batch ID: ${batchId}`);
  console.log(`Status only: ${statusOnly}`);
  console.log(`Poll: ${poll}`);
  console.log(`Dry run: ${dryRun}`);
  console.log('');

  // Check status
  let batch = await client.messages.batches.retrieve(batchId!);

  console.log(`Status: ${batch.processing_status}`);
  console.log(`Created: ${batch.created_at}`);
  console.log(`Expires: ${batch.expires_at}`);
  console.log(`Request counts:`, JSON.stringify(batch.request_counts, null, 2));

  if (statusOnly) return;

  // Poll if requested
  if (poll && batch.processing_status !== 'ended') {
    console.log('\nPolling for completion (checking every 60s)...');
    while (batch.processing_status !== 'ended') {
      await sleep(60_000);
      batch = await client.messages.batches.retrieve(batchId!);
      const now = new Date().toLocaleTimeString();
      console.log(
        `  [${now}] Status: ${batch.processing_status} — ` +
          `succeeded: ${batch.request_counts.succeeded}, ` +
          `processing: ${batch.request_counts.processing}, ` +
          `errored: ${batch.request_counts.errored}, ` +
          `expired: ${batch.request_counts.expired}`
      );
    }
    console.log('\nBatch processing complete!\n');
  }

  if (batch.processing_status !== 'ended') {
    console.log('\nBatch is still processing. Use --poll to wait, or check back later.');
    return;
  }

  // Process results
  console.log('\nProcessing results...\n');

  // Load batch info to know if this was a regenerate run
  let isRegenerate = forceRegenerate;
  if (!isRegenerate) {
    try {
      const info = JSON.parse(fs.readFileSync('data/last-entity-batch.json', 'utf-8'));
      if (info.batch_id === batchId) {
        isRegenerate = !!info.regenerate;
      }
    } catch {
      // ignore
    }
  }

  let succeeded = 0;
  const failed = 0;
  let errored = 0;
  let expired = 0;
  let skipped = 0;
  let totalCitations = 0;
  let unverifiedCount = 0;

  for await (const result of await client.messages.batches.results(batchId!)) {
    const entityId = result.custom_id;

    switch (result.result.type) {
      case 'succeeded': {
        const outcome = processResult(entityId, result.result.message, isRegenerate);
        if (outcome.success) {
          succeeded++;
          totalCitations += outcome.citations;
          if (outcome.unverified) unverifiedCount++;
        } else {
          skipped++;
        }
        break;
      }
      case 'errored': {
        errored++;
        const error = result.result.error as { type: string; message?: string };
        console.log(`  [ERROR] ${entityId} — ${error.type}: ${error.message ?? 'unknown'}`);
        break;
      }
      case 'canceled': {
        skipped++;
        console.log(`  [CANCELED] ${entityId}`);
        break;
      }
      case 'expired': {
        expired++;
        console.log(`  [EXPIRED] ${entityId}`);
        break;
      }
    }
  }

  console.log('\n==============================');
  console.log('Batch processing complete.');
  console.log(
    `Results: ${succeeded} saved, ${failed} parse failures, ` +
      `${errored} API errors, ${expired} expired, ${skipped} skipped.`
  );
  console.log(`Total citations: ${totalCitations}`);
  console.log(`Unverified entities: ${unverifiedCount}`);

  // Report overall entity status
  if (!dryRun) {
    const db = getDb();
    const total = db.prepare('SELECT COUNT(*) as c FROM entities').get() as { c: number };
    const withContent = db
      .prepare("SELECT COUNT(*) as c FROM entities WHERE full_profile IS NOT NULL AND full_profile != ''")
      .get() as { c: number };
    const remaining = total.c - withContent.c;

    console.log(`\nOverall: ${withContent.c}/${total.c} entities have content (${remaining} remaining).`);

    if (errored > 0 || expired > 0) {
      console.log(
        `\n${errored + expired} requests failed/expired. To retry these, run:\n` +
          `  npx tsx scripts/prepare-entity-batch.ts`
      );
    }
  }
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
