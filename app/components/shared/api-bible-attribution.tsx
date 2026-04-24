// app/components/shared/api-bible-attribution.tsx
//
// "Powered by API.Bible" attribution renderer.
//
// The ABS Acceptable Use Agreement (Starter Plan) requires a visible citation
// and hyperlink to https://api.bible **within the application's interface**,
// on surfaces where API.Bible-sourced translations render. We surface this in
// two places:
//
//   - CitationFooter (reader) — appended below the per-translation copyright.
//   - Bench clippings (verse + translation-compare) — when any rendered
//     translation is sourced from api.bible (NLT / NIV / NASB).
//
// This component is NOT mounted globally. If you're rendering a licensed
// translation anywhere new, import it here rather than duplicating the text.

import type { TranslationId } from '@/lib/translations/registry';
import { TRANSLATIONS } from '@/lib/translations/registry';

/**
 * Returns true when the given translation IDs include at least one rendered
 * via api.bible (NLT / NIV / NASB). Case-insensitive — call sites commonly
 * normalize to lowercase for URL params.
 */
export function hasApiBibleTranslation(ids: Array<string | undefined>): boolean {
  return ids.some((id) => {
    if (!id) return false;
    const upper = id.toUpperCase() as TranslationId;
    return TRANSLATIONS[upper]?.source === 'api-bible';
  });
}

interface ApiBibleAttributionProps {
  /** Tailwind size class. Defaults to `text-xs`; bench clips use `text-[10px]`. */
  className?: string;
}

export function ApiBibleAttribution({
  className = 'text-xs text-muted-foreground/70',
}: ApiBibleAttributionProps) {
  return (
    <p className={className}>
      Powered by{' '}
      <a
        href="https://api.bible"
        target="_blank"
        rel="noopener noreferrer"
        className="underline underline-offset-2 hover:text-foreground transition-colors"
      >
        API.Bible
      </a>
    </p>
  );
}
