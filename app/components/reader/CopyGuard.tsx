'use client';

import { useRef, useEffect, type ReactNode } from 'react';
import { toast } from 'sonner';
import { TRANSLATIONS } from '@/lib/translations/registry';
import type { TranslationId } from '@/lib/translations/registry';
import { CITATIONS } from '@/lib/translations/citations';
import { config } from '@/lib/config';

interface CopyGuardProps {
  children: ReactNode;
  currentTranslation: string;
}

const VERSE_REF_RE = /\b\d?\s?[A-Z][a-z]+(?:\s[A-Z][a-z]+)*\s+\d+:\d+/g;
const MAX = config.bible.copy.maxVersesPerCopy;

export function CopyGuard({ children, currentTranslation }: CopyGuardProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const handleCopy = (e: ClipboardEvent) => {
      const translation = currentTranslation as TranslationId;
      const info = TRANSLATIONS[translation];
      if (!info?.isLicensed) return;

      const selection = window.getSelection();
      if (!selection || selection.isCollapsed) return;
      const selectedText = selection.toString();

      const refMatches = [...selectedText.matchAll(VERSE_REF_RE)];
      const count = refMatches.length || selectedText.split('\n').filter(Boolean).length;
      if (count <= MAX) return;

      e.preventDefault();
      const lines = selectedText.split('\n');
      const truncated = lines.slice(0, MAX).join('\n');
      const citation = CITATIONS[translation]?.short ?? '';
      e.clipboardData?.setData('text/plain', `${truncated}\n\n${citation}`);

      const publisherUrl = info.publisherUrl;
      toast.warning(
        `Copied ${MAX} verses (max for ${translation}).${publisherUrl ? ` See full passage at ${publisherUrl}.` : ''}`,
      );
    };

    el.addEventListener('copy', handleCopy);
    return () => el.removeEventListener('copy', handleCopy);
  }, [currentTranslation]);

  return <div ref={containerRef}>{children}</div>;
}
