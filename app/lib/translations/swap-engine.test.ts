import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('./local-queries', () => ({
  getLocalPassage: vi.fn(),
}));
vi.mock('./cache', () => ({
  getCachedVerse: vi.fn().mockReturnValue(null),
  setCachedVerse: vi.fn(),
  enforceStorageCap: vi.fn(),
}));
vi.mock('./fums-tracker', () => ({
  recordFumsEvent: vi.fn(),
}));
vi.mock('./niv-display-guard', () => ({
  enforceNivPerViewCap: vi.fn((refs) => ({ allowedVerses: refs, truncated: false })),
}));
vi.mock('./api-bible-client', () => ({
  fetchApiBiblePassage: vi.fn(),
}));
vi.mock('./esv-client', () => ({
  fetchEsvPassage: vi.fn(),
}));

import { swapVerses } from './swap-engine';
import { getLocalPassage } from './local-queries';
import { getCachedVerse } from './cache';
import { fetchApiBiblePassage } from './api-bible-client';
import { enforceNivPerViewCap } from './niv-display-guard';

const FIXTURE_STUDY = `# The Light of the World

An introduction paragraph.

> In the beginning was the Word, and the Word was with God, and the Word was God. — John 1:1

More text follows.

> For God so loved the world that he gave his one and only Son. — John 3:16
`;

describe('swapVerses', () => {
  beforeEach(() => {
    vi.mocked(getLocalPassage).mockReset();
    vi.mocked(getCachedVerse).mockReset();
    vi.mocked(getCachedVerse).mockReturnValue(null);
    vi.mocked(fetchApiBiblePassage).mockReset();
    vi.mocked(enforceNivPerViewCap).mockReset();
    vi.mocked(enforceNivPerViewCap).mockImplementation((refs) => ({
      allowedVerses: refs,
      truncated: false,
    }));
  });

  it('returns BSB content unchanged when target is BSB', async () => {
    const result = await swapVerses(FIXTURE_STUDY, 'BSB', { studyId: 1, userId: 1 });
    expect(result.content).toBe(FIXTURE_STUDY);
    expect(result.versesSwapped).toBe(0);
  });

  it('swaps verses to KJV from local DB', async () => {
    vi.mocked(getLocalPassage)
      .mockReturnValueOnce([{ book: 'john', chapter: 1, verse: 1, text: 'In the beginning was the Word, and the Word was with God, and the Word was God.' }])
      .mockReturnValueOnce([{ book: 'john', chapter: 3, verse: 16, text: 'For God so loved the world, that he gave his only begotten Son.' }]);

    const result = await swapVerses(FIXTURE_STUDY, 'KJV', { studyId: 1, userId: 1 });
    expect(result.versesSwapped).toBe(2);
    expect(result.content).toContain('only begotten Son');
    expect(result.content).toContain('John 1:1');
    expect(result.content).toContain('John 3:16');
    expect(result.content).toContain('(KJV)');
    expect(result.missingVerses).toHaveLength(0);
  });

  it('records missing verses when lookup returns empty', async () => {
    vi.mocked(getLocalPassage).mockReturnValue([]);
    const result = await swapVerses(FIXTURE_STUDY, 'KJV', { studyId: 1, userId: 1 });
    expect(result.missingVerses.length).toBeGreaterThan(0);
    expect(result.missingVerses[0]).toMatchObject({ book: 'john' });
  });

  it('swaps NLT via api.bible and records one fetch per verse', async () => {
    vi.mocked(fetchApiBiblePassage)
      .mockResolvedValueOnce([
        { book: 'john', chapter: 1, verse: 1, text: 'NLT 1:1 text.', fumsToken: 't1' },
      ])
      .mockResolvedValueOnce([
        { book: 'john', chapter: 3, verse: 16, text: 'NLT 3:16 text.', fumsToken: 't2' },
      ]);
    const result = await swapVerses(FIXTURE_STUDY, 'NLT', { studyId: 1, userId: 1 });
    expect(result.versesSwapped).toBe(2);
    expect(result.content).toContain('NLT 1:1 text.');
    expect(result.content).toContain('(NLT)');
  });

  it('leaves BSB untouched when api.bible throws', async () => {
    vi.mocked(fetchApiBiblePassage).mockRejectedValue(new Error('upstream 500'));
    const result = await swapVerses(FIXTURE_STUDY, 'NLT', { studyId: 1, userId: 1 });
    expect(result.versesSwapped).toBe(0);
    expect(result.missingVerses.length).toBeGreaterThan(0);
    expect(result.content).toBe(FIXTURE_STUDY);
  });

  it('NIV cap drops verses past the per-view allowance', async () => {
    // Allow only John 1:1; John 3:16 must be trimmed.
    vi.mocked(enforceNivPerViewCap).mockReturnValueOnce({
      allowedVerses: [{ book: 'john', chapter: 1, verse: 1 }],
      truncated: true,
      reason: 'chapter-cap',
    });
    vi.mocked(fetchApiBiblePassage).mockResolvedValue([
      { book: 'john', chapter: 1, verse: 1, text: 'NIV 1:1 text.', fumsToken: 't' },
    ]);
    const result = await swapVerses(FIXTURE_STUDY, 'NIV', { studyId: 1, userId: 1 });
    expect(result.truncated).toBe(true);
    expect(result.content).toContain('NIV 1:1 text.');
    // The 3:16 block must keep its original BSB rendering (no NIV text fetched).
    expect(result.content).toContain('For God so loved the world that he gave his one and only Son.');
    expect(result.versesSwapped).toBe(1);
  });

  it('serves from cache on repeat hit without extra api.bible calls', async () => {
    vi.mocked(getCachedVerse).mockImplementation((_t, _b, ch, v) => ({
      text: `cached ${ch}:${v}`,
      fumsToken: 'cached-tok',
      leaseUntil: Date.now() + 1000,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    }) as any);
    const result = await swapVerses(FIXTURE_STUDY, 'NLT', { studyId: 1, userId: 1 });
    expect(result.versesSwapped).toBe(2);
    expect(result.content).toContain('cached 1:1');
    expect(fetchApiBiblePassage).not.toHaveBeenCalled();
  });
});
