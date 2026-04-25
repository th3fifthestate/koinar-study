/**
 * One-shot: dump the locally-backfilled studies (slug → content + tier +
 * study_type + summary + source_prompt + generation_metadata + tags) to a
 * portable JSON file. Companion script `apply-backfill-snapshot.cjs`
 * (heredoc-injected on the prod container) reads the JSON and applies
 * UPDATE statements keyed by slug.
 *
 * Why: prod's container doesn't have the Bible/Strongs SQLite databases at
 * BIBLE_DB_PATH, so re-generating via streamText fails — the LLM produces
 * stunted content without scripture lookups. Local has the Bible DBs and
 * already produced verified content. This script ports that content over.
 *
 * Run: cd app && npx tsx scripts/sync-backfilled-studies-to-prod.ts > /tmp/backfill-snapshot.json
 */

import 'dotenv/config';
import { getDb } from '../lib/db/connection';

interface SnapshotEntry {
  slug: string;
  title: string;
  content_markdown: string;
  summary: string | null;
  format_type: 'quick' | 'standard' | 'comprehensive';
  study_type: 'passage' | 'person' | 'word' | 'topical' | 'book';
  source_prompt: string | null;
  generation_metadata: string | null;
  tags: string[];
}

// Same SLUGS as the backfill plan — only these are exported.
const SLUGS = [
  'peace-that-guards-the-mind',
  'chosen-before-the-foundation',
  'how-long-o-lord',
  'do-justice-love-mercy',
  'a-living-sacrifice',
  'before-daybreak',
  'new-every-morning',
  'at-the-threshing-floor',
  'treasure-and-worry',
  'two-are-better-than-one',
  // The three slugs not present on prod:
  // 'the-rock-of-revelation',
  // 'psalm-1-the-two-paths-delight-in-the-law-and-the-tree-by-the-water',
  // 'the-life-of-peter-from-fisherman-to-shepherd',
];

function main() {
  const db = getDb();
  const placeholders = SLUGS.map(() => '?').join(',');
  const rows = db
    .prepare(
      `SELECT slug, title, content_markdown, summary, format_type, study_type, source_prompt, generation_metadata
       FROM studies WHERE slug IN (${placeholders})`,
    )
    .all(...SLUGS) as Array<Omit<SnapshotEntry, 'tags'>>;

  const tagStmt = db.prepare(
    'SELECT t.tag_name FROM study_tags t JOIN studies s ON s.id = t.study_id WHERE s.slug = ? ORDER BY t.tag_name',
  );

  const snapshot: SnapshotEntry[] = rows.map((r) => ({
    ...r,
    tags: (tagStmt.all(r.slug) as Array<{ tag_name: string }>).map((t) => t.tag_name),
  }));

  if (snapshot.length !== SLUGS.length) {
    const found = new Set(snapshot.map((s) => s.slug));
    const missing = SLUGS.filter((s) => !found.has(s));
    console.error(`Missing in local DB: ${missing.join(', ')}`);
    process.exit(1);
  }

  // Emit JSON to stdout — the apply script consumes it via base64.
  process.stdout.write(JSON.stringify(snapshot, null, 2));
}

main();
