import Image from 'next/image';
import Link from 'next/link';
import type { StudySummary } from '@/lib/db/types';
import { getFeaturedPlateForToday } from '@/lib/home/featured-plates';

interface FeaturedStudyProps {
  study: StudySummary | null;
}

/** UTC day-of-year (1-indexed) — matches hero issue line. */
function getDayOfYear(d: Date): number {
  const start = Date.UTC(d.getUTCFullYear(), 0, 0);
  const diff = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()) - start;
  return Math.floor(diff / 86_400_000);
}

function formatTypeLabel(format: StudySummary['format_type']): string {
  switch (format) {
    case 'quick':
      return 'QUICK STUDY';
    case 'comprehensive':
      return 'DEEP STUDY';
    case 'standard':
    default:
      return 'STANDARD STUDY';
  }
}

/**
 * Split a title into a "caps head" and an italic tail. Splits on the FIRST
 * em-dash or colon. Trims whitespace and surrounding punctuation. If neither
 * separator is present, the entire title is the head and the tail is null
 * (caller can fall back to study.summary's first clause if desired).
 */
function splitTitle(title: string): { head: string; tail: string | null } {
  const trimmed = title.trim();
  // Search for first occurrence of either separator.
  let splitIdx = -1;
  let sepLen = 1;
  for (let i = 0; i < trimmed.length; i++) {
    const ch = trimmed[i];
    if (ch === '—' || ch === '–') {
      // em or en dash
      splitIdx = i;
      sepLen = 1;
      break;
    }
    if (ch === ':') {
      splitIdx = i;
      sepLen = 1;
      break;
    }
  }
  if (splitIdx === -1) {
    return { head: trimmed, tail: null };
  }
  const head = trimmed.slice(0, splitIdx).trim();
  const tail = trimmed.slice(splitIdx + sepLen).trim();
  if (!head) return { head: trimmed, tail: null };
  return { head, tail: tail || null };
}

/**
 * FeaturedStudy — Stage 5 of the Library Redesign.
 *
 * Full-bleed editorial plate that sits between the LibraryThreshold and the
 * StudyGrid. Background image rotates daily (`getFeaturedPlateForToday`) and
 * is independent of the study. Content (category, title, summary, meta) comes
 * from the rotated featured study (`getFeaturedForToday`). Renders nothing
 * if no study is provided. If the plate manifest is empty, falls back to a
 * warm-tone gradient bed.
 */
export function FeaturedStudy({ study }: FeaturedStudyProps) {
  if (!study) return null;

  const plate = getFeaturedPlateForToday();
  const { head, tail } = splitTitle(study.title);

  // Issue/format meta line ("NO. 47 · STANDARD STUDY"). Day-of-year is server-
  // computed; harmless if it differs by ±1 from the client's local-tz day —
  // this is decorative.
  const dayOfYear = getDayOfYear(new Date());
  const metaRight = `NO. ${dayOfYear} · ${formatTypeLabel(study.format_type)}`;

  // StudySummary doesn't carry category_name / scripture_reference / read_minutes /
  // author_display_name. Render only what's present, fall through gracefully.
  const summary = study.summary ?? '';
  const translation = study.translation_used;

  // Fallback gradient when manifest is empty. Mirrors the v8 mockup's
  // .featured-block background fallback (warm radial + linear stack).
  const fallbackGradient = `
    radial-gradient(ellipse at 22% 28%, rgba(196, 154, 108, 0.42) 0%, transparent 55%),
    radial-gradient(ellipse at 78% 70%, rgba(107, 92, 64, 0.55) 0%, transparent 60%),
    linear-gradient(135deg, #2a241c 0%, #3a2f22 50%, #221d16 100%)
  `;

  return (
    <>
      <style>{`
        .featured-study-block {
          position: relative;
          margin: -80px 0 0;
          padding: 80px 56px 96px;
          color: var(--stone-50);
          overflow: hidden;
          isolation: isolate;
          display: block;
          text-decoration: none;
        }
        .featured-study-bg {
          position: absolute;
          inset: 0;
          z-index: -1;
        }
        .featured-study-bg img {
          object-fit: cover;
        }
        .featured-study-scrim {
          position: absolute;
          inset: 0;
          z-index: 0;
          pointer-events: none;
          background:
            linear-gradient(110deg, rgba(20, 18, 14, 0.62) 0%, rgba(20, 18, 14, 0.40) 45%, rgba(20, 18, 14, 0.18) 100%),
            radial-gradient(ellipse at 80% 70%, rgba(20, 18, 14, 0.45) 0%, transparent 60%);
        }
        .featured-study-content {
          position: relative;
          z-index: 1;
        }
        .featured-study-eyebrow-row {
          display: flex;
          justify-content: space-between;
          align-items: baseline;
          margin-bottom: 56px;
          gap: 24px;
        }
        .featured-study-eyebrow {
          font-family: var(--font-sans);
          font-size: 10px;
          letter-spacing: 0.32em;
          text-transform: uppercase;
          color: var(--stone-50);
          display: inline-flex;
          align-items: center;
          gap: 12px;
        }
        .featured-study-eyebrow::before {
          content: '';
          display: inline-block;
          width: 36px;
          height: 1px;
          background: var(--warmth);
        }
        .featured-study-meta-right {
          font-family: var(--font-sans);
          font-size: 10px;
          letter-spacing: 0.28em;
          text-transform: uppercase;
          color: rgba(255, 255, 255, 0.55);
        }
        .featured-study-stamp {
          position: absolute;
          top: 88px;
          left: 56px;
          font-family: var(--font-display);
          font-style: italic;
          font-size: clamp(5rem, 9vw, 8rem);
          line-height: 0.85;
          color: var(--stone-50);
          opacity: 0.18;
          letter-spacing: -0.04em;
          pointer-events: none;
          z-index: 1;
          margin: 0;
        }
        .featured-study-body {
          max-width: 60%;
          margin-left: auto;
          padding-right: 110px;
          min-height: 360px;
          display: flex;
          flex-direction: column;
          justify-content: flex-end;
        }
        .featured-study-cat {
          font-family: var(--font-sans);
          font-size: 11px;
          font-weight: 500;
          letter-spacing: 0.28em;
          text-transform: uppercase;
          color: var(--warmth);
          margin: 0 0 18px;
          display: inline-flex;
          align-items: center;
          gap: 12px;
        }
        .featured-study-cat::after {
          content: '';
          display: inline-block;
          width: 36px;
          height: 1px;
          background: var(--warmth);
          opacity: 0.7;
        }
        .featured-study-title {
          font-family: var(--font-display);
          color: var(--stone-50);
          margin: 0 0 26px;
          line-height: 0.95;
          max-width: 720px;
          display: flex;
          flex-direction: column;
          text-shadow: 0 2px 24px rgba(0, 0, 0, 0.35);
        }
        .featured-study-title .t-caps {
          font-weight: 600;
          font-size: clamp(2.6rem, 4.6vw, 4rem);
          text-transform: uppercase;
          letter-spacing: -0.012em;
          font-feature-settings: "case" on;
          font-variation-settings: "opsz" 144;
        }
        .featured-study-title .t-italic {
          font-style: italic;
          font-weight: 400;
          font-size: clamp(1.6rem, 2.6vw, 2.2rem);
          letter-spacing: -0.005em;
          color: rgba(255, 255, 255, 0.85);
          margin-top: 4px;
        }
        .featured-study-desc {
          font-family: var(--font-body);
          font-style: italic;
          font-size: 1.12rem;
          line-height: 1.55;
          color: rgba(255, 255, 255, 0.82);
          max-width: 580px;
          margin: 0 0 26px;
          text-shadow: 0 1px 12px rgba(0, 0, 0, 0.3);
        }
        .featured-study-meta {
          display: flex;
          flex-wrap: wrap;
          gap: 22px;
          font-family: var(--font-sans);
          font-size: 10px;
          letter-spacing: 0.24em;
          text-transform: uppercase;
          color: rgba(255, 255, 255, 0.6);
          margin: 0;
          padding: 0;
          list-style: none;
        }
        .featured-study-meta li {
          position: relative;
        }
        .featured-study-meta li + li::before {
          content: '·';
          position: absolute;
          left: -14px;
          top: 0;
          opacity: 0.55;
        }
        .featured-study-arrow {
          position: absolute;
          bottom: 56px;
          right: 56px;
          width: 64px;
          height: 64px;
          border-radius: 50%;
          background: transparent;
          border: 1px solid rgba(255, 255, 255, 0.45);
          color: var(--stone-50);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 2;
          pointer-events: none;
          transition: background 0.25s ease, color 0.25s ease, border-color 0.25s ease, transform 0.25s ease;
        }
        .featured-study-block:hover .featured-study-arrow {
          background: var(--stone-50);
          color: var(--stone-900);
          border-color: var(--stone-50);
          transform: translateX(6px);
        }
        @media (max-width: 768px) {
          .featured-study-block {
            padding: 56px 24px 72px;
          }
          .featured-study-stamp {
            top: 56px;
            left: 24px;
          }
          .featured-study-body {
            max-width: 100%;
            margin-left: 0;
            padding-right: 0;
            min-height: 240px;
          }
          .featured-study-arrow {
            bottom: 24px;
            right: 24px;
            width: 52px;
            height: 52px;
          }
          .featured-study-eyebrow-row {
            margin-bottom: 40px;
          }
        }
      `}</style>

      <Link
        href={`/study/${study.slug}`}
        className="featured-study-block"
        aria-label={`Read featured study: ${study.title}`}
      >
        {/* Background plate */}
        <div className="featured-study-bg" aria-hidden="true">
          {plate ? (
            <Image
              src={plate.url}
              alt={plate.alt}
              fill
              sizes="100vw"
              style={{ objectFit: 'cover' }}
            />
          ) : (
            <div
              style={{
                position: 'absolute',
                inset: 0,
                backgroundImage: fallbackGradient,
              }}
            />
          )}
        </div>

        {/* Layered scrim */}
        <div className="featured-study-scrim" aria-hidden="true" />

        {/* Plate stamp */}
        <span className="featured-study-stamp" aria-hidden="true">
          I.
        </span>

        {/* Content */}
        <div className="featured-study-content">
          <div className="featured-study-eyebrow-row">
            <span className="featured-study-eyebrow">Featured this issue</span>
            <span className="featured-study-meta-right">{metaRight}</span>
          </div>

          <div className="featured-study-body">
            <p className="featured-study-cat">Featured study</p>

            <h2 className="featured-study-title">
              <span className="t-caps">{head}</span>
              {tail ? <span className="t-italic">{tail}</span> : null}
            </h2>

            {summary ? (
              <p className="featured-study-desc">{summary}</p>
            ) : null}

            <ul className="featured-study-meta">
              <li>{translation}</li>
              <li>Koinar Team</li>
            </ul>
          </div>
        </div>

        {/* Arrow */}
        <span className="featured-study-arrow" aria-hidden="true">
          <svg width="22" height="22" viewBox="0 0 16 16" fill="none">
            <path
              d="M3 8 L13 8 M9 4 L13 8 L9 12"
              stroke="currentColor"
              strokeWidth="1.2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </span>
      </Link>
    </>
  );
}
