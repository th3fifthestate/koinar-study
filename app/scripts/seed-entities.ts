import 'dotenv/config';
import path from 'path';
import fs from 'fs';
import { getDb } from '../lib/db/connection';
import {
  upsertEntity,
  insertRelationship,
} from '../lib/db/entities/queries';
import type { Entity, EntityVerseRef, EntityCitation } from '../lib/db/types';

interface SeedEntry {
  id: string;
  entity_type: Entity['entity_type'];
  canonical_name: string;
  aliases: string[] | null;
  quick_glance: string | null;
  summary: string | null;
  full_profile: string | null;
  hebrew_name: string | null;
  greek_name: string | null;
  disambiguation_note: string | null;
  date_range: string | null;
  geographic_context: { lat: number; lon: number; region: string } | null;
  source_verified: number;
  verse_refs?: Array<{
    book: string;
    chapter: number;
    verse_start: number;
    verse_end: number;
    confidence: EntityVerseRef['confidence'];
    source: string;
  }>;
  relationships?: Array<{
    to_entity_id: string;
    relationship_type: string;
    relationship_label: string;
    bidirectional: number;
    source: string;
  }>;
  citations?: Array<{
    source_name: string;
    source_ref?: string | null;
    source_url?: string | null;
    content_field: EntityCitation['content_field'];
    excerpt?: string | null;
  }>;
}

const SEED_FILES = [
  'cultures.json',
  'places.json',
  'time-periods.json',
  'customs.json',
  'concepts.json',
];

const SEEDS_DIR = path.join(process.cwd(), 'data', 'seeds');

function loadSeedFile(filename: string): SeedEntry[] {
  const filePath = path.join(SEEDS_DIR, filename);
  if (!fs.existsSync(filePath)) {
    console.warn(`[WARN] Seed file not found: ${filePath}`);
    return [];
  }
  return JSON.parse(fs.readFileSync(filePath, 'utf-8')) as SeedEntry[];
}

async function main() {
  console.log('=== Entity Seed Script ===\n');
  const db = getDb();

  let totalEntities = 0;
  let totalVerseRefs = 0;
  let totalCitations = 0;
  const allEntries: SeedEntry[] = [];

  // Phase 1: Insert all entities, verse refs, citations (no relationships yet)
  for (const filename of SEED_FILES) {
    const entries = loadSeedFile(filename);
    if (entries.length === 0) continue;
    console.log(`[${filename}] Loaded ${entries.length} entries`);
    allEntries.push(...entries);

    const insertPhase1 = db.transaction(() => {
      // Prepare statements for inline inserts (avoid nested transactions)
      const refStmt = db.prepare(
        `INSERT OR IGNORE INTO entity_verse_refs (entity_id, book, chapter, verse_start, verse_end, surface_text, confidence, source)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
      );
      const citStmt = db.prepare(
        `INSERT OR IGNORE INTO entity_citations (entity_id, source_name, source_ref, source_url, content_field, excerpt)
         VALUES (?, ?, ?, ?, ?, ?)`
      );
      const touchStmt = db.prepare("UPDATE entities SET updated_at = datetime('now') WHERE id = ?");

      for (const entry of entries) {
        upsertEntity({
          id: entry.id,
          entity_type: entry.entity_type,
          canonical_name: entry.canonical_name,
          aliases: entry.aliases ? JSON.stringify(entry.aliases) : null,
          quick_glance: entry.quick_glance ?? null,
          summary: entry.summary ?? null,
          full_profile: entry.full_profile ?? null,
          hebrew_name: entry.hebrew_name ?? null,
          greek_name: entry.greek_name ?? null,
          disambiguation_note: entry.disambiguation_note ?? null,
          date_range: entry.date_range ?? null,
          geographic_context: entry.geographic_context
            ? JSON.stringify(entry.geographic_context)
            : null,
          source_verified: entry.source_verified ?? 1,
          tipnr_id: null,
        });

        if (entry.verse_refs?.length) {
          for (const vr of entry.verse_refs) {
            refStmt.run(entry.id, vr.book, vr.chapter, vr.verse_start, vr.verse_end, null, vr.confidence, vr.source);
          }
          touchStmt.run(entry.id);
          totalVerseRefs += entry.verse_refs.length;
        }

        if (entry.citations?.length) {
          for (const c of entry.citations) {
            citStmt.run(entry.id, c.source_name, c.source_ref ?? null, c.source_url ?? null, c.content_field, c.excerpt ?? null);
          }
          touchStmt.run(entry.id);
          totalCitations += entry.citations.length;
        }

        totalEntities++;
      }
    });
    insertPhase1();
  }

  console.log(`\n[Phase 1 complete]`);
  console.log(`  Entities inserted: ${totalEntities}`);
  console.log(`  Verse refs: ${totalVerseRefs}`);
  console.log(`  Citations: ${totalCitations}`);

  // Phase 2: Relationships (only where both entity IDs exist in DB)
  console.log('\n[Phase 2] Inserting relationships...');

  const existingIds = new Set<string>(
    (db.prepare('SELECT id FROM entities').all() as { id: string }[]).map((r) => r.id)
  );

  let totalRelationships = 0;
  let skipped = 0;

  const insertPhase2 = db.transaction(() => {
    for (const entry of allEntries) {
      if (!entry.relationships?.length) continue;
      for (const rel of entry.relationships) {
        if (!existingIds.has(rel.to_entity_id)) {
          skipped++;
          continue;
        }
        try {
          insertRelationship({
            from_entity_id: entry.id,
            to_entity_id: rel.to_entity_id,
            relationship_type: rel.relationship_type,
            relationship_label: rel.relationship_label,
            bidirectional: rel.bidirectional,
            source: rel.source,
          });
          totalRelationships++;
        } catch (err: unknown) {
          const message = err instanceof Error ? err.message : String(err);
          if (!message.includes('UNIQUE constraint')) {
            console.error(
              `[WARN] Relationship failed: ${entry.id} → ${rel.to_entity_id}: ${message}`
            );
          }
        }
      }
    }
  });
  insertPhase2();

  console.log(`[Phase 2 complete]`);
  console.log(`  Relationships inserted: ${totalRelationships}`);
  if (skipped > 0) console.log(`  Skipped (target not in DB): ${skipped}`);

  // Summary
  console.log('\n=== Summary by entity type ===');
  const counts = db
    .prepare(
      `SELECT entity_type, COUNT(*) as count FROM entities
       WHERE entity_type != 'person'
       GROUP BY entity_type ORDER BY count DESC`
    )
    .all() as { entity_type: string; count: number }[];
  for (const row of counts) {
    console.log(`  ${row.entity_type}: ${row.count}`);
  }
  const personCount = (
    db.prepare(`SELECT COUNT(*) as count FROM entities WHERE entity_type = 'person'`).get() as { count: number }
  ).count;
  console.log(`  person (from TIPNR): ${personCount}`);
  console.log('\nDone.');
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
