'use client';

import { useState } from 'react';
import Link from 'next/link';
import { motion, useReducedMotion } from 'framer-motion';
import { useSearchParams } from 'next/navigation';
import { StudyCard } from '@/components/library/study-card';
import type { StudyListItem } from '@/lib/db/types';

interface InterruptionCard {
  index: number;
  component: React.ReactNode;
}

interface StudyGridProps {
  initialStudies: StudyListItem[];
  totalCount: number;
  userFavoriteIds: number[];
  currentPage: number;
  limit: number;
  isLoggedIn: boolean;
  interruptionCards?: InterruptionCard[];
}

function NoResults({ hasFilters }: { hasFilters: boolean }) {
  const searchParams = useSearchParams();
  if (hasFilters) {
    return (
      <div className="py-24 text-center">
        <p
          className="font-display font-normal text-[1.75rem] text-[var(--stone-700)] mb-3"
        >
          <em>Nothing answers that refine.</em>
        </p>
        <p className="font-body text-[1rem] text-[var(--stone-300)] mb-6">
          Clear a filter or widen the search.
        </p>
        <a
          href={`/?q=${searchParams.get('q') ?? ''}`}
          className="font-body text-[0.9375rem] text-[var(--warmth)] underline-offset-4 hover:underline"
        >
          Clear all refinements
        </a>
      </div>
    );
  }
  return (
    <div className="py-24 text-center">
      <p className="font-display font-normal text-[1.75rem] text-[var(--stone-700)] mb-3">
        <em>No studies found.</em>
      </p>
    </div>
  );
}

function NoFavorites() {
  return (
    <div className="py-24 text-center">
      <p className="font-display font-normal text-[1.75rem] text-[var(--stone-700)] mb-3">
        <em>No favorites yet.</em>
      </p>
      <p className="font-body text-[1rem] text-[var(--stone-300)] mb-6">
        Tap the heart on any reading to save it here.
      </p>
      <Link
        href="/"
        className="font-body text-[0.9375rem] text-[var(--warmth)] underline-offset-4 hover:underline"
      >
        Browse the library
      </Link>
    </div>
  );
}

export function StudyGrid({
  initialStudies,
  totalCount,
  userFavoriteIds,
  currentPage,
  limit,
  isLoggedIn,
  interruptionCards = [],
}: StudyGridProps) {
  const prefersReducedMotion = useReducedMotion();
  const searchParams = useSearchParams();
  const [studies] = useState(initialStudies);
  const [favoriteIds] = useState(() => new Set(userFavoriteIds));

  const hasFilters =
    !!searchParams.get('q') ||
    !!searchParams.get('category') ||
    !!searchParams.get('format_type') ||
    (searchParams.get('sort') !== null && searchParams.get('sort') !== 'newest');
  const favoritesActive = searchParams.get('favorites') === 'true';

  const leadIndex = !hasFilters && !favoritesActive && currentPage === 1 ? 0 : -1;

  if (studies.length === 0) {
    if (favoritesActive) return <NoFavorites />;
    return <NoResults hasFilters={hasFilters || favoritesActive} />;
  }

  // Build the merged cell sequence (studies + interruption cards at their indices)
  const interruptionMap = new Map(interruptionCards.map((c) => [c.index, c.component]));
  const totalCells = studies.length + interruptionCards.length;
  const cells: Array<
    | { type: 'study'; study: StudyListItem; studyIndex: number }
    | { type: 'interruption'; key: number; component: React.ReactNode }
  > = [];
  let studyIdx = 0;
  for (let i = 0; i < totalCells; i++) {
    const interruption = interruptionMap.get(i);
    if (interruption != null) {
      cells.push({ type: 'interruption', key: i, component: interruption });
    } else if (studyIdx < studies.length) {
      cells.push({ type: 'study', study: studies[studyIdx], studyIndex: studyIdx });
      studyIdx++;
    }
  }

  return (
    <div aria-live="polite" aria-label="Study library results">
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-8">
        {cells.map((cell, cellIndex) => {
          if (cell.type === 'interruption') {
            return (
              <motion.div
                key={`interruption-${cell.key}`}
                initial={prefersReducedMotion ? false : { opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={prefersReducedMotion ? { duration: 0 } : { duration: 0.4, delay: Math.min(cellIndex * 0.05, 0.3) }}
              >
                {cell.component}
              </motion.div>
            );
          }

          const isLead = cell.studyIndex === leadIndex;
          return (
            <StudyCard
              key={cell.study.id}
              study={cell.study}
              isFavorited={favoriteIds.has(cell.study.id)}
              index={cell.studyIndex}
              isLoggedIn={isLoggedIn}
              variant={isLead ? 'lead' : 'default'}
            />
          );
        })}
      </div>

      {/* At 11 studies, pagination never triggers. Skeleton placeholder kept for future growth. */}
      {studies.length < totalCount && studies.length >= limit && (
        <div className="text-center mt-16">
          <a
            href={`/?${new URLSearchParams({ ...Object.fromEntries(searchParams.entries()), page: String(currentPage + 1) }).toString()}`}
            className="font-display font-normal italic text-[1.25rem] text-[var(--warmth)] hover:text-[var(--stone-700)] transition-colors"
          >
            Continue the library →
          </a>
        </div>
      )}
    </div>
  );
}
