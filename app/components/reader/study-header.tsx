'use client';

import { useCallback } from 'react';
import { Share2 } from 'lucide-react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { FavoriteButton } from '@/components/library/favorite-button';
import { FontControls } from './font-controls';
import { CommunityToggle } from './community-toggle';
import { EntityToggle } from './entity-toggle';
import { BranchMapIndicator } from './branch-map-indicator';

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
  isLoggedIn: boolean;
  fontSize: FontSize;
  onFontSizeChange: (size: FontSize) => void;
  showCommunityAnnotations: boolean;
  onCommunityToggle: (enabled: boolean) => void;
  communityAnnotationCount?: number;
  activeReaders?: number;
  showEntityAnnotations: boolean;
  onEntityAnnotationsToggle: (enabled: boolean) => void;
  entityAnnotationCount: number;
  onOpenMap: () => void;
}

const FORMAT_LABELS: Record<string, string> = {
  simple: 'Simple',
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
  isLoggedIn,
  fontSize,
  onFontSizeChange,
  showCommunityAnnotations,
  onCommunityToggle,
  communityAnnotationCount,
  activeReaders,
  showEntityAnnotations,
  onEntityAnnotationsToggle,
  entityAnnotationCount,
  onOpenMap,
}: StudyHeaderProps) {
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

  return (
    <header className="mb-8 pt-8">
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
      <div className="mt-5 flex flex-wrap items-center gap-4 border-b border-[var(--stone-200)] pb-5 dark:border-[var(--stone-700)]">
        <FavoriteButton
          studyId={studyId}
          initialFavorited={isFavorited}
          initialCount={favoriteCount}
          isLoggedIn={isLoggedIn}
        />

        <button
          onClick={handleShare}
          className="flex items-center gap-1.5 text-[11px] text-[var(--stone-300)] transition-colors hover:text-[var(--sage-500)]"
          aria-label="Share study"
        >
          <Share2 className="h-3.5 w-3.5" />
          <span>Share</span>
        </button>

        <div className="ml-auto flex items-center gap-4">
          <BranchMapIndicator onOpenMap={onOpenMap} />
          <EntityToggle
            enabled={showEntityAnnotations}
            onToggle={onEntityAnnotationsToggle}
            entityCount={entityAnnotationCount}
          />
          <FontControls fontSize={fontSize} onFontSizeChange={onFontSizeChange} />
          <CommunityToggle
            enabled={showCommunityAnnotations}
            onToggle={onCommunityToggle}
            annotationCount={communityAnnotationCount ?? annotationCount}
            activeReaders={activeReaders}
          />
        </div>
      </div>
    </header>
  );
}
