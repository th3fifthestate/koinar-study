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

import { swapVerses } from './swap-engine';
import { getLocalPassage } from './local-queries';
import { getCachedVerse } from './cache';

const FIXTURE_STUDY = `# The Light of the World

An introduction paragraph.

> In the beginning was the Word, and the Word was with God, and the Word was God. — John 1:1

More text follows.

> For God so loved the world that he gave his one and only Son. — John 3:16
`;

describe('swapVerses', () => {
  beforeEach(() => {
    vi.mocked(getLocalPassage).mockReset();
    vi.mocked(getCachedVerse).mockReturnValue(null);
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
});
