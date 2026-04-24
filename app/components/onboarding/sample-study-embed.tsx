"use client";
import { useRef, useCallback } from 'react';
import ReactMarkdown from 'react-markdown';
import { SAMPLE_STUDY_MARKDOWN } from '@/lib/data/sample-study';

interface SampleStudyEmbedProps {
  markdown?: string;
  onScroll?: () => void;
}

export function SampleStudyEmbed({ markdown, onScroll }: SampleStudyEmbedProps) {
  const hasTriggered = useRef(false);

  const handleScroll = useCallback(() => {
    if (!hasTriggered.current) {
      hasTriggered.current = true;
      onScroll?.();
    }
  }, [onScroll]);

  return (
    <div
      onScroll={handleScroll}
      className="mx-auto max-h-[400px] max-w-lg overflow-y-auto rounded-xl border bg-card p-6 text-left shadow-lg"
    >
      <div className="prose prose-sm dark:prose-invert max-w-none">
        <ReactMarkdown
          components={{
            blockquote: ({ children }) => (
              <blockquote className="border-l-4 border-[var(--sage-300)] bg-[var(--secondary)]/50 py-3 px-4 rounded-r-lg not-italic font-serif">
                {children}
              </blockquote>
            ),
            p: ({ children }) => {
              if (typeof children === 'string' && children.startsWith('\u26F0\uFE0F')) {
                return (
                  <div className="rounded-lg border border-[var(--warmth)]/50 bg-gradient-to-r from-[var(--secondary)]/80 to-[var(--border)]/40 dark:from-[var(--secondary)]/30 dark:to-[var(--card)]/20 p-3 my-3 text-sm">
                    <div className="flex items-start gap-2">
                      <span className="text-base leading-none mt-0.5">{'\u26F0\uFE0F'}</span>
                      <div className="flex-1 text-[var(--sage-700)] dark:text-[var(--sage-300)]">{children}</div>
                    </div>
                    <p className="mt-1.5 text-[10px] text-[var(--stone-700)]/70 dark:text-[var(--stone-300)]/50 italic">
                      Historical context — not sourced from biblical databases
                    </p>
                  </div>
                );
              }
              return <p>{children}</p>;
            },
            strong: ({ children }) => {
              const text = typeof children === 'string' ? children : '';
              if (/[GH]\d{3,5}/.test(text)) {
                return (
                  <span className="inline rounded bg-sky-50 dark:bg-sky-950/30 px-1 py-0.5 font-semibold text-sky-900 dark:text-sky-200 border border-sky-200/50 dark:border-sky-800/50 text-xs">
                    {children}
                  </span>
                );
              }
              return <strong>{children}</strong>;
            },
          }}
        >
          {markdown ?? SAMPLE_STUDY_MARKDOWN}
        </ReactMarkdown>
      </div>
    </div>
  );
}
