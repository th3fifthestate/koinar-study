/**
 * Phase 2 backfill — regenerate the originally-seeded studies under the
 * new structure-pass system prompt (Quick / Standard / Comprehensive
 * skeleton). Preserves slug, category_id, tags, is_featured, is_public,
 * created_at; sets created_by = SEED_USER_ID so the byline reads
 * "Koinar Team" via the is_admin CASE in queries.ts.
 *
 * Run: cd app && npx tsx scripts/backfill-studies-under-new-skeleton.ts
 *
 * Idempotent: re-running regenerates again (each pass spends API tokens).
 * Use `--ids 1,4,9` to backfill a subset.
 */

import 'dotenv/config';

import { streamText, stepCountIs } from 'ai';
import { createAnthropic } from '@ai-sdk/anthropic';
import * as crypto from 'crypto';

import { getDb } from '../lib/db/connection';
import { config } from '../lib/config';
import { getSystemPrompt } from '../lib/ai/system-prompt';
import { studyTools } from '../lib/ai/tools';
import { stripPreamble } from '../lib/ai/strip-preamble';
import { stripEntityAnnotations } from '../lib/entities/strip-annotations';

type FormatType = 'quick' | 'standard' | 'comprehensive';
type StudyType = 'passage' | 'person' | 'word' | 'topical' | 'book';

const SEED_USER_ID = 1;

const VALID_STUDY_TYPES: ReadonlySet<StudyType> = new Set([
  'passage',
  'person',
  'word',
  'topical',
  'book',
]);

const MAX_OUTPUT_TOKENS_PER_TIER: Record<FormatType, number> = {
  quick: 4_096,
  standard: 6_144,
  comprehensive: 12_288,
};

/**
 * Per-study backfill plan. Keyed by slug (stable across DB instances) so the
 * same plan runs cleanly against local + prod even when row ids differ.
 *
 *   - newTier: may be down-tiered from a too-ambitious original
 *   - regenPrompt: appropriate for the tier (Quick wants a question, Standard
 *                  wants a topic/passage statement)
 */
interface BackfillEntry {
  slug: string;
  newTier: FormatType;
  regenPrompt: string;
}

const PLAN: BackfillEntry[] = [
  // Originally-Comprehensive single-passage studies — re-tiered to Standard.
  { slug: 'the-rock-of-revelation',     newTier: 'standard', regenPrompt: "Peter's Confession at Caesarea Philippi (Matthew 16:13-23): The Rock of Revelation" },
  { slug: 'peace-that-guards-the-mind', newTier: 'standard', regenPrompt: 'Peace That Guards the Mind: Anxiety and Philippians 4' },
  { slug: 'chosen-before-the-foundation', newTier: 'standard', regenPrompt: 'Chosen Before the Foundation: Identity in Ephesians 1' },
  { slug: 'how-long-o-lord',            newTier: 'standard', regenPrompt: 'How Long, O LORD: Habakkuk and Honest Doubt' },
  { slug: 'do-justice-love-mercy',      newTier: 'standard', regenPrompt: 'Do Justice, Love Mercy, Walk Humbly: Micah 6:8 in Context' },

  // Quick (questions). Reformulate title-as-statement → question for the
  // Quick tier's question-driven scripture-finder.
  { slug: 'a-living-sacrifice',         newTier: 'quick',    regenPrompt: 'What does it mean to offer my life as a living sacrifice (Romans 12)?' },
  { slug: 'before-daybreak',            newTier: 'quick',    regenPrompt: 'How can I cultivate focus and solitude in a distracted age?' },
  { slug: 'new-every-morning',          newTier: 'quick',    regenPrompt: 'How do I find hope when grief is overwhelming?' },
  { slug: 'psalm-1-the-two-paths-delight-in-the-law-and-the-tree-by-the-water', newTier: 'quick', regenPrompt: 'What does Psalm 1 teach about the two paths — the wicked and the righteous?' },

  // Standard (preserved).
  { slug: 'at-the-threshing-floor',     newTier: 'standard', regenPrompt: 'At the Threshing Floor: Dating, Covenant, and the Story of Ruth and Boaz' },
  { slug: 'treasure-and-worry',         newTier: 'standard', regenPrompt: "Treasure and Worry: Jesus on Money in Matthew 6:19-34" },
  { slug: 'two-are-better-than-one',    newTier: 'standard', regenPrompt: 'Two Are Better Than One: Friendship in Ecclesiastes 4:9-12' },
  { slug: 'the-life-of-peter-from-fisherman-to-shepherd', newTier: 'standard', regenPrompt: 'The Life of Peter: From Fisherman to Shepherd' },
];

const COST_RATES = {
  // Opus 4.6: $5/MTok input, $0.5/MTok cache reads, $6.25/MTok cache writes,
  // $25/MTok output. Matches the live route's formula.
  inputPerMtok: 5,
  cacheReadPerMtok: 0.5,
  cacheWritePerMtok: 6.25,
  outputPerMtok: 25,
};

interface BackfillResult {
  id: number;
  slug: string;
  newTier: FormatType;
  studyType: StudyType;
  durationMs: number;
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
  cacheWriteTokens: number;
  estimatedCost: number;
  contentChars: number;
  toolsCalled: string[];
}

function computeCost(usage: {
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
  cacheWriteTokens: number;
}): number {
  return (
    (usage.inputTokens / 1_000_000) * COST_RATES.inputPerMtok +
    (usage.cacheReadTokens / 1_000_000) * COST_RATES.cacheReadPerMtok +
    (usage.cacheWriteTokens / 1_000_000) * COST_RATES.cacheWritePerMtok +
    (usage.outputTokens / 1_000_000) * COST_RATES.outputPerMtok
  );
}

async function regenerate(entry: BackfillEntry): Promise<BackfillResult | null> {
  const db = getDb();
  const study = db
    .prepare(
      'SELECT id, slug, title, format_type, category_id, summary, is_public, is_featured, created_at FROM studies WHERE slug = ?'
    )
    .get(entry.slug) as
    | {
        id: number;
        slug: string;
        title: string;
        format_type: FormatType;
        category_id: number | null;
        summary: string | null;
        is_public: number;
        is_featured: number;
        created_at: string;
      }
    | undefined;
  if (!study) return null; // slug not present in this DB — skip silently

  const apiKey = config.ai.anthropicApiKey;
  if (!apiKey) throw new Error('ANTHROPIC_API_KEY missing');

  const provider = createAnthropic({
    apiKey,
    baseURL: 'https://api.anthropic.com/v1',
  });

  const systemPrompt = getSystemPrompt(entry.newTier);
  const startTime = Date.now();

  const result = streamText({
    model: provider(config.ai.modelId),
    maxOutputTokens: MAX_OUTPUT_TOKENS_PER_TIER[entry.newTier],
    messages: [
      {
        role: 'system',
        content: systemPrompt,
        providerOptions: {
          anthropic: { cacheControl: { type: 'ephemeral' } },
        },
      },
      { role: 'user', content: entry.regenPrompt },
    ],
    tools: studyTools,
    stopWhen: stepCountIs(30),
  });

  // Drain the textStream into a buffer.
  const reader = result.textStream.getReader();
  let buffered = '';
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffered += value;
  }

  const totalUsage = await result.totalUsage;
  const providerMetadata = await result.providerMetadata;
  const steps = await result.steps;

  const durationMs = Date.now() - startTime;
  const inputTokens = totalUsage?.inputTokens ?? 0;
  const outputTokens = totalUsage?.outputTokens ?? 0;
  const anthropicMeta = providerMetadata?.anthropic as
    | { cacheCreationInputTokens?: number; cacheReadInputTokens?: number }
    | undefined;
  const cacheReadTokens = anthropicMeta?.cacheReadInputTokens ?? 0;
  const cacheWriteTokens = anthropicMeta?.cacheCreationInputTokens ?? 0;
  const estimatedCost = computeCost({
    inputTokens,
    outputTokens,
    cacheReadTokens,
    cacheWriteTokens,
  });
  const toolsCalled = [
    ...new Set(
      steps?.flatMap((s) => s.toolCalls?.map((tc) => tc.toolName) ?? []) ?? []
    ),
  ];

  // Strip preamble + parse fences (mirrors route.ts onFinish).
  const { cleaned: text } = stripPreamble(buffered);
  const titleMatch = text.match(/^#\s+(.+)$/m);
  const newTitle = titleMatch ? titleMatch[1].trim() : study.title;

  let metadata: { category: string; tags: string[]; topic: string; summary: string; study_type: StudyType } = {
    category: 'topical',
    tags: [],
    topic: entry.regenPrompt,
    summary: '',
    study_type: 'topical',
  };
  const metadataMatch = text.match(/```json-metadata\s*\n([\s\S]*?)\n```/);
  if (metadataMatch) {
    try {
      const parsed = JSON.parse(metadataMatch[1]) as {
        category?: string;
        tags?: unknown;
        topic?: string;
        summary?: string;
        study_type?: string;
      };
      const rawType = parsed.study_type;
      const safeType: StudyType =
        typeof rawType === 'string' && VALID_STUDY_TYPES.has(rawType as StudyType)
          ? (rawType as StudyType)
          : 'topical';
      metadata = {
        category: parsed.category ?? metadata.category,
        tags: Array.isArray(parsed.tags) ? (parsed.tags.filter((t): t is string => typeof t === 'string')) : metadata.tags,
        topic: parsed.topic ?? metadata.topic,
        summary: parsed.summary ?? metadata.summary,
        study_type: safeType,
      };
    } catch {
      // Use defaults
    }
  }

  let auditQueries: Array<Record<string, unknown>> = [];
  const auditMatch = text.match(/```verification-audit\s*\n([\s\S]*?)\n```/);
  if (auditMatch) {
    try {
      const parsedAudit = JSON.parse(auditMatch[1]);
      if (Array.isArray(parsedAudit)) {
        auditQueries = parsedAudit.filter(
          (q): q is Record<string, unknown> => typeof q === 'object' && q !== null
        );
      }
    } catch {
      // ignore
    }
  }

  const textWithoutCodeBlocks = text
    .replace(/```json-metadata[\s\S]*?```/g, '')
    .replace(/```verification-audit[\s\S]*?```/g, '')
    .trim();

  const { cleanMarkdown: cleanContent } = stripEntityAnnotations(textWithoutCodeBlocks);
  const _contentHash = crypto.createHash('sha256').update(cleanContent).digest('hex');
  void _contentHash;

  // Persist — UPDATE existing row in place, preserving slug/created_at/etc.
  const generationMetadata = JSON.stringify({
    model: config.ai.modelId,
    input_tokens: inputTokens,
    output_tokens: outputTokens,
    cache_read_tokens: cacheReadTokens,
    cache_write_tokens: cacheWriteTokens,
    estimated_cost: estimatedCost,
    duration_ms: durationMs,
    tools_called: toolsCalled,
    prompt: entry.regenPrompt,
    is_byok: false,
    study_type: metadata.study_type,
    queries: auditQueries,
    backfill: 'phase-2',
  });

  db.prepare(
    `UPDATE studies SET
       title = ?,
       content_markdown = ?,
       summary = ?,
       format_type = ?,
       study_type = ?,
       source_prompt = ?,
       translation_used = 'BSB',
       current_translation = 'BSB',
       generation_metadata = ?,
       created_by = ?,
       updated_at = datetime('now')
     WHERE id = ?`
  ).run(
    newTitle,
    cleanContent,
    metadata.summary || study.summary || null,
    entry.newTier,
    metadata.study_type,
    entry.regenPrompt,
    generationMetadata,
    SEED_USER_ID,
    study.id
  );

  // Replace tags (column is tag_name, mirroring lib/db/queries.ts:setStudyTags)
  db.prepare('DELETE FROM study_tags WHERE study_id = ?').run(study.id);
  if (metadata.tags.length > 0) {
    const insertTag = db.prepare('INSERT INTO study_tags (study_id, tag_name) VALUES (?, ?)');
    const safeTags = metadata.tags.map((t) => t.slice(0, 50)).slice(0, 20);
    for (const tag of safeTags) insertTag.run(study.id, tag);
  }

  // Drop entity annotations — render-fallback annotator will re-run on first read.
  db.prepare('DELETE FROM study_entity_annotations WHERE study_id = ?').run(study.id);

  return {
    id: study.id,
    slug: study.slug,
    newTier: entry.newTier,
    studyType: metadata.study_type,
    durationMs,
    inputTokens,
    outputTokens,
    cacheReadTokens,
    cacheWriteTokens,
    estimatedCost,
    contentChars: cleanContent.length,
    toolsCalled,
  };
}

function parseSlugsArg(): Set<string> | null {
  const idx = process.argv.indexOf('--slugs');
  if (idx < 0) return null;
  const raw = process.argv[idx + 1];
  if (!raw) return null;
  return new Set(raw.split(',').map((s) => s.trim()).filter(Boolean));
}

async function main() {
  const filterSlugs = parseSlugsArg();
  const targets = filterSlugs
    ? PLAN.filter((p) => filterSlugs.has(p.slug))
    : PLAN;

  if (targets.length === 0) {
    console.error('No targets matched. Use --slugs slug-a,slug-b or run without args for all.');
    process.exit(1);
  }

  console.log(`\n  Phase 2 backfill — ${targets.length} studies in plan\n`);
  for (const t of targets) {
    console.log(`    ${t.newTier.padEnd(13)}  ${t.slug}`);
  }
  console.log('');

  const results: BackfillResult[] = [];
  const skipped: string[] = [];
  let totalCost = 0;

  for (const entry of targets) {
    process.stdout.write(`  → ${entry.slug.padEnd(60)}  (${entry.newTier}) ... `);
    try {
      const r = await regenerate(entry);
      if (r === null) {
        console.log('SKIP (slug not in this DB)');
        skipped.push(entry.slug);
        continue;
      }
      results.push(r);
      totalCost += r.estimatedCost;
      console.log(
        `done in ${(r.durationMs / 1000).toFixed(1)}s · ${r.contentChars.toLocaleString()} chars · $${r.estimatedCost.toFixed(2)}`
      );
    } catch (err) {
      console.log(`FAILED: ${err instanceof Error ? err.message : String(err)}`);
      throw err;
    }
  }

  console.log(`\n  ✔ ${results.length} studies backfilled · total cost $${totalCost.toFixed(2)}`);
  if (skipped.length > 0) {
    console.log(`  ⊘ ${skipped.length} skipped (not present in this DB): ${skipped.join(', ')}`);
  }
  console.log('\n  Per-study breakdown:');
  for (const r of results) {
    console.log(
      `    [${String(r.id).padStart(2)}]  ${r.newTier.padEnd(13)} · ${r.studyType.padEnd(8)} · ${r.contentChars.toLocaleString().padStart(7)} chars · $${r.estimatedCost.toFixed(2)} · ${r.toolsCalled.length} tools  ${r.slug}`
    );
  }
}

main().catch((err) => {
  console.error('\n  ✗ Backfill failed:', err);
  process.exit(1);
});
