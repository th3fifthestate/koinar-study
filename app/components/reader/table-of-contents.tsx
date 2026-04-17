'use client';

import { useState } from 'react';
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

function TocList({ headings, activeId, onItemClick }: TableOfContentsProps & { onItemClick?: () => void }) {
  return (
    <nav aria-label="Table of contents">
      <ul className="space-y-1">
        {headings.map((h) => {
          const indent = h.level === 3 ? 'pl-4' : h.level === 4 ? 'pl-8' : '';
          const isActive = h.id === activeId;

          return (
            <li key={h.id}>
              <button
                onClick={() => {
                  document.getElementById(h.id)?.scrollIntoView({ behavior: 'smooth' });
                  onItemClick?.();
                }}
                className={`relative block w-full truncate rounded px-2 py-1 text-left text-sm transition-all duration-300 ease-out ${indent} ${
                  isActive
                    ? 'font-medium text-[var(--sage-500)] translate-x-0.5'
                    : 'text-[var(--stone-300)] hover:text-[var(--stone-700)] dark:hover:text-[var(--stone-200)]'
                }`}
              >
                <span
                  aria-hidden="true"
                  className={`pointer-events-none absolute left-0 top-1/2 h-4 w-[2px] -translate-y-1/2 rounded-full bg-[var(--sage-500)] transition-all duration-300 ease-out ${
                    isActive ? 'opacity-100 scale-y-100' : 'opacity-0 scale-y-50'
                  }`}
                />
                {h.text}
              </button>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

/** Desktop sticky sidebar TOC */
export function TableOfContents({ headings, activeId }: TableOfContentsProps) {
  if (headings.length === 0) return null;

  return (
    <div className="sticky top-24 max-h-[calc(100vh-8rem)] overflow-y-auto pr-4">
      <p className="mb-3 text-xs font-medium uppercase tracking-wider text-[var(--stone-300)]">
        Contents
      </p>
      <TocList headings={headings} activeId={activeId} />
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
          <TocList headings={headings} activeId={activeId} onItemClick={() => setOpen(false)} />
        </div>
      </SheetContent>
    </Sheet>
  );
}
