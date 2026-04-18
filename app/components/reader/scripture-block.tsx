import type { ReactNode } from 'react';

/**
 * Scripture blockquote with marginalia behavior on wide viewports.
 *
 * ─ Narrow (< xl): inline panel with a sage left rule, subtle tinted
 *   paper-deep fill, rounded right side. Reads as a quiet pull-in
 *   beside the body copy.
 *
 * ─ Wide (xl+): floats into the right gutter. Negative right margin
 *   pulls it past the reading-column edge so it sits in the space
 *   between `article.max-w-[95ch]` and the outer `max-w-7xl` frame.
 *   Rule switches from a heavy left bar to a thin top hairline — a
 *   classic marginalia treatment (Tuttle / Rumpus / NYT Reader).
 *   Text wraps naturally around the float.
 *
 * Uses reader palette vars so it shifts with TOD + dark mode.
 */
export function ScriptureBlock({ children }: { children: ReactNode }) {
  return (
    <blockquote
      className={[
        // Base (narrow) — inline tinted panel
        'my-6 rounded-r-lg border-l-4 px-6 py-4',
        'bg-[color-mix(in_oklab,var(--reader-paper-deep)_55%,transparent)]',
        // Wide — marginalia float into the right gutter
        'xl:float-right xl:clear-right xl:my-3 xl:ml-8',
        'xl:w-52 xl:-mr-[13rem]',
        'xl:rounded-none xl:border-l-0 xl:border-t xl:pt-4 xl:pb-0 xl:pl-0 xl:pr-0',
        'xl:bg-transparent',
      ].join(' ')}
      style={{
        borderColor: 'var(--reader-accent-sage, #8fa685)',
      }}
    >
      <div
        className="font-display italic leading-relaxed text-lg xl:text-[0.95rem] xl:leading-[1.55]"
        style={{ color: 'var(--reader-ink, inherit)' }}
      >
        {children}
      </div>
    </blockquote>
  );
}
