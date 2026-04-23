import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Entity } from '@/lib/db/types';

// We'll mock getDb so tests don't need a real database
vi.mock('@/lib/db/connection', () => ({
  getDb: vi.fn(),
}));

import { buildEntityNameIndex } from './name-index';
import { getDb } from '@/lib/db/connection';

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

describe('EntityNameIndex', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  function mockEntities(entities: Entity[]) {
    const mockDb = {
      prepare: vi.fn().mockReturnValue({
        all: vi.fn().mockReturnValue(entities),
      }),
    };
    vi.mocked(getDb).mockReturnValue(mockDb as never);
  }

  it('matches an unambiguous name', () => {
    mockEntities([
      makeEntity({ id: 'ABRAHAM_H85G', canonical_name: 'Abraham' }),
    ]);
    const index = buildEntityNameIndex();
    const matches = index.findMatches('Abraham went to the land.');
    expect(matches).toHaveLength(1);
    expect(matches[0].entity_id).toBe('ABRAHAM_H85G');
    expect(matches[0].ambiguous).toBe(false);
    expect(matches[0].surface_text).toBe('Abraham');
  });

  it('detects ambiguous names', () => {
    mockEntities([
      makeEntity({ id: 'JAMES_G2385G', canonical_name: 'James', disambiguation_note: 'son of Zebedee' }),
      makeEntity({ id: 'JAMES_G2385I', canonical_name: 'James', disambiguation_note: 'brother of Jesus' }),
    ]);
    const index = buildEntityNameIndex();
    const matches = index.findMatches('James was there.');
    expect(matches).toHaveLength(1);
    expect(matches[0].ambiguous).toBe(true);
    expect(matches[0].candidate_ids).toContain('JAMES_G2385G');
    expect(matches[0].candidate_ids).toContain('JAMES_G2385I');
  });

  it('respects word boundaries', () => {
    mockEntities([
      makeEntity({ id: 'DAN_H1835G', canonical_name: 'Dan' }),
    ]);
    const index = buildEntityNameIndex();
    // "Dan" should match as a standalone word
    expect(index.findMatches('Dan was born.')).toHaveLength(1);
    // "Daniel" should NOT match "Dan" — word boundary prevents it
    expect(index.findMatches('Daniel was wise.')).toHaveLength(0);
  });

  it('accepts capitalized and ALL-CAPS matches but rejects fully-lowercase ones', () => {
    mockEntities([
      makeEntity({ id: 'MOSES_H4872G', canonical_name: 'Moses' }),
    ]);
    const index = buildEntityNameIndex();
    // Proper capitalization — match.
    expect(index.findMatches('Moses spoke.')).toHaveLength(1);
    // ALL-CAPS (e.g. heading) — still matches (at least one uppercase letter).
    expect(index.findMatches('MOSES spoke.')).toHaveLength(1);
    // Fully lowercase — rejected, because proper nouns in prose are capitalized.
    // This prevents "mark my words" from hitting the evangelist Mark.
    expect(index.findMatches('moses spoke.')).toHaveLength(0);
  });

  it('drops fully-lowercase common-word collisions (e.g. "mark" the verb)', () => {
    mockEntities([
      makeEntity({ id: 'MARK_G3138', canonical_name: 'Mark' }),
    ]);
    const index = buildEntityNameIndex();
    // "mark my words" — the verb, NOT the evangelist.
    expect(index.findMatches('Just mark my words.')).toHaveLength(0);
    // But the capitalized proper name still matches.
    expect(index.findMatches('Mark wrote a gospel.')).toHaveLength(1);
  });

  it('prefers longest match', () => {
    mockEntities([
      makeEntity({ id: 'HEROD_G2264G', canonical_name: 'Herod the Great' }),
      makeEntity({ id: 'HEROD_G2264H', canonical_name: 'Herod', disambiguation_note: 'Antipas' }),
    ]);
    const index = buildEntityNameIndex();
    const matches = index.findMatches('Herod the Great ruled Judea.');
    // Should match "Herod the Great" (longest), not "Herod"
    expect(matches).toHaveLength(1);
    expect(matches[0].entity_id).toBe('HEROD_G2264G');
    expect(matches[0].surface_text).toBe('Herod the Great');
    expect(matches[0].ambiguous).toBe(false);
  });

  it('matches aliases', () => {
    mockEntities([
      makeEntity({
        id: 'BABYLONIAN_EMPIRE',
        canonical_name: 'Babylonian Empire',
        entity_type: 'culture',
        aliases: JSON.stringify(['Babylon', 'Chaldea', 'Chaldeans']),
      }),
    ]);
    const index = buildEntityNameIndex();
    expect(index.findMatches('Babylon fell.')).toHaveLength(1);
    expect(index.findMatches('The Chaldeans came.')).toHaveLength(1);
  });

  it('skips very short names (< 3 chars)', () => {
    mockEntities([
      makeEntity({ id: 'UR_PLACE', canonical_name: 'Ur', entity_type: 'place' }),
    ]);
    const index = buildEntityNameIndex();
    // "Ur" is only 2 chars — should be skipped to avoid false positives
    expect(index.findMatches('Ur of the Chaldeans')).toHaveLength(0);
  });

  it('handles multiple non-overlapping matches in one text', () => {
    mockEntities([
      makeEntity({ id: 'ABRAHAM_H85G', canonical_name: 'Abraham' }),
      makeEntity({ id: 'SARAH_H8283G', canonical_name: 'Sarah' }),
    ]);
    const index = buildEntityNameIndex();
    const matches = index.findMatches('Abraham and Sarah journeyed.');
    expect(matches).toHaveLength(2);
    const ids = matches.map((m) => m.entity_id);
    expect(ids).toContain('ABRAHAM_H85G');
    expect(ids).toContain('SARAH_H8283G');
  });

  it('reports index size', () => {
    mockEntities([
      makeEntity({ id: 'A', canonical_name: 'Abraham' }),
      makeEntity({
        id: 'B',
        canonical_name: 'Babylon',
        aliases: JSON.stringify(['Chaldea']),
      }),
    ]);
    const index = buildEntityNameIndex();
    // 3 surface forms: Abraham, Babylon, Chaldea
    expect(index.size).toBe(3);
  });
});
