import { getDb } from "@/lib/db/connection";

/**
 * Public shape for study images returned from API responses.
 *
 * Per CLAUDE.md §3: API responses must be shaped explicitly — we never return
 * raw DB rows. These columns are safe to expose; the following are intentionally
 * omitted from this shape and the SELECT lists below:
 *   - r2_key        (internal storage path; admins can look it up separately)
 *   - created_by    (internal user ID; CLAUDE.md §2 forbids exposing user IDs)
 *   - flux_task_id  (internal upstream ID; admins can look it up separately)
 */
export interface StudyImage {
  id: number;
  study_id: number;
  image_url: string;
  caption: string | null;
  sort_order: number;
  flux_prompt: string | null;
  style: string;
  aspect_ratio: string;
  width: number;
  height: number;
  size_bytes: number | null;
  is_hero: boolean;
  created_at: string;
}

type StudyImageRow = Omit<StudyImage, "is_hero"> & { is_hero: number };

// Enumerated column list matches the StudyImage shape. Keep these two in sync.
const STUDY_IMAGE_COLUMNS = `
  id, study_id, image_url, caption, sort_order, flux_prompt,
  style, aspect_ratio, width, height, size_bytes, is_hero, created_at
`;

export function getStudyImages(studyId: number): StudyImage[] {
  const db = getDb();
  const rows = db
    .prepare(
      `SELECT ${STUDY_IMAGE_COLUMNS} FROM study_images WHERE study_id = ? ORDER BY sort_order ASC`
    )
    .all(studyId) as StudyImageRow[];

  return rows.map((row) => ({ ...row, is_hero: row.is_hero === 1 }));
}

export function getStudyHeroImage(studyId: number): StudyImage | null {
  const db = getDb();

  const hero = db
    .prepare(
      `SELECT ${STUDY_IMAGE_COLUMNS} FROM study_images WHERE study_id = ? AND is_hero = 1 LIMIT 1`
    )
    .get(studyId) as StudyImageRow | undefined;

  if (hero) return { ...hero, is_hero: true };

  const first = db
    .prepare(
      `SELECT ${STUDY_IMAGE_COLUMNS} FROM study_images WHERE study_id = ? ORDER BY sort_order ASC LIMIT 1`
    )
    .get(studyId) as StudyImageRow | undefined;

  return first ? { ...first, is_hero: first.is_hero === 1 } : null;
}

export function getActiveSeasonalImage(): { image_url: string; season: string } | null {
  const db = getDb();
  const row = db
    .prepare("SELECT image_url, season FROM seasonal_images WHERE is_active = 1 LIMIT 1")
    .get() as { image_url: string; season: string } | undefined;

  return row ?? null;
}
