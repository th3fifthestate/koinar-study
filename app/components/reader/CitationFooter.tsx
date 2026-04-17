'use client';

import { useEffect, useRef } from 'react';
import { CITATIONS } from '@/lib/translations/citations';
import { TRANSLATIONS } from '@/lib/translations/registry';
import type { TranslationId } from '@/lib/translations/registry';
import { recordDisplayEvent } from '@/lib/translations/actions';

interface CitationFooterProps {
  currentTranslation: string;
  studyId: number;
  verseCount?: number;
}

export function CitationFooter({
  currentTranslation,
  studyId,
  verseCount = 0,
}: CitationFooterProps) {
  const translation = currentTranslation as TranslationId;
  const citation = CITATIONS[translation];
  const info = TRANSLATIONS[translation];

  // One display event per (study, translation, count) view. React Strict Mode
  // double-invokes effects in dev and any parent re-render would otherwise
  // re-fire this — we want exactly one FUMS display per distinct view.
  const lastFiredRef = useRef<string | null>(null);

  useEffect(() => {
    if (!info?.isLicensed || !verseCount) return;
    const key = `${studyId}:${translation}:${verseCount}`;
    if (lastFiredRef.current === key) return;
    lastFiredRef.current = key;
    void recordDisplayEvent(translation, studyId, verseCount);
  }, [translation, studyId, verseCount, info?.isLicensed]);

  if (!citation) return null;

  return (
    <footer className="mt-8 border-t border-border/40 pt-4 text-xs text-muted-foreground">
      <p>{citation.short}</p>
      {citation.publisherLink && (
        <a
          href={citation.publisherLink.url}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-1 inline-block underline underline-offset-2 hover:text-foreground transition-colors"
        >
          {citation.publisherLink.label}
        </a>
      )}
    </footer>
  );
}
