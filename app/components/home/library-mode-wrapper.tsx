'use client';

import type { ReactNode } from 'react';
import { useReaderPrefs } from '@/lib/reader/use-reader-prefs';

interface LibraryModeWrapperProps {
  children: ReactNode;
  className?: string;
}

/**
 * Publishes `data-mode` on a wrapper div so light/dark tokens (e.g.
 * `--bed-threshold`) cascade to the home library section. Pass-through only;
 * mode toggle UI lives in StickyNavbar/Hero and calls `setMode()` directly.
 *
 * Hydration: `useReaderPrefs` initialises with `mode: undefined` and only
 * reads localStorage in `useEffect`, so SSR and first client render both
 * emit `data-mode="light"`. The attribute updates after mount.
 */
export function LibraryModeWrapper({ children, className = 'relative' }: LibraryModeWrapperProps) {
  const { prefs } = useReaderPrefs();
  return (
    <>
      <style>{`
        .koinar-library-mode-wrapper,
        .koinar-library-mode-wrapper * {
          transition:
            background-color 0.5s ease,
            color 0.4s ease,
            border-color 0.4s ease,
            fill 0.4s ease,
            stroke 0.4s ease;
        }
        @media (prefers-reduced-motion: reduce) {
          .koinar-library-mode-wrapper,
          .koinar-library-mode-wrapper * { transition: none; }
        }
      `}</style>
      <div
        data-mode={prefs.mode ?? 'light'}
        className={`koinar-library-mode-wrapper ${className}`}
      >
        {children}
      </div>
    </>
  );
}
