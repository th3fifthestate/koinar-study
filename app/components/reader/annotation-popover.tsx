'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { Popover } from '@base-ui/react/popover';
import { HIGHLIGHT_COLORS, type HighlightColor } from './highlight-layer';
import type { TextSelectionResult } from '@/lib/hooks/use-text-selection';
import {
  READER_TRANSITION_POPOVER_ENTER,
  READER_TRANSITION_POPOVER_EXIT,
  READER_MOTION_POPOVER_DRAG_SNAP,
  READER_MOTION_POPOVER_DRAG_RESET,
} from '@/lib/motion/reader';

interface AnnotationPopoverProps {
  selection: TextSelectionResult;
  onHighlight: (color: HighlightColor, isPublic: boolean) => void;
  onNote: (color: HighlightColor, noteText: string, isPublic: boolean) => void;
  onClose: () => void;
  /** Persisted height for full-context mode (px). */
  annotationFullContextHeight?: number;
  /** Called when the user resizes the full-context panel. */
  onAnnotationFullContextHeightChange?: (px: number) => void;
}

const COLOR_SWATCHES: { name: HighlightColor; css: string }[] = [
  { name: 'yellow', css: 'bg-amber-300' },
  { name: 'green', css: 'bg-emerald-300' },
  { name: 'blue', css: 'bg-sky-300' },
  { name: 'pink', css: 'bg-rose-300' },
  { name: 'purple', css: 'bg-violet-300' },
];

const DEFAULT_FULL_CONTEXT_HEIGHT = 300;

export function AnnotationPopover({
  selection,
  onHighlight,
  onNote,
  onClose,
  annotationFullContextHeight,
  onAnnotationFullContextHeightChange,
}: AnnotationPopoverProps) {
  const [mode, setMode] = useState<'color' | 'note' | 'full-context'>('color');
  const [selectedColor, setSelectedColor] = useState<HighlightColor>('yellow');
  const [noteText, setNoteText] = useState('');
  const [isPublic, setIsPublic] = useState(false);

  // — reduced-motion —
  const [reducedMotion, setReducedMotion] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    setReducedMotion(mq.matches);
    const handler = (e: MediaQueryListEvent) => setReducedMotion(e.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);

  // — open state for enter/exit transition switching —
  const [isOpen, setIsOpen] = useState(true);

  // — full-context drag state —
  const popoverRef = useRef<HTMLDivElement>(null);
  const handleRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [currentHeight, setCurrentHeight] = useState(
    annotationFullContextHeight ?? DEFAULT_FULL_CONTEXT_HEIGHT,
  );
  const dragStartY = useRef(0);
  const dragStartHeight = useRef(0);

  // Sync persisted height into local state when it changes externally
  useEffect(() => {
    if (annotationFullContextHeight != null) {
      setCurrentHeight(annotationFullContextHeight);
    }
  }, [annotationFullContextHeight]);

  const getMaxHeight = useCallback(() => {
    const anchorBottom = selection.rect.bottom;
    return Math.min(window.innerHeight * 0.8, window.innerHeight - anchorBottom - 16);
  }, [selection.rect.bottom]);

  const animateToHeight = useCallback(
    (target: number, spec: { duration: number; easing: string }) => {
      const el = popoverRef.current;
      if (!el) return;
      if (reducedMotion) {
        el.style.maxHeight = `${target}px`;
        setCurrentHeight(target);
        onAnnotationFullContextHeightChange?.(target);
        return;
      }
      el.style.transition = `max-height ${spec.duration}ms ${spec.easing}`;
      el.style.maxHeight = `${target}px`;
      const onEnd = () => {
        el.style.transition = '';
        setCurrentHeight(target);
        onAnnotationFullContextHeightChange?.(target);
      };
      el.addEventListener('transitionend', onEnd, { once: true });
    },
    [reducedMotion, onAnnotationFullContextHeightChange],
  );

  const handlePointerDown = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      e.preventDefault();
      (e.currentTarget as HTMLDivElement).setPointerCapture(e.pointerId);
      dragStartY.current = e.clientY;
      dragStartHeight.current = currentHeight;
      setIsDragging(true);
    },
    [currentHeight],
  );

  const handlePointerMove = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (!isDragging) return;
      const el = popoverRef.current;
      if (!el) return;
      const delta = e.clientY - dragStartY.current;
      const next = Math.max(
        DEFAULT_FULL_CONTEXT_HEIGHT,
        Math.min(getMaxHeight(), dragStartHeight.current + delta),
      );
      el.style.maxHeight = `${next}px`;
    },
    [isDragging, getMaxHeight],
  );

  const handlePointerUp = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (!isDragging) return;
      (e.currentTarget as HTMLDivElement).releasePointerCapture(e.pointerId);
      setIsDragging(false);

      const delta = e.clientY - dragStartY.current;
      const raw = dragStartHeight.current + delta;
      const max = getMaxHeight();
      const def = DEFAULT_FULL_CONTEXT_HEIGHT;

      let snapTarget: number;
      if (Math.abs(raw - def) <= 24) {
        snapTarget = def;
      } else if (Math.abs(raw - max) <= 24) {
        snapTarget = max;
      } else {
        snapTarget = Math.max(def, Math.min(max, raw));
      }

      animateToHeight(snapTarget, READER_MOTION_POPOVER_DRAG_SNAP);
    },
    [isDragging, getMaxHeight, animateToHeight],
  );

  const handleDoubleClick = useCallback(() => {
    animateToHeight(DEFAULT_FULL_CONTEXT_HEIGHT, READER_MOTION_POPOVER_DRAG_RESET);
  }, [animateToHeight]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLDivElement>) => {
      const el = popoverRef.current;
      if (!el) return;
      const max = getMaxHeight();
      const def = DEFAULT_FULL_CONTEXT_HEIGHT;

      if (e.key === 'ArrowDown') {
        e.preventDefault();
        const next = Math.min(max, currentHeight + 40);
        animateToHeight(next, READER_MOTION_POPOVER_DRAG_SNAP);
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        const next = Math.max(def, currentHeight - 40);
        animateToHeight(next, READER_MOTION_POPOVER_DRAG_SNAP);
      } else if (e.key === 'Home') {
        e.preventDefault();
        animateToHeight(def, READER_MOTION_POPOVER_DRAG_RESET);
      } else if (e.key === 'End') {
        e.preventDefault();
        animateToHeight(max, READER_MOTION_POPOVER_DRAG_SNAP);
      }
    },
    [currentHeight, getMaxHeight, animateToHeight],
  );

  // — Virtual anchor for Base UI Positioner —
  const virtualAnchor = {
    getBoundingClientRect: () => selection.rect,
  };

  // Transition style: enter vs exit, respects reduced-motion
  const transitionStyle = reducedMotion
    ? { transition: 'none' }
    : { transition: isOpen ? READER_TRANSITION_POPOVER_ENTER : READER_TRANSITION_POPOVER_EXIT };

  return (
    <Popover.Root
      open
      onOpenChange={(open) => {
        setIsOpen(open);
        if (!open) onClose();
      }}
    >
      <Popover.Portal>
        <Popover.Positioner
          anchor={virtualAnchor}
          side="top"
          sideOffset={8}
          align="center"
          className="z-50"
        >
          <Popover.Popup
            ref={popoverRef}
            data-slot="popover-content"
            style={{
              ...transitionStyle,
              ...(mode === 'full-context'
                ? { maxHeight: currentHeight, overflowY: 'auto' }
                : {}),
            }}
            className={[
              'origin-(--transform-origin) rounded-lg bg-popover p-3 shadow-lg ring-1 ring-foreground/10',
              // Initial (closed) state — Base UI adds data-open / data-closed attributes
              'opacity-0 translate-y-1 scale-[0.97]',
              // Open state overrides
              'data-[open]:opacity-100 data-[open]:translate-y-0 data-[open]:scale-100',
              // Closed state resets (redundant but explicit)
              'data-[closed]:opacity-0 data-[closed]:translate-y-1 data-[closed]:scale-[0.97]',
            ].join(' ')}
          >
            {mode === 'color' && (
              <div className="flex flex-col gap-2.5">
                <div className="flex items-center gap-1.5">
                  {COLOR_SWATCHES.map((c) => (
                    <button
                      key={c.name}
                      onClick={() => {
                        onHighlight(c.name, isPublic);
                        onClose();
                      }}
                      className={`h-7 w-7 rounded-full ${c.css} border-2 ${
                        selectedColor === c.name
                          ? 'border-foreground/70 scale-110'
                          : 'border-transparent'
                      } transition-all hover:scale-110 focus-visible:outline-2 focus-visible:outline-offset-2`}
                      title={`Highlight ${HIGHLIGHT_COLORS[c.name].label}`}
                      onMouseEnter={() => setSelectedColor(c.name)}
                    />
                  ))}

                  <div className="mx-1.5 h-5 w-px bg-border" />

                  <button
                    onClick={() => setMode('note')}
                    className="rounded-md px-2.5 py-1 text-xs font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                  >
                    + Note
                  </button>

                  <button
                    onClick={() => setMode('full-context')}
                    className="rounded-md px-2.5 py-1 text-xs font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                  >
                    Context
                  </button>
                </div>

                <label className="flex items-center gap-1.5 text-[11px] text-muted-foreground select-none">
                  <input
                    type="checkbox"
                    checked={isPublic}
                    onChange={(e) => setIsPublic(e.target.checked)}
                    className="rounded border-muted-foreground/40"
                  />
                  Share with community
                </label>
              </div>
            )}

            {mode === 'note' && (
              <div className="flex flex-col gap-2.5 w-64">
                <textarea
                  value={noteText}
                  onChange={(e) => setNoteText(e.target.value)}
                  placeholder="Add a note..."
                  className="w-full resize-none rounded-md border bg-background p-2.5 text-sm leading-relaxed placeholder:text-muted-foreground/60 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                  rows={3}
                  autoFocus
                  maxLength={5000}
                />

                <div className="flex items-center justify-between">
                  <label className="flex items-center gap-1.5 text-[11px] text-muted-foreground select-none">
                    <input
                      type="checkbox"
                      checked={isPublic}
                      onChange={(e) => setIsPublic(e.target.checked)}
                      className="rounded border-muted-foreground/40"
                    />
                    Share
                  </label>

                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => {
                        setMode('color');
                        setNoteText('');
                      }}
                      className="rounded-md px-2.5 py-1 text-xs text-muted-foreground transition-colors hover:text-foreground"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={() => {
                        if (noteText.trim()) {
                          onNote(selectedColor, noteText.trim(), isPublic);
                          onClose();
                        }
                      }}
                      disabled={!noteText.trim()}
                      className="rounded-md bg-primary px-3 py-1 text-xs font-medium text-primary-foreground transition-opacity disabled:opacity-40"
                    >
                      Save
                    </button>
                  </div>
                </div>
              </div>
            )}

            {mode === 'full-context' && (
              <div className="flex flex-col gap-2 w-72">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-foreground">Context</span>
                  <button
                    onClick={() => setMode('color')}
                    className="rounded-md px-2 py-0.5 text-xs text-muted-foreground transition-colors hover:text-foreground"
                  >
                    ← Back
                  </button>
                </div>

                <div className="py-4 text-sm text-muted-foreground">
                  Verse context coming soon.
                </div>

                {/* Drag handle */}
                <div
                  ref={handleRef}
                  role="separator"
                  aria-orientation="horizontal"
                  aria-valuemin={DEFAULT_FULL_CONTEXT_HEIGHT}
                  aria-valuemax={getMaxHeight()}
                  aria-valuenow={currentHeight}
                  tabIndex={0}
                  onPointerDown={handlePointerDown}
                  onPointerMove={handlePointerMove}
                  onPointerUp={handlePointerUp}
                  onDoubleClick={handleDoubleClick}
                  onKeyDown={handleKeyDown}
                  className="mx-auto mt-2 cursor-ns-resize focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 rounded-full"
                  style={{
                    width: 24,
                    height: 4,
                    borderRadius: 2,
                    backgroundColor: 'currentColor',
                    opacity: isDragging ? 1 : 0.4,
                    padding: '6px 0',
                    touchAction: 'none',
                    boxSizing: 'content-box',
                  }}
                />
              </div>
            )}
          </Popover.Popup>
        </Popover.Positioner>
      </Popover.Portal>
    </Popover.Root>
  );
}
