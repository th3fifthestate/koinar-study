'use client';

import { BookOpen } from 'lucide-react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/button';

export function EmptyState() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const query = searchParams.get('q');
  const category = searchParams.get('category');
  const hasFilters = query || category || searchParams.get('format_type') || searchParams.get('favorites');

  const title = 'No studies found';
  let subtitle = 'The library is empty. Studies will appear here as they are created.';

  if (query) {
    subtitle = `No studies match "${query}". Try a different search.`;
  } else if (category) {
    subtitle = 'No studies in this category yet.';
  }

  const clearFilters = () => {
    router.push('/');
  };

  return (
    <div className="flex flex-col items-center justify-center py-20 text-center">
      <BookOpen className="h-12 w-12 text-[var(--stone-300)] mb-4" strokeWidth={1} />
      <h3 className="font-display text-xl text-[var(--stone-900)] mb-2">{title}</h3>
      <p className="text-sm text-[var(--stone-300)] max-w-[320px] mb-6">{subtitle}</p>
      {hasFilters && (
        <Button variant="outline" onClick={clearFilters} className="text-xs uppercase tracking-wider">
          Clear filters
        </Button>
      )}
    </div>
  );
}
