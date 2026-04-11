export interface BsbVerse {
  book: string;       // Canonical book name (e.g., "Genesis", "1 Corinthians")
  chapter: number;
  verse: number;
  text: string;
}

export interface HebrewWord {
  book: string;
  chapter: number;
  verse: number;
  word_num: number;
  hebrew_text: string;
  strongs: string | null;
  morphology: string | null;
  transliteration: string | null;
}

export interface GreekWord {
  book: string;
  chapter: number;
  verse: number;
  word_num: number;
  greek_text: string;
  strongs: string | null;
  morphology: string | null;
  transliteration: string | null;
}

export interface LxxWord {
  book: string;
  chapter: number;
  verse: number;
  word_num: number;
  greek_text: string;
  strongs: string | null;
  morphology: string | null;
}

export interface StrongsEntry {
  number: string;      // e.g., "H430" or "G26"
  lemma: string;       // Original Hebrew/Greek word
  xlit: string;        // Transliteration
  pronounce: string;   // Pronunciation guide
  description: string; // Full definition and usage notes
}

export interface CrossReference {
  toBook: string;
  toChapter: number;
  toVerseStart: number;
  toVerseEnd: number;
  votes: number;
  text?: string;       // Optional BSB text of the referenced verse(s)
}

export interface FtsSearchResult extends BsbVerse {
  rank: number;
  snippet: string;
}

export interface BookInfo {
  name: string;
  chapters: number;
}
