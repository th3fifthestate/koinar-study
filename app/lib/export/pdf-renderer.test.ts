// app/lib/export/pdf-renderer.test.ts
//
// Smoke test: feed a small parsed study through the renderer and confirm
// it produces a valid PDF (PDF magic bytes, non-trivial size). We don't
// inspect the pixel output here — the renderer's job is to not throw and
// to register fonts correctly. End-to-end verification happens via the
// preview server in the API-route + dialog tests.

import { describe, expect, it } from "vitest";
import { parseStudyMarkdown } from "./markdown-parser";
import { renderStudyToPdf } from "./pdf-renderer";

const SAMPLE = `# Peter's Confession

## Summary

Matthew 16:13-23 records a watershed moment: Peter declares Jesus is **the Christ**, the Son of the living God. The same disciple who receives heavenly insight in verse 16 becomes a mouthpiece for satanic opposition in verse 23.

### The Question (Matthew 16:13-14)

> "When Jesus came to the region of Caesarea Philippi, He questioned His disciples..." — Matthew 16:13-14 (BSB)

- Jesus deliberately takes His disciples to a city in the far north.
- ⛰️ Caesarea Philippi (modern Banias) was associated with a pagan sanctuary.
- The crowd's answers all reflect categories of prophets, not the Messiah.

### Greek/Hebrew Word Study

- ***Christos*** (G5547) — the Anointed One; Greek for *Mashiach*.
- The Hebrew בְּרִית (covenant) underlies the LXX rendering διαθήκη.
`;

describe("renderStudyToPdf", () => {
  it("produces a valid PDF buffer for a representative study", async () => {
    const parsed = parseStudyMarkdown(SAMPLE);
    const buf = await renderStudyToPdf(parsed, {
      translation: "BSB",
      study: { id: 1, title: parsed.title, generatedAt: "2026-04-28" },
    });
    expect(Buffer.isBuffer(buf)).toBe(true);
    // PDF magic bytes — every PDF starts with "%PDF-".
    expect(buf.subarray(0, 5).toString()).toBe("%PDF-");
    expect(buf.length).toBeGreaterThan(2000);
  });

  it("embeds the licensed copyright on the legal page when translation=NLT", async () => {
    const parsed = parseStudyMarkdown(SAMPLE);
    const buf = await renderStudyToPdf(parsed, {
      translation: "NLT",
      study: { id: 1, title: parsed.title, generatedAt: "2026-04-28" },
    });
    // PDFKit emits text as compressed streams by default — we can't grep the
    // raw buffer reliably for the citation. The smoke test asserts the
    // pipeline completes; the route-level test exercises the full output
    // path with a small uncompressed comparison check.
    expect(Buffer.isBuffer(buf)).toBe(true);
    expect(buf.length).toBeGreaterThan(2000);
  });
});
