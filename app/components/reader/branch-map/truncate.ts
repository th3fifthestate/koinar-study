/**
 * Truncates a label at ~maxLen characters, preferring word boundaries.
 *
 * 1. If the label fits, return it unchanged.
 * 2. Try dropping leading stop-words ("The", "A", "An") if that fits.
 * 3. Find the last space before maxLen and truncate there.
 * 4. Fall back to hard char cut + ellipsis.
 */
const LEADING_ARTICLES = /^(The|A|An)\s+/i;

export function truncateLabel(label: string, maxLen = 18): string {
  if (label.length <= maxLen) return label;

  // Try dropping leading article
  const trimmed = label.replace(LEADING_ARTICLES, '');
  if (trimmed.length <= maxLen) return trimmed;

  // Word-boundary truncation
  const lastSpace = trimmed.lastIndexOf(' ', maxLen);
  if (lastSpace > maxLen * 0.4) {
    return trimmed.slice(0, lastSpace) + '…';
  }

  // Hard cut
  return trimmed.slice(0, maxLen - 1) + '…';
}
