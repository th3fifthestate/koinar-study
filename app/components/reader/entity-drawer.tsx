'use client';

import { useEffect, useState, useMemo, useCallback } from 'react';
import { MarkdownHooks } from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import {
  Sheet,
  SheetOverlay,
  SheetPortal,
  SheetTitle,
} from '@/components/ui/sheet';
import { Dialog as SheetPrimitive } from '@base-ui/react/dialog';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';
import {
  User, MapPin, Globe, Clock, Lightbulb, Tag,
  ChevronRight, ChevronDown, ChevronUp, ExternalLink,
} from 'lucide-react';
import { useEntityLayer } from './entity-layer-context';
import type { EntityDetail, EntityCitation, EntityVerseRef } from '@/lib/db/types';

const TYPE_ICONS = {
  person: User,
  place: MapPin,
  culture: Globe,
  time_period: Clock,
  concept: Lightbulb,
  custom: Tag,
} as const;

// ─── Breadcrumbs ─────────────────────────────────────────────────────────────

function EntityBreadcrumbs({
  studyTitle,
  stack,
  names,
  onNavigate,
  onClose,
}: {
  studyTitle: string;
  stack: string[];
  names: Map<string, string>;
  onNavigate: (index: number) => void;
  onClose: () => void;
}) {
  return (
    <nav aria-label="Entity navigation" className="flex flex-wrap items-center gap-1 text-sm">
      <button
        onClick={onClose}
        className="truncate text-muted-foreground transition-colors hover:text-foreground"
      >
        Study: {studyTitle}
      </button>
      {stack.map((id, i) => (
        <span key={id + i} className="flex items-center gap-1">
          <ChevronRight className="h-3 w-3 text-muted-foreground/50" />
          {i === stack.length - 1 ? (
            <span className="font-medium text-foreground truncate max-w-[140px]">
              {names.get(id) || id}
            </span>
          ) : (
            <button
              onClick={() => onNavigate(i)}
              className="truncate max-w-[100px] text-muted-foreground transition-colors hover:text-foreground"
            >
              {names.get(id) || id}
            </button>
          )}
        </span>
      ))}
    </nav>
  );
}

// ─── Related Entity Card ─────────────────────────────────────────────────────

function RelatedEntityCard({
  name,
  entityType,
  relationshipLabel,
  quickGlance,
  onClick,
}: {
  name: string;
  entityType: string;
  relationshipLabel: string;
  quickGlance?: string | null;
  onClick: () => void;
}) {
  const Icon = TYPE_ICONS[entityType as keyof typeof TYPE_ICONS] || Tag;

  return (
    <button
      onClick={onClick}
      className="w-full rounded-lg border border-[var(--stone-200)] p-3 text-left transition-colors hover:border-[var(--sage-300)] hover:bg-[var(--stone-50)] dark:border-[var(--stone-700)] dark:hover:border-[var(--sage-500)] dark:hover:bg-[var(--stone-900)]"
    >
      <div className="flex items-center gap-2">
        <Icon className="h-3.5 w-3.5 text-muted-foreground" />
        <span className="font-display text-sm font-medium">{name}</span>
      </div>
      <p className="mt-0.5 text-xs text-muted-foreground">{relationshipLabel}</p>
      {quickGlance && (
        <p className="mt-1 line-clamp-1 text-xs text-muted-foreground/70">
          {quickGlance}
        </p>
      )}
    </button>
  );
}

// ─── Sources Section ─────────────────────────────────────────────────────────

function SourcesSection({ citations }: { citations: EntityCitation[] }) {
  const [expanded, setExpanded] = useState(false);

  if (citations.length === 0) return null;

  return (
    <div>
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex w-full items-center gap-2 text-sm font-medium text-foreground"
      >
        {expanded ? (
          <ChevronUp className="h-3.5 w-3.5" />
        ) : (
          <ChevronDown className="h-3.5 w-3.5" />
        )}
        Sources ({citations.length})
      </button>
      {expanded && (
        <ul className="mt-2 space-y-1.5 pl-5">
          {citations.map((c) => (
            <li key={c.id} className="text-xs text-muted-foreground">
              <span className="font-medium">{c.source_name}</span>
              {c.source_ref && <span> — {c.source_ref}</span>}
              {c.source_url && (
                <a
                  href={c.source_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="ml-1 inline-flex items-center gap-0.5 text-[var(--sage-500)] hover:text-[var(--sage-700)]"
                >
                  <ExternalLink className="h-2.5 w-2.5" />
                </a>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// ─── Verse References Section ────────────────────────────────────────────────

function VerseRefsSection({ verseRefs }: { verseRefs: EntityVerseRef[] }) {
  const [showAll, setShowAll] = useState(false);

  if (verseRefs.length === 0) return null;

  const displayed = showAll ? verseRefs : verseRefs.slice(0, 10);

  return (
    <div>
      <h4 className="text-sm font-medium text-foreground">Appears in</h4>
      <div className="mt-2 flex flex-wrap gap-1.5">
        {displayed.map((ref) => {
          const label = `${ref.book} ${ref.chapter}:${ref.verse_start}${
            ref.verse_end && ref.verse_end !== ref.verse_start ? '-' + ref.verse_end : ''
          }`;
          return (
            <span
              key={ref.id}
              className="rounded-full bg-[var(--stone-100)] px-2.5 py-0.5 text-xs text-muted-foreground dark:bg-[var(--stone-900)]"
            >
              {label}
            </span>
          );
        })}
      </div>
      {verseRefs.length > 10 && !showAll && (
        <button
          onClick={() => setShowAll(true)}
          className="mt-2 text-xs text-[var(--sage-500)] hover:text-[var(--sage-700)]"
        >
          Show all {verseRefs.length} references
        </button>
      )}
    </div>
  );
}

// ─── Drawer Content (per entity) ─────────────────────────────────────────────

function DrawerEntityContent({
  entityId,
  direction,
}: {
  entityId: string;
  direction: 'forward' | 'back';
}) {
  const {
    getEntityDetail: getCached,
    fetchEntityDetail,
    navigateToEntity,
    entityMap,
  } = useEntityLayer();
  const [detail, setDetail] = useState<EntityDetail | null>(getCached(entityId));
  const [loading, setLoading] = useState(!detail);
  const reducedMotion = useReducedMotion();

  useEffect(() => {
    if (detail) return;
    let cancelled = false;
    setLoading(true);
    fetchEntityDetail(entityId).then((d) => {
      if (!cancelled) {
        setDetail(d);
        setLoading(false);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [entityId, detail, fetchEntityDetail]);

  const slideVariants = reducedMotion
    ? { initial: { opacity: 0 }, animate: { opacity: 1 }, exit: { opacity: 0 } }
    : {
        initial: { x: direction === 'forward' ? 80 : -80, opacity: 0 },
        animate: { x: 0, opacity: 1 },
        exit: { x: direction === 'forward' ? -80 : 80, opacity: 0 },
      };

  if (loading) {
    return (
      <div className="space-y-4 p-1">
        <Skeleton className="h-6 w-48" />
        <Skeleton className="h-4 w-32" />
        <Skeleton className="h-20 w-full" />
        <Skeleton className="h-20 w-full" />
      </div>
    );
  }

  if (!detail) {
    return (
      <p className="p-4 text-sm italic text-muted-foreground">
        Entity details could not be loaded.
      </p>
    );
  }

  const Icon = TYPE_ICONS[detail.entity_type as keyof typeof TYPE_ICONS] || Tag;
  const hasOriginalNames = detail.hebrew_name || detail.greek_name;
  const relationships = detail.relationships || [];

  return (
    <motion.div
      key={entityId}
      variants={slideVariants}
      initial="initial"
      animate="animate"
      exit="exit"
      transition={{ duration: 0.25, ease: 'easeInOut' }}
      className="space-y-5"
    >
      {/* Header */}
      <div>
        <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-muted-foreground">
          <Icon className="h-3 w-3" />
          <span>{detail.entity_type.replace('_', ' ')}</span>
        </div>
        <h2 className="mt-1 font-display text-xl font-normal text-foreground">
          {detail.canonical_name}
        </h2>
        {hasOriginalNames && (
          <p className="mt-1 text-sm text-muted-foreground">
            {[detail.hebrew_name, detail.greek_name].filter(Boolean).join('  •  ')}
          </p>
        )}
        {detail.date_range && (
          <p className="mt-0.5 text-xs text-muted-foreground">{detail.date_range}</p>
        )}
        {detail.disambiguation_note && (
          <p className="mt-1 text-xs italic text-muted-foreground">
            {detail.disambiguation_note}
          </p>
        )}
      </div>

      {/* Tabs */}
      <Tabs defaultValue="summary">
        <TabsList variant="line">
          <TabsTrigger value="summary">Summary</TabsTrigger>
          <TabsTrigger value="full_profile">Full Profile</TabsTrigger>
        </TabsList>
        <TabsContent value="summary" className="mt-3">
          {detail.summary ? (
            <div className="prose-entity font-body text-sm leading-relaxed text-foreground/90">
              <MarkdownHooks remarkPlugins={[remarkGfm]}>
                {detail.summary}
              </MarkdownHooks>
            </div>
          ) : (
            <p className="text-sm italic text-muted-foreground">No summary available.</p>
          )}
        </TabsContent>
        <TabsContent value="full_profile" className="mt-3">
          {detail.full_profile ? (
            <div className="prose-entity font-body text-sm leading-relaxed text-foreground/90">
              <MarkdownHooks remarkPlugins={[remarkGfm]}>
                {detail.full_profile}
              </MarkdownHooks>
            </div>
          ) : (
            <p className="text-sm italic text-muted-foreground">
              No full profile available.
            </p>
          )}
        </TabsContent>
      </Tabs>

      {/* Related Entities */}
      {relationships.length > 0 && (
        <div>
          <h4 className="mb-2 text-sm font-medium text-foreground">Related</h4>
          <div className="space-y-2">
            {relationships.map((rel) => {
              const relatedId =
                rel.from_entity_id === entityId ? rel.to_entity_id : rel.from_entity_id;
              const relatedEntity = entityMap.get(relatedId);
              return (
                <RelatedEntityCard
                  key={rel.id}
                  name={rel.related_entity_name}
                  entityType={rel.related_entity_type}
                  relationshipLabel={rel.relationship_label}
                  quickGlance={relatedEntity?.quick_glance}
                  onClick={() => navigateToEntity(relatedId)}
                />
              );
            })}
          </div>
        </div>
      )}

      {/* Sources */}
      <SourcesSection citations={detail.citations || []} />

      {/* Verse References */}
      <VerseRefsSection verseRefs={detail.verse_refs || []} />
    </motion.div>
  );
}

// ─── Main Drawer ─────────────────────────────────────────────────────────────

export function EntityDrawer({ studyTitle }: { studyTitle: string }) {
  const { drawerOpen, entityStack, closeDrawer, navigateBack, entityMap } =
    useEntityLayer();

  const [direction, setDirection] = useState<'forward' | 'back'>('forward');
  const [prevStackLength, setPrevStackLength] = useState(0);

  useEffect(() => {
    if (entityStack.length > prevStackLength) setDirection('forward');
    else if (entityStack.length < prevStackLength) setDirection('back');
    setPrevStackLength(entityStack.length);
  }, [entityStack.length, prevStackLength]);

  const currentEntityId = entityStack[entityStack.length - 1] ?? null;

  const nameMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const id of entityStack) {
      const entity = entityMap.get(id);
      if (entity) map.set(id, entity.canonical_name);
    }
    return map;
  }, [entityStack, entityMap]);

  const handleOpenChange = useCallback(
    (open: boolean) => {
      if (!open) closeDrawer();
    },
    [closeDrawer]
  );

  return (
    <Sheet open={drawerOpen} onOpenChange={handleOpenChange}>
      <SheetPortal>
        <SheetOverlay className="bg-black/5 backdrop-blur-none dark:bg-white/5" />
        <SheetPrimitive.Popup
          data-slot="sheet-content"
          data-side="right"
          className="fixed inset-y-0 right-0 z-50 flex h-full w-full flex-col border-l bg-popover text-sm text-popover-foreground shadow-lg transition duration-200 ease-in-out data-ending-style:translate-x-[2.5rem] data-ending-style:opacity-0 data-starting-style:translate-x-[2.5rem] data-starting-style:opacity-0 sm:max-w-md"
        >
          <SheetTitle className="sr-only">Entity Details</SheetTitle>

          {/* Breadcrumbs */}
          <div className="border-b border-[var(--stone-200)] px-5 py-3 dark:border-[var(--stone-700)]">
            <EntityBreadcrumbs
              studyTitle={studyTitle}
              stack={entityStack}
              names={nameMap}
              onNavigate={(i) => navigateBack(i)}
              onClose={closeDrawer}
            />
          </div>

          {/* Scrollable content */}
          <div className="flex-1 overflow-y-auto px-5 py-4">
            <AnimatePresence mode="wait">
              {currentEntityId && (
                <DrawerEntityContent
                  key={currentEntityId}
                  entityId={currentEntityId}
                  direction={direction}
                />
              )}
            </AnimatePresence>
          </div>
        </SheetPrimitive.Popup>
      </SheetPortal>
    </Sheet>
  );
}
