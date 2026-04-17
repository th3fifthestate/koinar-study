import Link from 'next/link';
import { ArrowUpRight } from 'lucide-react';
import type { StudySummary } from '@/lib/db/types';

interface FeaturedAnchorCardProps {
  study: StudySummary;
  categoryName: string | null;
}

export function FeaturedAnchorCard({ study, categoryName }: FeaturedAnchorCardProps) {
  return (
    <Link
      href={`/study/${study.slug}`}
      className="block group"
      aria-label={`Enter this study: ${study.title}`}
    >
      <div
        className="backdrop-blur-md border border-[var(--stone-50)]/15 p-6 transition-all duration-500 hover:border-[var(--stone-50)]/30"
        style={{
          background: 'rgba(44, 41, 36, 0.6)',
          width: 'min(340px, calc(100vw - 48px))',
        }}
      >
        {/* Category eyebrow */}
        {categoryName && (
          <p className="text-[9px] uppercase tracking-[0.28em] text-[var(--warmth)] mb-3">
            {categoryName}
          </p>
        )}

        {/* Sage divider */}
        <div className="w-8 h-px bg-[var(--sage-500)] mb-4" />

        {/* Title */}
        <h2
          className="font-display font-normal leading-[1.25] text-[var(--stone-50)] mb-3"
          style={{ fontSize: '1.375rem' }}
        >
          <em>{study.title}</em>
        </h2>

        {/* Summary */}
        {study.summary && (
          <p className="text-[1rem] leading-relaxed text-[var(--stone-50)]/55 line-clamp-2 mb-5 font-body">
            {study.summary}
          </p>
        )}

        {/* CTA */}
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-full border border-[var(--stone-50)]/30 flex items-center justify-center transition-all duration-400 group-hover:bg-[var(--stone-50)] group-hover:border-[var(--stone-50)]">
            <ArrowUpRight
              className="h-3.5 w-3.5 text-[var(--stone-50)] transition-colors duration-400 group-hover:text-[var(--stone-900)]"
            />
          </div>
          <span className="text-[9px] uppercase tracking-[0.22em] text-[var(--warmth)]">
            Enter this study
          </span>
        </div>
      </div>
    </Link>
  );
}
