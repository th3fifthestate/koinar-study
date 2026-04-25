// app/lib/reader/split-by-h2.ts

import type { BedVariant } from '@/components/reader/bed';

export interface MarkdownSection {
  /** Section title (e.g., "Summary", "The Calling of a Sinful Man (Luke 5:1–11)"). */
  heading: string;
  /** Slugified anchor (e.g., "summary"). */
  slug: string;
  /** The full markdown body for this section, INCLUDING its H2 line. */
  markdown: string;
  /** A semantic key — used to assign bed variant. */
  key: 'summary' | 'scripture-references' | 'key-themes' | 'ot-nt-echoes' | 'conclusion' | 'body';
}

const SUMMARY_RE = /^summary$/i;
const SCRIPTURE_REFS_RE = /^scripture references$/i;
const KEY_THEMES_RE = /^key themes$/i;
const OT_NT_ECHOES_RE = /^(ot echoes|nt fulfillment|ot prophecies fulfilled|nt fulfillment in christ|ot.?nt fulfillment|ot.?nt echoes)/i;
const CONCLUSION_RE = /^conclusion$/i;

function classify(heading: string): MarkdownSection['key'] {
  // Strip parenthetical reference suffix (e.g., "Summary (intro)" → "Summary")
  const stripped = heading.replace(/\s*\([^)]*\)\s*$/, '').trim();
  if (SUMMARY_RE.test(stripped)) return 'summary';
  if (SCRIPTURE_REFS_RE.test(stripped)) return 'scripture-references';
  if (KEY_THEMES_RE.test(stripped)) return 'key-themes';
  if (OT_NT_ECHOES_RE.test(stripped)) return 'ot-nt-echoes';
  if (CONCLUSION_RE.test(stripped)) return 'conclusion';
  return 'body';
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/\s*\([^)]*\)\s*/g, ' ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

/**
 * Split markdown into sections at H2 (`## …`) boundaries. Anything before
 * the first H2 (typically the H1 title and json-metadata fence) is dropped
 * — the editorial hero takes ownership of the title.
 */
export function splitByH2(markdown: string): MarkdownSection[] {
  const lines = markdown.split('\n');
  const sections: MarkdownSection[] = [];
  let current: { heading: string; lines: string[] } | null = null;

  for (const line of lines) {
    const m = line.match(/^##\s+(.+?)\s*$/);
    if (m) {
      if (current) {
        sections.push({
          heading: current.heading,
          slug: slugify(current.heading),
          markdown: current.lines.join('\n'),
          key: classify(current.heading),
        });
      }
      current = { heading: m[1], lines: [line] };
    } else if (current) {
      current.lines.push(line);
    }
  }
  if (current) {
    sections.push({
      heading: current.heading,
      slug: slugify(current.heading),
      markdown: current.lines.join('\n'),
      key: classify(current.heading),
    });
  }
  return sections;
}

/**
 * Map each section to its default bed variant per spec §3.
 *
 * Spec table:
 *   | Section              | Light bed | Dark bed |
 *   |----------------------|-----------|----------|
 *   | Summary              | cream     | ink      |
 *   | Scripture References | warm      | warm     |
 *   | Body Sections        | cream→warm rotation | ink→warm rotation |
 *   | Key Themes           | sage      | sage     |
 *   | OT/NT Echoes         | cream     | ink      |
 *   | Conclusion (drama)   | ink       | cream    |
 *
 * @param section The classified section.
 * @param index The 0-based position in the full sections array — used for
 *              body-section bg rotation (cream/warm).
 * @param mode The current reader mode.
 */
export function bedForSection(
  section: MarkdownSection,
  index: number,
  mode: 'light' | 'dark'
): BedVariant {
  switch (section.key) {
    case 'summary':
      return mode === 'light' ? 'cream' : 'ink';
    case 'scripture-references':
      return 'warm';
    case 'key-themes':
      return 'sage';
    case 'ot-nt-echoes':
      return mode === 'light' ? 'cream' : 'ink';
    case 'conclusion':
      // drama inversion — opposite of page bg in each mode
      return mode === 'light' ? 'ink' : 'cream';
    case 'body':
    default: {
      const isEven = index % 2 === 0;
      if (mode === 'light') return isEven ? 'cream' : 'warm';
      return isEven ? 'ink' : 'warm';
    }
  }
}
