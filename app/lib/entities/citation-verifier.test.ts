import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { EntityCitation } from '@/lib/db/types';

vi.mock('@/lib/db/connection', () => ({
  getDb: vi.fn(),
}));

vi.mock('@/lib/db/bible/queries', () => ({
  getVerse: vi.fn(),
  lookupStrongs: vi.fn(),
  normalizeBookName: vi.fn(),
}));

import { verifyCitations, verifyAllCitations } from './citation-verifier';
import { getDb } from '@/lib/db/connection';
import { getVerse, lookupStrongs } from '@/lib/db/bible/queries';

// ─── Helpers ─────────────────────────────────────────────────────────────────

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

function setupMockDb(opts: {
  entityName?: string;
  citations?: EntityCitation[];
  entityIds?: { id: string }[];
}) {
  const mockDb = {
    prepare: vi.fn((sql: string) => {
      if (sql.includes('canonical_name') && sql.includes('entities')) {
        return {
          get: vi.fn().mockReturnValue(
            opts.entityName ? { canonical_name: opts.entityName } : undefined
          ),
        };
      }
      if (sql.includes('entity_citations')) {
        return {
          all: vi.fn().mockReturnValue(opts.citations ?? []),
        };
      }
      if (sql.includes('full_profile IS NOT NULL')) {
        return {
          all: vi.fn().mockReturnValue(opts.entityIds ?? []),
        };
      }
      return {
        get: vi.fn().mockReturnValue(undefined),
        all: vi.fn().mockReturnValue([]),
      };
    }),
  };
  vi.mocked(getDb).mockReturnValue(mockDb as never);
  return mockDb;
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('verifyCitations', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('returns zero issues for entity with no citations', () => {
    setupMockDb({ entityName: 'Abraham', citations: [] });

    const result = verifyCitations('ABRAHAM_H85G');
    expect(result.totalCitations).toBe(0);
    expect(result.verifiedCitations).toBe(0);
    expect(result.issues).toHaveLength(0);
  });

  it('returns entity ID as name when entity not found', () => {
    setupMockDb({ entityName: undefined, citations: [] });

    const result = verifyCitations('NONEXISTENT');
    expect(result.entityName).toBe('NONEXISTENT');
  });

  // ── Source approval ────────────────────────────────────────────────────

  describe('source approval', () => {
    it('approves exact match sources', () => {
      setupMockDb({
        entityName: 'Abraham',
        citations: [makeCitation({ source_name: 'Josephus' })],
      });

      const result = verifyCitations('ABRAHAM_H85G');
      expect(result.issues).toHaveLength(0);
      expect(result.verifiedCitations).toBe(1);
    });

    it('approves sources via prefix matching (e.g. "Tacitus, Annals 15.44")', () => {
      setupMockDb({
        entityName: 'Test',
        citations: [makeCitation({ source_name: 'Tacitus, Annals 15.44' })],
      });

      const result = verifyCitations('ABRAHAM_H85G');
      expect(result.issues).toHaveLength(0);
    });

    it('approves sources via substring matching (e.g. "OpenBible.info geocoding data")', () => {
      setupMockDb({
        entityName: 'Test',
        citations: [makeCitation({ source_name: 'OpenBible.info geocoding data' })],
      });

      const result = verifyCitations('ABRAHAM_H85G');
      expect(result.issues).toHaveLength(0);
    });

    it('flags unknown sources', () => {
      setupMockDb({
        entityName: 'Test',
        citations: [makeCitation({ source_name: 'Some Random Blog' })],
      });

      const result = verifyCitations('ABRAHAM_H85G');
      expect(result.issues).toHaveLength(1);
      expect(result.issues[0]).toContain('Unknown source');
      expect(result.issues[0]).toContain('Some Random Blog');
    });

    it('approves Viz.Bible-excluded but approves TIPNR', () => {
      setupMockDb({
        entityName: 'Test',
        citations: [
          makeCitation({ id: 1, source_name: 'TIPNR Dataset' }),
        ],
      });

      const result = verifyCitations('ABRAHAM_H85G');
      expect(result.issues).toHaveLength(0);
    });

    it.each([
      ['Josephus, Antiquities 18.63'],
      ['Eusebius, Ecclesiastical History 3.5'],
      ['Strabo, Geography 16.2.34'],
      ['Philo of Alexandria, On the Embassy to Gaius'],
      ['Mishnah Sanhedrin 10:1'],
      ['Babylonian Talmud, Shabbat 31a'],
      ['Dead Sea Scrolls — Great Isaiah Scroll'],
      ['ISBE'],
      ["Fausset's Bible Dictionary"],
      ['Tyndale Open Study Notes'],
      ['STEPBible Lexicon'],
      ['Sefaria'],
      ['Perseus Digital Library'],
      ['LacusCurtius'],
      ['British Museum collection'],
      ['Sennacherib Prism'],
      ['Cyrus Cylinder'],
      ['Lachish Letters'],
      ['Cassius Dio, Roman History'],
      ['Arch of Titus relief'],
      ['Elephantine Papyri'],
      ['Israel Antiquities Authority'],
      ['Septuagint (LXX)'],
    ])('approves "%s"', (sourceName) => {
      setupMockDb({
        entityName: 'Test',
        citations: [makeCitation({ source_name: sourceName })],
      });

      const result = verifyCitations('ABRAHAM_H85G');
      expect(result.issues).toHaveLength(0);
    });
  });

  // ── BSB verse validation ───────────────────────────────────────────────

  describe('BSB verse validation', () => {
    it('verifies BSB verse exists in database', () => {
      setupMockDb({
        entityName: 'Abraham',
        citations: [makeCitation({ source_name: 'BSB', source_ref: 'Genesis 12:1' })],
      });
      vi.mocked(getVerse).mockReturnValue({ text: 'Now the LORD said...' } as never);

      const result = verifyCitations('ABRAHAM_H85G');
      expect(result.issues).toHaveLength(0);
      expect(getVerse).toHaveBeenCalledWith('Genesis', 12, 1);
    });

    it('flags missing BSB verse', () => {
      setupMockDb({
        entityName: 'Abraham',
        citations: [makeCitation({ source_name: 'BSB', source_ref: 'Fake 99:99' })],
      });
      vi.mocked(getVerse).mockReturnValue(null as never);

      const result = verifyCitations('ABRAHAM_H85G');
      expect(result.issues).toHaveLength(1);
      expect(result.issues[0]).toContain('BSB verse not found');
    });

    it('also checks "Berean Standard Bible" source name', () => {
      setupMockDb({
        entityName: 'Abraham',
        citations: [makeCitation({ source_name: 'Berean Standard Bible', source_ref: 'Genesis 1:1' })],
      });
      vi.mocked(getVerse).mockReturnValue({ text: 'In the beginning...' } as never);

      const result = verifyCitations('ABRAHAM_H85G');
      expect(getVerse).toHaveBeenCalled();
    });

    it('skips verse check when source_ref is null', () => {
      setupMockDb({
        entityName: 'Abraham',
        citations: [makeCitation({ source_name: 'BSB', source_ref: null })],
      });

      const result = verifyCitations('ABRAHAM_H85G');
      expect(getVerse).not.toHaveBeenCalled();
      expect(result.issues).toHaveLength(0);
    });

    it('parses multi-book names like "1 Kings 6:1"', () => {
      setupMockDb({
        entityName: 'Solomon',
        citations: [makeCitation({ source_name: 'BSB', source_ref: '1 Kings 6:1' })],
      });
      vi.mocked(getVerse).mockReturnValue({ text: 'In the four hundred...' } as never);

      const result = verifyCitations('ABRAHAM_H85G');
      expect(getVerse).toHaveBeenCalledWith('1 Kings', 6, 1);
    });
  });

  // ── Strong's number validation ─────────────────────────────────────────

  describe("Strong's number validation", () => {
    it("validates Strong's numbers in excerpt", () => {
      setupMockDb({
        entityName: 'Abraham',
        citations: [
          makeCitation({
            source_name: 'Josephus',
            excerpt: 'The Hebrew word reshith (H7225) means beginning',
          }),
        ],
      });
      vi.mocked(lookupStrongs).mockReturnValue({ definition: 'beginning' } as never);

      const result = verifyCitations('ABRAHAM_H85G');
      expect(lookupStrongs).toHaveBeenCalledWith('H7225');
      expect(result.issues).toHaveLength(0);
    });

    it("flags missing Strong's numbers", () => {
      setupMockDb({
        entityName: 'Abraham',
        citations: [
          makeCitation({
            source_name: 'Josephus',
            excerpt: 'Greek word logos (G9999)',
          }),
        ],
      });
      vi.mocked(lookupStrongs).mockReturnValue(null as never);

      const result = verifyCitations('ABRAHAM_H85G');
      expect(result.issues).toHaveLength(1);
      expect(result.issues[0]).toContain("Strong's number not found: G9999");
    });

    it("extracts multiple Strong's numbers from one excerpt", () => {
      setupMockDb({
        entityName: 'Abraham',
        citations: [
          makeCitation({
            source_name: 'Josephus',
            excerpt: 'Words H7225 and G3056 appear here',
          }),
        ],
      });
      vi.mocked(lookupStrongs).mockReturnValue({ definition: 'something' } as never);

      const result = verifyCitations('ABRAHAM_H85G');
      expect(lookupStrongs).toHaveBeenCalledTimes(2);
      expect(lookupStrongs).toHaveBeenCalledWith('H7225');
      expect(lookupStrongs).toHaveBeenCalledWith('G3056');
    });

    it('skips Strong\'s check when excerpt is null', () => {
      setupMockDb({
        entityName: 'Abraham',
        citations: [makeCitation({ source_name: 'Josephus', excerpt: null })],
      });

      verifyCitations('ABRAHAM_H85G');
      expect(lookupStrongs).not.toHaveBeenCalled();
    });
  });

  // ── Aggregate results ──────────────────────────────────────────────────

  describe('aggregate results', () => {
    it('counts verified vs total correctly with mixed issues', () => {
      setupMockDb({
        entityName: 'Abraham',
        citations: [
          makeCitation({ id: 1, source_name: 'BSB', source_ref: 'Genesis 12:1', excerpt: null }),
          makeCitation({ id: 2, source_name: 'Unknown Blog', source_ref: null, excerpt: null }),
          makeCitation({ id: 3, source_name: 'Josephus', source_ref: null, excerpt: null }),
        ],
      });
      vi.mocked(getVerse).mockReturnValue({ text: 'verse' } as never);

      const result = verifyCitations('ABRAHAM_H85G');
      expect(result.totalCitations).toBe(3);
      expect(result.verifiedCitations).toBe(2); // BSB + Josephus pass, blog fails
      expect(result.issues).toHaveLength(1);
    });
  });
});

describe('verifyAllCitations', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('verifies citations for all entities with generated content', () => {
    const mockDb = {
      prepare: vi.fn((sql: string) => {
        if (sql.includes('full_profile IS NOT NULL')) {
          return {
            all: vi.fn().mockReturnValue([
              { id: 'A_H1G' },
              { id: 'B_H2G' },
            ]),
          };
        }
        if (sql.includes('canonical_name')) {
          return { get: vi.fn().mockReturnValue({ canonical_name: 'Test' }) };
        }
        if (sql.includes('entity_citations')) {
          return { all: vi.fn().mockReturnValue([]) };
        }
        return {
          get: vi.fn().mockReturnValue(undefined),
          all: vi.fn().mockReturnValue([]),
        };
      }),
    };
    vi.mocked(getDb).mockReturnValue(mockDb as never);

    const results = verifyAllCitations();
    expect(results).toHaveLength(2);
    expect(results[0].entityId).toBe('A_H1G');
    expect(results[1].entityId).toBe('B_H2G');
  });
});
