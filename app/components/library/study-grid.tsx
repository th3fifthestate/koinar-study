// app/components/library/study-grid.tsx
'use client';

import { useState, useCallback } from 'react';
import { useSearchParams } from 'next/navigation';
import { StudyCard, StudyCardSkeleton } from '@/components/library/study-card';
import { EmptyState } from '@/components/library/empty-state';
import type { StudyListItem } from '@/lib/db/types';

interface StudyGridProps {
  initialStudies: StudyListItem[];
  totalCount: number;
  userFavoriteIds: number[];
  currentPage: number;
  limit: number;
  isLoggedIn: boolean;
}

export function StudyGrid({
  initialStudies,
  totalCount,
  userFavoriteIds,
  currentPage,
  limit,
  isLoggedIn,
}: StudyGridProps) {
  const searchParams = useSearchParams();
  const [studies, setStudies] = useState(initialStudies);
  const [page, setPage] = useState(currentPage);
  const [loading, setLoading] = useState(false);
  const [favoriteIds] = useState(() => new Set(userFavoriteIds));

  const hasMore = studies.length < totalCount;

  const loadMore = useCallback(async () => {
    if (loading || !hasMore) return;
    setLoading(true);

    try {
      const nextPage = page + 1;
      const params = new URLSearchParams(searchParams.toString());
      params.set('page', String(nextPage));
      params.set('limit', String(limit));

      const res = await fetch(`/api/studies?${params.toString()}`);
      if (!res.ok) throw new Error('Failed to load');
      const data = await res.json();

      setStudies((prev) => [...prev, ...data.studies]);
      setPage(nextPage);
    } catch {
      // Silently fail — user can try again
    } finally {
      setLoading(false);
    }
  }, [loading, hasMore, page, searchParams, limit]);

  if (studies.length === 0) {
    return <EmptyState />;
  }

  return (
    <div>
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
        {studies.map((study, index) => (
          <StudyCard
            key={study.id}
            study={study}
            isFavorited={favoriteIds.has(study.id)}
            index={index}
            isLoggedIn={isLoggedIn}
          />
        ))}
        {loading &&
          Array.from({ length: 4 }).map((_, i) => (
            <StudyCardSkeleton key={`skel-${i}`} />
          ))}
      </div>
      {hasMore && !loading && (
        <div className="text-center mt-12">
          <button
            onClick={loadMore}
            className="inline-flex items-center gap-2.5 px-7 py-3 border border-[var(--stone-200)] rounded-md font-body text-[11px] uppercase tracking-[0.15em] text-[var(--stone-700)] bg-transparent hover:border-[var(--stone-700)] hover:bg-[var(--stone-100)] transition-all duration-300"
          >
            Load More Studies
          </button>
        </div>
      )}
    </div>
  );
}
