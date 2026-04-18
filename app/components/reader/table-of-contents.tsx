'use client';

import { useCallback, useState } from 'react';
import { List } from 'lucide-react';
import {
  Sheet,
  SheetTrigger,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';

export interface HeadingItem {
  id: string;
  text: string;
  level: number;
}

interface TableOfContentsProps {
  headings: HeadingItem[];
  activeId: string;
}

/**
 * Dot-spine TOC: a vertical rail with a dot per heading. The active
 * section gets a filled sage dot + revealed label; inactive sections are
 * small hollow marks that expand their label on hover. Sub-headings are
 * offset left with smaller dots so nesting reads without indentation.
 *
 * The spine itself is a hairline running the full height of the TOC.
 */
/**
 * Click-to-scroll that is resilient to heading-id mismatches between the
 * extracted TOC model (parsed from raw markdown) and the rendered DOM
 * (where duplicate-slug counters may diverge under chunked / concurrent
 * rendering). Strategy:
 *   1. Try direct id lookup.
 *   2. Fall back to matching a heading by its trimmed text content.
 *   3. Give up silently.
 */
function useHeadingScroll() {
  return useCallback((id: string, text: string) => {
    const byId = document.getElementById(id);
    if (byId) {
      byId.scrollIntoView({ behavior: 'smooth', block: 'start' });
      return;
    }
    const needle = text.trim();
    const match = Array.from(
      document.querySelectorAll('article h1, article h2, article h3, article h4'),
    ).find((el) => el.textContent?.trim() === needle);
    match?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, []);
}

function DotSpineList({
  headings,
  activeId,
  onItemClick,
}: TableOfContentsProps & { onItemClick?: () => void }) {
  const scrollToHeading = useHeadingScroll();
  return (
    <nav aria-label="Table of contents" className="relative">
      {/* Spine rail */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute left-[5px] top-2 bottom-2 w-px"
        style={{ backgroundColor: 'var(--reader-rule, var(--stone-200))' }}
      />

      <ul className="space-y-2">
        {headings.map((h) => {
          const isActive = h.id === activeId;
          const isSub = h.level >= 3;
          const dotSize = isSub ? 5 : 7;
          // Dots center on the spine (which sits at left 5px). A size-7 dot
          // needs -1px to align; a size-5 dot needs +0px.
          const dotOffset = isSub ? 3 : 2;

          return (
            <li key={h.id} className="group/item relative">
              <button
                type="button"
                onClick={() => {
                  scrollToHeading(h.id, h.text);
                  onItemClick?.();
                }}
                className="relative flex w-full cursor-pointer items-center gap-3 pl-6 pr-2 py-1 text-left text-sm transition-all duration-300 ease-out hover:opacity-100"
                style={{
                  color: isActive
                    ? 'var(--reader-display, var(--stone-700))'
                    : 'var(--reader-ink-soft, var(--stone-500))',
                }}
              >
                {/* Dot */}
                <span
                  aria-hidden="true"
                  className="absolute top-1/2 -translate-y-1/2 rounded-full transition-all duration-300 ease-out"
                  style={{
                    left: `${dotOffset}px`,
                    width: `${dotSize}px`,
                    height: `${dotSize}px`,
                    backgroundColor: isActive
                      ? 'var(--reader-accent-sage, var(--sage-500))'
                      : 'transparent',
                    border: isActive
                      ? 'none'
                      : `1px solid var(--reader-ink-soft, var(--stone-400))`,
                    opacity: isActive ? 1 : 0.55,
                    transform: `translateY(-50%) scale(${isActive ? 1.1 : 1})`,
                  }}
                />

                {/* Label — always visible, weight+color shift on active */}
                <span
                  className={`truncate transition-all duration-300 ease-out ${
                    isActive ? 'font-medium' : ''
                  } ${isSub ? 'text-[0.78rem]' : ''}`}
                >
                  {h.text}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

/** Desktop sticky sidebar TOC (dot-spine style) */
export function TableOfContents({ headings, activeId }: TableOfContentsProps) {
  if (headings.length === 0) return null;

  return (
    <div className="sticky top-24 max-h-[calc(100vh-8rem)] overflow-y-auto pr-4">
      <p
        className="mb-4 pl-6 text-[0.65rem] font-medium uppercase tracking-[0.2em]"
        style={{ color: 'var(--reader-ink-soft, var(--stone-500))' }}
      >
        Contents
      </p>
      <DotSpineList headings={headings} activeId={activeId} />
    </div>
  );
}

/** Mobile floating TOC button + sheet */
export function MobileTocButton({ headings, activeId }: TableOfContentsProps) {
  const [open, setOpen] = useState(false);

  if (headings.length === 0) return null;

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger className="fixed bottom-6 right-6 z-40 flex h-12 w-12 items-center justify-center rounded-full bg-[var(--sage-500)] text-[var(--stone-50)] shadow-lg transition-transform hover:scale-105 lg:hidden">
        <List className="h-5 w-5" />
        <span className="sr-only">Table of contents</span>
      </SheetTrigger>
      <SheetContent side="bottom" className="max-h-[70vh] overflow-y-auto rounded-t-2xl p-6">
        <SheetHeader>
          <SheetTitle>Contents</SheetTitle>
        </SheetHeader>
        <div className="mt-2">
          <DotSpineList headings={headings} activeId={activeId} onItemClick={() => setOpen(false)} />
        </div>
      </SheetContent>
    </Sheet>
  );
}
