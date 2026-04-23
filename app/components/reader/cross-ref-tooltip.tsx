'use client';

import { useState, useRef, useCallback, type ReactNode } from 'react';
import {
  Popover,
  PopoverTrigger,
  PopoverContent,
} from '@/components/ui/popover';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';
import { useEntityLayerOptional } from './entity-layer-context';

interface CrossRefTooltipProps {
  reference: string;
  children: ReactNode;
}

export function CrossRefTooltip({ reference, children }: CrossRefTooltipProps) {
  const entityLayer = useEntityLayerOptional();
  const benchEnabled = entityLayer?.benchEnabled ?? false;
  const [verseText, setVerseText] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const cacheRef = useRef<Map<string, string>>(new Map());

  async function handleOpen(open: boolean) {
    if (!open || verseText || loading) return;

    const cached = cacheRef.current.get(reference);
    if (cached) {
      setVerseText(cached);
      return;
    }

    setLoading(true);
    setError(false);
    try {
      const res = await fetch(`/api/verses?ref=${encodeURIComponent(reference)}`);
      if (!res.ok) throw new Error('Not found');
      const data = await res.json();
      cacheRef.current.set(reference, data.text);
      setVerseText(data.text);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }

  const handleClipChain = useCallback(async () => {
    const match = reference.trim().match(/^(.+?)\s+(\d+):(\d+)/)
    if (!match) return
    const [, book, chap, ver] = match
    const payload = {
      type: 'cross-ref-chain',
      source_ref: {
        type: 'cross-ref-chain',
        from_book: book,
        from_chapter: parseInt(chap),
        from_verse: parseInt(ver),
      },
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
      toast.success('Cross-ref chain clipped to Bench', {
        action: { label: 'View', onClick: () => window.open('/bench', '_blank') },
      })
    } catch {
      toast.error('Failed to clip to Bench')
    }
  }, [reference])

  return (
    <Popover onOpenChange={handleOpen}>
      <PopoverTrigger className="cursor-pointer text-[var(--sage-500)] underline decoration-[var(--sage-300)] underline-offset-2 transition-colors hover:text-[var(--sage-700)]">
        {children}
      </PopoverTrigger>
      <PopoverContent className="max-w-[320px]">
        <div className="flex items-center justify-between mb-1">
          <p className="text-xs font-medium text-[var(--sage-700)] dark:text-[var(--sage-300)]">
            {reference} (BSB)
          </p>
          {benchEnabled && (
            <button
              onClick={handleClipChain}
              className="ml-2 text-muted-foreground hover:text-sage-600 transition-colors shrink-0"
              aria-label="Clip cross-ref chain to Bench"
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M19 21l-7-5-7 5V5a2 2 0 012-2h10a2 2 0 012 2z" />
              </svg>
            </button>
          )}
        </div>
        {loading && (
          <div className="space-y-1.5">
            <Skeleton className="h-3 w-full" />
            <Skeleton className="h-3 w-4/5" />
          </div>
        )}
        {error && (
          <p className="text-xs italic text-muted-foreground">Verse not available</p>
        )}
        {verseText && (
          <p className="font-body text-sm italic leading-relaxed text-foreground/90">
            &ldquo;{verseText}&rdquo;
          </p>
        )}
      </PopoverContent>
    </Popover>
  );
}
