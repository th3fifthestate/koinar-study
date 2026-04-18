import { useEffect, useRef } from 'react';
import { toast } from 'sonner';
import { TRANSLATIONS } from '@/lib/translations/registry';
import type { TranslationId } from '@/lib/translations/registry';
import { CITATIONS } from '@/lib/translations/citations';
import { config } from '@/lib/config';
import type { DisplaySurface } from '@/lib/bench/types';

const VERSE_REF_RE = /\b\d?\s?[A-Z][a-z]+(?:\s[A-Z][a-z]+)*\s+\d+:\d+/g;
const MAX = config.bible.copy.maxVersesPerCopy;

interface UseCopyCapOptions {
  surface: DisplaySurface;
  currentTranslation: string;
}

export function useCopyCap({ surface: _surface, currentTranslation }: UseCopyCapOptions) {
  const containerRef = useRef<HTMLDivElement>(null);
  const translationId = currentTranslation as TranslationId;

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

      // Only enforce the cap when the selection actually contains verse
      // references. A selection of prose *within* a single verse (no inline
      // ref) is almost always a sub-verse excerpt — line-counting that would
      // penalize normal copy-paste of commentary text. When refs are present
      // we can count them reliably; without refs, trust the user.
      const refMatches = [...selectedText.matchAll(VERSE_REF_RE)];
      if (refMatches.length === 0) return;
      if (refMatches.length <= MAX) return;

      e.preventDefault();
      // Preserve whole blockquote verses when truncating. Each blockquote
      // line in the rendered markdown is one verse, so keeping the first MAX
      // non-empty lines yields MAX verses of scripture.
      const lines = selectedText.split('\n').filter((l) => l.trim().length > 0);
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

  return { containerRef };
}
