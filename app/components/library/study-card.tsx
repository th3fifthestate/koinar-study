// app/components/library/study-card.tsx
'use client';

import Link from 'next/link';
import { motion, useReducedMotion } from 'framer-motion';
import type { StudyListItem } from '@/lib/db/types';
import { Skeleton } from '@/components/ui/skeleton';

interface StudyCardProps {
  study: StudyListItem;
  index: number;
}

const FORMAT_LABEL: Record<StudyListItem['format_type'], string> = {
  quick: 'Quick',
  standard: 'Standard',
  comprehensive: 'Deep',
};

export function StudyCard({ study, index }: StudyCardProps) {
  const prefersReducedMotion = useReducedMotion();
  const numLabel = String(index + 1).padStart(2, '0');
  const categoryLine = study.category_name ?? 'Uncategorized';
  const formatLabel = FORMAT_LABEL[study.format_type] ?? 'Standard';
  const footerLeft = `${formatLabel} · ${study.translation_used}`;

  return (
    <motion.div
      initial={prefersReducedMotion ? false : { opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={prefersReducedMotion ? { duration: 0 } : { duration: 0.4, delay: index * 0.05 }}
      className="study-card-cell"
    >
      <Link
        href={`/study/${study.slug}`}
        className="group study-card-link block relative cursor-pointer hover:bg-[rgba(247,246,243,0.28)]"
        style={{
          padding: '38px 28px 32px',
          minHeight: '320px',
          display: 'flex',
          flexDirection: 'column',
          transition: 'background 0.3s ease',
        }}
      >
        {/* Number indicator */}
        <span
          className="font-sans"
          style={{
            position: 'absolute',
            top: '38px',
            right: '28px',
            fontSize: '10px',
            letterSpacing: '0.16em',
            color: 'var(--stone-500)',
          }}
        >
          No. {numLabel}
        </span>

        {/* Category line with hairline rule */}
        <div
          className="font-sans"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            fontSize: '10px',
            fontWeight: 500,
            letterSpacing: '0.28em',
            textTransform: 'uppercase',
            color: 'var(--reader-accent-deep)',
            marginBottom: '14px',
          }}
        >
          <span>{categoryLine}</span>
          <span
            aria-hidden="true"
            style={{
              flex: '0 0 28px',
              height: '1px',
              background: 'var(--reader-accent)',
              opacity: 0.65,
            }}
          />
        </div>

        {/* Title */}
        <h3
          className="font-display"
          style={{
            fontStyle: 'italic',
            fontWeight: 400,
            fontSize: '1.85rem',
            lineHeight: 1.05,
            color: 'var(--stone-900)',
            letterSpacing: '-0.005em',
            fontVariationSettings: '"opsz" 96',
            margin: '6px 0 18px',
          }}
        >
          {study.title}
        </h3>

        {/* Excerpt — only render when we have summary text, otherwise the
            sage left-border floats as a stray hairline above the footer.
            Hidden on mobile to keep the grid scannable. */}
        {study.summary ? (
          <div
            className="study-card-excerpt font-body"
            style={{
              fontStyle: 'italic',
              fontSize: '0.95rem',
              lineHeight: 1.55,
              color: 'var(--stone-700)',
              borderLeft: '1px solid var(--reader-accent)',
              paddingLeft: '14px',
              opacity: 0.92,
              marginBottom: '22px',
              flex: 1,
            }}
          >
            {study.summary}
          </div>
        ) : (
          <div className="study-card-excerpt" style={{ flex: 1, marginBottom: '22px' }} aria-hidden="true" />
        )}

        {/* Footer */}
        <div
          className="font-sans"
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'baseline',
            paddingTop: '14px',
            borderTop: '1px solid rgba(77, 73, 67, 0.14)',
            fontSize: '9px',
            letterSpacing: '0.22em',
            textTransform: 'uppercase',
            color: 'var(--stone-500)',
          }}
        >
          <span>{footerLeft}</span>
          <span
            aria-hidden="true"
            className="study-card-arrow inline-block transition-[transform,color] duration-200 group-hover:translate-x-[4px] group-hover:text-[var(--reader-accent-deep)]"
            style={{
              color: 'var(--stone-700)',
            }}
          >
            →
          </span>
        </div>
      </Link>
    </motion.div>
  );
}

export function StudyCardSkeleton() {
  return (
    <div
      style={{
        padding: '38px 28px 32px',
        minHeight: '320px',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      <Skeleton className="h-2 w-32 mb-4" />
      <Skeleton className="h-7 w-4/5 mb-2" />
      <Skeleton className="h-7 w-3/5 mb-5" />
      <div className="flex-1 space-y-2">
        <Skeleton className="h-3 w-full" />
        <Skeleton className="h-3 w-5/6" />
        <Skeleton className="h-3 w-2/3" />
      </div>
      <div className="pt-4 mt-4 border-t border-[rgba(77,73,67,0.14)]">
        <Skeleton className="h-2 w-24" />
      </div>
    </div>
  );
}
