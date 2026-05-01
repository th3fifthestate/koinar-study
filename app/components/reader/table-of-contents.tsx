'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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

interface HeadingGroup {
  h2: HeadingItem;
  children: HeadingItem[];
}

/**
 * Group headings so each H2 owns the H3/H4 entries that follow it. The
 * dot-spine and active-state tracking only fire on H2 rows; sub-headings
 * render as a nested list (clickable, but no rail dot or active highlight).
 */
function groupHeadings(headings: HeadingItem[]): HeadingGroup[] {
  const groups: HeadingGroup[] = [];
  let current: HeadingGroup | null = null;
  for (const h of headings) {
    if (h.level <= 2) {
      current = { h2: h, children: [] };
      groups.push(current);
    } else if (current) {
      current.children.push(h);
    } else {
      // H3/H4 before any H2 — surface as its own top-level row.
      current = { h2: h, children: [] };
      groups.push(current);
    }
  }
  return groups;
}

function DotSpineList({
  headings,
  activeId,
  onItemClick,
  disableGlider = false,
}: TableOfContentsProps & { onItemClick?: () => void; disableGlider?: boolean }) {
  const scrollToHeading = useHeadingScroll();
  const reducedMotion = useReducedMotion();

  const groups = useMemo(() => groupHeadings(headings), [headings]);

  const ulRef = useRef<HTMLUListElement>(null);
  const [activeOffset, setActiveOffset] = useState(0);
  const [hasPositioned, setHasPositioned] = useState(false);

  // Compute glider position whenever activeId or groups change. The <li>
  // is positioned (so its offsetTop is relative to the <ul>), while its
  // child <button> reports offsetTop:0 inside that <li>. Center the
  // glider on the button row at the top of the <li>, ignoring the nested
  // sub-list height that the <li> wraps.
  const measureActiveOffset = useCallback((): number | null => {
    if (!ulRef.current || !activeId) return null;
    const items = ulRef.current.querySelectorAll<HTMLLIElement>(':scope > li');
    const activeIndex = groups.findIndex((g) => g.h2.id === activeId);
    if (activeIndex === -1) return null;
    const li = items[activeIndex];
    if (!li) return null;
    const button = li.querySelector<HTMLButtonElement>(':scope > button');
    if (!button) return null;
    return li.offsetTop + button.offsetHeight / 2 - GLIDER_SIZE / 2;
  }, [activeId, groups]);

  useEffect(() => {
    if (disableGlider) return;
    const offset = measureActiveOffset();
    if (offset === null) return;
    if (!hasPositioned) {
      setActiveOffset(offset);
      requestAnimationFrame(() => setHasPositioned(true));
    } else {
      setActiveOffset(offset);
    }
  }, [measureActiveOffset, disableGlider, hasPositioned]);

  // Recompute on resize (e.g. font size change, sub-list height shifts)
  useEffect(() => {
    if (disableGlider || !ulRef.current) return;
    const el = ulRef.current;
    const observer = new ResizeObserver(() => {
      const offset = measureActiveOffset();
      if (offset !== null) setActiveOffset(offset);
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, [measureActiveOffset, disableGlider]);

  // Glider transition: fade-in only on first mount, then transform-only
  const gliderTransition = reducedMotion
    ? READER_TRANSITION_TOC_FADEIN // only fade, no transform motion
    : hasPositioned
      ? READER_TRANSITION_TOC_GLIDE
      : READER_TRANSITION_TOC_FADEIN;

  return (
    <nav aria-label="Table of contents" className="relative">
      {/* Spine rail — sized to the H2 column only; sub-lists indent past it. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute left-[5px] top-2 bottom-2 w-px"
        style={{ backgroundColor: 'var(--bed-toc-rule, var(--stone-200))' }}
      />

      <ul ref={ulRef} className="relative space-y-2">
        {groups.map(({ h2, children }) => {
          const isActive = h2.id === activeId;
          const dotSize = 7;
          const dotOffset = 2;

          return (
            <li key={h2.id} className="group/item relative">
              <button
                type="button"
                onClick={() => {
                  scrollToHeading(h2.id, h2.text);
                  onItemClick?.();
                }}
                className="relative flex w-full cursor-pointer items-center gap-3 pl-6 pr-2 py-1 text-left text-sm transition-all duration-300 ease-out hover:opacity-100"
                style={{
                  color: isActive
                    ? 'var(--stone-700)'
                    : 'var(--stone-500)',
                }}
              >
                {/* Rail marker dot. With the glider the marker is hollow
                    (the glider sits on top); with disableGlider (mobile)
                    we fall back to the filled-dot active state. */}
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

                <span
                  className={`truncate transition-all duration-300 ease-out ${
                    isActive ? 'font-medium' : ''
                  }`}
                >
                  {h2.text}
                </span>
              </button>

              {children.length > 0 && (
                <ul className="ml-6 mt-1 space-y-0.5">
                  {children.map((sub) => {
                    const indent = sub.level >= 4 ? 'pl-3' : '';
                    return (
                      <li key={sub.id}>
                        <button
                          type="button"
                          onClick={() => {
                            scrollToHeading(sub.id, sub.text);
                            onItemClick?.();
                          }}
                          className={`block w-full cursor-pointer truncate py-0.5 pr-2 text-left text-[0.78rem] leading-snug transition-colors duration-200 ease-out hover:text-[var(--stone-700)] ${indent}`}
                          style={{ color: 'var(--stone-500)' }}
                        >
                          {sub.text}
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
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
      className="sticky top-0 h-screen w-60 overflow-y-auto border-r px-6 pt-8 pb-8"
      style={{
        backgroundColor: 'var(--bed-toc, var(--stone-100))',
        borderColor: 'var(--bed-toc-rule, var(--stone-200))',
      }}
    >
      {/* Brand mark — links back to the home library. Sits above the
          Contents label and adds an editorial masthead feel to the reader
          gutter. Visible whenever the TOC is in flow; once the user
          scrolls past the study hero this rail sticks to the top of the
          viewport, so the wordmark naturally takes the upper-left of the
          reading surface. */}
      <Link
        href="/"
        aria-label="Koinar — back to library"
        className="mb-7 block font-display font-medium uppercase text-[var(--stone-900)] dark:text-[var(--stone-50)] hover:text-[var(--reader-accent-deep)] transition-colors"
        style={{
          fontSize: '13px',
          letterSpacing: '0.42em',
          paddingLeft: 'calc(1.5rem + 0.42em)',
          fontVariationSettings: '"opsz" 144',
        }}
      >
        Koinar
      </Link>

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
