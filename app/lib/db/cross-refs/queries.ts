import { getDb } from '../connection';
import type { CrossRef } from '../types';

let _stmt: ReturnType<ReturnType<typeof getDb>['prepare']> | null = null;

function getStmt() {
  if (!_stmt) {
    _stmt = getDb().prepare(`
      SELECT *
      FROM cross_refs
      WHERE from_book = ? AND from_chapter = ? AND from_verse = ?
      ORDER BY votes DESC NULLS LAST, to_book ASC, to_chapter ASC, to_verse_start ASC
      LIMIT 50
    `);
  }
  return _stmt;
}

export function getCrossRefsFor(book: string, chapter: number, verse: number): CrossRef[] {
  return getStmt().all([book, chapter, verse]) as CrossRef[];
}
