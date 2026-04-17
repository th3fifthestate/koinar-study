// app/lib/translations/api-bible-client.test.ts
import { describe, expect, it } from "vitest";
import { parseApiBibleResponse } from "./api-bible-client";

const input = {
  translation: "NIV" as const,
  book: "john",
  chapter: 3,
  verseStart: 16,
  verseEnd: 17,
};

describe("parseApiBibleResponse", () => {
  it("extracts verses and FUMS token", () => {
    const raw = {
      data: {
        content: [
          { type: "verse", number: "16", items: [{ type: "text", text: "For God so loved" }] },
          { type: "verse", number: "17", items: [{ type: "text", text: "For God sent" }] },
        ],
      },
      meta: { fums: "fums-abc-123" },
    };
    const parsed = parseApiBibleResponse(raw, input);
    expect(parsed).not.toBeNull();
    expect(parsed).toHaveLength(2);
    expect(parsed?.[0]).toMatchObject({
      book: "john",
      chapter: 3,
      verse: 16,
      text: "For God so loved",
      fumsToken: "fums-abc-123",
    });
  });

  it("returns null on unexpected shape", () => {
    expect(parseApiBibleResponse(null, input)).toBeNull();
    expect(parseApiBibleResponse({}, input)).toBeNull();
    expect(parseApiBibleResponse({ data: "nope" }, input)).toBeNull();
    expect(parseApiBibleResponse({ data: { content: "nope" } }, input)).toBeNull();
  });

  it("tolerates missing fums meta (token = null)", () => {
    const raw = {
      data: {
        content: [
          { type: "verse", number: "1", items: [{ type: "text", text: "Hello" }] },
        ],
      },
    };
    const parsed = parseApiBibleResponse(raw, input);
    expect(parsed?.[0].fumsToken).toBeNull();
  });
});
