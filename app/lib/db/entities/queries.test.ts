import { describe, it, expect, vi, beforeEach } from 'vitest';
import type {
  Entity,
  EntityVerseRef,
  EntityCitation,
  EntityRelationship,
  StudyEntityAnnotation,
  SavedBranchMap,
} from '../types';

vi.mock('@/lib/db/connection', () => ({
  getDb: vi.fn(),
}));

import {
  getEntityDetail,
  getEntitiesByIds,
  getEntitiesByType,
  searchEntities,
  getVerseRefsForEntity,
  getRelationshipsForEntity,
  getCitationsForEntity,
  getAnnotationsForStudy,
  getEntitiesForStudy,
  getEntitiesForChapter,
  getEntityDensityForBook,
  getAmbiguousRefsForBook,
  countEntitiesByType,
  getSavedBranchMaps,
  upsertEntity,
  insertVerseRefs,
  insertCitations,
  insertRelationship,
  insertStudyAnnotations,
  saveBranchMap,
  deleteBranchMap,
  deleteAnnotationsForStudy,
  updateEntityContent,
  updateVerseRefAfterDisambiguation,
  deleteVerseRef,
} from './queries';
import { getDb } from '../connection';

// ─── Test Helpers ────────────────────────────────────────────────────────────

function makeEntity(overrides: Partial<Entity> & { id: string; canonical_name: string }): Entity {
  return {
    entity_type: 'person',
    aliases: null,
    quick_glance: null,
    summary: null,
    full_profile: null,
    hebrew_name: null,
    greek_name: null,
    disambiguation_note: null,
    date_range: null,
    geographic_context: null,
    source_verified: 1,
    tipnr_id: null,
    created_at: '2026-01-01',
    updated_at: '2026-01-01',
    ...overrides,
  };
}

function makeVerseRef(overrides: Partial<EntityVerseRef> = {}): EntityVerseRef {
  return {
    id: 1,
    entity_id: 'ABRAHAM_H85G',
    book: 'Genesis',
    chapter: 12,
    verse_start: 1,
    verse_end: 1,
    surface_text: 'Abram',
    confidence: 'high',
    source: 'tipnr',
    created_at: '2026-01-01',
    ...overrides,
  };
}

function makeCitation(overrides: Partial<EntityCitation> = {}): EntityCitation {
  return {
    id: 1,
    entity_id: 'ABRAHAM_H85G',
    source_name: 'BSB',
    source_ref: 'Genesis 12:1',
    source_url: null,
    content_field: 'summary',
    excerpt: null,
    created_at: '2026-01-01',
    ...overrides,
  };
}

/**
 * Creates a mock database object. The `sqlHandlers` map lets you route
 * different SQL patterns to different return values.
 *
 * By default, `.get()` returns undefined and `.all()` returns [].
 */
function createMockDb(sqlHandlers: Record<string, { get?: unknown; all?: unknown[]; run?: unknown }> = {}) {
  const mockRun = vi.fn().mockReturnValue({ changes: 1, lastInsertRowid: 1 });

  const mockDb = {
    prepare: vi.fn((sql: string) => {
      // Check each handler key as a substring match against the SQL
      for (const [pattern, handler] of Object.entries(sqlHandlers)) {
        if (sql.includes(pattern)) {
          return {
            get: vi.fn().mockReturnValue(handler.get ?? undefined),
            all: vi.fn().mockReturnValue(handler.all ?? []),
            run: vi.fn().mockReturnValue(handler.run ?? { changes: 1, lastInsertRowid: 1 }),
          };
        }
      }
      // Default: return empty results
      return {
        get: vi.fn().mockReturnValue(undefined),
        all: vi.fn().mockReturnValue([]),
        run: mockRun,
      };
    }),
    transaction: vi.fn((fn: () => void) => fn),
  };

  vi.mocked(getDb).mockReturnValue(mockDb as never);
  return mockDb;
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('Entity Queries — READ', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  // ── getEntityDetail ──────────────────────────────────────────────────────

  describe('getEntityDetail', () => {
    it('returns null when entity not found', () => {
      createMockDb();
      expect(getEntityDetail('NONEXISTENT')).toBeNull();
    });

    it('returns entity with parsed aliases and geographic_context', () => {
      const entity = makeEntity({
        id: 'ABRAHAM_H85G',
        canonical_name: 'Abraham',
        aliases: JSON.stringify(['Abram', 'Avraham']),
        geographic_context: JSON.stringify({ lat: 31.5, lon: 34.5, region: 'Canaan' }),
      });
      const refs = [makeVerseRef()];
      const citations = [makeCitation()];

      createMockDb({
        'SELECT * FROM entities WHERE id': { get: entity },
        'entity_verse_refs': { all: refs },
        'entity_citations': { all: citations },
        'entity_relationships': { all: [] },
      });

      const detail = getEntityDetail('ABRAHAM_H85G');
      expect(detail).not.toBeNull();
      expect(detail!.aliases).toEqual(['Abram', 'Avraham']);
      expect(detail!.geographic_context).toEqual({ lat: 31.5, lon: 34.5, region: 'Canaan' });
      expect(detail!.verse_refs).toEqual(refs);
      expect(detail!.citations).toEqual(citations);
    });

    it('handles null aliases and geographic_context', () => {
      const entity = makeEntity({
        id: 'MOSES_H4872G',
        canonical_name: 'Moses',
        aliases: null,
        geographic_context: null,
      });

      createMockDb({
        'SELECT * FROM entities WHERE id': { get: entity },
        'entity_verse_refs': { all: [] },
        'entity_citations': { all: [] },
        'entity_relationships': { all: [] },
      });

      const detail = getEntityDetail('MOSES_H4872G');
      expect(detail!.aliases).toEqual([]);
      expect(detail!.geographic_context).toBeNull();
    });
  });

  // ── getEntitiesByIds ─────────────────────────────────────────────────────

  describe('getEntitiesByIds', () => {
    it('returns empty array for empty input', () => {
      // Should not even call getDb
      expect(getEntitiesByIds([])).toEqual([]);
    });

    it('returns entities matching the given IDs', () => {
      const entities = [
        makeEntity({ id: 'A_H1G', canonical_name: 'A' }),
        makeEntity({ id: 'B_H2G', canonical_name: 'B' }),
      ];
      createMockDb({ 'SELECT * FROM entities WHERE id IN': { all: entities } });

      const result = getEntitiesByIds(['A_H1G', 'B_H2G']);
      expect(result).toEqual(entities);
    });
  });

  // ── getEntitiesByType ────────────────────────────────────────────────────

  describe('getEntitiesByType', () => {
    it('returns entities filtered by type with pagination', () => {
      const entities = [makeEntity({ id: 'P_H1G', canonical_name: 'Place A', entity_type: 'place' })];
      createMockDb({ 'SELECT * FROM entities WHERE entity_type': { all: entities } });

      const result = getEntitiesByType('place', 10, 0);
      expect(result).toEqual(entities);
    });
  });

  // ── searchEntities ───────────────────────────────────────────────────────

  describe('searchEntities', () => {
    it('returns empty for empty query', () => {
      expect(searchEntities('')).toEqual([]);
    });

    it('returns empty for query with only special characters', () => {
      expect(searchEntities('***')).toEqual([]);
    });

    it('sanitizes FTS special characters from query', () => {
      const entities = [makeEntity({ id: 'A_H1G', canonical_name: 'Abraham' })];
      const mockDb = createMockDb({ 'entities_fts': { all: entities } });

      searchEntities('"abraham"');
      // The prepare call should have happened with sanitized input
      const prepareCall = mockDb.prepare.mock.calls.find(
        (c: string[]) => c[0].includes('entities_fts')
      );
      expect(prepareCall).toBeDefined();
    });

    it('filters by type when provided', () => {
      const mockDb = createMockDb({ 'entities_fts': { all: [] } });

      searchEntities('moses', 'person');
      // Should use the query that includes entity_type filter
      const prepareCall = mockDb.prepare.mock.calls.find(
        (c: string[]) => c[0].includes('entity_type')
      );
      expect(prepareCall).toBeDefined();
    });

    it('searches without type filter when type is omitted', () => {
      const mockDb = createMockDb({ 'entities_fts': { all: [] } });

      searchEntities('moses');
      const prepareCall = mockDb.prepare.mock.calls.find(
        (c: string[]) => c[0].includes('entities_fts') && !c[0].includes('entity_type')
      );
      expect(prepareCall).toBeDefined();
    });
  });

  // ── getVerseRefsForEntity ────────────────────────────────────────────────

  describe('getVerseRefsForEntity', () => {
    it('returns ordered verse refs for an entity', () => {
      const refs = [
        makeVerseRef({ id: 1, chapter: 12, verse_start: 1 }),
        makeVerseRef({ id: 2, chapter: 15, verse_start: 6 }),
      ];
      createMockDb({ 'entity_verse_refs WHERE entity_id': { all: refs } });

      expect(getVerseRefsForEntity('ABRAHAM_H85G')).toEqual(refs);
    });
  });

  // ── getCitationsForEntity ────────────────────────────────────────────────

  describe('getCitationsForEntity', () => {
    it('returns citations for an entity', () => {
      const citations = [makeCitation()];
      createMockDb({ 'entity_citations WHERE entity_id': { all: citations } });

      expect(getCitationsForEntity('ABRAHAM_H85G')).toEqual(citations);
    });
  });

  // ── getAnnotationsForStudy ───────────────────────────────────────────────

  describe('getAnnotationsForStudy', () => {
    it('returns annotations ordered by start_offset', () => {
      const annotations: StudyEntityAnnotation[] = [
        {
          id: 1, study_id: 1, entity_id: 'A_H1G', surface_text: 'Abraham',
          start_offset: 10, end_offset: 17, content_hash: 'abc', annotation_source: 'render_fallback',
          created_at: '2026-01-01',
        },
      ];
      createMockDb({ 'study_entity_annotations': { all: annotations } });

      expect(getAnnotationsForStudy(1)).toEqual(annotations);
    });
  });

  // ── getEntitiesForStudy ──────────────────────────────────────────────────

  describe('getEntitiesForStudy', () => {
    it('returns distinct entities referenced in a study', () => {
      const entities = [makeEntity({ id: 'A_H1G', canonical_name: 'Abraham' })];
      createMockDb({ 'DISTINCT e.*': { all: entities } });

      expect(getEntitiesForStudy(1)).toEqual(entities);
    });
  });

  // ── getEntitiesForChapter ────────────────────────────────────────────────

  describe('getEntitiesForChapter', () => {
    it('returns verse refs with entity metadata for a chapter', () => {
      const refs = [
        { ...makeVerseRef(), canonical_name: 'Abraham', entity_type: 'person' },
      ];
      createMockDb({ 'evr.book = ? AND evr.chapter': { all: refs } });

      const result = getEntitiesForChapter('Genesis', 12);
      expect(result).toHaveLength(1);
      expect(result[0].canonical_name).toBe('Abraham');
    });
  });

  // ── getEntityDensityForBook ──────────────────────────────────────────────

  describe('getEntityDensityForBook', () => {
    it('returns aggregated density stats', () => {
      createMockDb({
        'SELECT COUNT(*)': { get: { c: 50 } },
        'COUNT(DISTINCT entity_id)': { get: { c: 12 } },
        'GROUP BY confidence': { all: [{ confidence: 'high', c: 40 }, { confidence: 'low', c: 10 }] },
        'GROUP BY source': { all: [{ source: 'tipnr', c: 30 }, { source: 'deterministic', c: 20 }] },
      });

      const result = getEntityDensityForBook('Genesis');
      expect(result.total_refs).toBe(50);
      expect(result.unique_entities).toBe(12);
      expect(result.by_confidence).toEqual({ high: 40, low: 10 });
      expect(result.by_source).toEqual({ tipnr: 30, deterministic: 20 });
    });
  });

  // ── getAmbiguousRefsForBook ──────────────────────────────────────────────

  describe('getAmbiguousRefsForBook', () => {
    it('returns only deterministic_ambiguous refs', () => {
      const refs = [makeVerseRef({ source: 'deterministic_ambiguous' })];
      createMockDb({ 'deterministic_ambiguous': { all: refs } });

      expect(getAmbiguousRefsForBook('Matthew')).toEqual(refs);
    });
  });

  // ── countEntitiesByType ──────────────────────────────────────────────────

  describe('countEntitiesByType', () => {
    it('returns counts grouped by entity type', () => {
      const counts = [
        { type: 'person', count: 3142 },
        { type: 'place', count: 232 },
      ];
      createMockDb({ 'GROUP BY entity_type': { all: counts } });

      expect(countEntitiesByType()).toEqual(counts);
    });
  });

  // ── getSavedBranchMaps ───────────────────────────────────────────────────

  describe('getSavedBranchMaps', () => {
    it('returns maps for a user and study', () => {
      const maps: SavedBranchMap[] = [
        {
          id: 1, user_id: 1, study_id: 1, name: 'My Map',
          nodes: '["A"]', edges: '["1"]', layout: null,
          created_at: '2026-01-01', updated_at: '2026-01-01',
        },
      ];
      createMockDb({ 'saved_branch_maps': { all: maps } });

      expect(getSavedBranchMaps(1, 1)).toEqual(maps);
    });
  });
});

// ─── WRITE Operations ────────────────────────────────────────────────────────

describe('Entity Queries — WRITE', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  // ── upsertEntity ─────────────────────────────────────────────────────────

  describe('upsertEntity', () => {
    it('calls prepare with INSERT ... ON CONFLICT', () => {
      const mockDb = createMockDb();
      const entity = makeEntity({ id: 'TEST_H1G', canonical_name: 'Test' });

      upsertEntity(entity);

      const prepareCall = mockDb.prepare.mock.calls.find(
        (c: string[]) => c[0].includes('INSERT INTO entities') && c[0].includes('ON CONFLICT')
      );
      expect(prepareCall).toBeDefined();
    });
  });

  // ── insertVerseRefs ──────────────────────────────────────────────────────

  describe('insertVerseRefs', () => {
    it('does nothing for empty array', () => {
      const mockDb = createMockDb();
      insertVerseRefs([]);
      expect(mockDb.prepare).not.toHaveBeenCalled();
    });

    it('inserts refs and touches entity updated_at', () => {
      const mockDb = createMockDb();
      const refs = [
        {
          entity_id: 'A_H1G', book: 'Genesis', chapter: 1,
          verse_start: 1, verse_end: 1, surface_text: 'test',
          confidence: 'high' as const, source: 'tipnr',
        },
      ];

      insertVerseRefs(refs);

      // Should have called transaction
      expect(mockDb.transaction).toHaveBeenCalled();
      // Should have prepared both INSERT and UPDATE statements
      const calls = mockDb.prepare.mock.calls.map((c: string[]) => c[0]);
      expect(calls.some((sql: string) => sql.includes('INSERT OR IGNORE INTO entity_verse_refs'))).toBe(true);
      expect(calls.some((sql: string) => sql.includes('UPDATE entities SET updated_at'))).toBe(true);
    });
  });

  // ── insertCitations ──────────────────────────────────────────────────────

  describe('insertCitations', () => {
    it('does nothing for empty array', () => {
      const mockDb = createMockDb();
      insertCitations([]);
      expect(mockDb.prepare).not.toHaveBeenCalled();
    });

    it('inserts citations and touches entity updated_at', () => {
      const mockDb = createMockDb();
      const citations = [
        {
          entity_id: 'A_H1G', source_name: 'BSB', source_ref: 'Gen 1:1',
          source_url: null, content_field: 'summary' as const, excerpt: null,
        },
      ];

      insertCitations(citations);

      expect(mockDb.transaction).toHaveBeenCalled();
      const calls = mockDb.prepare.mock.calls.map((c: string[]) => c[0]);
      expect(calls.some((sql: string) => sql.includes('INSERT OR IGNORE INTO entity_citations'))).toBe(true);
    });
  });

  // ── insertRelationship ───────────────────────────────────────────────────

  describe('insertRelationship', () => {
    it('inserts a single relationship', () => {
      const mockDb = createMockDb();
      insertRelationship({
        from_entity_id: 'A_H1G',
        to_entity_id: 'B_H2G',
        relationship_type: 'parent',
        relationship_label: 'father of',
        bidirectional: 0,
        source: 'tipnr',
      });

      const calls = mockDb.prepare.mock.calls.map((c: string[]) => c[0]);
      expect(calls.some((sql: string) => sql.includes('INSERT OR IGNORE INTO entity_relationships'))).toBe(true);
    });
  });

  // ── insertStudyAnnotations ───────────────────────────────────────────────

  describe('insertStudyAnnotations', () => {
    it('does nothing for empty array', () => {
      const mockDb = createMockDb();
      insertStudyAnnotations([]);
      expect(mockDb.prepare).not.toHaveBeenCalled();
    });

    it('inserts annotations in a transaction', () => {
      const mockDb = createMockDb();
      insertStudyAnnotations([
        {
          study_id: 1, entity_id: 'A_H1G', surface_text: 'Abraham',
          start_offset: 0, end_offset: 7, content_hash: 'abc',
          annotation_source: 'render_fallback',
        },
      ]);

      expect(mockDb.transaction).toHaveBeenCalled();
    });
  });

  // ── saveBranchMap ────────────────────────────────────────────────────────

  describe('saveBranchMap', () => {
    it('throws if nodes or edges are missing', () => {
      createMockDb();
      expect(() =>
        saveBranchMap({
          user_id: 1, study_id: 1, name: 'test',
          nodes: '', edges: '["1"]', layout: null,
        })
      ).toThrow('nodes and edges are required');
    });

    it('returns lastInsertRowid on success', () => {
      createMockDb({
        'INSERT INTO saved_branch_maps': { run: { changes: 1, lastInsertRowid: 42 } },
      });

      const id = saveBranchMap({
        user_id: 1, study_id: 1, name: 'test',
        nodes: '["A"]', edges: '["1"]', layout: null,
      });
      expect(id).toBe(42);
    });
  });

  // ── deleteBranchMap ──────────────────────────────────────────────────────

  describe('deleteBranchMap', () => {
    it('returns true when a row is deleted', () => {
      createMockDb({
        'DELETE FROM saved_branch_maps': { run: { changes: 1, lastInsertRowid: 0 } },
      });
      expect(deleteBranchMap(1, 1)).toBe(true);
    });

    it('returns false when no row matches', () => {
      createMockDb({
        'DELETE FROM saved_branch_maps': { run: { changes: 0, lastInsertRowid: 0 } },
      });
      expect(deleteBranchMap(999, 1)).toBe(false);
    });
  });

  // ── deleteAnnotationsForStudy ────────────────────────────────────────────

  describe('deleteAnnotationsForStudy', () => {
    it('deletes annotations for a study', () => {
      const mockDb = createMockDb();
      deleteAnnotationsForStudy(1);

      const calls = mockDb.prepare.mock.calls.map((c: string[]) => c[0]);
      expect(calls.some((sql: string) => sql.includes('DELETE FROM study_entity_annotations'))).toBe(true);
    });
  });

  // ── updateEntityContent ──────────────────────────────────────────────────

  describe('updateEntityContent', () => {
    it('does nothing when no fields provided', () => {
      const mockDb = createMockDb();
      updateEntityContent('A_H1G', {});
      // prepare should not be called for UPDATE (only getDb is called)
      const calls = mockDb.prepare.mock.calls.map((c: string[]) => c[0]);
      expect(calls.some((sql: string) => sql.includes('UPDATE entities SET'))).toBe(false);
    });

    it('updates specified fields and sets updated_at', () => {
      const mockDb = createMockDb();
      updateEntityContent('A_H1G', { summary: 'Updated summary', source_verified: 1 });

      const call = mockDb.prepare.mock.calls.find(
        (c: string[]) => c[0].includes('UPDATE entities SET')
      );
      expect(call).toBeDefined();
      const sql = call![0] as string;
      expect(sql).toContain('summary');
      expect(sql).toContain('source_verified');
      expect(sql).toContain('updated_at');
    });
  });

  // ── updateVerseRefAfterDisambiguation ────────────────────────────────────

  describe('updateVerseRefAfterDisambiguation', () => {
    it('updates entity_id, confidence, and source', () => {
      const mockDb = createMockDb();
      updateVerseRefAfterDisambiguation(1, 'NEW_ID', 'high', 'ai_disambiguated');

      const calls = mockDb.prepare.mock.calls.map((c: string[]) => c[0]);
      expect(calls.some((sql: string) => sql.includes('UPDATE entity_verse_refs SET'))).toBe(true);
    });
  });

  // ── deleteVerseRef ───────────────────────────────────────────────────────

  describe('deleteVerseRef', () => {
    it('deletes a verse ref by id', () => {
      const mockDb = createMockDb();
      deleteVerseRef(42);

      const calls = mockDb.prepare.mock.calls.map((c: string[]) => c[0]);
      expect(calls.some((sql: string) => sql.includes('DELETE FROM entity_verse_refs'))).toBe(true);
    });
  });
});
