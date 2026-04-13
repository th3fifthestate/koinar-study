'use client';

import type { Entity } from '@/lib/db/types';
import { User, MapPin, Globe, Clock, Lightbulb, Tag } from 'lucide-react';

const ENTITY_TYPE_ICONS = {
  person: User,
  place: MapPin,
  culture: Globe,
  time_period: Clock,
  concept: Lightbulb,
  custom: Tag,
} as const;

const ENTITY_TYPE_LABELS = {
  person: 'Person',
  place: 'Place',
  culture: 'Culture',
  time_period: 'Time Period',
  concept: 'Concept',
  custom: 'Reference',
} as const;

interface EntityPopoverProps {
  entity: Entity;
  onExplore: () => void;
}

export function EntityPopover({ entity, onExplore }: EntityPopoverProps) {
  const Icon = ENTITY_TYPE_ICONS[entity.entity_type] || Tag;
  const typeLabel = ENTITY_TYPE_LABELS[entity.entity_type] || 'Reference';

  return (
    <div className="max-w-[320px] space-y-3">
      {/* Type badge */}
      <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-[var(--stone-500)] dark:text-[var(--stone-400)]">
        <Icon className="h-3 w-3" />
        <span>{typeLabel}</span>
      </div>

      {/* Canonical name */}
      <h4 className="font-display text-base font-semibold leading-tight text-foreground">
        {entity.canonical_name}
      </h4>

      {/* Disambiguation note */}
      {entity.disambiguation_note && (
        <p className="text-xs italic text-muted-foreground">
          {entity.disambiguation_note}
        </p>
      )}

      {/* Quick glance */}
      {entity.quick_glance ? (
        <p className="font-body text-sm leading-relaxed text-muted-foreground">
          {entity.quick_glance}
        </p>
      ) : (
        <p className="text-xs italic text-muted-foreground">
          Context not yet available for this reference.
        </p>
      )}

      {/* Explore link */}
      {entity.quick_glance && (
        <button
          onClick={onExplore}
          className="flex items-center gap-1 text-sm font-medium text-[var(--sage-500)] transition-colors hover:text-[var(--sage-700)]"
        >
          Explore
          <span aria-hidden="true">&rarr;</span>
        </button>
      )}
    </div>
  );
}

export { ENTITY_TYPE_ICONS, ENTITY_TYPE_LABELS };
