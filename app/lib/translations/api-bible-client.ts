// app/lib/translations/api-bible-client.ts
//
// Unified client for api.bible Starter-plan translations (NLT / NIV / NASB).
// Returns normalized verses with the FUMS token captured for downstream
// reporting. All errors are funneled through ApiBibleError — user-safe
// `message`, server-only `details` (CLAUDE.md §6).

import { config } from "@/lib/config";
import { ApiBibleError } from "./errors";
import { bookToOsis } from "./osis-book-map";

export interface ApiBibleVerse {
  book: string;
  chapter: number;
  verse: number;
  text: string;
  fumsToken: string | null;
}

export type ApiBibleTranslation = "NLT" | "NIV" | "NASB";

export interface FetchPassageInput {
  translation: ApiBibleTranslation;
  /** Internal book slug — see osis-book-map.ts. */
  book: string;
  chapter: number;
  verseStart: number;
  verseEnd: number;
}

const API_BASE = "https://api.scripture.api.bible/v1";

export async function fetchApiBiblePassage(
  input: FetchPassageInput,
): Promise<ApiBibleVerse[]> {
  const bibleId = config.bible.translationIds[input.translation];
  if (!bibleId) {
    throw new ApiBibleError(
      "Translation unavailable.",
      503,
      `Missing bible ID for ${input.translation}`,
    );
  }
  if (!config.bible.apiBibleKey) {
    throw new ApiBibleError(
      "Translation unavailable.",
      503,
      "API_BIBLE_KEY not configured",
    );
  }
  const osis = bookToOsis(input.book);
  if (!osis) {
    throw new ApiBibleError(
      "Passage not found.",
      404,
      `Unknown book slug: ${input.book}`,
    );
  }

  const passageId = `${osis}.${input.chapter}.${input.verseStart}-${osis}.${input.chapter}.${input.verseEnd}`;
  const qs =
    "?content-type=json&include-verse-numbers=true&include-notes=false&include-titles=false";
  const url = `${API_BASE}/bibles/${bibleId}/passages/${encodeURIComponent(
    passageId,
  )}${qs}`;

  let res: Response;
  try {
    res = await fetch(url, {
      headers: {
        "api-key": config.bible.apiBibleKey,
        accept: "application/json",
      },
    });
  } catch (e) {
    throw new ApiBibleError(
      "Translation service unavailable.",
      503,
      e instanceof Error ? e.message : String(e),
    );
  }

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new ApiBibleError(
      "Translation service error.",
      res.status,
      body.slice(0, 500),
    );
  }

  const json: unknown = await res.json().catch(() => null);
  const parsed = parseApiBibleResponse(json, input);
  if (!parsed) {
    throw new ApiBibleError(
      "Translation response malformed.",
      502,
      "Could not parse api.bible payload",
    );
  }
  return parsed;
}

/**
 * Shape we care about (api.bible returns more — we pull what we need):
 *   {
 *     data: { content: [ { type:'verse', number:'16', items:[{type:'text',text:'...'}] }, ... ] },
 *     meta: { fums: 'xxxxx' }
 *   }
 *
 * Defensive: return null on any structural surprise. The caller converts
 * null → ApiBibleError with generic "malformed" message.
 */
export function parseApiBibleResponse(
  raw: unknown,
  input: FetchPassageInput,
): ApiBibleVerse[] | null {
  if (!raw || typeof raw !== "object") return null;
  const obj = raw as Record<string, unknown>;
  const data = obj.data;
  const meta = obj.meta;
  if (!data || typeof data !== "object") return null;

  const fumsToken = extractFumsToken(meta);
  const content = (data as Record<string, unknown>).content;
  if (!Array.isArray(content)) return null;

  const verses: ApiBibleVerse[] = [];
  for (const node of content) {
    const v = extractVerseFromNode(node);
    if (v) {
      verses.push({
        book: input.book,
        chapter: input.chapter,
        verse: v.verse,
        text: v.text,
        fumsToken,
      });
    }
  }
  if (verses.length === 0) return null;
  return verses;
}

function extractFumsToken(meta: unknown): string | null {
  if (!meta || typeof meta !== "object") return null;
  const f = (meta as Record<string, unknown>).fums;
  return typeof f === "string" ? f : null;
}

type VerseExtract = { verse: number; text: string };

function extractVerseFromNode(node: unknown): VerseExtract | null {
  if (!node || typeof node !== "object") return null;
  const n = node as Record<string, unknown>;
  if (n.type !== "verse") return null;
  const num = typeof n.number === "string" ? parseInt(n.number, 10) : (n.number as number);
  if (!Number.isFinite(num)) return null;
  const items = Array.isArray(n.items) ? n.items : [];
  const text = items
    .map((it) => {
      if (!it || typeof it !== "object") return "";
      const i = it as Record<string, unknown>;
      return typeof i.text === "string" ? i.text : "";
    })
    .join("")
    .trim();
  if (!text) return null;
  return { verse: num as number, text };
}
