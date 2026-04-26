// app/components/library/shelf-card.tsx
import Link from 'next/link';
import type { StudyListItem } from '@/lib/db/types';
import {
  getCategoryVisual,
  eyebrowDotColor,
  cornerMarkColor,
} from '@/lib/library/category-config';

interface ShelfCardProps {
  study: StudyListItem;
  /** First card in each shelf. Switches to ink-bedded variant. */
  isLead?: boolean;
}

const FORMAT_LABEL: Record<string, string> = {
  quick: 'Quick',
  standard: 'Standard',
  comprehensive: 'Deep',
};

/**
 * 320px-wide tipped-in plate that lives in a horizontal shelf track.
 * Replaces the legacy text-only StudyCard for the shelves model.
 *
 * Visual treatment per `category-config.ts`:
 *   - Per-category bg tint via [data-cat] selector
 *   - Optional watermark SVG (only Letters/OT/Wisdom/Book Studies)
 *   - Sage or warmth corner-mark + eyebrow dot from category accent
 *   - Letterpress title (subtle highlight + deboss text-shadow)
 *   - Paper-grain ::before overlay
 *   - Lead variant: ink bed with warmth accents
 */
export function ShelfCard({ study, isLead = false }: ShelfCardProps) {
  const visual = getCategoryVisual(study.category_slug);
  const formatLabel = FORMAT_LABEL[study.format_type ?? ''] ?? 'Standard';
  const eyebrowText =
    study.category_name ?? visual.displayName;
  const dotColor = eyebrowDotColor(visual.accent);
  const cornerColor = cornerMarkColor(visual.accent);

  return (
    <Link
      href={`/study/${study.slug}`}
      role="listitem"
      className={`shelf-card group ${isLead ? 'shelf-card-lead' : ''}`}
      data-cat={study.category_slug ?? 'uncategorized'}
      data-watermark={visual.watermarkSvg ? 'true' : 'false'}
      style={
        {
          background: isLead ? 'var(--card-ink-bed)' : `var(${visual.tintVar})`,
          // Watermark URL is consumed by the .shelf-card::after rule when
          // data-watermark="true". CSS custom property = no inline style on
          // the pseudo-element, which CSS doesn't allow.
          ['--shelf-card-watermark' as string]: visual.watermarkSvg
            ? `url("${visual.watermarkSvg}")`
            : 'none',
        } as React.CSSProperties
      }
    >
      <span
        className="shelf-card-corner"
        aria-hidden="true"
        style={{
          // Lead variant: warmth corner regardless of category accent
          borderTopColor: isLead ? 'var(--warmth)' : cornerColor,
          borderRightColor: isLead ? 'var(--warmth)' : cornerColor,
        }}
      />

      <div
        className="shelf-card-cat"
        style={{
          color: isLead ? 'var(--warmth)' : dotColor,
        }}
      >
        <span className="shelf-card-cat-dot" aria-hidden="true" />
        <span>{eyebrowText}</span>
      </div>

      <h3
        className="shelf-card-title"
        style={{
          color: isLead ? 'var(--stone-50)' : 'var(--text-primary)',
          textShadow: isLead
            ? '0 1px 0 rgba(0,0,0,0.45)'
            : '0 1px 0 rgba(255,255,255,0.55), 0 -1px 0 rgba(20,18,14,0.04)',
        }}
      >
        {study.title}
      </h3>

      {study.summary ? (
        <p
          className="shelf-card-reference"
          style={{
            color: isLead ? 'rgba(255,255,255,0.7)' : 'var(--text-secondary)',
          }}
        >
          {study.summary}
        </p>
      ) : null}

      <div
        className="shelf-card-meta"
        style={{
          borderTopColor: isLead
            ? 'rgba(255,255,255,0.14)'
            : 'rgba(77, 73, 67, 0.12)',
          color: isLead ? 'rgba(255,255,255,0.55)' : 'var(--text-muted)',
        }}
      >
        <span>{formatLabel}</span>
        <span
          style={{
            color: isLead ? 'rgba(255,255,255,0.85)' : 'var(--text-secondary)',
          }}
        >
          {study.translation_used}
        </span>
      </div>
    </Link>
  );
}
