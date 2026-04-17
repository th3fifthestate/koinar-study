// app/lib/translations/osis-book-map.test.ts
import { describe, expect, it } from "vitest";
import { allBookSlugs, bookToOsis } from "./osis-book-map";

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
