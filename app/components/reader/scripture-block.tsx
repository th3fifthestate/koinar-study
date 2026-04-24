import type { ReactNode } from 'react';

export function ScriptureBlock({ children }: { children: ReactNode }) {
  return (
    <blockquote className="my-6 rounded-r-lg border-l-4 border-[var(--sage-300)] bg-[var(--secondary)]/50 px-6 py-4 dark:bg-[var(--secondary)]/30">
      <div className="font-display text-lg italic leading-relaxed text-foreground/90">
        {children}
      </div>
    </blockquote>
  );
}
