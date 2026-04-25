// app/lib/entities/idiom-phrases.ts
//
// Idiomatic title-case phrase dictionary. When a matched entity name falls
// inside one of these phrases' span in the text, the annotator skips it —
// the phrase uses the biblical name figuratively (anatomy, botany,
// hyperbole) rather than as a reference to the biblical figure.
//
// Conservative by design. We only list phrases where the figurative use is
// so dominant that surfacing the biblical entity is almost always wrong.
// Borderline cases like "patience of Job" or "doubting Thomas" are NOT in
// here because in study contexts those phrases very often DO refer to the
// biblical figure as an exemplar.
//
// Adding a phrase: write it case-insensitive (the matcher uses the `i`
// flag). Word-boundary anchors (`\\b`) wrap the whole phrase so partial
// matches don't trigger.

/** Each entry is a regex source string. The matcher escapes nothing — write
 * regex syntax directly if you need character classes / alternation. */
export const IDIOMATIC_PHRASES: readonly string[] = [
  // Anatomy: laryngeal prominence, not Adam.
  "Adam'?s\\s+apple",
  // Botany: Polygonatum spp., not the king.
  "Solomon'?s\\s+seal",
  // Figurative trouble-making, not the son of Eve.
  "rais(?:e|ing|ed|es)\\s+Cain",
  // Hyperbolic age, not the genealogical figure.
  "old\\s+as\\s+Methuselah",
];

/**
 * Build [start, end] ranges of idiom matches in `text`. Used by the
 * annotator's `inExcludedRange` check to skip entity matches that fall
 * inside an idiom span.
 */
export function getIdiomRanges(text: string): Array<[number, number]> {
  const ranges: Array<[number, number]> = [];
  for (const source of IDIOMATIC_PHRASES) {
    const rx = new RegExp(`\\b${source}\\b`, 'gi');
    for (const match of text.matchAll(rx)) {
      ranges.push([match.index!, match.index! + match[0].length]);
    }
  }
  return ranges;
}
