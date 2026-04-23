// app/lib/utils/slug.ts
import { getDb } from "@/lib/db/connection";

/**
 * Generates a URL-safe slug from a study title and checks the studies table
 * for collisions, appending a random suffix if one is found.
 *
 * MUST be called server-side only — performs a synchronous DB query via getDb().
 * Callers should still handle UNIQUE constraint errors at INSERT time.
 */
export function generateSlug(title: string): string {
  let slug = title
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 80);

  // Guard against all-special-character titles
  if (!slug) slug = "study";

  const existing = getDb()
    .prepare("SELECT id FROM studies WHERE slug = ?")
    .get(slug);

  if (existing) {
    const suffix = Math.random().toString(36).slice(2, 6);
    slug = `${slug}-${suffix}`.slice(0, 85);
  }

  return slug;
}
