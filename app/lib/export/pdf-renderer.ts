// app/lib/export/pdf-renderer.ts
//
// Render a ParsedStudy to a PDF Buffer. Pure server-side; uses PDFKit with
// bundled Noto Sans (body, Latin + Greek), Noto Sans Hebrew, and Fraunces
// (display serif used for section headings + drop cap, mirroring the reader's
// `--font-display` styling). All fonts are OFL — see app/public/fonts/OFL-*.txt.
// The renderer never refetches verse text; it consumes whatever the reader
// currently has on screen (passed in as markdown), so cap/cache compliance
// is inherited from the swap engine — see lib/translations/swap-engine.ts.
//
// Layout: US Letter, 1-inch margins. Cover header (serif title) → condensed
// table of contents (H1/H2 only) → body → legal page. Section H2s render in
// uppercase Fraunces Bold with tracking; the Summary's first paragraph gets a
// 36pt italic Fraunces drop cap in sage to match the reader's
// `[data-section-key="summary"] p:first-of-type::first-letter` rule.

import path from "node:path";
import PDFDocument from "pdfkit";
import { config } from "@/lib/config";
import { CITATIONS } from "@/lib/translations/citations";
import {
  TRANSLATIONS,
  type TranslationId,
} from "@/lib/translations/registry";
import type {
  Block,
  InlineSegment,
  ParsedStudy,
} from "./markdown-parser";

const FONT_DIR = path.join(process.cwd(), "public", "fonts");
const FONTS = {
  body: path.join(FONT_DIR, "NotoSans-Regular.ttf"),
  bold: path.join(FONT_DIR, "NotoSans-Bold.ttf"),
  italic: path.join(FONT_DIR, "NotoSans-Italic.ttf"),
  boldItalic: path.join(FONT_DIR, "NotoSans-BoldItalic.ttf"),
  hebrew: path.join(FONT_DIR, "NotoSansHebrew-Regular.ttf"),
  // Display serif — used for the cover title, section H2s (uppercase), and
  // the Summary drop cap. Static 72pt optical-size instances since headings
  // are rendered large.
  displayBold: path.join(FONT_DIR, "Fraunces-Bold.ttf"),
  displayItalic: path.join(FONT_DIR, "Fraunces-Italic.ttf"),
} as const;

// Type aliases — PDFKit's text() options need a font key, so we pass strings.
type FontKey =
  | "body"
  | "bold"
  | "italic"
  | "boldItalic"
  | "hebrew"
  | "displayBold"
  | "displayItalic";

type PDFKitDoc = InstanceType<typeof PDFDocument>;

const PAGE_OPTIONS = {
  size: "LETTER" as const,
  margins: { top: 72, bottom: 72, left: 72, right: 72 },
  bufferPages: true,
};

// Font sizes (pt).
const SIZE = {
  title: 28,
  h1: 18,
  h2: 18,
  h3: 13,
  h4: 11.5,
  body: 11,
  scriptureBody: 11,
  scriptureRef: 9,
  blockquote: 11,
  list: 11,
  footer: 8,
  legal: 9,
  toc: 11,
  tocTitle: 14,
  dropCap: 44,
} as const;

const COLOR = {
  ink: "#1f2933",
  muted: "#52606d",
  rule: "#cbd2d9",
  scripture: "#3e4c59",
  // sage-700 — matches the reader's --reader-accent-deep used for the drop cap.
  sage: "#3d4f35",
  // Warm tan — matches the reader's --warmth used for the eyebrow hairlines.
  warmth: "#c49a6c",
  // sage-500 — left border on scripture quotes (--reader-accent in light mode).
  sageBorder: "#6b8060",
  // Pre-computed solid equivalents of the reader's transparent washes.
  // Scripture-quote bed: rgba(107,128,96,0.05) over the cream page bg ≈ #f3f3ee.
  scriptureBed: "#f1f3ec",
  // Outside-historical-context bed: gradient rgba(220,228,215,0.8) → rgba(221,217,208,0.4)
  // — averaged into a single solid since PDFKit gradients aren't worth the cost
  // for a small box. Lands close to a soft sage-cream.
  outsideBed: "#e6e7da",
  outsideBorder: "#c49a6c",
} as const;

export interface PdfRenderOptions {
  /** The translation the reader is currently viewing — drives copyright + footer. */
  translation: TranslationId;
  /** Study metadata for the cover block. */
  study: {
    id: number;
    title: string;
    /** ISO date string. */
    generatedAt: string;
    /**
     * Editorial-hero metadata, mirroring the reader's StudyHero.
     * `formatType` drives the eyebrow ("A Standard Study", "A Quick Study"...).
     * `byline` is the study author and MUST be the same value the reader
     * renders (display_name fallback to username) — required so the export
     * never silently disagrees with the reader's attribution.
     */
    formatType: string;
    byline: string;
  };
}

/** Heading entry recorded during body rendering for the TOC pass. */
interface TocEntry {
  level: 1 | 2 | 3;
  text: string;
  pageIndex: number; // 0-based PDFKit page index
}

/**
 * Render a parsed study to a PDF. Returns a Buffer the caller can stream
 * to R2 or directly to the client.
 *
 * Pipeline:
 *   1. Cover page — title + meta + rule.
 *   2. TOC page(s) — hierarchical list of H1/H2/H3 (no page numbers, mirrors
 *      the Acts 16 reference layout). Rendered straight after the cover so
 *      it can naturally flow onto a second page if the study is large.
 *   3. Body — blocks rendered sequentially. The Summary's first paragraph
 *      runs through drawDropCapParagraph instead of drawParagraph.
 *   4. Legal page — copyright + publisher link.
 *   5. Running footer applied to every page.
 */
export async function renderStudyToPdf(
  parsed: ParsedStudy,
  opts: PdfRenderOptions,
): Promise<Buffer> {
  const doc = new PDFDocument(PAGE_OPTIONS);
  registerFonts(doc);

  const chunks: Buffer[] = [];
  doc.on("data", (chunk: Buffer) => chunks.push(chunk));

  const done: Promise<Buffer> = new Promise((resolve, reject) => {
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);
  });

  drawHeader(doc, parsed, opts);

  // TOC immediately after the cover. With no page numbers we can render in
  // a single forward pass straight from `parsed.headings`.
  doc.addPage();
  const tocEntries: TocEntry[] = [
    {
      level: 1,
      text: parsed.title || opts.study.title,
      pageIndex: 0,
    },
    ...parsed.headings
      .filter((h) => h.level === 2 || h.level === 3)
      .map((h) => ({
        level: h.level as 2 | 3,
        text: h.text,
        pageIndex: 0,
      })),
  ];
  drawTableOfContents(doc, tocEntries);

  // Body starts on a fresh page.
  doc.addPage();

  // Summary detection — the first H2 whose text equals "Summary" qualifies
  // its first paragraph for drop cap treatment, mirroring the reader's
  // [data-section-key="summary"] selector.
  let inSummarySection = false;
  let summaryFirstParaPending = false;

  // We queue contiguous headings and only render them when the next non-
  // heading block (a callout, paragraph, list, etc.) is about to be drawn.
  // That lets us call ensureSpaceFor() on `headings + next-block` together,
  // so a section header never lands stranded at the bottom of a page while
  // its scripture quote starts the next page.
  type HeadingBlock = Extract<Block, { type: "heading" }>;
  let pendingHeadings: HeadingBlock[] = [];

  const flushHeadings = (followingBlockHeight: number): void => {
    if (pendingHeadings.length === 0) return;
    // De-dupe: when an H3 immediately follows an H2 whose trailing
    // parenthetical reference is the same string (e.g. H2 "...
    // (Ephesians 1:5–6)" → H3 "Ephesians 1:5–6"), the H3 is redundant
    // because the H2 subline already shows it. Drop the H3 so we don't
    // print the same reference twice.
    const deduped: HeadingBlock[] = [];
    for (const h of pendingHeadings) {
      const prev = deduped[deduped.length - 1];
      if (
        prev &&
        prev.level === 2 &&
        h.level === 3 &&
        sectionRefFromHeading(prev) === inlinesToPlainText(h.inlines).trim()
      ) {
        continue;
      }
      deduped.push(h);
    }
    const headingsHeight = deduped.reduce(
      (acc, h) => acc + estimateHeadingHeight(h),
      0,
    );
    ensureSpaceFor(doc, headingsHeight + followingBlockHeight);
    for (const h of deduped) drawHeading(doc, h);
    pendingHeadings = [];
  };

  for (const block of parsed.blocks) {
    // Skip the document H1 in the body — it's already the cover title.
    if (block.type === "heading" && block.level === 1) continue;

    if (block.type === "heading") {
      // Track Summary state on the H2 — order doesn't depend on
      // rendering, so this is safe to update at queue time.
      if (block.level === 2) {
        const headingText = inlinesToPlainText(block.inlines).trim().toLowerCase();
        if (headingText === "summary") {
          inSummarySection = true;
          summaryFirstParaPending = true;
        } else {
          inSummarySection = false;
          summaryFirstParaPending = false;
        }
      }
      pendingHeadings.push(block);
      continue;
    }

    // Non-heading block — flush any queued headings first, reserving
    // enough room for them plus a baseline of body content.
    const followingHeight = estimateBlockHeight(doc, block);
    flushHeadings(followingHeight);

    if (
      summaryFirstParaPending &&
      inSummarySection &&
      block.type === "paragraph"
    ) {
      drawDropCapParagraph(doc, block.inlines);
      doc.moveDown(0.4);
      summaryFirstParaPending = false;
      continue;
    }

    drawBlock(doc, block);
  }
  // Drain any trailing headings (rare — usually a study ends with content).
  flushHeadings(20);

  drawLegalSection(doc, opts.translation);

  applyRunningFooter(doc, opts.translation);

  doc.end();
  return done;
}

function registerFonts(doc: PDFKitDoc): void {
  doc.registerFont("body", FONTS.body);
  doc.registerFont("bold", FONTS.bold);
  doc.registerFont("italic", FONTS.italic);
  doc.registerFont("boldItalic", FONTS.boldItalic);
  doc.registerFont("hebrew", FONTS.hebrew);
  doc.registerFont("displayBold", FONTS.displayBold);
  doc.registerFont("displayItalic", FONTS.displayItalic);
}

function drawHeader(
  doc: PDFKitDoc,
  parsed: ParsedStudy,
  opts: PdfRenderOptions,
): void {
  // Editorial hero — mirrors components/reader/study-hero.tsx so the export's
  // cover page reads as a chapter-title page rather than a memo header.
  // Vertically centered stack: eyebrow → italic title line → uppercase
  // display line → subtitle → byline → short hairline rule.
  const fullTitle = parsed.title || opts.study.title;
  const { italLine, displayLine, subtitle } = splitTitle(fullTitle);
  const eyebrow = `A ${capitalize(opts.study.formatType)} Study`;
  const byline = opts.study.byline;
  const date = formatDate(opts.study.generatedAt);

  const left = doc.page.margins.left;
  const fullWidth = doc.page.width - left - doc.page.margins.right;
  const cx = doc.page.width / 2;

  // Length-aware display sizing — short single words ("PETER") get the
  // dramatic 9.5vw treatment; longer phrases scale down so the cover doesn't
  // overflow horizontally.
  const len = displayLine.length;
  const displaySize =
    len <= 12
      ? 64
      : len <= 24
        ? 44
        : len <= 48
          ? 28
          : 22;

  // Position the stack vertically. We start ~22% down the page so the cover
  // breathes top and bottom.
  doc.x = left;
  doc.y = doc.page.height * 0.22;

  // ── Eyebrow with hairlines ──
  doc.font("displayItalic").fontSize(11).fillColor(COLOR.muted);
  const eyebrowW = doc.widthOfString(eyebrow);
  const hairlineW = 32;
  const gap = 10;
  const eyebrowGroupW = hairlineW * 2 + gap * 2 + eyebrowW;
  const eyebrowStart = cx - eyebrowGroupW / 2;
  const eyebrowMidY = doc.y + 6; // baseline-ish for thin rule
  doc
    .save()
    .moveTo(eyebrowStart, eyebrowMidY)
    .lineTo(eyebrowStart + hairlineW, eyebrowMidY)
    .strokeColor(COLOR.warmth)
    .lineWidth(0.6)
    .stroke()
    .restore();
  doc.text(eyebrow, eyebrowStart + hairlineW + gap, doc.y, {
    width: eyebrowW + 2,
    lineBreak: false,
  });
  doc
    .save()
    .moveTo(eyebrowStart + hairlineW + gap + eyebrowW + gap, eyebrowMidY)
    .lineTo(eyebrowStart + eyebrowGroupW, eyebrowMidY)
    .strokeColor(COLOR.warmth)
    .lineWidth(0.6)
    .stroke()
    .restore();
  doc.x = left;
  doc.moveDown(2.0);

  // ── Italic line ──
  if (italLine) {
    doc
      .font("displayItalic")
      .fontSize(28)
      .fillColor(COLOR.ink)
      .text(italLine, left, doc.y, {
        width: fullWidth,
        align: "center",
        lineBreak: false,
      });
    doc.moveDown(0.25);
  }

  // ── Display line (uppercase) ──
  doc
    .font("displayBold")
    .fontSize(displaySize)
    .fillColor(COLOR.ink)
    .text(displayLine.toUpperCase(), left, doc.y, {
      width: fullWidth,
      align: "center",
      characterSpacing: -0.3,
      lineBreak: false,
    });
  doc.moveDown(0.6);

  // ── Subtitle (serif italic to keep the editorial register) ──
  if (subtitle) {
    doc
      .font("displayItalic")
      .fontSize(14)
      .fillColor(COLOR.muted)
      .text(subtitle, left, doc.y, {
        width: fullWidth,
        align: "center",
        lineBreak: false,
      });
    doc.moveDown(1.2);
  } else {
    doc.moveDown(0.6);
  }

  // ── Byline (uppercase letterspaced) ──
  doc
    .font("body")
    .fontSize(SIZE.footer)
    .fillColor(COLOR.muted)
    .text(`BY ${byline.toUpperCase()}  •  ${date.toUpperCase()}`, left, doc.y, {
      width: fullWidth,
      align: "center",
      characterSpacing: 1.4,
      lineBreak: false,
    });
  doc.moveDown(1.2);

  // ── Short hairline rule ──
  const ruleW = 56;
  const ruleY = doc.y + 4;
  doc
    .save()
    .moveTo(cx - ruleW / 2, ruleY)
    .lineTo(cx + ruleW / 2, ruleY)
    .strokeColor(COLOR.ink)
    .opacity(0.32)
    .lineWidth(0.6)
    .stroke()
    .restore();

  // ── Translation tag at the bottom of the cover (subtle) ──
  doc
    .font("body")
    .fontSize(SIZE.footer)
    .fillColor(COLOR.muted)
    .text(
      `${opts.translation} · ${TRANSLATIONS[opts.translation].fullName}`,
      left,
      doc.page.height - doc.page.margins.bottom - 18,
      {
        width: fullWidth,
        align: "center",
        characterSpacing: 1.0,
        lineBreak: false,
        height: 16,
      },
    );

  // Reset position for any caller that doesn't immediately addPage.
  doc.x = left;
}

/**
 * Best-effort split of a study title into editorial hero parts.
 *
 * "Chosen Before the Foundation: Identity in Ephesians 1" splits as:
 *   italLine    = "Chosen Before the"
 *   displayLine = "Foundation"
 *   subtitle    = "Identity in Ephesians 1"
 *
 * Mirrors components/reader/study-reader.tsx splitTitle().
 */
function splitTitle(title: string): {
  italLine: string;
  displayLine: string;
  subtitle: string | undefined;
} {
  const colonMatch = title.match(/^(.*?):\s*(.+)$/);
  if (colonMatch) {
    const [, before, after] = colonMatch;
    const beforeWords = before.trim().split(/\s+/);
    if (beforeWords.length > 1) {
      const displayLine = beforeWords[beforeWords.length - 1];
      const italLine = beforeWords.slice(0, -1).join(" ");
      return { italLine, displayLine, subtitle: after.trim() };
    }
    return { italLine: "", displayLine: before.trim(), subtitle: after.trim() };
  }
  return { italLine: "", displayLine: title, subtitle: undefined };
}

function capitalize(s: string): string {
  if (!s) return "";
  return s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();
}

function drawTableOfContents(doc: PDFKitDoc, toc: TocEntry[]): void {
  const left = doc.page.margins.left;
  const right = doc.page.margins.right;
  const fullWidth = doc.page.width - left - right;
  doc.x = left;
  doc.y = doc.page.margins.top;

  // "Table of Contents" — sentence case, large display serif (matches the
  // Acts 16 study reference the user pointed at).
  doc
    .font("displayBold")
    .fontSize(SIZE.tocTitle)
    .fillColor(COLOR.ink)
    .text("Table of Contents");
  doc.moveDown(1.2);

  // Hierarchical list, no page numbers / no leaders. Indent grows by level.
  // Indentation per level (in points). Visually mirrors the Acts 16 PDF.
  const INDENT_PER_LEVEL = 24;
  for (const entry of toc) {
    const indent = (entry.level - 1) * INDENT_PER_LEVEL;
    const rowX = left + indent;
    // H1 → bold; H2 → regular; H3 → muted regular (deeper hierarchy hint).
    if (entry.level === 1) {
      doc.font("bold").fontSize(SIZE.toc).fillColor(COLOR.ink);
    } else if (entry.level === 2) {
      doc.font("body").fontSize(SIZE.toc).fillColor(COLOR.ink);
    } else {
      doc.font("body").fontSize(SIZE.toc).fillColor(COLOR.muted);
    }
    const rowWidth = fullWidth - indent;
    const rowY = doc.y;
    doc.text(entry.text, rowX, rowY, {
      width: rowWidth,
      lineBreak: false,
      ellipsis: true,
    });
    // Tighter spacing for H3 children, looser for H1/H2 sections.
    doc.moveDown(entry.level === 3 ? 0.35 : 0.55);
    doc.x = left;
    doc.fillColor(COLOR.ink);
  }
}

function drawBlock(doc: PDFKitDoc, block: Block): void {
  switch (block.type) {
    case "heading":
      drawHeading(doc, block);
      return;
    case "paragraph":
      drawParagraph(doc, block.inlines, {
        size: SIZE.body,
        color: COLOR.ink,
        indent: 0,
        italic: false,
      });
      doc.moveDown(0.4);
      return;
    case "scripture_quote":
      drawScriptureQuote(
        doc,
        block.inlines,
        block.reference,
        block.translation,
      );
      return;
    case "blockquote":
      drawParagraph(doc, block.inlines, {
        size: SIZE.blockquote,
        color: COLOR.scripture,
        indent: 24,
        italic: true,
      });
      doc.moveDown(0.4);
      return;
    case "unordered_list":
      drawList(doc, block.items, "•");
      return;
    case "ordered_list":
      drawList(doc, block.items, null);
      return;
    case "horizontal_rule":
      doc.moveDown(0.4);
      drawRule(doc);
      doc.moveDown(0.4);
      return;
  }
}

function drawHeading(
  doc: PDFKitDoc,
  block: Extract<Block, { type: "heading" }>,
): void {
  const sizes = [SIZE.h1, SIZE.h2, SIZE.h3, SIZE.h4];
  const size = sizes[block.level - 1] ?? SIZE.body;
  const text = inlinesToPlainText(block.inlines);

  // Pre-spacing — H2 sections get a bigger air gap than H3 subheads so the
  // reader feels each major section open up cleanly. Widow/orphan control
  // for the heading itself lives in the queued-flush logic in
  // renderStudyToPdf, which reserves space for `heading + next block`
  // together so a heading never strands itself at the bottom of a page.
  doc.moveDown(block.level === 2 ? 1.1 : block.level === 3 ? 0.7 : 0.5);

  // Section headings (H1/H2) use Fraunces Bold uppercase with tracking to
  // match the reader's section-header.tsx styling. Subheadings (H3/H4) stay
  // in the body sans-serif — they sit close to body copy.
  if (block.level <= 2) {
    // Trailing parenthetical references like "(Ephesians 1:5–6)" wrap badly
    // when force-uppercased into a 18pt display heading — PDFKit happily
    // breaks inside the en-dash and leaves "6)" stranded on its own line.
    // Pull the reference out and render it as a smaller subline beneath
    // the title so the display row stays clean.
    const refMatch = text.match(/^(.+?)\s*\(([^)]+)\)\s*$/);
    const titlePart = refMatch ? refMatch[1].trim() : text;
    const refPart = refMatch && /\d+/.test(refMatch[2]) ? refMatch[2].trim() : null;

    doc.font("displayBold").fontSize(size).fillColor(COLOR.ink);
    doc.text(titlePart.toUpperCase(), {
      paragraphGap: refPart ? 0 : 4,
      characterSpacing: 0.8,
    });
    if (refPart) {
      doc.moveDown(0.15);
      doc
        .font("displayItalic")
        .fontSize(SIZE.h3)
        .fillColor(COLOR.muted)
        .text(refPart, { paragraphGap: 4 });
    }
  } else {
    doc.font("bold").fontSize(size).fillColor(COLOR.ink);
    doc.text(text, { paragraphGap: 4 });
  }
}

/**
 * Render a paragraph with a Fraunces italic drop cap on its first letter,
 * mirroring the reader's [data-section-key="summary"] p:first-of-type::
 * first-letter rule.
 *
 * Layout: drop cap sits at the upper-left in sage. The remainder of the
 * paragraph wraps in two phases: phase 1 fits next to the drop cap at a
 * reduced width; phase 2 resumes at full width below the drop cap. We split
 * on whichever inline segment boundary lands inside the drop cap region —
 * for typical Summary paragraphs (~10 lines, italics only at the tail) the
 * drop cap region is plain text, so a single-segment split is fine.
 */
function drawDropCapParagraph(doc: PDFKitDoc, inlines: InlineSegment[]): void {
  const left = doc.page.margins.left;
  const right = doc.page.margins.right;
  const fullWidth = doc.page.width - left - right;
  const y0 = doc.y;
  doc.x = left;
  doc.fillColor(COLOR.ink);

  // Pull off the first character for the drop cap.
  const adjusted = inlines.map((s) => ({ ...s }));
  let firstLetter = "";
  for (const seg of adjusted) {
    if (seg.text && seg.text.length > 0) {
      firstLetter = seg.text[0];
      seg.text = seg.text.slice(1);
      break;
    }
  }
  if (!firstLetter) {
    drawParagraph(doc, inlines, {
      size: SIZE.body,
      color: COLOR.ink,
      indent: 0,
      italic: false,
    });
    return;
  }

  // Render drop cap. We pad the visual baseline up a few points so the cap's
  // x-height aligns with the body cap-height of the first wrapped line, which
  // is what the reader's CSS achieves with line-height: 0.9.
  doc.font("displayItalic").fontSize(SIZE.dropCap).fillColor(COLOR.sage);
  const capWidth = doc.widthOfString(firstLetter);
  // Match the wrap region to ~3 body lines (Summary's typical drop cap span).
  // Body line-height is fontSize + lineGap = 13pt; 3 lines ≈ 39pt.
  const capHeight = SIZE.body * 3 + 2 * 3; // 3 lines × (size + lineGap)
  const capPadRight = 8;
  doc.text(firstLetter, left, y0 - 4, { lineBreak: false });
  doc.fillColor(COLOR.ink);

  // Decide split point in the joined plain text using a binary search on
  // PDFKit's heightOfString — we want the largest prefix whose rendered
  // height at reducedWidth still fits in capHeight.
  const reducedWidth = fullWidth - capWidth - capPadRight;
  doc.font("body").fontSize(SIZE.body);
  const joined = adjusted.map((s) => s.text).join("");
  let lo = 0;
  let hi = joined.length;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    const h = doc.heightOfString(joined.slice(0, mid), {
      width: reducedWidth,
      lineGap: 3,
    });
    if (h <= capHeight) lo = mid;
    else hi = mid - 1;
  }
  // Snap split back to nearest space so we don't break a word.
  let splitChar = lo;
  while (splitChar > 0 && joined[splitChar] !== " " && joined[splitChar - 1] !== " ") {
    splitChar--;
  }
  if (splitChar === 0) splitChar = lo; // paragraph is one long word; split anywhere.

  // Convert the joined-string offset into (segmentIndex, intraSegmentOffset).
  let cum = 0;
  let segIdx = 0;
  let segOff = 0;
  for (let i = 0; i < adjusted.length; i++) {
    const segLen = adjusted[i].text.length;
    if (cum + segLen >= splitChar) {
      segIdx = i;
      segOff = splitChar - cum;
      break;
    }
    cum += segLen;
    segIdx = i + 1;
    segOff = 0;
  }

  const phase1: InlineSegment[] = [];
  const phase2: InlineSegment[] = [];
  for (let i = 0; i < adjusted.length; i++) {
    if (i < segIdx) {
      phase1.push(adjusted[i]);
    } else if (i > segIdx) {
      phase2.push(adjusted[i]);
    } else {
      // Boundary segment — split it at segOff.
      const head = adjusted[i].text.slice(0, segOff);
      const tail = adjusted[i].text.slice(segOff);
      if (head.length > 0) phase1.push({ ...adjusted[i], text: head });
      if (tail.length > 0) phase2.push({ ...adjusted[i], text: tail });
    }
  }

  // Phase 1: render next to the drop cap with reduced width.
  doc.x = left + capWidth + capPadRight;
  doc.y = y0;
  drawInlineRun(doc, phase1, {
    width: reducedWidth,
    size: SIZE.body,
    italic: false,
  });

  // Phase 2: continue below the drop cap at full width. Advance y to at least
  // y0 + capHeight + a little so the next line doesn't tuck under the cap.
  if (doc.y < y0 + capHeight) {
    doc.y = y0 + capHeight + 2;
  }
  doc.x = left;
  drawInlineRun(doc, phase2, {
    width: fullWidth,
    size: SIZE.body,
    italic: false,
  });
}

/**
 * Helper: render a sequence of inline segments at the current (doc.x, doc.y)
 * with continued: true between segments so they flow as one paragraph.
 */
function drawInlineRun(
  doc: PDFKitDoc,
  inlines: InlineSegment[],
  opts: { width: number; size: number; italic: boolean },
): void {
  const nonEmpty = inlines.filter((s) => s.text && s.text.length > 0);
  if (nonEmpty.length === 0) return;
  for (let i = 0; i < nonEmpty.length; i++) {
    const seg = nonEmpty[i];
    const isLast = i === nonEmpty.length - 1;
    doc.font(fontKeyForSegment(seg, opts.italic));
    doc.fontSize(opts.size);
    doc.text(seg.text, {
      continued: !isLast,
      width: opts.width,
      lineGap: 3,
    });
  }
}

function drawParagraph(
  doc: PDFKitDoc,
  inlines: InlineSegment[],
  opts: {
    size: number;
    color: string;
    indent: number;
    italic: boolean;
  },
): void {
  const left = doc.page.margins.left + opts.indent;
  const right = doc.page.margins.right;
  const width = doc.page.width - left - right;
  doc.x = left;
  doc.fillColor(opts.color);

  // Render each inline segment with the right font run. We use PDFKit's
  // continued: true so the segments flow as a single paragraph — only the
  // last segment in the line drops continuation to commit a paragraph break.
  for (let i = 0; i < inlines.length; i++) {
    const seg = inlines[i];
    if (!seg.text) continue;
    const isLast = i === inlines.length - 1;
    doc.font(fontKeyForSegment(seg, opts.italic));
    doc.fontSize(opts.size);
    doc.text(seg.text, {
      continued: !isLast,
      width,
      lineGap: 3,
    });
  }
  // Reset x for subsequent blocks.
  doc.x = doc.page.margins.left;
}

function drawScriptureQuote(
  doc: PDFKitDoc,
  inlines: InlineSegment[],
  reference: string,
  translation: string,
): void {
  // Mirrors components/reader/scripture-block.tsx — rounded sage-tinted bed
  // with a 3pt sage left bar; italic Fraunces text inside; right-aligned
  // muted citation on its own line.
  doc.moveDown(0.4);

  const left = doc.page.margins.left;
  const right = doc.page.margins.right;
  const fullWidth = doc.page.width - left - right;
  const padX = 18;
  const padY = 16;
  const barW = 3;
  const innerLeft = left + barW + padX;
  const innerWidth = fullWidth - barW - padX * 2;

  // Pre-measure body height with body italic + small space + citation line.
  const joinedBody = inlines.map((s) => s.text).join("");
  doc.font("italic").fontSize(SIZE.scriptureBody);
  const bodyHeight = doc.heightOfString(joinedBody, {
    width: innerWidth,
    lineGap: 3,
  });
  const citation = `— ${reference} (${translation})`;
  doc.font("body").fontSize(SIZE.scriptureRef);
  const citationHeight = doc.heightOfString(citation, {
    width: innerWidth,
    align: "right",
  });
  const blockHeight = padY * 2 + bodyHeight + 6 + citationHeight;
  // Keep the entire callout on one page. If the block won't fit between the
  // current y and the bottom margin, advance to a new page first — otherwise
  // the box stays on the current page while the text auto-paginates without
  // it (the "naked text + floating citation" failure on pp. 7–9 / 12–14 of
  // the prior export). For callouts taller than a single content area we
  // still let it overflow rather than truncate; that's vanishingly rare for
  // scripture quotes (longest seen is ~150 pt).
  ensureSpaceFor(doc, blockHeight);
  const blockY = doc.y;

  // Background bed (rounded right corners, square left where the bar sits).
  doc
    .save()
    .roundedRect(left, blockY, fullWidth, blockHeight, 6)
    .fillColor(COLOR.scriptureBed)
    .fill()
    .restore();
  // Left accent bar.
  doc
    .save()
    .rect(left, blockY, barW, blockHeight)
    .fillColor(COLOR.sageBorder)
    .fill()
    .restore();

  // Body text.
  doc.x = innerLeft;
  doc.y = blockY + padY;
  doc.fillColor(COLOR.scripture);
  drawInlineRun(doc, inlines, {
    width: innerWidth,
    size: SIZE.scriptureBody,
    italic: true,
  });

  // Citation, right-aligned, on its own line below the body.
  doc.x = innerLeft;
  doc.y = blockY + padY + bodyHeight + 6;
  doc
    .font("body")
    .fontSize(SIZE.scriptureRef)
    .fillColor(COLOR.muted)
    .text(citation, innerLeft, doc.y, {
      width: innerWidth,
      align: "right",
      lineBreak: false,
    });

  // Advance past the block.
  doc.x = left;
  doc.y = blockY + blockHeight;
  doc.moveDown(0.6);
  doc.fillColor(COLOR.ink);
}

function drawList(
  doc: PDFKitDoc,
  items: InlineSegment[][],
  bullet: string | null,
): void {
  const left = doc.page.margins.left;
  for (let idx = 0; idx < items.length; idx++) {
    const item = items[idx];
    // Outside-historical-context callout — items where the parser flagged a
    // leading mountain icon. Mirrors `.historical-context li[data-outside]`
    // in globals.css: rounded sand bed + warm tan border + ⛰ marker.
    const isOutside = item.some((s) => s.mountainIcon);
    if (isOutside) {
      drawOutsideCalloutItem(doc, item);
      continue;
    }

    const marker = bullet ?? `${idx + 1}.`;
    doc.x = left;
    doc.font("body").fontSize(SIZE.list).fillColor(COLOR.ink);
    doc.text(`${marker}  `, { continued: true, lineGap: 3 });
    for (let j = 0; j < item.length; j++) {
      const seg = item[j];
      if (!seg.text) continue;
      const isLast = j === item.length - 1;
      doc.font(fontKeyForSegment(seg, false));
      doc.fontSize(SIZE.list);
      // Apply paragraphGap on the final segment of each bullet so consecutive
      // bullets get a small breath of space — without this, multi-line bullets
      // touch each other and the list reads as a wall of text.
      doc.text(seg.text, {
        continued: !isLast,
        lineGap: 3,
        paragraphGap: isLast ? 4 : 0,
      });
    }
  }
  doc.moveDown(0.4);
  doc.x = left;
}

/**
 * Render a single bullet item as a sage/sand callout box with the ⛰ icon —
 * the PDF equivalent of the reader's outside-historical-context treatment.
 */
function drawOutsideCalloutItem(
  doc: PDFKitDoc,
  item: InlineSegment[],
): void {
  const left = doc.page.margins.left;
  const right = doc.page.margins.right;
  const fullWidth = doc.page.width - left - right;
  const padX = 16;
  const padY = 12;
  const iconCol = 24;
  const innerLeft = left + padX + iconCol;
  const innerWidth = fullWidth - padX * 2 - iconCol;

  // Strip the mountain marker — it's a flag on the segment, not literal text,
  // since the parser already removed the "⛰️" prefix from the text.
  const cleaned = item
    .filter((s) => s.text && s.text.length > 0)
    .map((s) => ({ ...s }));

  // Pre-measure rendered height assuming body font (callout text is plain prose).
  const joined = cleaned.map((s) => s.text).join("");
  doc.font("body").fontSize(SIZE.list);
  const textHeight = doc.heightOfString(joined, {
    width: innerWidth,
    lineGap: 3,
  });
  const blockHeight = padY * 2 + textHeight;
  // Same page-break-before rule as drawScriptureQuote — never let the box
  // and its text disagree about which page they live on.
  ensureSpaceFor(doc, blockHeight);
  const blockY = doc.y;

  // Background bed.
  doc
    .save()
    .roundedRect(left, blockY, fullWidth, blockHeight, 6)
    .fillColor(COLOR.outsideBed)
    .fill()
    .restore();
  // 1pt warm-tan border.
  doc
    .save()
    .roundedRect(left, blockY, fullWidth, blockHeight, 6)
    .strokeColor(COLOR.outsideBorder)
    .lineWidth(0.7)
    .stroke()
    .restore();

  // Mountain glyph drawn as a vector path — Noto Sans doesn't ship U+26F0,
  // and falling through to a substitution font produced a tofu square.
  // Draw a simple two-peak silhouette in warmth to match the reader marker.
  const iconX = left + padX;
  const iconY = blockY + padY + 2;
  const w = 14;
  const h = 10;
  doc
    .save()
    .moveTo(iconX, iconY + h)
    .lineTo(iconX + w * 0.35, iconY)
    .lineTo(iconX + w * 0.55, iconY + h * 0.4)
    .lineTo(iconX + w * 0.7, iconY + h * 0.2)
    .lineTo(iconX + w, iconY + h)
    .closePath()
    .fillColor(COLOR.warmth)
    .fill()
    .restore();

  // Body text.
  doc.x = innerLeft;
  doc.y = blockY + padY;
  doc.fillColor(COLOR.sage);
  drawInlineRun(doc, cleaned, {
    width: innerWidth,
    size: SIZE.list,
    italic: false,
  });

  // Advance past the block with a little breathing room.
  doc.x = left;
  doc.y = blockY + blockHeight;
  doc.moveDown(0.4);
  doc.fillColor(COLOR.ink);
}

/**
 * If `neededHeight` won't fit between the current y and the page's bottom
 * margin, advance to a new page first. Used to keep callouts from splitting
 * across pages and to keep headings paired with their content.
 */
function ensureSpaceFor(doc: PDFKitDoc, neededHeight: number): void {
  if (doc.y + neededHeight > doc.page.maxY()) {
    doc.addPage();
  }
}

/**
 * Approximate rendered height of a heading block. Conservative — favors
 * over-reserving space so we don't strand headings at page bottoms. Used
 * by the queued-flush logic in renderStudyToPdf.
 */
function estimateHeadingHeight(
  block: Extract<Block, { type: "heading" }>,
): number {
  const sizes = [SIZE.h1, SIZE.h2, SIZE.h3, SIZE.h4];
  const size = sizes[block.level - 1] ?? SIZE.body;
  const text = inlinesToPlainText(block.inlines);
  if (block.level <= 2) {
    // H2: pre-spacing (≈22pt) + heading (one or two lines × size×1.1) +
    // optional ref subline (≈16pt) + paragraph gap (≈4pt).
    const hasRef = /^(.+?)\s*\(([^)]+)\)\s*$/.test(text) && /\d/.test(text);
    const lineCount = text.length > 30 ? 2 : 1;
    return 22 + size * 1.1 * lineCount + (hasRef ? 18 : 0) + 4;
  }
  // H3 / H4: smaller pre-spacing + 1 line.
  return 14 + size * 1.4 + 4;
}

/**
 * Approximate rendered height of a non-heading block — used by the
 * heading-queue flush so we can decide whether to start the heading on a
 * fresh page. Doesn't need to be exact: scripture quotes/mountain
 * callouts call ensureSpaceFor themselves before drawing, so a coarse
 * estimate that's "big enough" suffices.
 */
function estimateBlockHeight(
  doc: PDFKitDoc,
  block: Block,
): number {
  switch (block.type) {
    case "scripture_quote": {
      // Pre-measure body text height at the callout's inner width and add
      // padding + citation row. Mirrors drawScriptureQuote's own math.
      const left = doc.page.margins.left;
      const fullWidth = doc.page.width - left - doc.page.margins.right;
      const innerWidth = fullWidth - 3 - 18 * 2;
      const joined = block.inlines.map((s) => s.text).join("");
      doc.font("italic").fontSize(SIZE.scriptureBody);
      const bodyH = doc.heightOfString(joined, { width: innerWidth, lineGap: 3 });
      return 16 * 2 + bodyH + 6 + 12 + 12; // padY×2 + body + gap + citation + post-margin
    }
    case "blockquote":
      return 80;
    case "unordered_list":
    case "ordered_list":
      // Reserve at least one item's worth (~40pt) so the list starts on
      // the same page as its heading; subsequent items naturally
      // paginate.
      return Math.min(60, block.items.length * 30);
    case "paragraph":
      return 60;
    case "horizontal_rule":
      return 8;
    case "heading":
      // Shouldn't be called for headings — they go through the queue —
      // but fall back to the heading estimator just in case.
      return estimateHeadingHeight(block);
  }
}

/**
 * Extract the trailing parenthetical reference from an H2 heading text,
 * matching the same regex used inside drawHeading. Returns the captured
 * reference (e.g. "Ephesians 1:5–6") when present, or null.
 */
function sectionRefFromHeading(
  block: Extract<Block, { type: "heading" }>,
): string | null {
  if (block.level !== 2) return null;
  const text = inlinesToPlainText(block.inlines);
  const m = text.match(/^(.+?)\s*\(([^)]+)\)\s*$/);
  if (!m || !/\d/.test(m[2])) return null;
  return m[2].trim();
}

function drawRule(doc: PDFKitDoc): void {
  const x = doc.page.margins.left;
  const y = doc.y;
  const w = doc.page.width - doc.page.margins.left - doc.page.margins.right;
  doc.save().moveTo(x, y).lineTo(x + w, y).strokeColor(COLOR.rule).lineWidth(0.5).stroke().restore();
  doc.moveDown(0.2);
}

function drawLegalSection(doc: PDFKitDoc, translation: TranslationId): void {
  doc.addPage();
  doc.font("bold").fontSize(SIZE.h2).fillColor(COLOR.ink).text("Attributions");
  doc.moveDown(0.5);

  const citation = CITATIONS[translation];
  doc.font("body").fontSize(SIZE.legal).fillColor(COLOR.ink).text(
    citation.full,
    { lineGap: 3 },
  );
  doc.moveDown(0.6);

  if (citation.publisherLink) {
    doc.font("bold").fontSize(SIZE.legal).fillColor(COLOR.ink);
    doc.text("Publisher: ", { continued: true });
    doc.font("body").fillColor(COLOR.muted).text(citation.publisherLink.url);
    doc.fillColor(COLOR.ink);
    doc.moveDown(0.4);
  }

  doc
    .font("body")
    .fontSize(SIZE.legal)
    .fillColor(COLOR.muted)
    .text(
      `For full attribution details — including data sources for the knowledge graph and other translations — visit ${config.app.url}/attributions.`,
      { lineGap: 3 },
    );
}

function applyRunningFooter(doc: PDFKitDoc, translation: TranslationId): void {
  // Walk every emitted page and stamp the short copyright + page number.
  //
  // The footer y sits ~30pt past page.maxY() (i.e. inside the bottom margin).
  // PDFKit's text() auto-paginates when y + lineHeight > page.maxY(), which
  // would silently spawn an extra page per footer call. Passing a fixed
  // `height` switches PDFKit to truncate-on-overflow instead of paginating.
  const range = doc.bufferedPageRange();
  const total = range.start + range.count;
  for (let i = range.start; i < total; i++) {
    doc.switchToPage(i);
    const y = doc.page.height - doc.page.margins.bottom + 24;
    const left = doc.page.margins.left;
    const width =
      doc.page.width - doc.page.margins.left - doc.page.margins.right;
    const footerOpts = {
      width,
      height: 16,
      lineBreak: false as const,
    };
    doc
      .font("body")
      .fontSize(SIZE.footer)
      .fillColor(COLOR.muted)
      .text(CITATIONS[translation].short, left, y, {
        ...footerOpts,
        align: "left" as const,
      });
    doc.text(`Page ${i - range.start + 1} of ${range.count}`, left, y, {
      ...footerOpts,
      align: "right" as const,
    });
  }
  doc.fillColor(COLOR.ink);
}

// --- Helpers ---

function fontKeyForSegment(
  seg: InlineSegment,
  italicContext: boolean,
): FontKey {
  // Only Hebrew script needs the dedicated Noto Sans Hebrew face — Noto Sans
  // Regular already covers Greek (incl. polytonic). Routing Greek to the
  // Hebrew-only font produced tofu for Greek word-study glyphs in studies
  // like Ephesians 1.
  if (seg.hebrew) return "hebrew";
  if (seg.bold && (seg.italic || italicContext)) return "boldItalic";
  if (seg.bold) return "bold";
  if (seg.italic || italicContext) return "italic";
  return "body";
}

function inlinesToPlainText(inlines: InlineSegment[]): string {
  return inlines.map((s) => s.text).join("");
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}
