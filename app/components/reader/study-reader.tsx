'use client';

import { useState, useMemo, useRef, useCallback, useEffect } from 'react';
import type { StudyDetail, StudyEntityAnnotation, Entity } from '@/lib/db/types';
import type { AnnotationPayload } from '@/lib/ws/types';
import type { HighlightColor } from './highlight-layer';
import { useReadingProgress } from '@/lib/hooks/use-reading-progress';
import { useActiveHeading } from '@/lib/hooks/use-active-heading';
import { useStudyAnnotations } from '@/lib/hooks/use-study-annotations';
import { useTextSelection } from '@/lib/hooks/use-text-selection';
import { useHighlightLayer } from './highlight-layer';
import { ReadingProgress } from './reading-progress';
import { StudyHero } from './study-hero';
import { StudyHeader } from './study-header';
import { TableOfContents, MobileTocButton, type HeadingItem } from './table-of-contents';
import { MarkdownRenderer } from './markdown-renderer';
import { AnnotationPopover } from './annotation-popover';
import { AnnotationNotes } from './annotation-notes';
import { EntityLayerProvider, useEntityLayer } from './entity-layer-context';
import { EntityDrawer } from './entity-drawer';
import { BranchMapOverlay } from './branch-map-overlay';
import { toast } from 'sonner';
import { TranslationSelector } from './TranslationSelector';
import { CopyGuard } from './CopyGuard';
import { CitationFooter } from './CitationFooter';

type FontSize = 'small' | 'medium' | 'large';

interface StudyReaderProps {
  study: StudyDetail;
  isFavorited: boolean;
  isLoggedIn: boolean;
  entityAnnotations?: StudyEntityAnnotation[];
  entities?: Entity[];
}

// Count individual verses referenced in blockquote citation lines. Used to
// seed the FUMS display count on first render when the stored study is
// already in a licensed translation (e.g. NIV from a prior session).
// Matches the trailing `— Book C:V[–V] (TRANS)` markers emitted by swap-engine.
const VERSE_CITATION_RE = /— [^\n]*?\s\d+:(\d+)(?:–(\d+))?\s\([A-Z]+\)/g;
function countCitedVerses(markdown: string): number {
  let total = 0;
  for (const m of markdown.matchAll(VERSE_CITATION_RE)) {
    const start = parseInt(m[1], 10);
    const end = m[2] ? parseInt(m[2], 10) : start;
    if (Number.isFinite(start) && Number.isFinite(end) && end >= start) {
      total += end - start + 1;
    }
  }
  return total;
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

export function StudyReader({
  study,
  isFavorited,
  isLoggedIn,
  entityAnnotations = [],
  entities = [],
}: StudyReaderProps) {
  const [fontSize, setFontSizeState] = useState<FontSize>('medium');
  const [showCommunityAnnotations, setShowCommunityAnnotations] = useState(false);

  // Persist font-size preference across sessions. Read once on mount (avoids
  // SSR mismatch) and write on every change.
  useEffect(() => {
    try {
      const saved = localStorage.getItem('koinar:reader:fontSize');
      if (saved === 'small' || saved === 'medium' || saved === 'large') {
        setFontSizeState(saved);
      }
    } catch {
      // localStorage may be unavailable (private mode / SSR) — use default.
    }
  }, []);

  const setFontSize = useCallback((size: FontSize) => {
    setFontSizeState(size);
    try {
      localStorage.setItem('koinar:reader:fontSize', size);
    } catch {
      // ignore
    }
  }, []);

  const [displayContent, setDisplayContent] = useState(study.content_markdown);
  const [currentTranslation, setCurrentTranslation] = useState(
    study.current_translation ?? 'BSB',
  );
  const [displayVerseCount, setDisplayVerseCount] = useState(() =>
    (study.current_translation ?? 'BSB') === 'BSB'
      ? 0
      : countCitedVerses(study.content_markdown),
  );
  const [translating, setTranslating] = useState(false);

  const handleTranslationSelect = async (translation: string) => {
    if (translation === currentTranslation) return;
    setTranslating(true);
    try {
      const res = await fetch(`/api/studies/${study.id}/translate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ translation }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({})) as { error?: string };
        throw new Error(err.error ?? 'Translation failed');
      }
      const data = await res.json() as {
        content: string;
        translation: string;
        truncated: boolean;
        versesSwapped: number;
      };
      setDisplayContent(data.content);
      setCurrentTranslation(data.translation);
      setDisplayVerseCount(data.versesSwapped);
      if (data.truncated) {
        toast.info(
          `Showing partial passage in ${data.translation}. Switch back to the Berean Standard Bible for the full passage.`,
        );
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not load translation');
    } finally {
      setTranslating(false);
    }
  };

  const headings = useMemo(() => extractHeadings(study.content_markdown), [study.content_markdown]);
  const headingIds = useMemo(() => headings.map((h) => h.id), [headings]);

  useReadingProgress(study.slug);

  return (
    <EntityLayerProvider annotations={entityAnnotations} entities={entities}>
      <StudyReaderContent
        study={study}
        isFavorited={isFavorited}
        isLoggedIn={isLoggedIn}
        entityAnnotationCount={entityAnnotations.length}
        fontSize={fontSize}
        setFontSize={setFontSize}
        showCommunityAnnotations={showCommunityAnnotations}
        setShowCommunityAnnotations={setShowCommunityAnnotations}
        headings={headings}
        headingIds={headingIds}
        displayContent={displayContent}
        currentTranslation={currentTranslation}
        displayVerseCount={displayVerseCount}
        translating={translating}
        onTranslationSelect={handleTranslationSelect}
      />
    </EntityLayerProvider>
  );
}

function StudyReaderContent({
  study,
  isFavorited,
  isLoggedIn,
  entityAnnotationCount,
  fontSize,
  setFontSize,
  showCommunityAnnotations,
  setShowCommunityAnnotations,
  headings,
  headingIds,
  displayContent,
  currentTranslation,
  displayVerseCount,
  translating,
  onTranslationSelect,
}: {
  study: StudyDetail;
  isFavorited: boolean;
  isLoggedIn: boolean;
  entityAnnotationCount: number;
  fontSize: FontSize;
  setFontSize: (s: FontSize) => void;
  showCommunityAnnotations: boolean;
  setShowCommunityAnnotations: (v: boolean) => void;
  headings: HeadingItem[];
  headingIds: string[];
  displayContent: string;
  currentTranslation: string;
  displayVerseCount: number;
  translating: boolean;
  onTranslationSelect: (t: string) => void;
}) {
  const { showAnnotations, setShowAnnotations } = useEntityLayer();
  const activeId = useActiveHeading(headingIds);
  const [branchMapOpen, setBranchMapOpen] = useState(false);

  // Annotation system
  const contentRef = useRef<HTMLDivElement>(null);
  const {
    annotations,
    loading: annotationsLoading,
    activeReaders,
    createAnnotation,
    deleteAnnotation,
  } = useStudyAnnotations({
    studyId: study.id,
    isLoggedIn,
    showCommunity: showCommunityAnnotations,
  });

  const { selection, clearSelection } = useTextSelection(contentRef);

  // Track which annotation was clicked (for note expansion)
  const [clickedAnnotation, setClickedAnnotation] = useState<AnnotationPayload | null>(null);

  const handleAnnotationClick = useCallback((annotation: AnnotationPayload) => {
    setClickedAnnotation((prev) => prev?.id === annotation.id ? null : annotation);
  }, []);

  // Apply highlights to the DOM when annotations change
  useHighlightLayer(contentRef, annotations, annotationsLoading, handleAnnotationClick);

  // Community annotation count (public annotations from others)
  const communityCount = annotations.filter((a) => !a.is_own && a.is_public).length;

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
          communityAnnotationCount={communityCount}
          activeReaders={activeReaders}
          showEntityAnnotations={showAnnotations}
          onEntityAnnotationsToggle={setShowAnnotations}
          entityAnnotationCount={entityAnnotationCount}
          onOpenMap={() => setBranchMapOpen(true)}
          translationSelector={
            isLoggedIn ? (
              <TranslationSelector
                currentTranslation={currentTranslation}
                onSelect={onTranslationSelect}
                disabled={translating}
              />
            ) : undefined
          }
        />

        <div className="flex gap-8 lg:gap-12">
          {/* Desktop TOC */}
          <aside className="hidden w-64 shrink-0 lg:block">
            <TableOfContents headings={headings} activeId={activeId} />
          </aside>

          {/* Main content */}
          <main className="relative min-w-0 flex-1">
            <article className="relative rounded-lg bg-[rgba(247,246,243,0.92)] p-6 backdrop-blur-sm dark:bg-[rgba(58,54,47,0.92)] md:p-10">
              <CopyGuard currentTranslation={currentTranslation}>
                <div ref={contentRef}>
                  <MarkdownRenderer
                    content={displayContent}
                    images={study.images}
                    fontSize={fontSize}
                  />
                </div>
              </CopyGuard>

              {/* Margin notes for annotations with type 'note' */}
              {isLoggedIn && (
                <AnnotationNotes
                  annotations={annotations}
                  contentRef={contentRef}
                  onDelete={deleteAnnotation}
                />
              )}

              <CitationFooter
                currentTranslation={currentTranslation}
                studyId={study.id}
                verseCount={displayVerseCount}
              />
            </article>

            {/* Annotation popover on text selection */}
            {isLoggedIn && selection && (
              <AnnotationPopover
                selection={selection}
                onHighlight={(color, isPublic) => {
                  createAnnotation({
                    type: 'highlight',
                    color,
                    start_offset: selection.startOffset,
                    end_offset: selection.endOffset,
                    selected_text: selection.text,
                    is_public: isPublic,
                  });
                  clearSelection();
                }}
                onNote={(color, noteText, isPublic) => {
                  createAnnotation({
                    type: 'note',
                    color,
                    start_offset: selection.startOffset,
                    end_offset: selection.endOffset,
                    selected_text: selection.text,
                    note_text: noteText,
                    is_public: isPublic,
                  });
                  clearSelection();
                }}
                onClose={clearSelection}
              />
            )}
          </main>
        </div>
      </div>

      {/* Mobile TOC */}
      <MobileTocButton headings={headings} activeId={activeId} />

      {/* Entity Context Drawer */}
      <EntityDrawer studyTitle={study.title} />

      {/* Branch Map Overlay */}
      <BranchMapOverlay
        open={branchMapOpen}
        onClose={() => setBranchMapOpen(false)}
        studyTitle={study.title}
      />
    </>
  );
}
