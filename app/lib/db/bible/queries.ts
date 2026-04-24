import Database from "better-sqlite3";
import path from "path";
import { config } from "@/lib/config";
import { getBsbDb, getHebrewGreekDb, getStrongsDb, getCrossRefsDb } from "./connection";
import type {
  BsbVerse,
  HebrewWord,
  GreekWord,
  LxxWord,
  StrongsEntry,
  CrossReference,
  FtsSearchResult,
  BookInfo,
} from "./types";

// ============================================
// Book name normalization
// ============================================

const BOOK_ALIASES: Record<string, string> = {
  gen: "Genesis", ge: "Genesis", gn: "Genesis",
  exo: "Exodus", ex: "Exodus",
  lev: "Leviticus", le: "Leviticus", lv: "Leviticus",
  num: "Numbers", nu: "Numbers", nm: "Numbers",
  deu: "Deuteronomy", de: "Deuteronomy", dt: "Deuteronomy",
  jos: "Joshua", jsh: "Joshua",
  jdg: "Judges", jg: "Judges",
  rut: "Ruth", ru: "Ruth", rth: "Ruth",
  "1sa": "1 Samuel", "1sm": "1 Samuel", "1 sam": "1 Samuel",
  "2sa": "2 Samuel", "2sm": "2 Samuel", "2 sam": "2 Samuel",
  "1ki": "1 Kings", "1kg": "1 Kings", "1 kgs": "1 Kings",
  "2ki": "2 Kings", "2kg": "2 Kings", "2 kgs": "2 Kings",
  "1ch": "1 Chronicles", "1 chr": "1 Chronicles",
  "2ch": "2 Chronicles", "2 chr": "2 Chronicles",
  ezr: "Ezra",
  neh: "Nehemiah", ne: "Nehemiah",
  est: "Esther",
  job: "Job", jb: "Job",
  psa: "Psalms", ps: "Psalms", psm: "Psalms", psalm: "Psalms",
  pro: "Proverbs", pr: "Proverbs", prv: "Proverbs",
  ecc: "Ecclesiastes", ec: "Ecclesiastes", qoh: "Ecclesiastes",
  sng: "Song of Solomon", sol: "Song of Solomon", sos: "Song of Solomon", "song of songs": "Song of Solomon",
  isa: "Isaiah", is: "Isaiah",
  jer: "Jeremiah", je: "Jeremiah",
  lam: "Lamentations", la: "Lamentations",
  eze: "Ezekiel", ezk: "Ezekiel",
  dan: "Daniel", da: "Daniel", dn: "Daniel",
  hos: "Hosea", ho: "Hosea",
  joe: "Joel", jl: "Joel",
  amo: "Amos", am: "Amos",
  oba: "Obadiah", ob: "Obadiah",
  jon: "Jonah", jnh: "Jonah",
  mic: "Micah", mi: "Micah",
  nah: "Nahum", na: "Nahum",
  hab: "Habakkuk",
  zep: "Zephaniah", zph: "Zephaniah",
  hag: "Haggai", hg: "Haggai",
  zec: "Zechariah", zch: "Zechariah",
  mal: "Malachi", ml: "Malachi",
  mat: "Matthew", mt: "Matthew", matt: "Matthew",
  mrk: "Mark", mk: "Mark", mar: "Mark",
  luk: "Luke", lk: "Luke",
  jhn: "John", jn: "John",
  act: "Acts", ac: "Acts",
  rom: "Romans", ro: "Romans", rm: "Romans",
  "1co": "1 Corinthians", "1 cor": "1 Corinthians",
  "2co": "2 Corinthians", "2 cor": "2 Corinthians",
  gal: "Galatians", ga: "Galatians",
  eph: "Ephesians",
  php: "Philippians", phi: "Philippians", phil: "Philippians",
  col: "Colossians",
  "1th": "1 Thessalonians", "1 thess": "1 Thessalonians",
  "2th": "2 Thessalonians", "2 thess": "2 Thessalonians",
  "1ti": "1 Timothy", "1 tim": "1 Timothy",
  "2ti": "2 Timothy", "2 tim": "2 Timothy",
  tit: "Titus",
  phm: "Philemon", phlm: "Philemon",
  heb: "Hebrews",
  jas: "James", jm: "James",
  "1pe": "1 Peter", "1pt": "1 Peter", "1 pet": "1 Peter",
  "2pe": "2 Peter", "2pt": "2 Peter", "2 pet": "2 Peter",
  "1jn": "1 John", "1 jn": "1 John", "1jo": "1 John",
  "2jn": "2 John", "2 jn": "2 John", "2jo": "2 John",
  "3jn": "3 John", "3 jn": "3 John", "3jo": "3 John",
  jud: "Jude", jde: "Jude",
  rev: "Revelation", re: "Revelation", rv: "Revelation",
};

export function normalizeBookName(input: string): string | null {
  const lower = input.trim().toLowerCase();

  // Try direct match on aliases
  if (BOOK_ALIASES[lower]) return BOOK_ALIASES[lower];

  const db = getBsbDb();

  // Try direct full-name match
  const row = db
    .prepare("SELECT name FROM BSB_books WHERE LOWER(name) = ?")
    .get(lower) as { name: string } | undefined;
  if (row) return row.name;

  // The BSB database stores numbered books with Roman numerals
  // ("I Samuel", "II Kings", "III John"). Citations commonly use
  // Arabic numerals ("1 Samuel", "2 Kings"), so normalize the prefix
  // before querying again.
  let romanized: string | null = null;
  if (/^3\s+/.test(lower)) romanized = lower.replace(/^3\s+/, "iii ");
  else if (/^2\s+/.test(lower)) romanized = lower.replace(/^2\s+/, "ii ");
  else if (/^1\s+/.test(lower)) romanized = lower.replace(/^1\s+/, "i ");

  if (romanized) {
    const romanRow = db
      .prepare("SELECT name FROM BSB_books WHERE LOWER(name) = ?")
      .get(romanized) as { name: string } | undefined;
    if (romanRow) return romanRow.name;
  }

  // Partial match (handles e.g. "Revelation" → "Revelation of John")
  const partial = db
    .prepare("SELECT name FROM BSB_books WHERE LOWER(name) LIKE ?")
    .get(`${lower}%`) as { name: string } | undefined;
  if (partial) return partial.name;

  if (romanized) {
    const partialRoman = db
      .prepare("SELECT name FROM BSB_books WHERE LOWER(name) LIKE ?")
      .get(`${romanized}%`) as { name: string } | undefined;
    if (partialRoman) return partialRoman.name;
  }

  return null;
}

// ============================================
// Helper: book ID lookups
// ============================================

export function getBookId(bookName: string): number | null {
  const db = getBsbDb();
  const row = db
    .prepare("SELECT id FROM BSB_books WHERE LOWER(name) = LOWER(?)")
    .get(bookName) as { id: number } | undefined;
  return row?.id ?? null;
}

export function getHebrewGreekBookId(bookName: string): number | null {
  const db = getHebrewGreekDb();
  const row = db
    .prepare("SELECT book_id FROM books WHERE LOWER(book_name) = LOWER(?)")
    .get(bookName) as { book_id: number } | undefined;
  return row?.book_id ?? null;
}

export function getLxxBookId(bookName: string): number | null {
  const db = getHebrewGreekDb();
  const row = db
    .prepare("SELECT book_id FROM lxx_books WHERE LOWER(book_name) = LOWER(?)")
    .get(bookName) as { book_id: number } | undefined;
  return row?.book_id ?? null;
}

// ============================================
// BSB Queries
// ============================================

export function getVerse(book: string, chapter: number, verse: number): BsbVerse | null {
  const bookName = normalizeBookName(book);
  if (!bookName) return null;
  const bookId = getBookId(bookName);
  if (!bookId) return null;

  const db = getBsbDb();
  const row = db
    .prepare(
      "SELECT b.name as book, v.chapter, v.verse, v.text FROM BSB_verses v JOIN BSB_books b ON v.book_id = b.id WHERE v.book_id = ? AND v.chapter = ? AND v.verse = ?"
    )
    .get(bookId, chapter, verse) as BsbVerse | undefined;
  return row ?? null;
}

export function getVerseRange(
  book: string,
  chapter: number,
  startVerse: number,
  endVerse: number
): BsbVerse[] {
  const bookName = normalizeBookName(book);
  if (!bookName) return [];
  const bookId = getBookId(bookName);
  if (!bookId) return [];

  const db = getBsbDb();
  return db
    .prepare(
      "SELECT b.name as book, v.chapter, v.verse, v.text FROM BSB_verses v JOIN BSB_books b ON v.book_id = b.id WHERE v.book_id = ? AND v.chapter = ? AND v.verse BETWEEN ? AND ? ORDER BY v.verse"
    )
    .all(bookId, chapter, startVerse, endVerse) as BsbVerse[];
}

export function getChapter(book: string, chapter: number): BsbVerse[] {
  const bookName = normalizeBookName(book);
  if (!bookName) return [];
  const bookId = getBookId(bookName);
  if (!bookId) return [];

  const db = getBsbDb();
  return db
    .prepare(
      "SELECT b.name as book, v.chapter, v.verse, v.text FROM BSB_verses v JOIN BSB_books b ON v.book_id = b.id WHERE v.book_id = ? AND v.chapter = ? ORDER BY v.verse"
    )
    .all(bookId, chapter) as BsbVerse[];
}

export function searchVerses(query: string, limit = 20): BsbVerse[] {
  const db = getBsbDb();
  const escaped = query.replace(/[%_]/g, "\\$&");
  return db
    .prepare(
      "SELECT b.name as book, v.chapter, v.verse, v.text FROM BSB_verses v JOIN BSB_books b ON v.book_id = b.id WHERE v.text LIKE ? ESCAPE '\\' LIMIT ?"
    )
    .all(`%${escaped}%`, limit) as BsbVerse[];
}

// ============================================
// Full-Text Search (FTS5)
// ============================================

let ftsDb: Database.Database | null = null;

function getFtsDb(): Database.Database {
  if (ftsDb) return ftsDb;

  const bsbPath = config.db.bsb;
  const ftsPath = path.join(path.dirname(bsbPath), "bsb_fts.db");

  ftsDb = new Database(ftsPath, { readonly: true });

  return ftsDb;
}

// One-shot: regenerates `bsb_fts.db` from the BSB source DB. Invoked by
// the out-of-tree `build-fts-index` step of the bible-data pipeline; kept
// here so the SQL stays alongside the schema it owns. Export (vs. strip)
// keeps future FTS rebuilds a single import away.
// eslint-disable-next-line @typescript-eslint/no-unused-vars -- called from the bible-data pipeline
export function buildFtsIndex(db: Database.Database): void {
  const bsb = getBsbDb();

  db.prepare(`
    CREATE VIRTUAL TABLE bsb_fts USING fts5(
      book, chapter UNINDEXED, verse UNINDEXED, text,
      tokenize='porter unicode61'
    )
  `).run();

  const insert = db.prepare(
    "INSERT INTO bsb_fts(book, chapter, verse, text) VALUES (?, ?, ?, ?)"
  );

  const rows = bsb
    .prepare(
      "SELECT b.name as book, v.chapter, v.verse, v.text FROM BSB_verses v JOIN BSB_books b ON v.book_id = b.id ORDER BY v.book_id, v.chapter, v.verse"
    )
    .all() as BsbVerse[];

  const insertAll = db.transaction(() => {
    for (const row of rows) {
      insert.run(row.book, row.chapter, row.verse, row.text);
    }
  });
  insertAll();
}

export function searchVersesFts(
  query: string,
  limit = 20,
  offset = 0
): { results: FtsSearchResult[]; total: number } {
  const db = getFtsDb();

  const sanitized = query
    .replace(/['"()*:^~\-\\]/g, "")
    .trim();

  if (!sanitized || !/[a-zA-Z0-9]/.test(sanitized)) return { results: [], total: 0 };

  const total = db
    .prepare("SELECT COUNT(*) as cnt FROM bsb_fts WHERE bsb_fts MATCH ?")
    .get(sanitized) as { cnt: number };

  const results = db
    .prepare(
      `SELECT book, chapter, verse, text, rank,
              snippet(bsb_fts, 3, '<mark>', '</mark>', '...', 40) as snippet
       FROM bsb_fts WHERE bsb_fts MATCH ?
       ORDER BY rank
       LIMIT ? OFFSET ?`
    )
    .all(sanitized, limit, offset) as FtsSearchResult[];

  return { results, total: total.cnt };
}

// ============================================
// Hebrew Queries
// ============================================

export function getHebrewWords(book: string, chapter: number, verse: number): HebrewWord[] {
  const bookName = normalizeBookName(book);
  if (!bookName) return [];
  const bookId = getHebrewGreekBookId(bookName);
  if (!bookId) return [];

  const db = getHebrewGreekDb();
  return db
    .prepare(
      `SELECT bk.book_name as book, h.chapter, h.verse, h.word_num, h.hebrew_text, h.strongs, h.morphology, h.transliteration
       FROM hebrew_verses h JOIN books bk ON h.book = bk.book_id
       WHERE h.book = ? AND h.chapter = ? AND h.verse = ?
       ORDER BY h.word_num`
    )
    .all(bookId, chapter, verse) as HebrewWord[];
}

export function searchByStrongsHebrew(strongsNum: string, limit = 30): HebrewWord[] {
  const db = getHebrewGreekDb();
  return db
    .prepare(
      `SELECT bk.book_name as book, h.chapter, h.verse, h.word_num, h.hebrew_text, h.strongs, h.morphology, h.transliteration
       FROM hebrew_verses h JOIN books bk ON h.book = bk.book_id
       WHERE h.strongs = ?
       LIMIT ?`
    )
    .all(strongsNum, limit) as HebrewWord[];
}

// ============================================
// Greek Queries
// ============================================

export function getGreekWords(book: string, chapter: number, verse: number): GreekWord[] {
  const bookName = normalizeBookName(book);
  if (!bookName) return [];
  const bookId = getHebrewGreekBookId(bookName);
  if (!bookId) return [];

  const db = getHebrewGreekDb();
  return db
    .prepare(
      `SELECT bk.book_name as book, g.chapter, g.verse, g.word_num, g.greek_text, g.strongs, g.morphology, g.transliteration
       FROM greek_verses g JOIN books bk ON g.book = bk.book_id
       WHERE g.book = ? AND g.chapter = ? AND g.verse = ?
       ORDER BY g.word_num`
    )
    .all(bookId, chapter, verse) as GreekWord[];
}

export function searchByStrongsGreek(strongsNum: string, limit = 30): GreekWord[] {
  const db = getHebrewGreekDb();
  return db
    .prepare(
      `SELECT bk.book_name as book, g.chapter, g.verse, g.word_num, g.greek_text, g.strongs, g.morphology, g.transliteration
       FROM greek_verses g JOIN books bk ON g.book = bk.book_id
       WHERE g.strongs = ?
       LIMIT ?`
    )
    .all(strongsNum, limit) as GreekWord[];
}

// ============================================
// LXX Queries
// ============================================

export function getLxxVerse(book: string, chapter: number, verse: number): LxxWord[] {
  const bookName = normalizeBookName(book);
  if (!bookName) return [];
  const bookId = getLxxBookId(bookName);
  if (!bookId) return [];

  const db = getHebrewGreekDb();
  return db
    .prepare(
      `SELECT lb.book_name as book, l.chapter, l.verse, l.word_num, l.greek_text, l.strongs, l.morphology
       FROM lxx_verses l JOIN lxx_books lb ON l.book = lb.book_id
       WHERE l.book = ? AND l.chapter = ? AND l.verse = ?
       ORDER BY l.word_num`
    )
    .all(bookId, chapter, verse) as LxxWord[];
}

export function getLxxChapter(book: string, chapter: number): LxxWord[] {
  const bookName = normalizeBookName(book);
  if (!bookName) return [];
  const bookId = getLxxBookId(bookName);
  if (!bookId) return [];

  const db = getHebrewGreekDb();
  return db
    .prepare(
      `SELECT lb.book_name as book, l.chapter, l.verse, l.word_num, l.greek_text, l.strongs, l.morphology
       FROM lxx_verses l JOIN lxx_books lb ON l.book = lb.book_id
       WHERE l.book = ? AND l.chapter = ?
       ORDER BY l.verse, l.word_num`
    )
    .all(bookId, chapter) as LxxWord[];
}

export function searchLxx(query: string, limit = 20): LxxWord[] {
  const db = getHebrewGreekDb();
  return db
    .prepare(
      `SELECT lb.book_name as book, l.chapter, l.verse, l.word_num, l.greek_text, l.strongs, l.morphology
       FROM lxx_verses l JOIN lxx_books lb ON l.book = lb.book_id
       WHERE l.greek_text LIKE ?
       LIMIT ?`
    )
    .all(`%${query}%`, limit) as LxxWord[];
}

// ============================================
// Strong's Queries
// ============================================

export function lookupStrongs(strongsNumber: string): StrongsEntry | null {
  const db = getStrongsDb();
  const row = db
    .prepare("SELECT * FROM strongs WHERE number = ?")
    .get(strongsNumber) as StrongsEntry | undefined;
  return row ?? null;
}

export function searchStrongs(query: string, limit = 20): StrongsEntry[] {
  const db = getStrongsDb();
  return db
    .prepare(
      "SELECT * FROM strongs WHERE description LIKE ? OR lemma LIKE ? LIMIT ?"
    )
    .all(`%${query}%`, `%${query}%`, limit) as StrongsEntry[];
}

/**
 * Extract a short English gloss from a Strong's description.
 */
function extractGloss(desc: string): string {
  const colonDashIdx = desc.indexOf(":--");
  if (colonDashIdx > 0) {
    const beforeDash = desc.slice(0, colonDashIdx);
    const segments = beforeDash.split(";").map((s) => s.trim()).filter((s) => s.length > 0);
    const techSkip = /^(from|a pr(imary|olonged)|of uncertain|perhaps|apparently|probably|prolonged|by contraction|or\s+\(|compare|the same|often|also|used|including|greatly|very widely)/i;
    for (const seg of segments) {
      const stripped = seg
        .replace(/\s*\([^)]*\)/g, "")
        .replace(/\s*\([^)]*$/g, "")
        .replace(/\)+$/g, "")
        .trim();
      if (/[\u0590-\u05FF\u0370-\u03FF]/.test(stripped)) continue;
      if (techSkip.test(stripped)) continue;
      let clean = stripped
        .replace(/^(properly|i\.e\.|literally|figuratively|by implication|by extension|generally|intransitively|transitively|by Hebraism|especially),?\s*/gi, "")
        .replace(/^the\s+(reflexive|reciprocal|demonstrative|personal|relative|definite|indefinite)\s+(pronoun|article)\s*/i, "")
        .trim();
      clean = clean.split(",")[0].trim();
      if (clean.length > 2 && clean.length < 50 && !/^(often|also|by|with|and)\s/i.test(clean)) {
        return clean.replace(/['"]+/g, "").slice(0, 40);
      }
    }

    const afterDash = desc.slice(colonDashIdx + 3).trim();
    if (afterDash) {
      const terms = afterDash.split(",").map((t) => t.trim().replace(/[()[\]{}]+/g, "").replace(/[\u0590-\u05FF\u0370-\u03FF]+/g, "").trim()).filter((t) => t.length >= 2 && t.length < 30 && /^[a-zA-Z]/.test(t));
      if (terms.length > 0) {
        const preferred = terms.find((t) => !/^(the|a|an)$/i.test(t)) ?? terms[0];
        return preferred.replace(/['"]+/g, "").replace(/-$/, "").slice(0, 40);
      }
    }
  }

  const parts = desc.split(";").map((s) => s.trim()).filter((s) => s.length > 0);

  const skipPatterns = [
    /^from\s/i,
    /^a primitive/i,
    /^rarely\s/i,
    /^by contraction/i,
    /^prolonged\s/i,
    /^feminine\s+of/i,
    /^masculine\s/i,
    /^plural\s/i,
    /^or\s+\(/i,
    /^indicating\s/i,
    /^used\s+(only|as)\s/i,
    /^often\s/i,
    /^very\s+widely/i,
    /^compare\s/i,
    /^\([\w\s]+\d/i,
  ];

  const stripPrefixes = [
    /^properly,?\s*/i,
    /^i\.e\.?\s*/i,
    /^by\s+(implication|extension),?\s*/i,
    /^\(the\)\s*/i,
    /^literally,?\s*/i,
    /^figuratively,?\s*/i,
    /^concretely,?\s*/i,
    /^abstractly,?\s*/i,
    /^generally,?\s*/i,
    /^intransitively,?\s*/i,
    /^transitively,?\s*/i,
    /^reflexively\)?,?\s*/i,
    /^in a favorable sense\)?,?\s*/i,
  ];

  for (const part of parts) {
    if (/[\u0590-\u05FF\u0370-\u03FF]/.test(part)) continue;
    if (skipPatterns.some((p) => p.test(part))) continue;

    let clean = part;
    for (const prefix of stripPrefixes) {
      clean = clean.replace(prefix, "");
    }
    clean = clean.replace(/^\(the\)\s*/i, "the ");
    clean = clean.replace(/\[.*?\]/g, "").trim();
    clean = clean.replace(/\s*\([^)]*\)/g, "");
    clean = clean.replace(/\s*\([^)]*$/g, "");
    clean = clean.trim();

    const firstChunk = clean.split(",")[0].trim();
    if (firstChunk.length > 2 && firstChunk.length < 50) {
      return firstChunk.slice(0, 40);
    }
  }
  return parts[0]?.replace(/[\u0590-\u05FF\u0370-\u03FF]+/g, "").trim().slice(0, 40) ?? "";
}

/**
 * Extract English keywords from a Strong's description for verse-text matching.
 */
function extractKeywords(desc: string): string[] {
  const cleaned = desc
    .replace(/[\u0590-\u05FF\u0370-\u03FF]+/g, "")
    .replace(/\[.*?\]/g, "")
    .replace(/\(.*?\)/g, "");
  const stopWords = new Set([
    "the", "and", "for", "from", "with", "that", "this", "not", "but",
    "are", "was", "were", "been", "being", "have", "has", "had", "its",
    "also", "very", "same", "than", "more", "most", "such", "only",
    "primitive", "root", "rarely", "fully", "properly", "implication",
    "extension", "intransitively", "transitively", "figuratively",
    "literally", "generally", "especially", "sometimes", "often",
    "abstract", "concrete", "causative", "denominative", "particle",
    "compare", "corresponding", "apparently", "perhaps", "probably",
    "used", "make", "made", "use", "phrase", "idiom",
  ]);
  const words = cleaned.match(/[a-zA-Z]{3,}/g) ?? [];
  return [...new Set(words.filter((w) => !stopWords.has(w.toLowerCase())).map((w) => w.toLowerCase()))];
}

export function lookupStrongsBatch(
  numbers: string[]
): Map<string, { gloss: string; keywords: string[] }> {
  if (numbers.length === 0) return new Map();
  const db = getStrongsDb();
  const placeholders = numbers.map(() => "?").join(",");
  const rows = db
    .prepare(`SELECT number, description FROM strongs WHERE number IN (${placeholders})`)
    .all(...numbers) as { number: string; description: string }[];
  const map = new Map<string, { gloss: string; keywords: string[] }>();
  for (const row of rows) {
    map.set(row.number, {
      gloss: extractGloss(row.description),
      keywords: extractKeywords(row.description),
    });
  }
  return map;
}

// ============================================
// Book / Chapter helpers
// ============================================

export function getBookList(): BookInfo[] {
  const db = getBsbDb();
  return db
    .prepare(
      `SELECT b.name, MAX(v.chapter) as chapters
       FROM BSB_books b JOIN BSB_verses v ON v.book_id = b.id
       GROUP BY b.id
       ORDER BY b.id`
    )
    .all() as BookInfo[];
}

export function getChapterCount(book: string): number {
  const bookName = normalizeBookName(book);
  if (!bookName) return 0;
  const bookId = getBookId(bookName);
  if (!bookId) return 0;

  const db = getBsbDb();
  const row = db
    .prepare("SELECT MAX(chapter) as count FROM BSB_verses WHERE book_id = ?")
    .get(bookId) as { count: number } | undefined;
  return row?.count ?? 0;
}

// ============================================
// Cross-Reference Queries
// ============================================

let bookIdToName: Map<number, string> | null = null;

function getBookIdToName(): Map<number, string> {
  if (bookIdToName) return bookIdToName;
  const db = getBsbDb();
  const rows = db
    .prepare("SELECT id, name FROM BSB_books ORDER BY id")
    .all() as { id: number; name: string }[];
  bookIdToName = new Map(rows.map((r) => [r.id, r.name]));
  return bookIdToName;
}

export function getCrossReferences(
  book: string,
  chapter: number,
  verse: number,
  limit = 8,
  includeText = false
): CrossReference[] {
  const bookName = normalizeBookName(book);
  if (!bookName) return [];
  const bookId = getBookId(bookName);
  if (!bookId) return [];

  const db = getCrossRefsDb();
  const rows = db
    .prepare(
      "SELECT to_book, to_chapter, to_verse_start, to_verse_end, votes " +
      "FROM cross_references " +
      "WHERE from_book = ? AND from_chapter = ? AND from_verse = ? " +
      "ORDER BY votes DESC LIMIT ?"
    )
    .all(bookId, chapter, verse, limit) as {
      to_book: number;
      to_chapter: number;
      to_verse_start: number;
      to_verse_end: number;
      votes: number;
    }[];

  const nameMap = getBookIdToName();
  const bsb = getBsbDb();

  return rows.map((r) => {
    const toBookName = nameMap.get(r.to_book) || `Book ${r.to_book}`;
    const ref: CrossReference = {
      toBook: toBookName,
      toChapter: r.to_chapter,
      toVerseStart: r.to_verse_start,
      toVerseEnd: r.to_verse_end,
      votes: r.votes,
    };

    if (includeText) {
      if (r.to_verse_start === r.to_verse_end) {
        const v = bsb
          .prepare(
            "SELECT text FROM BSB_verses WHERE book_id = ? AND chapter = ? AND verse = ?"
          )
          .get(r.to_book, r.to_chapter, r.to_verse_start) as { text: string } | undefined;
        ref.text = v?.text?.trim();
      } else {
        const vs = bsb
          .prepare(
            "SELECT text FROM BSB_verses WHERE book_id = ? AND chapter = ? AND verse BETWEEN ? AND ? ORDER BY verse"
          )
          .all(r.to_book, r.to_chapter, r.to_verse_start, r.to_verse_end) as { text: string }[];
        ref.text = vs.map((v) => v.text.trim()).join(" ");
      }
    }

    return ref;
  });
}

export function getCrossReferenceCounts(
  book: string,
  chapter: number
): Map<number, number> {
  const bookName = normalizeBookName(book);
  if (!bookName) return new Map();
  const bookId = getBookId(bookName);
  if (!bookId) return new Map();

  const db = getCrossRefsDb();
  const rows = db
    .prepare(
      "SELECT from_verse, COUNT(*) as cnt " +
      "FROM cross_references " +
      "WHERE from_book = ? AND from_chapter = ? " +
      "GROUP BY from_verse"
    )
    .all(bookId, chapter) as { from_verse: number; cnt: number }[];

  return new Map(rows.map((r) => [r.from_verse, r.cnt]));
}
