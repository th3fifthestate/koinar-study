// app/lib/translations/swap-engine.ts
//
// Mechanical, non-AI verse substitution.
//
// Walks scripture blockquotes in the BSB study markdown, looks up each verse
// reference in the target translation (local DB or DHCP cache → api.bible),
// and reconstructs the blockquote with translated text.
//
// For NIV: enforces Biblica §V.F per-view cap before returning.
// For licensed translations: records FUMS 'fetch' events per verse fetched.
// NEVER calls the Claude API. Input must always be BSB original_content.

import type { TranslationId } from "./registry";
import { TRANSLATIONS } from "./registry";
import { getLocalPassage } from "./local-queries";
import { getCachedVerse, setCachedVerse, enforceStorageCap } from "./cache";
import { fetchApiBiblePassage } from "./api-bible-client";
import { fetchEsvPassage } from "./esv-client";
import { recordFumsEvent } from "./fums-tracker";
import { enforceNivPerViewCap, type ViewVerseRef } from "./niv-display-guard";
import { displayNameToSlug } from "./osis-book-map";

export interface SwapResult {
  content: string;
  versesSwapped: number;
  missingVerses: Array<{ book: string; chapter: number; verse: number }>;
  truncated: boolean;
}

interface ParsedRef {
  displayName: string;
  book: string;
  chapter: number;
  verseStart: number;
  verseEnd: number;
}

const VERSE_REF_PATTERN =
  /\b(\d?\s?[A-Z][a-z]+(?:\s[A-Z][a-z]+)*)\s+(\d+):(\d+)(?:-(\d+))?\b/g;

function parseVerseRefs(text: string): ParsedRef[] {
  const refs: ParsedRef[] = [];
  for (const m of text.matchAll(VERSE_REF_PATTERN)) {
    const displayName = m[1];
    const book = displayNameToSlug(displayName);
    if (!book) continue;
    refs.push({
      displayName,
      book,
      chapter: parseInt(m[2], 10),
      verseStart: parseInt(m[3], 10),
      verseEnd: m[4] ? parseInt(m[4], 10) : parseInt(m[3], 10),
    });
  }
  return refs;
}

function findBlockquotes(content: string): Array<{ raw: string; text: string }> {
  const results: Array<{ raw: string; text: string }> = [];
  const pattern = /^((?:>[ \t]?.+\n?)+)/gm;
  for (const m of content.matchAll(pattern)) {
    const raw = m[1];
    const text = raw
      .split("\n")
      .filter(Boolean)
      .map((l) => l.replace(/^>[ \t]?/, ""))
      .join(" ");
    results.push({ raw, text });
  }
  return results;
}

async function fetchVerse(
  target: TranslationId,
  displayName: string,
  book: string,
  chapter: number,
  verse: number,
  ctx: { studyId: number; userId: number },
): Promise<{ text: string; fumsToken: string | null } | null> {
  const info = TRANSLATIONS[target];

  if (info.isLicensed) {
    const cached = getCachedVerse(target, book, chapter, verse);
    if (cached) return { text: cached.text, fumsToken: cached.fumsToken };
  }

  if (target === "BSB" || target === "KJV" || target === "WEB") {
    try {
      const rows = getLocalPassage(
        target as "BSB" | "KJV" | "WEB",
        book,
        chapter,
        verse,
        verse,
      );
      return rows.length ? { text: rows[0].text, fumsToken: null } : null;
    } catch {
      return null;
    }
  }

  if (target === "ESV") {
    try {
      const rows = await fetchEsvPassage({
        book,
        displayBook: displayName,
        chapter,
        verseStart: verse,
        verseEnd: verse,
      });
      if (!rows.length) return null;
      const r = rows[0];
      setCachedVerse({
        translation: target,
        book,
        chapter,
        verse,
        text: r.text,
        fumsToken: null,
      });
      recordFumsEvent({
        translation: target,
        fumsToken: null,
        eventType: "fetch",
        studyId: ctx.studyId,
        userId: ctx.userId,
        verseCount: 1,
      });
      return { text: r.text, fumsToken: null };
    } catch {
      return null;
    }
  }

  // NLT / NIV / NASB via api.bible
  try {
    const rows = await fetchApiBiblePassage({
      translation: target as "NLT" | "NIV" | "NASB",
      book,
      chapter,
      verseStart: verse,
      verseEnd: verse,
    });
    if (!rows.length) return null;
    const r = rows[0];
    setCachedVerse({
      translation: target,
      book,
      chapter,
      verse,
      text: r.text,
      fumsToken: r.fumsToken,
    });
    recordFumsEvent({
      translation: target,
      fumsToken: r.fumsToken,
      eventType: "fetch",
      studyId: ctx.studyId,
      userId: ctx.userId,
      verseCount: 1,
    });
    enforceStorageCap(target);
    return { text: r.text, fumsToken: r.fumsToken };
  } catch {
    return null;
  }
}

export async function swapVerses(
  studyContent: string,
  target: TranslationId,
  ctx: { studyId: number; userId: number },
): Promise<SwapResult> {
  if (target === "BSB") {
    return { content: studyContent, versesSwapped: 0, missingVerses: [], truncated: false };
  }

  const blocks = findBlockquotes(studyContent);
  let result = studyContent;
  let versesSwapped = 0;
  const missingVerses: Array<{ book: string; chapter: number; verse: number }> = [];
  const nivRefs: ViewVerseRef[] = [];

  for (const block of blocks) {
    const refs = parseVerseRefs(block.text);
    if (!refs.length) continue;

    const ref = refs[0];
    const verseLines: string[] = [];
    let anyMissing = false;

    for (let v = ref.verseStart; v <= ref.verseEnd; v++) {
      const fetched = await fetchVerse(target, ref.displayName, ref.book, ref.chapter, v, ctx);
      if (!fetched) {
        missingVerses.push({ book: ref.book, chapter: ref.chapter, verse: v });
        anyMissing = true;
      } else {
        verseLines.push(fetched.text);
        versesSwapped++;
        if (target === "NIV") {
          nivRefs.push({ book: ref.book, chapter: ref.chapter, verse: v });
        }
      }
    }

    if (anyMissing) continue;

    const verseLabel =
      ref.verseEnd > ref.verseStart
        ? `${ref.displayName} ${ref.chapter}:${ref.verseStart}\u2013${ref.verseEnd}`
        : `${ref.displayName} ${ref.chapter}:${ref.verseStart}`;

    const newBlock =
      verseLines.map((t) => `> ${t}`).join("\n") + `\n> \u2014 ${verseLabel} (${target})\n`;

    result = result.replace(block.raw, newBlock);
  }

  let truncated = false;
  if (target === "NIV" && nivRefs.length) {
    const guard = enforceNivPerViewCap(nivRefs);
    truncated = guard.truncated;
  }

  return { content: result, versesSwapped, missingVerses, truncated };
}
