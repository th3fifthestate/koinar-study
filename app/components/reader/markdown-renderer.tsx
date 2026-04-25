'use client';

import { createContext, useContext, useMemo, useRef, type ReactNode, type ComponentType } from 'react';
import { MarkdownHooks } from 'react-markdown';
import remarkGfm from 'remark-gfm';
import type { StudyImage } from '@/lib/db/types';
import { ScriptureBlock } from './scripture-block';
import { HistoricalContext } from './historical-context';
import { OriginalLanguage } from './original-language';
import { CrossRefTooltip } from './cross-ref-tooltip';
import { ImageSection } from './image-section';
import { useEntityLayerOptional } from './entity-layer-context';
import { EntityTerm } from './entity-term';

type FontSize = 'small' | 'medium' | 'large';

interface MarkdownRendererProps {
  content: string;
  images: StudyImage[];
  fontSize: FontSize;
  /**
   * Prefix applied to every heading id. When the same renderer is used
   * across multiple bed-stacked sections (each with its own MarkdownRenderer
   * instance), each bed needs a different prefix so duplicate H3 names
   * (Text, Historical Context, etc.) don't collide on the rendered DOM.
   * Format: `${prefix}--${slug}`.
   */
  idPrefix?: string;
}

const FONT_SIZE_CLASSES: Record<FontSize, string> = {
  small: 'text-base',
  medium: 'text-lg',
  large: 'text-xl',
};

// ─── Blockquote nesting context ───────────────────────────────────────────────
// True when the current subtree is rendered inside a <blockquote>. Used to
// skip entity-annotation wrapping in scripture blockquotes — the LLM is told
// (system-prompt rule 5) not to annotate references inside blockquotes, and
// the global surface-form regex would otherwise spread prose annotations into
// blockquote text (the "Simon Peter" appearing as "Simon the tanner" bug).
const InsideBlockquoteContext = createContext(false);

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

function stripLeadingMountain(children: ReactNode): ReactNode {
  if (typeof children === 'string') {
    return children.replace(/^\s*⛰️?\s*/, '');
  }
  if (Array.isArray(children)) {
    const result = [...children];
    for (let i = 0; i < result.length; i++) {
      if (typeof result[i] === 'string') {
        result[i] = (result[i] as string).replace(/^\s*⛰️?\s*/, '');
        break;
      }
    }
    return result;
  }
  return children;
}

function createSlugify(prefix?: string) {
  const counters = new Map<string, number>();
  const pfx = prefix ? `${prefix}--` : '';
  return {
    slugify(children: ReactNode): string {
      const text = extractTextContent(children);
      const base = text
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/(^-|-$)/g, '');

      const count = counters.get(base) ?? 0;
      counters.set(base, count + 1);
      const suffixed = count === 0 ? base : `${base}-${count}`;
      return `${pfx}${suffixed}`;
    },
    reset() {
      counters.clear();
    },
  };
}

function isOriginalLanguage(text: string): boolean {
  return /[GH]\d{1,5}/.test(text) || /[\u0370-\u03FF\u0590-\u05FF]/.test(text);
}

/** Wrap verse reference patterns in a plain text string */
function wrapCrossReferences(text: string): ReactNode {
  const pattern = /\b(\d?\s?[A-Z][a-z]+(?:\s[A-Z][a-z]+)*)\s+(\d+):(\d+(?:-\d+)?)\b/g;
  const parts: ReactNode[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(text)) !== null) {
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

/** Recursively walk React children tree and wrap verse references in text nodes */
function wrapCrossReferencesInChildren(children: ReactNode): ReactNode {
  if (typeof children === 'string') {
    return wrapCrossReferences(children);
  }
  if (typeof children === 'number') {
    return wrapCrossReferences(String(children));
  }
  if (Array.isArray(children)) {
    return children.map((child, i) => {
      const wrapped = wrapCrossReferencesInChildren(child);
      if (Array.isArray(wrapped)) {
        return <span key={i}>{wrapped}</span>;
      }
      return wrapped;
    });
  }
  return children;
}

/** Wrap entity terms in a plain text string */
function wrapEntityTerms(
  text: string,
  regex: RegExp,
  lookup: Map<string, string>,
): ReactNode {
  // Clone regex to avoid shared lastIndex mutation across concurrent renders
  const rx = new RegExp(regex.source, regex.flags);
  const parts: ReactNode[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = rx.exec(text)) !== null) {
    const surface = match[0];
    const entityId = lookup.get(surface.toLowerCase());
    if (!entityId) continue;

    if (match.index > lastIndex) {
      parts.push(text.slice(lastIndex, match.index));
    }
    parts.push(
      <EntityTerm key={`${entityId}-${match.index}`} entityId={entityId}>
        {surface}
      </EntityTerm>
    );
    lastIndex = match.index + surface.length;
  }

  if (parts.length === 0) return text;
  if (lastIndex < text.length) parts.push(text.slice(lastIndex));
  return parts;
}

/** Recursively walk React children and wrap entity terms in text nodes */
function wrapEntityTermsInChildren(
  children: ReactNode,
  regex: RegExp,
  lookup: Map<string, string>,
): ReactNode {
  if (typeof children === 'string') {
    return wrapEntityTerms(children, regex, lookup);
  }
  if (typeof children === 'number') {
    return wrapEntityTerms(String(children), regex, lookup);
  }
  if (Array.isArray(children)) {
    return children.map((child, i) => {
      const wrapped = wrapEntityTermsInChildren(child, regex, lookup);
      if (Array.isArray(wrapped)) return <span key={i}>{wrapped}</span>;
      return wrapped;
    });
  }
  return children;
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

// ─── Component ────────────────────────────────────────────────────────────────

export function MarkdownRenderer({ content, images, fontSize, idPrefix }: MarkdownRendererProps) {
  const sections = useMemo(() => buildSections(content, images), [content, images]);

  // Instance-scoped state — safe across concurrent SSR renders
  const slugRef = useRef(createSlugify(idPrefix));
  const crossRefSectionRef = useRef(false);
  const historicalContextSectionRef = useRef<boolean>(false);
  const entityCtx = useEntityLayerOptional();

  const components = useMemo(() => {
    const { slugify } = slugRef.current;
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
        // When the renderer is invoked with an idPrefix (i.e., inside a Bed),
        // the parent <section id={section.slug}> already provides the anchor
        // for TOC navigation. Skipping the H2 id here avoids two-anchor
        // collisions on the same target. Without idPrefix (standalone use)
        // the H2 self-anchors via slugify. The H3/H4 counter map only tracks
        // H3/H4 slugs, so skipping the H2 doesn't disturb sibling counters.
        const id = idPrefix ? undefined : slugify(children);
        const text = extractTextContent(children);
        crossRefSectionRef.current = /cross.?ref/i.test(text);
        historicalContextSectionRef.current = /historical\s*context/i.test(text);
        return (
          <h2
            id={id}
            className="font-display scroll-mt-24 mt-16 mb-9 text-[clamp(2.6rem,5vw,4.4rem)] font-bold uppercase leading-[0.98] tracking-[-0.005em] text-[var(--stone-900)] dark:text-[var(--stone-100)]"
            style={{ fontFeatureSettings: '"case" on, "dlig" on, "liga" on, "lnum" on' }}
            {...props}
          >
            {children}
          </h2>
        );
      },
      h3: ({ children, node, ...props }: MdProps) => {
        const id = slugify(children);
        const text = extractTextContent(children);
        crossRefSectionRef.current = /cross.?ref/i.test(text);
        historicalContextSectionRef.current = /historical\s*context/i.test(text);
        return (
          <h3
            id={id}
            className="font-display scroll-mt-24 mt-16 mb-3 text-[1.5rem] italic font-medium leading-[1.2] tracking-[-0.005em] text-[var(--stone-900)] dark:text-[var(--stone-100)]"
            style={{ fontFeatureSettings: '"dlig" on, "liga" on' }}
            {...props}
          >
            {children}
            <span
              aria-hidden="true"
              className="mt-3.5 mb-5 block h-px w-9"
              style={{ background: 'var(--reader-accent)' }}
            />
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
        <ScriptureBlock>
          <InsideBlockquoteContext.Provider value={true}>
            {children}
          </InsideBlockquoteContext.Provider>
        </ScriptureBlock>
      ),
      p: ({ children, node, ...props }: MdProps) => {
        const text = extractTextContent(children);
        if (text.startsWith('\u26f0\ufe0f')) {
          return <HistoricalContext>{children}</HistoricalContext>;
        }

        // eslint-disable-next-line react-hooks/rules-of-hooks
        const insideBlockquote = useContext(InsideBlockquoteContext);

        let processedChildren = children;

        // Apply entity annotations \u2014 but NOT inside blockquotes. The LLM is
        // told (system-prompt rule 5) not to annotate references inside
        // scripture blockquotes, and the global surface-form regex would
        // otherwise spread prose annotations into blockquote text.
        if (entityCtx?.showAnnotations && entityCtx.annotationRegex && !insideBlockquote) {
          processedChildren = wrapEntityTermsInChildren(
            processedChildren,
            entityCtx.annotationRegex,
            entityCtx.annotationLookup,
          );
        }

        // In cross-reference sections, wrap verse references
        if (crossRefSectionRef.current) {
          processedChildren = wrapCrossReferencesInChildren(processedChildren);
        }

        return <p className="mb-4 leading-relaxed" {...props}>{processedChildren}</p>;
      },
      strong: ({ children, node, ...props }: MdProps) => {
        const text = extractTextContent(children);
        if (isOriginalLanguage(text)) {
          return <OriginalLanguage>{children}</OriginalLanguage>;
        }
        return <strong className="font-semibold" {...props}>{children}</strong>;
      },
      hr: () => <hr className="my-8 border-t border-[var(--stone-200)]/50 dark:border-[var(--stone-700)]/50" />,
      ul: ({ children, node, ...props }: MdProps) => {
        if (historicalContextSectionRef.current) {
          return (
            <div className="historical-context">
              <ul {...props}>{children}</ul>
            </div>
          );
        }
        return (
          <ul className="mb-4 ml-6 list-disc space-y-1" {...props}>
            {children}
          </ul>
        );
      },
      ol: ({ children, node, ...props }: MdProps) => (
        <ol className="mb-4 ml-6 list-decimal space-y-1" {...props}>{children}</ol>
      ),
      li: ({ children, node, ...props }: MdProps) => {
        // eslint-disable-next-line react-hooks/rules-of-hooks
        const insideBlockquote = useContext(InsideBlockquoteContext);
        const text = extractTextContent(children);
        const isOutside = /^\s*⛰/.test(text);

        let processedChildren = children;
        if (entityCtx?.showAnnotations && entityCtx.annotationRegex && !insideBlockquote) {
          processedChildren = wrapEntityTermsInChildren(
            processedChildren,
            entityCtx.annotationRegex,
            entityCtx.annotationLookup,
          );
        }

        // For outside-source items, strip the leading ⛰ glyph (the CSS ::before
        // pseudo will render it) and tag the li so the right CSS rule fires.
        let renderedChildren = processedChildren;
        if (isOutside) {
          renderedChildren = stripLeadingMountain(processedChildren);
        }

        return (
          <li
            className="leading-relaxed"
            data-outside={isOutside ? 'true' : undefined}
            {...props}
          >
            {renderedChildren}
          </li>
        );
      },
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
      td: ({ children, node, ...props }: MdProps) => {
        // eslint-disable-next-line react-hooks/rules-of-hooks
        const insideBlockquote = useContext(InsideBlockquoteContext);
        let processedChildren = children;
        if (entityCtx?.showAnnotations && entityCtx.annotationRegex && !insideBlockquote) {
          processedChildren = wrapEntityTermsInChildren(
            processedChildren,
            entityCtx.annotationRegex,
            entityCtx.annotationLookup,
          );
        }
        return (
          <td className="border border-[var(--stone-200)] px-3 py-2 dark:border-[var(--stone-700)]" {...props}>
            {processedChildren}
          </td>
        );
      },
    } as Record<string, ComponentType<Record<string, unknown>>>;
  }, [entityCtx?.showAnnotations, entityCtx?.annotationRegex, entityCtx?.annotationLookup]);

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

        // Reset instance-scoped state at start of each render pass
        if (i === 0) {
          slugRef.current.reset();
          crossRefSectionRef.current = false;
          historicalContextSectionRef.current = false;
        }

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
