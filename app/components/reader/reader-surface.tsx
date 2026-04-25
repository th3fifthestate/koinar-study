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

  return (
    <div
      data-reader-surface
      data-mode={mode}
      className="reader-surface relative min-h-screen"
    >
      <div className="reader-content relative">{children}</div>
    </div>
  );
}
