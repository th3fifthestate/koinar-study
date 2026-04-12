'use client';

import { useState, useRef, type ReactNode } from 'react';
import {
  Popover,
  PopoverTrigger,
  PopoverContent,
} from '@/components/ui/popover';
import { Skeleton } from '@/components/ui/skeleton';

interface CrossRefTooltipProps {
  reference: string;
  children: ReactNode;
}

export function CrossRefTooltip({ reference, children }: CrossRefTooltipProps) {
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

  return (
    <Popover onOpenChange={handleOpen}>
      <PopoverTrigger className="cursor-pointer text-[var(--sage-500)] underline decoration-[var(--sage-300)] underline-offset-2 transition-colors hover:text-[var(--sage-700)]">
        {children}
      </PopoverTrigger>
      <PopoverContent className="max-w-[320px]">
        <p className="mb-1 text-xs font-medium text-[var(--sage-700)] dark:text-[var(--sage-300)]">
          {reference} (BSB)
        </p>
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
