import { getDb } from "@/lib/db/connection";

export interface StudyImage {
  id: number;
  study_id: number;
  image_url: string;
  caption: string | null;
  sort_order: number;
  flux_prompt: string | null;
  r2_key: string | null;
  style: string;
  aspect_ratio: string;
  width: number;
  height: number;
  size_bytes: number | null;
  is_hero: boolean;
  flux_task_id: string | null;
  created_by: number | null;
  created_at: string;
}

type StudyImageRow = Omit<StudyImage, "is_hero"> & { is_hero: number };

export function getStudyImages(studyId: number): StudyImage[] {
  const db = getDb();
  const rows = db
    .prepare("SELECT * FROM study_images WHERE study_id = ? ORDER BY sort_order ASC")
    .all(studyId) as StudyImageRow[];

  return rows.map((row) => ({ ...row, is_hero: row.is_hero === 1 }));
}

export function getStudyHeroImage(studyId: number): StudyImage | null {
  const db = getDb();

  const hero = db
    .prepare("SELECT * FROM study_images WHERE study_id = ? AND is_hero = 1 LIMIT 1")
    .get(studyId) as StudyImageRow | undefined;

  if (hero) return { ...hero, is_hero: true };

  const first = db
    .prepare(
      "SELECT * FROM study_images WHERE study_id = ? ORDER BY sort_order ASC LIMIT 1"
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
