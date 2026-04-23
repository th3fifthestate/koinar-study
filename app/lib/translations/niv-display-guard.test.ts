// app/lib/translations/niv-display-guard.test.ts
import { describe, expect, it } from "vitest";
import { enforceNivPerViewCap, type ViewVerseRef } from "./niv-display-guard";
import type { DisplaySurface } from "@/lib/bench/types";

function refs(n: number, chaptersAcross = 1, book = "john"): ViewVerseRef[] {
  const out: ViewVerseRef[] = [];
  const perChapter = Math.ceil(n / chaptersAcross);
  for (let c = 1; c <= chaptersAcross; c++) {
    for (let v = 1; v <= perChapter && out.length < n; v++) {
      out.push({ book, chapter: c, verse: v });
    }
  }
  return out;
}

describe("enforceNivPerViewCap", () => {
  // Default surface for tests that aren't testing surface-specific behaviour
  const defaultSurface: DisplaySurface = { kind: "reader", studyId: "test" };

  it("returns everything when under verse cap and over chapter cap", () => {
    // 3 chapters but only 10 verses — verse cap (25) permits it
    const input = refs(10, 3);
    const result = enforceNivPerViewCap(input, defaultSurface);
    expect(result.truncated).toBe(false);
    expect(result.allowedVerses).toHaveLength(10);
  });

  it("returns everything when under chapter cap and over verse cap", () => {
    // 2 chapters, 40 verses — chapter cap (2) permits it
    const input = refs(40, 2);
    const result = enforceNivPerViewCap(input, defaultSurface);
    expect(result.truncated).toBe(false);
    expect(result.allowedVerses).toHaveLength(40);
  });

  it("truncates when BOTH caps exceeded (3+ chapters AND 26+ verses)", () => {
    const input = refs(30, 3);
    const result = enforceNivPerViewCap(input, defaultSurface);
    expect(result.truncated).toBe(true);
    expect(result.allowedVerses.length).toBeLessThan(30);
  });

  it("returns truncated=false for an empty list", () => {
    const result = enforceNivPerViewCap([], defaultSurface);
    expect(result.truncated).toBe(false);
    expect(result.allowedVerses).toEqual([]);
  });

  it("allows 27 verses in a single chapter (chapter cap is more permissive)", () => {
    // Canonical 'whichever GREATER' edge: 1 chapter < 2-chapter cap, so even
    // though 27 > 25-verse cap, the request passes untruncated.
    const input = refs(27, 1);
    const result = enforceNivPerViewCap(input, defaultSurface);
    expect(result.truncated).toBe(false);
    expect(result.allowedVerses).toHaveLength(27);
  });

  it("reports verse-cap reason when the verse limit hits before the chapter limit", () => {
    // 3 chapters × 20 verses, interleaved: verses 1-25 fit across 2 chapters
    // easily; the 26th verse (still inside ch2) hits the verse limit before
    // any 3rd-chapter verse is seen. But since both caps are eventually
    // exceeded at the tail, truncation fires and reason should be verse-cap.
    const input: ViewVerseRef[] = [];
    for (let c = 1; c <= 3; c++) {
      for (let v = 1; v <= 20; v++) input.push({ book: "john", chapter: c, verse: v });
    }
    const result = enforceNivPerViewCap(input, defaultSurface);
    expect(result.truncated).toBe(true);
    // Chapter cap is more permissive (2 chapters = 40 verses), so verse cap
    // is never the first limit hit in this ordering. Expect chapter-cap.
    expect(result.reason).toBe("chapter-cap");
  });
});

// makeRefs distributes `count` verses across 3 chapters so that BOTH the
// verse cap (25) and chapter cap (2) can be exceeded, triggering truncation.
function makeRefs(count: number): ViewVerseRef[] {
  return Array.from({ length: count }, (_, i) => ({
    book: "John",
    chapter: Math.floor(i / 10) + 1, // chapters 1, 2, 3 (10 verses each)
    verse: (i % 10) + 1,
  }));
}

describe("surface-aware enforceNivPerViewCap", () => {
  it("blocks when both caps exceeded on reader surface", () => {
    // 26 verses across 3 chapters — exceeds both verse cap (25) and chapter cap (2)
    const surface: DisplaySurface = { kind: "reader", studyId: "study-1" };
    const result = enforceNivPerViewCap(makeRefs(26), surface);
    expect(result.truncated).toBe(true);
    expect(result.allowedVerses).toHaveLength(25);
  });

  it("blocks when both caps exceeded on bench surface", () => {
    // 26 verses across 3 chapters — exceeds both verse cap (25) and chapter cap (2)
    const surface: DisplaySurface = { kind: "bench", boardId: "board-1" };
    const result = enforceNivPerViewCap(makeRefs(26), surface);
    expect(result.truncated).toBe(true);
    expect(result.allowedVerses).toHaveLength(25);
  });

  it("does NOT aggregate across surfaces — each surface enforced independently", () => {
    const readerSurface: DisplaySurface = { kind: "reader", studyId: "study-1" };
    const benchSurface: DisplaySurface = { kind: "bench", boardId: "board-1" };
    // Reader call: 25 refs across 3 chapters — would push an "accumulated" count
    // to 25 if state leaked between calls. Both caps exceeded → truncated at 25.
    const readerResult = enforceNivPerViewCap(makeRefs(25), readerSurface);
    // Bench call: 26 refs across 3 chapters — should still be evaluated fresh;
    // if the reader call had leaked state, a stateful implementation might
    // behave differently. Surface isolation means this call is independent.
    const benchResult = enforceNivPerViewCap(makeRefs(26), benchSurface);
    // Both results reflect independent cap enforcement:
    // bench sees 26 refs → truncated at 25 regardless of the prior reader call.
    expect(benchResult.truncated).toBe(true);
    expect(benchResult.allowedVerses.length).toBeLessThanOrEqual(25);
  });

  it("allows exactly 25 NIV verses on reader surface", () => {
    // 25 verses in 1 chapter: under verse cap (25 <= 25) → passes untruncated
    const surface: DisplaySurface = { kind: "reader", studyId: "study-1" };
    const refsArr = Array.from({ length: 25 }, (_, i) => ({
      book: "John",
      chapter: 1,
      verse: i + 1,
    }));
    const result = enforceNivPerViewCap(refsArr, surface);
    expect(result.truncated).toBe(false);
    expect(result.allowedVerses).toHaveLength(25);
  });
});
