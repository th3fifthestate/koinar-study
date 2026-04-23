// app/lib/translations/esv-client.ts
//
// Crossway ESV API client. Feature-gated: if ESV_API_KEY is unset, every call
// throws TranslationNotAvailableError so the surrounding cache/swap layer
// simply skips ESV paths.
//
// ESV does not emit FUMS tokens — `fumsToken` is always null on returned verses.

import { config } from "@/lib/config";
import type { ApiBibleVerse } from "./api-bible-client";
import { EsvApiError, TranslationNotAvailableError } from "./errors";

export interface EsvFetchInput {
  /** Internal book slug — e.g. 'john'. */
  book: string;
  /** Display book name for the ESV `q` parameter, e.g. "John". */
  displayBook: string;
  chapter: number;
  verseStart: number;
  verseEnd: number;
}

const API_BASE = "https://api.esv.org/v3/passage/text/";

export async function fetchEsvPassage(input: EsvFetchInput): Promise<ApiBibleVerse[]> {
  if (!config.bible.esvApiKey) {
    throw new TranslationNotAvailableError("ESV");
  }

  const q = `${input.displayBook} ${input.chapter}:${input.verseStart}-${input.verseEnd}`;
  const url = `${API_BASE}?q=${encodeURIComponent(q)}&include-headings=false&include-footnotes=false&include-verse-numbers=true&include-short-copyright=false&include-passage-references=false`;

  let res: Response;
  try {
    res = await fetch(url, {
      headers: { Authorization: `Token ${config.bible.esvApiKey}` },
    });
  } catch (e) {
    throw new EsvApiError(
      "Translation service unavailable.",
      503,
      e instanceof Error ? e.message : String(e),
    );
  }

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new EsvApiError("Translation service error.", res.status, body.slice(0, 500));
  }

  const json: unknown = await res.json().catch(() => null);
  const parsed = parseEsvResponse(json, input);
  if (!parsed) {
    throw new EsvApiError(
      "Translation response malformed.",
      502,
      "Could not parse ESV payload",
    );
  }
  return parsed;
}

/**
 * ESV returns `passages: ["[1] In the beginning ... [2] ..."]`.
 * Split on `[N] ` markers with matchAll to recover per-verse text. Verse
 * numbers outside the requested range are dropped.
 */
export function parseEsvResponse(
  raw: unknown,
  input: EsvFetchInput,
): ApiBibleVerse[] | null {
  if (!raw || typeof raw !== "object") return null;
  const passages = (raw as Record<string, unknown>).passages;
  if (!Array.isArray(passages) || passages.length === 0) return null;
  const text = passages.map((p) => (typeof p === "string" ? p : "")).join("\n");

  const out: ApiBibleVerse[] = [];
  for (const match of text.matchAll(/\[(\d+)\]\s*([^\[]*)/g)) {
    const verse = parseInt(match[1], 10);
    const body = match[2].trim();
    if (!body) continue;
    if (verse < input.verseStart || verse > input.verseEnd) continue;
    out.push({
      book: input.book,
      chapter: input.chapter,
      verse,
      text: body,
      fumsToken: null,
    });
  }
  if (out.length === 0) return null;
  return out;
}
