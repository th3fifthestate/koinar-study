'use client';

import { useCallback, useRef } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { ShelfCard } from './shelf-card';
import type { StudyListItem } from '@/lib/db/types';

interface StudyShelfProps {
  /** Italic Fraunces label rendered in the shelf header. */
  label: string;
  /** Studies in this shelf. First is rendered with isLead. */
  studies: readonly StudyListItem[];
  /** Override the count meta on the right of the label. */
  meta?: string;
}

const CARD_WIDTH = 320;
const CARD_GAP = 18;
const SCROLL_STEP = CARD_WIDTH + CARD_GAP;

export function StudyShelf({
  label,
  studies,
  meta,
}: StudyShelfProps) {
  const trackRef = useRef<HTMLDivElement | null>(null);

  const scrollBy = useCallback((direction: -1 | 1) => {
    const el = trackRef.current;
    if (!el) return;
    el.scrollBy({ left: direction * SCROLL_STEP, behavior: 'smooth' });
  }, []);

  if (studies.length === 0) return null;

  const countLabel = meta ?? `${studies.length} reading${studies.length === 1 ? '' : 's'}`;

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
