// app/lib/translations/osis-book-map.ts
//
// One-way mapping: internal lowercase slug → OSIS / api.bible book code.
// api.bible uses OSIS codes in passage IDs (e.g. "JHN.3.16-JHN.3.17").
// Full 66-book canon (Protestant). Deuterocanon intentionally omitted —
// not shipping those translations.

const SLUG_TO_OSIS: Record<string, string> = {
  // Old Testament
  genesis: "GEN",
  exodus: "EXO",
  leviticus: "LEV",
  numbers: "NUM",
  deuteronomy: "DEU",
  joshua: "JOS",
  judges: "JDG",
  ruth: "RUT",
  "1-samuel": "1SA",
  "2-samuel": "2SA",
  "1-kings": "1KI",
  "2-kings": "2KI",
  "1-chronicles": "1CH",
  "2-chronicles": "2CH",
  ezra: "EZR",
  nehemiah: "NEH",
  esther: "EST",
  job: "JOB",
  psalms: "PSA",
  proverbs: "PRO",
  ecclesiastes: "ECC",
  "song-of-solomon": "SNG",
  isaiah: "ISA",
  jeremiah: "JER",
  lamentations: "LAM",
  ezekiel: "EZK",
  daniel: "DAN",
  hosea: "HOS",
  joel: "JOL",
  amos: "AMO",
  obadiah: "OBA",
  jonah: "JON",
  micah: "MIC",
  nahum: "NAM",
  habakkuk: "HAB",
  zephaniah: "ZEP",
  haggai: "HAG",
  zechariah: "ZEC",
  malachi: "MAL",

  // New Testament
  matthew: "MAT",
  mark: "MRK",
  luke: "LUK",
  john: "JHN",
  acts: "ACT",
  romans: "ROM",
  "1-corinthians": "1CO",
  "2-corinthians": "2CO",
  galatians: "GAL",
  ephesians: "EPH",
  philippians: "PHP",
  colossians: "COL",
  "1-thessalonians": "1TH",
  "2-thessalonians": "2TH",
  "1-timothy": "1TI",
  "2-timothy": "2TI",
  titus: "TIT",
  philemon: "PHM",
  hebrews: "HEB",
  james: "JAS",
  "1-peter": "1PE",
  "2-peter": "2PE",
  "1-john": "1JN",
  "2-john": "2JN",
  "3-john": "3JN",
  jude: "JUD",
  revelation: "REV",
};

/** Returns the OSIS code for a known internal book slug, or null if unknown. */
export function bookToOsis(slug: string): string | null {
  return SLUG_TO_OSIS[slug.toLowerCase()] ?? null;
}

/** All known slugs — used for validation in tests and tooling. */
export function allBookSlugs(): string[] {
  return Object.keys(SLUG_TO_OSIS);
}

/** Aliases for display names that don't map 1:1 to slugs. */
const DISPLAY_ALIASES: Record<string, string> = {
  "psalm": "psalms",
  "song of songs": "song-of-solomon",
};

/**
 * Maps a Bible book display name as it appears in prose ("John",
 * "1 Corinthians", "Song of Solomon") to the internal hyphenated lowercase
 * slug used in local DB queries and api.bible calls.
 *
 * Returns null if the name is not a known canonical book.
 */
export function displayNameToSlug(name: string): string | null {
  const normalized = name.toLowerCase().trim();
  const alias = DISPLAY_ALIASES[normalized];
  if (alias !== undefined) return alias;
  const slug = normalized.replace(/\s+/g, '-');
  return SLUG_TO_OSIS[slug] !== undefined ? slug : null;
}
