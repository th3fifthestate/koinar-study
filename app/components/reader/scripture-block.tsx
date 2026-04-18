import type { ReactNode } from 'react';

function extractTextContent(children: ReactNode): string {
  if (typeof children === 'string') return children;
  if (typeof children === 'number') return String(children);
  if (Array.isArray(children)) return children.map(extractTextContent).join('');
  if (children && typeof children === 'object' && 'props' in children) {
    return extractTextContent((children as { props: { children?: ReactNode } }).props.children);
  }
  return '';
}

export function ScriptureBlock({ children }: { children: ReactNode }) {
  return (
    <blockquote className="my-6 rounded-r-lg border-l-4 border-[var(--sage-300)] bg-[#e8ede6]/50 px-6 py-4 dark:bg-[#2a3527]/30">
      <div className="font-display text-lg italic leading-relaxed text-foreground/90">
        {children}
      </div>
    </blockquote>
  );
}
