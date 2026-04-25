'use client';

import { useState, useMemo, useRef, useCallback } from 'react';
import { useReaderPrefs } from '@/lib/reader/use-reader-prefs';
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
import { CopyGuard } from './CopyGuard';
import { CitationFooter } from './CitationFooter';
import { ReaderSurface } from './reader-surface';
import { VerificationPanel } from './verification-panel';
import type { TranslationAvailability } from '@/lib/translations/registry';
import { SWAP_FAILURE_HINT, type SwapFailureReason } from '@/lib/translations/swap-failure';

type FontSize = 'small' | 'medium' | 'large';

interface StudyReaderProps {
  study: StudyDetail;
  isFavorited: boolean;
  translations: TranslationAvailability[];
  entityAnnotations?: StudyEntityAnnotation[];
  entities?: Entity[];
  heroNeedsScrim?: boolean;
  benchEnabled?: boolean;
  /** When true, renders the admin-only VerificationPanel below the article. */
  isAdmin?: boolean;
}

/**
 * Defensive strip for the `verification-audit` code fence. New studies
 * (post-Phase-1) have this fence removed server-side in
 * `app/api/study/generate/route.ts` onFinish. Old studies generated under
 * the previous prompt may still carry the fence in `content_markdown`;
 * we strip it on render so it never reaches the public reader. The audit
 * data persists through `generation_metadata.queries` for admins.
 */
const VERIFICATION_AUDIT_FENCE = /```verification-audit[\s\S]*?```/g;
function stripVerificationAuditFence(markdown: string): string {
  if (!markdown.includes('```verification-audit')) return markdown;
  return markdown.replace(VERIFICATION_AUDIT_FENCE, '').replace(/\n{3,}/g, '\n\n').trim();
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
  translations,
  entityAnnotations = [],
  entities = [],
  heroNeedsScrim,
  benchEnabled = false,
  isAdmin = false,
}: StudyReaderProps) {
  const { prefs, setFontSize, setAnnotationFullContextHeight, resetPrefs } = useReaderPrefs();
  const fontSize = prefs.fontSize;

  // Strip any stray verification-audit fences from old studies before
  // they hit the renderer. New studies don't carry the fence in markdown.
  const initialContent = useMemo(
    () => stripVerificationAuditFence(study.content_markdown),
    [study.content_markdown],
  );
  const [displayContent, setDisplayContent] = useState(initialContent);
  const [currentTranslation, setCurrentTranslation] = useState(
    study.current_translation ?? 'BSB',
  );
  const [displayVerseCount, setDisplayVerseCount] = useState(() =>
    (study.current_translation ?? 'BSB') === 'BSB'
      ? 0
      : countCitedVerses(study.content_markdown),
  );
  const [translating, setTranslating] = useState(false);

  const handleTranslationSelect = useCallback(async (translation: string): Promise<void> => {
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
        const rawReason = (err as { error?: string }).error;
        const reason: SwapFailureReason = (rawReason && rawReason in SWAP_FAILURE_HINT)
          ? (rawReason as SwapFailureReason)
          : 'network';
        throw reason;
      }
      const data = await res.json() as {
        content: string;
        translation: string;
        truncated: boolean;
        versesSwapped: number;
      };
      // Defensive: even after a translation swap, strip any stray
      // verification-audit fence the swap-engine might preserve from old
      // study content. New studies don't ship with the fence in markdown.
      setDisplayContent(stripVerificationAuditFence(data.content));
      setCurrentTranslation(data.translation);
      setDisplayVerseCount(data.versesSwapped);
      if (data.truncated) {
        toast.info(
          `Showing partial passage in ${data.translation}. Switch back to the Berean Standard Bible for the full passage.`,
        );
      }
    } catch (err) {
      // Re-throw so the popover can set the row state.
      // err is already a SwapFailureReason string or an unknown error.
      throw err;
    } finally {
      setTranslating(false);
    }
  }, [currentTranslation, study.id]);

  const headings = useMemo(() => extractHeadings(initialContent), [initialContent]);
  const headingIds = useMemo(() => headings.map((h) => h.id), [headings]);

  useReadingProgress(study.slug);

  return (
    <EntityLayerProvider annotations={entityAnnotations} entities={entities} benchEnabled={benchEnabled}>
      <StudyReaderContent
        study={study}
        isFavorited={isFavorited}
        translations={translations}
        entityAnnotationCount={entityAnnotations.length}
        fontSize={fontSize}
        setFontSize={setFontSize}
        resetPrefs={resetPrefs}
        annotationFullContextHeight={prefs.annotationFullContextHeight}
        onAnnotationFullContextHeightChange={setAnnotationFullContextHeight}
        headings={headings}
        headingIds={headingIds}
        displayContent={displayContent}
        currentTranslation={currentTranslation}
        displayVerseCount={displayVerseCount}
        translating={translating}
        onTranslationSelect={handleTranslationSelect}
        heroNeedsScrim={heroNeedsScrim}
        benchEnabled={benchEnabled}
        isAdmin={isAdmin}
      />
    </EntityLayerProvider>
  );
}

function StudyReaderContent({
  study,
  isFavorited,
  translations,
  entityAnnotationCount,
  fontSize,
  setFontSize,
  resetPrefs,
  annotationFullContextHeight,
  onAnnotationFullContextHeightChange,
  headings,
  headingIds,
  displayContent,
  currentTranslation,
  displayVerseCount,
  translating,
  onTranslationSelect,
  heroNeedsScrim,
  benchEnabled,
  isAdmin,
}: {
  study: StudyDetail;
  isFavorited: boolean;
  translations: TranslationAvailability[];
  entityAnnotationCount: number;
  fontSize: FontSize;
  setFontSize: (s: FontSize) => void;
  resetPrefs: () => void;
  /** Persisted height for annotation full-context panel (px). */
  annotationFullContextHeight?: number;
  /** Called when the user resizes the annotation full-context panel. */
  onAnnotationFullContextHeightChange?: (px: number) => void;
  headings: HeadingItem[];
  headingIds: string[];
  displayContent: string;
  currentTranslation: string;
  displayVerseCount: number;
  translating: boolean;
  onTranslationSelect: (t: string) => Promise<void>;
  heroNeedsScrim?: boolean;
  benchEnabled: boolean;
  isAdmin: boolean;
}) {
  const { showAnnotations, setShowAnnotations } = useEntityLayer();
  const activeId = useActiveHeading(headingIds);
  const [branchMapOpen, setBranchMapOpen] = useState(false);

  // Annotation system — all readers are authenticated
  const contentRef = useRef<HTMLDivElement>(null);
  const {
    annotations,
    loading: annotationsLoading,
    createAnnotation,
    deleteAnnotation,
  } = useStudyAnnotations({
    studyId: study.id,
    isLoggedIn: true,
    showCommunity: false,
  });

  const { selection, clearSelection } = useTextSelection(contentRef);

  // Track which annotation was clicked (for note expansion). The value
  // is only read by a future note-expansion UI; for now the setter's
  // side effect (re-render on change) is what keeps the handler
  // meaningful. Underscore-prefixed so lint knows it's intentional.
  const [_clickedAnnotation, setClickedAnnotation] = useState<AnnotationPayload | null>(null);

  const handleAnnotationClick = useCallback((annotation: AnnotationPayload) => {
    setClickedAnnotation((prev) => prev?.id === annotation.id ? null : annotation);
  }, []);

  // Apply highlights to the DOM when annotations change
  useHighlightLayer(contentRef, annotations, annotationsLoading, handleAnnotationClick);

  return (
    <ReaderSurface>
      <ReadingProgress />

      {study.featured_image_url && (
        <StudyHero
          imageUrl={study.featured_image_url}
          title={study.title}
          heroNeedsScrim={heroNeedsScrim}
        />
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
          fontSize={fontSize}
          onFontSizeChange={setFontSize}
          onResetPrefs={resetPrefs}
          showEntityAnnotations={showAnnotations}
          onEntityAnnotationsToggle={setShowAnnotations}
          entityAnnotationCount={entityAnnotationCount}
          onOpenMap={() => setBranchMapOpen(true)}
          translations={translations}
          currentTranslation={currentTranslation}
          onTranslationSelect={onTranslationSelect}
          translating={translating}
        />

        <div className="flex gap-8 lg:gap-20 xl:gap-28">
          {/* Desktop TOC — sits out in the left gutter, away from the
              reading column so labels don't crowd the text. Dot-spine
              doesn't need a full text column; labels truncate. */}
          <aside className="hidden w-44 shrink-0 lg:block">
            <TableOfContents headings={headings} activeId={activeId} />
          </aside>

          {/* Main content — text sits directly on the paper surface. The
              column flex-1's to fill the remaining width inside the
              outer max-w-6xl frame, yielding a generous reading measure
              without a dead right band. A soft upper cap prevents
              pathological line lengths on extra-wide displays. */}
          <main className="relative min-w-0 flex-1">
            <article className="relative max-w-[95ch] py-4 md:py-6">
              <CopyGuard
                currentTranslation={currentTranslation}
                surface={{ kind: 'reader', studyId: String(study.id) }}
              >
                <div ref={contentRef}>
                  <MarkdownRenderer
                    content={displayContent}
                    images={study.images}
                    fontSize={fontSize}
                  />
                </div>
              </CopyGuard>

              {/* Margin notes for annotations with type 'note' */}
              <AnnotationNotes
                annotations={annotations}
                contentRef={contentRef}
                onDelete={deleteAnnotation}
              />

              <CitationFooter
                currentTranslation={currentTranslation}
                studyId={study.id}
                verseCount={displayVerseCount}
              />

              {/* Admin-only verification audit panel — renders the SQL/tool
                  queries the LLM emitted at generation time. Public readers
                  never see this; the panel checks isAdmin before rendering
                  and the underlying data lives in generation_metadata.queries
                  (not in the rendered markdown). */}
              {isAdmin && (
                <VerificationPanel generationMetadata={study.generation_metadata} />
              )}
            </article>

            {/* Annotation popover on text selection.
                Key forces instant remount on new selection (kill-and-restart
                interruption behaviour — no cross-fade with exiting popover). */}
            {selection && (
              <AnnotationPopover
                key={`${selection.startOffset}-${selection.endOffset}`}
                selection={selection}
                onHighlight={(color: HighlightColor, isPublic: boolean) => {
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
                onNote={(color: HighlightColor, noteText: string, isPublic: boolean) => {
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
                onClipToBench={benchEnabled ? async () => {
                  const headingSlug = activeId ?? 'introduction'
                  const payload = {
                    type: 'study-section',
                    source_ref: { type: 'study-section', study_id: study.id, section_heading: headingSlug },
                  }
                  try {
                    await fetch('/api/bench/recent-clips', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({
                        payload: JSON.stringify(payload),
                        clipped_from_route: window.location.pathname,
                      }),
                    })
                    toast.success('Section clipped to Bench', {
                      action: { label: 'View', onClick: () => window.open('/bench', '_blank') },
                    })
                  } catch {
                    toast.error('Failed to clip to Bench')
                  }
                } : undefined}
                annotationFullContextHeight={annotationFullContextHeight}
                onAnnotationFullContextHeightChange={onAnnotationFullContextHeightChange}
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
    </ReaderSurface>
  );
}
