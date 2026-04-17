// app/lib/translations/local-queries.ts
//
// Local-DB passage lookups for public-domain translations. BSB is wired up
// today; KJV and WEB stay deferred until their SQLite files are provisioned
// (see getAvailableTranslations() and brief §R5).

import { getVerseRange } from "@/lib/db/bible/queries";
import { TranslationNotAvailableError } from "./errors";

export interface LocalVerse {
  book: string;
  chapter: number;
  verse: number;
  text: string;
}

export type LocalTranslation = "BSB" | "KJV" | "WEB";

/**
 * Returns a verse range from a local translation DB.
 *   `book` accepts the same input as lib/db/bible/queries#normalizeBookName
 *   (full name, abbreviation, internal slug). For KJV/WEB the function throws
 *   TranslationNotAvailableError until their DBs land.
 */
export function getLocalPassage(
  translation: LocalTranslation,
  book: string,
  chapter: number,
  verseStart: number,
  verseEnd: number,
): LocalVerse[] {
  if (translation === "BSB") {
    return getVerseRange(book, chapter, verseStart, verseEnd).map((v) => ({
      book: v.book,
      chapter: v.chapter,
      verse: v.verse,
      text: v.text,
    }));
  }
  // TODO(brief-future): wire up KJV.db / WEB.db when provisioned.
  throw new TranslationNotAvailableError(translation);
}
