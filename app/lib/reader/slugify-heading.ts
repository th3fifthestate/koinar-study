/**
 * Single source of truth for H2-section slugs in the reader. Used by:
 *  - splitByH2 to slug each section / Bed wrapper
 *  - extractHeadings (study-reader) to compute the H2 anchor + the prefix
 *    for nested H3/H4 ids
 *
 * Parenthetical tails are stripped so headings like
 * "The Fisherman's Calling (Matthew 4:18–20)" produce a clean slug
 * (`the-fisherman-s-calling`) and don't drift between consumers.
 */
export function slugifyHeading(text: string): string {
  return text
    .toLowerCase()
    .replace(/\s*\([^)]*\)\s*/g, ' ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}
