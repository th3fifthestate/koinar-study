'use client';

import { useState, useEffect } from 'react';
import Image from 'next/image';
import { FeaturedAnchorCard } from '@/components/home/featured-anchor-card';
import {
  bucketForHour,
  greetingForBucket,
  eyebrowForDay,
  TOD_IMAGES,
  type TodBucket,
} from '@/lib/home/tod-bucket';
import type { StudySummary } from '@/lib/db/types';
import type { Category } from '@/lib/db/types';

interface HeroProps {
  username?: string;
  firstName?: string;
  featuredStudy: StudySummary | null;
  categories: Category[];
}

export function Hero({ username: _username, firstName, featuredStudy, categories }: HeroProps) {
  // Hydrate with Evening to avoid SSR/client mismatch; update on mount to client time.
  const [bucket, setBucket] = useState<TodBucket>('evening');
  const [dayOfWeek, setDayOfWeek] = useState(0);

  useEffect(() => {
    const now = new Date();
    setBucket(bucketForHour(now.getHours()));
    setDayOfWeek(now.getDay());
  }, []);

  const image = TOD_IMAGES[bucket];
  const greeting = greetingForBucket(bucket, firstName);
  const eyebrow = eyebrowForDay(dayOfWeek, bucket);
  const categoryName =
    featuredStudy?.category_id != null
      ? (categories.find((c) => c.id === featuredStudy.category_id)?.name ?? null)
      : null;

  // Lighter buckets need the bottom gradient for text legibility
  const needsGradient = bucket === 'dawn' || bucket === 'morning' || bucket === 'midday' || bucket === 'golden';

  return (
    <section
      className="relative w-full overflow-hidden"
      style={{ height: '78vh', minHeight: '520px' }}
      aria-label="Library home hero"
    >
      {/* Time-of-day landscape */}
      <Image
        src={image.src}
        alt={image.alt}
        fill
        priority
        className="object-cover motion-safe:[animation:kenBurns_30s_ease-in-out_infinite]"
        sizes="100vw"
      />

      {/* Bottom gradient for text legibility */}
      <div
        className={`absolute inset-0 bg-gradient-to-t from-[var(--stone-900)]/60 via-[var(--stone-900)]/10 to-transparent pointer-events-none ${needsGradient ? 'opacity-100' : 'opacity-70'}`}
        aria-hidden="true"
      />

      {/* Editorial lockup — bottom-left */}
      <div className="absolute bottom-0 left-0 right-0 flex flex-col md:flex-row items-end md:items-end justify-between px-6 md:px-12 pb-10 md:pb-12 gap-6 md:gap-0">
        <div
          className="flex flex-col gap-3 animate-[fadeRise_500ms_ease-out_200ms_both]"
          style={{ maxWidth: '520px' }}
        >
          {/* Eyebrow */}
          <p
            className="text-[0.7rem] uppercase tracking-[0.24em] font-body"
            style={{ color: 'var(--warmth)' }}
          >
            {eyebrow}
          </p>

          {/* Greeting */}
          <h1
            className="font-display font-normal leading-[1.1] text-[var(--stone-50)]"
            style={{
              fontSize: 'clamp(2.75rem, 5vw, 5rem)',
              textShadow: '0 2px 24px rgba(44,41,36,0.5)',
            }}
          >
            <em>{greeting}</em>
          </h1>

          {/* Pull — featured study title */}
          {featuredStudy && (
            <p
              className="font-display font-normal leading-[1.2] text-[var(--stone-50)]/75 mt-1"
              style={{ fontSize: 'clamp(1rem, 2vw, 1.5rem)', textShadow: '0 1px 12px rgba(44,41,36,0.4)' }}
            >
              <em>{featuredStudy.title}</em>
            </p>
          )}
        </div>

        {/* Anchor card — bottom-right desktop, below-lockup mobile */}
        {featuredStudy && (
          <div className="animate-[fadeRise_400ms_ease-out_450ms_both] w-full md:w-auto">
            <FeaturedAnchorCard study={featuredStudy} categoryName={categoryName} />
          </div>
        )}
      </div>

      {/* Scroll indicator */}
      <div
        className="absolute bottom-5 left-1/2 -translate-x-1/2 flex flex-col items-center gap-1 text-[var(--stone-50)]/40 motion-safe:animate-[drift_2.5s_ease-in-out_infinite] hidden md:flex"
        aria-hidden="true"
      >
        <span className="text-[9px] uppercase tracking-[0.2em]">Scroll</span>
        <span className="text-base">&#8964;</span>
      </div>
    </section>
  );
}
