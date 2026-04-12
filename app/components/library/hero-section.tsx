// app/components/library/hero-section.tsx
'use client';

import Link from 'next/link';
import { ArrowUpRight } from 'lucide-react';
import type { StudyListItem } from '@/lib/db/types';

interface HeroSectionProps {
  username?: string;
  displayName?: string;
  featuredStudy: StudyListItem | null;
}

function getTimeOfDay(): { label: string; greeting: string } {
  const hour = new Date().getHours();
  if (hour >= 5 && hour < 7) return { label: 'Dawn', greeting: 'Good morning' };
  if (hour >= 7 && hour < 12) return { label: 'Morning', greeting: 'Good morning' };
  if (hour >= 12 && hour < 15) return { label: 'Midday', greeting: 'Good afternoon' };
  if (hour >= 15 && hour < 18) return { label: 'Golden Hour', greeting: 'Good afternoon' };
  if (hour >= 18 && hour < 21) return { label: 'Evening', greeting: 'Good evening' };
  return { label: 'Night', greeting: 'Good evening' };
}

// Local placeholder images mapped to time periods.
// These will be replaced with Flux-generated images on images.koinar.app (R2) once Brief 11 is complete.
const HERO_IMAGES: Record<string, string> = {
  Dawn: '/images/09-morning-porch.jpeg',
  Morning: '/images/09-morning-porch.jpeg',
  Midday: '/images/02-day-coffee-shop.jpeg',
  'Golden Hour': '/images/05-solomons-portico.jpeg',
  Evening: '/images/11-stone-archway.jpeg',
  Night: '/images/11-stone-archway.jpeg',
};

export function HeroSection({ username, displayName, featuredStudy }: HeroSectionProps) {
  const { label, greeting } = getTimeOfDay();
  const name = displayName ?? username ?? 'friend';
  const heroImage = HERO_IMAGES[label] ?? HERO_IMAGES['Morning'];

  return (
    <section className="h-dvh flex flex-col md:flex-row relative overflow-hidden">
      {/* Left: Image */}
      <div className="w-full h-[50vh] md:h-full md:w-[58%] relative overflow-hidden">
        <img
          src={heroImage}
          alt="Biblical landscape"
          className="w-full h-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-transparent to-[var(--stone-900)]/40 hidden md:block" />
        <div className="absolute inset-0 bg-gradient-to-b from-transparent to-[var(--stone-900)]/40 md:hidden" />
      </div>

      {/* Right: Content */}
      <div className="flex-1 flex flex-col justify-center px-8 py-12 md:px-12 md:py-16 bg-[var(--stone-900)] text-[var(--stone-50)] relative">
        {/* Time label */}
        <div className="flex items-center gap-3 mb-8">
          <div className="w-10 h-px bg-[var(--warmth)]" />
          <span className="text-[10px] uppercase tracking-[0.3em] text-[var(--warmth)]">
            {label}
          </span>
        </div>

        {/* Greeting */}
        <h1 className="font-display text-[32px] md:text-[46px] font-normal leading-[1.15] mb-12">
          {greeting},<br />
          <em className="italic text-[var(--warmth)]">{name}</em>
        </h1>

        {/* Divider */}
        <div className="w-[60px] h-px bg-[var(--stone-50)]/[0.12] mb-8" />

        {/* Featured study */}
        {featuredStudy ? (
          <>
            <span className="text-[10px] uppercase tracking-[0.25em] text-[var(--stone-50)]/40 mb-3.5">
              Featured Study
            </span>
            <h2 className="font-display text-2xl font-normal leading-[1.3] mb-3">
              {featuredStudy.title}
            </h2>
            <p className="text-sm leading-relaxed text-[var(--stone-50)]/45 max-w-[300px] mb-6">
              {featuredStudy.summary}
            </p>
            <Link
              href={`/study/${featuredStudy.slug}`}
              className="flex items-center gap-3"
            >
              <div className="w-10 h-10 rounded-full border border-[var(--stone-50)]/25 flex items-center justify-center text-[var(--stone-50)] hover:bg-[var(--stone-50)] hover:text-[var(--stone-900)] hover:border-[var(--stone-50)] transition-all duration-400 [transition-timing-function:cubic-bezier(0.16,1,0.3,1)]">
                <ArrowUpRight className="h-4 w-4" />
              </div>
              <span className="text-[10px] uppercase tracking-[0.2em] text-[var(--stone-50)]/35">
                Read Study
              </span>
            </Link>
          </>
        ) : (
          <>
            <span className="text-[10px] uppercase tracking-[0.25em] text-[var(--stone-50)]/40 mb-3.5">
              Welcome
            </span>
            <p className="text-sm leading-relaxed text-[var(--stone-50)]/45 max-w-[300px]">
              Your study library awaits. Generate your first study or explore what others have shared.
            </p>
          </>
        )}

        {/* Scroll indicator */}
        <div className="absolute bottom-7 left-1/2 -translate-x-1/2 flex flex-col items-center gap-1.5 text-[var(--stone-50)]/25 motion-safe:animate-[drift_2.5s_ease-in-out_infinite]">
          <span className="text-[10px] uppercase tracking-[0.15em]">Browse Library</span>
          <span className="text-lg">&#8964;</span>
        </div>
      </div>
    </section>
  );
}
