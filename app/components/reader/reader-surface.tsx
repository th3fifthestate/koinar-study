'use client';

import { useEffect, useState, type CSSProperties } from 'react';
import { bucketForHour, type TodBucket } from '@/lib/home/tod-bucket';
import { getReaderPalette } from '@/lib/reader/reader-tones';

/**
 * Paper grain — fractal-noise SVG baked into a data URI. Same texture
 * vocabulary as the home library band so the surfaces feel related.
 */
// Light-mode grain: dark specks baked into ivory via multiply.
const GRAIN_SVG_LIGHT =
  "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='320' height='320'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='2' stitchTiles='stitch'/><feColorMatrix values='0 0 0 0 0.36  0 0 0 0 0.33  0 0 0 0 0.29  0 0 0 0.55 0'/></filter><rect width='100%25' height='100%25' filter='url(%23n)' opacity='0.45'/></svg>";

// Dark-mode grain: warm highlights baked into walnut via overlay/screen so
// fiber actually surfaces against near-black paper.
const GRAIN_SVG_DARK =
  "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='320' height='320'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='2' stitchTiles='stitch'/><feColorMatrix values='0 0 0 0 0.82  0 0 0 0 0.72  0 0 0 0 0.56  0 0 0 0.65 0'/></filter><rect width='100%25' height='100%25' filter='url(%23n)' opacity='0.55'/></svg>";

interface ReaderSurfaceProps {
  children: React.ReactNode;
}

/**
 * Wraps the reader in a TOD-aware, tonal paper surface with grain and
 * subtle radial washes. Exposes CSS variables (`--reader-*`) that
 * descendants (markdown, TOC, chrome) can consume for ink, rules, and
 * accent colors — giving the reader a cohesive paper voice without
 * hard-coding per-component colors.
 *
 * Hydrates on client to read the current hour + color scheme, then
 * updates CSS vars. Defaults to `evening` + light to avoid SSR flash.
 */
export function ReaderSurface({ children }: ReaderSurfaceProps) {
  const [bucket, setBucket] = useState<TodBucket>('evening');
  const [isDark, setIsDark] = useState(false);

  useEffect(() => {
    setBucket(bucketForHour(new Date().getHours()));
    const syncDark = () => {
      const fromClass = document.documentElement.classList.contains('dark');
      const fromMq = window.matchMedia('(prefers-color-scheme: dark)').matches;
      setIsDark(fromClass || fromMq);
    };
    syncDark();
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    mq.addEventListener('change', syncDark);
    // Observe root class changes for manual dark-mode toggles.
    const observer = new MutationObserver(syncDark);
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['class'],
    });
    return () => {
      mq.removeEventListener('change', syncDark);
      observer.disconnect();
    };
  }, []);

  const p = getReaderPalette(bucket, isDark);

  const surfaceStyle: CSSProperties = {
    '--reader-paper': p.paper,
    '--reader-paper-deep': p.paperDeep,
    '--reader-ink': p.ink,
    '--reader-ink-soft': p.inkSoft,
    '--reader-display': p.display,
    '--reader-rule': p.rule,
    '--reader-accent-warmth': p.accentWarmth,
    '--reader-accent-sage': p.accentSage,
    '--reader-entity': p.entityUnderline,
    backgroundColor: p.paper,
    color: p.ink,
  } as CSSProperties;

  return (
    <div
      data-reader-surface
      data-tod={bucket}
      data-dark={isDark ? 'true' : 'false'}
      className="relative min-h-screen transition-colors duration-[1200ms]"
      style={surfaceStyle}
    >
      {/* Tonal wash layer — warmth glow + sage drift sitting over the
          paper. Uses `fixed` positioning so the washes stay locked to
          the viewport as the reader scrolls, reading like ambient light
          coming through a window rather than a single top-of-page
          vignette. The grain (which IS tied to content) drifts across
          it, preserving the sense of paper movement. Pointer-events
          disabled; sits behind z-10 content. */}
      <div
        aria-hidden="true"
        className="pointer-events-none fixed inset-0"
        style={{
          background: `
            radial-gradient(ellipse 70vw 55vh at 14% 8%, ${p.washWarmth}, transparent 62%),
            radial-gradient(ellipse 65vw 70vh at 92% 22%, ${p.washSage}, transparent 65%),
            radial-gradient(ellipse 60vw 65vh at 30% 75%, ${p.washWarmth}, transparent 70%),
            radial-gradient(ellipse 55vw 60vh at 85% 92%, ${p.washSage}, transparent 70%)
          `,
        }}
      />

      {/* Paper grain — tiled SVG noise. Fixed attachment so it behaves like
          paper fiber regardless of scroll. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0"
        style={{
          backgroundImage: `url("${isDark ? GRAIN_SVG_DARK : GRAIN_SVG_LIGHT}")`,
          backgroundRepeat: 'repeat',
          backgroundSize: '320px 320px',
          opacity: isDark ? 0.38 : 0.55,
          mixBlendMode: isDark ? 'overlay' : 'multiply',
        }}
      />

      <div className="relative z-10">{children}</div>
    </div>
  );
}
