'use client';

import { type ReactNode } from 'react';
import { useReaderPrefs } from '@/lib/reader/use-reader-prefs';

interface ReaderSurfaceProps {
  children: ReactNode;
}

/**
 * Applies the reader's data-mode attribute (light|dark) to a wrapping div.
 * Bed-color CSS variables and accent variables live in globals.css under
 * [data-mode="light"] / [data-mode="dark"] selectors.
 *
 * Default to light on first paint to avoid SSR flash; persisted choice
 * comes through after hydration via useReaderPrefs.
 */
export function ReaderSurface({ children }: ReaderSurfaceProps) {
  const { prefs } = useReaderPrefs();
  const mode = prefs.mode ?? 'light';

  // We mirror data-mode="dark" onto a `dark` className so Tailwind's
  // dark: variants (e.g., dark:text-[var(--stone-100)]) fire inside the
  // reader subtree without forcing the rest of the app into dark mode
  // via the global <html class="dark">.
  return (
    <div
      data-reader-surface
      data-mode={mode}
      className={`reader-surface relative min-h-screen koinar-reader-enter ${mode === 'dark' ? 'dark' : ''}`}
    >
      <style>{`
        @keyframes koinar-reader-enter {
          0%   { opacity: 0; transform: translateY(14px); }
          100% { opacity: 1; transform: translateY(0); }
        }
        .koinar-reader-enter {
          animation: koinar-reader-enter 0.6s cubic-bezier(0.22, 0.61, 0.36, 1) both;
        }
        @media (prefers-reduced-motion: reduce) {
          .koinar-reader-enter { animation: none; }
        }
      `}</style>
      <div className="reader-content relative">{children}</div>
    </div>
  );
}
