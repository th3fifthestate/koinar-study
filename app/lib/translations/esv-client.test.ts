// app/lib/translations/esv-client.test.ts
import { describe, expect, it } from "vitest";
import { parseEsvResponse } from "./esv-client";

const input = {
  book: "john",
  displayBook: "John",
  chapter: 3,
  verseStart: 16,
  verseEnd: 17,
};

describe("parseEsvResponse", () => {
  it("splits a bracket-marked passage into verses", () => {
    const raw = {
      passages: ["[16] For God so loved the world. [17] For God did not send"],
    };
    const parsed = parseEsvResponse(raw, input);
    expect(parsed).toHaveLength(2);
    expect(parsed?.[0]).toMatchObject({ verse: 16, fumsToken: null });
    expect(parsed?.[1].verse).toBe(17);
  });

  it("drops verse numbers outside the requested range", () => {
    const raw = { passages: ["[15] skipped [16] kept [17] kept [18] skipped"] };
    const parsed = parseEsvResponse(raw, input);
    expect(parsed?.map((v) => v.verse)).toEqual([16, 17]);
  });

  it("returns null on unexpected shape", () => {
    expect(parseEsvResponse(null, input)).toBeNull();
    expect(parseEsvResponse({}, input)).toBeNull();
    expect(parseEsvResponse({ passages: [] }, input)).toBeNull();
  });
});
