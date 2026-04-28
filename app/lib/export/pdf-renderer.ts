// app/lib/export/pdf-renderer.ts
//
// Render a ParsedStudy to a PDF Buffer. Pure server-side; uses PDFKit with
// bundled Noto Sans (Latin + Greek) and Noto Sans Hebrew (OFL — see
// app/public/fonts/OFL-*.txt). The renderer never refetches verse text;
// it consumes whatever the reader currently has on screen (passed in as
// markdown), which means cap/cache compliance is inherited from the swap
// engine — see lib/translations/swap-engine.ts.
//
// Layout choices kept deliberately conservative: US Letter, 1-inch margins,
// serif-free body, headings sized down sharply by level, scripture quotes
// indented + italicised with the citation right-aligned. The last page is
// the legal block: long-form copyright, publisher link, and a pointer to
// /attributions.

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
} as const;

// Type aliases — PDFKit's text() options need a font key, so we pass strings.
type FontKey = "body" | "bold" | "italic" | "boldItalic" | "hebrew";

type PDFKitDoc = InstanceType<typeof PDFDocument>;

const PAGE_OPTIONS = {
  size: "LETTER" as const,
  margins: { top: 72, bottom: 72, left: 72, right: 72 },
  bufferPages: true,
};

// Font sizes (pt).
const SIZE = {
  title: 22,
  h1: 18,
  h2: 15,
  h3: 13,
  h4: 11.5,
  body: 11,
  scriptureBody: 11,
  scriptureRef: 9,
  blockquote: 11,
  list: 11,
  footer: 8,
  legal: 9,
} as const;

const COLOR = {
  ink: "#1f2933",
  muted: "#52606d",
  rule: "#cbd2d9",
  scripture: "#3e4c59",
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
  };
}

/**
 * Render a parsed study to a PDF. Returns a Buffer the caller can stream
 * to R2 or directly to the client.
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
  for (const block of parsed.blocks) {
    drawBlock(doc, block);
  }
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
}

function drawHeader(
  doc: PDFKitDoc,
  parsed: ParsedStudy,
  opts: PdfRenderOptions,
): void {
  doc
    .font("bold")
    .fontSize(SIZE.title)
    .fillColor(COLOR.ink)
    .text(parsed.title || opts.study.title);

  doc.moveDown(0.4);
  doc
    .font("body")
    .fontSize(SIZE.footer)
    .fillColor(COLOR.muted)
    .text(
      `Translation: ${opts.translation} (${TRANSLATIONS[opts.translation].fullName}) · Generated ${formatDate(opts.study.generatedAt)} · Koinar`,
    );

  doc.moveDown(0.2);
  drawRule(doc);
  doc.moveDown(0.6);
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
  doc.moveDown(block.level === 1 ? 0.5 : 0.8);
  // Headings always render in the bold Latin face — Hebrew/Greek glyphs in
  // headings are rare and we let them fall through to the bold font (PDFKit
  // emits .notdef boxes for unsupported glyphs, but that's the long-tail).
  doc.font("bold").fontSize(size).fillColor(COLOR.ink);
  doc.text(inlinesToPlainText(block.inlines), {
    paragraphGap: 4,
  });
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
      lineGap: 2,
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
  doc.moveDown(0.3);
  drawParagraph(doc, inlines, {
    size: SIZE.scriptureBody,
    color: COLOR.scripture,
    indent: 24,
    italic: true,
  });
  // Citation line, right-aligned, smaller, muted.
  doc
    .font("body")
    .fontSize(SIZE.scriptureRef)
    .fillColor(COLOR.muted)
    .text(`— ${reference} (${translation})`, {
      align: "right",
    });
  doc.moveDown(0.5);
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
    const marker = bullet ?? `${idx + 1}.`;
    doc.x = left;
    doc.font("body").fontSize(SIZE.list).fillColor(COLOR.ink);
    doc.text(`${marker}  `, { continued: true });
    for (let j = 0; j < item.length; j++) {
      const seg = item[j];
      if (!seg.text) continue;
      const isLast = j === item.length - 1;
      doc.font(fontKeyForSegment(seg, false));
      doc.fontSize(SIZE.list);
      doc.text(seg.text, { continued: !isLast });
    }
  }
  doc.moveDown(0.4);
  doc.x = left;
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
    { lineGap: 2 },
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
      { lineGap: 2 },
    );
}

function applyRunningFooter(doc: PDFKitDoc, translation: TranslationId): void {
  // Walk every emitted page and stamp the short copyright + page number.
  const range = doc.bufferedPageRange();
  const total = range.start + range.count;
  for (let i = range.start; i < total; i++) {
    doc.switchToPage(i);
    const y = doc.page.height - doc.page.margins.bottom + 30;
    const left = doc.page.margins.left;
    const width =
      doc.page.width - doc.page.margins.left - doc.page.margins.right;
    doc
      .font("body")
      .fontSize(SIZE.footer)
      .fillColor(COLOR.muted)
      .text(CITATIONS[translation].short, left, y, {
        width,
        align: "left",
        lineBreak: false,
      });
    doc.text(`Page ${i - range.start + 1} of ${range.count}`, left, y, {
      width,
      align: "right",
      lineBreak: false,
    });
  }
  doc.fillColor(COLOR.ink);
}

// --- Helpers ---

function fontKeyForSegment(
  seg: InlineSegment,
  italicContext: boolean,
): FontKey {
  if (seg.greekHebrew) return "hebrew";
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
