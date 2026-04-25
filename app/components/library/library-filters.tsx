'use client';

import { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { SlidersHorizontal, ChevronDown, Heart } from 'lucide-react';
import type { Category } from '@/lib/db/types';

interface LibraryFiltersProps {
  categories: Category[];
  isLoggedIn: boolean;
}

export function LibraryFilters({ categories, isLoggedIn }: LibraryFiltersProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [open, setOpen] = useState(false);

  const currentCategory = searchParams.get('category') ?? '';
  const currentSort = searchParams.get('sort') ?? 'newest';
  const currentFormat = searchParams.get('format_type') ?? '';
  const favoritesActive = searchParams.get('favorites') === 'true';

  const updateParam = (key: string, value: string) => {
    const params = new URLSearchParams(searchParams.toString());
    if (value) {
      params.set(key, value);
    } else {
      params.delete(key);
    }
    params.delete('page');
    router.push(`/?${params.toString()}`);
  };

  const toggleFavorites = () => {
    if (!isLoggedIn) {
      import('sonner').then(({ toast }) => toast.error('Sign in to filter favorites'));
      return;
    }
    const params = new URLSearchParams(searchParams.toString());
    if (favoritesActive) {
      params.delete('favorites');
    } else {
      params.set('favorites', 'true');
    }
    params.delete('page');
    router.push(`/?${params.toString()}`);
  };

  const activeCount = [currentCategory, currentFormat, favoritesActive ? 'y' : ''].filter(Boolean).length
    + (currentSort !== 'newest' ? 1 : 0);

  return (
    <>
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 px-4 py-2.5 border border-[var(--stone-200)] rounded-md bg-[var(--stone-100)] hover:border-[var(--stone-300)] transition-colors font-body text-[13px] text-[var(--stone-700)]"
      >
        <SlidersHorizontal className="h-3.5 w-3.5" />
        <span>Filters</span>
        {activeCount > 0 && (
          <span className="ml-1 flex h-4 w-4 items-center justify-center rounded-full bg-[var(--sage-500)] text-[9px] text-[var(--stone-50)]">
            {activeCount}
          </span>
        )}
        <ChevronDown
          className={`h-3 w-3 transition-transform duration-300 ${open ? 'rotate-180' : ''}`}
        />
      </button>

      <div
        className={`col-span-full overflow-hidden transition-all duration-350 [transition-timing-function:cubic-bezier(0.16,1,0.3,1)] ${
          open ? 'max-h-[120px] opacity-100 mt-2 mb-4' : 'max-h-0 opacity-0'
        }`}
      >
        <div className="flex items-center gap-4 flex-wrap py-3">
          <div className="flex items-center gap-2">
            <label className="text-[10px] uppercase tracking-[0.15em] text-[var(--stone-300)]">
              Category
            </label>
            <select
              value={currentCategory}
              onChange={(e) => updateParam('category', e.target.value)}
              className="font-body text-[13px] text-[var(--stone-700)] border border-[var(--stone-200)] rounded px-3 py-1.5 bg-[var(--stone-100)] outline-none cursor-pointer"
            >
              <option value="">All Categories</option>
              {categories.map((cat) => (
                <option key={cat.slug} value={cat.slug}>
                  {cat.name}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-2">
            <label className="text-[10px] uppercase tracking-[0.15em] text-[var(--stone-300)]">
              Sort
            </label>
            <select
              value={currentSort}
              onChange={(e) => updateParam('sort', e.target.value)}
              className="font-body text-[13px] text-[var(--stone-700)] border border-[var(--stone-200)] rounded px-3 py-1.5 bg-[var(--stone-100)] outline-none cursor-pointer"
            >
              <option value="newest">Newest First</option>
              <option value="popular">Most Favorited</option>
            </select>
          </div>

          <div className="flex items-center gap-2">
            <label className="text-[10px] uppercase tracking-[0.15em] text-[var(--stone-300)]">
              Format
            </label>
            <select
              value={currentFormat}
              onChange={(e) => updateParam('format_type', e.target.value)}
              className="font-body text-[13px] text-[var(--stone-700)] border border-[var(--stone-200)] rounded px-3 py-1.5 bg-[var(--stone-100)] outline-none cursor-pointer"
            >
              <option value="">All Formats</option>
              <option value="quick">Quick</option>
              <option value="standard">Standard</option>
              <option value="comprehensive">Comprehensive</option>
            </select>
          </div>

          <div className="w-px h-5 bg-[var(--stone-200)]" />

          <button
            onClick={toggleFavorites}
            className={`flex items-center gap-1.5 px-3 py-1.5 border rounded text-[13px] transition-all duration-300 ${
              favoritesActive
                ? 'border-[var(--destructive)] bg-[var(--destructive)]/[0.08] text-[var(--destructive)]'
                : 'border-[var(--stone-200)] bg-[var(--stone-100)] text-[var(--stone-700)] hover:border-[var(--destructive)]'
            }`}
          >
            <Heart className="h-3.5 w-3.5" fill={favoritesActive ? 'var(--destructive)' : 'none'} />
            <span>Favorites</span>
          </button>
        </div>
      </div>
    </>
  );
}
