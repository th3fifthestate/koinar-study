'use client';

import { useState, useMemo } from 'react';
import type { StudyDetail, StudyEntityAnnotation } from '@/lib/db/types';
import { useReadingProgress } from '@/lib/hooks/use-reading-progress';
import { useActiveHeading } from '@/lib/hooks/use-active-heading';
import { ReadingProgress } from './reading-progress';
import { StudyHero } from './study-hero';
import { StudyHeader } from './study-header';
import { TableOfContents, MobileTocButton, type HeadingItem } from './table-of-contents';
import { MarkdownRenderer } from './markdown-renderer';

type FontSize = 'small' | 'medium' | 'large';

interface StudyReaderProps {
  study: StudyDetail;
  isFavorited: boolean;
  isLoggedIn: boolean;
  entityAnnotations?: StudyEntityAnnotation[];
}

function extractHeadings(markdown: string): HeadingItem[] {
  const headings: HeadingItem[] = [];
  const slugCounts = new Map<string, number>();
  const pattern = /^(#{2,4})\s+(.+)$/gm;
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(markdown)) !== null) {
    const level = match[1].length;
    const text = match[2].trim();
    const base = text
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '');

    const count = slugCounts.get(base) ?? 0;
    slugCounts.set(base, count + 1);
    const id = count === 0 ? base : `${base}-${count}`;

    headings.push({ id, text, level });
  }

  return headings;
}

export function StudyReader({ study, isFavorited, isLoggedIn, entityAnnotations: _entityAnnotations }: StudyReaderProps) {
  const [fontSize, setFontSize] = useState<FontSize>('medium');
  const [showCommunityAnnotations, setShowCommunityAnnotations] = useState(false);

  // Extract headings from markdown
  const headings = useMemo(() => extractHeadings(study.content_markdown), [study.content_markdown]);
  const headingIds = useMemo(() => headings.map((h) => h.id), [headings]);

  // Hooks
  useReadingProgress(study.slug);
  const activeId = useActiveHeading(headingIds);

  return (
    <>
      <ReadingProgress />

      {study.featured_image_url && (
        <StudyHero imageUrl={study.featured_image_url} title={study.title} />
      )}

      <div className="relative mx-auto max-w-7xl px-4">
        <StudyHeader
          title={study.title}
          summary={study.summary}
          categoryName={study.category_name}
          formatType={study.format_type}
          translationUsed={study.translation_used}
          authorDisplayName={study.author_display_name}
          tags={study.tags}
          favoriteCount={study.favorite_count}
          annotationCount={study.annotation_count}
          createdAt={study.created_at}
          studyId={study.id}
          isFavorited={isFavorited}
          isLoggedIn={isLoggedIn}
          fontSize={fontSize}
          onFontSizeChange={setFontSize}
          showCommunityAnnotations={showCommunityAnnotations}
          onCommunityToggle={setShowCommunityAnnotations}
        />

        <div className="flex gap-8 lg:gap-12">
          {/* Desktop TOC */}
          <aside className="hidden w-64 shrink-0 lg:block">
            <TableOfContents headings={headings} activeId={activeId} />
          </aside>

          {/* Main content */}
          <main className="min-w-0 flex-1">
            <article className="rounded-lg bg-[rgba(247,246,243,0.92)] p-6 backdrop-blur-sm dark:bg-[rgba(58,54,47,0.92)] md:p-10">
              <MarkdownRenderer
                content={study.content_markdown}
                images={study.images}
                fontSize={fontSize}
              />
            </article>
          </main>
        </div>
      </div>

      {/* Mobile TOC */}
      <MobileTocButton headings={headings} activeId={activeId} />
    </>
  );
}
