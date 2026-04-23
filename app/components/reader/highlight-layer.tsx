'use client';

import { useEffect } from 'react';
import type { AnnotationPayload } from '@/lib/ws/types';

// Warm, tactile highlight colors — like real highlighter pens on paper
export const HIGHLIGHT_COLORS = {
  yellow: { bg: 'bg-amber-200/50 dark:bg-amber-400/20', label: 'Yellow', dot: 'bg-amber-300' },
  green: { bg: 'bg-emerald-200/45 dark:bg-emerald-400/20', label: 'Green', dot: 'bg-emerald-300' },
  blue: { bg: 'bg-sky-200/45 dark:bg-sky-400/20', label: 'Blue', dot: 'bg-sky-300' },
  pink: { bg: 'bg-rose-200/45 dark:bg-rose-400/20', label: 'Pink', dot: 'bg-rose-300' },
  purple: { bg: 'bg-violet-200/45 dark:bg-violet-400/20', label: 'Purple', dot: 'bg-violet-300' },
} as const;

export type HighlightColor = keyof typeof HIGHLIGHT_COLORS;

/**
 * Applies highlight <mark> elements to the container DOM by walking text nodes
 * to find the character offsets for each annotation.
 *
 * Call this imperatively after the markdown content renders.
 */
export function applyHighlights(
  container: HTMLElement,
  annotations: AnnotationPayload[],
  onAnnotationClick?: (annotation: AnnotationPayload) => void
) {
  // 1. Remove existing highlight marks
  container.querySelectorAll('mark[data-annotation-id]').forEach((mark) => {
    const parent = mark.parentNode;
    while (mark.firstChild) {
      parent?.insertBefore(mark.firstChild, mark);
    }
    parent?.removeChild(mark);
  });
  // Normalize adjacent text nodes after removing marks
  container.normalize();

  // 2. Sort annotations by start_offset (process from end to start to avoid offset shifting)
  const sorted = [...annotations].sort((a, b) => b.start_offset - a.start_offset);

  // 3. For each annotation, find the text range and wrap with <mark>
  sorted.forEach((annotation) => {
    try {
      const range = createRangeFromOffsets(container, annotation.start_offset, annotation.end_offset);
      if (!range) return;

      const mark = document.createElement('mark');
      mark.dataset.annotationId = String(annotation.id);
      const colorCfg = HIGHLIGHT_COLORS[annotation.color] || HIGHLIGHT_COLORS.yellow;

      // Build class list — Tailwind classes won't work on dynamically created elements,
      // so we use inline styles for the background and CSS classes for structure
      mark.className = 'annotation-mark cursor-pointer rounded-[2px] transition-opacity';

      // Community annotations get reduced opacity
      if (!annotation.is_own) {
        mark.style.opacity = '0.55';
      }

      // Note annotations get a dashed underline
      if (annotation.type === 'note') {
        mark.style.borderBottom = '1.5px dashed currentColor';
        mark.style.paddingBottom = '1px';
      }

      // Apply highlight color as inline style (Tailwind classes don't apply to DOM-created elements)
      const colorMap: Record<string, string> = {
        yellow: 'rgba(251, 191, 36, 0.35)',
        green: 'rgba(52, 211, 153, 0.3)',
        blue: 'rgba(56, 189, 248, 0.3)',
        pink: 'rgba(251, 113, 133, 0.3)',
        purple: 'rgba(167, 139, 250, 0.3)',
      };
      mark.style.backgroundColor = colorMap[annotation.color] || colorMap.yellow;

      if (onAnnotationClick) {
        mark.addEventListener('click', (e) => {
          e.stopPropagation();
          onAnnotationClick(annotation);
        });
      }

      wrapRangeWithMark(range, mark);
    } catch {
      // Graceful degradation: if DOM has changed and offsets don't match, skip
    }
  });
}

/**
 * Wraps a Range in a <mark> element. Uses extractContents + appendChild
 * instead of surroundContents, which throws when the range spans multiple
 * DOM nodes (e.g., crossing <strong>, <em>, entity <span> boundaries).
 */
function wrapRangeWithMark(range: Range, mark: HTMLElement): void {
  const fragment = range.extractContents();
  mark.appendChild(fragment);
  range.insertNode(mark);
}

function createRangeFromOffsets(
  container: HTMLElement,
  startOffset: number,
  endOffset: number
): Range | null {
  const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT);
  let currentOffset = 0;
  let startNode: Text | null = null;
  let startNodeOffset = 0;
  let endNode: Text | null = null;
  let endNodeOffset = 0;

  while (walker.nextNode()) {
    const node = walker.currentNode as Text;
    const nodeLength = node.textContent?.length || 0;

    if (!startNode && currentOffset + nodeLength > startOffset) {
      startNode = node;
      startNodeOffset = startOffset - currentOffset;
    }

    if (!endNode && currentOffset + nodeLength >= endOffset) {
      endNode = node;
      endNodeOffset = endOffset - currentOffset;
      break;
    }

    currentOffset += nodeLength;
  }

  if (!startNode || !endNode) return null;

  const range = document.createRange();
  range.setStart(startNode, startNodeOffset);
  range.setEnd(endNode, endNodeOffset);
  return range;
}

/**
 * React hook that re-applies highlights when annotations change.
 */
export function useHighlightLayer(
  contentRef: React.RefObject<HTMLElement | null>,
  annotations: AnnotationPayload[],
  loading: boolean,
  onAnnotationClick?: (annotation: AnnotationPayload) => void
) {
  useEffect(() => {
    if (contentRef.current && !loading) {
      applyHighlights(contentRef.current, annotations, onAnnotationClick);
    }
  }, [contentRef, annotations, loading, onAnnotationClick]);
}
