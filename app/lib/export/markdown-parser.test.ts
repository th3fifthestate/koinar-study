// app/lib/export/markdown-parser.test.ts
import { describe, expect, it } from "vitest";
import { parseInline, parseStudyMarkdown } from "./markdown-parser";

describe("parseStudyMarkdown — block-level", () => {
  it("captures the H1 as title and emits headings list", () => {
    const md = `# Peter's Confession\n\n## Summary\n\nText.\n\n### Detail\n\nMore.`;
    const r = parseStudyMarkdown(md);
    expect(r.title).toBe("Peter's Confession");
    expect(r.headings.map((h) => `${h.level}:${h.text}`)).toEqual([
      "1:Peter's Confession",
      "2:Summary",
      "3:Detail",
    ]);
  });

  it("treats a `>` block ending in `— Ref (TRA)` as a scripture quote", () => {
    const md =
      `> "When Jesus came to the region of Caesarea Philippi…" — Matthew 16:13-14 (BSB)`;
    const r = parseStudyMarkdown(md);
    expect(r.blocks).toHaveLength(1);
    const b = r.blocks[0];
    expect(b.type).toBe("scripture_quote");
    if (b.type !== "scripture_quote") return;
    expect(b.reference).toBe("Matthew 16:13-14");
    expect(b.translation).toBe("BSB");
  });

  it("treats a non-citation `>` block as a plain blockquote", () => {
    const md = `> A pull-quote without a verse reference.`;
    const r = parseStudyMarkdown(md);
    expect(r.blocks[0].type).toBe("blockquote");
  });

  it("groups consecutive `- ` lines into one unordered_list block", () => {
    const md = `- one\n- two\n- three`;
    const r = parseStudyMarkdown(md);
    expect(r.blocks).toHaveLength(1);
    if (r.blocks[0].type !== "unordered_list") throw new Error("expected list");
    expect(r.blocks[0].items).toHaveLength(3);
    expect(r.blocks[0].items[0][0].text).toBe("one");
  });

  it("groups consecutive `1.`-style lines into one ordered_list block", () => {
    const md = `1. first\n2. second`;
    const r = parseStudyMarkdown(md);
    expect(r.blocks[0].type).toBe("ordered_list");
  });

  it("renders --- as horizontal_rule", () => {
    const md = `Above\n\n---\n\nBelow`;
    const r = parseStudyMarkdown(md);
    expect(r.blocks.map((b) => b.type)).toContain("horizontal_rule");
  });

  it("flags a paragraph with the mountain icon as mountainAnnotation", () => {
    const md = `⛰️ Caesarea Philippi was rebuilt by Philip.`;
    const r = parseStudyMarkdown(md);
    const b = r.blocks[0];
    expect(b.type).toBe("paragraph");
    if (b.type !== "paragraph") return;
    expect(b.mountainAnnotation).toBe(true);
  });

  it("collapses a multi-line paragraph into a single block", () => {
    const md = `Line one of paragraph\ncontinues onto another line\nand ends here.`;
    const r = parseStudyMarkdown(md);
    expect(r.blocks).toHaveLength(1);
    expect(r.blocks[0].type).toBe("paragraph");
  });
});

describe("parseInline — formatting precedence", () => {
  it("parses ***x*** as bold+italic", () => {
    const segs = parseInline("***Christos*** is the Greek for Messiah.");
    expect(segs[0]).toMatchObject({
      text: "Christos",
      bold: true,
      italic: true,
    });
  });

  it("parses **x** as bold", () => {
    const segs = parseInline("**Primary text:** John 3:16");
    expect(segs[0]).toMatchObject({ text: "Primary text:", bold: true });
  });

  it("parses *x* as italic", () => {
    const segs = parseInline("*emphasis* matters here");
    expect(segs[0]).toMatchObject({ text: "emphasis", italic: true });
  });

  it("parses `x` as code", () => {
    const segs = parseInline("see `setCachedVerse` for details");
    expect(segs.find((s) => s.code)?.text).toBe("setCachedVerse");
  });
});

describe("parseInline — script detection", () => {
  it("flags Hebrew text", () => {
    const segs = parseInline("בְּרִית means covenant");
    expect(segs.some((s) => s.greekHebrew)).toBe(true);
  });

  it("flags Greek text", () => {
    const segs = parseInline("διαθήκη is the LXX rendering");
    expect(segs.some((s) => s.greekHebrew)).toBe(true);
  });

  it("captures Strong's numbers like (G5547)", () => {
    const segs = parseInline("***Christos*** (G5547) — anointed one");
    expect(segs.find((s) => s.strongs)?.strongs).toBe("G5547");
  });
});
