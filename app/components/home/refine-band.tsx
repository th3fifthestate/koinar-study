'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Search, X, Heart, ChevronDown } from 'lucide-react';
import { useDebounce } from '@/lib/hooks/use-debounce';
import type { Category } from '@/lib/db/types';

interface RefineBandProps {
  categories: Category[];
}

export function RefineBand({ categories }: RefineBandProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const panelRef = useRef<HTMLDivElement>(null);
  const refineButtonRef = useRef<HTMLButtonElement>(null);

  const [panelOpen, setPanelOpen] = useState(false);
  const [searchValue, setSearchValue] = useState(searchParams.get('q') ?? '');
  const debouncedSearch = useDebounce(searchValue, 300);

  const currentCategory = searchParams.get('category') ?? '';
  const currentSort = searchParams.get('sort') ?? 'newest';
  const currentFormat = searchParams.get('format_type') ?? '';
  const favoritesActive = searchParams.get('favorites') === 'true';

  const hasActiveFilters =
    !!currentCategory ||
    !!currentFormat ||
    favoritesActive ||
    (currentSort !== 'newest');

  // Push a param update without scroll jump
  const pushParam = useCallback(
    (key: string, value: string) => {
      const params = new URLSearchParams(searchParams.toString());
      if (value) {
        params.set(key, value);
      } else {
        params.delete(key);
      }
      params.delete('page');
      router.replace(`/?${params.toString()}`, { scroll: false });
    },
    [router, searchParams]
  );

  // Sync debounced search to URL
  useEffect(() => {
    const currentQ = searchParams.get('q') ?? '';
    if (debouncedSearch !== currentQ) {
      pushParam('q', debouncedSearch);
    }
  }, [debouncedSearch, pushParam, searchParams]);

  // Close panel on outside click
  useEffect(() => {
    if (!panelOpen) return;
    function handleClick(e: MouseEvent) {
      if (
        panelRef.current &&
        !panelRef.current.contains(e.target as Node) &&
        !refineButtonRef.current?.contains(e.target as Node)
      ) {
        setPanelOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [panelOpen]);

  const toggleFavorites = () => {
    pushParam('favorites', favoritesActive ? '' : 'true');
  };

  const clearAll = () => {
    const params = new URLSearchParams();
    if (searchParams.get('q')) params.set('q', searchParams.get('q')!);
    router.replace(`/?${params.toString()}`, { scroll: false });
    setPanelOpen(false);
  };

  return (
    <div className="border-y border-[var(--stone-200)] bg-[var(--stone-100)] dark:bg-[var(--stone-900)] dark:border-[var(--stone-700)]">
      {/* Main band */}
      <div className="flex items-center gap-4 px-6 md:px-10 lg:px-24 h-[72px] md:h-[88px]">
        {/* Search */}
        <div className="flex-1 flex flex-col gap-0.5">
          <label
            htmlFor="library-search"
            className="text-[9px] uppercase tracking-[0.2em] text-[var(--stone-300)] font-body"
          >
            Search the library
          </label>
          <div className="flex items-center gap-2">
            <Search className="h-3.5 w-3.5 text-[var(--stone-300)] shrink-0" aria-hidden="true" />
            <input
              id="library-search"
              type="search"
              value={searchValue}
              onChange={(e) => setSearchValue(e.target.value)}
              placeholder="By title, book, or phrase."
              className="flex-1 bg-transparent border-none outline-none font-body text-[1rem] text-[var(--stone-700)] dark:text-[var(--stone-50)] placeholder:text-[var(--stone-300)] min-w-0"
              aria-label="Search the library"
            />
            {searchValue && (
              <button
                onClick={() => setSearchValue('')}
                className="text-[var(--stone-300)] hover:text-[var(--stone-700)] transition-colors"
                aria-label="Clear search"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* Refine toggle */}
        <button
          ref={refineButtonRef}
          onClick={() => setPanelOpen((o) => !o)}
          className="flex items-center gap-1.5 font-body text-[0.9375rem] text-[var(--warmth)] hover:text-[var(--warmth)]/80 transition-colors shrink-0"
          aria-expanded={panelOpen}
          aria-controls="refine-panel"
        >
          {/* Active dot */}
          {hasActiveFilters && (
            <span
              className="w-1.5 h-1.5 rounded-full bg-[var(--warmth)]"
              aria-label="Filters active"
            />
          )}
          <span>Refine</span>
          <ChevronDown
            className={`h-3.5 w-3.5 transition-transform duration-200 ${panelOpen ? 'rotate-180' : ''}`}
            aria-hidden="true"
          />
        </button>
      </div>

      {/* Expandable filter panel */}
      <div
        id="refine-panel"
        ref={panelRef}
        className={`overflow-hidden transition-all duration-[180ms] ease-out ${panelOpen ? 'max-h-[200px] opacity-100' : 'max-h-0 opacity-0'}`}
        aria-hidden={!panelOpen}
      >
        <div
          className="px-6 md:px-10 lg:px-24 pt-2 pb-6 flex flex-wrap items-center gap-x-6 gap-y-3"
          style={{ transitionDelay: panelOpen ? '80ms' : '0ms' }}
        >
          {/* Category */}
          <div className="flex flex-col gap-1">
            <label
              htmlFor="filter-category"
              className="text-[9px] uppercase tracking-[0.2em] text-[var(--stone-300)] font-body"
            >
              By category
            </label>
            <select
              id="filter-category"
              value={currentCategory}
              onChange={(e) => pushParam('category', e.target.value)}
              className="font-body text-[1rem] text-[var(--stone-700)] bg-transparent border-b border-[var(--stone-200)] outline-none cursor-pointer pb-0.5"
            >
              <option value="">All</option>
              {categories.map((cat) => (
                <option key={cat.slug} value={cat.slug}>
                  {cat.name}
                </option>
              ))}
            </select>
          </div>

          {/* Sort */}
          <div className="flex flex-col gap-1">
            <label
              htmlFor="filter-sort"
              className="text-[9px] uppercase tracking-[0.2em] text-[var(--stone-300)] font-body"
            >
              Order by
            </label>
            <select
              id="filter-sort"
              value={currentSort}
              onChange={(e) => pushParam('sort', e.target.value)}
              className="font-body text-[1rem] text-[var(--stone-700)] bg-transparent border-b border-[var(--stone-200)] outline-none cursor-pointer pb-0.5"
            >
              <option value="newest">Newest first</option>
              <option value="oldest">Oldest first</option>
              <option value="popular">Most favorited</option>
            </select>
          </div>

          {/* Format */}
          <div className="flex flex-col gap-1">
            <label
              htmlFor="filter-format"
              className="text-[9px] uppercase tracking-[0.2em] text-[var(--stone-300)] font-body"
            >
              Depth
            </label>
            <select
              id="filter-format"
              value={currentFormat}
              onChange={(e) => pushParam('format_type', e.target.value)}
              className="font-body text-[1rem] text-[var(--stone-700)] bg-transparent border-b border-[var(--stone-200)] outline-none cursor-pointer pb-0.5"
            >
              <option value="">Any depth</option>
              <option value="quick">Quick</option>
              <option value="standard">Standard</option>
              <option value="comprehensive">Comprehensive</option>
            </select>
          </div>

          {/* Divider */}
          <div className="w-px h-8 bg-[var(--stone-200)] hidden md:block" aria-hidden="true" />

          {/* Favorites toggle */}
          <button
            onClick={toggleFavorites}
            className={`flex items-center gap-1.5 font-body text-[0.9375rem] transition-all duration-200 ${
              favoritesActive
                ? 'text-[var(--warmth)]'
                : 'text-[var(--stone-300)] hover:text-[var(--stone-700)]'
            }`}
            aria-pressed={favoritesActive}
          >
            <Heart
              className="h-3.5 w-3.5"
              fill={favoritesActive ? 'var(--warmth)' : 'none'}
              aria-hidden="true"
            />
            <span>Only my favorites</span>
          </button>

          {/* Clear all */}
          {hasActiveFilters && (
            <>
              <div className="w-px h-8 bg-[var(--stone-200)] hidden md:block" aria-hidden="true" />
              <button
                onClick={clearAll}
                className="font-body text-[0.9375rem] text-[var(--stone-300)] hover:text-[var(--stone-700)] transition-colors"
              >
                Clear all
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
