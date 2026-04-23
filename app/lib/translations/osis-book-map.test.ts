// app/lib/translations/osis-book-map.test.ts
import { describe, expect, it } from "vitest";
import { allBookSlugs, bookToOsis, displayNameToSlug } from "./osis-book-map";

describe("osis-book-map", () => {
  it("covers all 66 canonical books", () => {
    expect(allBookSlugs()).toHaveLength(66);
  });

  it("returns null for unknown slugs", () => {
    expect(bookToOsis("not-a-book")).toBeNull();
  });

  it("maps common books correctly", () => {
    expect(bookToOsis("john")).toBe("JHN");
    expect(bookToOsis("genesis")).toBe("GEN");
    expect(bookToOsis("1-corinthians")).toBe("1CO");
    expect(bookToOsis("revelation")).toBe("REV");
  });

  it("is case-insensitive on slug input", () => {
    expect(bookToOsis("John")).toBe("JHN");
  });
});

describe("displayNameToSlug", () => {
  it("handles single-word books", () => {
    expect(displayNameToSlug("John")).toBe("john");
    expect(displayNameToSlug("Genesis")).toBe("genesis");
    expect(displayNameToSlug("Revelation")).toBe("revelation");
  });
  it("handles numbered books with space", () => {
    expect(displayNameToSlug("1 Corinthians")).toBe("1-corinthians");
    expect(displayNameToSlug("2 Samuel")).toBe("2-samuel");
    expect(displayNameToSlug("1 John")).toBe("1-john");
  });
  it("handles Song of Solomon alias", () => {
    expect(displayNameToSlug("Song of Solomon")).toBe("song-of-solomon");
    expect(displayNameToSlug("Song of Songs")).toBe("song-of-solomon");
  });
  it("handles Psalm alias", () => {
    expect(displayNameToSlug("Psalm")).toBe("psalms");
  });
  it("returns null for unknown names", () => {
    expect(displayNameToSlug("Hezekiah")).toBeNull();
  });
});
