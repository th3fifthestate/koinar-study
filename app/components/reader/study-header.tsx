'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Share2 } from 'lucide-react';
import { toast } from 'sonner';
import { FavoriteButton } from '@/components/library/favorite-button';
import { EntityToggle } from './entity-toggle';
import { BranchMapIndicator } from './branch-map-indicator';
import { ReaderSettingsPopover } from './reader-settings-popover';
import type { TranslationAvailability } from '@/lib/translations/registry';

type FontSize = 'small' | 'medium' | 'large';

interface StudyHeaderProps {
  studyId: number;
  isFavorited: boolean;
  favoriteCount: number;
  fontSize: FontSize;
  onFontSizeChange: (size: FontSize) => void;
  mode: 'dark' | 'light';
  onModeChange: (m: 'dark' | 'light') => void;
  onResetPrefs: () => void;
  showEntityAnnotations: boolean;
  onEntityAnnotationsToggle: (enabled: boolean) => void;
  entityAnnotationCount: number;
  onOpenMap: () => void;
  translations: TranslationAvailability[];
  currentTranslation: string;
  onTranslationSelect: (id: string) => Promise<void>;
  translating: boolean;
}

/**
 * Inline chrome cluster for the reader. Renders only the action buttons
 * (Save / Share / Branch Map / Context toggle / Reader Settings) — the
 * editorial hero (`StudyHero`) owns the title, summary, byline, and
 * badges. Designed to sit at the bottom of the hero band.
 *
 * Preserves the dissolving-on-idle opacity transition: the reading-controls
 * cluster dims when the reader is idle (no mousemove / scroll / focus for
 * 2.5s) and restores on any movement. Respects prefers-reduced-motion by
 * staying fully visible.
 */
export function StudyHeader({
  studyId,
  isFavorited,
  favoriteCount,
  fontSize,
  onFontSizeChange,
  mode,
  onModeChange,
  onResetPrefs,
  showEntityAnnotations,
  onEntityAnnotationsToggle,
  entityAnnotationCount,
  onOpenMap,
  translations,
  currentTranslation,
  onTranslationSelect,
  translating,
}: StudyHeaderProps) {
  const [idle, setIdle] = useState(false);
  const idleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (prefersReduced) return;

    const wake = () => {
      setIdle(false);
      if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
      idleTimerRef.current = setTimeout(() => setIdle(true), 2500);
    };
    wake();
    const events: Array<keyof WindowEventMap> = ['mousemove', 'scroll', 'keydown', 'touchstart', 'focusin'];
    events.forEach((e) => window.addEventListener(e, wake, { passive: true }));
    return () => {
      if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
      events.forEach((e) => window.removeEventListener(e, wake));
    };
  }, []);

  const handleShare = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      toast.success('Link copied!');
    } catch {
      toast.error('Could not copy link');
    }
  }, []);

  return (
    <div
      className="flex flex-wrap items-center gap-4 transition-opacity duration-[600ms] ease-out hover:!opacity-100 focus-within:!opacity-100"
      style={{ opacity: idle ? 0.32 : 1 }}
      aria-label="Reading controls"
    >
      <FavoriteButton
        studyId={studyId}
        initialFavorited={isFavorited}
        initialCount={favoriteCount}
        isLoggedIn={true}
      />

      <button
        onClick={handleShare}
        className="flex items-center gap-1.5 text-[11px] text-[var(--stone-300)] transition-colors hover:text-[var(--sage-500)]"
        aria-label="Share study"
      >
        <Share2 className="h-3.5 w-3.5" />
        <span>Share</span>
      </button>

      <BranchMapIndicator onOpenMap={onOpenMap} />
      <EntityToggle
        enabled={showEntityAnnotations}
        onToggle={onEntityAnnotationsToggle}
        entityCount={entityAnnotationCount}
      />
      <ReaderSettingsPopover
        fontSize={fontSize}
        onFontSizeChange={onFontSizeChange}
        mode={mode}
        onModeChange={onModeChange}
        onResetPrefs={onResetPrefs}
        translations={translations}
        currentTranslation={currentTranslation}
        onTranslationSelect={onTranslationSelect}
        translating={translating}
      />
    </div>
  );
}
