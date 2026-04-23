export const GENERIC_PHRASES: readonly string[] = [
  'Reading the passage\u2026',
  'Consulting cross-references\u2026',
  'Weighing original-language notes\u2026',
  'Verifying citations\u2026',
  'Drawing the study together\u2026',
];

/**
 * Maps a known tool name to an editorial phrase.
 * Uses keyword matching; falls back to a generic phrase for unknown tools.
 */
export function toolNameToPhrase(toolName: string): string {
  const lower = toolName.toLowerCase();

  if (lower.includes('cross')) {
    return GENERIC_PHRASES[1]; // Consulting cross-references…
  }
  if (lower.includes('strong') || lower.includes('greek') || lower.includes('hebrew')) {
    return GENERIC_PHRASES[2]; // Weighing original-language notes…
  }
  if (lower.includes('verif') || lower.includes('cit')) {
    return GENERIC_PHRASES[3]; // Verifying citations…
  }

  return GENERIC_PHRASES[0]; // Reading the passage…
}
