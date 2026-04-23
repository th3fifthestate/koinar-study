import type { StudySummary } from '@/lib/db/types';

function dayOfYear(date: Date): number {
  const start = new Date(date.getFullYear(), 0, 0);
  const diff = date.getTime() - start.getTime();
  return Math.floor(diff / 86_400_000);
}

/** Deterministic day-of-year rotation across up to 3 featured studies. */
export function getFeaturedForToday(studies: StudySummary[], now: Date = new Date()): StudySummary | null {
  if (studies.length === 0) return null;
  return studies[dayOfYear(now) % studies.length] ?? studies[0];
}
