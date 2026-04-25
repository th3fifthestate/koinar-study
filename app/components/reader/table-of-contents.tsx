'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { List } from 'lucide-react';
import {
  Sheet,
  SheetTrigger,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import {
  READER_TRANSITION_TOC_GLIDE,
  READER_TRANSITION_TOC_FADEIN,
} from '@/lib/motion/reader';

export interface HeadingItem {
  id: string;
  text: string;
  level: number;
}

interface TableOfContentsProps {
  headings: HeadingItem[];
  activeId: string;
}

/** Size (px) of the glider dot — matches h2 active dot size */
const GLIDER_SIZE = 7;

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
    const found = Array.from(
      document.querySelectorAll('main h1, main h2, main h3, main h4, [data-reader-surface] h1, [data-reader-surface] h2, [data-reader-surface] h3, [data-reader-surface] h4'),
    ).find((el) => el.textContent?.trim() === needle);
    found?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, []);
}

/** Returns true when the user prefers reduced motion */
function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(() => {
    if (typeof window === 'undefined') return false;
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  });

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    const handler = (e: MediaQueryListEvent) => setReduced(e.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);

  return reduced;
}

function DotSpineList({
  headings,
  activeId,
  onItemClick,
  disableGlider = false,
}: TableOfContentsProps & { onItemClick?: () => void; disableGlider?: boolean }) {
  const scrollToHeading = useHeadingScroll();
  const reducedMotion = useReducedMotion();

  const ulRef = useRef<HTMLUListElement>(null);
  const [activeOffset, setActiveOffset] = useState(0);
  const [hasPositioned, setHasPositioned] = useState(false);

  // Compute glider position whenever activeId or headings change
  useEffect(() => {
    if (disableGlider || !activeId || !ulRef.current) return;
    const items = ulRef.current.querySelectorAll('li');
    const activeIndex = headings.findIndex((h) => h.id === activeId);
    if (activeIndex === -1) return;
    const item = items[activeIndex];
    if (!item) return;
    const offset = item.offsetTop + item.offsetHeight / 2 - GLIDER_SIZE / 2;
    if (!hasPositioned) {
      // First position: jump without transition, then fade in
      setActiveOffset(offset);
      requestAnimationFrame(() => setHasPositioned(true));
    } else {
      setActiveOffset(offset);
    }
  }, [activeId, headings, hasPositioned, disableGlider]);

  // Recompute on resize (e.g. font size change)
  useEffect(() => {
    if (disableGlider || !ulRef.current) return;
    const el = ulRef.current;
    const observer = new ResizeObserver(() => {
      if (!activeId) return;
      const items = el.querySelectorAll('li');
      const activeIndex = headings.findIndex((h) => h.id === activeId);
      if (activeIndex === -1) return;
      const item = items[activeIndex];
      if (!item) return;
      setActiveOffset(item.offsetTop + item.offsetHeight / 2 - GLIDER_SIZE / 2);
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, [activeId, headings, disableGlider]);

  // Glider transition: fade-in only on first mount, then transform-only
  const gliderTransition = reducedMotion
    ? READER_TRANSITION_TOC_FADEIN // only fade, no transform motion
    : hasPositioned
      ? READER_TRANSITION_TOC_GLIDE
      : READER_TRANSITION_TOC_FADEIN;

  return (
    <nav aria-label="Table of contents" className="relative">
      {/* Spine rail */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute left-[5px] top-2 bottom-2 w-px"
        style={{ backgroundColor: 'var(--bed-toc-rule, var(--stone-200))' }}
      />

      <ul ref={ulRef} className="relative space-y-2">
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
                    ? 'var(--stone-700)'
                    : 'var(--stone-500)',
                }}
              >
                {/* Rail marker dot — hollow, always visible at low opacity.
                    When glider is active: hide the marker under the glider.
                    When glider is disabled (mobile): use the old filled-dot behavior. */}
                <span
                  aria-hidden="true"
                  data-toc-active={disableGlider && isActive ? 'true' : undefined}
                  className="absolute top-1/2 -translate-y-1/2 rounded-full transition-all duration-300 ease-out"
                  style={{
                    left: `${dotOffset}px`,
                    width: `${dotSize}px`,
                    height: `${dotSize}px`,
                    backgroundColor: disableGlider
                      ? isActive
                        ? 'var(--reader-accent, var(--sage-500))'
                        : 'transparent'
                      : 'transparent',
                    border: disableGlider
                      ? isActive
                        ? 'none'
                        : `1px solid var(--stone-400)`
                      : `1px solid var(--stone-400)`,
                    opacity: disableGlider
                      ? isActive ? 1 : 0.55
                      : 0.4,
                    transform: disableGlider
                      ? `translateY(-50%) scale(${isActive ? 1.1 : 1})`
                      : 'translateY(-50%)',
                    boxShadow: disableGlider && isActive
                      ? '0 0 0 5px rgba(107, 128, 96, 0.10)'
                      : undefined,
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

        {/* Single gliding indicator — only rendered when glider is enabled */}
        {!disableGlider && (
          <div
            aria-hidden="true"
            data-toc-active="true"
            className="pointer-events-none absolute"
            style={{
              left: '2px',
              width: `${GLIDER_SIZE}px`,
              height: `${GLIDER_SIZE}px`,
              borderRadius: '50%',
              backgroundColor: 'var(--reader-accent, var(--sage-500))',
              boxShadow: '0 0 0 5px rgba(107, 128, 96, 0.10)',
              top: 0,
              transform: `translateY(${activeOffset}px)`,
              transition: gliderTransition,
              opacity: hasPositioned ? 1 : 0,
            }}
          />
        )}
      </ul>
    </nav>
  );
}

/** Desktop sticky sidebar TOC (dot-spine style) */
export function TableOfContents({ headings, activeId }: TableOfContentsProps) {
  if (headings.length === 0) return null;

  return (
    <div
      className="sticky top-0 h-screen w-60 overflow-y-auto border-r px-6 py-8"
      style={{
        backgroundColor: 'var(--bed-toc, var(--stone-100))',
        borderColor: 'var(--bed-toc-rule, var(--stone-200))',
      }}
    >
      <p
        className="mb-4 pl-6 text-[0.65rem] font-medium uppercase tracking-[0.2em]"
        style={{ color: 'var(--stone-500)' }}
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
          <DotSpineList
            headings={headings}
            activeId={activeId}
            onItemClick={() => setOpen(false)}
            disableGlider={true}
          />
        </div>
      </SheetContent>
    </Sheet>
  );
}
