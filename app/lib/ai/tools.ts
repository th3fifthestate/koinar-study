// app/lib/ai/tools.ts
import { tool } from "ai";
import { z } from "zod";
import {
  getVerse,
  getVerseRange,
  getChapter,
  searchVerses,
  searchVersesFts,
  getHebrewWords,
  getGreekWords,
  getLxxVerse,
  lookupStrongs,
  searchStrongs,
  getCrossReferences,
} from "@/lib/db/bible/queries";

export const queryVerse = tool({
  description:
    "Retrieve BSB (Berean Standard Bible) verse(s) by reference. Can get a single verse, a range of verses, or an entire chapter. ALWAYS use this tool to look up verses — never cite from memory.",
  inputSchema: z.object({
    book: z
      .string()
      .describe("Book name (e.g., 'Genesis', 'Romans', 'Psalm', '1 Corinthians')"),
    chapter: z.number().int().positive().describe("Chapter number"),
    startVerse: z
      .number()
      .int()
      .positive()
      .optional()
      .describe("Starting verse number. Omit to retrieve the full chapter."),
    endVerse: z
      .number()
      .int()
      .positive()
      .optional()
      .describe("Ending verse number for a range. Omit for a single verse."),
  }),
  execute: async ({ book, chapter, startVerse, endVerse }) => {
    if (!startVerse) {
      const verses = getChapter(book, chapter);
      if (verses.length === 0)
        return { error: `Chapter not found: ${book} ${chapter}` };
      return {
        verses: verses.map(
          (v) => `${v.book} ${v.chapter}:${v.verse} — ${v.text.trim()}`
        ),
      };
    }
    if (endVerse) {
      const verses = getVerseRange(book, chapter, startVerse, endVerse);
      if (verses.length === 0)
        return {
          error: `Verses not found: ${book} ${chapter}:${startVerse}-${endVerse}`,
        };
      return {
        verses: verses.map(
          (v) => `${v.book} ${v.chapter}:${v.verse} — ${v.text.trim()}`
        ),
      };
    }
    const verse = getVerse(book, chapter, startVerse);
    if (!verse)
      return { error: `Verse not found: ${book} ${chapter}:${startVerse}` };
    return {
      verse: `${verse.book} ${verse.chapter}:${verse.verse} — ${verse.text.trim()}`,
    };
  },
});

export const searchKeyword = tool({
  description:
    "Full-text search across the BSB Bible. Returns matching verses with their references. Use for finding where a topic, word, or phrase appears in scripture.",
  inputSchema: z.object({
    query: z.string().describe("Search term or phrase"),
    limit: z
      .number()
      .int()
      .min(1)
      .max(50)
      .optional()
      .default(20)
      .describe("Max results to return (default 20)"),
  }),
  execute: async ({ query, limit }) => {
    // Try FTS first (faster, pre-built index). Fall back to LIKE if FTS returns nothing.
    const ftsResult = searchVersesFts(query, limit);
    const verses = ftsResult.results.length > 0
      ? ftsResult.results
      : searchVerses(query, limit);
    if (verses.length === 0) return { error: `No results for: "${query}"` };
    return {
      count: verses.length,
      verses: verses.map(
        (v) => `${v.book} ${v.chapter}:${v.verse} — ${v.text.trim()}`
      ),
    };
  },
});

export const lookupStrongsNumber = tool({
  description:
    "Look up a Strong's Concordance entry by number (e.g., H1234 for Hebrew, G5678 for Greek). Returns the original word, transliteration, pronunciation, and full definition.",
  inputSchema: z.object({
    strongsNumber: z
      .string()
      .describe("Strong's number (e.g., 'H7225' or 'G3056')"),
  }),
  execute: async ({ strongsNumber }) => {
    const entry = lookupStrongs(strongsNumber);
    if (!entry) {
      const results = searchStrongs(strongsNumber, 5);
      if (results.length > 0) {
        return {
          results: results.map((e) => ({
            number: e.number,
            lemma: e.lemma,
            description: e.description,
          })),
        };
      }
      return { error: `Strong's number not found: ${strongsNumber}` };
    }
    return {
      number: entry.number,
      lemma: entry.lemma,
      transliteration: entry.xlit,
      pronunciation: entry.pronounce,
      definition: entry.description,
    };
  },
});

export const originalLanguage = tool({
  description:
    "Get the original language word breakdown for a Bible verse. Returns Hebrew words (Old Testament), Greek words (New Testament), and LXX Greek (Septuagint, for Old Testament). Each word includes Strong's numbers for further lookup with lookup_strongs.",
  inputSchema: z.object({
    book: z.string().describe("Book name"),
    chapter: z.number().int().positive().describe("Chapter number"),
    verse: z.number().int().positive().describe("Verse number"),
  }),
  execute: async ({ book, chapter, verse }) => {
    const hebrew = getHebrewWords(book, chapter, verse);
    const greek = getGreekWords(book, chapter, verse);
    const lxx = getLxxVerse(book, chapter, verse);

    const result: Record<string, unknown> = {};

    if (hebrew.length > 0) {
      result.hebrew = hebrew.map((w) => ({
        word: w.hebrew_text,
        strongs: w.strongs,
        morphology: w.morphology,
        transliteration: w.transliteration,
      }));
    }

    if (greek.length > 0) {
      result.greek = greek.map((w) => ({
        word: w.greek_text,
        strongs: w.strongs,
        morphology: w.morphology,
        transliteration: w.transliteration,
      }));
    }

    if (lxx.length > 0) {
      result.lxx = lxx.map((w) => ({
        word: w.greek_text,
        strongs: w.strongs,
        morphology: w.morphology,
      }));
    }

    if (Object.keys(result).length === 0) {
      return {
        error: `No original language data found for ${book} ${chapter}:${verse}`,
      };
    }

    return result;
  },
});

export const lookupCrossReferences = tool({
  description:
    "Look up cross-references for a Bible verse. Returns the most relevant related passages ranked by community votes, with their BSB text. Use this for every verse you cite to find related passages.",
  inputSchema: z.object({
    book: z
      .string()
      .describe("Book name (e.g., 'Genesis', 'John', 'Psalm')"),
    chapter: z.number().int().positive().describe("Chapter number"),
    verse: z.number().int().positive().describe("Verse number"),
    limit: z
      .number()
      .int()
      .min(1)
      .max(20)
      .optional()
      .default(8)
      .describe("Max results (default 8)"),
  }),
  execute: async ({ book, chapter, verse, limit }) => {
    const refs = getCrossReferences(book, chapter, verse, limit, true);
    if (refs.length === 0) {
      return {
        error: `No cross-references found for ${book} ${chapter}:${verse}`,
      };
    }
    return {
      count: refs.length,
      crossReferences: refs.map((r) => {
        const refStr =
          r.toVerseStart === r.toVerseEnd
            ? `${r.toBook} ${r.toChapter}:${r.toVerseStart}`
            : `${r.toBook} ${r.toChapter}:${r.toVerseStart}-${r.toVerseEnd}`;
        return {
          reference: refStr,
          votes: r.votes,
          text: r.text,
        };
      }),
    };
  },
});

export const studyTools = {
  query_verse: queryVerse,
  search_keyword: searchKeyword,
  lookup_strongs: lookupStrongsNumber,
  original_language: originalLanguage,
  lookup_cross_references: lookupCrossReferences,
};
