import type { ReactNode } from 'react';

function stripLeadingEmoji(children: ReactNode): ReactNode {
  if (typeof children === 'string') {
    return children.replace(/^⛰️\s*/, '');
  }
  if (Array.isArray(children)) {
    const result = [...children];
    for (let i = 0; i < result.length; i++) {
      if (typeof result[i] === 'string') {
        result[i] = (result[i] as string).replace(/^⛰️\s*/, '');
        break;
      }
    }
    return result;
  }
  return children;
}

export function HistoricalContext({ children }: { children: ReactNode }) {
  return (
    <div className="my-4 rounded-lg border border-[var(--warmth)]/50 bg-gradient-to-r from-[#e8ede6]/80 to-[#ddd9d0]/40 p-4 dark:border-[var(--warmth)]/30 dark:from-[#2a3527]/30 dark:to-[#3a362f]/20">
      <div className="flex items-start gap-3">
        <span className="mt-0.5 text-lg leading-none" aria-label="Historical context indicator">
          ⛰️
        </span>
        <div className="flex-1 text-sm leading-relaxed text-[var(--sage-700)] dark:text-[var(--sage-300)]">
          {stripLeadingEmoji(children)}
        </div>
      </div>
      <p className="mt-2 text-xs italic text-[var(--stone-700)]/70 dark:text-[var(--stone-300)]/50">
        Historical context — not sourced from biblical databases
      </p>
    </div>
  );
}
