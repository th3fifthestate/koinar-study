import { describe, it, expect, beforeAll } from 'vitest';
import { getDb } from '../connection';
import { getLexiconEntry, searchLexicon } from './queries';

// ─── Skip guard ───────────────────────────────────────────────────────────────
// These tests require real data from the STEPBible ingest. If the table is
// empty, data-dependent tests are skipped with an instruction to populate it.

let tablePopulated = false;

beforeAll(() => {
  try {
    const db = getDb();
    const row = db.prepare('SELECT COUNT(*) as c FROM lexicon_entries').get() as { c: number };
    tablePopulated = row.c > 0;
  } catch {
    tablePopulated = false;
  }
});

function itWithData(title: string, fn: () => void): void {
  it(title, () => {
    if (!tablePopulated) {
      console.warn('lexicon_entries is empty — run: npm run ingest:stepbible');
      return;
    }
    fn();
  });
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('getLexiconEntry', () => {
  itWithData('returns the Hebrew entry for H0001 (אָב / father)', () => {
    const entry = getLexiconEntry('H0001');
    expect(entry).not.toBeNull();
    expect(entry!.language).toBe('hebrew');
    expect(entry!.lemma).toContain('א');
    expect(entry!.gloss.toLowerCase()).toContain('father');
  });

  itWithData('returns the Greek entry for G3056 (λόγος / word)', () => {
    const entry = getLexiconEntry('G3056');
    expect(entry).not.toBeNull();
    expect(entry!.language).toBe('greek');
    expect(entry!.lemma).toContain('λ');
    expect(entry!.gloss.toLowerCase()).toMatch(/word|logos/);
  });

  it('returns null for a non-existent ID', () => {
    expect(getLexiconEntry('X9999')).toBeNull();
  });
});

describe('searchLexicon', () => {
  itWithData('returns entries for "love" including at least one Hebrew and one Greek', () => {
    const results = searchLexicon('love');
    expect(results.length).toBeGreaterThan(0);
    const languages = new Set(results.map((r) => r.language));
    expect(languages.has('hebrew')).toBe(true);
    expect(languages.has('greek')).toBe(true);
  });

  itWithData('returns Greek entries for "logos" when language=greek', () => {
    const results = searchLexicon('logos', 'greek');
    expect(results.length).toBeGreaterThan(0);
    results.forEach((r) => expect(r.language).toBe('greek'));
  });

  itWithData('returns no results for "logos" when language=hebrew', () => {
    expect(searchLexicon('logos', 'hebrew')).toEqual([]);
  });
});
