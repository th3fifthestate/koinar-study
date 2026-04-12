import type {
  Entity,
  EntityVerseRef,
  EntityCitation,
  EntityRelationship,
  EntityDetail,
  StudyEntityAnnotation,
  SavedBranchMap,
} from '../types';
import { getDb } from '../connection';

// ==============================
// READ
// ==============================

export function getEntityDetail(entityId: string): EntityDetail | null {
  const db = getDb();
  const entity = db.prepare('SELECT * FROM entities WHERE id = ?').get(entityId) as Entity | undefined;
  if (!entity) return null;

  const verseRefs = db
    .prepare('SELECT * FROM entity_verse_refs WHERE entity_id = ? ORDER BY book, chapter, verse_start')
    .all(entityId) as EntityVerseRef[];

  const citations = db
    .prepare('SELECT * FROM entity_citations WHERE entity_id = ?')
    .all(entityId) as EntityCitation[];

  const relationships = db
    .prepare(
      `SELECT er.*,
        CASE WHEN er.from_entity_id = ? THEN e_to.canonical_name ELSE e_from.canonical_name END AS related_entity_name,
        CASE WHEN er.from_entity_id = ? THEN e_to.entity_type   ELSE e_from.entity_type   END AS related_entity_type
       FROM entity_relationships er
       LEFT JOIN entities e_to   ON er.to_entity_id   = e_to.id
       LEFT JOIN entities e_from ON er.from_entity_id = e_from.id
       WHERE er.from_entity_id = ? OR er.to_entity_id = ?`
    )
    .all(entityId, entityId, entityId, entityId) as (EntityRelationship & {
      related_entity_name: string;
      related_entity_type: string;
    })[];

  return {
    ...entity,
    aliases: entity.aliases ? (JSON.parse(entity.aliases) as string[]) : [],
    geographic_context: entity.geographic_context
      ? (JSON.parse(entity.geographic_context) as { lat: number; lon: number; region: string })
      : null,
    verse_refs: verseRefs,
    citations,
    relationships,
  };
}

export function getEntitiesByIds(entityIds: string[]): Entity[] {
  if (entityIds.length === 0) return [];
  const db = getDb();
  const placeholders = entityIds.map(() => '?').join(',');
  return db
    .prepare(`SELECT * FROM entities WHERE id IN (${placeholders})`)
    .all(...entityIds) as Entity[];
}

export function getEntitiesByType(
  type: Entity['entity_type'],
  limit: number,
  offset: number
): Entity[] {
  const db = getDb();
  return db
    .prepare('SELECT * FROM entities WHERE entity_type = ? ORDER BY canonical_name LIMIT ? OFFSET ?')
    .all(type, limit, offset) as Entity[];
}

export function searchEntities(
  query: string,
  type?: Entity['entity_type'],
  limit = 20
): Entity[] {
  const db = getDb();
  const sanitized = query.replace(/['"()*:^~\-\\]/g, '').trim();
  if (!sanitized || !/[a-zA-Z0-9]/.test(sanitized)) return [];

  if (type) {
    return db
      .prepare(
        `SELECT e.* FROM entities_fts
         JOIN entities e ON entities_fts.rowid = e.rowid
         WHERE entities_fts MATCH ? AND e.entity_type = ?
         ORDER BY rank
         LIMIT ?`
      )
      .all(sanitized, type, limit) as Entity[];
  }
  return db
    .prepare(
      `SELECT e.* FROM entities_fts
       JOIN entities e ON entities_fts.rowid = e.rowid
       WHERE entities_fts MATCH ?
       ORDER BY rank
       LIMIT ?`
    )
    .all(sanitized, limit) as Entity[];
}

export function getVerseRefsForEntity(entityId: string): EntityVerseRef[] {
  const db = getDb();
  return db
    .prepare('SELECT * FROM entity_verse_refs WHERE entity_id = ? ORDER BY book, chapter, verse_start')
    .all(entityId) as EntityVerseRef[];
}

export function getRelationshipsForEntity(
  entityId: string
): (EntityRelationship & { related_entity_name: string; related_entity_type: string })[] {
  const db = getDb();
  return db
    .prepare(
      `SELECT er.*,
        CASE WHEN er.from_entity_id = ? THEN e_to.canonical_name ELSE e_from.canonical_name END AS related_entity_name,
        CASE WHEN er.from_entity_id = ? THEN e_to.entity_type   ELSE e_from.entity_type   END AS related_entity_type
       FROM entity_relationships er
       LEFT JOIN entities e_to   ON er.to_entity_id   = e_to.id
       LEFT JOIN entities e_from ON er.from_entity_id = e_from.id
       WHERE er.from_entity_id = ? OR er.to_entity_id = ?`
    )
    .all(entityId, entityId, entityId, entityId) as (EntityRelationship & {
      related_entity_name: string;
      related_entity_type: string;
    })[];
}

export function getCitationsForEntity(entityId: string): EntityCitation[] {
  const db = getDb();
  return db
    .prepare('SELECT * FROM entity_citations WHERE entity_id = ?')
    .all(entityId) as EntityCitation[];
}

export function getAnnotationsForStudy(studyId: number): StudyEntityAnnotation[] {
  const db = getDb();
  return db
    .prepare('SELECT * FROM study_entity_annotations WHERE study_id = ? ORDER BY start_offset')
    .all(studyId) as StudyEntityAnnotation[];
}

export function getEntitiesForStudy(studyId: number): Entity[] {
  const db = getDb();
  return db
    .prepare(
      `SELECT DISTINCT e.* FROM entities e
       JOIN study_entity_annotations a ON a.entity_id = e.id
       WHERE a.study_id = ?`
    )
    .all(studyId) as Entity[];
}

export function getSavedBranchMaps(userId: number, studyId: number): SavedBranchMap[] {
  const db = getDb();
  return db
    .prepare('SELECT * FROM saved_branch_maps WHERE user_id = ? AND study_id = ? ORDER BY created_at DESC')
    .all(userId, studyId) as SavedBranchMap[];
}

export function countEntitiesByType(): { type: string; count: number }[] {
  const db = getDb();
  return db
    .prepare('SELECT entity_type as type, COUNT(*) as count FROM entities GROUP BY entity_type ORDER BY count DESC')
    .all() as { type: string; count: number }[];
}

// ==============================
// WRITE
// ==============================

export function upsertEntity(entity: Omit<Entity, 'created_at' | 'updated_at'>): void {
  const db = getDb();
  db.prepare(
    `INSERT INTO entities (
       id, entity_type, canonical_name, aliases, quick_glance, summary, full_profile,
       hebrew_name, greek_name, disambiguation_note, date_range, geographic_context,
       source_verified, tipnr_id
     ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET
       entity_type        = excluded.entity_type,
       canonical_name     = excluded.canonical_name,
       aliases            = excluded.aliases,
       quick_glance       = excluded.quick_glance,
       summary            = excluded.summary,
       full_profile       = excluded.full_profile,
       hebrew_name        = excluded.hebrew_name,
       greek_name         = excluded.greek_name,
       disambiguation_note = excluded.disambiguation_note,
       date_range         = excluded.date_range,
       geographic_context = excluded.geographic_context,
       source_verified    = excluded.source_verified,
       tipnr_id           = excluded.tipnr_id,
       updated_at         = datetime('now')`
  ).run(
    entity.id,
    entity.entity_type,
    entity.canonical_name,
    entity.aliases ?? null,
    entity.quick_glance ?? null,
    entity.summary ?? null,
    entity.full_profile ?? null,
    entity.hebrew_name ?? null,
    entity.greek_name ?? null,
    entity.disambiguation_note ?? null,
    entity.date_range ?? null,
    entity.geographic_context ?? null,
    entity.source_verified,
    entity.tipnr_id ?? null
  );
}

export function insertVerseRefs(refs: Omit<EntityVerseRef, 'id' | 'created_at'>[]): void {
  if (refs.length === 0) return;
  const db = getDb();
  db.transaction(() => {
    const stmt = db.prepare(
      `INSERT INTO entity_verse_refs (entity_id, book, chapter, verse_start, verse_end, surface_text, confidence, source)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    );
    for (const ref of refs) {
      stmt.run(ref.entity_id, ref.book, ref.chapter, ref.verse_start, ref.verse_end, ref.surface_text ?? null, ref.confidence, ref.source);
    }
    const touchStmt = db.prepare("UPDATE entities SET updated_at = datetime('now') WHERE id = ?");
    const uniqueIds = [...new Set(refs.map((r) => r.entity_id))];
    for (const id of uniqueIds) touchStmt.run(id);
  })();
}

export function insertCitations(citations: Omit<EntityCitation, 'id' | 'created_at'>[]): void {
  if (citations.length === 0) return;
  const db = getDb();
  db.transaction(() => {
    const stmt = db.prepare(
      `INSERT INTO entity_citations (entity_id, source_name, source_ref, source_url, content_field, excerpt)
       VALUES (?, ?, ?, ?, ?, ?)`
    );
    for (const c of citations) {
      stmt.run(c.entity_id, c.source_name, c.source_ref ?? null, c.source_url ?? null, c.content_field, c.excerpt ?? null);
    }
    const touchStmt = db.prepare("UPDATE entities SET updated_at = datetime('now') WHERE id = ?");
    const uniqueIds = [...new Set(citations.map((c) => c.entity_id))];
    for (const id of uniqueIds) touchStmt.run(id);
  })();
}

export function insertRelationship(rel: Omit<EntityRelationship, 'id' | 'created_at'>): void {
  const db = getDb();
  db.prepare(
    `INSERT OR IGNORE INTO entity_relationships
       (from_entity_id, to_entity_id, relationship_type, relationship_label, bidirectional, source)
     VALUES (?, ?, ?, ?, ?, ?)`
  ).run(rel.from_entity_id, rel.to_entity_id, rel.relationship_type, rel.relationship_label, rel.bidirectional, rel.source ?? null);
}

export function insertStudyAnnotations(
  annotations: Omit<StudyEntityAnnotation, 'id' | 'created_at'>[]
): void {
  if (annotations.length === 0) return;
  const db = getDb();
  db.transaction(() => {
    const stmt = db.prepare(
      `INSERT INTO study_entity_annotations
         (study_id, entity_id, surface_text, start_offset, end_offset, content_hash, annotation_source)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    );
    for (const a of annotations) {
      stmt.run(a.study_id, a.entity_id, a.surface_text, a.start_offset, a.end_offset, a.content_hash ?? null, a.annotation_source);
    }
  })();
}

export function saveBranchMap(
  map: Omit<SavedBranchMap, 'id' | 'created_at' | 'updated_at'>
): number {
  const db = getDb();
  const result = db
    .prepare(
      `INSERT INTO saved_branch_maps (user_id, study_id, name, nodes, edges, layout)
       VALUES (?, ?, ?, ?, ?, ?)`
    )
    .run(map.user_id, map.study_id, map.name ?? null, map.nodes, map.edges, map.layout ?? null);
  return result.lastInsertRowid as number;
}

export function deleteBranchMap(mapId: number, userId: number): boolean {
  const db = getDb();
  const result = db
    .prepare('DELETE FROM saved_branch_maps WHERE id = ? AND user_id = ?')
    .run(mapId, userId);
  return result.changes === 1;
}

export function deleteAnnotationsForStudy(studyId: number): void {
  const db = getDb();
  db.prepare('DELETE FROM study_entity_annotations WHERE study_id = ?').run(studyId);
}

export function updateEntityContent(
  entityId: string,
  fields: {
    quick_glance?: string;
    summary?: string;
    full_profile?: string;
    source_verified?: number;
  }
): void {
  const db = getDb();
  const setClauses: string[] = ["updated_at = datetime('now')"];
  const values: unknown[] = [];

  if (fields.quick_glance !== undefined) { setClauses.push('quick_glance = ?'); values.push(fields.quick_glance); }
  if (fields.summary !== undefined) { setClauses.push('summary = ?'); values.push(fields.summary); }
  if (fields.full_profile !== undefined) { setClauses.push('full_profile = ?'); values.push(fields.full_profile); }
  if (fields.source_verified !== undefined) { setClauses.push('source_verified = ?'); values.push(fields.source_verified); }

  if (values.length === 0) return;
  values.push(entityId);

  db.prepare(`UPDATE entities SET ${setClauses.join(', ')} WHERE id = ?`).run(...values);
}
