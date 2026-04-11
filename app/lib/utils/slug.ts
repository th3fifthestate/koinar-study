// app/lib/utils/slug.ts
import { getDb } from "@/lib/db/connection";

export function generateSlug(title: string): string {
  let slug = title
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 80);

  const existing = getDb()
    .prepare("SELECT id FROM studies WHERE slug = ?")
    .get(slug);

  if (existing) {
    const suffix = Date.now().toString(36).slice(-4);
    slug = `${slug}-${suffix}`.slice(0, 85);
  }

  return slug;
}
