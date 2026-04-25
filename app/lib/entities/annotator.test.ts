import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { Entity, StudyEntityAnnotation } from '@/lib/db/types';

// Mock all external dependencies
vi.mock('@/lib/db/connection', () => ({
  getDb: vi.fn(),
}));

vi.mock('@/lib/db/entities/queries', () => ({
  getAnnotationsForStudy: vi.fn(),
  insertStudyAnnotations: vi.fn(),
  deleteAnnotationsForStudy: vi.fn(),
}));

import { annotateStudyIfNeeded } from './annotator';
import { getDb } from '@/lib/db/connection';
import {
  getAnnotationsForStudy,
  insertStudyAnnotations,
  deleteAnnotationsForStudy,
} from '@/lib/db/entities/queries';

// ─── Helpers ─────────────────────────────────────────────────────────────────

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

function makeAnnotation(
  overrides: Partial<StudyEntityAnnotation> = {}
): StudyEntityAnnotation {
  return {
    id: 1,
    study_id: 1,
    entity_id: 'ABRAHAM_H85G',
    surface_text: 'Abraham',
    start_offset: 0,
    end_offset: 7,
    content_hash: 'somehash',
    annotation_source: 'render_fallback',
    created_at: '2026-01-01',
    ...overrides,
  };
}

// Each test gets a unique timestamp string so the cache staleness check
// detects a change in maxUpdatedAt and forces a rebuild.
let testCounter = 0;

function setupEntityDb(entities: Entity[]) {
  testCounter++;
  const updatedAt = `2026-01-${String(testCounter).padStart(2, '0')}`;
  const mockDb = {
    prepare: vi.fn((sql: string) => {
      if (sql.includes('SELECT * FROM entities')) {
        return { all: vi.fn().mockReturnValue(entities) };
      }
      if (sql.includes('MAX(updated_at)')) {
        return { get: vi.fn().mockReturnValue({ max_updated_at: updatedAt }) };
      }
      return {
        get: vi.fn().mockReturnValue(undefined),
        all: vi.fn().mockReturnValue([]),
        run: vi.fn(),
      };
    }),
  };
  vi.mocked(getDb).mockReturnValue(mockDb as never);
  return mockDb;
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('annotateStudyIfNeeded', () => {
  // We use fake timers with an ever-increasing base time to ensure
  // each test is always >60s past the previous cache check, forcing
  // the entity cache to rebuild with fresh mock data.
  let fakeTime: number;

  beforeEach(() => {
    vi.resetAllMocks();
    vi.useFakeTimers();
    // Each test starts 120s later than the last, always exceeding the 60s interval
    fakeTime = Date.now() + (testCounter + 1) * 120_000;
    vi.setSystemTime(fakeTime);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('cache behavior', () => {
    it('returns existing annotations when ai_generation annotations exist', async () => {
      const existing = [
        makeAnnotation({ annotation_source: 'ai_generation', content_hash: null }),
      ];
      vi.mocked(getAnnotationsForStudy).mockReturnValue(existing);
      setupEntityDb([]);

      const result = await annotateStudyIfNeeded(1, 'any content here');

      expect(result).toEqual(existing);
      expect(insertStudyAnnotations).not.toHaveBeenCalled();
      expect(deleteAnnotationsForStudy).not.toHaveBeenCalled();
    });

    it('re-annotates when hash mismatches on render_fallback annotations', async () => {
      const existing = [
        makeAnnotation({ content_hash: 'old_hash', annotation_source: 'render_fallback' }),
      ];
      vi.mocked(getAnnotationsForStudy)
        .mockReturnValueOnce(existing)
        .mockReturnValueOnce([]);

      setupEntityDb([]);

      await annotateStudyIfNeeded(1, 'changed content');

      expect(deleteAnnotationsForStudy).toHaveBeenCalledWith(1);
    });
  });

  describe('entity matching', () => {
    it('matches entity names in text', async () => {
      setupEntityDb([
        makeEntity({ id: 'ABRAHAM_H85G', canonical_name: 'Abraham' }),
      ]);

      const inserted: Omit<StudyEntityAnnotation, 'id' | 'created_at'>[] = [];
      vi.mocked(insertStudyAnnotations).mockImplementation((annotations) => {
        inserted.push(...annotations);
      });
      vi.mocked(getAnnotationsForStudy)
        .mockReturnValueOnce([])
        .mockReturnValueOnce([makeAnnotation()]);

      await annotateStudyIfNeeded(1, 'Abraham went to the land of Canaan.');

      expect(insertStudyAnnotations).toHaveBeenCalled();
      expect(inserted).toHaveLength(1);
      expect(inserted[0].entity_id).toBe('ABRAHAM_H85G');
      expect(inserted[0].surface_text).toBe('Abraham');
      expect(inserted[0].annotation_source).toBe('render_fallback');
    });

    it('skips matches in code blocks', async () => {
      setupEntityDb([
        makeEntity({ id: 'ABRAHAM_H85G', canonical_name: 'Abraham' }),
      ]);
      vi.mocked(getAnnotationsForStudy)
        .mockReturnValueOnce([])
        .mockReturnValueOnce([]);

      await annotateStudyIfNeeded(1, '```\nAbraham was here\n```');

      expect(insertStudyAnnotations).not.toHaveBeenCalled();
    });

    it('skips matches in blockquote lines', async () => {
      setupEntityDb([
        makeEntity({ id: 'ABRAHAM_H85G', canonical_name: 'Abraham' }),
      ]);
      vi.mocked(getAnnotationsForStudy)
        .mockReturnValueOnce([])
        .mockReturnValueOnce([]);

      await annotateStudyIfNeeded(1, '> Abraham said something\nMore text here.');

      expect(insertStudyAnnotations).not.toHaveBeenCalled();
    });

    it('only annotates first mention of each entity', async () => {
      setupEntityDb([
        makeEntity({ id: 'ABRAHAM_H85G', canonical_name: 'Abraham' }),
      ]);

      const inserted: Omit<StudyEntityAnnotation, 'id' | 'created_at'>[] = [];
      vi.mocked(insertStudyAnnotations).mockImplementation((annotations) => {
        inserted.push(...annotations);
      });
      vi.mocked(getAnnotationsForStudy)
        .mockReturnValueOnce([])
        .mockReturnValueOnce([makeAnnotation()]);

      await annotateStudyIfNeeded(1, 'Abraham went out. Abraham returned.');

      expect(inserted).toHaveLength(1);
    });

    it('matches aliases', async () => {
      setupEntityDb([
        makeEntity({
          id: 'ABRAHAM_H85G',
          canonical_name: 'Abraham',
          aliases: JSON.stringify(['Abram']),
        }),
      ]);

      const inserted: Omit<StudyEntityAnnotation, 'id' | 'created_at'>[] = [];
      vi.mocked(insertStudyAnnotations).mockImplementation((annotations) => {
        inserted.push(...annotations);
      });
      vi.mocked(getAnnotationsForStudy)
        .mockReturnValueOnce([])
        .mockReturnValueOnce([makeAnnotation()]);

      await annotateStudyIfNeeded(1, 'Abram journeyed south.');

      expect(inserted).toHaveLength(1);
      expect(inserted[0].entity_id).toBe('ABRAHAM_H85G');
      expect(inserted[0].surface_text).toBe('Abram');
    });

    it('skips names shorter than 3 characters', async () => {
      setupEntityDb([
        makeEntity({ id: 'UR_PLACE', canonical_name: 'Ur', entity_type: 'place' }),
      ]);
      vi.mocked(getAnnotationsForStudy)
        .mockReturnValueOnce([])
        .mockReturnValueOnce([]);

      await annotateStudyIfNeeded(1, 'Ur of the Chaldeans was ancient.');

      expect(insertStudyAnnotations).not.toHaveBeenCalled();
    });

    it('skips fully-lowercase matches that collide with English words', async () => {
      // "mark my words" — the lowercase verb should NOT match the evangelist Mark.
      setupEntityDb([
        makeEntity({ id: 'MARK_G3138', canonical_name: 'Mark' }),
      ]);
      vi.mocked(getAnnotationsForStudy)
        .mockReturnValueOnce([])
        .mockReturnValueOnce([]);

      await annotateStudyIfNeeded(1, 'You mark my words — this will happen.');

      expect(insertStudyAnnotations).not.toHaveBeenCalled();
    });

    it('still matches capitalized single-word proper names', async () => {
      setupEntityDb([
        makeEntity({ id: 'MARK_G3138', canonical_name: 'Mark' }),
      ]);

      const inserted: Omit<StudyEntityAnnotation, 'id' | 'created_at'>[] = [];
      vi.mocked(insertStudyAnnotations).mockImplementation((annotations) => {
        inserted.push(...annotations);
      });
      vi.mocked(getAnnotationsForStudy)
        .mockReturnValueOnce([])
        .mockReturnValueOnce([makeAnnotation({ entity_id: 'MARK_G3138', surface_text: 'Mark' })]);

      await annotateStudyIfNeeded(1, 'Mark wrote the second gospel.');

      expect(inserted).toHaveLength(1);
      expect(inserted[0].entity_id).toBe('MARK_G3138');
      expect(inserted[0].surface_text).toBe('Mark');
    });

    it('accepts sentence-initial and ALL-CAPS forms', async () => {
      setupEntityDb([
        makeEntity({ id: 'PAUL_G3972G', canonical_name: 'Paul' }),
      ]);

      const inserted: Omit<StudyEntityAnnotation, 'id' | 'created_at'>[] = [];
      vi.mocked(insertStudyAnnotations).mockImplementation((annotations) => {
        inserted.push(...annotations);
      });
      vi.mocked(getAnnotationsForStudy)
        .mockReturnValueOnce([])
        .mockReturnValueOnce([makeAnnotation({ entity_id: 'PAUL_G3972G', surface_text: 'PAUL' })]);

      await annotateStudyIfNeeded(1, 'PAUL wrote Romans.');

      expect(inserted).toHaveLength(1);
      expect(inserted[0].entity_id).toBe('PAUL_G3972G');
    });

    it('skips fully-lowercase multi-word matches too', async () => {
      // "saul of tarsus" lowercase in casual typing should not annotate Paul.
      setupEntityDb([
        makeEntity({
          id: 'PAUL_G3972G',
          canonical_name: 'Paul',
          aliases: JSON.stringify(['Saul of Tarsus']),
        }),
      ]);
      vi.mocked(getAnnotationsForStudy)
        .mockReturnValueOnce([])
        .mockReturnValueOnce([]);

      await annotateStudyIfNeeded(1, 'we discussed saul of tarsus briefly.');

      expect(insertStudyAnnotations).not.toHaveBeenCalled();
    });

    it('skips matches that fall inside an idiomatic phrase ("Adam\'s apple")', async () => {
      setupEntityDb([
        makeEntity({ id: 'ADAM_H121', canonical_name: 'Adam' }),
      ]);
      vi.mocked(getAnnotationsForStudy)
        .mockReturnValueOnce([])
        .mockReturnValueOnce([]);

      await annotateStudyIfNeeded(1, "He has a prominent Adam's apple.");

      expect(insertStudyAnnotations).not.toHaveBeenCalled();
    });

    it('skips "raising Cain" but still annotates Cain elsewhere in the text', async () => {
      setupEntityDb([
        makeEntity({ id: 'CAIN_H7014', canonical_name: 'Cain' }),
      ]);

      const inserted: Omit<StudyEntityAnnotation, 'id' | 'created_at'>[] = [];
      vi.mocked(insertStudyAnnotations).mockImplementation((annotations) => {
        inserted.push(...annotations);
      });
      vi.mocked(getAnnotationsForStudy)
        .mockReturnValueOnce([])
        .mockReturnValueOnce([
          makeAnnotation({ entity_id: 'CAIN_H7014', surface_text: 'Cain' }),
        ]);

      // First mention is in the idiom (skip), second is a direct reference.
      // Annotator only annotates first valid mention per entity, so we expect
      // exactly one row pointing at the second occurrence.
      const text = 'They were raising Cain at the picnic. Later we read about Cain in Genesis.';
      await annotateStudyIfNeeded(1, text);

      expect(inserted).toHaveLength(1);
      expect(inserted[0].entity_id).toBe('CAIN_H7014');
      // Verify it landed on the *second* occurrence, not inside the idiom.
      expect(inserted[0].start_offset).toBeGreaterThan(text.indexOf('picnic'));
    });
  });

  describe('disambiguation', () => {
    it('uses context keywords to disambiguate ambiguous names', async () => {
      setupEntityDb([
        makeEntity({ id: 'HEROD_G2264G', canonical_name: 'Herod' }),
        makeEntity({ id: 'HEROD_G2264H', canonical_name: 'Herod' }),
      ]);

      const inserted: Omit<StudyEntityAnnotation, 'id' | 'created_at'>[] = [];
      vi.mocked(insertStudyAnnotations).mockImplementation((annotations) => {
        inserted.push(...annotations);
      });
      vi.mocked(getAnnotationsForStudy)
        .mockReturnValueOnce([])
        .mockReturnValueOnce([]);

      await annotateStudyIfNeeded(1, 'Herod the tetrarch of Galilee heard about Jesus.');

      expect(inserted).toHaveLength(1);
      expect(inserted[0].entity_id).toBe('HEROD_G2264H');
    });

    it('falls back to first candidate when no context keywords match', async () => {
      setupEntityDb([
        makeEntity({ id: 'HEROD_G2264G', canonical_name: 'Herod' }),
        makeEntity({ id: 'HEROD_G2264H', canonical_name: 'Herod' }),
      ]);

      const inserted: Omit<StudyEntityAnnotation, 'id' | 'created_at'>[] = [];
      vi.mocked(insertStudyAnnotations).mockImplementation((annotations) => {
        inserted.push(...annotations);
      });
      vi.mocked(getAnnotationsForStudy)
        .mockReturnValueOnce([])
        .mockReturnValueOnce([]);

      await annotateStudyIfNeeded(1, 'Herod was a ruler in ancient times.');

      expect(inserted).toHaveLength(1);
      expect(inserted[0].entity_id).toBe('HEROD_G2264G');
    });
  });

  describe('content normalization', () => {
    it('normalizes CRLF to LF', async () => {
      setupEntityDb([
        makeEntity({ id: 'ABRAHAM_H85G', canonical_name: 'Abraham' }),
      ]);

      const inserted: Omit<StudyEntityAnnotation, 'id' | 'created_at'>[] = [];
      vi.mocked(insertStudyAnnotations).mockImplementation((annotations) => {
        inserted.push(...annotations);
      });
      vi.mocked(getAnnotationsForStudy)
        .mockReturnValueOnce([])
        .mockReturnValueOnce([makeAnnotation()]);

      await annotateStudyIfNeeded(1, 'Abraham went.\r\nHe returned.');

      expect(inserted).toHaveLength(1);
      expect(inserted[0].start_offset).toBe(0);
      expect(inserted[0].end_offset).toBe(7);
    });
  });
});
