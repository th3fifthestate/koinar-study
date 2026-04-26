'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { StudyCard } from '@/components/library/study-card';
import type { StudyListItem } from '@/lib/db/types';

interface StudyGridProps {
  initialStudies: StudyListItem[];
  totalCount: number;
  userFavoriteIds: number[];
  currentPage: number;
  limit: number;
  isLoggedIn: boolean;
}

function NoResults({ hasFilters }: { hasFilters: boolean }) {
  const searchParams = useSearchParams();
  if (hasFilters) {
    return (
      <div className="py-24 text-center">
        <p className="font-display font-normal text-[1.75rem] text-[var(--text-primary)] mb-3">
          <em>Nothing answers that refine.</em>
        </p>
        <p className="font-body text-[1rem] text-[var(--text-secondary)] mb-6">
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
      <p className="font-display font-normal text-[1.75rem] text-[var(--text-primary)] mb-3">
        <em>No studies found.</em>
      </p>
    </div>
  );
}

function NoFavorites() {
  return (
    <div className="py-24 text-center">
      <p className="font-display font-normal text-[1.75rem] text-[var(--text-primary)] mb-3">
        <em>No favorites yet.</em>
      </p>
      <p className="font-body text-[1rem] text-[var(--text-secondary)] mb-6">
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
  userFavoriteIds: _userFavoriteIds,
  currentPage,
  limit,
  isLoggedIn: _isLoggedIn,
}: StudyGridProps) {
  const searchParams = useSearchParams();
  const [studies] = useState(initialStudies);

  const hasFilters =
    !!searchParams.get('q') ||
    !!searchParams.get('category') ||
    !!searchParams.get('format_type') ||
    (searchParams.get('sort') !== null && searchParams.get('sort') !== 'newest');
  const favoritesActive = searchParams.get('favorites') === 'true';

  const showEmpty = studies.length === 0;

  return (
    <section
      className="study-grid-bed relative"
      style={{
        background: 'var(--bed-warm)',
      }}
    >
      <style>{`
        .study-grid-bed { padding: 80px 56px 110px; }
        @media (max-width: 768px) {
          .study-grid-bed { padding: 56px 0 72px; }
          /* Compact TOC-style cards: drop the excerpt, tighten padding,
             scale the title down so the index page reads scannable
             instead of a 14-screen scroll. */
          .study-grid-bed .study-card-link {
            padding: 20px 24px 18px !important;
            min-height: 0 !important;
          }
          .study-grid-bed .study-card-excerpt { display: none; }
          .study-grid-bed .study-card-link h3 {
            font-size: 1.35rem !important;
            margin: 4px 0 12px !important;
          }
          .study-grid-bed .study-card-link [class*='font-sans'][style*='top'] {
            top: 22px !important;
            right: 24px !important;
          }
        }
      `}</style>
      {/* Faint olive-dot pattern overlay */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0"
        style={{
          backgroundImage:
            'radial-gradient(circle at 20px 20px, var(--reader-accent-deep) 0.4px, transparent 0.6px)',
          backgroundSize: '80px 80px',
          opacity: 0.06,
        }}
      />

      <div className="relative" aria-live="polite" aria-label="Study library results">
        {showEmpty ? (
          favoritesActive ? (
            <NoFavorites />
          ) : (
            <NoResults hasFilters={hasFilters || favoritesActive} />
          )
        ) : (
          <>
            <div
              className="study-grid grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3"
              style={{
                gap: 0,
                borderTop: '1px solid var(--text-rule)',
              }}
            >
              {studies.map((study, idx) => (
                <StudyCard key={study.id} study={study} index={idx} />
              ))}
            </div>

            {studies.length < totalCount && studies.length >= limit && (
              <div className="text-center mt-[60px]">
                <a
                  href={`/?${new URLSearchParams({ ...Object.fromEntries(searchParams.entries()), page: String(currentPage + 1) }).toString()}`}
                  className="font-display font-normal italic text-[1.25rem] text-[var(--warmth)] hover:text-[var(--text-primary)] transition-colors"
                >
                  Continue the library →
                </a>
              </div>
            )}
          </>
        )}
      </div>

      {/* Grid cell borders. Each cell sets its own border-right + border-bottom; we
          suppress border-right on the last column at each breakpoint via :nth-child. */}
      <style>{`
        .study-grid > .study-card-cell {
          border-right: 1px solid var(--text-rule);
          border-bottom: 1px solid var(--text-rule);
        }
        /* Mobile (1 col) — no border-right on any */
        @media (max-width: 767px) {
          .study-grid > .study-card-cell { border-right: none; }
        }
        /* Tablet (2 cols) — drop border-right on every 2nd */
        @media (min-width: 768px) and (max-width: 1279px) {
          .study-grid > .study-card-cell:nth-child(2n) { border-right: none; }
        }
        /* Desktop (3 cols) — drop border-right on every 3rd */
        @media (min-width: 1280px) {
          .study-grid > .study-card-cell:nth-child(3n) { border-right: none; }
        }
      `}</style>
    </section>
  );
}
