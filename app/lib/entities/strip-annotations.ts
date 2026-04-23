// app/lib/entities/strip-annotations.ts

export interface StrippedAnnotation {
  surface_text: string;
  entity_id: string;
  start_offset: number;
  end_offset: number; // exclusive — cleanMarkdown.slice(start_offset, end_offset) === surface_text
}

export interface StripResult {
  cleanMarkdown: string;
  annotations: StrippedAnnotation[];
}

// Matches [display text]{entity:ENTITY_ID} — display text is non-greedy, no brackets
const ANNOTATION_PATTERN = /\[([^\]]+)\]\{entity:([A-Z0-9_]+)\}/g;

/**
 * Strips [text]{entity:ID} markers from markdown and computes character offsets
 * for each annotation in the stripped text.
 *
 * Offset logic:
 *   Raw:     "The [Pharisees]{entity:PHARISEES} challenged"
 *   Stripped:"The Pharisees challenged"
 *   Each marker removal shifts subsequent offsets by (fullMatch.length - surfaceText.length).
 */
export function stripEntityAnnotations(rawMarkdown: string): StripResult {
  const annotations: StrippedAnnotation[] = [];
  const parts: string[] = [];
  let lastIndex = 0;
  let offsetDelta = 0; // cumulative chars removed so far

  for (const match of rawMarkdown.matchAll(ANNOTATION_PATTERN)) {
    const fullMatch = match[0];   // e.g. "[Pharisees]{entity:PHARISEES}"
    const surfaceText = match[1]; // e.g. "Pharisees"
    const entityId = match[2];    // e.g. "PHARISEES"
    const rawStart = match.index!;

    // Append everything between last match and this one
    parts.push(rawMarkdown.slice(lastIndex, rawStart));

    // Compute offsets in the *stripped* text
    const cleanStart = rawStart - offsetDelta;
    const cleanEnd = cleanStart + surfaceText.length;

    // Append just the surface text (strips the {entity:ID} wrapper)
    parts.push(surfaceText);
    lastIndex = rawStart + fullMatch.length;

    // Each marker removes (fullMatch.length - surfaceText.length) characters
    offsetDelta += fullMatch.length - surfaceText.length;

    if (surfaceText.length > 0) {
      annotations.push({
        surface_text: surfaceText,
        entity_id: entityId,
        start_offset: cleanStart,
        end_offset: cleanEnd,
      });
    }
  }

  // Append remaining text after last match
  parts.push(rawMarkdown.slice(lastIndex));
  const cleanMarkdown = parts.join('');

  return { cleanMarkdown, annotations };
}
