import type { LexiconEntry } from '../types';
import { getDb } from '../connection';

export function getLexiconEntry(strongsId: string): LexiconEntry | null {
  return (
    getDb()
      .prepare('SELECT * FROM lexicon_entries WHERE strongs_id = ?')
      .get(strongsId) as LexiconEntry | undefined
  ) ?? null;
}

// Escape SQLite LIKE wildcards so user input is treated as a literal substring.
function escapeLike(s: string): string {
  return s.replace(/\\/g, '\\\\').replace(/%/g, '\\%').replace(/_/g, '\\_');
}

export function searchLexicon(
  query: string,
  language?: 'hebrew' | 'greek',
  limit = 25,
): LexiconEntry[] {
  const db = getDb();
  const pattern = `%${escapeLike(query.trim())}%`;
  const langClause = language ? 'language = ? AND ' : '';
  const params: unknown[] = language
    ? [language, pattern, pattern, pattern, limit]
    : [pattern, pattern, pattern, limit];

  return db
    .prepare(
      `SELECT * FROM lexicon_entries
       WHERE ${langClause}(lemma LIKE ? ESCAPE '\\' OR transliteration LIKE ? ESCAPE '\\' OR gloss LIKE ? ESCAPE '\\')
       LIMIT ?`,
    )
    .all(...params) as LexiconEntry[];
}
