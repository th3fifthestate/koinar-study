/**
 * Featured-plate manifest for the home FeaturedStudy component.
 *
 * "Plates" are atmospheric editorial background images (warm landscapes,
 * manuscript abstracts, olive groves, ancient stones, etc.) — NOT
 * study-specific imagery. A small set rotates by day-of-year so the homepage
 * feels alive without coupling visual identity to any one study.
 *
 * Workflow to populate / refresh this manifest:
 *   1. Run the generator:  cd app && npx tsx scripts/generate-featured-plates.ts
 *   2. Confirm cost prompt (or pass --yes).
 *   3. Copy the printed `FEATURED_PLATES = [...]` snippet from stdout into
 *      this file, replacing the export below.
 *   4. Commit the populated manifest.
 *
 * The script is idempotent — it skips R2 keys that already exist unless you
 * pass --force. Re-running after adding a new prompt will only generate the
 * new image and the printed snippet will include the full set.
 */

export interface FeaturedPlate {
  /** 1-indexed sequence number, matches the script's R2 key prefix. */
  idx: number;
  /** Public CDN URL on images.koinar.app. */
  url: string;
  /** Human-readable alt text — atmospheric description, not study-specific. */
  alt: string;
}

// Populated by running `tsx app/scripts/generate-featured-plates.ts`.
// Re-run the script to add or replace plates and paste the printed snippet.
export const FEATURED_PLATES: readonly FeaturedPlate[] = [
  { idx: 1, url: 'https://images.koinar.app/featured-plates/01-olive-grove-dusk.webp', alt: 'An olive grove at dusk, warm Mediterranean light filtering through silvery leaves' },
  { idx: 2, url: 'https://images.koinar.app/featured-plates/02-open-manuscript-stone.webp', alt: 'A weathered open manuscript on a stone surface, soft directional light' },
  { idx: 3, url: 'https://images.koinar.app/featured-plates/03-library-light-beams.webp', alt: 'Dappled morning light through tall windows of an old library, dust motes in the beams' },
  { idx: 4, url: 'https://images.koinar.app/featured-plates/04-ancient-stone-steps.webp', alt: 'Ancient stone steps leading into shadow, weathered and warm-toned' },
  { idx: 5, url: 'https://images.koinar.app/featured-plates/05-misted-hills-first-light.webp', alt: 'Rolling hills at first light, soft mist in the valley, distant olive trees' },
  { idx: 6, url: 'https://images.koinar.app/featured-plates/06-candlelit-alcove.webp', alt: 'A candlelit stone alcove with weathered wood, warm flickering light' },
];

function dayOfYear(date: Date): number {
  const start = new Date(date.getFullYear(), 0, 0);
  return Math.floor((date.getTime() - start.getTime()) / 86_400_000);
}

/**
 * Day-of-year deterministic rotation across the configured plates.
 * Returns null if no plates are configured (manifest still empty) — callers
 * must handle this by falling back to a non-image background.
 */
export function getFeaturedPlateForToday(now: Date = new Date()): FeaturedPlate | null {
  if (FEATURED_PLATES.length === 0) return null;
  return FEATURED_PLATES[dayOfYear(now) % FEATURED_PLATES.length] ?? null;
}
