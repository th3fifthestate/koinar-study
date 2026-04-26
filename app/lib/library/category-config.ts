// app/lib/library/category-config.ts
//
// Per-category visual config for the library shelves. Maps each DB category
// slug to:
//   - displayName     — label shown on the shelf header
//   - tintVar         — CSS custom property carrying the card's bg tint
//                       (defined in globals.css under [data-mode])
//   - accent          — 'sage' | 'warmth' | 'stone' — drives the eyebrow
//                       dot color and the corner-mark stroke
//   - watermarkSvg    — encoded SVG data URI applied as the card's
//                       lower-right ::after watermark, or null
//
// Adding a new category later is one entry here + one tint token in
// globals.css under both [data-mode] blocks. No component changes needed.

export type CategoryAccent = 'sage' | 'warmth' | 'stone';

export interface CategoryVisual {
  displayName: string;
  /** Name of the CSS custom property holding the card bg tint. */
  tintVar: string;
  accent: CategoryAccent;
  /** Encoded SVG (data:image/svg+xml;utf8,...) or null when the
   *  category gets no watermark and reads on tint + corner-mark alone. */
  watermarkSvg: string | null;
}

// Watermark SVGs — copied verbatim from the locked v6 mockup. Stroke
// colors are hardcoded sage-700 / warmth / stone-500 for light mode;
// dark mode uses the same shapes but the cards re-color them via a
// hue-rotate filter on .lead surfaces (see ShelfCard CSS).

const WATERMARK_LETTERS =
  // scroll with text lines, sage-700 stroke
  "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><g fill='none' stroke='%233d4f35' stroke-width='1.8' stroke-linecap='round'><path d='M22 30 Q22 22 30 22 L74 22 Q66 26 66 34 L66 70 Q66 78 74 78 L30 78 Q22 78 22 70 Z'/><path d='M30 38 L60 38 M30 48 L60 48 M30 58 L52 58'/></g></svg>";

const WATERMARK_OLD_TESTAMENT =
  // stone tablet, stone-500 stroke
  "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><g fill='none' stroke='%238b8478' stroke-width='1.8' stroke-linecap='round'><path d='M28 30 Q28 18 38 18 L46 18 Q46 28 50 28 Q54 28 54 18 L62 18 Q72 18 72 30 L72 80 L28 80 Z'/><path d='M36 42 L64 42 M36 52 L64 52 M36 62 L60 62'/></g></svg>";

const WATERMARK_WISDOM =
  // olive sprig (echoes the threshold pattern), sage-700 stroke
  "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><g fill='none' stroke='%233d4f35' stroke-width='1.8' stroke-linecap='round'><path d='M50 14 L50 86'/><ellipse cx='38' cy='28' rx='10' ry='3' transform='rotate(-30 38 28)'/><ellipse cx='62' cy='38' rx='10' ry='3' transform='rotate(30 62 38)'/><ellipse cx='38' cy='50' rx='10' ry='3' transform='rotate(-30 38 50)'/><ellipse cx='62' cy='62' rx='10' ry='3' transform='rotate(30 62 62)'/><ellipse cx='38' cy='74' rx='10' ry='3' transform='rotate(-30 38 74)'/></g></svg>";

const WATERMARK_BOOK_STUDIES =
  // open book, warmth stroke
  "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><g fill='none' stroke='%23c49a6c' stroke-width='1.8' stroke-linecap='round'><path d='M50 30 Q40 22 18 24 L18 78 Q40 76 50 84 Q60 76 82 78 L82 24 Q60 22 50 30 Z'/><path d='M50 30 L50 84'/><path d='M28 38 L42 38 M28 48 L42 48 M28 58 L42 58 M58 38 L72 38 M58 48 L72 48 M58 58 L72 58'/></g></svg>";

export const CATEGORY_CONFIG: Record<string, CategoryVisual> = {
  gospel: {
    displayName: 'Gospel',
    tintVar: '--card-gospel',
    accent: 'warmth',
    watermarkSvg: null,
  },
  letters: {
    displayName: 'Letters',
    tintVar: '--card-letters',
    accent: 'sage',
    watermarkSvg: WATERMARK_LETTERS,
  },
  wisdom: {
    displayName: 'Wisdom',
    tintVar: '--card-wisdom',
    accent: 'sage',
    watermarkSvg: WATERMARK_WISDOM,
  },
  'old-testament': {
    displayName: 'Old Testament',
    tintVar: '--card-old-testament',
    accent: 'stone',
    watermarkSvg: WATERMARK_OLD_TESTAMENT,
  },
  prophecy: {
    displayName: 'Prophecy',
    tintVar: '--card-prophecy',
    accent: 'warmth',
    watermarkSvg: null,
  },
  people: {
    displayName: 'People',
    tintVar: '--card-people',
    accent: 'stone',
    watermarkSvg: null,
  },
  topical: {
    displayName: 'Topical',
    tintVar: '--card-topical',
    accent: 'sage',
    watermarkSvg: null,
  },
  'book-studies': {
    displayName: 'Book Studies',
    tintVar: '--card-book-studies',
    accent: 'warmth',
    watermarkSvg: WATERMARK_BOOK_STUDIES,
  },
  'new-testament': {
    displayName: 'New Testament',
    tintVar: '--card-new-testament',
    accent: 'warmth',
    watermarkSvg: null,
  },
  'word-studies': {
    displayName: 'Word Studies',
    tintVar: '--card-word-studies',
    accent: 'sage',
    watermarkSvg: null,
  },
};

/**
 * Editorial canonical order for the shelves on the front page. The
 * recency shelf "In this issue" is rendered before this list; this
 * defines the per-category order after it.
 *
 * Order rationale: Gospel → Letters → Wisdom → Old Testament → Prophecy
 * → People → Topical → Book Studies follows the canon's flow, with the
 * two meta categories (New Testament, Word Studies) at the end since
 * they're cross-cutting rather than canonical groupings.
 */
export const CATEGORY_SHELF_ORDER: readonly string[] = [
  'gospel',
  'letters',
  'wisdom',
  'old-testament',
  'prophecy',
  'people',
  'topical',
  'book-studies',
  'new-testament',
  'word-studies',
];

/** Falls back to a sensible default when an unknown slug is encountered. */
export function getCategoryVisual(slug: string | null | undefined): CategoryVisual {
  if (slug && CATEGORY_CONFIG[slug]) return CATEGORY_CONFIG[slug];
  return {
    displayName: slug ?? 'Uncategorized',
    tintVar: '--card-letters',
    accent: 'sage',
    watermarkSvg: null,
  };
}

/** Resolves the eyebrow dot color from the category accent. Used by
 *  ShelfCard to tint the small filled bullet before the category label. */
export function eyebrowDotColor(accent: CategoryAccent): string {
  switch (accent) {
    case 'warmth': return '#8d6b40';        // deep warmth
    case 'sage':   return 'var(--sage-700)';
    case 'stone':  return 'var(--stone-700)';
  }
}

/** Resolves the corner-mark stroke from the category accent. */
export function cornerMarkColor(accent: CategoryAccent): string {
  switch (accent) {
    case 'warmth': return 'var(--warmth)';
    case 'sage':   return 'var(--sage-500)';
    case 'stone':  return 'var(--stone-500)';
  }
}
