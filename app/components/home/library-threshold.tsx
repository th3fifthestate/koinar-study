'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Search } from 'lucide-react';
import { useDebounce } from '@/lib/hooks/use-debounce';

/**
 * LibraryThreshold — Stage 4 of the Library Redesign.
 *
 * Patterned bed with eyebrow + italic/caps lockup, sage hairline, italic caption,
 * underlined search input, and a row of filter pills (All / Quick / Standard / Deep
 * / Favorites). Replaces the old standalone `LibraryThreshold` opener AND the
 * `RefineBand` band — URL-state machinery (q, format_type, favorites) lives here now.
 *
 * Security: reads URL params via `useSearchParams` for filter state. Those params
 * are independently validated server-side in `app/page.tsx` before reaching
 * `getStudies`, so this client component does not introduce a new trust boundary.
 *
 * Pattern overlay: see `.library-threshold-pattern` in globals.css. Two SVG-as-data-URI
 * variants are gated by the wrapping `[data-mode]` (sage-700 light / warmth dark).
 */
export function LibraryThreshold() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [searchValue, setSearchValue] = useState(searchParams.get('q') ?? '');
  const debouncedSearch = useDebounce(searchValue, 300);

  const currentFormat = searchParams.get('format_type') ?? '';
  const favoritesActive = searchParams.get('favorites') === 'true';

  // Push a single param update without scroll jump; clears `page` so pagination
  // resets when filters change.
  const pushParam = useCallback(
    (key: string, value: string) => {
      const params = new URLSearchParams(searchParams.toString());
      if (value) {
        params.set(key, value);
      } else {
        params.delete(key);
      }
      params.delete('page');
      router.replace(`/?${params.toString()}`, { scroll: false });
    },
    [router, searchParams]
  );

  // Sync debounced search to URL.
  useEffect(() => {
    const currentQ = searchParams.get('q') ?? '';
    if (debouncedSearch !== currentQ) {
      pushParam('q', debouncedSearch);
    }
  }, [debouncedSearch, pushParam, searchParams]);

  const setFormat = (value: string) => {
    // "All" sends an empty value, which deletes format_type — its natural reset.
    pushParam('format_type', value);
  };

  const toggleFavorites = () => {
    pushParam('favorites', favoritesActive ? '' : 'true');
  };

  const formatPills: Array<{ label: string; value: string }> = [
    { label: 'All', value: '' },
    { label: 'Quick', value: 'quick' },
    { label: 'Standard', value: 'standard' },
    { label: 'Deep', value: 'comprehensive' },
  ];

  return (
    <section
      className="koinar-threshold"
      style={{
        backgroundColor: 'var(--bed-threshold)',
        padding: '80px 56px 64px',
        position: 'relative',
        isolation: 'isolate',
        borderTop: '1px solid var(--text-rule)',
        borderBottom: '1px solid var(--text-rule)',
        display: 'grid',
        gridTemplateColumns: '1fr 1.45fr',
        gap: '64px',
        alignItems: 'center',
      }}
    >
      <style>{`
        @media (max-width: 768px) {
          .koinar-threshold {
            padding: 56px 24px 40px !important;
            grid-template-columns: 1fr !important;
            gap: 0 !important;
          }
        }
      `}</style>
      {/* Tiled olive-sprig pattern overlay (mode-aware via globals.css) */}
      <div className="library-threshold-pattern" aria-hidden="true" />

      {/* Left column — content */}
      <div style={{ position: 'relative', zIndex: 1, paddingTop: '8px' }}>
        {/* Eyebrow with flanking warmth hairlines */}
        <div
          style={{
            fontFamily: 'var(--font-display)',
            fontStyle: 'italic',
            fontWeight: 400,
            fontSize: '1rem',
            letterSpacing: '0.04em',
            color: 'var(--text-secondary)',
            marginBottom: '18px',
            display: 'flex',
            alignItems: 'center',
            gap: '14px',
          }}
        >
          <span
            aria-hidden="true"
            style={{
              flex: '0 0 28px',
              height: '1px',
              background: 'var(--warmth)',
              opacity: 0.55,
            }}
          />
          <span>A room of readings</span>
          <span
            aria-hidden="true"
            style={{
              flex: 1,
              height: '1px',
              background: 'var(--warmth)',
              opacity: 0.55,
            }}
          />
        </div>

        {/* Heading lockup */}
        <h2
          style={{
            fontFamily: 'var(--font-display)',
            lineHeight: 0.96,
            color: 'var(--text-primary)',
            margin: '0 0 14px',
          }}
        >
          <span
            style={{
              display: 'block',
              fontStyle: 'italic',
              fontWeight: 400,
              fontSize: 'clamp(2rem, 3.5vw, 2.8rem)',
              marginBottom: '-6px',
              fontVariationSettings: '"opsz" 144',
            }}
          >
            The
          </span>
          <span
            style={{
              display: 'block',
              fontWeight: 600,
              fontSize: 'clamp(3.4rem, 6vw, 5.6rem)',
              textTransform: 'uppercase',
              letterSpacing: '-0.012em',
              fontFeatureSettings: '"case" on',
              fontVariationSettings: '"opsz" 144',
            }}
          >
            Library
          </span>
        </h2>

        {/* Sage hairline (flips to warmth in dark via --reader-accent) */}
        <div
          aria-hidden="true"
          style={{
            width: '56px',
            height: '1px',
            background: 'var(--reader-accent)',
            opacity: 0.65,
            margin: '18px 0 22px',
          }}
        />

        {/* Caption */}
        <p
          style={{
            fontFamily: 'var(--font-body)',
            fontStyle: 'italic',
            fontSize: '1.05rem',
            lineHeight: 1.6,
            color: 'var(--text-secondary)',
            maxWidth: '380px',
            margin: '0 0 26px',
          }}
        >
          Quiet hours, ancient texts, modern questions. Pick one and begin.
        </p>

        {/* Search */}
        <label
          htmlFor="library-threshold-search"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            borderBottom: '1px solid var(--text-rule)',
            padding: '10px 0',
            marginBottom: '22px',
            maxWidth: '380px',
            transition: 'border-color 0.2s ease',
          }}
          className="threshold-search-label"
        >
          <Search
            aria-hidden="true"
            style={{
              width: '14px',
              height: '14px',
              color: 'var(--text-secondary)',
              flex: '0 0 14px',
            }}
          />
          <input
            id="library-threshold-search"
            type="search"
            value={searchValue}
            onChange={(e) => setSearchValue(e.target.value)}
            placeholder="Search the library"
            aria-label="Search the library"
            style={{
              flex: 1,
              background: 'transparent',
              border: 'none',
              outline: 'none',
              fontFamily: 'var(--font-body)',
              fontStyle: 'italic',
              fontSize: '0.95rem',
              color: 'var(--text-secondary)',
              padding: 0,
              minWidth: 0,
            }}
          />
        </label>

        {/* Filter pills */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
          {formatPills.map((pill) => {
            const active = currentFormat === pill.value;
            return (
              <button
                key={pill.label}
                type="button"
                onClick={() => setFormat(pill.value)}
                aria-pressed={active}
                className="library-threshold-pill"
                data-active={active ? 'true' : 'false'}
                style={pillStyle(active)}
              >
                {pill.label}
              </button>
            );
          })}
          <button
            type="button"
            onClick={toggleFavorites}
            aria-pressed={favoritesActive}
            className="library-threshold-pill"
            data-active={favoritesActive ? 'true' : 'false'}
            style={pillStyle(favoritesActive)}
          >
            Favorites
          </button>
        </div>
      </div>

      {/* Right column — intentional negative space; pattern carries it. */}
      <div style={{ minHeight: '1px' }} aria-hidden="true" />
    </section>
  );
}

function pillStyle(active: boolean): React.CSSProperties {
  return {
    fontFamily: 'var(--font-sans)',
    fontSize: '10px',
    letterSpacing: '0.22em',
    textTransform: 'uppercase',
    color: active ? 'var(--stone-50)' : 'var(--stone-700)',
    background: active ? 'var(--stone-900)' : 'transparent',
    border: `1px solid ${active ? 'var(--stone-900)' : 'var(--text-rule)'}`,
    padding: '8px 14px',
    borderRadius: '99px',
    cursor: 'pointer',
    transition: 'all 0.2s ease',
  };
}
