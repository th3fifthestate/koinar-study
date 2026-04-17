export type TodBucket = 'dawn' | 'morning' | 'midday' | 'golden' | 'evening' | 'night';

export interface TodPhase {
  bucket: TodBucket;
  greeting: (firstName: string | undefined) => string;
  eyebrow: (day: number) => string;
}

const R2_BASE = 'https://images.koinar.app';

export const TOD_IMAGES: Record<TodBucket, { src: string; alt: string }> = {
  dawn: {
    src: `${R2_BASE}/home-hero/dawn.webp`,
    alt: 'First light over a rocky Middle-Eastern hillside at dawn',
  },
  morning: {
    src: `${R2_BASE}/home-hero/morning.webp`,
    alt: 'Morning light through an olive grove in the Galilean hill country',
  },
  midday: {
    src: `${R2_BASE}/home-hero/midday.webp`,
    alt: 'Sun-bleached stone path through dry highlands at midday',
  },
  golden: {
    src: `${R2_BASE}/home-hero/golden.webp`,
    alt: 'Wheat field in warm honey light at golden hour',
  },
  evening: {
    src: `${R2_BASE}/home-hero/evening.webp`,
    alt: 'Desert dusk with purple-amber sky and silhouette ridge line',
  },
  night: {
    src: `${R2_BASE}/home-hero/night.webp`,
    alt: 'Clear starfield over dark hills at night',
  },
};

/** Days 0=Sun … 6=Sat */
const DAY_EYEBROWS: Record<number, string | ((bucket: TodBucket) => string)> = {
  0: 'A Sunday reading.',
  1: 'Monday. The week begins.',
  2: (bucket) =>
    bucket === 'evening' || bucket === 'night'
      ? 'A Tuesday evening.'
      : 'A Tuesday morning reading.',
  3: 'Midweek.',
  4: 'A Thursday reading.',
  5: 'Before the weekend.',
  6: 'A Saturday reading.',
};

export function bucketForHour(hour: number): TodBucket {
  if (hour >= 5 && hour < 7) return 'dawn';
  if (hour >= 7 && hour < 12) return 'morning';
  if (hour >= 12 && hour < 15) return 'midday';
  if (hour >= 15 && hour < 18) return 'golden';
  if (hour >= 18 && hour < 21) return 'evening';
  return 'night';
}

export function greetingForBucket(bucket: TodBucket, firstName: string | undefined): string {
  const name = firstName ? `, ${firstName}.` : '.';
  switch (bucket) {
    case 'dawn': return `Still early${name}`;
    case 'morning': return `Good morning${name}`;
    case 'midday': return `Good afternoon${name}`;
    case 'golden': return `Late light${name}`;
    case 'evening': return `Good evening${name}`;
    case 'night': return `A late reading${name}`;
  }
}

export function eyebrowForDay(day: number, bucket: TodBucket): string {
  const entry = DAY_EYEBROWS[day] ?? 'A reading.';
  return typeof entry === 'function' ? entry(bucket) : entry;
}
