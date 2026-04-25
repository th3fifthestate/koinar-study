'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { Share2 } from 'lucide-react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { FavoriteButton } from '@/components/library/favorite-button';
import { EntityToggle } from './entity-toggle';
import { BranchMapIndicator } from './branch-map-indicator';
import { ReaderSettingsPopover } from './reader-settings-popover';
import type { TranslationAvailability } from '@/lib/translations/registry';

type FontSize = 'small' | 'medium' | 'large';

interface StudyHeaderProps {
  title: string;
  summary: string | null;
  categoryName: string | null;
  formatType: string;
  translationUsed: string;
  authorDisplayName: string | null;
  tags: string[];
  favoriteCount: number;
  annotationCount: number;
  createdAt: string;
  studyId: number;
  isFavorited: boolean;
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

const FORMAT_LABELS: Record<string, string> = {
  quick: 'Quick',
  standard: 'Standard',
  comprehensive: 'Comprehensive',
};

export function StudyHeader({
  title,
  summary,
  categoryName,
  formatType,
  translationUsed,
  authorDisplayName,
  tags,
  favoriteCount,
  annotationCount,
  createdAt,
  studyId,
  isFavorited,
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
  // Dissolving chrome: reading-controls cluster dims when the reader is idle
  // (no mousemove / scroll / focus for 2.5s) and restores on any movement.
  // Respects prefers-reduced-motion by staying fully visible.
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

  const formattedDate = new Intl.DateTimeFormat('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  }).format(new Date(createdAt));

  // annotationCount is retained in props for future use (e.g., badges)
  void annotationCount;

  return (
    <header className="mb-8 pt-8">
      <Link
        href="/"
        className="inline-block font-body text-sm text-[var(--stone-500)] hover:text-[var(--stone-700)] dark:text-[var(--stone-300)] dark:hover:text-[var(--stone-50)] transition-colors mb-6"
      >
        ← Back to Library
      </Link>
      <h1 className="font-display text-4xl font-normal leading-[1.15] text-[var(--stone-900)] dark:text-[var(--stone-50)] md:text-5xl">
        {title}
      </h1>

      {summary && (
        <p className="mt-3 text-lg leading-relaxed text-[var(--stone-700)] dark:text-[var(--stone-300)]">
          {summary}
        </p>
      )}

      {/* Badges */}
      <div className="mt-4 flex flex-wrap items-center gap-2">
        {categoryName && <Badge variant="secondary">{categoryName}</Badge>}
        <Badge variant="outline">{FORMAT_LABELS[formatType] || formatType}</Badge>
        <Badge variant="outline">{translationUsed}</Badge>
      </div>

      {/* Author + Date */}
      <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-[var(--stone-700)] dark:text-[var(--stone-300)]">
        {authorDisplayName && <span>by {authorDisplayName}</span>}
        <span>{formattedDate}</span>
      </div>

      {/* Tags */}
      {tags.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {tags.map((tag) => (
            <Badge key={tag} variant="secondary" className="text-[10px]">
              {tag}
            </Badge>
          ))}
        </div>
      )}

      {/* Actions */}
      <div
        className="mt-5 flex flex-wrap items-center gap-4 border-b pb-5"
        style={{ borderColor: 'var(--reader-rule, var(--stone-200))' }}
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

        <div
          className="ml-auto flex flex-wrap items-center gap-4 transition-opacity duration-[600ms] ease-out hover:!opacity-100 focus-within:!opacity-100"
          style={{ opacity: idle ? 0.32 : 1 }}
          aria-label="Reading controls"
        >
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
      </div>
    </header>
  );
}
