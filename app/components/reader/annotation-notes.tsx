'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { X } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import type { AnnotationPayload } from '@/lib/ws/types';
import { HIGHLIGHT_COLORS } from './highlight-layer';

interface AnnotationNotesProps {
  annotations: AnnotationPayload[];
  contentRef: React.RefObject<HTMLElement | null>;
  onDelete: (annotationId: number) => void;
}

interface NotePosition {
  annotation: AnnotationPayload;
  top: number;
}

/**
 * Margin notes for annotations with type === 'note'.
 * Renders colored dots in the right margin; clicking opens the note card.
 * On mobile, renders inline expandable sections instead.
 */
export function AnnotationNotes({ annotations, contentRef, onDelete }: AnnotationNotesProps) {
  const [positions, setPositions] = useState<NotePosition[]>([]);
  const [expandedId, setExpandedId] = useState<number | null>(null);

  const noteAnnotations = useMemo(
    () => annotations.filter((a) => a.type === 'note'),
    [annotations],
  );

  // Calculate vertical positions of notes based on their mark elements in the DOM
  const updatePositions = useCallback(() => {
    const container = contentRef.current;
    if (!container) return;

    const containerRect = container.getBoundingClientRect();
    const newPositions: NotePosition[] = [];

    noteAnnotations.forEach((annotation) => {
      const mark = container.querySelector(`mark[data-annotation-id="${annotation.id}"]`);
      if (mark) {
        const markRect = mark.getBoundingClientRect();
        newPositions.push({
          annotation,
          top: markRect.top - containerRect.top + markRect.height / 2,
        });
      }
    });

    setPositions((prev) => {
      if (
        prev.length === newPositions.length &&
        prev.every(
          (p, i) =>
            p.annotation.id === newPositions[i].annotation.id && p.top === newPositions[i].top,
        )
      ) {
        return prev;
      }
      return newPositions;
    });
  }, [noteAnnotations, contentRef]);

  useEffect(() => {
    updatePositions();
    // Recompute on scroll/resize — positions are viewport-relative
    window.addEventListener('resize', updatePositions);
    window.addEventListener('scroll', updatePositions, { passive: true });
    return () => {
      window.removeEventListener('resize', updatePositions);
      window.removeEventListener('scroll', updatePositions);
    };
  }, [updatePositions]);

  if (positions.length === 0) return null;

  return (
    <>
      {/* Desktop: margin dots + expandable cards */}
      <div className="absolute -right-10 top-0 hidden w-8 lg:block" aria-label="Note indicators">
        {positions.map(({ annotation, top }) => {
          const colorCfg = HIGHLIGHT_COLORS[annotation.color] || HIGHLIGHT_COLORS.yellow;
          const isExpanded = expandedId === annotation.id;

          return (
            <div key={annotation.id} className="absolute right-0" style={{ top }}>
              <button
                onClick={() => setExpandedId(isExpanded ? null : annotation.id)}
                className={`h-3 w-3 rounded-full ${colorCfg.dot} ring-2 ring-background transition-transform hover:scale-125`}
                title={`Note by ${annotation.username}`}
                aria-expanded={isExpanded}
              />

              <AnimatePresence>
                {isExpanded && (
                  <motion.div
                    initial={{ opacity: 0, x: -8, scale: 0.95 }}
                    animate={{ opacity: 1, x: 0, scale: 1 }}
                    exit={{ opacity: 0, x: -8, scale: 0.95 }}
                    transition={{ duration: 0.15 }}
                    className="absolute right-6 top-1/2 -translate-y-1/2 w-56 rounded-lg bg-popover p-3 shadow-lg ring-1 ring-foreground/10 z-40"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-[11px] font-medium text-muted-foreground truncate">
                          {annotation.username}
                        </p>
                        <p className="mt-1 text-sm leading-relaxed text-foreground">
                          {annotation.note_text}
                        </p>
                        <p className="mt-1.5 text-[10px] text-muted-foreground/60">
                          {formatTimestamp(annotation.created_at)}
                        </p>
                      </div>
                      {annotation.is_own && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onDelete(annotation.id);
                            setExpandedId(null);
                          }}
                          className="shrink-0 rounded p-0.5 text-muted-foreground/50 transition-colors hover:bg-destructive/10 hover:text-destructive"
                          title="Delete note"
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          );
        })}
      </div>

      {/* Mobile: inline expandable notes below highlighted text */}
      <div className="mt-4 space-y-2 lg:hidden">
        {noteAnnotations.map((annotation) => {
          const colorCfg = HIGHLIGHT_COLORS[annotation.color] || HIGHLIGHT_COLORS.yellow;
          const isExpanded = expandedId === annotation.id;

          return (
            <div key={annotation.id}>
              <button
                onClick={() => setExpandedId(isExpanded ? null : annotation.id)}
                className="flex items-center gap-2 text-xs text-muted-foreground"
              >
                <span className={`inline-block h-2.5 w-2.5 rounded-full ${colorCfg.dot}`} />
                <span className="truncate max-w-[200px]">
                  {annotation.username}: &ldquo;{annotation.note_text?.slice(0, 40)}
                  {(annotation.note_text?.length ?? 0) > 40 ? '...' : ''}&rdquo;
                </span>
              </button>

              <AnimatePresence>
                {isExpanded && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.15 }}
                    className="overflow-hidden"
                  >
                    <div className="mt-1.5 rounded-md bg-muted/50 p-3">
                      <p className="text-sm leading-relaxed">{annotation.note_text}</p>
                      <div className="mt-2 flex items-center justify-between">
                        <p className="text-[10px] text-muted-foreground/60">
                          {annotation.username} &middot; {formatTimestamp(annotation.created_at)}
                        </p>
                        {annotation.is_own && (
                          <button
                            onClick={() => {
                              onDelete(annotation.id);
                              setExpandedId(null);
                            }}
                            className="text-[10px] text-destructive/70 hover:text-destructive"
                          >
                            Delete
                          </button>
                        )}
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          );
        })}
      </div>
    </>
  );
}

function formatTimestamp(iso: string): string {
  const date = new Date(iso);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60_000);

  if (diffMins < 1) return 'just now';
  if (diffMins < 60) return `${diffMins}m ago`;

  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h ago`;

  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}
