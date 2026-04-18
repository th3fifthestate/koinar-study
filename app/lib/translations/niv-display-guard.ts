// app/lib/translations/niv-display-guard.ts
//
// Biblica §V.F caps NIV rendering at 2 chapters OR 25 verses per user per
// view — whichever allowance is GREATER. We only truncate when the request
// exceeds BOTH caps, otherwise the more permissive cap wins.

import { config } from "@/lib/config";
import type { DisplaySurface } from "@/lib/bench/types";

export interface ViewVerseRef {
  book: string;
  chapter: number;
  verse: number;
}

export interface NivGuardResult {
  allowedVerses: ViewVerseRef[];
  truncated: boolean;
  reason?: "chapter-cap" | "verse-cap";
}

export function enforceNivPerViewCap(
  refs: ViewVerseRef[],
  surface: DisplaySurface,
): NivGuardResult {
  const { maxChaptersPerView, maxVersesPerView } = config.bible.niv;
  const uniqueChapters = new Set(refs.map((r) => `${r.book} ${r.chapter}`));

  const underChapterCap = uniqueChapters.size <= maxChaptersPerView;
  const underVerseCap = refs.length <= maxVersesPerView;

  // Under EITHER cap → return everything (the greater allowance wins).
  if (underChapterCap || underVerseCap) {
    return { allowedVerses: refs, truncated: false };
  }

  // Both caps exceeded — trim. Walk refs in order; stop when adding the next
  // verse would violate BOTH caps simultaneously. Track which cap hit its
  // limit first during the walk so the reader banner names the real
  // limiting factor (not always the chapter cap).
  const allowed: ViewVerseRef[] = [];
  const chaptersSeen = new Set<string>();
  let chapterLimitReachedAt: number | null = null;
  let verseLimitReachedAt: number | null = null;

  for (const r of refs) {
    const key = `${r.book} ${r.chapter}`;
    const nextChapterCount = chaptersSeen.has(key)
      ? chaptersSeen.size
      : chaptersSeen.size + 1;
    const overChapters = nextChapterCount > maxChaptersPerView;
    const overVerses = allowed.length + 1 > maxVersesPerView;
    if (overChapters && chapterLimitReachedAt === null) {
      chapterLimitReachedAt = allowed.length;
    }
    if (overVerses && verseLimitReachedAt === null) {
      verseLimitReachedAt = allowed.length;
    }
    if (overChapters && overVerses) break;
    chaptersSeen.add(key);
    allowed.push(r);
  }

  // The "binding" cap is the one reached LATEST — the other was already over
  // and we kept walking because this one still had room. When it too goes
  // over, both are exceeded and we stop. That final cap is what truncated us.
  const reason: "chapter-cap" | "verse-cap" =
    chapterLimitReachedAt !== null &&
    (verseLimitReachedAt === null ||
      chapterLimitReachedAt >= verseLimitReachedAt)
      ? "chapter-cap"
      : "verse-cap";

  console.warn('[niv-guard] cap hit', {
    surface,
    cap_hit_at: refs.length,
    translation: 'niv',
  });

  return { allowedVerses: allowed, truncated: true, reason };
}
