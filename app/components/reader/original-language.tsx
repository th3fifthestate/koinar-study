import type { ReactNode } from 'react';

export function OriginalLanguage({ children }: { children: ReactNode }) {
  return (
    <span className="inline rounded border border-sky-200/50 bg-sky-50 px-1.5 py-0.5 font-semibold text-sky-900 dark:border-sky-800/50 dark:bg-sky-950/30 dark:text-sky-200">
      {children}
    </span>
  );
}
