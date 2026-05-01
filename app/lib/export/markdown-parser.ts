// app/lib/export/markdown-parser.ts
//
// Parse a Koinar study's markdown body into a structured AST. Both PDF and
// (eventual) DOCX renderers consume the same AST, so the markdown shape only
// has to be understood once. This is intentionally narrow: it handles what
// real seed studies use, not the full CommonMark spec.
//
// Block grammar:
//   #..####   headings (level 1-4)
//   >         blockquote (scripture quote if last line matches "— Ref (TRA)")
//   -, *      unordered list
//   1.        ordered list
//   ---       horizontal rule
//   blank     paragraph break
//   anything  paragraph
//
// Inline grammar (parsed once per text line):
//   ***x***   bold-italic
//   **x**     bold
//   *x*       italic
//   `x`       code
//
// Hebrew/Greek detection runs on every inline segment; if a segment contains
// characters in those Unicode blocks the renderer switches to Noto Sans
// Hebrew (Greek is covered by Noto Sans Regular). Mountain icons (⛰ U+26F0
// or ⛰️ with VS-16) on a line trigger the mountain-annotation block type.

// Use Unicode script properties — written as literal ranges, the upper end of
// the Hebrew Presentation Forms range silently swallowed the en-dash (U+2013)
// because `יִ` in the original literal was a 2-codepoint sequence (yod +
// hiriq) that the engine reads as `[U+05D9, U+05B4-U+FB4F]`. That made every
// scripture reference like "Matthew 4:18–20" trigger the Hebrew font fallback
// and render as tofu.
const HEBREW_RANGE = /\p{Script=Hebrew}/u;
const GREEK_RANGE = /\p{Script=Greek}/u;
const MOUNTAIN_RANGE = /⛰/;
const STRONGS_PATTERN = /[HG]\d{1,5}/;

// Scripture-citation tail. Examples we expect:
//   — Matthew 16:13-14 (BSB)
//   — John 3:16 (NLT)
//   - Genesis 1:1 (KJV)            ← ascii dash variant, just in case
//   — 1 Corinthians 13:4-7 (NASB)
// The captured groups are reference (e.g. "Matthew 16:13-14") and translation
// abbreviation. We don't validate the reference here — the renderer just
// styles the trailing citation differently.
const SCRIPTURE_CITATION_RE =
  /(?:—|-)\s*([1-3]?\s?[A-Za-z]+(?:\s[A-Za-z]+)*\s\d+:\d+(?:[-–]\d+(?::\d+)?)?)\s+\(([A-Z]{2,5})\)\s*$/;

// Inline pattern with priority order: bold-italic, bold, italic, code, plain.
const INLINE_PATTERN =
  /(\*\*\*([^*]+?)\*\*\*)|(\*\*([^*]+?)\*\*)|(\*([^*\n]+?)\*)|(`([^`]+?)`)|([^*`]+)/g;

export type BlockType =
  | "heading"
  | "paragraph"
  | "scripture_quote"
  | "blockquote"
  | "unordered_list"
  | "ordered_list"
  | "horizontal_rule";

export interface InlineSegment {
  text: string;
  bold?: boolean;
  italic?: boolean;
  code?: boolean;
  /**
   * Contains Hebrew or Greek characters. Kept for backwards compatibility
   * — new code should branch on `hebrew` / `greek` directly since they map
   * to different font fallbacks (Hebrew needs the dedicated Hebrew font;
   * Greek lives natively in Noto Sans).
   */
  greekHebrew?: boolean;
  /** Contains characters in the Hebrew script. */
  hebrew?: boolean;
  /** Contains characters in the Greek script. */
  greek?: boolean;
  /** Strong's number lookup tag (e.g. "H430", "G26"). */
  strongs?: string;
  /** Line carries the mountain icon (treated as a leading marker). */
  mountainIcon?: boolean;
}

export type Block =
  | {
      type: "heading";
      level: 1 | 2 | 3 | 4;
      inlines: InlineSegment[];
    }
  | {
      type: "paragraph";
      inlines: InlineSegment[];
      mountainAnnotation?: boolean;
    }
  | {
      type: "scripture_quote";
      inlines: InlineSegment[];
      reference: string;
      translation: string;
    }
  | {
      type: "blockquote";
      inlines: InlineSegment[];
    }
  | {
      type: "unordered_list" | "ordered_list";
      items: InlineSegment[][];
    }
  | { type: "horizontal_rule" };

export interface ParsedStudy {
  title: string;
  blocks: Block[];
  /** Headings collected for table-of-contents rendering. */
  headings: Array<{ level: number; text: string }>;
}

/** Public API. Parses a study's markdown body into the AST. */
export function parseStudyMarkdown(markdown: string): ParsedStudy {
  const lines = markdown.replace(/\r\n/g, "\n").split("\n");

  let title = "";
  const blocks: Block[] = [];
  const headings: Array<{ level: number; text: string }> = [];

  let i = 0;
  while (i < lines.length) {
    const line = lines[i] ?? "";

    if (line.trim() === "") {
      i++;
      continue;
    }

    if (/^\s*-{3,}\s*$/.test(line) || /^\s*\*{3,}\s*$/.test(line)) {
      blocks.push({ type: "horizontal_rule" });
      i++;
      continue;
    }

    const headingMatch = /^(#{1,4})\s+(.*?)\s*#*$/.exec(line);
    if (headingMatch) {
      const level = headingMatch[1].length as 1 | 2 | 3 | 4;
      const text = headingMatch[2];
      const inlines = parseInline(text);
      if (level === 1 && !title) title = text;
      headings.push({ level, text });
      blocks.push({ type: "heading", level, inlines });
      i++;
      continue;
    }

    if (line.startsWith(">")) {
      const collected: string[] = [];
      while (i < lines.length && lines[i].startsWith(">")) {
        collected.push(lines[i].replace(/^>\s?/, ""));
        i++;
      }
      const joined = collected.join(" ").trim();
      const cite = SCRIPTURE_CITATION_RE.exec(joined);
      if (cite) {
        const body = joined.slice(0, cite.index).trim();
        blocks.push({
          type: "scripture_quote",
          inlines: parseInline(body),
          reference: cite[1].trim().replace(/\s+/g, " "),
          translation: cite[2],
        });
      } else {
        blocks.push({ type: "blockquote", inlines: parseInline(joined) });
      }
      continue;
    }

    if (/^\s*[-*]\s+/.test(line)) {
      const items: InlineSegment[][] = [];
      while (i < lines.length && /^\s*[-*]\s+/.test(lines[i])) {
        const itemText = lines[i].replace(/^\s*[-*]\s+/, "");
        items.push(parseInline(itemText));
        i++;
      }
      blocks.push({ type: "unordered_list", items });
      continue;
    }

    if (/^\s*\d+\.\s+/.test(line)) {
      const items: InlineSegment[][] = [];
      while (i < lines.length && /^\s*\d+\.\s+/.test(lines[i])) {
        const itemText = lines[i].replace(/^\s*\d+\.\s+/, "");
        items.push(parseInline(itemText));
        i++;
      }
      blocks.push({ type: "ordered_list", items });
      continue;
    }

    // Paragraph — collect contiguous non-empty, non-block-marker lines.
    const paraLines: string[] = [line];
    i++;
    while (i < lines.length) {
      const next = lines[i];
      if (
        next.trim() === "" ||
        /^#{1,4}\s/.test(next) ||
        next.startsWith(">") ||
        /^\s*[-*]\s+/.test(next) ||
        /^\s*\d+\.\s+/.test(next) ||
        /^\s*-{3,}\s*$/.test(next)
      ) {
        break;
      }
      paraLines.push(next);
      i++;
    }
    const paraText = paraLines.join(" ");
    const paraInlines = parseInline(paraText);
    const hasMountain =
      MOUNTAIN_RANGE.test(paraText) ||
      paraInlines.some((seg) => seg.mountainIcon);
    blocks.push({
      type: "paragraph",
      inlines: paraInlines,
      mountainAnnotation: hasMountain || undefined,
    });
  }

  return { title, blocks, headings };
}

/**
 * Parse inline markdown formatting into a flat list of styled segments.
 * Order of precedence: bold-italic > bold > italic > code > plain.
 */
export function parseInline(text: string): InlineSegment[] {
  if (!text) return [];

  // Strip the leading mountain icon (and an optional VS-16) so the renderer
  // can prefix its own glyph reliably; carry the marker through the segment.
  const mountainAtStart = /^\s*⛰️?\s*/.exec(text);
  const stripped = mountainAtStart ? text.slice(mountainAtStart[0].length) : text;

  const segments: InlineSegment[] = [];
  for (const m of stripped.matchAll(INLINE_PATTERN)) {
    const [, , boldItalic, , bold, , italic, , code, plain] = m;
    let seg: InlineSegment | null = null;
    if (boldItalic !== undefined) {
      seg = { text: boldItalic, bold: true, italic: true };
    } else if (bold !== undefined) {
      seg = { text: bold, bold: true };
    } else if (italic !== undefined) {
      seg = { text: italic, italic: true };
    } else if (code !== undefined) {
      seg = { text: code, code: true };
    } else if (plain !== undefined) {
      seg = { text: plain };
    }
    if (!seg) continue;
    enrichScriptDetection(seg);
    segments.push(seg);
  }

  if (mountainAtStart && segments.length > 0) {
    segments[0].mountainIcon = true;
  } else if (mountainAtStart && segments.length === 0) {
    segments.push({ text: "", mountainIcon: true });
  }

  return segments;
}

function enrichScriptDetection(seg: InlineSegment): void {
  const hasHebrew = HEBREW_RANGE.test(seg.text);
  const hasGreek = GREEK_RANGE.test(seg.text);
  if (hasHebrew) seg.hebrew = true;
  if (hasGreek) seg.greek = true;
  if (hasHebrew || hasGreek) seg.greekHebrew = true;
  const strongs = seg.text.match(STRONGS_PATTERN);
  if (strongs) {
    seg.strongs = strongs[0];
  }
  if (MOUNTAIN_RANGE.test(seg.text)) {
    seg.mountainIcon = true;
  }
}
