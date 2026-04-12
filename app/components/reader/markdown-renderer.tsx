'use client';

import { useMemo, type ReactNode, type ComponentType } from 'react';
import { MarkdownHooks } from 'react-markdown';
import remarkGfm from 'remark-gfm';
import type { StudyImage } from '@/lib/db/types';
import { ScriptureBlock } from './scripture-block';
import { HistoricalContext } from './historical-context';
import { OriginalLanguage } from './original-language';
import { CrossRefTooltip } from './cross-ref-tooltip';
import { ImageSection } from './image-section';

type FontSize = 'small' | 'medium' | 'large';

interface MarkdownRendererProps {
  content: string;
  images: StudyImage[];
  fontSize: FontSize;
}

const FONT_SIZE_CLASSES: Record<FontSize, string> = {
  small: 'text-base',
  medium: 'text-lg',
  large: 'text-xl',
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function extractTextContent(children: ReactNode): string {
  if (typeof children === 'string') return children;
  if (typeof children === 'number') return String(children);
  if (Array.isArray(children)) return children.map(extractTextContent).join('');
  if (children && typeof children === 'object' && 'props' in children) {
    return extractTextContent((children as { props: { children?: ReactNode } }).props.children);
  }
  return '';
}

const slugCounters = new Map<string, number>();

function slugify(children: ReactNode): string {
  const text = extractTextContent(children);
  const base = text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');

  const count = slugCounters.get(base) ?? 0;
  slugCounters.set(base, count + 1);
  return count === 0 ? base : `${base}-${count}`;
}

function resetSlugCounters() {
  slugCounters.clear();
}

function isOriginalLanguage(text: string): boolean {
  return /[GH]\d{1,5}/.test(text) || /[\u0370-\u03FF\u0590-\u05FF]/.test(text);
}

// Detect verse reference patterns: "John 3:16", "1 Corinthians 2:1-5", etc.
const VERSE_REF_PATTERN = /\b(\d?\s?[A-Z][a-z]+(?:\s[A-Z][a-z]+)*)\s+(\d+):(\d+(?:-\d+)?)\b/g;

function wrapCrossReferences(text: string): ReactNode {
  const parts: ReactNode[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  // Reset regex state
  VERSE_REF_PATTERN.lastIndex = 0;

  while ((match = VERSE_REF_PATTERN.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push(text.slice(lastIndex, match.index));
    }
    const fullRef = match[0];
    parts.push(
      <CrossRefTooltip key={`${fullRef}-${match.index}`} reference={fullRef}>
        {fullRef}
      </CrossRefTooltip>
    );
    lastIndex = match.index + fullRef.length;
  }

  if (lastIndex < text.length) {
    parts.push(text.slice(lastIndex));
  }

  return parts.length > 1 ? parts : text;
}

// ─── Section splitting for image interspersion ────────────────────────────────

interface ContentSection {
  type: 'markdown' | 'image';
  content?: string;
  image?: StudyImage;
  imageIndex?: number;
}

function buildSections(content: string, images: StudyImage[]): ContentSection[] {
  if (images.length === 0) {
    return [{ type: 'markdown', content }];
  }

  // Split at ## boundaries (lines starting with ## )
  const parts = content.split(/(?=^## )/m);
  const sections: ContentSection[] = [];
  let imageIdx = 0;
  const insertEvery = Math.max(2, Math.ceil(parts.length / (images.length + 1)));

  for (let i = 0; i < parts.length; i++) {
    sections.push({ type: 'markdown', content: parts[i] });

    // Insert an image after every `insertEvery` sections
    if ((i + 1) % insertEvery === 0 && imageIdx < images.length) {
      sections.push({
        type: 'image',
        image: images[imageIdx],
        imageIndex: imageIdx,
      });
      imageIdx++;
    }
  }

  return sections;
}

// ─── Cross-reference section detection ────────────────────────────────────────

let inCrossRefSection = false;

// ─── Component ────────────────────────────────────────────────────────────────

export function MarkdownRenderer({ content, images, fontSize }: MarkdownRendererProps) {
  const sections = useMemo(() => buildSections(content, images), [content, images]);

  const components = useMemo(() => {
    // Type helper for react-markdown component props
    type MdProps = { children?: ReactNode; node?: unknown; [key: string]: unknown };

    return {
      h1: ({ children, node, ...props }: MdProps) => {
        const id = slugify(children);
        return (
          <h1 id={id} className="scroll-mt-24 font-display text-4xl font-normal mt-12 mb-6" {...props}>
            {children}
          </h1>
        );
      },
      h2: ({ children, node, ...props }: MdProps) => {
        const id = slugify(children);
        const text = extractTextContent(children);
        inCrossRefSection = /cross.?ref/i.test(text);
        return (
          <h2 id={id} className="scroll-mt-24 font-display text-3xl font-normal mt-10 mb-4 border-b border-[var(--stone-200)] pb-2 dark:border-[var(--stone-700)]" {...props}>
            {children}
          </h2>
        );
      },
      h3: ({ children, node, ...props }: MdProps) => {
        const id = slugify(children);
        const text = extractTextContent(children);
        inCrossRefSection = /cross.?ref/i.test(text);
        return (
          <h3 id={id} className="scroll-mt-24 font-display text-2xl font-normal mt-8 mb-3" {...props}>
            {children}
          </h3>
        );
      },
      h4: ({ children, node, ...props }: MdProps) => {
        const id = slugify(children);
        return (
          <h4 id={id} className="scroll-mt-24 font-display text-xl font-medium mt-6 mb-2" {...props}>
            {children}
          </h4>
        );
      },
      blockquote: ({ children }: MdProps) => (
        <ScriptureBlock>{children}</ScriptureBlock>
      ),
      p: ({ children, node, ...props }: MdProps) => {
        const text = extractTextContent(children);
        if (text.startsWith('\u26f0\ufe0f')) {
          return <HistoricalContext>{children}</HistoricalContext>;
        }
        // In cross-reference sections, wrap verse references
        if (inCrossRefSection && typeof children === 'string') {
          const wrapped = wrapCrossReferences(children);
          if (wrapped !== children) {
            return <p className="mb-4 leading-relaxed" {...props}>{wrapped}</p>;
          }
        }
        return <p className="mb-4 leading-relaxed" {...props}>{children}</p>;
      },
      strong: ({ children, node, ...props }: MdProps) => {
        const text = extractTextContent(children);
        if (isOriginalLanguage(text)) {
          return <OriginalLanguage>{children}</OriginalLanguage>;
        }
        return <strong className="font-semibold" {...props}>{children}</strong>;
      },
      hr: () => <hr className="my-8 border-t border-[var(--stone-200)]/50 dark:border-[var(--stone-700)]/50" />,
      ul: ({ children, node, ...props }: MdProps) => (
        <ul className="mb-4 ml-6 list-disc space-y-1" {...props}>{children}</ul>
      ),
      ol: ({ children, node, ...props }: MdProps) => (
        <ol className="mb-4 ml-6 list-decimal space-y-1" {...props}>{children}</ol>
      ),
      li: ({ children, node, ...props }: MdProps) => (
        <li className="leading-relaxed" {...props}>{children}</li>
      ),
      code: ({ children, node, ...props }: MdProps) => (
        <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-sm" {...props}>
          {children}
        </code>
      ),
      a: ({ children, node, href, ...props }: MdProps & { href?: string }) => (
        <a
          href={href}
          className="text-[var(--sage-500)] underline decoration-[var(--sage-300)] underline-offset-2 transition-colors hover:text-[var(--sage-700)]"
          target="_blank"
          rel="noopener noreferrer"
          {...props}
        >
          {children}
        </a>
      ),
      table: ({ children, node, ...props }: MdProps) => (
        <div className="my-6 overflow-x-auto">
          <table className="w-full border-collapse text-sm" {...props}>{children}</table>
        </div>
      ),
      th: ({ children, node, ...props }: MdProps) => (
        <th className="border border-[var(--stone-200)] bg-[var(--stone-100)] px-3 py-2 text-left font-semibold dark:border-[var(--stone-700)] dark:bg-[var(--stone-900)]" {...props}>
          {children}
        </th>
      ),
      td: ({ children, node, ...props }: MdProps) => (
        <td className="border border-[var(--stone-200)] px-3 py-2 dark:border-[var(--stone-700)]" {...props}>
          {children}
        </td>
      ),
    } as Record<string, ComponentType<Record<string, unknown>>>;
  }, []);

  return (
    <div className={`font-body leading-[1.8] text-foreground/90 ${FONT_SIZE_CLASSES[fontSize]}`}>
      {sections.map((section, i) => {
        if (section.type === 'image' && section.image) {
          return (
            <ImageSection
              key={`img-${section.imageIndex}`}
              imageUrl={section.image.image_url}
              caption={section.image.caption}
              index={section.imageIndex ?? 0}
            />
          );
        }

        // Reset slug counters at start of each render pass
        if (i === 0) resetSlugCounters();
        // Reset cross-ref section tracking at start
        if (i === 0) inCrossRefSection = false;

        return (
          <MarkdownHooks
            key={`md-${i}`}
            remarkPlugins={[remarkGfm]}
            components={components}
          >
            {section.content ?? ''}
          </MarkdownHooks>
        );
      })}
    </div>
  );
}
