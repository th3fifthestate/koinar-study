// app/lib/translations/niv-display-guard.test.ts
import { describe, expect, it } from "vitest";
import { enforceNivPerViewCap, type ViewVerseRef } from "./niv-display-guard";

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
  it("returns everything when under verse cap and over chapter cap", () => {
    // 3 chapters but only 10 verses — verse cap (25) permits it
    const input = refs(10, 3);
    const result = enforceNivPerViewCap(input);
    expect(result.truncated).toBe(false);
    expect(result.allowedVerses).toHaveLength(10);
  });

  it("returns everything when under chapter cap and over verse cap", () => {
    // 2 chapters, 40 verses — chapter cap (2) permits it
    const input = refs(40, 2);
    const result = enforceNivPerViewCap(input);
    expect(result.truncated).toBe(false);
    expect(result.allowedVerses).toHaveLength(40);
  });

  it("truncates when BOTH caps exceeded (3+ chapters AND 26+ verses)", () => {
    const input = refs(30, 3);
    const result = enforceNivPerViewCap(input);
    expect(result.truncated).toBe(true);
    expect(result.allowedVerses.length).toBeLessThan(30);
  });

  it("returns truncated=false for an empty list", () => {
    const result = enforceNivPerViewCap([]);
    expect(result.truncated).toBe(false);
    expect(result.allowedVerses).toEqual([]);
  });

  it("allows 27 verses in a single chapter (chapter cap is more permissive)", () => {
    // Canonical 'whichever GREATER' edge: 1 chapter < 2-chapter cap, so even
    // though 27 > 25-verse cap, the request passes untruncated.
    const input = refs(27, 1);
    const result = enforceNivPerViewCap(input);
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
    const result = enforceNivPerViewCap(input);
    expect(result.truncated).toBe(true);
    // Chapter cap is more permissive (2 chapters = 40 verses), so verse cap
    // is never the first limit hit in this ordering. Expect chapter-cap.
    expect(result.reason).toBe("chapter-cap");
  });
});
