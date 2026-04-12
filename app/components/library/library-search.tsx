'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Search, X } from 'lucide-react';
import { useDebounce } from '@/lib/hooks/use-debounce';

export function LibrarySearch() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [value, setValue] = useState(searchParams.get('q') ?? '');
  const debouncedValue = useDebounce(value, 300);

  const updateParams = useCallback(
    (q: string) => {
      const params = new URLSearchParams(searchParams.toString());
      if (q) {
        params.set('q', q);
      } else {
        params.delete('q');
      }
      params.delete('page');
      router.push(`/?${params.toString()}`);
    },
    [router, searchParams]
  );

  useEffect(() => {
    const currentQ = searchParams.get('q') ?? '';
    if (debouncedValue !== currentQ) {
      updateParams(debouncedValue);
    }
  }, [debouncedValue, updateParams, searchParams]);

  return (
    <div className="flex-1 flex items-center gap-2.5 bg-[var(--stone-100)] border border-[var(--stone-200)] rounded-md px-4 py-2.5">
      <Search className="h-4 w-4 text-[var(--stone-300)] shrink-0" />
      <input
        type="text"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="Search studies by title, content, or tags..."
        className="flex-1 bg-transparent border-none outline-none font-body text-sm text-[var(--stone-700)] placeholder:text-[var(--stone-300)]"
      />
      {value && (
        <button
          onClick={() => setValue('')}
          className="text-[var(--stone-300)] hover:text-[var(--stone-700)] transition-colors"
        >
          <X className="h-4 w-4" />
        </button>
      )}
    </div>
  );
}
