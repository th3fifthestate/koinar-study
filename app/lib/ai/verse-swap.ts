// app/lib/ai/verse-swap.ts
//
// Read-time translation swap utility.
// Studies are always stored as BSB text. This module is wired at read time
// by the Study Reader (Brief 07) — it is NOT called from the generate route.
import { getDb } from "@/lib/db/connection";
import { config } from "@/lib/config";

// ─── Verse cache ──────────────────────────────────────────────────────────────

function getCachedVerse(
  translation: string,
  book: string,
  chapter: number,
  verseStart: number,
  verseEnd: number
): string | null {
  const row = getDb()
    .prepare(
      `SELECT text FROM verse_cache
       WHERE translation = ? AND book = ? AND chapter = ?
         AND verse_start = ? AND verse_end = ?`
    )
    .get(translation, book, chapter, verseStart, verseEnd) as
    | { text: string }
    | undefined;
  return row?.text ?? null;
}

function cacheVerse(
  translation: string,
  book: string,
  chapter: number,
  verseStart: number,
  verseEnd: number,
  text: string
): void {
  getDb()
    .prepare(
      `INSERT OR REPLACE INTO verse_cache
         (translation, book, chapter, verse_start, verse_end, text)
       VALUES (?, ?, ?, ?, ?, ?)`
    )
    .run(translation, book, chapter, verseStart, verseEnd, text);
}

// ─── Reference parser ─────────────────────────────────────────────────────────

function parseReference(
  reference: string
): {
  book: string;
  chapter: number;
  verseStart: number;
  verseEnd: number;
} | null {
  // Matches: "John 3:16" or "1 Corinthians 13:4-7"
  const match = reference.match(/^(.+?)\s+(\d+):(\d+)(?:-(\d+))?$/);
  if (!match) return null;
  const [, book, chapter, verseStart, verseEnd] = match;
  const start = parseInt(verseStart, 10);
  return {
    book,
    chapter: parseInt(chapter, 10),
    verseStart: start,
    verseEnd: verseEnd ? parseInt(verseEnd, 10) : start,
  };
}

// ─── Translation fetchers ─────────────────────────────────────────────────────

async function fetchEsvVerse(reference: string): Promise<string | null> {
  const apiKey = config.bible.esvApiKey;
  if (!apiKey) return null;

  const url = new URL("https://api.esv.org/v3/passage/text/");
  url.searchParams.set("q", reference);
  url.searchParams.set("include-headings", "false");
  url.searchParams.set("include-footnotes", "false");
  url.searchParams.set("include-verse-numbers", "false");
  url.searchParams.set("include-short-copyright", "false");
  url.searchParams.set("include-passage-references", "false");

  try {
    const response = await fetch(url.toString(), {
      headers: { Authorization: `Token ${apiKey}` },
    });
    if (!response.ok) return null;
    const data = (await response.json()) as { passages?: string[] };
    return data.passages?.[0]?.trim() ?? null;
  } catch {
    return null;
  }
}

async function fetchTranslation(
  reference: string,
  translation: string
): Promise<string | null> {
  switch (translation.toLowerCase()) {
    case "esv":
      return fetchEsvVerse(reference);
    case "kjv":
    case "nlt":
    default:
      // No API configured for this translation — graceful fallback (BSB text preserved)
      return null;
  }
}

// ─── Main export ──────────────────────────────────────────────────────────────

/**
 * Replaces BSB verse text in generated study markdown with the target translation.
 *
 * Call at read time (Study Reader, Brief 07) — NOT during generation.
 * If a translation API is unavailable or returns nothing, BSB text is preserved.
 *
 * @param markdown - Study content as stored (always BSB)
 * @param targetTranslation - e.g. "esv", "kjv", "nlt" (case-insensitive)
 */
export async function swapTranslation(
  markdown: string,
  targetTranslation: string
): Promise<string> {
  if (targetTranslation.toLowerCase() === "bsb") return markdown;

  // Match blockquoted BSB verses: > "verse text" — Reference (BSB)
  const versePattern = /^>\s*"(.+?)"\s*—\s*(.+?)\s*\(BSB\)/gm;
  let result = markdown;
  const matches = [...markdown.matchAll(versePattern)];

  for (const match of matches) {
    const [fullMatch, , reference] = match;
    const parsed = parseReference(reference);
    if (!parsed) continue;

    // Check cache first
    const cached = getCachedVerse(
      targetTranslation,
      parsed.book,
      parsed.chapter,
      parsed.verseStart,
      parsed.verseEnd
    );

    const fetched =
      cached ?? (await fetchTranslation(reference, targetTranslation));

    if (fetched) {
      if (!cached) {
        try {
          cacheVerse(
            targetTranslation,
            parsed.book,
            parsed.chapter,
            parsed.verseStart,
            parsed.verseEnd,
            fetched
          );
        } catch {
          // Cache write failure is non-fatal
        }
      }
      const label = targetTranslation.toUpperCase();
      const newQuote = `> "${fetched}" — ${reference} (${label})`;
      result = result.replace(fullMatch, newQuote);
    }
    // If fetched is null, BSB text is preserved (graceful fallback)
  }

  return result;
}
