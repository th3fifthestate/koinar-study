// app/components/library/study-card.tsx
'use client';

import Link from 'next/link';
import { motion, useReducedMotion } from 'framer-motion';
import { ArrowUpRight } from 'lucide-react';
import { FavoriteButton } from '@/components/library/favorite-button';
import type { StudyListItem } from '@/lib/db/types';
import { Skeleton } from '@/components/ui/skeleton';

interface StudyCardProps {
  study: StudyListItem;
  isFavorited: boolean;
  index: number;
  isLoggedIn: boolean;
}

const CATEGORY_GRADIENTS: Record<string, string> = {
  'old-testament': 'from-[var(--sage-300)]/20 to-[var(--stone-200)]/30',
  'new-testament': 'from-[var(--sage-500)]/15 to-[var(--stone-200)]/20',
  'topical': 'from-[var(--warmth)]/15 to-[var(--stone-200)]/20',
  'people': 'from-[var(--stone-300)]/20 to-[var(--sage-300)]/15',
  'word-studies': 'from-[var(--sage-700)]/10 to-[var(--stone-300)]/20',
  'book-studies': 'from-[var(--stone-200)]/30 to-[var(--sage-300)]/20',
};

export function StudyCard({ study, isFavorited, index, isLoggedIn }: StudyCardProps) {
  const prefersReducedMotion = useReducedMotion();
  const gradientClass =
    CATEGORY_GRADIENTS[study.category_slug ?? ''] ?? 'from-[var(--stone-200)]/30 to-[var(--sage-300)]/15';

  return (
    <motion.div
      initial={prefersReducedMotion ? false : { opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={prefersReducedMotion ? { duration: 0 } : { duration: 0.4, delay: index * 0.05 }}
    >
      <Link href={`/study/${study.slug}`} className="block group">
        <div className="flex gap-5 p-7 border border-transparent bg-[var(--stone-50)] transition-all duration-500 [transition-timing-function:cubic-bezier(0.16,1,0.3,1)] hover:border-[var(--stone-200)] hover:bg-[#faf9f7] hover:-translate-y-0.5 hover:shadow-[0_12px_40px_rgba(44,41,36,0.06)]">
          {/* Text side */}
          <div className="flex-1 flex flex-col min-w-0">
            <div className="flex items-center gap-2.5 mb-3.5">
              <div className="h-px bg-[var(--sage-500)] w-6 transition-all duration-500 [transition-timing-function:cubic-bezier(0.16,1,0.3,1)] group-hover:w-10" />
              <span className="text-[9px] uppercase tracking-[0.25em] text-[var(--sage-500)]">
                {study.category_name ?? 'Uncategorized'}
              </span>
            </div>

            <h3 className="font-display text-[21px] font-normal leading-[1.25] text-[var(--stone-900)] mb-2.5 line-clamp-2">
              {study.title}
            </h3>

            <p className="text-[13px] leading-relaxed text-[var(--stone-300)] line-clamp-3 flex-1 transition-colors duration-500 group-hover:text-[var(--stone-700)]">
              {study.summary}
            </p>

            <div className="flex items-center gap-3 mt-3">
              <FavoriteButton
                studyId={study.id}
                initialFavorited={isFavorited}
                initialCount={study.favorite_count}
                isLoggedIn={isLoggedIn}
              />
              <span className="text-[11px] text-[var(--stone-300)]">
                {study.translation_used}
              </span>
              {study.author_display_name && (
                <span className="text-[11px] text-[var(--stone-300)]">
                  {study.author_display_name}
                </span>
              )}
            </div>

            <div className="flex items-center gap-2.5 mt-3.5">
              <div className="w-[30px] h-[30px] rounded-full border border-[var(--stone-200)] flex items-center justify-center text-[var(--stone-700)] text-[11px] transition-all duration-400 [transition-timing-function:cubic-bezier(0.16,1,0.3,1)] group-hover:bg-[var(--stone-900)] group-hover:text-[var(--stone-50)] group-hover:border-[var(--stone-900)]">
                <ArrowUpRight className="h-3 w-3" />
              </div>
              <span className="text-[9px] uppercase tracking-[0.18em] text-[var(--stone-300)] opacity-0 -translate-x-2 transition-all duration-400 group-hover:opacity-100 group-hover:translate-x-0">
                Read
              </span>
            </div>
          </div>

          {/* Image side */}
          <div className="w-[150px] shrink-0 relative">
            <div className="absolute -inset-1.5 border border-transparent transition-all duration-500 [transition-timing-function:cubic-bezier(0.16,1,0.3,1)] group-hover:border-[var(--stone-900)]/[0.06]" />

            <div className="w-full h-[190px] overflow-hidden relative rounded-[2px]">
              {study.featured_image_url ? (
                <img
                  src={study.featured_image_url}
                  alt=""
                  className="w-full h-full object-cover saturate-[0.85] transition-all duration-800 [transition-timing-function:cubic-bezier(0.16,1,0.3,1)] group-hover:scale-[1.03] group-hover:saturate-100"
                  loading="lazy"
                />
              ) : (
                <div className={`w-full h-full bg-gradient-to-br ${gradientClass}`} />
              )}

              <div className="absolute inset-0 shadow-[inset_0_0_30px_10px_rgba(247,246,243,0.25)] pointer-events-none" />

              <div className="absolute top-1.5 left-1.5 w-3 h-px bg-white/60 origin-left scale-x-0 opacity-0 transition-all duration-400 [transition-timing-function:cubic-bezier(0.16,1,0.3,1)] group-hover:scale-x-100 group-hover:opacity-100 [transition-delay:50ms]" />
              <div className="absolute top-1.5 left-1.5 w-px h-3 bg-white/60 origin-top scale-y-0 opacity-0 transition-all duration-400 [transition-timing-function:cubic-bezier(0.16,1,0.3,1)] group-hover:scale-y-100 group-hover:opacity-100 [transition-delay:100ms]" />
              <div className="absolute bottom-1.5 right-1.5 w-3 h-px bg-white/60 origin-right scale-x-0 opacity-0 transition-all duration-400 [transition-timing-function:cubic-bezier(0.16,1,0.3,1)] group-hover:scale-x-100 group-hover:opacity-100 [transition-delay:150ms]" />
              <div className="absolute bottom-1.5 right-1.5 w-px h-3 bg-white/60 origin-bottom scale-y-0 opacity-0 transition-all duration-400 [transition-timing-function:cubic-bezier(0.16,1,0.3,1)] group-hover:scale-y-100 group-hover:opacity-100 [transition-delay:200ms]" />
            </div>

            <span className="absolute -bottom-4 right-0 font-mono text-[10px] text-[var(--stone-300)] opacity-30 transition-all duration-500 group-hover:opacity-80">
              {String(index + 1).padStart(2, '0')}
            </span>
          </div>
        </div>
      </Link>
    </motion.div>
  );
}

export function StudyCardSkeleton() {
  return (
    <div className="flex gap-5 p-7">
      <div className="flex-1 space-y-3">
        <Skeleton className="h-2 w-24" />
        <Skeleton className="h-6 w-48" />
        <Skeleton className="h-6 w-36" />
        <Skeleton className="h-3 w-full" />
        <Skeleton className="h-3 w-4/5" />
        <Skeleton className="h-3 w-3/5" />
        <div className="flex gap-3 mt-4">
          <Skeleton className="h-3 w-12" />
          <Skeleton className="h-3 w-8" />
        </div>
      </div>
      <Skeleton className="w-[150px] h-[190px] shrink-0 rounded-[2px]" />
    </div>
  );
}
