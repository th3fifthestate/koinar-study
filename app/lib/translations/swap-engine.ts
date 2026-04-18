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
import { ApiBibleError, EsvApiError, TranslationNotAvailableError } from "./errors";
import { recordFumsEvent } from "./fums-tracker";
import { enforceNivPerViewCap, type ViewVerseRef } from "./niv-display-guard";
import { displayNameToSlug } from "./osis-book-map";

export type SwapFailureReason = 'network' | 'rate-limit' | 'licensing' | 'offline';

export const SWAP_FAILURE_HINT: Record<SwapFailureReason, string> = {
  'network': 'Translation source unreachable',
  'rate-limit': 'Quota reached — try again later',
  'licensing': 'Unavailable for this study',
  'offline': "You're offline",
};

export interface SwapResult {
  content: string;
  versesSwapped: number;
  missingVerses: Array<{ book: string; chapter: number; verse: number }>;
  truncated: boolean;
  failureReason?: SwapFailureReason; // set when the swap failed for a deterministic reason
}

// Priority order for combining failure reasons (higher index = higher severity)
const REASON_PRIORITY: SwapFailureReason[] = ['network', 'rate-limit', 'licensing', 'offline'];

function worstReason(
  a: SwapFailureReason | undefined,
  b: SwapFailureReason,
): SwapFailureReason {
  if (a === undefined) return b;
  return REASON_PRIORITY.indexOf(b) > REASON_PRIORITY.indexOf(a) ? b : a;
}

function classifyError(err: unknown): SwapFailureReason {
  // Offline check first (browser environment)
  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    return 'offline';
  }

  if (err instanceof ApiBibleError || err instanceof EsvApiError) {
    const status = err.statusCode;
    if (status === 429) return 'rate-limit';
    if (status === 403 || status === 451) return 'licensing';
    // 503 is thrown for network-level failures (fetch threw, no response)
    if (status === 503) return 'network';
    return 'network';
  }

  if (err instanceof TranslationNotAvailableError) {
    return 'licensing';
  }

  // Generic network error (TypeError from fetch, etc.)
  if (err instanceof TypeError) return 'offline';

  return 'network';
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

function replaceFirst(haystack: string, needle: string, replacement: string): string {
  const idx = haystack.indexOf(needle);
  if (idx === -1) return haystack;
  return haystack.slice(0, idx) + replacement + haystack.slice(idx + needle.length);
}

function findBlockquotes(content: string): Array<{ raw: string; text: string }> {
  const results: Array<{ raw: string; text: string }> = [];
  const pattern = /^((?:>[ \t]?.*\n?)+)/gm;
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

type FetchVerseResult =
  | { ok: true; text: string; fumsToken: string | null }
  | { ok: false; reason: SwapFailureReason };

async function fetchVerse(
  target: TranslationId,
  displayName: string,
  book: string,
  chapter: number,
  verse: number,
  ctx: { studyId: number; userId: number },
): Promise<FetchVerseResult> {
  const info = TRANSLATIONS[target];

  if (info.isLicensed) {
    const cached = getCachedVerse(target, book, chapter, verse);
    if (cached) return { ok: true, text: cached.text, fumsToken: cached.fumsToken };
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
      if (!rows.length) return { ok: false, reason: 'network' };
      return { ok: true, text: rows[0].text, fumsToken: null };
    } catch (err) {
      return { ok: false, reason: classifyError(err) };
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
      if (!rows.length) return { ok: false, reason: 'network' };
      const r = rows[0];
      setCachedVerse({
        translation: target,
        book,
        chapter,
        verse,
        text: r.text,
        fumsToken: null,
      });
      enforceStorageCap(target);
      recordFumsEvent({
        translation: target,
        fumsToken: null,
        eventType: "fetch",
        studyId: ctx.studyId,
        userId: ctx.userId,
        verseCount: 1,
      });
      return { ok: true, text: r.text, fumsToken: null };
    } catch (err) {
      return { ok: false, reason: classifyError(err) };
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
    if (!rows.length) return { ok: false, reason: 'network' };
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
    return { ok: true, text: r.text, fumsToken: r.fumsToken };
  } catch (err) {
    return { ok: false, reason: classifyError(err) };
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
  let failureReason: SwapFailureReason | undefined;

  // NIV §V.F: compute the allowed-verse set BEFORE fetching so we never render
  // past the cap. Skipped verses are replaced with a truncation marker; the
  // original BSB block stays intact when a whole block is disallowed.
  let allowedKey: Set<string> | null = null;
  let truncated = false;
  if (target === "NIV") {
    const allRefs: ViewVerseRef[] = [];
    for (const block of blocks) {
      const refs = parseVerseRefs(block.text);
      if (!refs.length) continue;
      const ref = refs[0];
      for (let v = ref.verseStart; v <= ref.verseEnd; v++) {
        allRefs.push({ book: ref.book, chapter: ref.chapter, verse: v });
      }
    }
    if (allRefs.length) {
      const guard = enforceNivPerViewCap(allRefs);
      truncated = guard.truncated;
      if (guard.truncated) {
        allowedKey = new Set(
          guard.allowedVerses.map((r) => `${r.book}:${r.chapter}:${r.verse}`),
        );
      }
    }
  }

  for (const block of blocks) {
    const refs = parseVerseRefs(block.text);
    if (!refs.length) continue;

    const ref = refs[0];
    const verseLines: string[] = [];
    let anyMissing = false;
    let anyOverCap = false;

    for (let v = ref.verseStart; v <= ref.verseEnd; v++) {
      if (allowedKey && !allowedKey.has(`${ref.book}:${ref.chapter}:${v}`)) {
        anyOverCap = true;
        continue;
      }
      const fetched = await fetchVerse(target, ref.displayName, ref.book, ref.chapter, v, ctx);
      if (!fetched.ok) {
        missingVerses.push({ book: ref.book, chapter: ref.chapter, verse: v });
        anyMissing = true;
        failureReason = worstReason(failureReason, fetched.reason);
      } else {
        verseLines.push(fetched.text);
        versesSwapped++;
      }
    }

    // If any verse in this block is missing upstream, leave BSB in place.
    if (anyMissing) continue;
    // If every verse in this block was trimmed by the NIV cap, leave BSB too.
    if (!verseLines.length) continue;

    const verseLabel =
      ref.verseEnd > ref.verseStart
        ? `${ref.displayName} ${ref.chapter}:${ref.verseStart}\u2013${ref.verseEnd}`
        : `${ref.displayName} ${ref.chapter}:${ref.verseStart}`;

    const capNote = anyOverCap
      ? `\n> \u2014 Additional verses omitted per ${target} per-view cap.`
      : "";
    const newBlock =
      verseLines.map((t) => `> ${t}`).join("\n") +
      `\n> \u2014 ${verseLabel} (${target})${capNote}\n`;

    result = replaceFirst(result, block.raw, newBlock);
  }

  return { content: result, versesSwapped, missingVerses, truncated, failureReason };
}
