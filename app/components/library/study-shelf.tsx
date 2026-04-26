'use client';

import Link from 'next/link';
import { useCallback, useRef } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { ShelfCard } from './shelf-card';
import type { StudyListItem } from '@/lib/db/types';

interface StudyShelfProps {
  /** Italic Fraunces label rendered in the shelf header. */
  label: string;
  /** Studies in this shelf. First is rendered with isLead. */
  studies: readonly StudyListItem[];
  /** When set, "View all →" links to /?category={categorySlug}.
   *  When undefined (e.g. "In this issue"), use `viewAllHref` instead. */
  categorySlug?: string | null;
  /** Override for the view-all destination (used by recency shelves). */
  viewAllHref?: string;
  /** Override the count meta on the right of the label. */
  meta?: string;
  /** Hide view-all link when there's no meaningful "all" page (rare). */
  hideViewAll?: boolean;
}

const CARD_WIDTH = 320;
const CARD_GAP = 18;
const SCROLL_STEP = CARD_WIDTH + CARD_GAP;

export function StudyShelf({
  label,
  studies,
  categorySlug,
  viewAllHref,
  meta,
  hideViewAll = false,
}: StudyShelfProps) {
  const trackRef = useRef<HTMLDivElement | null>(null);

  const scrollBy = useCallback((direction: -1 | 1) => {
    const el = trackRef.current;
    if (!el) return;
    el.scrollBy({ left: direction * SCROLL_STEP, behavior: 'smooth' });
  }, []);

  if (studies.length === 0) return null;

  const countLabel = meta ?? `${studies.length} reading${studies.length === 1 ? '' : 's'}`;
  const viewAll = viewAllHref ?? (categorySlug ? `/?category=${encodeURIComponent(categorySlug)}` : null);

  return (
    <section className="study-shelf" aria-label={label}>
      <button
        type="button"
        className="study-shelf-arrow left"
        aria-label={`Scroll ${label} shelf left`}
        onClick={() => scrollBy(-1)}
      >
        <ChevronLeft size={16} strokeWidth={1.6} />
      </button>
      <button
        type="button"
        className="study-shelf-arrow right"
        aria-label={`Scroll ${label} shelf right`}
        onClick={() => scrollBy(1)}
      >
        <ChevronRight size={16} strokeWidth={1.6} />
      </button>

      <div className="study-shelf-head">
        <span className="study-shelf-head-label">
          <em>{label}</em>
          <span className="study-shelf-head-count">{countLabel}</span>
        </span>
        {!hideViewAll && viewAll ? (
          <Link className="study-shelf-view-all" href={viewAll}>
            View all →
          </Link>
        ) : null}
      </div>

      <div className="study-shelf-track-wrap">
        <div ref={trackRef} className="study-shelf-track" role="list">
          {studies.map((study, idx) => (
            <ShelfCard key={study.id} study={study} isLead={idx === 0} />
          ))}
        </div>
      </div>
    </section>
  );
}
