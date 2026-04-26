/**
 * Phase 4: dump local entity-derived rows (entity_citations,
 * entity_verse_refs, entity_relationships) to a gzipped JSON snapshot,
 * upload to R2 data bucket, ready for prod to ingest.
 *
 * Why R2 instead of chunked-ssh: rows total ~12 MB JSON; chunked-base64
 * over `railway ssh` would take 7+ minutes. R2 + download-on-prod is
 * seconds.
 *
 * These rows are entity-derived (computed by scripts/generate-entity-
 * content.ts and seed-entities.ts), not user-generated, so the apply
 * step on prod is DELETE + bulk INSERT in a transaction — clean overwrite
 * of the canonical local state.
 *
 * Run: cd app && set -a && source .env && set +a && \
 *      npx tsx scripts/sync-entity-rows-to-prod.ts
 */

import 'dotenv/config';
import * as zlib from 'node:zlib';
import { promisify } from 'node:util';
import { getDb } from '../lib/db/connection';
import { putDataObject } from '../lib/data/r2-data';
import { config } from '../lib/config';

const gzip = promisify(zlib.gzip);

interface EntityCitation {
  entity_id: string;
  source_name: string;
  source_ref: string | null;
  source_url: string | null;
  content_field: string;
  excerpt: string | null;
}

interface EntityVerseRef {
  entity_id: string;
  book: string;
  chapter: number;
  verse_start: number;
  verse_end: number;
  surface_text: string | null;
  confidence: string;
  source: string;
}

interface EntityRelationship {
  from_entity_id: string;
  to_entity_id: string;
  relationship_type: string;
  relationship_label: string;
  bidirectional: number;
  source: string | null;
}

interface Snapshot {
  generated_at: string;
  citations: EntityCitation[];
  verseRefs: EntityVerseRef[];
  relationships: EntityRelationship[];
}

async function main() {
  if (!config.r2Data.accountId) {
    console.error('R2_DATA_ACCOUNT_ID not set. Source .env first.');
    process.exit(1);
  }

  const db = getDb();
  console.log('\n  Dumping entity rows from local app.db...');

  // Drop the auto-id and created_at columns on the way out — they regenerate
  // on the prod side. Keep only the logical columns.
  const citations = db
    .prepare(
      'SELECT entity_id, source_name, source_ref, source_url, content_field, excerpt FROM entity_citations',
    )
    .all() as EntityCitation[];

  const verseRefs = db
    .prepare(
      'SELECT entity_id, book, chapter, verse_start, verse_end, surface_text, confidence, source FROM entity_verse_refs',
    )
    .all() as EntityVerseRef[];

  const relationships = db
    .prepare(
      'SELECT from_entity_id, to_entity_id, relationship_type, relationship_label, bidirectional, source FROM entity_relationships',
    )
    .all() as EntityRelationship[];

  console.log(`    citations:     ${citations.length.toLocaleString()}`);
  console.log(`    verseRefs:     ${verseRefs.length.toLocaleString()}`);
  console.log(`    relationships: ${relationships.length.toLocaleString()}`);

  const snapshot: Snapshot = {
    generated_at: new Date().toISOString(),
    citations,
    verseRefs,
    relationships,
  };

  const json = JSON.stringify(snapshot);
  const gzipped = await gzip(Buffer.from(json, 'utf8'));
  const ratio = (gzipped.length / json.length) * 100;
  console.log(
    `\n  JSON: ${(json.length / (1024 * 1024)).toFixed(1)} MB · gzipped: ${(gzipped.length / (1024 * 1024)).toFixed(1)} MB (${ratio.toFixed(0)}%)`,
  );

  const key = 'entity-sync/snapshot.json.gz';
  console.log(`\n  Uploading to r2://${config.r2Data.bucketName}/${key}...`);
  const start = Date.now();
  await putDataObject(key, gzipped, 'application/gzip');
  console.log(`  ✔ Upload done in ${((Date.now() - start) / 1000).toFixed(1)}s`);
  console.log(
    '\n  Next: run the apply step on prod via railway ssh (the apply script will be heredoc-injected).',
  );
}

main().catch((err) => {
  console.error('\n  ✗ Sync failed:', err);
  process.exit(1);
});
