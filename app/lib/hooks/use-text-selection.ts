'use client';

import { useState, useEffect, useCallback } from 'react';

export interface TextSelectionResult {
  text: string;
  startOffset: number;
  endOffset: number;
  rect: DOMRect;
}

/**
 * Detects text selection within a container element.
 * Returns character offsets relative to the container's text content
 * and a DOMRect for popover positioning.
 */
export function useTextSelection(containerRef: React.RefObject<HTMLElement | null>) {
  const [selection, setSelection] = useState<TextSelectionResult | null>(null);

  const handleSelectionChange = useCallback(() => {
    const sel = window.getSelection();
    if (!sel || sel.isCollapsed || !sel.rangeCount) {
      return;
    }

    const range = sel.getRangeAt(0);
    const container = containerRef.current;
    if (!container || !container.contains(range.commonAncestorContainer)) {
      return;
    }

    // Compute offsets from the raw selection before trimming — trim changes
    // length and would cause endOffset to fall short of the actual selection end.
    const rawText = sel.toString();
    const text = rawText.trim();
    if (!text || text.length > 2000) return;

    // Calculate character offsets relative to the container's text content
    const preRange = document.createRange();
    preRange.selectNodeContents(container);
    preRange.setEnd(range.startContainer, range.startOffset);
    const startOffset = preRange.toString().length;
    const endOffset = startOffset + rawText.length;

    const rect = range.getBoundingClientRect();

    setSelection({ text, startOffset, endOffset, rect });
  }, [containerRef]);

  useEffect(() => {
    document.addEventListener('mouseup', handleSelectionChange);
    document.addEventListener('touchend', handleSelectionChange);
    return () => {
      document.removeEventListener('mouseup', handleSelectionChange);
      document.removeEventListener('touchend', handleSelectionChange);
    };
  }, [handleSelectionChange]);

  const clearSelection = useCallback(() => {
    setSelection(null);
    window.getSelection()?.removeAllRanges();
  }, []);

  return { selection, clearSelection };
}
